// routes/tradeRoutes.js
import express from "express";
const router = express.Router();
router.get("/", (_, res) => res.json([
  { time: "10:12", asset: "Volatility 75",  type: "CALL", stake: 10, result: "WIN"  },
  { time: "10:18", asset: "Step Index",     type: "PUT",  stake: 5,  result: "LOSS" },
  { time: "10:22", asset: "Volatility 100", type: "CALL", stake: 15, result: "WIN"  }
]));
export default router;
