#!/bin/bash
# Prabh Game Store - MyPG Deployment Script
# This script automates the entire production deployment

echo "🚀 Prabh Game Store - MyPG Deployment"
echo "======================================"
echo ""
echo "Step 1: Verifying local setup..."
echo ""

# Check if git is initialized
if [ -d ".git" ]; then
  echo "✅ Git repository initialized"
else
  echo "❌ Git not initialized"
  exit 1
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
  echo "✅ Dependencies installed"
else
  echo "⚠️  Installing dependencies..."
  npm install
fi

echo ""
echo "Step 2: Deployment Instructions"
echo "================================"
echo ""
echo "To complete deployment:"
echo ""
echo "1️⃣  Go to: https://github.com/new"
echo "   - Repository name: my-pg"
echo "   - Description: Prabh Game Store - Zero Commission UPI Gateway"
echo "   - Public: ✓"
echo "   - Do NOT initialize with README"
echo ""
echo "2️⃣  After creating, run these commands:"
echo ""
echo "   git remote add origin https://github.com/sehaj205/my-pg.git"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3️⃣  Go to: https://vercel.com/new"
echo "   - Click 'Import Git Repository'"
echo "   - Select: sehaj205/my-pg"
echo "   - Framework: Other"
echo "   - Build Command: npm run build"
echo ""
echo "4️⃣  Add Environment Variables in Vercel:"
echo ""
echo "   DATABASE_URL = (Get from Vercel Postgres or Neon.tech)"
echo "   MERCHANT_NAME = Prabh Game Store"
echo "   MERCHANT_VPA = sehajsingh2611@okaxis"
echo "   MERCHANT_PHONE = 6280692792"
echo "   JWT_SECRET = prabhgamestore2026jwt7k8m9n0p1q2r3s4t5u6v7w8x9y0z1a2b3c4d5e6f"
echo "   WEBHOOK_SECRET = prabhgamestore2026webhook9k8m7n6p5q4r3s2t1u0v9w8x7y6z5a4b3c"
echo "   ADMIN_TOKEN = prabhgamestore2026admin5k6m7n8p9q0r1s2t3u4v5w6x7y8z9a0b1c2d3e"
echo "   ANDROID_OBSERVER_SECRET = prabhgamestore2026android3k4m5n6p7q8r9s0t1u2v3w4x5y6z7a8b"
echo ""
echo "5️⃣  Click 'Deploy'"
echo ""
echo "6️⃣  After deployment (5 min), update URLs:"
echo ""
echo "   CHECKOUT_PUBLIC_URL = https://your-domain.vercel.app"
echo "   ADMIN_PUBLIC_URL = https://your-domain.vercel.app/admin"
echo "   API_PUBLIC_URL = https://your-domain.vercel.app/api"
echo "   WEBHOOK_URL = https://your-domain.vercel.app/api/v1/webhooks/merchant"
echo ""
echo "7️⃣  Access your gateway:"
echo ""
echo "   Checkout: https://your-domain.vercel.app/checkout"
echo "   Admin: https://your-domain.vercel.app/admin (token: prabhgamestore2026admin...)"
echo "   API: https://your-domain.vercel.app/api/v1/*"
echo ""
echo "================================"
echo "All files are ready for deployment!"
echo "================================"
