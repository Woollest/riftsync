import { useEffect, useState } from "react";
import pairSynergyDataUrl from "../data/pairSynergies.json?url";
import type { PairSynergy } from "../types";

export function usePairSynergies() {
  const [pairSynergies, setPairSynergies] = useState<PairSynergy[]>([]);
  const [isLoadingPairSynergies, setIsLoadingPairSynergies] = useState(true);
  const [pairSynergyError, setPairSynergyError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadPairSynergies = async () => {
      setIsLoadingPairSynergies(true);
      setPairSynergyError(null);

      try {
        const response = await fetch(pairSynergyDataUrl);

        if (!response.ok) {
          throw new Error(`Failed to load pairSynergies.json: ${response.status}`);
        }

        const data = (await response.json()) as unknown;

        if (!Array.isArray(data)) {
          throw new Error("pairSynergies.json must contain an array");
        }

        if (isMounted) {
          setPairSynergies(data as PairSynergy[]);
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
