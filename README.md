# foodmarket-backend

Serverless backend for the FoodMarket Android app, deployed on Vercel.
It keeps the Midtrans Server Key off the device.

## Endpoints

| Method | Path | Called by | Purpose |
|---|---|---|---|
| POST | `/api/create-transaction` | Android app | Creates `orders/{orderId}` in Firestore and returns a Midtrans Snap `token` + `redirectUrl` |
| POST | `/api/notification` | Midtrans | Verifies `signature_key` and updates `orders/{orderId}.status` |

### `POST /api/create-transaction`

Headers:

```
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

Body:

```json
{ "productId": 1, "qty": 1 }
```

Response:

```json
{ "orderId": "FM-...", "token": "...", "redirectUrl": "https://app.sandbox.midtrans.com/snap/v4/redirection/...", "grossAmount": 159840 }
```

The price is looked up server-side from `https://dummyjson.com/products/{id}` and converted with `USD_TO_IDR`. The client never sends a price.

### Order status values

`PENDING`, `PAID`, `CANCELLED`, `EXPIRED`, `REFUNDED`

## Environment variables

See `.env.example`.

| Name | Value |
|---|---|
| `MIDTRANS_SERVER_KEY` | Midtrans Server Key |
| `MIDTRANS_IS_PRODUCTION` | `false` for Sandbox |
| `FIREBASE_SERVICE_ACCOUNT` | Service account JSON, single line |
| `USD_TO_IDR` | Conversion rate, default `16000` |

## Deploy

1. Push this folder to its own GitHub repository.
2. On vercel.com: **Add New → Project**, import the repository, no build settings needed.
3. Add the environment variables above under **Settings → Environment Variables**, then redeploy.
4. In the Midtrans dashboard (Sandbox): **Settings → Payment → Notification URL** =
   `https://<your-project>.vercel.app/api/notification`

## Local development

```bash
npm install
npm i -g vercel
cp .env.example .env.local   # fill in values
vercel dev
```

Never commit `.env.local` or the service account JSON.
