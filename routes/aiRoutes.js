// routes/aiRoutes.js
import express from "express";
const router = express.Router();
router.get("/", (_, res) => {
  const signals = ["BUY","SELL","HOLD"], trends = ["BULLISH","BEARISH","NEUTRAL"];
  res.json({ signal: signals[Math.floor(Math.random()*3)], confidence: (70+Math.random()*25).toFixed(0)+"%", trend: trends[Math.floor(Math.random()*3)], market: "Volatility 75", timestamp: new Date().toISOString() });
});
router.post("/chat", (req, res) => res.json({ status: "OK", message: req.body.message || "" }));
export default router;
