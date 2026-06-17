import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const csvDir = path.join(rootDir, "data", "manual");
const dataDir = path.join(rootDir, "src", "data");
const checkOnly = process.argv.includes("--check");
const validateOnly = process.argv.includes("--validate-only");

const csvFiles = {
  roleStats: path.join(csvDir, "roleStats.csv"),
  pairSynergies: path.join(csvDir, "pairSynergies.csv"),
  reasonTemplates: path.join(csvDir, "reasonTemplates.csv"),
  dataMeta: path.join(csvDir, "dataMeta.csv"),
};

const jsonFiles = {
  roleStats: path.join(dataDir, "roleStats.json"),
  pairSynergies: path.join(dataDir, "pairSynergies.json"),
  reasonTemplates: path.join(dataDir, "reasonTemplates.json"),
  dataMeta: path.join(dataDir, "dataMeta.json"),
};

const csvLabels = {
  roleStats: "data/manual/roleStats.csv",
  pairSynergies: "data/manual/pairSynergies.csv",
  reasonTemplates: "data/manual/reasonTemplates.csv",
  dataMeta: "data/manual/dataMeta.csv",
};

const expectedHeaders = {
  roleStats: ["championId", "role", "winRate", "pickRate", "metaScore", "sampleSize", "tier"],
  pairSynergies: [
    "allyChampionId",
    "allyRole",
    "recommendedChampionId",
    "recommendedRole",
    "comboScore",
    "pairWinRate",
    "sampleSize",
    "reasonType",
  ],
  reasonTemplates: ["reasonType", "reasonTextJa"],
  dataMeta: ["patch", "rankRange", "region", "source", "updatedAt", "isSample"],
};

const numberFields = new Set(["winRate", "pickRate", "metaScore", "sampleSize", "comboScore", "pairWinRate"]);
const booleanFields = new Set(["isSample"]);
const integerFields = new Set(["sampleSize"]);
const rangeFields = new Map([
  ["winRate", [0, 100]],
  ["pickRate", [0, 100]],
  ["metaScore", [0, 100]],
  ["comboScore", [0, 100]],
  ["pairWinRate", [0, 100]],
]);
const validRoles = new Set(["top", "jungle", "mid", "adc", "support"]);
const validTiers = new Set(["S", "A", "B", "C", "D"]);

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
      if (field.trim() !== "") {
        throw new Error(`${fileLabel}: unexpected quote in field "${field}"`);
      }
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

    if (char === "\r") {
      continue;
    }

    field += char;
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

function assertExpectedHeaders(headers, expected, fileLabel) {
  const seenHeaders = new Set();

  for (const header of headers) {
    if (seenHeaders.has(header)) {
      throw new Error(`${fileLabel}: duplicate header "${header}"`);
    }
    seenHeaders.add(header);
  }

  if (headers.join(",") !== expected.join(",")) {
    throw new Error(
      [
        `${fileLabel}: header must match the expected columns exactly`,
        `expected: ${expected.join(",")}`,
        `actual:   ${headers.join(",")}`,
      ].join("\n"),
    );
  }
}

function parseRows(text, fileLabel, expected) {
  const rows = parseCsv(text, fileLabel);

  if (rows.length < 2) {
    throw new Error(`${fileLabel}: header and at least one data row are required`);
  }

  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, "") : header).trim());
  assertExpectedHeaders(headers, expected, fileLabel);
  const records = [];

  for (const [rowIndex, cells] of rows.slice(1).entries()) {
    if (cells.length !== headers.length) {
      throw new Error(
        `${fileLabel}: row ${rowIndex + 2} has ${cells.length} column(s), expected ${headers.length}`,
      );
    }

    const record = {};
    for (const [cellIndex, rawValue] of cells.entries()) {
      const key = headers[cellIndex];
      const value = rawValue.trim();

      if (value === "") {
        throw new Error(`${fileLabel}: row ${rowIndex + 2} field "${key}" must not be empty`);
      }

      if (numberFields.has(key)) {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          throw new Error(`${fileLabel}: row ${rowIndex + 2} field "${key}" must be a number`);
        }
        record[key] = numericValue;
      } else if (booleanFields.has(key)) {
        if (!["true", "false"].includes(value.toLowerCase())) {
          throw new Error(`${fileLabel}: row ${rowIndex + 2} field "${key}" must be true or false`);
        }
        record[key] = value.toLowerCase() === "true";
      } else {
        record[key] = value;
      }
    }

    records.push(record);
  }

  return records;
}

