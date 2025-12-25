/**
 * PERSISTENT LEARNING STORE
 * Patch-safe local learning (JSON)
 */

import fs from "fs";
import path from "path";

const STORE_PATH = path.join(process.cwd(), "runtime", "learning.json");

function load() {
  if (!fs.existsSync(STORE_PATH)) {
    return { champions: {}, matchups: {} };
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

function save(data) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function recordMatch({ champ, enemy, win }) {
  const data = load();
  const key = `${champ}_vs_${enemy}`;

  if (!data.matchups[key]) {
    data.matchups[key] = { games: 0, wins: 0 };
  }

  data.matchups[key].games += 1;
  if (win) data.matchups[key].wins += 1;

  save(data);
}

export function getMatchupWinrate(champ, enemy) {
  const data = load();
  const key = `${champ}_vs_${enemy}`;
  const m = data.matchups[key];
  if (!m || m.games < 3) return null;
  return m.wins / m.games;
}
