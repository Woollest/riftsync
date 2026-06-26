import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const validRoles = new Set(["top", "jungle", "mid", "adc", "support"]);
const validTiers = new Set(["S", "A", "B", "C", "D"]);
const localChampionIdByImageId = new Map([
  ["Malphite", "malphite"],
  ["Ornn", "ornn"],
  ["Shen", "shen"],
  ["Darius", "darius"],
  ["Yasuo", "yasuo"],
  ["LeeSin", "leeSin"],
  ["JarvanIV", "jarvanIV"],
  ["Amumu", "amumu"],
  ["Vi", "vi"],
  ["Ahri", "ahri"],
  ["Orianna", "orianna"],
  ["Annie", "annie"],
  ["Viktor", "viktor"],
  ["Brand", "brand"],
  ["Jinx", "jinx"],
  ["Caitlyn", "caitlyn"],
  ["Ashe", "ashe"],
  ["MissFortune", "missFortune"],
  ["Ezreal", "ezreal"],
  ["Kaisa", "kaisa"],
  ["Thresh", "thresh"],
  ["Leona", "leona"],
  ["Nami", "nami"],
  ["Lulu", "lulu"],
  ["Nautilus", "nautilus"],
  ["Lux", "lux"],
  ["Seraphine", "seraphine"],
]);

async function readJson(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function getKnownChampionIds() {
  const versions = await fetch("https://ddragon.leagueoflegends.com/api/versions.json").then((response) =>
    response.json(),
  );
  const version = versions[0];
  const champions = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
  ).then((response) => response.json());
  const ids = new Set();

  for (const champion of Object.values(champions.data)) {
    ids.add(localChampionIdByImageId.get(champion.id) ?? champion.id);
  }

  return { ids, version };
}

function pushError(errors, file, message) {
  errors.push(`${file}: ${message}`);
}

function pushWarning(warnings, file, message) {
  warnings.push(`${file}: ${message}`);
}