async function readCsv(relativeName) {
  const csvPath = csvFiles[relativeName];
  const text = await readFile(csvPath, "utf8");
  return parseRows(text, path.relative(rootDir, csvPath), expectedHeaders[relativeName]);
}

function toReasonTemplateMap(records) {
  const reasonTemplates = {};

  for (const record of records) {
    reasonTemplates[record.reasonType] = record.reasonTextJa;
  }

  return reasonTemplates;
}

function addCsvError(errors, fileKey, rowNumber, message) {
  errors.push(`${csvLabels[fileKey]} row ${rowNumber}: ${message}`);
}

function addCsvWarning(warnings, fileKey, rowNumber, message) {
  warnings.push(`${csvLabels[fileKey]} row ${rowNumber}: ${message}`);
}

function validateRangeFields(record, fileKey, rowNumber, errors) {
  for (const [field, [min, max]] of rangeFields.entries()) {
    if (!Object.hasOwn(record, field)) {
      continue;
    }

    if (record[field] < min || record[field] > max) {
      addCsvError(errors, fileKey, rowNumber, `${field} must be ${min}-${max}`);
    }
  }
}

function validateIntegerFields(record, fileKey, rowNumber, errors) {
  for (const field of integerFields) {
    if (!Object.hasOwn(record, field)) {
      continue;
    }

    if (!Number.isInteger(record[field]) || record[field] < 0) {
      addCsvError(errors, fileKey, rowNumber, `${field} must be a non-negative integer`);
    }
  }
}

function validateCsvRecords({ roleStats, pairSynergies, reasonTemplateRows, dataMetaRows }) {
  const errors = [];
  const warnings = [];
  const roleStatKeys = new Set();
  const reasonTypes = new Set();
  const synergyKeys = new Set();
  const roleCandidateCounts = new Map([...validRoles].map((role) => [role, 0]));

  for (const [index, stat] of roleStats.entries()) {
    const rowNumber = index + 2;
    const roleStatKey = `${stat.championId}:${stat.role}`;

    validateRangeFields(stat, "roleStats", rowNumber, errors);
    validateIntegerFields(stat, "roleStats", rowNumber, errors);

    if (!validRoles.has(stat.role)) {
      addCsvError(errors, "roleStats", rowNumber, `role must be one of ${[...validRoles].join(", ")}`);
    }

    if (!validTiers.has(stat.tier)) {
      addCsvError(errors, "roleStats", rowNumber, `tier must be one of ${[...validTiers].join(", ")}`);
    }

    if (roleStatKeys.has(roleStatKey)) {
      addCsvError(errors, "roleStats", rowNumber, `duplicate champion/role "${roleStatKey}"`);
    }

    roleStatKeys.add(roleStatKey);

    if (validRoles.has(stat.role)) {
      roleCandidateCounts.set(stat.role, (roleCandidateCounts.get(stat.role) ?? 0) + 1);
    }
  }

  for (const [role, count] of roleCandidateCounts.entries()) {
    if (count < 3) {
      warnings.push(`data/manual/roleStats.csv: role "${role}" has ${count} candidate(s); the app displays up to 3 recommendations`);
    }
  }

  for (const [index, reason] of reasonTemplateRows.entries()) {
    const rowNumber = index + 2;

    if (reasonTypes.has(reason.reasonType)) {
      addCsvError(errors, "reasonTemplates", rowNumber, `duplicate reasonType "${reason.reasonType}"`);
    }

    reasonTypes.add(reason.reasonType);
  }

  for (const [index, synergy] of pairSynergies.entries()) {
    const rowNumber = index + 2;
    const synergyKey = [
      synergy.allyChampionId,
      synergy.allyRole,
      synergy.recommendedChampionId,
      synergy.recommendedRole,
    ].join(":");

    validateRangeFields(synergy, "pairSynergies", rowNumber, errors);
    validateIntegerFields(synergy, "pairSynergies", rowNumber, errors);

    if (!validRoles.has(synergy.allyRole)) {
      addCsvError(errors, "pairSynergies", rowNumber, `allyRole must be one of ${[...validRoles].join(", ")}`);
    }

    if (!validRoles.has(synergy.recommendedRole)) {
      addCsvError(errors, "pairSynergies", rowNumber, `recommendedRole must be one of ${[...validRoles].join(", ")}`);
    }

    if (synergyKeys.has(synergyKey)) {
      addCsvError(errors, "pairSynergies", rowNumber, `duplicate synergy "${synergyKey}"`);
    }

    synergyKeys.add(synergyKey);

    if (!reasonTypes.has(synergy.reasonType)) {
      addCsvError(errors, "pairSynergies", rowNumber, `unknown reasonType "${synergy.reasonType}"`);
    }

    if (!roleStatKeys.has(`${synergy.recommendedChampionId}:${synergy.recommendedRole}`)) {
      addCsvWarning(
        warnings,
        "pairSynergies",
        rowNumber,
        `recommended champion "${synergy.recommendedChampionId}" has no roleStats row for "${synergy.recommendedRole}"; the app will use expanded runtime data when available`,
      );
    }

    if (synergy.allyRole === synergy.recommendedRole) {
      addCsvWarning(warnings, "pairSynergies", rowNumber, "allyRole and recommendedRole are the same, so this pair is hidden by the app flow");
    }
  }

  if (dataMetaRows.length !== 1) {
    errors.push("data/manual/dataMeta.csv: exactly one data row is required");
  } else {
    const dataMeta = dataMetaRows[0];

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataMeta.updatedAt)) {
      addCsvError(errors, "dataMeta", 2, "updatedAt must use YYYY-MM-DD");
    }
  }

  return { errors, warnings };
}

