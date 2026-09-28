const { db, admin } = require("../lib/firebase");
const { isValidSignature, mapStatus } = require("../lib/midtrans");

/**
 * POST /api/notification
 * Midtrans HTTP(S) notification (webhook). Set this URL in
 * Midtrans Dashboard > Settings > Payment > Notification URL.
 */
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const n = req.body || {};

  // Reject anything not signed with our Server Key.
  if (!isValidSignature(n)) {
    return res.status(403).json({ message: "Invalid signature" });
  }

  const orderRef = db.collection("orders").doc(n.order_id);
  const order = await orderRef.get();

  // Midtrans "Test notification" button sends an unknown order_id; answer 200 so it passes.
  if (!order.exists) {
    return res.status(200).json({ message: "Order not found, ignored" });
  }

  await orderRef.update({
    status: mapStatus(n),
    midtransStatus: n.transaction_status,
    paymentType: n.payment_type || null,
    transactionId: n.transaction_id || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return res.status(200).json({ message: "OK" });
};
