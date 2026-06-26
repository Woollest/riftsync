const versionsUrl = "https://ddragon.leagueoflegends.com/api/versions.json";

const requestHeaders = {
  "user-agent": "Mozilla/5.0",
};

export const dataRegion = "global";
export const dataTier = "emerald_plus";
export const dataRankRange = "Emerald+";
export const dataMode = "ranked";
export const opggSourceLabel = "OP.GG Champion Tier List and Champion Synergy Pages Global Emerald+ Ranked Solo/Duo";
export const secondarySourceLabel = "LoLalytics Emerald+ Patch Tier List cross-check";

const localChampionIdByImageId = new Map([
  ["Ahri", "ahri"],
  ["Amumu", "amumu"],
  ["Annie", "annie"],
  ["Ashe", "ashe"],
  ["Brand", "brand"],
  ["Caitlyn", "caitlyn"],
  ["Darius", "darius"],
  ["Ezreal", "ezreal"],
  ["JarvanIV", "jarvanIV"],
  ["Jinx", "jinx"],
  ["Kaisa", "kaisa"],
  ["LeeSin", "leeSin"],
  ["Leona", "leona"],
  ["Lulu", "lulu"],
  ["Lux", "lux"],
  ["Malphite", "malphite"],
  ["MissFortune", "missFortune"],
  ["Nami", "nami"],
  ["Nautilus", "nautilus"],
  ["Orianna", "orianna"],
  ["Ornn", "ornn"],
  ["Seraphine", "seraphine"],
  ["Shen", "shen"],
  ["Thresh", "thresh"],
  ["Vi", "vi"],
  ["Viktor", "viktor"],
  ["Yasuo", "yasuo"],
]);

export const validRoles = ["top", "jungle", "mid", "adc", "support"];

export const opggRoleMap = {
  ADC: "adc",
  JUNGLE: "jungle",
  MID: "mid",
  SUPPORT: "support",
  TOP: "top",
};

export async function fetchOpggText(url) {
  const response = await fetch(url, { headers: requestHeaders });

  if (!response.ok) {
    throw new Error(`OP.GG request failed: ${response.status} ${response.statusText} (${url})`);
  }

  return response.text();
}

export async function fetchLolalyticsText(url) {
  const response = await fetch(url, { headers: requestHeaders });

  if (!response.ok) {
    throw new Error(`LoLalytics request failed: ${response.status} ${response.statusText} (${url})`);
  }

  return response.text();
}

export function findMatchingBracket(text, startIndex) {
  let depth = 0;
  let escape = false;
  let inString = false;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "[") {
      depth += 1;
    }

    if (char === "]") {
      depth -= 1;

      if (depth === 0) {
        return index + 1;
      }
    }
  }

  throw new Error("Could not find the end of the OP.GG data array");
}

export function extractNextFlightText(html) {
  const scriptMatches = html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g);
  const chunks = [];

  for (const match of scriptMatches) {
    try {
      const payload = JSON.parse(match[1]);

      if (typeof payload[1] === "string") {
        chunks.push(payload[1]);
      }
    } catch {
      // Ignore non-JSON script payloads.
    }
  }

  return chunks.join("");
}

export function toCsvValue(value) {
  const text = String(value);

  if (!/[",\n\r]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

export function toPercent(value) {
  return Math.round(value * 10) / 10;
}

export function toVisibleText(html) {
  return html
    .replaceAll(/<!--[\s\S]*?-->/g, "")
    .replaceAll(/<[^>]+>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export async function getLolalyticsMeta() {
  const html = await fetchLolalyticsText("https://lolalytics.com/lol/tierlist/?tier=emerald_plus");
  const text = toVisibleText(html);
  const analyzedMatch = text.match(/Emerald\+ Champions Analysed:\s*([0-9,]+)/);
  const patchMatch = text.match(/LEAGUE OF LEGENDS PATCH\s+([0-9.]+)/) ?? text.match(/Patch\s+([0-9.]+)/);

  return {
    analyzedChampions: analyzedMatch ? Number(analyzedMatch[1].replaceAll(",", "")) : null,
    hasLocke: /\bLocke\b/.test(text),
    patch: patchMatch?.[1] ?? null,
  };
}

export async function getChampionMaps() {
  const versions = await fetch(versionsUrl).then((response) => response.json());
  const version = versions[0];
  const championData = await fetch(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
  ).then((response) => response.json());
  const championIdByOpggKey = new Map();
  const opggKeyByChampionId = new Map();
  const tagsByChampionId = new Map();

  for (const champion of Object.values(championData.data)) {
    const championId = localChampionIdByImageId.get(champion.id) ?? champion.id;
    const opggKey = champion.id.toLowerCase();

    championIdByOpggKey.set(opggKey, championId);
    opggKeyByChampionId.set(championId, opggKey);
    tagsByChampionId.set(championId, champion.tags ?? []);
  }

  return {
    championIdByOpggKey,
    opggKeyByChampionId,
    tagsByChampionId,
    version,
  };
}
