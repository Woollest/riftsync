import type { Role } from "../domain/types";

export const DEFAULT_DDRAGON_VERSION = "15.24.1";
export const DDRAGON_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
export const FEEDBACK_URL = "https://github.com/Woollest/riftsync/issues";

export const DEFAULT_SELECTION: {
  allyChampionId: string;
  allyRole: Role;
  selfRole: Role;
} = {
  allyChampionId: "malphite",
  allyRole: "top",
  selfRole: "mid",
};
