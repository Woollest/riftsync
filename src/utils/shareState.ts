import { DEFAULT_SELECTION } from "../config/app";
import { roles } from "../data";
import type { Role } from "../domain/types";

export interface PickSelection {
  allyChampionId: string;
  allyRole: Role;
  selfRole: Role;
}

/** URLクエリから受け取った文字列が、アプリで扱えるロールかどうかを判定する。 */
export function isRole(value: string | null): value is Role {
  return roles.some((role) => role.id === value);
}

/** 味方ロールと同じロールを選べない制約に合わせ、代替の自分ロールを返す。 */
export function getFallbackSelfRole(allyRole: Role): Role {
  return roles.find((role) => role.id !== allyRole)?.id ?? DEFAULT_SELECTION.selfRole;
}

/**
 * URLクエリから初期選択を復元する。
 *
 * 不正な値や、味方ロールと自分ロールが同じURLは安全なデフォルトに寄せる。
 */
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

/**
 * 現在の選択状態をURLへ反映する。
 *
 * ページ遷移ではなく `replaceState` を使い、選択変更だけでブラウザ履歴を増やさない。
 */
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

/** 友人に送るための、現在の選択条件を再現できる共有URLを作る。 */
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
