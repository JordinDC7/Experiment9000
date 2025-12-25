import fs from "fs";
import path from "path";
import https from "https";

const DATA_DIR = path.resolve("data");
const OUT_FILE = path.join(DATA_DIR, "items.json");

// Latest patch (safe default, can be auto-detected later)
const PATCH = "14.1.1";
const URL = `https://ddragon.leagueoflegends.com/cdn/${PATCH}/data/en_US/item.json`;

function fetch(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => resolve(JSON.parse(data)));
      })
      .on("error", reject);
  });
}

async function main() {
  console.log("=== FETCH ITEMS START ===");

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  const raw = await fetch(URL);

  const items = {};
  for (const [id, item] of Object.entries(raw.data)) {
    items[id] = {
      id,
      name: item.name,
      gold: item.gold,
      from: item.from ?? [],
      into: item.into ?? [],
      stats: item.stats ?? {},
      tags: item.tags ?? [],
      maps: item.maps ?? {},
    };
  }

  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify(
      {
        version: raw.version,
        items,
      },
      null,
      2
    )
  );

  console.log(`✔ Wrote ${Object.keys(items).length} items`);
  console.log("=== FETCH ITEMS END ===");
}

main().catch((err) => {
  console.error("❌ ITEM FETCH FAILED", err);
  process.exit(1);
});
