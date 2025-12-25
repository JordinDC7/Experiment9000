import https from "https";

const ENDPOINT = "https://127.0.0.1:2999/liveclientdata/allgamedata";
const INTERVAL_MS = 1000;

let lastData = null;

function fetchJSON() {
  return new Promise((resolve, reject) => {
    const req = https.get(ENDPOINT, { rejectUnauthorized: false }, (res) => {
      let buf = "";
      res.on("data", (d) => (buf += d));
      res.on("end", () => {
        try {
          resolve(JSON.parse(buf));
        } catch {
          reject(new Error("Invalid JSON from Riot API"));
        }
      });
    });
    req.on("error", reject);
  });
}

export async function pollLiveClient() {
  try {
    lastData = await fetchJSON();
  } catch {
    // game probably not running
    lastData = null;
  }
  return lastData;
}

export function startPolling(onTick) {
  setInterval(async () => {
    const data = await pollLiveClient();
    if (data) onTick(data);
  }, INTERVAL_MS);
}
