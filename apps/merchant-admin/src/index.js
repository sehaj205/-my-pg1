import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT_ADMIN || '6001', 10);

app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Admin authentication middleware
const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  const adminToken = process.env.ADMIN_TOKEN || 'admin-secret-token';

  if (token !== adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Serve admin portal HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'merchant-admin', timestamp: new Date().toISOString() });
});

// Proxy payments list to API
app.get('/api/v1/payments', adminAuth, async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/payments?${new URLSearchParams(req.query)}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual payment verification
app.post('/api/v1/observers/manual', adminAuth, async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/observers/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': process.env.ADMIN_TOKEN || 'admin-secret-token'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get merchant info
app.get('/api/v1/merchant', adminAuth, async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/info`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate pairing QR for Android observer
app.post('/api/v1/observers/pairing-qr', adminAuth, (req, res) => {
  const secret = crypto.randomBytes(32).toString('hex');
  const timestamp = Date.now();
  const qrData = JSON.stringify({
    type: 'youpi_observer_pairing',
    secret,
    timestamp,
    gateway: process.env.API_PUBLIC_URL || 'http://localhost:6100',
    version: '1.0'
  });

  res.json({
    pairing_id: crypto.randomUUID(),
    secret,
    qr_data: qrData,
    expires_at: new Date(timestamp + 300000).toISOString()
  });
});

// Dashboard stats
app.get('/api/v1/dashboard/stats', adminAuth, async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/payments?limit=1000`);
    const payments = await response.json();

    const stats = {
      total_payments: payments.total,
      success: payments.sessions.filter(p => p.status === 'SUCCESS').length,
      pending: payments.sessions.filter(p => ['ACTIVE', 'PROCESSING'].includes(p.status)).length,
      failed: payments.sessions.filter(p => p.status === 'FAILED').length,
      total_revenue: (payments.sessions
        .filter(p => p.status === 'SUCCESS')
        .reduce((sum, p) => sum + p.amount_paise, 0) / 100).toFixed(2),
      timestamp: new Date().toISOString()
    };

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export payments as CSV
app.get('/api/v1/exports/payments.csv', adminAuth, async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/payments?limit=10000`);
    const payments = await response.json();

    let csv = 'Order ID,Amount,Status,UTR,Queue Position,Created At,Completed At\n';
    payments.sessions.forEach(p => {
      csv += `"${p.order_id}","${(p.amount_paise / 100).toFixed(2)}","${p.status}","${p.utr || ''}",${p.queue_position || 0},"${p.created_at}","${p.completed_at || ''}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="payments-export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n👨‍💼 Merchant Admin running at http://localhost:${PORT}`);
  console.log(`   ✅ API Gateway: ${process.env.API_PUBLIC_URL || 'http://localhost:6100'}`);
  console.log(`   ✅ Admin Token Required: Yes\n`);
});
