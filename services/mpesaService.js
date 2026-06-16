// services/mpesaService.js — Safaricom Daraja STK Push
import axios from "axios";

const BASE_URL = process.env.NODE_ENV === "production"
  ? "https://api.safaricom.co.ke"
  : "https://sandbox.safaricom.co.ke";

export async function getMpesaToken() {
  const key = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  if (!key || !secret) throw new Error("M-Pesa credentials not configured");
  const credentials = Buffer.from(`${key}:${secret}`).toString("base64");
  const { data } = await axios.get(
    `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );
  return data.access_token;
}

function getTimestamp() {
  return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

function getStkPassword() {
  const shortcode = process.env.MPESA_BUSINESS_SHORT_CODE;
  const passkey   = process.env.MPESA_PASSKEY;
  return Buffer.from(`${shortcode}${passkey}${getTimestamp()}`).toString("base64");
}

export function formatPhone(phone) {
  const p = phone.toString().replace(/\s+/g, "").replace(/^\+/, "");
  if (p.startsWith("07") || p.startsWith("01")) return "254" + p.slice(1);
  if (p.startsWith("254")) return p;
  if (p.startsWith("7")   || p.startsWith("1")) return "254" + p;
  return p;
}

export async function stkPush({ phone, amount, accountRef = "HPTraders", desc = "HP Traders Deposit" }) {
  const token     = await getMpesaToken();
  const shortcode = process.env.MPESA_BUSINESS_SHORT_CODE;
  const callback  = process.env.MPESA_CALLBACK_URL;
  const fPhone    = formatPhone(phone);
  const { data }  = await axios.post(
    `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
    {
      BusinessShortCode: shortcode,
      Password:          getStkPassword(),
      Timestamp:         getTimestamp(),
      TransactionType:   "CustomerPayBillOnline",
      Amount:            Math.ceil(Number(amount)),
      PartyA:            fPhone,
      PartyB:            shortcode,
      PhoneNumber:       fPhone,
      CallBackURL:       callback,
      AccountReference:  accountRef,
      TransactionDesc:   desc
    },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  return data;
}

export async function queryStkPush(checkoutRequestId) {
  const token     = await getMpesaToken();
  const shortcode = process.env.MPESA_BUSINESS_SHORT_CODE;
  const { data }  = await axios.post(
    `${BASE_URL}/mpesa/stkpushquery/v1/query`,
    {
      BusinessShortCode: shortcode,
      Password:          getStkPassword(),
      Timestamp:         getTimestamp(),
      CheckoutRequestID: checkoutRequestId
    },
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );
  return data;
}
