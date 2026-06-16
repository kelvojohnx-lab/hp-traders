// routes/botRoutes.js
import express from "express";
const router = express.Router();
let botStatus = "stopped";
router.get("/status", (_, res) => res.json({ status: botStatus, activeBots: botStatus === "running" ? 3 : 0, tradesToday: 148, winRate: "76%" }));
router.post("/start", (_, res) => { botStatus = "running";  res.json({ success: true, status: botStatus }); });
router.post("/stop",  (_, res) => { botStatus = "stopped";  res.json({ success: true, status: botStatus }); });
export default router;
