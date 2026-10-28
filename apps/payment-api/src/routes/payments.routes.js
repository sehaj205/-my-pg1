import { getDatabase } from '../database.js';

export function registerPaymentRoutes(app, queueEngine, attributionEngine) {
  // Create payment session
  app.post('/api/v1/payments/create', (req, res) => {
    const db = getDatabase();
    const { order_id, amount, currency = 'INR', purpose, customer_phone, customer_name, customer_email, metadata } = req.body;
    if (!order_id || !amount) return res.status(400).json({ error: 'order_id and amount are required' });

    const amountPaise = Math.round(parseFloat(amount) * 100);
    if (amountPaise <= 0 || !Number.isFinite(amountPaise)) return res.status(400).json({ error: 'Invalid amount' });

    const existing = db.prepare('SELECT id, status FROM payment_sessions WHERE order_id = ?').get(order_id);
    if (existing) {
      if (existing.status === 'SUCCESS') return res.status(409).json({ error: 'Order already completed' });
      return res.status(409).json({ error: 'Order already exists', sessionId: existing.id });
    }

    const merchant = db.prepare('SELECT id FROM merchants WHERE is_active = 1 LIMIT 1').get();
    if (!merchant) return res.status(500).json({ error: 'No active merchant found' });

    const result = db.prepare(
      `INSERT INTO payment_sessions (order_id, merchant_id, amount_paise, currency, purpose, customer_phone, customer_name, customer_email, metadata, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INITIATED')`
    ).run(order_id, merchant.id, amountPaise, currency, purpose, customer_phone, customer_name, customer_email, JSON.stringify(metadata || {}));

    const checkoutUrl = `${process.env.CHECKOUT_PUBLIC_URL || 'http://localhost:7000'}/checkout?order_id=${order_id}`;
    res.status(201).json({ success: true, sessionId: result.lastInsertRowid, orderId: order_id, amount: (amountPaise / 100).toFixed(2), amountPaise, checkoutUrl, status: 'INITIATED' });
  });

  // Get payment status
  app.get('/api/v1/payments/:orderId/status', (req, res) => {
    const db = getDatabase();
    const session = db.prepare(`
      SELECT ps.*, ra.vpa as receiving_vpa
      FROM payment_sessions ps
      LEFT JOIN receiving_accounts ra ON ra.id = ps.receiving_account_id
      WHERE ps.order_id = ?
    `).get(req.params.orderId);
    if (!session) return res.status(404).json({ error: 'Payment not found' });
    res.json({ orderId: session.order_id, status: session.status, amount: (session.amount_paise / 100).toFixed(2), amountPaise: session.amount_paise, utr: session.utr, queuePosition: session.queue_position, verificationTag: session.verification_tag, verificationLevel: session.verification_level, expiresAt: session.expires_at, activatedAt: session.activated_at, completedAt: session.completed_at, receivingVpa: session.receiving_vpa });
  });

  // Activate payment
  app.post('/api/v1/payments/:orderId/activate', (req, res) => {
    const db = getDatabase();
    const session = db.prepare('SELECT * FROM payment_sessions WHERE order_id = ?').get(req.params.orderId);
    if (!session) return res.status(404).json({ error: 'Payment not found' });
    if (!['INITIATED', 'AUTHENTICATED'].includes(session.status)) return res.status(400).json({ error: `Cannot activate: ${session.status}` });

    const account = db.prepare('SELECT id, vpa FROM receiving_accounts WHERE merchant_id = ? AND is_active = 1 LIMIT 1').get(session.merchant_id);
    if (!account) return res.status(500).json({ error: 'No receiving account available' });

    try {
      const result = queueEngine.acquireSlot(session.id, account.vpa, session.amount_paise);
      const amount = (session.amount_paise / 100).toFixed(2);
      const upiUri = `upi://pay?pa=${account.vpa}&pn=${encodeURIComponent(process.env.MERCHANT_NAME || 'Merchant')}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Order ${session.order_id}`)}`;
      res.json({ success: true, status: result.status, queuePosition: result.queuePosition, upiUri: result.status === 'ACTIVE' ? upiUri : null, vpa: result.status === 'ACTIVE' ? account.vpa : null, amount, orderId: session.order_id, expiresAt: result.status === 'ACTIVE' ? new Date(Date.now() + 300000).toISOString() : null });
    } catch (err) { res.status(500).json({ error: err.message }); }
  });

  // Customer confirms payment done
  app.post('/api/v1/payments/:orderId/confirm', (req, res) => {
    const db = getDatabase();
    const session = db.prepare('SELECT * FROM payment_sessions WHERE order_id = ?').get(req.params.orderId);
    if (!session) return res.status(404).json({ error: 'Payment not found' });
    if (session.status !== 'ACTIVE') return res.status(400).json({ error: `Session is ${session.status}, not ACTIVE` });
    queueEngine.startProcessing(session.id);
    res.json({ success: true, status: 'PROCESSING', message: 'Verifying payment...', processingExpiresAt: new Date(Date.now() + 30000).toISOString() });
  });

  // Cancel payment
  app.post('/api/v1/payments/:orderId/cancel', (req, res) => {
    const db = getDatabase();
    const session = db.prepare('SELECT * FROM payment_sessions WHERE order_id = ?').get(req.params.orderId);
    if (!session) return res.status(404).json({ error: 'Payment not found' });
    if (['SUCCESS', 'CANCELLED'].includes(session.status)) return res.status(400).json({ error: `Cannot cancel: ${session.status}` });
    if (session.receiving_account_id) queueEngine.releaseSlot(session.id);
    db.prepare("UPDATE payment_sessions SET status = 'CANCELLED', completed_at = datetime('now') WHERE id = ?").run(session.id);
    res.json({ success: true, status: 'CANCELLED' });
  });

  // SSE status stream
  app.get('/api/v1/payments/:orderId/stream', (req, res) => {
    const db = getDatabase();
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    res.write('data: {"event":"connected"}\n\n');
    const orderId = req.params.orderId;
    let lastStatus = null;
    const interval = setInterval(() => {
      const session = db.prepare('SELECT status, queue_position, utr, verification_tag, expires_at FROM payment_sessions WHERE order_id = ?').get(orderId);
      if (!session) { clearInterval(interval); res.write('data: {"event":"not_found"}\n\n'); res.end(); return; }
      if (session.status !== lastStatus) {
        lastStatus = session.status;
        res.write(`data: ${JSON.stringify({ event: 'status_change', status: session.status, queuePosition: session.queue_position, utr: session.utr, verificationTag: session.verification_tag, expiresAt: session.expires_at })}\n\n`);
      }
      if (['SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(session.status)) { clearInterval(interval); res.end(); }
    }, 1000);
    req.on('close', () => clearInterval(interval));
  });

  // List payments
  app.get('/api/v1/payments', (req, res) => {
    const db = getDatabase();
    const { status, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM payment_sessions';
    const params = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit, 10), parseInt(offset, 10));
    const sessions = db.prepare(query).all(...params);
    const total = db.prepare('SELECT COUNT(*) as count FROM payment_sessions' + (status ? ' WHERE status = ?' : '')).get(...(status ? [status] : [])).count;
    res.json({ sessions, total, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
  });
}