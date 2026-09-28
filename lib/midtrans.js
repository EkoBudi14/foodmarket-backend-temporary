const crypto = require("crypto");

const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
const serverKey = process.env.MIDTRANS_SERVER_KEY || "";

const SNAP_URL = isProduction
  ? "https://app.midtrans.com/snap/v1/transactions"
  : "https://app.sandbox.midtrans.com/snap/v1/transactions";

function authHeader() {
  if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY env var is not set");
  return "Basic " + Buffer.from(serverKey + ":").toString("base64");
}

async function createSnapTransaction(payload) {
  const res = await fetch(SNAP_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader(),
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (!res.ok) {
    const message = (body.error_messages || []).join(", ") || res.statusText;
    throw new Error(`Midtrans error ${res.status}: ${message}`);
  }
  return body; // { token, redirect_url }
}

// signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
function isValidSignature({ order_id, status_code, gross_amount, signature_key }) {
  if (!signature_key) return false;
  const expected = crypto
    .createHash("sha512")
    .update(order_id + status_code + gross_amount + serverKey)
    .digest("hex");
  const given = Buffer.from(String(signature_key));
  const wanted = Buffer.from(expected);
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}

// Maps Midtrans transaction_status / fraud_status to our order status.
function mapStatus({ transaction_status, fraud_status }) {
  switch (transaction_status) {
    case "capture":
      return fraud_status === "accept" ? "PAID" : "PENDING";
    case "settlement":
      return "PAID";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
      return "CANCELLED";
    case "expire":
      return "EXPIRED";
    case "refund":
    case "partial_refund":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

module.exports = { createSnapTransaction, isValidSignature, mapStatus };
