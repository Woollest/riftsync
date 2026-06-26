import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dataMode,
  dataRankRange,
  dataRegion,
  dataTier,
  extractNextFlightText,
  fetchLolalyticsText,
  fetchOpggText,
  findMatchingBracket,
  getChampionMaps,
  opggSourceLabel,
  secondarySourceLabel,
  toCsvValue,
  toPercent,
  validRoles,
} from "./opgg-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data", "manual");
const roleStatsPath = path.join(dataDir, "roleStats.csv");
const pairSynergiesPath = path.join(dataDir, "pairSynergies.csv");
const dataMetaPath = path.join(dataDir, "dataMeta.csv");

const topPerSection = getNumberArg("--top", 5);
const concurrency = getNumberArg("--concurrency", 4);
const limitPages = getNumberArg("--limit-pages", 0);
const minSampleSize = getNumberArg("--min-sample", 0);
const isDryRun = process.argv.includes("--dry-run");
const validRoleSet = new Set(validRoles);
const lolalyticsTierUrl = "https://lolalytics.com/lol/tierlist/?tier=emerald_plus";
const lolalyticsLaneRoleMap = new Map([
  ["bottom", "adc"],
  ["jungle", "jungle"],
  ["middle", "mid"],
  ["support", "support"],
  ["top", "top"],
]);

function getNumberArg(name, fallback) {
  const exactArg = process.argv.find((arg) => arg.startsWith(`${name}=`));

  if (!exactArg) {
    return fallback;
  }

  const value = Number(exactArg.slice(name.length + 1));

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }

  return Math.floor(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRoundedStat(value) {
  return Math.round(value * 10) / 10;
}

function toNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function parseCsv(text, fileLabel) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char !== "\r") {
      field += char;
    }
  }

  if (inQuotes) {
    throw new Error(`${fileLabel}: unclosed quoted field`);
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function toRecords(text, fileLabel) {
  const rows = parseCsv(text, fileLabel);
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim());

  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length) {
      throw new Error(`${fileLabel}: row ${rowIndex + 2} has ${cells.length} column(s), expected ${headers.length}`);
    }

    return Object.fromEntries(headers.map((header, index) => [header, cells[index].trim()]));
  });
}

function extractSynergySections(html) {
  const flightText = extractNextFlightText(html);
  const marker = '"synergyPosition":"';
  const sections = [];
  let index = 0;

  while (true) {
    const synergyPositionIndex = flightText.indexOf(marker, index);

    if (synergyPositionIndex === -1) {
      break;
    }

    const positionIndex = flightText.lastIndexOf('"position":"', synergyPositionIndex);
    const dataIndex = flightText.indexOf('"data":', synergyPositionIndex);

    if (positionIndex === -1 || dataIndex === -1) {
      index = synergyPositionIndex + marker.length;
      continue;
    }

    const positionStart = positionIndex + '"position":"'.length;
    const positionEnd = flightText.indexOf('"', positionStart);
    const synergyPositionStart = synergyPositionIndex + marker.length;
    const synergyPositionEnd = flightText.indexOf('"', synergyPositionStart);
    const arrayStart = flightText.indexOf("[", dataIndex);
    const arrayEnd = findMatchingBracket(flightText, arrayStart);
    const position = flightText.slice(positionStart, positionEnd);
    const synergyPosition = flightText.slice(synergyPositionStart, synergyPositionEnd);
    const data = JSON.parse(flightText.slice(arrayStart, arrayEnd));

    if (validRoleSet.has(position) && validRoleSet.has(synergyPosition)) {
      sections.push({ position, synergyPosition, data });
    }

    index = arrayEnd;
  }

  return sections;
}

function parseLolalyticsRoleIndex(html, championMaps) {
  const rows = html.split('<div class="flex h-[52px]').slice(1);
  const roleIndex = new Map();

  for (const row of rows) {
    const slug = row.match(/\/lol\/([^/]+)\/build\//)?.[1];
    const lane = row.match(/alt="([^"]+) lane"/)?.[1];
    const role = lolalyticsLaneRoleMap.get(lane ?? "");
    const championId = slug ? championMaps.championIdByOpggKey.get(slug) : undefined;
    const rank = toNumber(row.match(/q:key="0">([0-9]+)/)?.[1], Number.MAX_SAFE_INTEGER);
    const tier = row.match(/q:key="3"[\s\S]*?<!--t=[^>]+-->([^<]+)</)?.[1]?.trim() ?? "D";
    const winRate = toNumber(row.match(/q:key="5"[\s\S]*?<span[^>]*>([0-9.]+)/)?.[1], NaN);
    const pickRate = toNumber(row.match(/q:key="6">([0-9.]+)/)?.[1], NaN);

    if (!championId || !role || !Number.isFinite(winRate) || !Number.isFinite(pickRate)) {
      continue;
    }

    const key = `${championId}:${role}`;
    const current = roleIndex.get(key);
    const stat = { pickRate, rank, tier, winRate };

    if (!current || stat.rank < current.rank) {
      roleIndex.set(key, stat);
    }
  }

  return roleIndex;
}

