import type { Champion, Role } from "./types";

type SynergyTrait =
  | "aoe"
  | "burst"
  | "catch"
  | "dive"
  | "dps"
  | "engage"
  | "enchanter"
  | "frontline"
  | "hypercarry"
  | "lanePressure"
  | "magic"
  | "peel"
  | "physical"
  | "poke"
  | "roam"
  | "safe"
  | "scaling"
  | "utility";

const championTraits: Record<string, SynergyTrait[]> = {
  ahri: ["catch", "burst", "roam", "magic"],
  amumu: ["engage", "frontline", "aoe", "magic"],
  annie: ["burst", "catch", "aoe", "magic"],
  ashe: ["catch", "utility", "dps", "physical"],
  brand: ["aoe", "burst", "poke", "magic"],
  caitlyn: ["lanePressure", "poke", "safe", "physical"],
  darius: ["frontline", "dps", "physical"],
  ezreal: ["poke", "safe", "physical"],
  jarvanIV: ["engage", "catch", "frontline", "physical"],
  jinx: ["dps", "hypercarry", "scaling", "physical"],
  kaisa: ["dive", "burst", "dps", "hypercarry", "scaling", "physical"],
  leeSin: ["dive", "catch", "roam", "physical"],
  leona: ["engage", "catch", "frontline"],
  lulu: ["enchanter", "peel", "utility"],
  lux: ["catch", "poke", "burst", "magic"],
  malphite: ["engage", "frontline", "aoe", "magic"],
  missFortune: ["aoe", "lanePressure", "physical"],
  nami: ["enchanter", "peel", "utility", "lanePressure"],
  nautilus: ["engage", "catch", "frontline"],
  orianna: ["aoe", "peel", "scaling", "magic"],
  ornn: ["frontline", "engage", "utility"],
  seraphine: ["aoe", "utility", "scaling", "magic"],
  shen: ["frontline", "peel", "utility"],
  thresh: ["catch", "peel", "utility"],
  vi: ["dive", "catch", "engage", "physical"],
  viktor: ["poke", "scaling", "aoe", "magic"],
  yasuo: ["dive", "dps", "aoe", "physical"],
};

const roleTraits: Record<Role, SynergyTrait[]> = {
  top: ["frontline", "engage"],
  jungle: ["engage", "catch", "roam"],
  mid: ["burst", "poke", "magic"],
  adc: ["dps", "scaling", "physical"],
  support: ["peel", "utility"],
};

const tagTraits: Record<string, SynergyTrait[]> = {
  Assassin: ["burst", "dive"],
  Fighter: ["dive"],
  Mage: ["magic"],
  Marksman: ["physical"],
  Support: ["utility"],
  Tank: ["frontline"],
};

const synergyPairs: Array<[SynergyTrait, SynergyTrait, number]> = [
  ["engage", "aoe", 22],
  ["engage", "burst", 14],
  ["engage", "lanePressure", 14],
  ["engage", "dps", 11],
  ["engage", "catch", 9],
  ["frontline", "dps", 14],
  ["frontline", "hypercarry", 16],
  ["frontline", "scaling", 12],
  ["frontline", "poke", 8],
  ["catch", "burst", 15],
  ["catch", "dive", 12],
  ["catch", "lanePressure", 12],
  ["dive", "dive", 14],
  ["dive", "burst", 13],
  ["dive", "roam", 9],
  ["peel", "dps", 14],
  ["peel", "hypercarry", 20],
  ["peel", "scaling", 13],
  ["peel", "safe", 8],
  ["enchanter", "dps", 16],
  ["enchanter", "hypercarry", 24],
  ["enchanter", "scaling", 14],
  ["utility", "dps", 10],
  ["utility", "hypercarry", 14],
  ["utility", "catch", 8],
  ["poke", "poke", 13],
  ["poke", "lanePressure", 11],
  ["lanePressure", "lanePressure", 12],
  ["lanePressure", "catch", 9],
  ["aoe", "aoe", 10],
  ["roam", "catch", 11],
  ["roam", "burst", 9],
];

export function getSynergyTraits(champion: Champion | undefined, role: Role): Set<SynergyTrait> {
  const traits = new Set<SynergyTrait>();

  if (!champion) {
    return new Set(roleTraits[role]);
  }

  for (const trait of championTraits[champion.id] ?? []) {
    traits.add(trait);
  }

  for (const tag of champion.tags ?? []) {
    for (const trait of tagTraits[tag] ?? []) {
      traits.add(trait);
    }
  }

  if (champion.combatProfile) {
    if (champion.combatProfile.attack >= champion.combatProfile.magic + 2) {
      traits.add("physical");
    }

    if (champion.combatProfile.magic >= champion.combatProfile.attack) {
      traits.add("magic");
    }

    if (champion.combatProfile.defense >= 6) {
      traits.add("frontline");
    }
  }

  if (traits.size === 0) {
    for (const trait of roleTraits[role]) {
      traits.add(trait);
    }
  }

  return traits;
}

export function getTraitCompatibilityScore(allyTraits: Set<SynergyTrait>, recommendedTraits: Set<SynergyTrait>) {
  let score = 0;

  for (const [allyTrait, recommendedTrait, bonus] of synergyPairs) {
    if (allyTraits.has(allyTrait) && recommendedTraits.has(recommendedTrait)) {
      score += bonus;
    }
  }

  if (allyTraits.has("magic") && recommendedTraits.has("physical")) {
    score += 6;
  }

  if (allyTraits.has("physical") && recommendedTraits.has("magic")) {
    score += 6;
  }

  return Math.min(score, 44);
}
