export type Role = "top" | "jungle" | "mid" | "adc" | "support";

export type DifficultyLabel = "簡単" | "普通" | "難しい";

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
  | "burst_window";

export interface RoleOption {
  id: Role;
  label: string;
  shortLabel: string;
}

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

export interface PairSynergy {
  allyChampionId: string;
  allyRole: Role;
  recommendedChampionId: string;
  recommendedRole: Role;
  comboScore: number;
  pairWinRate: number;
  sampleSize: number;
  reasonType: ReasonType;
}

export interface DataMeta {
  patch: string;
  rankRange: string;
  region: string;
  source: string;
  updatedAt: string;
  isSample: boolean;
}

export interface Recommendation {
  champion: Champion;
  roleStat: RoleStat;
  comboScore: number;
  displayWinRate: number;
  sampleSize: number;
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
  difficulty: DifficultyLabel;
  isBeginnerFriendly: boolean;
  isExpandedData: boolean;
  isOffMeta: boolean;
  isLowData: boolean;
}