async function loadSecondaryRoleIndex(championMaps) {
  const lanes = ["top", "jungle", "middle", "bottom", "support"];
  const roleIndex = new Map();

  try {
    const pages = await Promise.all(
      lanes.map(async (lane) => fetchLolalyticsText(`${lolalyticsTierUrl}&lane=${lane}`)),
    );

    for (const page of pages) {
      for (const [key, stat] of parseLolalyticsRoleIndex(page, championMaps)) {
        const current = roleIndex.get(key);

        if (!current || stat.rank < current.rank) {
          roleIndex.set(key, stat);
        }
      }
    }

    return roleIndex;
  } catch (error) {
    console.warn(`LoLalytics role agreement skipped: ${error.message}`);
    return new Map();
  }
}

function getSourceAgreement(roleStat, lolalyticsStat) {
  if (!lolalyticsStat) {
    return {
      sourceAgreementBonus: 0,
      sourceCount: 1,
    };
  }

  let bonus = 2;

  if (lolalyticsStat.tier.startsWith("S")) {
    bonus += 3;
  } else if (lolalyticsStat.tier.startsWith("A")) {
    bonus += 2;
  } else if (lolalyticsStat.tier.startsWith("B")) {
    bonus += 1;
  }

  if (lolalyticsStat.rank <= 20) {
    bonus += 2;
  } else if (lolalyticsStat.rank <= 50) {
    bonus += 1;
  }

  if (lolalyticsStat.winRate >= roleStat.winRate - 0.8) {
    bonus += 2;
  } else if (lolalyticsStat.winRate >= 50) {
    bonus += 1;
  }

  return {
    sourceAgreementBonus: Math.round(clamp(bonus, 0, 8)),
    sourceCount: 2,
  };
}

function getPairMetrics(row, roleStat, lolalyticsStat) {
  const pairWinRate = toPercent(row.win_rate * 100);
  const expectedWinRate = toPercent(roleStat.winRate);
  const winRateLift = toRoundedStat(pairWinRate - expectedWinRate);
  const sampleSize = Math.max(0, Math.round(row.play));
  const reliability = sampleSize / (sampleSize + 1200);
  const adjustedLift = toRoundedStat(winRateLift * reliability);
  const sampleBonus = clamp(Math.log10(sampleSize + 1) * 1.4 - 2.8, 0, 4);
  const lowSamplePenalty = sampleSize < 500 ? 10 : sampleSize < 1000 ? 4 : 0;
  const { sourceAgreementBonus, sourceCount } = getSourceAgreement(roleStat, lolalyticsStat);
  const pairStrength =
    adjustedLift * 9 + (pairWinRate - 50) * 1.2 + sampleBonus + sourceAgreementBonus - lowSamplePenalty;

  return {
    adjustedLift,
    comboScore: Math.round(clamp(50 + pairStrength, 35, 96)),
    expectedWinRate,
    pairStrength,
    pairWinRate,
    sampleSize,
    sourceAgreementBonus,
    sourceCount,
    winRateLift,
  };
}

function toReasonType(recommendedRole, tags, allyRole) {
  if (recommendedRole === "support") {
    if (tags.includes("Tank")) {
      return "support_all_in_setup";
    }

    if (tags.includes("Mage")) {
      return "support_poke_lane";
    }

    return allyRole === "adc" ? "support_scaling_cover" : "peel_dps";
  }

  if (recommendedRole === "jungle") {
    if (allyRole === "top" || allyRole === "mid") {
      return "jungle_gank_setup";
    }

    return "jungle_dive_follow";
  }

  if (recommendedRole === "mid") {
    if (allyRole === "jungle") {
      return "mid_jungle_skirmish";
    }

    if (tags.includes("Assassin")) {
      return "burst_window";
    }

    return allyRole === "top" || allyRole === "support" ? "mid_frontline_aoe" : "damage_type_mix";
  }

  if (recommendedRole === "adc") {
    if (tags.includes("Mage")) {
      return "adc_aoe_wombo";
    }

    return "adc_frontline_follow";
  }

  if (tags.includes("Tank")) {
    return "top_frontline_balance";
  }

  return "top_side_pressure";
}

