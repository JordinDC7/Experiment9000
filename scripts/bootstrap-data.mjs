import fs from "fs";
import path from "path";
import process from "process";

const DATA_DIR = path.resolve("data");
const VERSION_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const CDN = "https://ddragon.leagueoflegends.com/cdn";

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${url}`);
  return res.json();
}

async function main() {
  console.log("=== DATA BOOTSTRAP START ===");
  ensureDir(DATA_DIR);

  // ---- PATCH VERSION ----
  const versions = await fetchJSON(VERSION_URL);
  const version = versions[0];
  console.log("✔ Patch:", version);

  // ---- CHAMPIONS ----
  const champsURL = `${CDN}/${version}/data/en_US/champion.json`;
  const champJSON = await fetchJSON(champsURL);

  const champions = Object.values(champJSON.data).map((c) => ({
    id: Number(c.key),
    key: c.id,
    name: c.name,
    tags: c.tags,
    stats: c.stats,
  }));

  fs.writeFileSync(
    path.join(DATA_DIR, "champions.json"),
    JSON.stringify({ version, champions }, null, 2)
  );
  console.log(`✔ Wrote ${champions.length} champions`);

  // ---- ITEMS ----
  const itemsURL = `${CDN}/${version}/data/en_US/item.json`;
  const itemJSON = await fetchJSON(itemsURL);

  const items = Object.entries(itemJSON.data)
    .filter(([, i]) => i.gold?.total > 0)
    .map(([id, i]) => ({
      id: Number(id),
      name: i.name,
      gold: i.gold.total,
      from: i.from || [],
      into: i.into || [],
      tags: i.tags || [],
      stats: i.stats || {},
      maps: i.maps,
    }));

  fs.writeFileSync(
    path.join(DATA_DIR, "items.json"),
    JSON.stringify({ version, items }, null, 2)
  );
  console.log(`✔ Wrote ${items.length} items`);

  console.log("=== DATA BOOTSTRAP END ===");
}

await main();
