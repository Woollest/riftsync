import { champions, reasonTemplates, roleStats } from "../data";
import { roleChampionImageIds } from "./roleCatalog";
import { getSynergyTraits, getTraitCompatibilityScore } from "./synergyProfiles";
import type { Champion, DataConfidence, DifficultyLabel, PairSynergy, Recommendation, Role, RoleStat } from "./types";

export const OFF_META_PICK_RATE = 1.0;
export const LOW_DATA_SAMPLE_SIZE = 500;
/** 総合スコアの重み。味方との相性を最優先し、勝率とメタは補助評価に留める。 */
export const SCORE_WEIGHT = {
  combo: 0.85,
  winRate: 0.1,
  meta: 0.05,
};

const championById = new Map(champions.map((champion) => [champion.id, champion]));
const manualRoleStatByKey = new Map(roleStats.map((stat) => [`${stat.championId}:${stat.role}`, stat]));

export interface PairSynergyLookup {
  byGroup: Map<string, PairSynergy[]>;
  byPair: Map<string, PairSynergy>;
  size: number;
}

const roleTagWeights: Record<Role, Partial<Record<string, number>>> = {
  top: { Fighter: 10, Tank: 10, Mage: 3, Marksman: 2, Assassin: 2 },
  jungle: { Fighter: 10, Tank: 8, Assassin: 8, Mage: 4, Marksman: 1, Support: 1 },
  mid: { Mage: 10, Assassin: 9, Fighter: 5, Marksman: 4, Support: 1 },
  adc: { Marksman: 12, Mage: 5, Fighter: 2, Assassin: 1 },
  support: { Support: 12, Tank: 9, Mage: 6, Fighter: 3, Marksman: 2 },
};

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getPairKey(
  allyChampionId: string,
  allyRole: Role,
  recommendedChampionId: string,
  recommendedRole: Role,
): string {
  return [allyChampionId, allyRole, recommendedChampionId, recommendedRole].join(":");
}

function getGroupKey(allyChampionId: string, allyRole: Role, recommendedRole: Role): string {
  return [allyChampionId, allyRole, recommendedRole].join(":");
}

function comparePairSynergies(a: PairSynergy, b: PairSynergy): number {
  return (
    b.comboScore - a.comboScore ||
    (b.adjustedLift ?? 0) - (a.adjustedLift ?? 0) ||
    (b.sourceAgreementBonus ?? 0) - (a.sourceAgreementBonus ?? 0) ||
    b.sampleSize - a.sampleSize ||
    b.pairWinRate - a.pairWinRate ||
    a.recommendedChampionId.localeCompare(b.recommendedChampionId)
  );
}

/**
 * OP.GG由来の直接相性データを、単体検索と条件グループ検索の両方で引ける形に変換する。
 */
export function createPairSynergyLookup(pairSynergies: PairSynergy[]): PairSynergyLookup {
  const byGroup = new Map<string, PairSynergy[]>();
  const byPair = new Map<string, PairSynergy>();

  for (const synergy of pairSynergies) {
    byPair.set(
      getPairKey(synergy.allyChampionId, synergy.allyRole, synergy.recommendedChampionId, synergy.recommendedRole),
      synergy,
    );

    const groupKey = getGroupKey(synergy.allyChampionId, synergy.allyRole, synergy.recommendedRole);
    const group = byGroup.get(groupKey) ?? [];

    group.push(synergy);
    byGroup.set(groupKey, group);
  }

  for (const group of byGroup.values()) {
    group.sort(comparePairSynergies);
  }

  return {
    byGroup,
    byPair,
    size: pairSynergies.length,
  };
}

/**
 * 最新Data Dragonで取得したチャンピオンを優先し、なければ同梱データから取得する。
 *
 * 未知のIDはデータ不整合として扱うため、呼び出し側で握りつぶさず例外にする。
 */
export function getChampion(championId: string, championMap?: Map<string, Champion>): Champion {
  const champion = championMap?.get(championId) ?? championById.get(championId);

  if (!champion) {
    throw new Error(`Unknown champion: ${championId}`);
  }

  return champion;
}

