# DEPLOYMENT GUIDE - MyPG on Vercel + PostgreSQL

Deploy your zero-commission UPI payment gateway to production without needing your PC on.

## Prerequisites

- Node.js 24+ installed locally
- Vercel account (free at vercel.com)
- PostgreSQL database (Vercel Postgres recommended)
- Git repository (GitHub, GitLab, or Bitbucket)

## Step 1: Prepare Your Repository

### 1.1 Initialize Git (if not already done)

```bash
cd c:/Users/Perfect/my-pg
git init
git add .
git commit -m "Initial commit: MyPG payment gateway"
```

### 1.2 Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/my-pg.git
git branch -M main
git push -u origin main
```

## Step 2: Set Up PostgreSQL

### Option A: Vercel Postgres (Recommended)

Vercel Postgres is integrated with Vercel and provides automatic backups + SSL.

```bash
npm install -g vercel
vercel login
vercel postgres create my-pg-db
```

This creates a database and outputs the connection string.

### Option B: Self-Hosted PostgreSQL

If you prefer self-hosted (AWS RDS, DigitalOcean, etc.):

```
postgresql://user:password@host:5432/my_pg_db
```

## Step 3: Configure Environment Variables

### 3.1 Create `.env.production` for production secrets

```bash
# Do NOT commit this file to git
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:5432/my_pg_db
USE_POSTGRES=true

MERCHANT_NAME=Your Business Name
MERCHANT_VPA=yourname@upi
MERCHANT_PHONE=9999999999

JWT_SECRET=use-a-long-random-string-like-$(openssl rand -hex 32)
WEBHOOK_SECRET=use-a-long-random-string-like-$(openssl rand -hex 32)
ADMIN_TOKEN=use-a-long-random-string-like-$(openssl rand -hex 32)

WEBHOOK_URL=https://your-project.vercel.app/api/v1/webhooks/merchant
CHECKOUT_PUBLIC_URL=https://your-project.vercel.app/checkout
ADMIN_PUBLIC_URL=https://your-project.vercel.app/admin
API_PUBLIC_URL=https://your-project.vercel.app/api

WHATSAPP_ENABLED=true
GMAIL_ENABLED=false

PORT_API=6100
PORT_CHECKOUT=7000
PORT_ADMIN=6001
```

### 3.2 Add to Vercel via CLI

```bash
vercel env add DATABASE_URL
# Paste your PostgreSQL connection string when prompted

vercel env add JWT_SECRET
# Generate: openssl rand -hex 32
# Paste the random string

vercel env add WEBHOOK_SECRET
# Generate: openssl rand -hex 32

vercel env add ADMIN_TOKEN
# Generate: openssl rand -hex 32

vercel env add MERCHANT_NAME
vercel env add MERCHANT_VPA
vercel env add MERCHANT_PHONE
vercel env add WEBHOOK_URL
vercel env add CHECKOUT_PUBLIC_URL
vercel env add ADMIN_PUBLIC_URL
vercel env add API_PUBLIC_URL
```

Verify:
```bash
vercel env list
```

## Step 4: Update `vercel.json` for Serverless Functions

Create `vercel.json` (already included):

```json
{
  "version": 2,
  "functions": {
    "api/**/*.js": {
      "memory": 1024,
      "maxDuration": 60
    }
  },
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "apps/payment-api/src/index.js"
    },
    {
      "src": "/checkout",
      "dest": "apps/checkout-portal/src/index.html"
    },
    {
      "src": "/admin",
      "dest": "apps/merchant-admin/src/index.html"
    }
  ]
}
```

## Step 5: Modify Database Layer for PostgreSQL

Update `apps/payment-api/src/database.js` to support both SQLite and PostgreSQL:

```javascript
// Already done in the codebase
// The database.js file now checks DATABASE_URL and USE_POSTGRES
```

## Step 6: Deploy to Vercel

### 6.1 Connect Your Repository

```bash
vercel
```

You'll be prompted:
- Select your Git provider (GitHub/GitLab/Bitbucket)
- Connect your account
- Select the `my-pg` repository
- Accept default settings

### 6.2 Deploy

```bash
vercel --prod
```

Vercel will:
1. Build the project
2. Run database migrations
3. Deploy serverless functions
4. Assign a unique domain (e.g., `my-pg.vercel.app`)

### 6.3 Monitor Deployment

```bash
vercel logs
vercel env list
```

## Step 7: Verify Deployment

### Check Health Endpoints

```bash
curl https://your-project.vercel.app/api/health
curl https://your-project.vercel.app/api/v1/info
```

### Test Payment Creation

```bash
curl -X POST https://your-project.vercel.app/api/v1/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": "TEST-001",
    "amount": 99.99,
    "currency": "INR",
    "customer_phone": "+919876543210",
    "customer_name": "Test Customer"
  }'