function toOpggSynergyUrl(opggChampionKey, role) {
  return `https://op.gg/lol/champions/${opggChampionKey}/synergies/${role}?region=${dataRegion}&tier=${dataTier}&mode=${dataMode}`;
}

async function loadRoleTargets(championMaps) {
  const roleStats = toRecords(await readFile(roleStatsPath, "utf8"), "data/manual/roleStats.csv");
  const seen = new Set();
  const targets = [];
  const roleStatByKey = new Map();
  const missingOpggKeys = new Set();

  for (const stat of roleStats) {
    const role = stat.role;
    const key = `${stat.championId}:${role}`;

    roleStatByKey.set(key, {
      ...stat,
      metaScore: toNumber(stat.metaScore),
      pickRate: toNumber(stat.pickRate),
      sampleSize: Math.round(toNumber(stat.sampleSize)),
      winRate: toNumber(stat.winRate),
    });

    if (!validRoleSet.has(role) || seen.has(key)) {
      continue;
    }

    const opggChampionKey = championMaps.opggKeyByChampionId.get(stat.championId);

    if (!opggChampionKey) {
      missingOpggKeys.add(stat.championId);
      continue;
    }

    seen.add(key);
    targets.push({
      championId: stat.championId,
      opggChampionKey,
      role,
    });
  }

  return {
    missingOpggKeys,
    roleStatByKey,
    targets: limitPages > 0 ? targets.slice(0, limitPages) : targets,
  };
}

async function mapWithConcurrency(items, worker, workerCount) {
  const results = [];
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, workerCount) }, () => runWorker()),
  );

  return results;
}