/** Riot公式の1-10難易度を、初心者向けの3段階表示に変換する。 */
export function getDifficultyLabel(riotDifficulty: number): DifficultyLabel {
  if (riotDifficulty <= 3) {
    return "簡単";
  }

  if (riotDifficulty <= 7) {
    return "普通";
  }

  return "難しい";
}

function getManualRoleStat(championId: string, role: Role): RoleStat | undefined {
  return manualRoleStatByKey.get(`${championId}:${role}`);
}

function getTagFit(champion: Champion, role: Role): number {
  const weights = roleTagWeights[role];

  return Math.min(
    18,
    (champion.tags ?? []).reduce((total, tag) => total + (weights[tag] ?? 0), 0),
  );
}

function getProfileFit(champion: Champion, role: Role): number {
  const profile = champion.combatProfile;

  if (!profile) {
    return 0;
  }

  if (role === "top") {
    return profile.defense * 1.1 + Math.max(profile.attack, profile.magic) * 0.5;
  }

  if (role === "jungle") {
    return profile.attack * 0.8 + profile.defense * 0.6 + profile.magic * 0.35;
  }

  if (role === "mid") {
    return profile.magic * 1.05 + profile.attack * 0.35;
  }

  if (role === "adc") {
    return profile.attack * 1.25 + profile.magic * 0.35;
  }

  return profile.defense * 0.75 + profile.magic * 0.65;
}

function getExpandedRoleStat(champion: Champion, role: Role): RoleStat {
  const tagFit = getTagFit(champion, role);
  const profileFit = getProfileFit(champion, role);
  const difficultyPenalty = champion.riotDifficulty >= 8 ? 4 : champion.riotDifficulty <= 3 ? -2 : 0;
  const fitScore = clamp(tagFit + profileFit - difficultyPenalty, 8, 34);
  const metaScore = Math.round(clamp(34 + fitScore * 1.25, 34, 78));
  const winRate = roundToOne(clamp(47.6 + fitScore * 0.08, 47.8, 51.2));
  const pickRate = roundToOne(clamp(0.35 + fitScore * 0.06, 0.4, 3.2));
  const tier = metaScore >= 70 ? "B" : metaScore >= 58 ? "C" : "D";

  return {
    championId: champion.id,
    role,
    winRate,
    pickRate,
    metaScore,
    sampleSize: 0,
    source: "expanded",
    tier,
  };
}

function canExpandChampionForRole(champion: Champion, role: Role): boolean {
  return roleChampionImageIds[role].has(champion.imageId);
}

/**
 * 指定ロールで推薦候補にできる統計を返す。
 *
 * OP.GG統計がある候補を優先し、Data Dragon上のロール適性がある候補は補完データとして後ろに追加する。
 */
export function getRoleStats(role: Role, championMap?: Map<string, Champion>): RoleStat[] {
  const manualStats = roleStats.filter(
    (stat) => stat.role === role && (!championMap || championMap.has(stat.championId)),
  );

  if (!championMap || championMap.size === 0) {
    return manualStats;
  }

  const seen = new Set(manualStats.map((stat) => stat.championId));
  const expandedStats = [...championMap.values()]
    .filter((champion) => !seen.has(champion.id) && canExpandChampionForRole(champion, role))
    .map((champion) => getExpandedRoleStat(champion, role));

  return [...manualStats, ...expandedStats].sort((a, b) => {
    if ((a.source ?? "manual") !== (b.source ?? "manual")) {
      return (a.source ?? "manual") === "manual" ? -1 : 1;
    }

    return b.pickRate - a.pickRate;
  });
}

/** 味方チャンピオン一覧でロール一致側に表示するチャンピオンIDを返す。 */
export function getAvailableAllyChampionIds(role: Role): string[] {
  return getRoleStats(role)
    .slice()
    .sort((a, b) => b.pickRate - a.pickRate)
    .map((stat) => stat.championId);
}

/**
 * 1体のチャンピオンについて、指定ロールの統計または補完統計を取得する。
 */
