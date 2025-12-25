export default {
  ops: [
    {
      op: "edit",
      path: "overlay/main.mjs",
      find: /load(File|URL)\(.+\)/,
      replace: `loadFile(path.join(__dirname, "index.html"))`,
    },
    {
      op: "insert_after",
      path: "overlay/main.mjs",
      anchor: /new BrowserWindow\(\{/,
      content: `
    width: 340,
    height: 180,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    movable: true,
`,
    },
    {
      op: "insert_after",
      path: "overlay/main.mjs",
      anchor: /webPreferences:\s*\{/,
      content: `
      preload: path.join(__dirname, "preload.mjs"),
`,
    },
  ],
};