```

### Access Admin Panel

Navigate to: `https://your-project.vercel.app/admin`

Use the admin token from environment variables to authenticate.

## Step 8: Set Up Custom Domain

### 8.1 Update DNS Records

If you have a custom domain (e.g., `pay.yourdomain.com`):

1. In Vercel dashboard, go to **Settings** → **Domains**
2. Add your custom domain
3. Update your DNS provider with the CNAME record Vercel provides

### 8.2 Update Environment Variables

```bash
vercel env add WEBHOOK_URL https://pay.yourdomain.com/api/v1/webhooks/merchant
vercel env add CHECKOUT_PUBLIC_URL https://pay.yourdomain.com/checkout
vercel env add ADMIN_PUBLIC_URL https://pay.yourdomain.com/admin
vercel env add API_PUBLIC_URL https://pay.yourdomain.com/api
```

## Step 9: Configure Webhooks for Your Shop

In your e-commerce platform or merchant website, add the webhook endpoint:

```javascript
// Example: Receiving payment success from MyPG
app.post('/webhook/mypg', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-gateway-signature'];
  const secret = process.env.MYPG_WEBHOOK_SECRET;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(req.body.toString('utf8'));
  console.log(`Payment successful: ${payload.orderId} for ₹${payload.amount}`);
  
  // Mark order as paid in your system
  // Send confirmation email to customer
  // Trigger order fulfillment

  res.json({ received: true });
});
```

## Step 10: Monitor & Scale

### View Logs

```bash
vercel logs --follow
```

### Check Performance

Vercel Dashboard → Analytics

### Scale Database

If you hit limits:
- Upgrade Vercel Postgres plan
- Or migrate to AWS RDS / DigitalOcean
- Update `DATABASE_URL` environment variable

## Step 11: Keep PC Off Permanently

Your gateway is now running 24/7 on Vercel serverless:

✅ No PC needed  
✅ Auto-scaling  
✅ 99.95% uptime SLA  
✅ Automatic backups (PostgreSQL)  
✅ SSL/TLS included  
✅ CDN for checkout portal  

**Your PC can stay off forever.**

## Troubleshooting

### Database Connection Fails

```bash
# Test connection
psql "$DATABASE_URL"

# Or check Vercel logs
vercel logs --tail
```

### Admin Panel Not Loading

```bash
# Check if ADMIN_TOKEN is set
vercel env list | grep ADMIN_TOKEN

# Regenerate if needed
vercel env add ADMIN_TOKEN
```

### Payments Not Receiving Webhooks

```bash
# Check webhook URL in .env
vercel env list | grep WEBHOOK_URL

# Test webhook manually
curl -X POST https://your-webhook-receiver.com \
  -H "X-Gateway-Signature: sha256=test" \
  -d '{"event":"SUCCESS","orderId":"TEST-001"}'
```

### Cold Start Timeout

Vercel functions timeout after 60 seconds. If DB queries are slow:

1. Add indexes to PostgreSQL:
   ```sql
   CREATE INDEX idx_order_id ON payment_sessions(order_id);
   CREATE INDEX idx_merchant_id ON payment_sessions(merchant_id);
   CREATE INDEX idx_status ON payment_sessions(status);
   ```

2. Optimize queries (add `LIMIT` clauses)

3. Consider caching with Redis (add-on)

## Maintenance

### Weekly

- Review payment logs: `vercel logs`
- Check error rates in Vercel Analytics
- Monitor PostgreSQL disk usage

### Monthly

- Rotate secrets
- Review webhook delivery failures
- Backup critical data

### Quarterly

- Load test with 1000+ concurrent payments
- Security audit
- Review compliance with bank requirements

## Next Steps

1. **Enable Banking Observers**: Set up Android APK on your phone
2. **Configure WhatsApp OTP**: Link Baileys/Berry Protocol
3. **Test Full Flow**: Create test payments end-to-end
4. **Go Live**: Switch from test VPA to production UPI account
5. **Monitor Dashboard**: Watch real payments in merchant admin

---

**You now have a production-grade, serverless UPI payment gateway.**  
**No PC required. 24/7 uptime. Zero commission.**