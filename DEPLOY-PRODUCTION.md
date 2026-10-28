# 🚀 PRODUCTION DEPLOYMENT GUIDE
## MyPG - Zero Commission UPI Gateway

Deploy your payment gateway to production in 30 minutes. No PC needed after deployment.

---

## 📋 Pre-Deployment Checklist

### ✅ 1. Create Accounts (Free)

**Vercel Account** (for hosting):
- Visit: https://vercel.com/signup
- Sign up with GitHub
- Free tier: Unlimited deployments

**Vercel Postgres** (for database):
- Free tier: 256 MB storage
- Or use **Neon.tech** (1 GB free): https://neon.tech

**GitHub Account** (for code):
- Visit: https://github.com/signup
- Free unlimited repos

---

## 🔧 STEP 1: Prepare Your Code

### 1.1 Update Environment Variables

Open `.env` and update with YOUR real details:

```bash
# Production Configuration
NODE_ENV=production
DATABASE_URL=postgresql://username:password@host:5432/dbname
USE_POSTGRES=true

# YOUR UPI Details (IMPORTANT!)
MERCHANT_NAME=Your Business Name
MERCHANT_VPA=yourname@upi          # Your REAL UPI ID
MERCHANT_PHONE=9876543210          # Your REAL phone

# Generate Secure Secrets
JWT_SECRET=PUT_RANDOM_32_CHAR_STRING_HERE
WEBHOOK_SECRET=PUT_RANDOM_32_CHAR_STRING_HERE
ADMIN_TOKEN=PUT_RANDOM_32_CHAR_STRING_HERE

# Webhook URL (update after deployment)
WEBHOOK_URL=https://your-domain.vercel.app/api/v1/webhooks/merchant

# Public URLs (update after deployment)
CHECKOUT_PUBLIC_URL=https://your-domain.vercel.app
ADMIN_PUBLIC_URL=https://your-domain.vercel.app/admin
API_PUBLIC_URL=https://your-domain.vercel.app/api

# WhatsApp & Gmail (Optional)
WHATSAPP_ENABLED=false
GMAIL_ENABLED=false

# Android Observer Secret
ANDROID_OBSERVER_SECRET=PUT_RANDOM_32_CHAR_STRING_HERE
```

### 1.2 Generate Secure Secrets

**Option A: Windows PowerShell**
```powershell
# Generate random 32-character string
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

**Option B: Online Tool**
- Visit: https://www.random.org/strings/
- Set length: 32
- Characters: Alphanumeric
- Click "Get Strings"
- Copy and paste into `.env`

---

## 🗄️ STEP 2: Create PostgreSQL Database

### Option A: Vercel Postgres (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Create database
vercel postgres create mypg-production

# Copy the DATABASE_URL shown
# It looks like: postgresql://user:pass@host.vercel-storage.com:5432/verceldb
```

### Option B: Neon.tech (Free 1GB)

1. Visit: https://neon.tech
2. Sign up (free)
3. Create new project: "mypg-production"
4. Copy connection string from dashboard
5. Paste in `.env` as `DATABASE_URL`

### Option C: Supabase (Free 500MB)

1. Visit: https://supabase.com
2. Create account
3. New project → "mypg-production"
4. Settings → Database → Connection string
5. Copy and paste to `.env`

---

## 📦 STEP 3: Push to GitHub

```bash
# Initialize git (if not already done)
cd c:/Users/Perfect/my-pg
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: MyPG payment gateway"

# Create GitHub repo (via website or CLI)
# Visit: https://github.com/new
# Repo name: my-pg
# Public or Private: Your choice
# Do NOT initialize with README

# Add remote
git remote add origin https://github.com/YOUR_USERNAME/my-pg.git

# Push
git branch -M main
git push -u origin main
```

---

## 🌐 STEP 4: Deploy to Vercel

### Method A: Via Vercel Dashboard (Easiest)

1. **Visit**: https://vercel.com/new
2. **Import Git Repository**: Click "Import"
3. **Select**: Your `my-pg` repository
4. **Configure Project**:
   - Framework Preset: Other
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: Leave empty
5. **Environment Variables**: Click "Add"
   - Add all variables from `.env` file ONE BY ONE:
     - `DATABASE_URL` → Your Postgres URL
     - `MERCHANT_NAME` → Your business name
     - `MERCHANT_VPA` → Your UPI ID
     - `JWT_SECRET` → Generated secret
     - `WEBHOOK_SECRET` → Generated secret
     - `ADMIN_TOKEN` → Generated secret
     - ... (add all)
6. **Deploy**: Click "Deploy"
7. **Wait**: 2-3 minutes for deployment

### Method B: Via CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Your account
# - Link to existing project? No
# - Project name? my-pg
# - Directory? ./
# - Override settings? No

# Add environment variables
vercel env add DATABASE_URL
# Paste your PostgreSQL URL