export function getRoleStat(championId: string, role: Role, championMap?: Map<string, Champion>): RoleStat | undefined {
  const manualStat = getManualRoleStat(championId, role);

  if (manualStat) {
    if (championMap && !championMap.has(championId)) {
      return undefined;
    }

    return manualStat;
  }

  const champion = championMap?.get(championId);

  if (!champion) {
    return undefined;
  }

  if (!canExpandChampionForRole(champion, role)) {
    return undefined;
  }

  return getExpandedRoleStat(champion, role);
}

function getPairSynergy(
  pairSynergyLookup: PairSynergyLookup,
  allyChampionId: string,
  allyRole: Role,
  recommendedChampionId: string,
  recommendedRole: Role,
): PairSynergy | undefined {
  return pairSynergyLookup.byPair.get(getPairKey(allyChampionId, allyRole, recommendedChampionId, recommendedRole));
}

/** 選択中の味方と自分ロールに対して、OP.GG直接相性が何件あるかを返す。 */
export function getDirectPairSynergyCount(
  pairSynergyLookup: PairSynergyLookup,
  allyChampionId: string,
  allyRole: Role,
  recommendedRole: Role,
): number {
  return getDirectPairSynergies(pairSynergyLookup, allyChampionId, allyRole, recommendedRole).length;
}

function getDirectPairSynergies(
  pairSynergyLookup: PairSynergyLookup,
  allyChampionId: string,
  allyRole: Role,
  recommendedRole: Role,
): PairSynergy[] {
  return (pairSynergyLookup.byGroup.get(getGroupKey(allyChampionId, allyRole, recommendedRole)) ?? []).filter(
    (synergy) => synergy.recommendedChampionId !== allyChampionId,
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
    return reasonTemplates.adc_frontline_follow;
  }

  if (roleStat.role === "mid") {
    return reasonTemplates.damage_type_mix;
  }

  if (roleStat.role === "jungle") {
    return reasonTemplates.jungle_gank_setup;
  }

  if (roleStat.role === "support") {
    return reasonTemplates.support_all_in_setup;
  }

  return reasonTemplates.top_frontline_balance;
}

function getPairReason(synergy: PairSynergy): string {
  const reason = reasonTemplates[synergy.reasonType];
  const sampleSize = synergy.sampleSize.toLocaleString("ja-JP");
  const sourceText = synergy.sourceCount >= 2 ? "・2サイト一致" : "";

  if (Number.isFinite(synergy.winRateLift) && Number.isFinite(synergy.adjustedLift)) {
    const lift = synergy.winRateLift >= 0 ? `+${synergy.winRateLift.toFixed(1)}` : synergy.winRateLift.toFixed(1);
    const adjusted =
      synergy.adjustedLift >= 0 ? `+${synergy.adjustedLift.toFixed(1)}` : synergy.adjustedLift.toFixed(1);

    return `単体比${lift}pt（補正${adjusted}pt）${sourceText}。${reason}（${sampleSize}試合）`;
  }

  return `OP.GG直接${sourceText}。${reason}（${sampleSize}試合 / 勝率${synergy.pairWinRate.toFixed(1)}%）`;
}

function normalizeWinRates(items: Array<{ displayWinRate: number }>): number[] {
  if (items.length === 0) {
    return [];
  }

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
  if (sampleSize === 0) {
    return 18;
  }

  if (sampleSize < LOW_DATA_SAMPLE_SIZE) {
    return 10;
  }

  if (sampleSize < 1000) {
    return 4;
  }

  return 0;
}

function getDataConfidence(
  synergy: PairSynergy | undefined,
  roleStat: RoleStat,
  sampleSize: number,
  isExpandedData: boolean,
): {
  confidence: DataConfidence;
  confidenceLabel: string;
  confidenceReason: string;
} {
  if (synergy && sampleSize >= 1000) {
    return {
      confidence: "high",
      confidenceLabel: "信頼度 高",
      confidenceReason: "OP.GGの直接相性データが十分あります",
    };
  }

  if (synergy && sampleSize >= LOW_DATA_SAMPLE_SIZE) {
    return {
      confidence: "medium",
      confidenceLabel: "信頼度 中",
      confidenceReason: "OP.GGの直接相性データがあります",
    };
  }

  if (synergy) {
    return {
      confidence: "low",
      confidenceLabel: "信頼度 低",
      confidenceReason: "直接相性データはありますが試合数が少なめです",
    };
  }

  if (!isExpandedData && roleStat.sampleSize >= 5000) {
    return {
      confidence: "medium",
      confidenceLabel: "信頼度 中",
      confidenceReason: "ロール統計とチャンピオン特性から推定しています",
    };
  }

  return {
    confidence: "low",
    confidenceLabel: "信頼度 低",
    confidenceReason: isExpandedData ? "ロール分類で補完した候補です" : "直接相性データがないため推定しています",
  };
}

