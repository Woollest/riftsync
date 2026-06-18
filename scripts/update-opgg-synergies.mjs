import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractNextFlightText,
  fetchOpggText,
  findMatchingBracket,
  getChampionMaps,
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

const topPerSection = getNumberArg("--top", 3);
const concurrency = getNumberArg("--concurrency", 4);
const limitPages = getNumberArg("--limit-pages", 0);
const minSampleSize = getNumberArg("--min-sample", 0);
const isDryRun = process.argv.includes("--dry-run");
const validRoleSet = new Set(validRoles);

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

function toComboScore(row) {
  const winRate = row.win_rate * 100;
  const pickRate = row.pick_rate * 100;
  const tierRank = Number.isFinite(row.tier_rank) ? row.tier_rank : 3;
  const winScore = 60 + (winRate - 50) * 4.5;
  const pickScore = Math.min(10, pickRate * 1.1);
  const tierScore = Math.max(-4, 8 - tierRank * 2);
  const samplePenalty = row.play < 500 ? 10 : row.play < 1000 ? 4 : 0;

  return Math.round(clamp(winScore + pickScore + tierScore - samplePenalty, 35, 96));
}

function toReasonType(recommendedRole, tags) {
  if (recommendedRole === "support") {
    if (tags.includes("Tank")) {
      return "cc_chain";
    }

    if (tags.includes("Mage")) {
      return "lane_pressure";
    }

    return "peel_dps";
  }

  if (recommendedRole === "jungle") {
    if (tags.includes("Tank")) {
      return "engage_followup";
    }

    return "roam_follow";
  }

  if (recommendedRole === "mid") {
    if (tags.includes("Assassin")) {
      return "burst_window";
    }

    return "damage_balance";
  }

  if (recommendedRole === "adc") {
    if (tags.includes("Mage")) {
      return "teamfight_aoe";
    }

    return "peel_dps";
  }

  if (tags.includes("Tank")) {
    return "frontline_cover";
  }

  return "engage_followup";
}

function toOpggSynergyUrl(opggChampionKey, role) {
  return `https://op.gg/lol/champions/${opggChampionKey}/synergies/${role}?region=global&tier=gold_plus&mode=ranked`;
}

async function loadRoleTargets(championMaps) {
  const roleStats = toRecords(await readFile(roleStatsPath, "utf8"), "data/manual/roleStats.csv");
  const seen = new Set();
  const targets = [];
  const roleStatKeys = new Set();
  const missingOpggKeys = new Set();

  for (const stat of roleStats) {
    const role = stat.role;
    const key = `${stat.championId}:${role}`;

    roleStatKeys.add(key);

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
    roleStatKeys,
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

async function fetchTargetSynergies(target, championMaps, roleStatKeys) {
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
      .sort((a, b) => b.pick_rate - a.pick_rate || b.play - a.play)
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

        if (!roleStatKeys.has(`${recommendedChampionId}:${section.synergyPosition}`)) {
          skipped.missingRoleStat += 1;
          return null;
        }

        if (row.play < minSampleSize) {
          skipped.lowSample += 1;
          return null;
        }

        return {
          allyChampionId: target.championId,
          allyRole: target.role,
          comboScore: toComboScore(row),
          pairWinRate: toPercent(row.win_rate * 100),
          reasonType: toReasonType(
            section.synergyPosition,
            championMaps.tagsByChampionId.get(recommendedChampionId) ?? [],
          ),
          recommendedChampionId,
          recommendedRole: section.synergyPosition,
          sampleSize: row.play,
        };
      })
      .filter(Boolean)
      .slice(0, topPerSection);

    rows.push(...sectionRows);
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
    "sampleSize",
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
        row.sampleSize,
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
  const source = "OP.GG Champion Tier List and Champion Synergy Pages Global Gold+ Ranked Solo/Duo";
  const csv = [
    "patch,rankRange,region,source,updatedAt,isSample",
    [
      meta.patch,
      meta.rankRange,
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
  const { missingOpggKeys, roleStatKeys, targets } = await loadRoleTargets(championMaps);

  if (missingOpggKeys.size > 0) {
    console.warn(`Skipped roleStats with no OP.GG key: ${[...missingOpggKeys].join(", ")}`);
  }

  console.log(`Fetching OP.GG synergy pages: ${targets.length}`);
  console.log(`Top rows per role section: ${topPerSection}`);
  console.log(`Concurrency: ${concurrency}`);

  const results = await mapWithConcurrency(
    targets,
    async (target, index) => {
      const result = await fetchTargetSynergies(target, championMaps, roleStatKeys);
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
