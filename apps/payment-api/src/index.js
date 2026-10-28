import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

// Load .env from project root
if (!process.env.DATABASE_PATH) {
  try {
    const envPath = path.join(rootDir, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = value;
      }
    }
  } catch {}
}

import { initializeDatabase, getDatabase } from './database.js';
import { QueueEngine } from './services/queueEngine.js';
import { AttributionEngine } from './services/attributionEngine.js';
import { WebhookEngine } from './services/webhookEngine.js';
import { OtpService } from './services/otpService.js';

async function startServer() {
  const db = initializeDatabase();

  const queueEngine = new QueueEngine(db);
  const webhookEngine = new WebhookEngine(db);
  const attributionEngine = new AttributionEngine(db, queueEngine, webhookEngine);
  const otpService = new OtpService(db);

  const app = express();
  app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'payment-api', version: '1.0.0' });
  });

  app.get('/api/v1/info', (req, res) => {
    const merchant = db.prepare('SELECT name, vpa, phone FROM merchants WHERE is_active = 1 LIMIT 1').get();
    res.json({ merchant: merchant?.name, vpa: merchant?.vpa, currency: 'INR', gateway: 'MyPG v1.0', zeroCommission: true });
  });

  const routesDir = path.join(__dirname, 'routes');
  if (fs.existsSync(path.join(routesDir, 'payments.routes.js'))) {
    const { registerPaymentRoutes } = await import('./routes/payments.routes.js');
    registerPaymentRoutes(app, queueEngine, attributionEngine);
  }
  if (fs.existsSync(path.join(routesDir, 'observers.routes.js'))) {
    const { registerObserverRoutes } = await import('./routes/observers.routes.js');
    registerObserverRoutes(app, attributionEngine);
  }
  if (fs.existsSync(path.join(routesDir, 'otp.routes.js'))) {
    const { registerOtpRoutes } = await import('./routes/otp.routes.js');
    registerOtpRoutes(app, otpService);
  }

  setInterval(() => {
    const expired = queueEngine.checkExpiredSessions();
    if (expired > 0) console.log(`[Cleanup] Expired ${expired} stale sessions`);
  }, 30000);

  const PORT = parseInt(process.env.PORT_API || '6100', 10);
  app.listen(PORT, () => {
    console.log(`\n🚀 MyPG Payment API running at http://localhost:${PORT}`);
    console.log(`   ✅ 0% Commission — Direct UPI Settlement`);
    console.log(`   ✅ SQLite WAL Database: ${process.env.DATABASE_PATH || './data/my_pg.sqlite'}`);
    console.log(`   ✅ FIFO Queue Engine: Active`);
    console.log(`   ✅ Attribution Engine: Active`);
    console.log(`   ✅ Webhook Engine: Active\n`);
  });
}

startServer().catch(console.error);
