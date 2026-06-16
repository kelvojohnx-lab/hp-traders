# HP Traders — Render Deployment Guide

## Project Structure
```
hp-traders/               ← push this entire folder to GitHub
├── server.js             ← Entry point (Render starts this)
├── package.json
├── render.yaml           ← Auto-detected by Render
├── .gitignore
├── .env.example          ← Copy → .env for local dev
├── public/
│   ├── index.html        ← Landing page + Login
│   └── dashboard.html    ← Full trading dashboard
├── routes/
│   ├── derivRoutes.js    ← Deriv OAuth + account + balance
│   ├── mpesaRoutes.js    ← STK Push deposit + callback + status
│   ├── aiRoutes.js
│   ├── botRoutes.js
│   └── tradeRoutes.js
└── services/
    ├── derivMarket.js    ← Deriv WebSocket + account fetch
    └── mpesaService.js   ← M-Pesa Daraja token + STK Push
```

---

## Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "HP Traders initial commit"
git remote add origin https://github.com/YOUR_USERNAME/hp-traders.git
git push -u origin main
```

---

## Step 2 — Create Render Web Service

1. Go to **https://dashboard.render.com**
2. Click **New → Web Service**
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` — settings pre-fill:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Node version**: 18+

---

## Step 3 — Add Environment Variables on Render

In your Render service → **Environment** tab, add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DERIV_APP_ID` | Your Deriv App ID (see below) |
| `DERIV_REDIRECT_URI` | `https://YOUR-APP.onrender.com/api/deriv/callback` |
| `MPESA_CONSUMER_KEY` | From Safaricom Daraja |
| `MPESA_CONSUMER_SECRET` | From Safaricom Daraja |
| `MPESA_BUSINESS_SHORT_CODE` | `174379` (sandbox) or your paybill |
| `MPESA_PASSKEY` | Safaricom passkey (sandbox one in `.env.example`) |
| `MPESA_CALLBACK_URL` | `https://YOUR-APP.onrender.com/api/mpesa/callback` |

---

## Step 4 — Get Your Deriv App ID

1. Login to **https://deriv.com**
2. Go to **https://api.deriv.com/docs/app-registration**
3. Register a new app
4. Set **OAuth Redirect URI** to: `https://YOUR-APP.onrender.com/api/deriv/callback`
5. Copy the **App ID** → paste into Render env var

---

## Step 5 — Get M-Pesa Daraja Keys

1. Go to **https://developer.safaricom.co.ke**
2. Create an account and create an app
3. **Sandbox**: use the test credentials shown in your dashboard
4. **Production**: apply for Go-Live → get real Consumer Key & Secret
5. Set `NODE_ENV=production` in Render for live M-Pesa

---

## Step 6 — Deploy

Click **Deploy** on Render. Your app will be live at:
```
https://hp-traders.onrender.com
```

Visit `/health` to verify everything is running:
```
https://hp-traders.onrender.com/health
```

---

## How It Works

### Login Flow
```
User → "Continue with Deriv"
  → GET /api/deriv/login
  → Redirect to oauth.deriv.com
  → Deriv redirects to /api/deriv/callback?#token1=xxx
  → Callback JS reads token → POST /api/deriv/authenticate
  → Backend WS connects to Deriv, fetches real account data
  → Returns {loginid, fullname, balance, currency}
  → Stored in localStorage → redirect to /dashboard
```

### M-Pesa Deposit Flow
```
User fills phone + amount → POST /api/mpesa/deposit
  → Backend calls Safaricom STK Push API
  → Phone gets popup: "Enter M-Pesa PIN"
  → User enters PIN
  → Safaricom POSTs to /api/mpesa/callback
  → User clicks "Check Status" → GET /api/mpesa/status/:id
  → Returns {status: "completed", receipt: "MPX..."}
  → Receipt shown on screen ✅
```

### Live Balance
- After login, dashboard calls `/api/deriv/balance` every 30 seconds
- Shows real Deriv account balance in nav bar
- Updates automatically after M-Pesa deposit

---

## Local Development

```bash
# 1. Copy env file
cp .env.example .env

# 2. Fill in your Deriv App ID and M-Pesa keys in .env

# 3. Install deps
npm install

# 4. Run
npm run dev

# 5. Open
open http://localhost:10000
```

---

## Free Tier Notes (Render)

- Free tier **spins down after 15 min** of inactivity — first load takes ~30s
- To avoid spin-down: upgrade to **Starter ($7/mo)** or use an uptime monitor
- WebSocket connections (Deriv live prices) auto-reconnect after spin-up
