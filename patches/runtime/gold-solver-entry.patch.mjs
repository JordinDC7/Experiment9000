export default {
  ops: [
    {
      op: "edit",
      path: "engine/gold-solver.mjs",
      find: /if\s*\(\s*process\.argv\[1\][\s\S]*?\)\s*\{[\s\S]*?\}\s*$/m,
      replace: `
if (import.meta.url === \`file://\${process.argv[1]}\`) {
  console.log("=== GOLD SOLVER TEST ===");

  const result = solveGold({
    targetItemId: "6672",
    currentGold: 1300,
    ownedItems: [],
  });

  console.log(JSON.stringify(result, null, 2));
}
`,
    },
  ],
};
