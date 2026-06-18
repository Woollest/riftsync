import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data", "manual");

const opggUrl = "https://op.gg/lol/champions?region=global&tier=gold_plus&mode=ranked";
const versionsUrl = "https://ddragon.leagueoflegends.com/api/versions.json";

const roleMap = {
  ADC: "adc",
  JUNGLE: "jungle",
  MID: "mid",
  SUPPORT: "support",
  TOP: "top",
};

const localChampionIdByImageId = new Map([
  ["Ahri", "ahri"],
  ["Amumu", "amumu"],
  ["Annie", "annie"],
  ["Ashe", "ashe"],
  ["Brand", "brand"],
  ["Caitlyn", "caitlyn"],
  ["Darius", "darius"],
  ["Ezreal", "ezreal"],
  ["JarvanIV", "jarvanIV"],
  ["Jinx", "jinx"],
  ["Kaisa", "kaisa"],
  ["LeeSin", "leeSin"],
  ["Leona", "leona"],
  ["Lulu", "lulu"],
  ["Lux", "lux"],
  ["Malphite", "malphite"],
  ["MissFortune", "missFortune"],
  ["Nami", "nami"],
  ["Nautilus", "nautilus"],
  ["Orianna", "orianna"],
  ["Ornn", "ornn"],
  ["Seraphine", "seraphine"],
  ["Shen", "shen"],
  ["Thresh", "thresh"],
  ["Vi", "vi"],
  ["Viktor", "viktor"],
  ["Yasuo", "yasuo"],
]);

function findMatchingBracket(text, startIndex) {
  let depth = 0;
  let escape = false;
  let inString = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "[") {
      depth += 1;
    }

    if (char === "]") {
      depth -= 1;

      if (depth === 0) {
        return index + 1;
      }
    }
  }

  throw new Error("Could not find the end of the OP.GG champion data array");
}

function extractNextFlightText(html) {
  const scriptMatches = html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g);
  const chunks = [];

  for (const match of scriptMatches) {
    try {
      const payload = JSON.parse(match[1]);

      if (typeof payload[1] === "string") {
        chunks.push(payload[1]);
      }
    } catch {
      // Ignore non-JSON script payloads.
    }
  }

  return chunks.join("");
}

function extractChampionRows(html) {
  const flightText = extractNextFlightText(html);
  const statsIndex = flightText.indexOf("positionWinRate");

  if (statsIndex === -1) {
    throw new Error("Could not find OP.GG positionWinRate data");
  }

  const dataKeyIndex = flightText.lastIndexOf('"data":', statsIndex);
  const arrayStart = flightText.indexOf("[", dataKeyIndex);
  const arrayEnd = findMatchingBracket(flightText, arrayStart);

  return JSON.parse(flightText.slice(arrayStart, arrayEnd));
}

function extractTotalSamples(html) {
  const match = html.match(/Total analyzed samples<!-- --> :<\/span><strong>([0-9,]+)<\/strong>/);

  if (!match) {
    throw new Error("Could not find OP.GG total analyzed samples");
  }

  return Number(match[1].replaceAll(",", ""));
}

function toCsvValue(value) {
  const text = String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function toPercent(value) {
  return Math.round(value * 10) / 10;
}

function toTier(positionTier, positionRank) {
  if (positionTier <= 1 || positionRank <= 10) {
    return "S";
  }

  if (positionTier === 2 || positionRank <= 25) {
    return "A";
  }

  if (positionTier === 3 || positionRank <= 45) {
    return "B";
  }

  if (positionTier === 4 || positionRank <= 70) {
    return "C";
  }

  return "D";
}

function toMetaScore(positionTier, positionRank, winRate, pickRate) {
  const tierScore = Math.max(0, 40 - positionTier * 7);
  const rankScore = Math.max(0, 36 - Math.max(0, positionRank - 1) * 0.6);
  const winScore = Math.max(-12, Math.min(16, (winRate - 50) * 3.2));
  const pickScore = Math.min(8, pickRate * 0.45);

  return Math.max(20, Math.min(96, Math.round(tierScore + rankScore + winScore + pickScore)));
}

async function getChampionIdMap() {
  const versions = await fetch(versionsUrl).then((response) => response.json());
  const version = versions[0];
  const championData = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
  ).then((response) => response.json());
  const championIdByLowerImageId = new Map();

  for (const champion of Object.values(championData.data)) {
    championIdByLowerImageId.set(
      champion.id.toLowerCase(),
      localChampionIdByImageId.get(champion.id) ?? champion.id,
    );
  }

  return { championIdByLowerImageId, version };
}

async function main() {
  const [html, championMap] = await Promise.all([
    fetch(opggUrl, { headers: { "user-agent": "Mozilla/5.0" } }).then((response) => response.text()),
    getChampionIdMap(),
  ]);
  const totalSamples = extractTotalSamples(html);
  const rows = extractChampionRows(html);
  const roleStats = [];
  const missingChampionKeys = new Set();

  for (const row of rows) {
    const role = roleMap[row.positionName];
    const championId = championMap.championIdByLowerImageId.get(row.key);

    if (!role || !championId) {
      if (!championId) {
        missingChampionKeys.add(row.key);
      }

      continue;
    }

    const winRate = toPercent(row.positionWinRate);
    const pickRate = toPercent(row.positionPickRate);
    const sampleSize = Math.max(1, Math.round(totalSamples * (row.positionPickRate / 100)));
    const metaScore = toMetaScore(row.positionTier, row.positionRank, row.positionWinRate, row.positionPickRate);

    roleStats.push({
      championId,
      metaScore,
      pickRate,
      role,
      sampleSize,
      tier: toTier(row.positionTier, row.positionRank),
      winRate,
    });
  }

  roleStats.sort((a, b) => {
    const roleOrder = ["top", "jungle", "mid", "adc", "support"];
    const roleDelta = roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role);

    if (roleDelta !== 0) {
      return roleDelta;
    }

    return b.metaScore - a.metaScore || b.pickRate - a.pickRate || a.championId.localeCompare(b.championId);
  });

  const roleStatsCsv = [
    "championId,role,winRate,pickRate,metaScore,sampleSize,tier",
    ...roleStats.map((stat) =>
      [
        stat.championId,
        stat.role,
        stat.winRate,
        stat.pickRate,
        stat.metaScore,
        stat.sampleSize,
        stat.tier,
      ]
        .map(toCsvValue)
        .join(","),
    ),
    "",
  ].join("\n");

  const dataMetaCsv = [
    "patch,rankRange,region,source,updatedAt,isSample",
    [
      championMap.version,
      "Gold+",
      "Global",
      "OP.GG Champion Tier List Global Gold+ Ranked Solo/Duo",
      new Date().toISOString().slice(0, 10),
      "false",
    ]
      .map(toCsvValue)
      .join(","),
    "",
  ].join("\n");

  await Promise.all([
    writeFile(path.join(dataDir, "roleStats.csv"), roleStatsCsv, "utf8"),
    writeFile(path.join(dataDir, "dataMeta.csv"), dataMetaCsv, "utf8"),
  ]);

  console.log(`Updated roleStats.csv with ${roleStats.length} OP.GG rows.`);
  console.log(`Total analyzed samples: ${totalSamples.toLocaleString("en-US")}`);
  console.log(`Data Dragon version: ${championMap.version}`);

  if (missingChampionKeys.size > 0) {
    console.warn(`Skipped unknown OP.GG champion keys: ${[...missingChampionKeys].join(", ")}`);
  }
}

main().catch((error) => {
  console.error("Failed to update OP.GG data:");
  console.error(error);
  process.exitCode = 1;
});
