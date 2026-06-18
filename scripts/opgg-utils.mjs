const versionsUrl = "https://ddragon.leagueoflegends.com/api/versions.json";

const requestHeaders = {
  "user-agent": "Mozilla/5.0",
};

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
