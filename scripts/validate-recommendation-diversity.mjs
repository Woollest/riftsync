import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const roles = ["top", "jungle", "mid", "adc", "support"];

const maxDominantSetRatio = getNumberArg("--max-set-ratio", 0.65);
const maxTop1WarningRatio = getNumberArg("--max-top1-ratio", 0.95);
const minGroups = getNumberArg("--min-groups", 8);
const minUniqueTop3 = getNumberArg("--min-unique-top3", 4);

function getNumberArg(name, fallback) {
  const exactArg = process.argv.find((arg) => arg.startsWith(`${name}=`));

  if (!exactArg) {
    return fallback;
  }

  const value = Number(exactArg.slice(name.length + 1));

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }

  return value;
}

function countValues(values) {
  return values.reduce((counts, value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  }, new Map());
}

function getTopCount(counts) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ["-", 0];
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function getGroupKey(row) {
  return `${row.allyChampionId}:${row.allyRole}:${row.recommendedRole}`;
}

async function main() {
  const pairSynergies = JSON.parse(await readFile(path.join(rootDir, "src", "data", "pairSynergies.json"), "utf8"));
  const errors = [];
  const warnings = [];
  const summaries = [];

  for (const allyRole of roles) {
    for (const selfRole of roles) {
      if (allyRole === selfRole) {
        continue;
      }

      const groups = new Map();

      for (const row of pairSynergies) {
        if (row.allyRole !== allyRole || row.recommendedRole !== selfRole) {
          continue;
        }

        const groupKey = getGroupKey(row);
        const group = groups.get(groupKey) ?? [];

        group.push(row.recommendedChampionId);
        groups.set(groupKey, group);
      }

      const completeGroups = [...groups.values()].filter((recommendations) => recommendations.length >= 3);

      if (completeGroups.length < minGroups) {
        continue;
      }

      const top1 = completeGroups.map((recommendations) => recommendations[0]);
      const top3Candidates = completeGroups.flatMap((recommendations) => recommendations.slice(0, 3));
      const top3Sets = completeGroups.map((recommendations) => recommendations.slice(0, 3).join(" / "));
      const [dominantTop1, dominantTop1Count] = getTopCount(countValues(top1));
      const [dominantSet, dominantSetCount] = getTopCount(countValues(top3Sets));
      const dominantTop1Ratio = dominantTop1Count / completeGroups.length;
      const dominantSetRatio = dominantSetCount / completeGroups.length;
      const uniqueTop3Candidates = new Set(top3Candidates);
      const label = `${allyRole}->${selfRole}`;

      summaries.push(
        `${label}: groups=${completeGroups.length}, uniqueTop3=${uniqueTop3Candidates.size}, top1=${dominantTop1} ${formatPercent(
          dominantTop1Ratio,
        )}, top3set=${formatPercent(dominantSetRatio)}`,
      );

      if (uniqueTop3Candidates.size < minUniqueTop3) {
        errors.push(
          `${label}: top3 recommendations use only ${uniqueTop3Candidates.size} unique champion(s), expected at least ${minUniqueTop3}`,
        );
      }

      if (dominantSetRatio > maxDominantSetRatio) {
        errors.push(
          `${label}: dominant top3 set appears in ${formatPercent(dominantSetRatio)} of groups, above ${formatPercent(
            maxDominantSetRatio,
          )}: ${dominantSet}`,
        );
      }

      if (dominantTop1Ratio > maxTop1WarningRatio) {
        warnings.push(
          `${label}: top recommendation is ${dominantTop1} in ${formatPercent(
            dominantTop1Ratio,
          )} of groups; consider expanding OP.GG synergy coverage or reviewing scoring if this feels stale`,
        );
      }
    }
  }

  console.log("RiftSync recommendation diversity summary:");
  for (const summary of summaries) {
    console.log(`- ${summary}`);
  }

  if (warnings.length > 0) {
    console.log(`RiftSync recommendation diversity passed with ${warnings.length} warning(s):`);
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (errors.length > 0) {
    console.error(`RiftSync recommendation diversity failed with ${errors.length} error(s):`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("RiftSync recommendation diversity validation passed.");
}

main().catch((error) => {
  console.error("RiftSync recommendation diversity validation failed unexpectedly:");
  console.error(error);
  process.exitCode = 1;
});
