/**
 * Riot Live Client Data API wrapper
 *
 * Source:
 *   https://127.0.0.1:2999/liveclientdata/allgamedata
 *
 * What we read:
 * - current gold
 * - inventory item IDs
 * - champion name
 * - game phase
 */

import https from "https";

const LIVE_URL = "https://127.0.0.1:2999/liveclientdata/allgamedata";

/**
 * Riot client uses self-signed cert
 */
const agent = new https.Agent({
  rejectUnauthorized: false,
});

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { agent }, (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Extract YOUR player block
 */
function getActivePlayer(game) {
  const name = game.activePlayer?.summonerName;
  return game.allPlayers.find((p) => p.summonerName === name);
}

/**
 * Normalize inventory into item IDs
 */
function extractInventory(items) {
  if (!items) return [];
  return items.map((i) => String(i.itemID)).filter(Boolean);
}

/**
 * Public API
 */
export async function getLiveState() {
  const game = await fetchJSON(LIVE_URL);

  const player = getActivePlayer(game);

  if (!player) {
    throw new Error("Active player not found");
  }

  return {
    gameTime: game.gameData.gameTime,
    gamePhase: game.gameData.gamePhase,
    champion: player.championName,
    level: player.level,
    gold: Math.floor(player.currentGold),
    inventory: extractInventory(player.items),
  };
}

/**
 * === TEST MODE ===
 * Run: node league/live-client.mjs
 */
if (process.argv[1].includes("live-client.mjs")) {
  console.log("=== LIVE CLIENT TEST ===");
  getLiveState()
    .then((state) => console.dir(state, { depth: null }))
    .catch((err) => console.error("Not in game / client closed"));
}