function printWarnings(warnings) {
  if (warnings.length === 0) {
    return;
  }

  console.warn(`RiftSync CSV validation passed with ${warnings.length} warning(s):`);
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

async function writeJson(relativeName, value, changes) {
  const outputPath = jsonFiles[relativeName];
  const nextText = `${JSON.stringify(value, null, 2)}\n`;

  if (checkOnly) {
    const currentText = await readFile(outputPath, "utf8");
    if (currentText !== nextText) {
      changes.push(path.relative(rootDir, outputPath));
    }
    return;
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, nextText, "utf8");
}

async function main() {
  const changes = [];
  const [roleStats, pairSynergies, reasonTemplateRows, dataMetaRows] = await Promise.all([
    readCsv("roleStats"),
    readCsv("pairSynergies"),
    readCsv("reasonTemplates"),
    readCsv("dataMeta"),
  ]);
  const validation = validateCsvRecords({ roleStats, pairSynergies, reasonTemplateRows, dataMetaRows });

  if (validation.errors.length > 0) {
    console.error(`RiftSync CSV validation failed with ${validation.errors.length} error(s):`);
    for (const error of validation.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  if (validateOnly) {
    console.log("RiftSync CSV validation passed.");
    console.log(`roleStats: ${roleStats.length}`);
    console.log(`pairSynergies: ${pairSynergies.length}`);
    console.log(`reasonTemplates: ${reasonTemplateRows.length}`);
    console.log(`dataMeta: ${dataMetaRows[0].patch}`);
    printWarnings(validation.warnings);
    return;
  }

  await writeJson("roleStats", roleStats, changes);
  await writeJson("pairSynergies", pairSynergies, changes);
  await writeJson("reasonTemplates", toReasonTemplateMap(reasonTemplateRows), changes);
  await writeJson("dataMeta", dataMetaRows[0], changes);

  if (checkOnly && changes.length > 0) {
    console.error("CSV data is not in sync with generated JSON:");
    for (const file of changes) {
      console.error(`- ${file}`);
    }
    process.exitCode = 1;
    return;
  }

  if (checkOnly) {
    console.log("CSV data is in sync with generated JSON.");
    printWarnings(validation.warnings);
  } else {
    console.log("Imported CSV data into src/data JSON files.");
    console.log(`roleStats: ${roleStats.length}`);
    console.log(`pairSynergies: ${pairSynergies.length}`);
    console.log(`reasonTemplates: ${reasonTemplateRows.length}`);
    console.log(`dataMeta: ${dataMetaRows[0].patch}`);
    printWarnings(validation.warnings);
  }
}

main().catch((error) => {
  console.error("RiftSync CSV import failed:");
  console.error(error);
  process.exitCode = 1;
});
