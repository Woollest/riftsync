import dataMetaJson from "./data/dataMeta.json";
import reasonTemplatesJson from "./data/reasonTemplates.json";
import roleStatsJson from "./data/roleStats.json";
import type { Champion, DataMeta, ReasonType, RoleOption, RoleStat } from "./types";

export const roles: RoleOption[] = [
  { id: "top", label: "トップ", shortLabel: "TOP" },
  { id: "jungle", label: "ジャングル", shortLabel: "JG" },
  { id: "mid", label: "ミッド", shortLabel: "MID" },
  { id: "adc", label: "ボット", shortLabel: "ADC" },
  { id: "support", label: "サポート", shortLabel: "SUP" },
];

export const champions: Champion[] = [
  { id: "malphite", nameJa: "マルファイト", nameEn: "Malphite", imageId: "Malphite", riotDifficulty: 2 },
  { id: "ornn", nameJa: "オーン", nameEn: "Ornn", imageId: "Ornn", riotDifficulty: 5 },
  { id: "shen", nameJa: "シェン", nameEn: "Shen", imageId: "Shen", riotDifficulty: 4 },
  { id: "darius", nameJa: "ダリウス", nameEn: "Darius", imageId: "Darius", riotDifficulty: 2 },
  { id: "yasuo", nameJa: "ヤスオ", nameEn: "Yasuo", imageId: "Yasuo", riotDifficulty: 10 },
  { id: "leeSin", nameJa: "リー・シン", nameEn: "Lee Sin", imageId: "LeeSin", riotDifficulty: 6 },
  { id: "jarvanIV", nameJa: "ジャーヴァンIV", nameEn: "Jarvan IV", imageId: "JarvanIV", riotDifficulty: 5 },
  { id: "amumu", nameJa: "アムム", nameEn: "Amumu", imageId: "Amumu", riotDifficulty: 3 },
  { id: "vi", nameJa: "ヴァイ", nameEn: "Vi", imageId: "Vi", riotDifficulty: 4 },
  { id: "ahri", nameJa: "アーリ", nameEn: "Ahri", imageId: "Ahri", riotDifficulty: 5 },
  { id: "orianna", nameJa: "オリアナ", nameEn: "Orianna", imageId: "Orianna", riotDifficulty: 7 },
  { id: "annie", nameJa: "アニー", nameEn: "Annie", imageId: "Annie", riotDifficulty: 3 },
  { id: "viktor", nameJa: "ビクター", nameEn: "Viktor", imageId: "Viktor", riotDifficulty: 9 },
  { id: "brand", nameJa: "ブランド", nameEn: "Brand", imageId: "Brand", riotDifficulty: 4 },
  { id: "jinx", nameJa: "ジンクス", nameEn: "Jinx", imageId: "Jinx", riotDifficulty: 6 },
  { id: "caitlyn", nameJa: "ケイトリン", nameEn: "Caitlyn", imageId: "Caitlyn", riotDifficulty: 6 },
  { id: "ashe", nameJa: "アッシュ", nameEn: "Ashe", imageId: "Ashe", riotDifficulty: 4 },
  { id: "missFortune", nameJa: "ミス・フォーチュン", nameEn: "Miss Fortune", imageId: "MissFortune", riotDifficulty: 1 },
  { id: "ezreal", nameJa: "エズリアル", nameEn: "Ezreal", imageId: "Ezreal", riotDifficulty: 7 },
  { id: "kaisa", nameJa: "カイ＝サ", nameEn: "Kai'Sa", imageId: "Kaisa", riotDifficulty: 6 },
  { id: "thresh", nameJa: "スレッシュ", nameEn: "Thresh", imageId: "Thresh", riotDifficulty: 7 },
  { id: "leona", nameJa: "レオナ", nameEn: "Leona", imageId: "Leona", riotDifficulty: 4 },
  { id: "nami", nameJa: "ナミ", nameEn: "Nami", imageId: "Nami", riotDifficulty: 5 },
  { id: "lulu", nameJa: "ルル", nameEn: "Lulu", imageId: "Lulu", riotDifficulty: 5 },
  { id: "nautilus", nameJa: "ノーチラス", nameEn: "Nautilus", imageId: "Nautilus", riotDifficulty: 6 },
  { id: "lux", nameJa: "ラックス", nameEn: "Lux", imageId: "Lux", riotDifficulty: 5 },
  { id: "seraphine", nameJa: "セラフィーン", nameEn: "Seraphine", imageId: "Seraphine", riotDifficulty: 2 },
];

export const roleStats = roleStatsJson as RoleStat[];
export const reasonTemplates = reasonTemplatesJson as Record<ReasonType, string>;
export const dataMeta = dataMetaJson as DataMeta;
