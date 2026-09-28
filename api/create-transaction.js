const { auth, db, admin } = require("../lib/firebase");
const { createSnapTransaction } = require("../lib/midtrans");

const USD_TO_IDR = Number(process.env.USD_TO_IDR || 16000);

/**
 * POST /api/create-transaction
 * Headers: Authorization: Bearer <Firebase ID token>
 * Body:    { "productId": 1, "qty": 1 }
 * Returns: { orderId, token, redirectUrl, grossAmount }
 */
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // 1. Only signed-in app users may create transactions.
  const idToken = (req.headers.authorization || "").replace(/^Bearer /, "");
  let user;
  try {
    user = await auth.verifyIdToken(idToken);
  } catch (e) {
    return res.status(401).json({ message: "Invalid or missing Firebase ID token" });
  }

  // 2. Validate input. The price is never taken from the client.
  const productId = Number(req.body?.productId);
  const qty = Number(req.body?.qty ?? 1);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "productId is required" });
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return res.status(400).json({ message: "qty must be between 1 and 99" });
  }

  try {
    // 3. Look up the real price from the same source the app uses.
    const productRes = await fetch(`https://dummyjson.com/products/${productId}`);
    if (!productRes.ok) return res.status(404).json({ message: "Product not found" });
    const product = await productRes.json();

    const unitPrice = Math.round(product.price * USD_TO_IDR);
    const grossAmount = unitPrice * qty;

    // 4. Load customer details saved by the app (users/{uid}).
    const userDoc = await db.collection("users").doc(user.uid).get();
    const profile = userDoc.exists ? userDoc.data() : {};

    const orderId = `FM-${Date.now()}-${user.uid.slice(0, 6)}`;

    // 5. Save the order first so the app can listen to it.
    await db.collection("orders").doc(orderId).set({
      uid: user.uid,
      productId,
      title: product.title,
      thumbnail: product.thumbnail,
      qty,
      unitPrice,
      grossAmount,
      status: "PENDING",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 6. Ask Midtrans for a Snap token.
    const snap = await createSnapTransaction({
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      item_details: [
        {
          id: String(productId),
          price: unitPrice,
          quantity: qty,
          name: product.title.slice(0, 50), // Midtrans limit: 50 chars
        },
      ],
      customer_details: {
        first_name: profile.fullName || profile.name || "Customer",
        email: profile.email || user.email || undefined,
        phone: profile.phone || undefined,
      },
    });

    await db.collection("orders").doc(orderId).update({
      snapToken: snap.token,
      redirectUrl: snap.redirect_url,
    });

    return res.status(200).json({
      orderId,
      token: snap.token,
      redirectUrl: snap.redirect_url,
      grossAmount,
    });
  } catch (e) {
    console.error("create-transaction failed:", e);
    return res.status(500).json({ message: e.message });
  }
};
