/**
 * GOLD SOLVER (COUNT-AWARE)
 *
 * Returns gold-aware buy suggestions for completing a target item.
 *
 * Key requirement: handle duplicate components correctly (e.g. items needing 2x Dagger).
 * So we treat owned inventory as a MULTISET (id -> count), not a Set.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { normalizeItemIdForSR } from "./build-loader.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const ITEMS_PATH = path.join(ROOT, "data", "items.json");

let ITEM_MAP = null;

function loadItems() {
  if (ITEM_MAP) return ITEM_MAP;
  const raw = JSON.parse(fs.readFileSync(ITEMS_PATH, "utf8"));
  ITEM_MAP = raw.items || raw;
  return ITEM_MAP;
}

function isPurchasableSR(item) {
  if (!item) return false;
  if (item.gold?.purchasable === false) return false;
  const maps = item.maps || {};
  if (maps["11"] === false) return false;
  return true;
}

function getItemById(id) {
  const items = loadItems();
  const it = items[String(id)];
  if (!it) return null;
  // allow non-SR items ONLY if absolutely necessary; solver prefers SR
  return it;
}

function toCounts(ownedItems) {
  const counts = new Map();
  for (const raw of ownedItems || []) {
    const id = normalizeItemIdForSR(raw);
    if (!id) continue;
    counts.set(String(id), (counts.get(String(id)) || 0) + 1);
  }
  return counts;
}

function cloneCounts(counts) {
  const c = new Map();
  for (const [k, v] of counts.entries()) c.set(k, v);
  return c;
}

/**
 * Recursive missing cost including recipe/combine costs.
 *
 * missingCost(item) = recipeCost(item) + sum(missingCost(child))
 * but "owned" is a multiset: if we own the item (count>0), missing=0 and we decrement count.
 */
function missingCost(itemId, ownedCounts, stack = new Set()) {
  const id = String(normalizeItemIdForSR(itemId));
  if (!id) return 0;

  const have = ownedCounts.get(id) || 0;
  if (have > 0) {
    ownedCounts.set(id, have - 1);
    return 0;
  }

  if (stack.has(id)) return 0;
  stack.add(id);

  const item = getItemById(id);
  if (!item || !isPurchasableSR(item)) {
    stack.delete(id);
    return 0;
  }

  const from = Array.isArray(item.from)
    ? item.from.map((x) => String(normalizeItemIdForSR(x)))
    : [];
  if (!from.length) {
    stack.delete(id);
    return Number(item.gold?.total || 0);
  }

  let childrenTotal = 0;
  for (const childId of from) {
    const child = getItemById(childId);
    if (child && isPurchasableSR(child)) {
      childrenTotal += Number(child.gold?.total || 0);
    }
  }

  const total = Number(item.gold?.total || 0);
  const recipeCost = Math.max(0, total - childrenTotal);

  let missing = recipeCost;
  for (const childId of from) {
    missing += missingCost(childId, ownedCounts, stack);
  }

  stack.delete(id);
  return missing;
}

/**
 * Collect missing leaf purchases (basic purchasable components) in build order.
 * Uses ownedCounts (multiset) and decrements it when a requirement is satisfied.
 */
function buildLeafParts(itemId, ownedCounts, out, stack = new Set()) {
  const id = String(normalizeItemIdForSR(itemId));
  if (!id) return;

  const have = ownedCounts.get(id) || 0;
  if (have > 0) {
    ownedCounts.set(id, have - 1);
    return;
  }

  if (stack.has(id)) return;
  stack.add(id);

  const item = getItemById(id);
  if (!item || !isPurchasableSR(item)) {
    stack.delete(id);
    return;
  }

  const from = Array.isArray(item.from)
    ? item.from.map((x) => String(normalizeItemIdForSR(x)))
    : [];
  if (!from.length) {
    out.push({ id, cost: Number(item.gold?.total || 0) });
    stack.delete(id);
    return;
  }

  for (const childId of from) {
    buildLeafParts(childId, ownedCounts, out, stack);
  }

  stack.delete(id);
}

function immediateRecipeCost(itemId) {
  const id = String(normalizeItemIdForSR(itemId));
  const item = getItemById(id);
  if (!item || !isPurchasableSR(item)) return 0;

  const from = Array.isArray(item.from)
    ? item.from.map((x) => String(normalizeItemIdForSR(x)))
    : [];
  if (!from.length) return Number(item.gold?.total || 0);

  let childrenTotal = 0;
  for (const childId of from) {
    const child = getItemById(childId);
    if (child && isPurchasableSR(child))
      childrenTotal += Number(child.gold?.total || 0);
  }
  return Math.max(0, Number(item.gold?.total || 0) - childrenTotal);
}

function allImmediateChildrenOwned(itemId, ownedCounts) {
  const id = String(normalizeItemIdForSR(itemId));
  const item = getItemById(id);
  if (!item || !isPurchasableSR(item)) return false;

  const from = Array.isArray(item.from)
    ? item.from.map((x) => String(normalizeItemIdForSR(x)))
    : [];
  if (!from.length) return false;

  const tmp = cloneCounts(ownedCounts);
  for (const childId of from) {
    const have = tmp.get(childId) || 0;
    if (have <= 0) return false;
    tmp.set(childId, have - 1);
  }
  return true;
}

/**
 * Public API
 */
export function solveGold({ gold, ownedItems, targetItemId }) {
  const targetId = String(normalizeItemIdForSR(targetItemId));
  const owned = toCounts(ownedItems);

  // Total missing BEFORE buying anything now
  const totalMissing = missingCost(targetId, cloneCounts(owned));

  // Missing leaf parts (basic buys) to progress
  const requiredParts = [];
  buildLeafParts(targetId, cloneCounts(owned), requiredParts);

  // Decide what we can buy now
  let remaining = Number(gold || 0);
  const buyNow = [];
  let goldSpent = 0;

  // If no leaf parts are missing, we might be ready to pay recipe to complete (only if immediate children are owned)
  if (requiredParts.length === 0) {
    const recipe = immediateRecipeCost(targetId);
    if (
      recipe > 0 &&
      allImmediateChildrenOwned(targetId, owned) &&
      remaining >= recipe
    ) {
      buyNow.push({ id: targetId, count: 1, cost: recipe, isFinal: true });
      goldSpent = recipe;
      remaining -= recipe;
    }
  } else {
    for (const part of requiredParts) {
      const cost = Number(part.cost || 0);
      if (cost <= 0) continue;
      if (remaining >= cost) {
        buyNow.push({ id: part.id, count: 1, cost });
        goldSpent += cost;
        remaining -= cost;
      } else {
        break;
      }
    }
  }

  const goldToFinish = Math.max(0, totalMissing - goldSpent);

  return {
    targetItem: targetId,
    buyNow,
    goldSpent,
    goldRemaining: remaining,
    goldToFinish,
    complete:
      goldToFinish === 0 &&
      (totalMissing === 0 || buyNow.some((b) => b.isFinal)),
  };
}
