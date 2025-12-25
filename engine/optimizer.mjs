import fs from "fs";
import path from "path";

/* -----------------------------
   PATHS
-------------------------------- */
const DATA_DIR = path.resolve("data");
const OUT_DIR = path.resolve("league");
const CHAMP_FILE = path.join(DATA_DIR, "champions.json");
const ITEM_FILE = path.join(DATA_DIR, "items.json");
const OUT_FILE = path.join(OUT_DIR, "ItemSets.json");

/* -----------------------------
   HELPERS
-------------------------------- */
function loadJSON(p) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing required file: ${p}`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function uid() {
  return crypto.randomUUID();
}

/* -----------------------------
   ITEM SET BUILDER
-------------------------------- */
function makeItemSet(championId, role, items, rank) {
  return {
    uid: uid(),
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
        items: items.slice(0, 6).map((i) => ({
          id: i.id,
          count: 1,
        })),
      },
      {
        type: "Situational",
        items: items.slice(6, 12).map((i) => ({
          id: i.id,
          count: 1,
        })),
      },
    ],
  };
}

/* -----------------------------
   MAIN
-------------------------------- */
async function main() {
  console.log("=== OPTIMIZER START ===");

  ensureDir(OUT_DIR);

  // ---- LOAD DATA (FIXED) ----
  const champData = loadJSON(CHAMP_FILE);
  const itemData = loadJSON(ITEM_FILE);

  const champions = champData.champions;
  const items = itemData.items;

  console.log(`✔ Loaded ${champions.length} champions`);
  console.log(`✔ Loaded ${items.length} items`);

  const roles = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  let rank = 1000000;
  const itemSets = [];

  for (const champ of champions) {
    for (const role of roles) {
      const shuffled = [...items].sort(() => 0.5 - Math.random());
      itemSets.push(makeItemSet(champ.id, role, shuffled, rank--));
    }
  }

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        accountId: 0,
        timestamp: Date.now(),
        itemSets,
      },
      null,
      2
    )
  );

  console.log(`✔ Wrote ${itemSets.length} item sets`);
  console.log("=== OPTIMIZER END ===");
}

await main();
