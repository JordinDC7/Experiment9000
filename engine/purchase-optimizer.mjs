// engine/purchase-optimizer.mjs
// Determines EXACT items to buy right now based on gold, inventory, and target item

import fs from "fs";
import path from "path";

const ITEMS_PATH = path.resolve("data/items.json");

/**
 * Load normalized items (from DDragon)
 */
function loadItems() {
  return JSON.parse(fs.readFileSync(ITEMS_PATH, "utf-8"));
}

/**
 * Build component tree for an item
 */
function flattenComponents(itemId, items, acc = {}) {
  const item = items[itemId];
  if (!item) return acc;

  if (!item.from || item.from.length === 0) {
    acc[itemId] = (acc[itemId] || 0) + 1;
    return acc;
  }

  for (const sub of item.from) {
    flattenComponents(sub, items, acc);
  }

  return acc;
}

/**
 * Subtract owned inventory from required components
 */
function subtractInventory(required, inventory) {
  const remaining = { ...required };

  for (const owned of inventory) {
    if (remaining[owned]) {
      remaining[owned]--;
      if (remaining[owned] <= 0) delete remaining[owned];
    }
  }

  return remaining;
}

/**
 * Get optimal purchasable components with current gold
 * (bounded knapsack, greedy by cost descending)
 */
function pickBestComponents(remaining, items, gold) {
  const candidates = Object.entries(remaining)
    .map(([id, count]) => ({
      id,
      count,
      cost: items[id]?.gold?.total ?? Infinity,
    }))
    .filter((i) => i.cost <= gold)
    .sort((a, b) => b.cost - a.cost);

  const purchases = [];
  let spent = 0;

  for (const item of candidates) {
    let buyable = Math.min(item.count, Math.floor((gold - spent) / item.cost));

    while (buyable-- > 0) {
      purchases.push(item.id);
      spent += item.cost;
    }

    if (spent >= gold) break;
  }

  return {
    purchases,
    spent,
    remainingGold: gold - spent,
  };
}

/**
 * MAIN ENTRY POINT
 */
export function getPurchaseRecommendation({
  targetItemId,
  inventoryItemIds,
  currentGold,
}) {
  const items = loadItems();

  if (!items[targetItemId]) {
    throw new Error(`Unknown target item: ${targetItemId}`);
  }

  // Step 1: full component tree
  const required = flattenComponents(targetItemId, items);

  // Step 2: subtract owned inventory
  const remaining = subtractInventory(required, inventoryItemIds);

  // Step 3: compute best purchase now
  const result = pickBestComponents(remaining, items, currentGold);

  return {
    targetItemId,
    currentGold,
    buyNow: result.purchases,
    goldSpent: result.spent,
    goldRemaining: result.remainingGold,
    remainingComponents: remaining,
    completed: Object.keys(remaining).length === 0,
  };
}