function toRecommendation(
  roleStat: RoleStat,
  allyChampionId: string,
  allyRole: Role,
  winRateScore: number,
  pairSynergyLookup: PairSynergyLookup,
  championMap?: Map<string, Champion>,
): Recommendation {
  const champion = getChampion(roleStat.championId, championMap);
  const allyChampion = championMap?.get(allyChampionId) ?? championById.get(allyChampionId);
  const synergy = getPairSynergy(pairSynergyLookup, allyChampionId, allyRole, roleStat.championId, roleStat.role);
  const isExpandedData = (roleStat.source ?? "manual") === "expanded" && !synergy;
  const comboScore =
    synergy?.comboScore ?? getGenericComboScore(roleStat, allyChampion, champion, allyRole, roleStat.role);
  const displayWinRate = synergy?.pairWinRate ?? roleStat.winRate;
  const sampleSize = synergy?.sampleSize ?? roleStat.sampleSize;
  const dataPenalty = getDataPenalty(sampleSize);
  const confidence = getDataConfidence(synergy, roleStat, sampleSize, isExpandedData);
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
    sourceAgreementBonus: synergy?.sourceAgreementBonus,
    sourceCount: synergy?.sourceCount ?? (isExpandedData ? 0 : 1),
    winRateLift: synergy?.winRateLift,
    adjustedLift: synergy?.adjustedLift,
    totalScore,
    dataPenalty,
    synergySource: synergy ? "pair" : "profile",
    scoreBreakdown,
    metaFlames: getMetaFlames(roleStat.metaScore),
    reason: synergy ? getPairReason(synergy) : `推定相性。${getFallbackReason(roleStat)}`,
    ...confidence,
    difficulty,
    isBeginnerFriendly: difficulty === "簡単",
    isExpandedData,
    isOffMeta: roleStat.pickRate < OFF_META_PICK_RATE,
    isLowData: sampleSize < LOW_DATA_SAMPLE_SIZE || isExpandedData,
  };
}

/**
 * 自分ロールの全候補をスコアリングし、総合スコア順で返す。
 *
 * 直接相性データがある候補はその勝率/試合数/コンボ相性を使い、ない候補はチャンピオン特性から推定する。
 */
export function getRecommendations(
  selfRole: Role,
  allyRole: Role,
  allyChampionId: string,
  pairSynergyLookup: PairSynergyLookup,
  championMap?: Map<string, Champion>,
): Recommendation[] {
  const candidateStats = getRoleStats(selfRole, championMap).filter((stat) => stat.championId !== allyChampionId);
  const baseItems = candidateStats.map((roleStat) => {
    const synergy = getPairSynergy(pairSynergyLookup, allyChampionId, allyRole, roleStat.championId, selfRole);

    return {
      roleStat,
      displayWinRate: synergy?.pairWinRate ?? roleStat.winRate,
    };
  });
  const normalizedRates = normalizeWinRates(baseItems);

  return candidateStats
    .map((roleStat, index) =>
      toRecommendation(roleStat, allyChampionId, allyRole, normalizedRates[index], pairSynergyLookup, championMap),
    )
    .sort((a, b) => b.totalScore - a.totalScore);
}

function selectDiverseRecommendations(recommendations: Recommendation[], limit: number): Recommendation[] {
  const selected: Recommendation[] = [];
  const usedPrimaryTags = new Set<string>();
  const topWindow = recommendations.slice(0, Math.max(limit * 4, 12));

  for (const recommendation of topWindow) {
    const primaryTag = recommendation.champion.tags?.[0] ?? "unknown";

    if (!usedPrimaryTags.has(primaryTag)) {
      selected.push(recommendation);
      usedPrimaryTags.add(primaryTag);
    }

    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const recommendation of recommendations) {
    if (!selected.some((selectedRecommendation) => selectedRecommendation.champion.id === recommendation.champion.id)) {
      selected.push(recommendation);
    }

    if (selected.length >= limit) {
      return selected;
    }
  }

  return selected;
}