function isNumberInRange(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function validateRoleStats(roleStats, knownChampionIds, errors) {
  const file = "data/manual/roleStats.csv";
  const seen = new Set();

  if (!Array.isArray(roleStats)) {
    pushError(errors, file, "root must be an array");
    return;
  }

  for (const [index, stat] of roleStats.entries()) {
    const row = `${file} row ${index + 2}`;

    if (!knownChampionIds.has(stat.championId)) {
      pushError(errors, row, `unknown championId "${stat.championId}"`);
    }

    if (!validRoles.has(stat.role)) {
      pushError(errors, row, `invalid role "${stat.role}"`);
    }

    const duplicateKey = `${stat.championId}:${stat.role}`;
    if (seen.has(duplicateKey)) {
      pushError(errors, row, `duplicate championId/role "${duplicateKey}"`);
    }
    seen.add(duplicateKey);

    if (!isNumberInRange(stat.winRate, 0, 100)) {
      pushError(errors, row, "winRate must be 0-100");
    }

    if (!isNumberInRange(stat.pickRate, 0, 100)) {
      pushError(errors, row, "pickRate must be 0-100");
    }

    if (!isNumberInRange(stat.metaScore, 0, 100)) {
      pushError(errors, row, "metaScore must be 0-100");
    }

    if (!Number.isInteger(stat.sampleSize) || stat.sampleSize < 0) {
      pushError(errors, row, "sampleSize must be a non-negative integer");
    }

    if (!validTiers.has(stat.tier)) {
      pushError(errors, row, `invalid tier "${stat.tier}"`);
    }
  }
}

function validatePairSynergies(pairSynergies, roleStats, reasonTemplates, knownChampionIds, errors, warnings) {
  const file = "data/manual/pairSynergies.csv";
  const seen = new Set();
  const roleStatKeys = new Set(roleStats.map((stat) => `${stat.championId}:${stat.role}`));

  if (!Array.isArray(pairSynergies)) {
    pushError(errors, file, "root must be an array");
    return;
  }

  for (const [index, synergy] of pairSynergies.entries()) {
    const row = `${file} row ${index + 2}`;

    if (!knownChampionIds.has(synergy.allyChampionId)) {
      pushError(errors, row, `unknown allyChampionId "${synergy.allyChampionId}"`);
    }

    if (!knownChampionIds.has(synergy.recommendedChampionId)) {
      pushError(errors, row, `unknown recommendedChampionId "${synergy.recommendedChampionId}"`);
    }

    if (!validRoles.has(synergy.allyRole)) {
      pushError(errors, row, `invalid allyRole "${synergy.allyRole}"`);
    }

    if (!validRoles.has(synergy.recommendedRole)) {
      pushError(errors, row, `invalid recommendedRole "${synergy.recommendedRole}"`);
    }

    const duplicateKey = [
      synergy.allyChampionId,
      synergy.allyRole,
      synergy.recommendedChampionId,
      synergy.recommendedRole,
    ].join(":");

    if (seen.has(duplicateKey)) {
      pushError(errors, row, `duplicate synergy "${duplicateKey}"`);
    }
    seen.add(duplicateKey);

    if (!roleStatKeys.has(`${synergy.recommendedChampionId}:${synergy.recommendedRole}`)) {
      pushWarning(
        warnings,
        row,
        `recommended champion "${synergy.recommendedChampionId}" has no roleStats entry for "${synergy.recommendedRole}"; expanded runtime data will be used when available`,
      );
    }

    if (!isNumberInRange(synergy.comboScore, 0, 100)) {
      pushError(errors, row, "comboScore must be 0-100");
    }

    if (!isNumberInRange(synergy.pairWinRate, 0, 100)) {
      pushError(errors, row, "pairWinRate must be 0-100");
    }

    if (!isNumberInRange(synergy.expectedWinRate, 0, 100)) {
      pushError(errors, row, "expectedWinRate must be 0-100");
    }

    if (!isNumberInRange(synergy.winRateLift, -30, 30)) {
      pushError(errors, row, "winRateLift must be -30-30");
    }

    if (!isNumberInRange(synergy.adjustedLift, -30, 30)) {
      pushError(errors, row, "adjustedLift must be -30-30");
    }

    if (!Number.isInteger(synergy.sampleSize) || synergy.sampleSize < 0) {
      pushError(errors, row, "sampleSize must be a non-negative integer");
    }

    if (!Number.isInteger(synergy.sourceCount) || synergy.sourceCount < 1 || synergy.sourceCount > 3) {
      pushError(errors, row, "sourceCount must be an integer from 1 to 3");
    }

    if (!isNumberInRange(synergy.sourceAgreementBonus, 0, 20)) {
      pushError(errors, row, "sourceAgreementBonus must be 0-20");
    }

    if (!Object.hasOwn(reasonTemplates, synergy.reasonType)) {
      pushError(errors, row, `unknown reasonType "${synergy.reasonType}"`);
    }
  }
}

function validateReasonTemplates(reasonTemplates, errors) {
  const file = "data/manual/reasonTemplates.csv";

  if (!reasonTemplates || typeof reasonTemplates !== "object" || Array.isArray(reasonTemplates)) {
    pushError(errors, file, "root must be an object");
    return;
  }

  for (const [key, text] of Object.entries(reasonTemplates)) {
    if (!key.trim()) {
      pushError(errors, file, "reason key must not be empty");
    }

    if (typeof text !== "string" || !text.trim()) {
      pushError(errors, file, `reason "${key}" must be a non-empty string`);
    }
  }
}

function validateDataMeta(dataMeta, errors) {
  const file = "data/manual/dataMeta.csv row 2";
  const requiredStringFields = ["patch", "rankRange", "region", "source", "updatedAt"];

  for (const field of requiredStringFields) {
    if (typeof dataMeta[field] !== "string" || !dataMeta[field].trim()) {
      pushError(errors, file, `${field} must be a non-empty string`);
    }
  }

  if (typeof dataMeta.isSample !== "boolean") {
    pushError(errors, file, "isSample must be a boolean");
  }
}

async function main() {
  const errors = [];
  const warnings = [];
  const [roleStats, pairSynergies, reasonTemplates, dataMeta, knownChampions] = await Promise.all([
    readJson("src/data/roleStats.json"),
    readJson("src/data/pairSynergies.json"),
    readJson("src/data/reasonTemplates.json"),
    readJson("src/data/dataMeta.json"),
    getKnownChampionIds(),
  ]);

  validateRoleStats(roleStats, knownChampions.ids, errors);
  validateReasonTemplates(reasonTemplates, errors);
  validatePairSynergies(pairSynergies, roleStats, reasonTemplates, knownChampions.ids, errors, warnings);
  validateDataMeta(dataMeta, errors);

  if (errors.length > 0) {
    console.error(`RiftSync data validation failed with ${errors.length} error(s):`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  if (warnings.length > 0) {
    console.warn(`RiftSync data validation passed with ${warnings.length} warning(s):`);
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  console.log("RiftSync data validation passed.");
  console.log(`Data Dragon version: ${knownChampions.version}`);
  console.log(`roleStats: ${roleStats.length}`);
  console.log(`pairSynergies: ${pairSynergies.length}`);
  console.log(`reasonTemplates: ${Object.keys(reasonTemplates).length}`);
}

main().catch((error) => {
  console.error("RiftSync data validation failed unexpectedly:");
  console.error(error);
  process.exitCode = 1;
});
