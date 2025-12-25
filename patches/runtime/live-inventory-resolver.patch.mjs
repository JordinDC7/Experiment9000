export default {
  ops: [
    {
      op: "insert_after",
      path: "engine/live/gold-bridge.mjs",
      anchor: /import .*gold-solver.mjs"/,
      content: `
import itemsData from "../../data/items.json" assert { type: "json" };

const ITEM_MAP = itemsData.items ?? itemsData;

/**
 * Expand a live item into all owned components
 */
function expandItem(itemId, acc = []) {
  const item = ITEM_MAP[itemId];
  if (!item) return acc;

  if (item.from && item.from.length) {
    for (const sub of item.from) expandItem(sub, acc);
  } else {
    acc.push(itemId);
  }
  return acc;
}

/**
 * Normalize Riot live inventory → solver inventory
 */
function normalizeInventory(liveItems = []) {
  const owned = [];
  for (const it of liveItems) {
    if (!it.itemID) continue;
    if (ITEM_MAP[it.itemID]?.consumed) continue;
    expandItem(String(it.itemID), owned);
  }
  return owned;
}
`,
    },

    {
      op: "edit",
      path: "engine/live/gold-bridge.mjs",
      find: /const\s+ownedItems\s*=\s*liveState\.self\.items\s*\|\|\s*\[\];/,
      replace: `
const ownedItems = normalizeInventory(liveState.self.items || []);
`,
    },
  ],
};
