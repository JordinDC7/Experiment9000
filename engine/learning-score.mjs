import { loadLearningStore, getKey } from "./learning-store.mjs";

/**
 * Returns a score multiplier for an item based on your personal results.
 * >1.0 = boosted
 * <1.0 = penalized
 */
export function scoreItemWithLearning({
  champion,
  role,
  enemyChampion,
  itemId,
}) {
  const store = loadLearningStore();
  const key = getKey({ champion, role, enemy: enemyChampion });
  const stats = store.stats[key];

  if (!stats) return 1.0;

  const item = stats.itemStats?.[itemId];
  if (!item || item.games < 3) return 1.0;

  const winrate = item.wins / item.games;

  // Clamp influence to avoid overfitting too fast
  if (winrate >= 0.65) return 1.15;
  if (winrate >= 0.55) return 1.08;
  if (winrate <= 0.35) return 0.85;
  if (winrate <= 0.45) return 0.92;

  return 1.0;
}
