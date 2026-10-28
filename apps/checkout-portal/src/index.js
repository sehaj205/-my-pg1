import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT_CHECKOUT || '7000', 10);

app.use(cors({ origin: '*' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Serve checkout portal HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Checkout page with order query params
app.get('/checkout', (req, res) => {
  const { order_id, amount, currency = 'INR', purpose } = req.query;
  res.json({
    status: 'ok',
    orderId: order_id,
    amount: parseFloat(amount),
    currency,
    purpose,
    checkoutUrl: `${process.env.CHECKOUT_PUBLIC_URL || 'http://localhost:7000'}/checkout?order_id=${order_id}`
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'checkout-portal', timestamp: new Date().toISOString() });
});

// API proxy to payment-api
app.post('/api/v1/payments/create', async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/payments/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/v1/payments/:orderId/status', async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/payments/${req.params.orderId}/status`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/payments/:orderId/activate', async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/payments/${req.params.orderId}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/v1/payments/:orderId/confirm', async (req, res) => {
  try {
    const apiUrl = process.env.API_PUBLIC_URL || 'http://localhost:6100';
    const response = await fetch(`${apiUrl}/api/v1/payments/${req.params.orderId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n🛒 Checkout Portal running at http://localhost:${PORT}`);
  console.log(`   ✅ API Gateway: ${process.env.API_PUBLIC_URL || 'http://localhost:6100'}\n`);
});
