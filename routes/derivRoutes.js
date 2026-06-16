// routes/derivRoutes.js
import express from "express";
import { fetchDerivAccount, fetchDerivBalances } from "../services/derivMarket.js";

const router = express.Router();

/* GET /api/deriv/login — Redirect to Deriv OAuth */
router.get("/login", (req, res) => {
  const appId    = process.env.DERIV_APP_ID;
  const redirect = encodeURIComponent(process.env.DERIV_REDIRECT_URI || `${req.protocol}://${req.get("host")}/api/deriv/callback`);

  if (!appId || appId === "YOUR_DERIV_APP_ID") {
    return res.status(500).send(`
      <html><body style="background:#080d18;color:#fff;font-family:sans-serif;
        display:flex;align-items:center;justify-content:center;height:100vh;
        flex-direction:column;gap:14px;margin:0">
        <h2 style="color:#ff4d6d">DERIV_APP_ID not configured</h2>
        <p style="color:#8892a4">Add DERIV_APP_ID to your Render environment variables.</p>
        <p style="color:#8892a4">Register your app free at
          <a href="https://api.deriv.com/docs/app-registration" style="color:#00b4ff" target="_blank">
            api.deriv.com/docs/app-registration</a></p>
        <a href="/" style="color:#00e5b0;margin-top:8px">&larr; Back to HP Traders</a>
      </body></html>`);
  }

  const url = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&redirect_uri=${redirect}&response_type=token&scope=read,trade,payments,admin`;
  res.redirect(url);
});

/* GET /api/deriv/callback — Deriv posts token in URL fragment */
router.get("/callback", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>HP Traders — Connecting</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#080d18;color:#fff;font-family:'Segoe UI',sans-serif;
       display:flex;align-items:center;justify-content:center;
       height:100vh;flex-direction:column;gap:14px;padding:20px}
  .logo{font-size:2rem;font-weight:900}
  .hp{color:#00e5b0}.tr{color:#ff4d6d}
  .spin{width:40px;height:40px;border:3px solid #1a2740;
        border-top-color:#00e5b0;border-radius:50%;
        animation:sp .8s linear infinite}
  @keyframes sp{to{transform:rotate(360deg)}}
  .msg{color:#8892a4;font-size:.9rem;text-align:center;max-width:320px;line-height:1.5}
  .err{color:#ff4d6d;font-size:.84rem;text-align:center}
</style>
</head>
<body>
<div class="logo"><span class="hp">HP</span><span class="tr">Traders</span></div>
<div class="spin" id="spin"></div>
<div class="msg" id="msg">Authenticating with Deriv...</div>
<script>
(async () => {
  try {
    // Deriv puts tokens in URL fragment: #acct1=CR123&token1=xxx&cur1=USD
    const hash   = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accounts = [];
    let i = 1;
    while (params.get("acct" + i)) {
      accounts.push({
        account: params.get("acct" + i),
        token:   params.get("token" + i),
        cur:     params.get("cur" + i) || "USD"
      });
      i++;
    }
    if (!accounts.length) {
      document.getElementById("msg").textContent = "No Deriv accounts found.";
      setTimeout(() => window.location.href = "/?error=no_accounts", 2500);
      return;
    }
    document.getElementById("msg").textContent = "Fetching your Deriv account...";
    const resp = await fetch("/api/deriv/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts })
    });
    const data = await resp.json();
    if (data.success) {
      document.getElementById("msg").textContent =
        "Welcome " + (data.user.fullname || data.user.loginid) + "! Loading dashboard...";
      localStorage.setItem("hpt_token", data.token);
      localStorage.setItem("hpt_user",  JSON.stringify(data.user));
      setTimeout(() => window.location.href = "/dashboard", 700);
    } else {
      document.getElementById("spin").style.display = "none";
      document.getElementById("msg").className = "err";
      document.getElementById("msg").textContent =
        "Login failed: " + (data.error || "Unknown error");
      setTimeout(() => window.location.href = "/?error=auth_failed", 3000);
    }
  } catch (err) {
    document.getElementById("spin").style.display = "none";
    document.getElementById("msg").className = "err";
    document.getElementById("msg").textContent = "Error: " + err.message;
    setTimeout(() => window.location.href = "/?error=callback_error", 3000);
  }
})();
</script>
</body></html>`);
});

/* POST /api/deriv/authenticate — validate token, return user */
router.post("/authenticate", async (req, res) => {
  try {
    const { accounts } = req.body;
    if (!accounts?.length) return res.status(400).json({ success: false, error: "No accounts provided" });
    const token = accounts[0].token;
    if (!token)   return res.status(400).json({ success: false, error: "No token in accounts" });

    const derivUser = await fetchDerivAccount(token);

    res.json({
      success: true,
      token,
      user: {
        loginid:     derivUser.loginid,
        fullname:    derivUser.fullname || "HP Trader",
        email:       derivUser.email    || "",
        balance:     derivUser.balance,
        currency:    derivUser.currency || "USD",
        country:     derivUser.country  || "KE",
        accounts,
        accountList: derivUser.accountList || accounts
      }
    });
  } catch (err) {
    console.error("Authenticate error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* GET /api/deriv/account — live account info */
router.get("/account", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
    if (!token) return res.status(401).json({ error: "Token required" });
    const account = await fetchDerivAccount(token);
    res.json({ success: true, account });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* GET /api/deriv/balance — live balance */
router.get("/balance", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
    if (!token) return res.status(401).json({ error: "Token required" });
    const balances = await fetchDerivBalances(token);
    res.json({ success: true, balances });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
