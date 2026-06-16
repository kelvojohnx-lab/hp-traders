// routes/mpesaRoutes.js
import express from "express";
import { stkPush, queryStkPush, formatPhone } from "../services/mpesaService.js";

const router = express.Router();
const transactions = new Map(); // In-memory store (use DB for production)

/* POST /api/mpesa/deposit */
router.post("/deposit", async (req, res) => {
  try {
    const { phone, amount, accountRef } = req.body;

    // Validation
    if (!phone)  return res.status(400).json({ success: false, error: "Phone number is required" });
    if (!amount) return res.status(400).json({ success: false, error: "Amount is required" });

    const amt = Number(amount);
    if (isNaN(amt) || amt < 1)      return res.status(400).json({ success: false, error: "Minimum deposit is KES 1" });
    if (amt > 150000)                return res.status(400).json({ success: false, error: "Maximum deposit is KES 150,000" });

    const fPhone = formatPhone(phone);
    console.log(`💳 STK Push → ${fPhone} KES ${amt}`);

    const result = await stkPush({
      phone:      fPhone,
      amount:     amt,
      accountRef: accountRef || "HPTraders",
      desc:       `HP Traders Deposit KES ${amt}`
    });

    if (result.ResponseCode === "0") {
      // Store pending transaction
      transactions.set(result.CheckoutRequestID, {
        checkoutRequestId: result.CheckoutRequestID,
        merchantRequestId: result.MerchantRequestID,
        phone: fPhone, amount: amt,
        status: "pending",
        createdAt: new Date().toISOString()
      });
      return res.json({
        success:          true,
        message:          `STK Push sent to ${phone}. Enter your M-Pesa PIN on your phone.`,
        checkoutRequestId: result.CheckoutRequestID,
        merchantRequestId: result.MerchantRequestID
      });
    }

    return res.status(400).json({
      success: false,
      error:   result.ResponseDescription || "STK Push failed. Try again.",
      code:    result.ResponseCode
    });

  } catch (err) {
    console.error("M-Pesa deposit error:", err.message);

    if (err.message?.includes("not configured"))
      return res.status(503).json({
        success: false,
        error:   "M-Pesa not configured. Add keys in Render Environment Variables.",
        help:    "https://developer.safaricom.co.ke"
      });

    return res.status(500).json({
      success: false,
      error:   err.response?.data?.errorMessage || err.message
    });
  }
});

/* POST /api/mpesa/callback — Safaricom posts payment result here */
router.post("/callback", (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback;
    if (!cb) return res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = cb;
    console.log(`📲 M-Pesa callback: ${CheckoutRequestID} → code ${ResultCode}`);

    let amount = 0, phone = "", receipt = "";
    if (CallbackMetadata?.Item) {
      for (const item of CallbackMetadata.Item) {
        if (item.Name === "Amount")              amount  = item.Value;
        if (item.Name === "PhoneNumber")         phone   = item.Value;
        if (item.Name === "MpesaReceiptNumber")  receipt = item.Value;
      }
    }

    if (transactions.has(CheckoutRequestID)) {
      const tx = transactions.get(CheckoutRequestID);
      tx.status    = ResultCode === 0 ? "completed" : "failed";
      tx.resultCode = ResultCode;
      tx.resultDesc = ResultDesc;
      tx.receipt    = receipt;
      tx.completedAt = new Date().toISOString();
      transactions.set(CheckoutRequestID, tx);

      if (ResultCode === 0) console.log(`✅ Payment OK: KES ${amount} from ${phone} — Ref ${receipt}`);
      else                  console.log(`❌ Payment failed: ${ResultDesc}`);
    }

    // Always respond 200 to Safaricom
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err) {
    console.error("Callback error:", err);
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
});

/* GET /api/mpesa/status/:checkoutRequestId — poll payment result */
router.get("/status/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // Check local cache first
    if (transactions.has(id)) {
      const tx = transactions.get(id);
      if (tx.status !== "pending") {
        return res.json({ success: true, status: tx.status, transaction: tx });
      }
    }

    // Query Safaricom API
    const result = await queryStkPush(id);
    const status =
      result.ResultCode === "0"    ? "completed" :
      result.ResultCode === "1032" ? "cancelled"  : "failed";

    res.json({
      success:    true,
      status,
      resultCode: result.ResultCode,
      resultDesc: result.ResultDesc
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* POST /api/mpesa/withdraw */
router.post("/withdraw", async (req, res) => {
  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ success: false, error: "Phone and amount required" });
  res.json({
    success: true,
    message: `Withdrawal of KES ${amount} to ${phone} is being processed. Expect within 24 hours.`,
    phone, amount
  });
});

export default router;
