import { useEffect, useState } from "react";
import { DDRAGON_VERSIONS_URL, DEFAULT_DDRAGON_VERSION } from "../constants";
import { champions } from "../data";
import type { Champion } from "../types";

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

const localChampionByImageId = new Map(champions.map((champion) => [champion.imageId, champion]));

export function useDataDragonChampions() {
  const [dragonVersion, setDragonVersion] = useState(DEFAULT_DDRAGON_VERSION);
  const [allChampions, setAllChampions] = useState<Champion[]>(champions);

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

        setAllChampions(loadedChampions);
      } catch {
        setAllChampions(champions);
      }
    };

    void loadChampions();
  }, [dragonVersion]);

  return {
    allChampions,
    dragonVersion,
  };
}