function getDirectRecommendations(
  selfRole: Role,
  allyRole: Role,
  allyChampionId: string,
  pairSynergyLookup: PairSynergyLookup,
  championMap?: Map<string, Champion>,
): Recommendation[] {
  const directSynergies = getDirectPairSynergies(pairSynergyLookup, allyChampionId, allyRole, selfRole);

  if (directSynergies.length < 3) {
    return [];
  }

  return directSynergies
    .map((synergy) => getRoleStat(synergy.recommendedChampionId, synergy.recommendedRole, championMap))
    .filter((roleStat): roleStat is RoleStat => Boolean(roleStat))
    .map((roleStat) => toRecommendation(roleStat, allyChampionId, allyRole, 100, pairSynergyLookup, championMap));
}

/**
 * 画面上部に出すおすすめ3体を返す。
 *
 * OP.GG直接相性が3件以上ある場合は、その上位3体をそのまま優先する。
 * 足りない場合は総合スコアとタグ分散で、似た候補ばかりにならないよう補完する。
 */
export function getTopRecommendations(
  selfRole: Role,
  allyRole: Role,
  allyChampionId: string,
  pairSynergyLookup: PairSynergyLookup,
  championMap?: Map<string, Champion>,
): Recommendation[] {
  const directRecommendations = getDirectRecommendations(
    selfRole,
    allyRole,
    allyChampionId,
    pairSynergyLookup,
    championMap,
  );

  if (directRecommendations.length >= 3) {
    return directRecommendations.slice(0, 3);
  }

  return selectDiverseRecommendations(
    getRecommendations(selfRole, allyRole, allyChampionId, pairSynergyLookup, championMap),
    3,
  );
}

/**
 * おすすめ3体と追加候補を合わせた推薦プールを返す。
 *
 * 上位3体がBAN済み、未所持、または自信がない時でも代替候補を見られるようにする。
 */
export function getRecommendationPool(
  selfRole: Role,
  allyRole: Role,
  allyChampionId: string,
  pairSynergyLookup: PairSynergyLookup,
  championMap?: Map<string, Champion>,
  limit = 8,
): Recommendation[] {
  const directRecommendations = getDirectRecommendations(
    selfRole,
    allyRole,
    allyChampionId,
    pairSynergyLookup,
    championMap,
  ).slice(0, 3);
  const directChampionIds = new Set(directRecommendations.map((recommendation) => recommendation.champion.id));
  const scoredRecommendations = getRecommendations(
    selfRole,
    allyRole,
    allyChampionId,
    pairSynergyLookup,
    championMap,
  ).filter((recommendation) => !directChampionIds.has(recommendation.champion.id));

  if (directRecommendations.length >= 3) {
    return [
      ...directRecommendations,
      ...selectDiverseRecommendations(scoredRecommendations, Math.max(0, limit - directRecommendations.length)),
    ].slice(0, limit);
  }

  return selectDiverseRecommendations(scoredRecommendations, limit);
}

/**
 * 非推奨候補として表示する3体を返す。
 *
 * 勝率の低い順を基本にしつつ、補完だけのデータが過度に混ざらないよう直接/実統計候補を優先する。
 */
export function getAvoidRecommendations(
  selfRole: Role,
  allyRole: Role,
  allyChampionId: string,
  pairSynergyLookup: PairSynergyLookup,
  championMap?: Map<string, Champion>,
): Recommendation[] {
  const recommendations = getRecommendations(selfRole, allyRole, allyChampionId, pairSynergyLookup, championMap);
  const reliableRecommendations = recommendations.filter(
    (recommendation) => !recommendation.isExpandedData || recommendation.synergySource === "pair",
  );
  const avoidPool = reliableRecommendations.length >= 3 ? reliableRecommendations : recommendations;

  return avoidPool
    .slice()
    .sort((a, b) => a.displayWinRate - b.displayWinRate)
    .slice(0, 3);
}