vercel env add MERCHANT_NAME
vercel env add MERCHANT_VPA
vercel env add JWT_SECRET
vercel env add WEBHOOK_SECRET
vercel env add ADMIN_TOKEN
# ... add all from .env

# Deploy to production
vercel --prod
```

---

## ✅ STEP 5: Verify Deployment

After deployment, Vercel gives you a URL like: `https://my-pg-abc123.vercel.app`

### Test APIs:

```bash
# Health check
curl https://your-domain.vercel.app/api/health

# Merchant info
curl https://your-domain.vercel.app/api/v1/info

# Create test payment
curl -X POST https://your-domain.vercel.app/api/v1/payments/create \
  -H "Content-Type: application/json" \
  -d '{"order_id":"TEST-001","amount":10,"customer_phone":"+919999999999"}'
```

### Access Portals:

- **Checkout Portal**: `https://your-domain.vercel.app/checkout`
- **Merchant Admin**: `https://your-domain.vercel.app/admin`
- **Payment API**: `https://your-domain.vercel.app/api/v1/*`

---

## 🔗 STEP 6: Update URLs in Environment

Now that you have your Vercel URL, update these in Vercel dashboard:

1. Go to: `https://vercel.com/your-username/my-pg/settings/environment-variables`
2. Edit these variables:
   - `WEBHOOK_URL` → `https://your-domain.vercel.app/api/v1/webhooks/merchant`
   - `CHECKOUT_PUBLIC_URL` → `https://your-domain.vercel.app`
   - `ADMIN_PUBLIC_URL` → `https://your-domain.vercel.app/admin`
   - `API_PUBLIC_URL` → `https://your-domain.vercel.app/api`
3. Click "Save"
4. Redeploy: `vercel --prod` or click "Redeploy" in dashboard

---

## 💳 STEP 7: Real UPI Configuration

### Update Your UPI Details

1. Open Vercel → Project → Settings → Environment Variables
2. Update:
   - `MERCHANT_VPA` → Your REAL UPI ID (e.g., `9876543210@paytm`)
   - `MERCHANT_NAME` → Your REAL business name
   - `MERCHANT_PHONE` → Your REAL phone number
3. Save and redeploy

### Test with Real Payment (₹1)

```bash
# Create ₹1 test payment
curl -X POST https://your-domain.vercel.app/api/v1/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "order_id":"REAL-TEST-001",
    "amount":1,
    "currency":"INR",
    "customer_phone":"+919999999999",
    "purpose":"Test real payment"
  }'

# Open checkout in browser
# Scan QR with GPay/PhonePe
# Pay ₹1 to your UPI ID
```

---

## 🔒 STEP 8: Security Setup

### 8.1 Enable CORS (if needed)

Already configured in code for production domains.

### 8.2 Setup Webhook Receiver

In your e-commerce website/shop backend:

```javascript
// Example: Node.js/Express webhook receiver
const express = require('express');
const crypto = require('crypto');

app.post('/webhook/mypg', express.raw({ type: 'application/json' }), (req, res) => {
  // Verify signature
  const signature = req.headers['x-gateway-signature'];
  const secret = process.env.MYPG_WEBHOOK_SECRET;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse payload
  const payload = JSON.parse(req.body.toString('utf8'));
  
  if (payload.event === 'SUCCESS') {
    console.log(`✅ Payment received: ${payload.orderId} - ₹${payload.amount}`);
    
    // Mark order as paid in your database
    // Send confirmation email
    // Trigger fulfillment
    
    // Example:
    // await Order.update({ status: 'paid', utr: payload.utr }, { where: { orderId: payload.orderId } });
  }

  res.json({ received: true });
});
```

### 8.3 Protect Admin Panel

Admin panel is protected with `ADMIN_TOKEN`. Share this token only with authorized team members.

---

## 📱 STEP 9: Banking Observers (Optional)

### Android SMS Observer

1. Install APK on Android phone with bank SIM
2. Open admin panel: `https://your-domain.vercel.app/admin`
3. Go to "Observers" section (coming soon in UI)
4. Generate QR code
5. Scan with Android app
6. Grant SMS and notification permissions

### Gmail Observer

1. Get Google OAuth2 credentials from Google Cloud Console
2. Add to Vercel environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
3. Set `GMAIL_ENABLED=true`
4. Redeploy

---

## 🛍️ STEP 10: Integrate with Your Website

### Option A: Simple Button Integration

