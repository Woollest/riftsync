import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Database,
  Flame,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from "lucide-react";
import { champions, dataMeta, pairSynergies, roleStats, roles } from "./data";
import { roleChampionImageIds } from "./roleCatalog";
import {
  getAvailableAllyChampionIds,
  getAvoidRecommendations,
  getTopRecommendations,
} from "./scoring";
import type { Champion, Recommendation, Role } from "./types";

const DEFAULT_DDRAGON_VERSION = "15.24.1";
const DDRAGON_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const localChampionByImageId = new Map(champions.map((champion) => [champion.imageId, champion]));

interface DataDragonChampion {
  id: string;
  name: string;
  info: {
    difficulty: number;
  };
}

interface DataDragonChampionResponse {
  data: Record<string, DataDragonChampion>;
}

function App() {
  const [selfRole, setSelfRole] = useState<Role>("mid");
  const [allyRole, setAllyRole] = useState<Role>("top");
  const [allyChampionId, setAllyChampionId] = useState("malphite");
  const [query, setQuery] = useState("");
  const [showAvoids, setShowAvoids] = useState(false);
  const [dragonVersion, setDragonVersion] = useState(DEFAULT_DDRAGON_VERSION);
  const [allAllyChampions, setAllAllyChampions] = useState<Champion[]>(champions);

  useEffect(() => {
    fetch(DDRAGON_VERSIONS_URL)
      .then((response) => response.json())
      .then((versions: string[]) => {
        if (versions[0]) {
          setDragonVersion(versions[0]);
        }
      })
      .catch(() => setDragonVersion(DEFAULT_DDRAGON_VERSION));
  }, []);

  useEffect(() => {
    const loadChampions = async () => {
      try {
        const [jaResponse, enResponse] = await Promise.all([
          fetch(`https://ddragon.leagueoflegends.com/cdn/${dragonVersion}/data/ja_JP/champion.json`),
          fetch(`https://ddragon.leagueoflegends.com/cdn/${dragonVersion}/data/en_US/champion.json`),
        ]);
        const jaData = (await jaResponse.json()) as DataDragonChampionResponse;
        const enData = (await enResponse.json()) as DataDragonChampionResponse;
        const loadedChampions = Object.values(jaData.data)
          .map((jaChampion) => {
            const localChampion = localChampionByImageId.get(jaChampion.id);
            const enChampion = enData.data[jaChampion.id];

            return {
              id: localChampion?.id ?? jaChampion.id,
              nameJa: jaChampion.name,
              nameEn: localChampion?.nameEn ?? enChampion?.name ?? jaChampion.id,
              imageId: jaChampion.id,
              riotDifficulty: jaChampion.info.difficulty,
            };
          })
          .sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"));

        setAllAllyChampions(loadedChampions);
      } catch {
        setAllAllyChampions(champions);
      }
    };

    void loadChampions();
  }, [dragonVersion]);

  useEffect(() => {
    if (selfRole === allyRole) {
      const fallbackRole = roles.find((role) => role.id !== allyRole)?.id ?? "top";
      setSelfRole(fallbackRole);
    }
  }, [selfRole, allyRole]);

  const allyChampionById = useMemo(
    () => new Map(allAllyChampions.map((champion) => [champion.id, champion])),
    [allAllyChampions],
  );
  const roleMatchedAllyChampionIds = useMemo(
    () => {
      const matchedImageIds = roleChampionImageIds[allyRole];
      const statsChampionIds = getAvailableAllyChampionIds(allyRole).filter((championId) =>
        allyChampionById.has(championId),
      );
      const catalogChampionIds = allAllyChampions
        .filter((champion) => matchedImageIds.has(champion.imageId))
        .map((champion) => champion.id)
        .sort((a, b) => {
          const championA = allyChampionById.get(a);
          const championB = allyChampionById.get(b);

          return (championA?.nameJa ?? a).localeCompare(championB?.nameJa ?? b, "ja");
        });

      return Array.from(new Set([...statsChampionIds, ...catalogChampionIds]));
    },
    [allAllyChampions, allyRole, allyChampionById],
  );
  const roleMatchedAllyChampionSet = useMemo(
    () => new Set(roleMatchedAllyChampionIds),
    [roleMatchedAllyChampionIds],
  );
  const otherAllyChampionIds = useMemo(
    () =>
      allAllyChampions
        .map((champion) => champion.id)
        .filter((championId) => !roleMatchedAllyChampionSet.has(championId))
        .sort((a, b) => {
          const championA = allyChampionById.get(a);
          const championB = allyChampionById.get(b);

          return (championA?.nameJa ?? a).localeCompare(championB?.nameJa ?? b, "ja");
        }),
    [allAllyChampions, allyChampionById, roleMatchedAllyChampionSet],
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

  const filterChampionIds = (championIds: string[]) => {
    const normalizedQuery = query.trim().toLowerCase();

    return championIds.filter((championId) => {
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
  };

  const filteredRoleMatchedAllyChampionIds = useMemo(
    () => filterChampionIds(roleMatchedAllyChampionIds),
    [allyChampionById, roleMatchedAllyChampionIds, query],
  );
  const filteredOtherAllyChampionIds = useMemo(
    () => filterChampionIds(otherAllyChampionIds),
    [allyChampionById, otherAllyChampionIds, query],
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
          <DataFact label="相性" tone={selectedPairCount > 0 ? "good" : "warn"} value={`${selectedPairCount}件`} />
          <DataFact label="データ少" tone={lowDataCount > 0 ? "warn" : "good"} value={`${lowDataCount}件`} />
        </div>
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
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="日本語 / English"
              type="search"
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
        <div className="section-title section-title-strong">
          <Sparkles aria-hidden="true" size={18} />
          <span>おすすめ3体</span>
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

interface ChampionGridProps {
  championIds: string[];
  championMap: Map<string, Champion>;
  iconUrl: (imageId: string) => string;
  onSelect: (championId: string) => void;
  selectedChampionId: string;
  title: string;
}

function ChampionGrid({ championIds, championMap, iconUrl, onSelect, selectedChampionId, title }: ChampionGridProps) {
  return (
    <div className="champion-group">
      <div className="champion-group-title">{title}</div>
      {championIds.length > 0 ? (
        <div className="champion-grid">
          {championIds.map((championId) => {
            const champion = championMap.get(championId);
            const selected = selectedChampionId === championId;

            if (!champion) {
              return null;
            }

            return (
              <button
                className={`champion-tile ${selected ? "is-selected" : ""}`}
                key={`${title}-${championId}`}
                onClick={() => onSelect(championId)}
                type="button"
                title={`${champion.nameJa} / ${champion.nameEn}`}
              >
                <img src={iconUrl(champion.imageId)} alt="" />
                <span>{champion.nameJa}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="empty-champion-group">該当チャンピオンなし</p>
      )}
    </div>
  );
}

interface RoleSelectorProps {
  title: string;
  value: Role;
  onChange: (role: Role) => void;
  disabledRole?: Role;
}

function RoleSelector({ title, value, onChange, disabledRole }: RoleSelectorProps) {
  return (
    <div className="field-block">
      <div className="section-title">
        <ShieldCheck aria-hidden="true" size={17} />
        <span>{title}</span>
      </div>
      <div className="role-segment">
        {roles.map((role) => {
          const disabled = disabledRole === role.id;

          return (
            <button
              className={value === role.id ? "active" : ""}
              disabled={disabled}
              key={role.id}
              onClick={() => onChange(role.id)}
              type="button"
            >
              <span>{role.shortLabel}</span>
              <small>{role.label}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RecommendationCardProps {
  iconUrl: string;
  index: number;
  recommendation: Recommendation;
}

function RecommendationCard({ iconUrl, index, recommendation }: RecommendationCardProps) {
  return (
    <article className="recommendation-card">
      <div className="rank-badge">{index}</div>
      <img className="champion-portrait" src={iconUrl} alt="" />
      <div className="card-main">
        <div className="card-heading">
          <div>
            <h2>{recommendation.champion.nameJa}</h2>
            <p>{recommendation.champion.nameEn}</p>
          </div>
          <StarRating score={recommendation.totalScore} />
        </div>
        <p className="reason">{recommendation.reason}</p>
        <div className="metric-grid">
          <Metric label="コンボ相性" value={`${Math.round(recommendation.comboScore)}%`} />
          <Metric label="勝率" value={`${recommendation.displayWinRate.toFixed(1)}%`} />
          <Metric label="メタ" value={<FlameRating count={recommendation.metaFlames} />} />
          <Metric label="難易度" value={recommendation.difficulty} />
        </div>
        <LabelRow recommendation={recommendation} />
      </div>
    </article>
  );
}

interface AvoidCardProps {
  iconUrl: string;
  recommendation: Recommendation;
}

function AvoidCard({ iconUrl, recommendation }: AvoidCardProps) {
  return (
    <article className="avoid-card">
      <img src={iconUrl} alt="" />
      <div>
        <strong>
          {recommendation.champion.nameJa} / {recommendation.champion.nameEn}
        </strong>
        <p>勝率が低く、味方との構成としてかみ合いにくい</p>
        <span>
          勝率 {recommendation.displayWinRate.toFixed(1)}% ・ コンボ相性 {Math.round(recommendation.comboScore)}%
        </span>
      </div>
    </article>
  );
}

function LabelRow({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="label-row">
      {recommendation.isBeginnerFriendly ? <span className="label good">初心者おすすめ</span> : null}
      {recommendation.isOffMeta ? <span className="label warn">オフメタ</span> : null}
      {recommendation.isLowData ? <span className="label caution">データ少</span> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DataFact({
  icon,
  label,
  tone,
  value,
  wide = false,
}: {
  icon?: React.ReactNode;
  label: string;
  tone?: "good" | "warn";
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`data-fact ${tone ? `is-${tone}` : ""} ${wide ? "is-wide" : ""}`}>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function StarRating({ score }: { score: number }) {
  const rating = Math.max(1, Math.min(5, Math.round((score / 20) * 2) / 2));

  return (
    <div className="star-rating" aria-label={`総合評価 ${rating} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const fill = Math.max(0, Math.min(1, rating - index));
        const className = fill >= 1 ? "full" : fill >= 0.5 ? "half" : "empty";

        return (
          <span className={className} key={index}>
            ★
          </span>
        );
      })}
    </div>
  );
}

function FlameRating({ count }: { count: number }) {
  return (
    <span className="flame-rating" aria-label={`メタ評価 ${count} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Flame className={index < count ? "lit" : ""} fill="currentColor" key={index} size={14} />
      ))}
    </span>
  );
}

export default App;
