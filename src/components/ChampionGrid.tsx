import type { Champion } from "../types";

interface ChampionGridProps {
  championIds: string[];
  championMap: Map<string, Champion>;
  iconUrl: (imageId: string) => string;
  onSelect: (championId: string) => void;
  selectedChampionId: string;
  title: string;
}

export function ChampionGrid({
  championIds,
  championMap,
  iconUrl,
  onSelect,
  selectedChampionId,
  title,
}: ChampionGridProps) {
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
                title={`${champion.nameJa} / ${champion.nameEn}`}
                type="button"
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
