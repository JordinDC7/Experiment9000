import fs from "node:fs";
import path from "node:path";

const LIVE_PATH = path.resolve("data/live.json");

export function initLiveState() {
  if (!fs.existsSync("data")) fs.mkdirSync("data");
  if (!fs.existsSync(LIVE_PATH)) {
    fs.writeFileSync(
      LIVE_PATH,
      JSON.stringify(
        {
          status: "waiting-for-lock-in",
          champion: null,
          role: null,
          matchup: null,
          targetItem: null,
          buyNow: [],
          goldRemaining: 0,
          goldToFinish: null,
          updatedAt: Date.now(),
        },
        null,
        2
      )
    );
  }
}

export function updateLiveState(patch) {
  const base = JSON.parse(fs.readFileSync(LIVE_PATH, "utf8"));
  fs.writeFileSync(
    LIVE_PATH,
    JSON.stringify({ ...base, ...patch, updatedAt: Date.now() }, null, 2)
  );
}
