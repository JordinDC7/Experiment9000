export default {
  ops: [
    {
      op: "edit",
      path: "engine/live/gold-bridge.mjs",
      find: /[\s\S]*/,
      replace: `
/**
 * GOLD BRIDGE
 * Connects live game state → gold solver
 */

import { solveGold } from "../gold-solver.mjs";
import itemsData from "../../data/items.json" assert { type: "json" };

const ITEM_MAP = itemsData.items ?? itemsData;

/**
 * Expand owned item into base components
 */
function expandItem(itemId, acc) {
  const item = ITEM_MAP[itemId];
  if (!item) return;

  if (Array.isArray(item.from) && item.from.length) {
    for (const sub of item.from) {
      expandItem(String(sub), acc);
    }
  } else {
    acc.push(String(itemId));
  }
}

/**
 * Normalize Riot live inventory → solver inventory
 */
function normalizeInventory(liveItems = []) {
  const owned = [];

  for (const it of liveItems) {
    if (!it?.itemID) continue;
    if (ITEM_MAP[it.itemID]?.consumed) continue;

    expandItem(String(it.itemID), owned);
  }

  return owned;
}

/**
 * Recommend what to buy RIGHT NOW
 */
export function recommendPurchase({ liveState, targetItemId }) {
  if (!targetItemId) {
    throw new Error("recommendPurchase: targetItemId is required");
  }

  const self = liveState?.self;
  if (!self) {
    throw new Error("recommendPurchase: liveState.self missing");
  }

  return solveGold({
    gold: Number(self.gold ?? 0),
    ownedItems: normalizeInventory(self.items ?? []),
    targetItemId: String(targetItemId),
  });
}
`,
    },
  ],
};
