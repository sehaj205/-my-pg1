# MyPG - Personal UPI Payment Gateway
## Zero Commission • Serverless Deployment • PostgreSQL Backend

A self-hosted, serverless UPI payment gateway deployed on Vercel with no PC required.

## Features

✅ **0% Commission** — Direct UPI P2P settlement  
✅ **Serverless Ready** — Deploy to Vercel/Netlify  
✅ **PostgreSQL Backend** — Scalable cloud database  
✅ **WhatsApp OTP Auth** — Secure customer verification  
✅ **FIFO Queue Engine** — Single-slot payment prevention  
✅ **Tri-channel Observers** — Android SMS + Gmail + Web SMS  
✅ **Real-time SSE Stream** — Live payment status updates  
✅ **Beautiful Checkout** — Professional customer-facing portal  
✅ **Merchant Admin** — Payment monitoring dashboard  

## Architecture

```
Customer Browser → Checkout Portal (Vercel)
                         ↓
                   Payment API (Vercel Serverless)
                         ↓
                PostgreSQL (Vercel Postgres)
                         ↓
        Banking Observers (Android/Gmail/SMS)
                         ↓
                 Webhook Delivery (HMAC)
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env` and update with your credentials:

```bash
cp .env .env.local
```

Required variables:
- `DATABASE_URL` — PostgreSQL connection string
- `MERCHANT_VPA` — Your UPI ID (e.g., `yourname@upi`)
- `MERCHANT_NAME` — Business name
- `WEBHOOK_SECRET` — Secret for HMAC webhook signing
- `JWT_SECRET` — Secret for JWT token signing

### 3. Run Locally

```bash
npm start
```

Services will start at:
- **Payment API**: http://localhost:6100
- **Checkout Portal**: http://localhost:7000
- **Merchant Admin**: http://localhost:6001

### 4. Deploy to Vercel

```bash
vercel
```

## Project Structure

```
my-pg/
├── apps/
│   ├── payment-api/          # Core payment REST API
│   │   └── src/
│   │       ├── index.js      # Main server
│   │       ├── database.js   # DB abstraction (SQLite/Postgres)
│   │       ├── services/     # Business logic
│   │       └── routes/       # API endpoints
│   ├── checkout-portal/      # Customer checkout UI
│   │   └── src/
│   │       ├── index.html    # Checkout page
│   │       └── checkout.js   # Checkout logic
│   └── merchant-admin/       # Admin dashboard
│       └── src/
│           └── index.html    # Admin UI
├── api/                      # Vercel serverless functions
├── public/                   # Static assets
├── .env                      # Environment configuration
├── vercel.json              # Vercel deployment config
└── package.json             # Dependencies

```

## API Endpoints

### Payment API (Port 6100)

- `POST /api/v1/payments/create` — Create payment session
- `GET /api/v1/payments/:orderId/status` — Get payment status
- `POST /api/v1/payments/:orderId/activate` — Activate payment (acquire slot)
- `POST /api/v1/payments/:orderId/confirm` — Confirm payment done
- `POST /api/v1/payments/:orderId/cancel` — Cancel payment
- `GET /api/v1/payments/:orderId/stream` — SSE status stream
- `GET /api/v1/payments` — List payments
- `GET /api/v1/info` — Merchant info
- `GET /health` — Health check

### Observer Endpoints

- `POST /api/v1/observers/android` — Android APK observer (HMAC signed)
- `POST /api/v1/observers/gmail` — Gmail observer
- `POST /api/v1/observers/sms` — SMS Web observer
- `POST /api/v1/observers/manual` — Manual verification (admin)

## Database Schema

### Core Tables

- `merchants` — Merchant accounts
- `receiving_accounts` — UPI VPA accounts
- `customers` — Customer records
- `customer_sessions` — JWT sessions
- `payment_sessions` — Payment lifecycle
- `observations` — Banking alerts (SMS/Email/Push)
- `otp_verifications` — OTP codes
- `audit_logs` — Audit trail

## Deployment Guide

### Vercel Deployment

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Link Project**:
   ```bash
   vercel link
   ```

3. **Add Environment Variables**:
   ```bash
   vercel env add DATABASE_URL
   vercel env add MERCHANT_VPA
   vercel env add WEBHOOK_SECRET
   # ... add all required vars
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

### PostgreSQL Setup (Vercel Postgres)

1. **Create Database**:
   ```bash
   vercel postgres create
   ```

2. **Get Connection String**:
   ```bash
   vercel env pull
   ```

3. **Run Migrations**:
   The application auto-migrates on first run.

## Security

- ✅ HMAC-SHA256 webhook signatures
- ✅ JWT-based session auth
- ✅ Anti-replay protection (60s window)
- ✅ SHA-256 observation deduplication
- ✅ Integer Paise units (no float drift)
- ✅ WAL mode SQLite / ACID Postgres

## Webhook Integration

```javascript
// Verify webhook signature
import crypto from 'crypto';

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-gateway-signature'];
  const secret = process.env.WEBHOOK_SECRET;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(req.body.toString('utf8'));
  if (payload.event === 'SUCCESS') {
    // Fulfill order: payload.orderId, payload.utr, payload.amountPaise
  }
  res.json({ received: true });
});
```

## License

MIT

## Support

For issues, questions, or contributions, please open an issue.

---

**Built with ❤️ for zero-commission payments**