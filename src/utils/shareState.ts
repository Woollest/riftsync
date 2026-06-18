import { DEFAULT_SELECTION } from "../config/app";
import { roles } from "../data";
import type { Role } from "../domain/types";

export interface PickSelection {
  allyChampionId: string;
  allyRole: Role;
  selfRole: Role;
}

export function isRole(value: string | null): value is Role {
  return roles.some((role) => role.id === value);
}

export function getFallbackSelfRole(allyRole: Role): Role {
  return roles.find((role) => role.id !== allyRole)?.id ?? DEFAULT_SELECTION.selfRole;
}

export function getInitialSelection(): PickSelection {
  if (typeof window === "undefined") {
    return DEFAULT_SELECTION;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedAllyRole = params.get("allyRole");
  const allyRole = isRole(requestedAllyRole) ? requestedAllyRole : DEFAULT_SELECTION.allyRole;
  const requestedSelfRole = params.get("selfRole");
  const selfRole =
    isRole(requestedSelfRole) && requestedSelfRole !== allyRole ? requestedSelfRole : getFallbackSelfRole(allyRole);
  const allyChampionId = params.get("ally")?.trim() || DEFAULT_SELECTION.allyChampionId;

  return {
    allyChampionId,
    allyRole,
    selfRole,
  };
}

export function syncSelectionToUrl(selection: PickSelection): void {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams();
  params.set("allyRole", selection.allyRole);
  params.set("ally", selection.allyChampionId);
  params.set("selfRole", selection.selfRole);

  const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl !== currentUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

export function buildShareUrl(selection: PickSelection): string {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("allyRole", selection.allyRole);
  url.searchParams.set("ally", selection.allyChampionId);
  url.searchParams.set("selfRole", selection.selfRole);

  return url.toString();
}
