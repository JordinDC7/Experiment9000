import {
  loadLearningStore,
  saveLearningStore,
  getKey,
} from "./learning-store.mjs";

export function recordGameResult({
  champion,
  role,
  enemyChampion,

  win,
  goldDiff15,
  damageShare,
  deaths,

  items = [],
  runes = [],
  skillOrder,
}) {
  const store = loadLearningStore();
  const key = getKey({ champion, role, enemy: enemyChampion });

  if (!store.stats[key]) {
    store.stats[key] = {
      games: 0,
      wins: 0,
      avgGoldDiff15: 0,
      avgDamageShare: 0,
      avgDeaths: 0,
      itemStats: {},
      runeStats: {},
      skillOrderStats: {},
    };
  }

  const s = store.stats[key];
  s.games += 1;
  if (win) s.wins += 1;

  s.avgGoldDiff15 += (goldDiff15 - s.avgGoldDiff15) / s.games;
  s.avgDamageShare += (damageShare - s.avgDamageShare) / s.games;
  s.avgDeaths += (deaths - s.avgDeaths) / s.games;

  for (const itemId of items) {
    if (!s.itemStats[itemId]) {
      s.itemStats[itemId] = { games: 0, wins: 0 };
    }
    s.itemStats[itemId].games += 1;
    if (win) s.itemStats[itemId].wins += 1;
  }

  for (const runeId of runes) {
    if (!s.runeStats[runeId]) {
      s.runeStats[runeId] = { games: 0, wins: 0 };
    }
    s.runeStats[runeId].games += 1;
    if (win) s.runeStats[runeId].wins += 1;
  }

  if (skillOrder) {
    if (!s.skillOrderStats[skillOrder]) {
      s.skillOrderStats[skillOrder] = { games: 0, wins: 0 };
    }
    s.skillOrderStats[skillOrder].games += 1;
    if (win) s.skillOrderStats[skillOrder].wins += 1;
  }

  saveLearningStore(store);
}