```html
<!-- Add to your product page -->
<button onclick="payWithMyPG('ORDER-123', 499)">
  Pay ₹499 with UPI
</button>

<script>
async function payWithMyPG(orderId, amount) {
  try {
    // Create payment
    const response = await fetch('https://your-domain.vercel.app/api/v1/payments/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        amount: amount,
        currency: 'INR',
        customer_phone: '+91' + customerPhone,
        purpose: 'Payment for Order ' + orderId
      })
    });

    const data = await response.json();

    if (data.success) {
      // Open checkout in new window
      window.open(data.checkoutUrl, 'MyPG_Checkout', 'width=480,height=720');
      
      // Poll for status
      const interval = setInterval(async () => {
        const statusRes = await fetch(`https://your-domain.vercel.app/api/v1/payments/${orderId}/status`);
        const statusData = await statusRes.json();

        if (statusData.status === 'SUCCESS') {
          clearInterval(interval);
          alert('✅ Payment successful! Order: ' + orderId);
          window.location.reload(); // Refresh page
        }
      }, 3000);
    }
  } catch (error) {
    alert('Payment failed: ' + error.message);
  }
}
</script>
```

### Option B: Checkout Portal Embed (iframe)

```html
<iframe 
  src="https://your-domain.vercel.app/checkout?order_id=ORDER-123&amount=499" 
  width="100%" 
  height="600" 
  frameborder="0">
</iframe>
```

---

## 📊 STEP 11: Monitor Your Gateway

### Vercel Dashboard

- **Deployments**: https://vercel.com/your-username/my-pg/deployments
- **Analytics**: View request counts, response times
- **Logs**: Real-time function logs
- **Metrics**: Database performance

### Admin Panel

- **Dashboard**: Real-time revenue & payment stats
- **Payments**: Filter and search all transactions
- **Export**: Download CSV reports
- **Manual Verify**: Verify payments manually

### API Monitoring

```bash
# Check uptime
curl https://your-domain.vercel.app/api/health

# Check recent payments
curl https://your-domain.vercel.app/api/v1/payments?limit=10
```

---

## 🔄 STEP 12: Update & Maintenance

### Push Updates

```bash
# Make changes to code
git add .
git commit -m "Update: description of changes"
git push origin main

# Vercel auto-deploys on push
# Or manually: vercel --prod
```

### Database Backup

**Vercel Postgres**: Automatic daily backups (paid plan)

**Neon.tech**: 
```bash
# Export database
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Rotate Secrets (Quarterly)

1. Generate new secrets
2. Update in Vercel environment variables
3. Update in webhook receivers
4. Redeploy

---

## 💰 COST BREAKDOWN

### Free Tier (Good for 10-50 payments/day)

| Service | Free Tier | Limit |
|---------|-----------|-------|
| Vercel Hosting | Free | 100 GB bandwidth/month |
| Vercel Postgres | Free | 256 MB storage |
| Neon.tech | Free | 1 GB storage, 3 projects |
| GitHub | Free | Unlimited repos |
| **Total** | **₹0/month** | Perfect for testing |

### Paid (For production business)

| Service | Cost | Use When |
|---------|------|----------|
| Vercel Pro | $20/month | 1000+ payments/day |
| Vercel Postgres | $10-50/month | Need more storage |
| Domain (.com) | ₹800/year | Custom branding |
| **Total** | **~₹2500/month** | Serious business |

**Compare to Razorpay**: 2% per transaction = ₹2000 on ₹1 lakh revenue  
**Your savings**: 0% fees = ₹0 on any revenue!

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] Deployment successful (green ✓ in Vercel)
- [ ] `/api/health` returns 200 OK
- [ ] Checkout portal loads correctly
- [ ] Admin panel accessible with ADMIN_TOKEN
- [ ] Test payment created successfully
- [ ] ₹1 real UPI payment works
- [ ] Webhook receiver configured
- [ ] Admin email/phone updated
- [ ] Secrets are strong (32+ characters)
- [ ] Database backups enabled
- [ ] Team members have admin access

---

## 🆘 TROUBLESHOOTING

### "Database connection failed"

**Solution**: Check `DATABASE_URL` is correct
```bash
# Test connection
psql "$DATABASE_URL" -c "SELECT 1"
```

### "Payment creation fails"

**Solution**: Check Vercel function logs
```bash
vercel logs --follow
```

### "Admin panel not loading"

**Solution**: Check `ADMIN_TOKEN` is set
```bash
vercel env list | grep ADMIN_TOKEN
```

### "Webhook not receiving"

**Solution**: 
1. Check webhook URL is correct
2. Verify HMAC signature in receiver
3. Test with: `curl -X POST your-webhook-url -d '{"test":true}'`

---

## 📞 SUPPORT

**Issues**: Open issue on GitHub  
**Docs**: Read `/README.md` in project  
**Updates**: `git pull origin main` then redeploy

---

## 🎉 YOU'RE LIVE!

Your payment gateway is now running 24/7 on Vercel.

**Your URLs**:
- Checkout: `https://your-domain.vercel.app/checkout`
- Admin: `https://your-domain.vercel.app/admin`
- API: `https://your-domain.vercel.app/api/v1/*`

**Turn off your PC** - gateway keeps running! 🚀

---

**Built with ❤️ | Zero Commission Forever | Self-Hosted Freedom**