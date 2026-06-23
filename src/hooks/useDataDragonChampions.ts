import { useEffect, useState } from "react";
import { DDRAGON_VERSIONS_URL, DEFAULT_DDRAGON_VERSION } from "../config/app";
import { champions } from "../data";
import type { Champion } from "../domain/types";

interface DataDragonChampion {
  id: string;
  name: string;
  tags: string[];
  info: {
    attack: number;
    defense: number;
    difficulty: number;
    magic: number;
  };
}

interface DataDragonChampionResponse {
  data: Record<string, DataDragonChampion>;
}

const localChampionByImageId = new Map(champions.map((champion) => [champion.imageId, champion]));
let latestVersionRequest: Promise<string> | null = null;
const championDataRequests = new Map<string, Promise<Champion[]>>();

/**
 * Data Dragonの最新バージョンを取得する。
 *
 * 失敗時は同梱データのバージョンへフォールバックし、アプリの初期表示を止めない。
 */
function getLatestDragonVersion(): Promise<string> {
  latestVersionRequest ??= fetch(DDRAGON_VERSIONS_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load Data Dragon versions: ${response.status}`);
      }

      return response.json() as Promise<string[]>;
    })
    .then((versions) => versions[0] ?? DEFAULT_DDRAGON_VERSION)
    .catch(() => DEFAULT_DDRAGON_VERSION);

  return latestVersionRequest;
}

/**
 * 日本語名、英語名、公式難易度、タグ、戦闘プロフィールをData Dragonから読み込む。
 *
 * 同じバージョンへのリクエストは共有し、検索や再レンダーで重複取得しないようにする。
 */
function getChampionData(dragonVersion: string): Promise<Champion[]> {
  const cachedRequest = championDataRequests.get(dragonVersion);

  if (cachedRequest) {
    return cachedRequest;
  }

  const request = Promise.all([
    fetch(`https://ddragon.leagueoflegends.com/cdn/${dragonVersion}/data/ja_JP/champion.json`),
    fetch(`https://ddragon.leagueoflegends.com/cdn/${dragonVersion}/data/en_US/champion.json`),
  ])
    .then(async ([jaResponse, enResponse]) => {
      if (!jaResponse.ok || !enResponse.ok) {
        throw new Error("Failed to load Data Dragon champion data");
      }

      const jaData = (await jaResponse.json()) as DataDragonChampionResponse;
      const enData = (await enResponse.json()) as DataDragonChampionResponse;

      return Object.values(jaData.data)
        .map((jaChampion) => {
          const localChampion = localChampionByImageId.get(jaChampion.id);
          const enChampion = enData.data[jaChampion.id];

          return {
            id: localChampion?.id ?? jaChampion.id,
            nameJa: jaChampion.name,
            nameEn: localChampion?.nameEn ?? enChampion?.name ?? jaChampion.id,
            imageId: jaChampion.id,
            tags: jaChampion.tags,
            combatProfile: {
              attack: jaChampion.info.attack,
              defense: jaChampion.info.defense,
              magic: jaChampion.info.magic,
            },
            riotDifficulty: jaChampion.info.difficulty,
          };
        })
        .sort((a, b) => a.nameJa.localeCompare(b.nameJa, "ja"));
    })
    .catch((error) => {
      championDataRequests.delete(dragonVersion);
      throw error;
    });

  championDataRequests.set(dragonVersion, request);
  return request;
}

/**
 * 画面全体で使うチャンピオン基本情報を提供するhook。
 *
 * 読み込みに失敗しても同梱の最小データへ戻し、推薦UIを継続表示できるようにする。
 */
export function useDataDragonChampions() {
  const [dragonVersion, setDragonVersion] = useState(DEFAULT_DDRAGON_VERSION);
  const [allChampions, setAllChampions] = useState<Champion[]>(champions);
  const [isLoadingChampions, setIsLoadingChampions] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadChampions = async () => {
      setIsLoadingChampions(true);

      try {
        const loadedDragonVersion = await getLatestDragonVersion();
        const loadedChampions = await getChampionData(loadedDragonVersion);

        if (isMounted) {
          setDragonVersion(loadedDragonVersion);
          setAllChampions(loadedChampions);
        }
      } catch {
        if (isMounted) {
          setDragonVersion(DEFAULT_DDRAGON_VERSION);
          setAllChampions(champions);
        }
      } finally {
        if (isMounted) {
          setIsLoadingChampions(false);
        }
      }
    };

    void loadChampions();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    allChampions,
    dragonVersion,
    isLoadingChampions,
  };
}
