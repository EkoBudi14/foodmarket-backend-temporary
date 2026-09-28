const admin = require("firebase-admin");

// Reuse the app across warm serverless invocations.
if (!admin.apps.length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT env var is not set");

  const serviceAccount = JSON.parse(raw);
  // Env var UIs sometimes store "\n" literally inside the private key.
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

module.exports = {
  admin,
  auth: admin.auth(),
  db: admin.firestore(),
};
