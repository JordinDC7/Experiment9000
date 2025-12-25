export default {
  ops: [
    {
      op: "insert_after",
      path: "engine/gold-solver.mjs",
      anchor: /const\s+items\s*=\s*loadJSON/,
      content: `
/**
 * Normalize items.json structure
 * Supports both:
 *  - { items: { id: item } }
 *  - { id: item }
 */
const ITEM_MAP = items.items ?? items;
`,
    },

    {
      op: "edit",
      path: "engine/gold-solver.mjs",
      find: /const\s+target\s*=\s*items\[targetItemId\]/,
      replace: `const target = ITEM_MAP[targetItemId];`,
    },

    {
      op: "edit",
      path: "engine/gold-solver.mjs",
      find: /Object\.keys\(items\)\.length/,
      replace: `Object.keys(ITEM_MAP).length`,
    },
  ],
};
