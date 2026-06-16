// services/derivMarket.js — Deriv WebSocket API
import WebSocket from "ws";

let ws = null;
let latestTick = {};
const subscribers = [];

export function onTick(cb) { subscribers.push(cb); }
export function getLatestTick() { return latestTick; }

/* ── Start live price stream (no auth needed) ── */
export function startDerivStream(appId = process.env.DERIV_APP_ID || "1089") {
  try {
    ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${appId}`);
    ws.on("open", () => {
      console.log("✅ Deriv WS connected");
      ws.send(JSON.stringify({ ticks: "1HZ100V", subscribe: 1 }));
    });
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.tick) {
          latestTick = { symbol: msg.tick.symbol, price: msg.tick.quote, time: msg.tick.epoch };
          subscribers.forEach((cb) => cb(latestTick));
        }
      } catch (_) {}
    });
    ws.on("error", (err) => console.log("⚠️ Deriv WS error:", err.message));
    ws.on("close", () => {
      console.log("🔁 Deriv WS closed — reconnecting in 5s");
      setTimeout(() => startDerivStream(appId), 5000);
    });
  } catch (err) {
    console.log("⚠️ Deriv Stream skipped:", err.message);
  }
}

/* ── Fetch full account info using OAuth token ── */
export function fetchDerivAccount(token) {
  return new Promise((resolve, reject) => {
    const appId = process.env.DERIV_APP_ID || "1089";
    const conn = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${appId}`);
    const timeout = setTimeout(() => { conn.close(); reject(new Error("Deriv account fetch timed out")); }, 12000);
    conn.on("open", () => conn.send(JSON.stringify({ authorize: token })));
    conn.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.error) { clearTimeout(timeout); conn.close(); return reject(new Error(msg.error.message)); }
        if (msg.msg_type === "authorize" && msg.authorize) {
          clearTimeout(timeout); conn.close();
          const a = msg.authorize;
          resolve({
            loginid: a.loginid, fullname: a.fullname || "",
            email: a.email || "", balance: a.balance,
            currency: a.currency || "USD", country: a.country || "KE",
            accountList: a.account_list || []
          });
        }
      } catch (_) {}
    });
    conn.on("error", (err) => { clearTimeout(timeout); reject(err); });
  });
}

/* ── Fetch live balance ── */
export function fetchDerivBalances(token) {
  return new Promise((resolve, reject) => {
    const appId = process.env.DERIV_APP_ID || "1089";
    const conn = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${appId}`);
    const timeout = setTimeout(() => { conn.close(); reject(new Error("Balance fetch timeout")); }, 12000);
    let authorized = false;
    conn.on("open", () => conn.send(JSON.stringify({ authorize: token })));
    conn.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.error) { clearTimeout(timeout); conn.close(); return reject(new Error(msg.error.message)); }
        if (msg.msg_type === "authorize" && !authorized) {
          authorized = true;
          conn.send(JSON.stringify({ balance: 1, account: "all", subscribe: 0 }));
        }
        if (msg.msg_type === "balance") { clearTimeout(timeout); conn.close(); resolve(msg.balance); }
      } catch (_) {}
    });
    conn.on("error", (err) => { clearTimeout(timeout); reject(err); });
  });
}
