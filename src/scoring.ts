import { champions, pairSynergies, reasonTemplates, roleStats } from "./data";
import { getSynergyTraits, getTraitCompatibilityScore } from "./synergyProfiles";
import type { Champion, DifficultyLabel, PairSynergy, Recommendation, Role, RoleStat } from "./types";

export const OFF_META_PICK_RATE = 1.0;
export const LOW_DATA_SAMPLE_SIZE = 500;
export const SCORE_WEIGHT = {
  combo: 0.85,
  winRate: 0.1,
  meta: 0.05,
};

const championById = new Map(champions.map((champion) => [champion.id, champion]));

export function getChampion(championId: string, championMap?: Map<string, Champion>): Champion {
  const champion = championMap?.get(championId) ?? championById.get(championId);

  if (!champion) {
    throw new Error(`Unknown champion: ${championId}`);
  }

  return champion;
}

export function getDifficultyLabel(riotDifficulty: number): DifficultyLabel {
  if (riotDifficulty <= 3) {
    return "簡単";
  }

  if (riotDifficulty <= 7) {
    return "普通";
  }

  return "難しい";
}

export function getRoleStats(role: Role): RoleStat[] {
  return roleStats.filter((stat) => stat.role === role);
}

export function getAvailableAllyChampionIds(role: Role): string[] {
  return getRoleStats(role)
    .slice()
    .sort((a, b) => b.pickRate - a.pickRate)
    .map((stat) => stat.championId);
}

export function getRoleStat(championId: string, role: Role): RoleStat | undefined {
  return roleStats.find((stat) => stat.championId === championId && stat.role === role);
}

function getPairSynergy(allyChampionId: string, allyRole: Role, recommendedChampionId: string, recommendedRole: Role): PairSynergy | undefined {
  return pairSynergies.find(
    (synergy) =>
      synergy.allyChampionId === allyChampionId &&
      synergy.allyRole === allyRole &&
      synergy.recommendedChampionId === recommendedChampionId &&
      synergy.recommendedRole === recommendedRole,
  );
}

function getGenericComboScore(
  roleStat: RoleStat,
  allyChampion: Champion | undefined,
  recommendedChampion: Champion,
  allyRole: Role,
  selfRole: Role,
): number {
  const roleBlendBonus: Record<Role, Partial<Record<Role, number>>> = {
    top: { jungle: 6, mid: 5, adc: 8, support: 6 },
    jungle: { top: 7, mid: 8, adc: 5, support: 5 },
    mid: { top: 5, jungle: 8, adc: 6, support: 4 },
    adc: { top: 7, jungle: 5, mid: 6, support: 9 },
    support: { top: 5, jungle: 5, mid: 4, adc: 9 },
  };
  const pairBonus = roleBlendBonus[allyRole][selfRole] ?? 4;
  const allyTraits = getSynergyTraits(allyChampion, allyRole);
  const recommendedTraits = getSynergyTraits(recommendedChampion, selfRole);
  const traitBonus = getTraitCompatibilityScore(allyTraits, recommendedTraits);
  const score = 36 + pairBonus + traitBonus;

  return Math.round(Math.min(96, Math.max(36, score)));
}

function getFallbackReason(roleStat: RoleStat): string {
  if (roleStat.role === "adc") {
    return reasonTemplates.peel_dps;
  }

  if (roleStat.role === "mid") {
    return reasonTemplates.damage_balance;
  }

  if (roleStat.role === "jungle") {
    return reasonTemplates.roam_follow;
  }

  if (roleStat.role === "support") {
    return reasonTemplates.cc_chain;
  }

  return reasonTemplates.frontline_cover;
}

function normalizeWinRates(items: Array<{ displayWinRate: number }>): number[] {
  const rates = items.map((item) => item.displayWinRate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);

  if (max === min) {
    return items.map(() => 50);
  }

  return rates.map((rate) => ((rate - min) / (max - min)) * 100);
}

function getMetaFlames(metaScore: number): number {
  return Math.max(1, Math.min(5, Math.round(metaScore / 20)));
}

function getDataPenalty(sampleSize: number): number {
  if (sampleSize < LOW_DATA_SAMPLE_SIZE) {
    return 10;
  }

  if (sampleSize < 1000) {
    return 4;
  }

  return 0;
}

function toRecommendation(
  roleStat: RoleStat,
  allyChampionId: string,
  allyRole: Role,
  winRateScore: number,
  championMap?: Map<string, Champion>,
): Recommendation {
  const champion = getChampion(roleStat.championId, championMap);
  const allyChampion = championMap?.get(allyChampionId) ?? championById.get(allyChampionId);
  const synergy = getPairSynergy(allyChampionId, allyRole, roleStat.championId, roleStat.role);
  const comboScore =
    synergy?.comboScore ?? getGenericComboScore(roleStat, allyChampion, champion, allyRole, roleStat.role);
  const displayWinRate = synergy?.pairWinRate ?? roleStat.winRate;
  const sampleSize = synergy?.sampleSize ?? roleStat.sampleSize;
  const dataPenalty = getDataPenalty(sampleSize);
  const scoreBreakdown = {
    combo: comboScore * SCORE_WEIGHT.combo,
    winRate: winRateScore * SCORE_WEIGHT.winRate,
    meta: roleStat.metaScore * SCORE_WEIGHT.meta,
    dataPenalty,
  };
  const totalScore = scoreBreakdown.combo + scoreBreakdown.winRate + scoreBreakdown.meta - dataPenalty;
  const difficulty = getDifficultyLabel(champion.riotDifficulty);

  return {
    champion,
    roleStat,
    comboScore,
    displayWinRate,
    sampleSize,
    totalScore,
    dataPenalty,
    synergySource: synergy ? "pair" : "profile",
    scoreBreakdown,
    metaFlames: getMetaFlames(roleStat.metaScore),
    reason: synergy ? reasonTemplates[synergy.reasonType] : getFallbackReason(roleStat),
    difficulty,
    isBeginnerFriendly: difficulty === "簡単",
    isOffMeta: roleStat.pickRate < OFF_META_PICK_RATE,
    isLowData: sampleSize < LOW_DATA_SAMPLE_SIZE,
  };
}

export function getRecommendations(
  selfRole: Role,
  allyRole: Role,
  allyChampionId: string,
  championMap?: Map<string, Champion>,
): Recommendation[] {
  const candidateStats = getRoleStats(selfRole).filter((stat) => stat.championId !== allyChampionId);
  const baseItems = candidateStats.map((roleStat) => {
    const synergy = getPairSynergy(allyChampionId, allyRole, roleStat.championId, selfRole);

    return {
      roleStat,
      displayWinRate: synergy?.pairWinRate ?? roleStat.winRate,
    };
  });
  const normalizedRates = normalizeWinRates(baseItems);

  return candidateStats
    .map((roleStat, index) => toRecommendation(roleStat, allyChampionId, allyRole, normalizedRates[index], championMap))
    .sort((a, b) => b.totalScore - a.totalScore);
}

export function getTopRecommendations(
  selfRole: Role,
  allyRole: Role,
  allyChampionId: string,
  championMap?: Map<string, Champion>,
): Recommendation[] {
  return getRecommendations(selfRole, allyRole, allyChampionId, championMap).slice(0, 3);
}

export function getAvoidRecommendations(
  selfRole: Role,
  allyRole: Role,
  allyChampionId: string,
  championMap?: Map<string, Champion>,
): Recommendation[] {
  return getRecommendations(selfRole, allyRole, allyChampionId, championMap)
    .slice()
    .sort((a, b) => a.displayWinRate - b.displayWinRate)
    .slice(0, 3);
}