async function fetchTargetSynergies(target, championMaps, roleStatByKey, secondaryRoleIndex) {
  const url = toOpggSynergyUrl(target.opggChampionKey, target.role);
  const html = await fetchOpggText(url);
  const sections = extractSynergySections(html);
  const rows = [];
  const skipped = {
    lowSample: 0,
    missingChampion: 0,
    missingRoleStat: 0,
    sameChampion: 0,
  };

  for (const section of sections) {
    if (section.position !== target.role || section.synergyPosition === target.role) {
      continue;
    }

    const sectionRows = section.data
      .slice()
      .map((row) => {
        const recommendedChampionId = championMaps.championIdByOpggKey.get(row.synergy_champion_key);

        if (!recommendedChampionId) {
          skipped.missingChampion += 1;
          return null;
        }

        if (recommendedChampionId === target.championId) {
          skipped.sameChampion += 1;
          return null;
        }

        const roleStat = roleStatByKey.get(`${recommendedChampionId}:${section.synergyPosition}`);

        if (!roleStat) {
          skipped.missingRoleStat += 1;
          return null;
        }

        if (row.play < minSampleSize) {
          skipped.lowSample += 1;
          return null;
        }

        const metrics = getPairMetrics(
          row,
          roleStat,
          secondaryRoleIndex.get(`${recommendedChampionId}:${section.synergyPosition}`),
        );

        return {
          allyChampionId: target.championId,
          allyRole: target.role,
          adjustedLift: metrics.adjustedLift,
          comboScore: metrics.comboScore,
          expectedWinRate: metrics.expectedWinRate,
          pairStrength: metrics.pairStrength,
          pairWinRate: metrics.pairWinRate,
          reasonType: toReasonType(
            section.synergyPosition,
            championMaps.tagsByChampionId.get(recommendedChampionId) ?? [],
            target.role,
          ),
          recommendedChampionId,
          recommendedRole: section.synergyPosition,
          sampleSize: metrics.sampleSize,
          sourceAgreementBonus: metrics.sourceAgreementBonus,
          sourceCount: metrics.sourceCount,
          winRateLift: metrics.winRateLift,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.pairStrength - a.pairStrength ||
          b.adjustedLift - a.adjustedLift ||
          b.sourceAgreementBonus - a.sourceAgreementBonus ||
          b.sampleSize - a.sampleSize ||
          b.pairWinRate - a.pairWinRate ||
          a.recommendedChampionId.localeCompare(b.recommendedChampionId),
      )
      .slice(0, topPerSection);

    rows.push(...sectionRows.map(({ pairStrength, ...row }) => row));
  }

  return { rows, skipped, target };
}

function toPairSynergiesCsv(rows) {
  const header = [
    "allyChampionId",
    "allyRole",
    "recommendedChampionId",
    "recommendedRole",
    "comboScore",
    "pairWinRate",
    "expectedWinRate",
    "winRateLift",
    "adjustedLift",
    "sampleSize",
    "sourceCount",
    "sourceAgreementBonus",
    "reasonType",
  ];

  return [
    header.join(","),
    ...rows.map((row) =>
      [
        row.allyChampionId,
        row.allyRole,
        row.recommendedChampionId,
        row.recommendedRole,
        row.comboScore,
        row.pairWinRate,
        row.expectedWinRate,
        row.winRateLift,
        row.adjustedLift,
        row.sampleSize,
        row.sourceCount,
        row.sourceAgreementBonus,
        row.reasonType,
      ]
        .map(toCsvValue)
        .join(","),
    ),
    "",
  ].join("\n");
}

async function updateDataMetaSource() {
  const [meta] = toRecords(await readFile(dataMetaPath, "utf8"), "data/manual/dataMeta.csv");
  const source = [opggSourceLabel, secondarySourceLabel].join("; ");
  const csv = [
    "patch,rankRange,region,source,updatedAt,isSample",
    [
      meta.patch,
      dataRankRange,
      meta.region,
      source,
      new Date().toISOString().slice(0, 10),
      "false",
    ]
      .map(toCsvValue)
      .join(","),
    "",
  ].join("\n");

  await writeFile(dataMetaPath, csv, "utf8");
}

function printSkippedSummary(results) {
  const skipped = results.reduce(
    (total, result) => {
      total.lowSample += result.skipped.lowSample;
      total.missingChampion += result.skipped.missingChampion;
      total.missingRoleStat += result.skipped.missingRoleStat;
      total.sameChampion += result.skipped.sameChampion;
      return total;
    },
    { lowSample: 0, missingChampion: 0, missingRoleStat: 0, sameChampion: 0 },
  );

  if (skipped.missingChampion > 0) {
    console.warn(`Skipped ${skipped.missingChampion} synergy row(s) with unknown OP.GG champion keys.`);
  }

  if (skipped.missingRoleStat > 0) {
    console.warn(`Skipped ${skipped.missingRoleStat} synergy row(s) without roleStats coverage.`);
  }

  if (skipped.sameChampion > 0) {
    console.warn(`Skipped ${skipped.sameChampion} same-champion synergy row(s).`);
  }

  if (skipped.lowSample > 0) {
    console.warn(`Skipped ${skipped.lowSample} synergy row(s) below --min-sample=${minSampleSize}.`);
  }
}

async function main() {
  const championMaps = await getChampionMaps();
  const [{ missingOpggKeys, roleStatByKey, targets }, secondaryRoleIndex] = await Promise.all([
    loadRoleTargets(championMaps),
    loadSecondaryRoleIndex(championMaps),
  ]);

  if (missingOpggKeys.size > 0) {
    console.warn(`Skipped roleStats with no OP.GG key: ${[...missingOpggKeys].join(", ")}`);
  }

  console.log(`Fetching OP.GG synergy pages: ${targets.length}`);
  console.log(`Top rows per role section: ${topPerSection}`);
  console.log(`Concurrency: ${concurrency}`);
  console.log(`LoLalytics role agreement rows: ${secondaryRoleIndex.size}`);

  const results = await mapWithConcurrency(
    targets,
    async (target, index) => {
      const result = await fetchTargetSynergies(target, championMaps, roleStatByKey, secondaryRoleIndex);
      const current = index + 1;

      if (current % 25 === 0 || current === targets.length) {
        console.log(`Fetched ${current}/${targets.length}`);
      }

      return result;
    },
    concurrency,
  );
  const rows = results.flatMap((result) => result.rows);
  const lowDataCount = rows.filter((row) => row.sampleSize < 500).length;
  const coveredGroups = new Set(
    rows.map((row) => `${row.allyChampionId}:${row.allyRole}:${row.recommendedRole}`),
  );

  printSkippedSummary(results);
  console.log(`Generated pairSynergies rows: ${rows.length}`);
  console.log(`Covered ally/role/self-role groups: ${coveredGroups.size}`);
  console.log(`Rows below 500 games: ${lowDataCount}`);

  if (isDryRun) {
    console.log("Dry run: pairSynergies.csv was not changed.");
    return;
  }

  await writeFile(pairSynergiesPath, toPairSynergiesCsv(rows), "utf8");
  await updateDataMetaSource();
  console.log("Updated data/manual/pairSynergies.csv from OP.GG synergy pages.");
}

main().catch((error) => {
  console.error("Failed to update OP.GG synergies:");
  console.error(error);
  process.exitCode = 1;
});
