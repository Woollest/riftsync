/** Riot/OP.GG由来データと画面選択で共通して使う5ロール。 */
export type Role = "top" | "jungle" | "mid" | "adc" | "support";

/** Riot公式難易度を初心者向けUIに出すための3段階ラベル。 */
export type DifficultyLabel = "簡単" | "普通" | "難しい";

/** 推薦結果をユーザーがどの程度信じてよいかを示す内部レベル。 */
export type DataConfidence = "high" | "medium" | "low";

/** 1行理由テンプレートを選ぶための、構成上の相性タイプ。 */
export type ReasonType =
  | "engage_followup"
  | "cc_chain"
  | "frontline_cover"
  | "damage_balance"
  | "peel_dps"
  | "teamfight_aoe"
  | "lane_pressure"
  | "scaling_support"
  | "roam_follow"
  | "burst_window"
  | "support_all_in_setup"
  | "support_poke_lane"
  | "support_scaling_cover"
  | "adc_frontline_follow"
  | "adc_aoe_wombo"
  | "mid_jungle_skirmish"
  | "mid_frontline_aoe"
  | "jungle_gank_setup"
  | "jungle_dive_follow"
  | "top_frontline_balance"
  | "top_side_pressure"
  | "damage_type_mix";

export interface RoleOption {
  id: Role;
  label: string;
  shortLabel: string;
}

/** Data Dragonの基本情報に、アプリ内部IDと日本語/英語名を合わせたチャンピオン定義。 */
export interface Champion {
  id: string;
  nameJa: string;
  nameEn: string;
  imageId: string;
  riotDifficulty: number;
  tags?: string[];
  combatProfile?: {
    attack: number;
    defense: number;
    magic: number;
  };
}

/**
 * チャンピオン単体のロール別統計。
 *
 * `source: "expanded"` はOP.GG統計がない候補を、Data Dragonとロール分類で補完したことを表す。
 */
export interface RoleStat {
  championId: string;
  role: Role;
  winRate: number;
  pickRate: number;
  metaScore: number;
  sampleSize: number;
  tier: "S" | "A" | "B" | "C" | "D";
  source?: "manual" | "expanded";
}

/** 味方1体と自分の候補1体を結ぶ、OP.GG個別シナジーページ由来の直接相性データ。 */
export interface PairSynergy {
  allyChampionId: string;
  allyRole: Role;
  recommendedChampionId: string;
  recommendedRole: Role;
  comboScore: number;
  pairWinRate: number;
  expectedWinRate: number;
  winRateLift: number;
  adjustedLift: number;
  sampleSize: number;
  sourceCount: number;
  sourceAgreementBonus: number;
  reasonType: ReasonType;
}

/** 画面のデータ情報パネルに表示する、現在採用中のデータセット情報。 */
export interface DataMeta {
  patch: string;
  rankRange: string;
  region: string;
  source: string;
  updatedAt: string;
  isSample: boolean;
}

/** 推薦カード、追加候補、非推奨候補で共通利用する表示済みスコア。 */
export interface Recommendation {
  champion: Champion;
  roleStat: RoleStat;
  comboScore: number;
  displayWinRate: number;
  sampleSize: number;
  sourceCount: number;
  winRateLift?: number;
  adjustedLift?: number;
  sourceAgreementBonus?: number;
  totalScore: number;
  dataPenalty: number;
  synergySource: "pair" | "profile";
  scoreBreakdown: {
    combo: number;
    winRate: number;
    meta: number;
    dataPenalty: number;
  };
  metaFlames: number;
  reason: string;
  confidence: DataConfidence;
  confidenceLabel: string;
  confidenceReason: string;
  difficulty: DifficultyLabel;
  isBeginnerFriendly: boolean;
  isExpandedData: boolean;
  isOffMeta: boolean;
  isLowData: boolean;
}
