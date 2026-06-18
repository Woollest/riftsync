import { useEffect, useState } from "react";
import pairSynergyDataUrl from "../data/pairSynergies.json?url";
import type { PairSynergy } from "../domain/types";

let cachedPairSynergies: PairSynergy[] | null = null;
let pairSynergyRequest: Promise<PairSynergy[]> | null = null;

async function loadPairSynergyData(): Promise<PairSynergy[]> {
  if (cachedPairSynergies) {
    return cachedPairSynergies;
  }

  pairSynergyRequest ??= fetch(pairSynergyDataUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load pairSynergies.json: ${response.status}`);
      }

      return response.json() as Promise<unknown>;
    })
    .then((data) => {
      if (!Array.isArray(data)) {
        throw new Error("pairSynergies.json must contain an array");
      }

      cachedPairSynergies = data as PairSynergy[];
      return cachedPairSynergies;
    })
    .catch((error) => {
      pairSynergyRequest = null;
      throw error;
    });

  return pairSynergyRequest;
}

export function usePairSynergies() {
  const [pairSynergies, setPairSynergies] = useState<PairSynergy[]>(cachedPairSynergies ?? []);
  const [isLoadingPairSynergies, setIsLoadingPairSynergies] = useState(!cachedPairSynergies);
  const [pairSynergyError, setPairSynergyError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPairSynergies = async () => {
      if (cachedPairSynergies) {
        setPairSynergies(cachedPairSynergies);
        setIsLoadingPairSynergies(false);
        return;
      }

      setIsLoadingPairSynergies(true);
      setPairSynergyError(null);

      try {
        const data = await loadPairSynergyData();

        if (isMounted) {
          setPairSynergies(data);
        }
      } catch (error) {
        if (isMounted) {
          setPairSynergyError(error instanceof Error ? error.message : "Failed to load pairSynergies.json");
          setPairSynergies([]);
        }
      } finally {
        if (isMounted) {
          setIsLoadingPairSynergies(false);
        }
      }
    };

    void loadPairSynergies();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    isLoadingPairSynergies,
    pairSynergies,
    pairSynergyError,
  };
}
