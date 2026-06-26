import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dataMode,
  dataRankRange,
  dataRegion,
  dataTier,
  extractNextFlightText,
  fetchOpggText,
  findMatchingBracket,
  getChampionMaps,
  getLolalyticsMeta,
  opggRoleMap,
  opggSourceLabel,
  secondarySourceLabel,
  toCsvValue,
  toPercent,
} from "./opgg-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data", "manual");

const opggUrl = `https://op.gg/lol/champions?region=${dataRegion}&tier=${dataTier}&mode=${dataMode}`;

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

async function main() {
  const [html, championMap, lolalyticsMeta] = await Promise.all([
    fetchOpggText(opggUrl),
    getChampionMaps(),
    getLolalyticsMeta().catch((error) => {
      console.warn(`LoLalytics secondary check skipped: ${error.message}`);
      return null;
    }),
  ]);
  const totalSamples = extractTotalSamples(html);
  const rows = extractChampionRows(html);
  const roleStats = [];
  const missingChampionKeys = new Set();

  for (const row of rows) {
    const role = opggRoleMap[row.positionName];
    const championId = championMap.championIdByOpggKey.get(row.key);

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

  const sourceParts = [opggSourceLabel];

  if (lolalyticsMeta) {
    sourceParts.push(secondarySourceLabel);
  }

  const dataMetaCsv = [
    "patch,rankRange,region,source,updatedAt,isSample",
    [
      championMap.version,
      dataRankRange,
      "Global",
      sourceParts.join("; "),
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

  if (lolalyticsMeta) {
    console.log(
      `LoLalytics cross-check: patch ${lolalyticsMeta.patch ?? "unknown"}, Emerald+ champions analyzed ${
        lolalyticsMeta.analyzedChampions?.toLocaleString("en-US") ?? "unknown"
      }, Locke ${lolalyticsMeta.hasLocke ? "present" : "not found"}`,
    );
  }

  if (missingChampionKeys.size > 0) {
    console.warn(`Skipped unknown OP.GG champion keys: ${[...missingChampionKeys].join(", ")}`);
  }
}

main().catch((error) => {
  console.error("Failed to update OP.GG data:");
  console.error(error);
  process.exitCode = 1;
});
