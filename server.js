// server.js — HP Traders Main Entry Point (Render-ready)
import express from "express";
import cors    from "cors";
import dotenv  from "dotenv";
import fs      from "fs";
import path    from "path";
import { fileURLToPath } from "url";

import { startDerivStream, getLatestTick } from "./services/derivMarket.js";
import derivRoutes  from "./routes/derivRoutes.js";
import mpesaRoutes  from "./routes/mpesaRoutes.js";
import aiRoutes     from "./routes/aiRoutes.js";
import botRoutes    from "./routes/botRoutes.js";
import tradeRoutes  from "./routes/tradeRoutes.js";

dotenv.config();

const app       = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC    = path.join(__dirname, "public");

/* ─────────────────────────────────────────
   MIDDLEWARE
───────────────────────────────────────── */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC));   // serves index.html + dashboard.html

/* ─────────────────────────────────────────
   API ROUTES
───────────────────────────────────────── */
app.use("/api/deriv",  derivRoutes);
app.use("/api/mpesa",  mpesaRoutes);
app.use("/api/ai",     aiRoutes);
app.use("/api/bots",   botRoutes);
app.use("/api/trades", tradeRoutes);

/* ─────────────────────────────────────────
   DEMO ACCOUNT (in-memory fallback)
───────────────────────────────────────── */
const demo = { balance: 10000, currency: "USD", trades: [] };

function demoTrade({ asset, type, stake }) {
  const win    = Math.random() > 0.5;
  const profit = win ? +stake * 1.85 : -stake;
  demo.balance = +(demo.balance + profit).toFixed(2);
  const trade  = { time: new Date().toISOString(), asset, type, stake: +stake, result: win ? "WIN" : "LOSS" };
  demo.trades.unshift(trade);
  if (demo.trades.length > 50) demo.trades.pop();
  return { trade, balance: demo.balance };
}

app.get("/api/demo/account", (_, res) => res.json(demo));
app.post("/api/demo/trade",  (req, res) => {
  try   { res.json(demoTrade(req.body)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

/* ─────────────────────────────────────────
   LIVE PRICE SSE STREAM
───────────────────────────────────────── */
app.get("/api/price-stream", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering on Render

  const send = () => {
    const tick = getLatestTick();
    if (tick.price) res.write(`data: ${JSON.stringify(tick)}\n\n`);
  };
  send();
  const iv = setInterval(send, 1000);
  req.on("close", () => clearInterval(iv));
});

/* ─────────────────────────────────────────
   HEALTH CHECK
───────────────────────────────────────── */
app.get("/health", (_, res) => {
  res.json({
    status:       "OK",
    service:      "HP Traders",
    uptime:       process.uptime().toFixed(0) + "s",
    deriv_app_id: process.env.DERIV_APP_ID ? "✓ set"         : "✗ missing — add to Render env vars",
    mpesa:        process.env.MPESA_CONSUMER_KEY ? "✓ configured" : "✗ missing — add to Render env vars",
    demo_balance: demo.balance,
    live_tick:    getLatestTick(),
    node_env:     process.env.NODE_ENV || "development"
  });
});

/* ─────────────────────────────────────────
   FRONTEND ROUTES
   Render serves static files from /public.
   These catch-alls make browser refresh work.
───────────────────────────────────────── */
app.get("/dashboard", (req, res) => {
  const file = path.join(PUBLIC, "dashboard.html");
  if (fs.existsSync(file)) return res.sendFile(file);
  res.redirect("/");
});

// SPA fallback — everything else → index.html
app.get("*", (req, res) => {
  const file = path.join(PUBLIC, "index.html");
  if (fs.existsSync(file)) return res.sendFile(file);
  res.json({ status: "HP TRADERS RUNNING 🚀", visit: "/health" });
});

/* ─────────────────────────────────────────
   ERROR HANDLER
───────────────────────────────────────── */
app.use((err, req, res, next) => {
  console.error("🔥", err.message);
  res.status(500).json({ error: err.message });
});

/* ─────────────────────────────────────────
   START SERVER
───────────────────────────────────────── */
// Render assigns PORT dynamically — always use process.env.PORT
const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀 HP TRADERS RUNNING ON RENDER");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`🌐  PORT            : ${PORT}`);
  console.log(`🏥  Health check    : /health`);
  console.log(`🔑  Deriv login     : /api/deriv/login`);
  console.log(`💳  M-Pesa deposit  : POST /api/mpesa/deposit`);
  console.log(`📁  Frontend        : ${fs.existsSync(PUBLIC) ? PUBLIC : "⚠️  /public folder missing"}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Start Deriv live market stream
  try {
    startDerivStream();
    console.log("📡 Deriv WebSocket stream started");
  } catch (err) {
    console.log("⚠️  Deriv stream skipped:", err.message);
  }
});
