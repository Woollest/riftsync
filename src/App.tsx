import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Database,
  Search,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { ChampionGrid } from "./components/ChampionGrid";
import { DataFact } from "./components/DataFact";
import { AvoidCard, RecommendationCard } from "./components/RecommendationCard";
import { RoleSelector } from "./components/RoleSelector";
import { type CopyState, ShareActions } from "./components/ShareActions";
import { dataMeta, pairSynergies, roleStats, roles } from "./data";
import { useDataDragonChampions } from "./hooks/useDataDragonChampions";
import { roleChampionImageIds } from "./roleCatalog";
import {
  getAvailableAllyChampionIds,
  getAvoidRecommendations,
  getTopRecommendations,
} from "./scoring";
import type { Role } from "./types";
import { copyTextToClipboard } from "./utils/clipboard";
import { buildShareUrl, getFallbackSelfRole, getInitialSelection, syncSelectionToUrl } from "./utils/shareState";

function App() {
  const [initialSelection] = useState(getInitialSelection);
  const [selfRole, setSelfRole] = useState<Role>(initialSelection.selfRole);
  const [allyRole, setAllyRole] = useState<Role>(initialSelection.allyRole);
  const [allyChampionId, setAllyChampionId] = useState(initialSelection.allyChampionId);
  const [query, setQuery] = useState("");
  const [showAvoids, setShowAvoids] = useState(false);
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [linkCopyState, setLinkCopyState] = useState<CopyState>("idle");
  const { allChampions, dragonVersion } = useDataDragonChampions();

  useEffect(() => {
    if (selfRole === allyRole) {
      setSelfRole(getFallbackSelfRole(allyRole));
    }
  }, [selfRole, allyRole]);

  useEffect(() => {
    syncSelectionToUrl({ allyChampionId, allyRole, selfRole });
  }, [allyChampionId, allyRole, selfRole]);

  const allyChampionById = useMemo(
    () => new Map(allChampions.map((champion) => [champion.id, champion])),
    [allChampions],
  );
  const roleMatchedAllyChampionIds = useMemo(() => {
    const matchedImageIds = roleChampionImageIds[allyRole];
    const statsChampionIds = getAvailableAllyChampionIds(allyRole).filter((championId) =>
      allyChampionById.has(championId),
    );
    const catalogChampionIds = allChampions
      .filter((champion) => matchedImageIds.has(champion.imageId))
      .map((champion) => champion.id)
      .sort((a, b) => {
        const championA = allyChampionById.get(a);
        const championB = allyChampionById.get(b);

        return (championA?.nameJa ?? a).localeCompare(championB?.nameJa ?? b, "ja");
      });

    return Array.from(new Set([...statsChampionIds, ...catalogChampionIds]));
  }, [allChampions, allyRole, allyChampionById]);
  const roleMatchedAllyChampionSet = useMemo(
    () => new Set(roleMatchedAllyChampionIds),
    [roleMatchedAllyChampionIds],
  );
  const otherAllyChampionIds = useMemo(
    () =>
      allChampions
        .map((champion) => champion.id)
        .filter((championId) => !roleMatchedAllyChampionSet.has(championId))
        .sort((a, b) => {
          const championA = allyChampionById.get(a);
          const championB = allyChampionById.get(b);

          return (championA?.nameJa ?? a).localeCompare(championB?.nameJa ?? b, "ja");
        }),
    [allChampions, allyChampionById, roleMatchedAllyChampionSet],
  );
  const allAllyChampionIds = useMemo(
    () => [...roleMatchedAllyChampionIds, ...otherAllyChampionIds],
    [roleMatchedAllyChampionIds, otherAllyChampionIds],
  );

  useEffect(() => {
    if (!allAllyChampionIds.includes(allyChampionId)) {
      setAllyChampionId(allAllyChampionIds[0] ?? "");
    }
  }, [allyChampionId, allAllyChampionIds]);

  const selectedAllyChampion = allyChampionId ? allyChampionById.get(allyChampionId) : undefined;
  const normalizedQuery = query.trim().toLowerCase();
  const filterChampionIds = (championIds: string[]) =>
    championIds.filter((championId) => {
      const champion = allyChampionById.get(championId);

      if (!champion) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (
        champion.nameJa.toLowerCase().includes(normalizedQuery) ||
        champion.nameEn.toLowerCase().includes(normalizedQuery)
      );
    });

  const filteredRoleMatchedAllyChampionIds = useMemo(
    () => filterChampionIds(roleMatchedAllyChampionIds),
    [allyChampionById, roleMatchedAllyChampionIds, normalizedQuery],
  );
  const filteredOtherAllyChampionIds = useMemo(
    () => filterChampionIds(otherAllyChampionIds),
    [allyChampionById, otherAllyChampionIds, normalizedQuery],
  );

  const recommendations = useMemo(
    () => (allyChampionId ? getTopRecommendations(selfRole, allyRole, allyChampionId, allyChampionById) : []),
    [selfRole, allyRole, allyChampionId, allyChampionById],
  );
  const avoidRecommendations = useMemo(
    () => (allyChampionId ? getAvoidRecommendations(selfRole, allyRole, allyChampionId, allyChampionById) : []),
    [selfRole, allyRole, allyChampionId, allyChampionById],
  );
  const selfRoleOption = roles.find((role) => role.id === selfRole);
  const candidateCount = useMemo(
    () => roleStats.filter((stat) => stat.role === selfRole && stat.championId !== allyChampionId).length,
    [allyChampionId, selfRole],
  );
  const selectedPairCount = useMemo(
    () =>
      pairSynergies.filter(
        (synergy) =>
          synergy.allyChampionId === allyChampionId &&
          synergy.allyRole === allyRole &&
          synergy.recommendedRole === selfRole,
      ).length,
    [allyChampionId, allyRole, selfRole],
  );
  const lowDataCount = useMemo(
    () =>
      roleStats.filter(
        (stat) => stat.role === selfRole && stat.championId !== allyChampionId && stat.sampleSize < 500,
      ).length,
    [allyChampionId, selfRole],
  );

  const iconUrl = (imageId: string) =>
    `https://ddragon.leagueoflegends.com/cdn/${dragonVersion}/img/champion/${imageId}.png`;

  const buildPickSummary = () => {
    const allyRoleLabel = roles.find((role) => role.id === allyRole)?.shortLabel ?? allyRole;
    const selfRoleLabel = roles.find((role) => role.id === selfRole)?.shortLabel ?? selfRole;
    const allyName = selectedAllyChampion
      ? `${selectedAllyChampion.nameJa} / ${selectedAllyChampion.nameEn}`
      : "未選択";
    const recommendationLines = recommendations.map((recommendation, index) => {
      const labels = [
        recommendation.difficulty,
        recommendation.isBeginnerFriendly ? "初心者おすすめ" : "",
        recommendation.synergySource === "profile" ? "推定相性" : "",
        recommendation.isOffMeta ? "オフメタ" : "",
        recommendation.isLowData ? "データ少" : "",
      ].filter(Boolean);

      return `${index + 1}. ${recommendation.champion.nameJa} / ${recommendation.champion.nameEn} - コンボ${Math.round(
        recommendation.comboScore,
      )}% / 勝率${recommendation.displayWinRate.toFixed(1)}% / ${labels.join(", ")}`;
    });

    return [
      "RiftSync pick memo",
      `味方: ${allyRoleLabel} ${allyName}`,
      `自分: ${selfRoleLabel}`,
      `データ: Patch ${dataMeta.patch} ${dataMeta.rankRange} ${dataMeta.region}`,
      "",
      ...recommendationLines,
    ].join("\n");
  };

  const handleCopySummary = async () => {
    if (await copyTextToClipboard(buildPickSummary())) {
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
      return;
    }

    setCopyState("failed");
    window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const handleCopyLink = async () => {
    const url = buildShareUrl({ allyChampionId, allyRole, selfRole });

    if (url && (await copyTextToClipboard(url))) {
      setLinkCopyState("copied");
      window.setTimeout(() => setLinkCopyState("idle"), 1600);
      return;
    }

    setLinkCopyState("failed");
    window.setTimeout(() => setLinkCopyState("idle"), 1600);
  };

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div className="brand-mark">
          <Swords aria-hidden="true" size={22} />
        </div>
        <div>
          <p className="eyebrow">Gold+ Solo Queue</p>
          <h1>RiftSync</h1>
        </div>
      </section>

      <section className="data-status" aria-label="データ状態">
        <Database aria-hidden="true" size={15} />
        <span>Patch {dataMeta.patch}</span>
        <span>{dataMeta.rankRange}</span>
        <span>{dataMeta.region}</span>
        {dataMeta.isSample ? <strong>仮データ</strong> : null}
      </section>

      <section className="data-panel" aria-label="データ詳細">
        <div className="data-panel-heading">
          <BarChart3 aria-hidden="true" size={17} />
          <span>データ情報</span>
        </div>
        <div className="data-facts">
          <DataFact icon={<CalendarDays aria-hidden="true" size={15} />} label="更新" value={dataMeta.updatedAt} />
          <DataFact label="出典" value={dataMeta.source} wide />
          <DataFact label="候補" value={`${selfRoleOption?.shortLabel ?? selfRole} ${candidateCount}体`} />
          <DataFact label="直接相性" tone={selectedPairCount >= 3 ? "good" : "warn"} value={`${selectedPairCount}件`} />
          <DataFact label="データ少" tone={lowDataCount > 0 ? "warn" : "good"} value={`${lowDataCount}件`} />
        </div>
        {selectedPairCount < 3 || candidateCount < 10 ? (
          <div className="data-note">
            {selectedPairCount < 3 ? (
              <span>直接相性データが少ないため、チャンピオン性質からの推定相性を含めて表示します。</span>
            ) : null}
            {candidateCount < 10 ? (
              <span>候補データが10体未満のため、実運用前にCSVの拡充を推奨します。</span>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="control-stack" aria-label="ピック条件">
        <RoleSelector title="味方のロール" value={allyRole} onChange={setAllyRole} />

        <div className="field-block">
          <div className="section-title">
            <Users aria-hidden="true" size={17} />
            <span>味方チャンピオン</span>
          </div>

          <label className="search-box">
            <Search aria-hidden="true" size={17} />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="日本語 / English"
              type="search"
              value={query}
            />
          </label>

          <div className="champion-groups">
            <ChampionGrid
              championIds={filteredRoleMatchedAllyChampionIds}
              championMap={allyChampionById}
              iconUrl={iconUrl}
              onSelect={setAllyChampionId}
              selectedChampionId={allyChampionId}
              title="ロールにマッチ"
            />
            <ChampionGrid
              championIds={filteredOtherAllyChampionIds}
              championMap={allyChampionById}
              iconUrl={iconUrl}
              onSelect={setAllyChampionId}
              selectedChampionId={allyChampionId}
              title="その他"
            />
          </div>
        </div>

        <RoleSelector title="自分のロール" value={selfRole} onChange={setSelfRole} disabledRole={allyRole} />
      </section>

      {selectedAllyChampion ? (
        <section className="sync-summary" aria-label="選択中の味方">
          <img src={iconUrl(selectedAllyChampion.imageId)} alt="" />
          <div>
            <span>選択中</span>
            <strong>
              {selectedAllyChampion.nameJa} / {selectedAllyChampion.nameEn}
            </strong>
          </div>
        </section>
      ) : null}

      <section className="results-stack" aria-label="おすすめチャンピオン">
        <div className="results-heading">
          <div className="section-title section-title-strong">
            <Sparkles aria-hidden="true" size={18} />
            <span>おすすめ3体</span>
          </div>
          <ShareActions
            copyState={copyState}
            linkCopyState={linkCopyState}
            onCopyLink={handleCopyLink}
            onCopySummary={handleCopySummary}
          />
        </div>
        {recommendations.map((recommendation, index) => (
          <RecommendationCard
            iconUrl={iconUrl(recommendation.champion.imageId)}
            index={index + 1}
            key={`${recommendation.champion.id}-${recommendation.roleStat.role}`}
            recommendation={recommendation}
          />
        ))}
      </section>

      <section className="avoid-stack" aria-label="非推奨チャンピオン">
        <button className="avoid-toggle" onClick={() => setShowAvoids((current) => !current)} type="button">
          <AlertTriangle aria-hidden="true" size={18} />
          <span>非推奨候補を見る</span>
          <ChevronDown aria-hidden="true" className={showAvoids ? "rotate" : ""} size={18} />
        </button>

        {showAvoids ? (
          <div className="avoid-list">
            {avoidRecommendations.map((recommendation) => (
              <AvoidCard
                iconUrl={iconUrl(recommendation.champion.imageId)}
                key={`${recommendation.champion.id}-${recommendation.roleStat.role}-avoid`}
                recommendation={recommendation}
              />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default App;
