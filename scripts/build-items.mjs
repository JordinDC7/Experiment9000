import fs from "node:fs";
import crypto from "node:crypto";

const PATCH = "14.2.1";
const ITEM_URL = `https://ddragon.leagueoflegends.com/cdn/${PATCH}/data/en_US/item.json`;

async function fetchItems() {
  const res = await fetch(ITEM_URL);
  const json = await res.json();
  return Object.entries(json.data).map(([id, item]) => ({
    id,
    name: item.name,
    gold: item.gold?.total ?? 0,
    tags: item.tags ?? [],
  }));
}

function makeItemSet(championId, role, items, rank) {
  return {
    uid: crypto.randomUUID(),
    title: `Optimal ${role}`,
    type: "custom",
    map: "any",
    mode: "any",
    sortrank: rank,
    associatedChampions: [championId],
    associatedMaps: [11],
    blocks: [
      {
        type: "Core Build",
        items: items.slice(0, 6).map((id) => ({ id, count: 1 })),
      },
      {
        type: "Situational",
        items: items.slice(6, 12).map((id) => ({ id, count: 1 })),
      },
    ],
  };
}

async function main() {
  const champions = JSON.parse(
    fs.readFileSync("league/champions.json", "utf8")
  );

  const items = await fetchItems();
  const itemIds = items.map((i) => i.id);

  const roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  let rank = 999999;
  const itemSets = [];

  for (const champ of champions) {
    for (const role of roles) {
      itemSets.push(
        makeItemSet(
          champ.id,
          role,
          [...itemIds].sort(() => 0.5 - Math.random()),
          rank--
        )
      );
    }
  }

  fs.writeFileSync(
    "league/ItemSets.json",
    JSON.stringify({ accountId: 0, timestamp: Date.now(), itemSets }, null, 2)
  );

  console.log(`Generated ${itemSets.length} item sets`);
}

main();
