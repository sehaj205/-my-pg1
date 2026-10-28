import crypto from 'node:crypto';
import { getDatabase } from '../database.js';
import { parsePaymentAlert } from '../services/attributionEngine.js';

export function registerObserverRoutes(app, attributionEngine) {

  // Android APK observer endpoint — signed with HMAC-SHA256
  app.post('/api/v1/observers/android', (req, res) => {
    const db = getDatabase();
    const signature = req.headers['x-observer-signature'];
    const secret = process.env.ANDROID_OBSERVER_SECRET;

    if (!signature || !secret) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    const rawBody = JSON.stringify(req.body);
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Anti-replay: reject payloads older than 60 seconds
    const { timestamp, sms_body, notification_body, receiving_vpa, device_id } = req.body;
    if (!timestamp || Math.abs(Date.now() - timestamp) > 60000) {
      return res.status(400).json({ error: 'Payload timestamp out of range' });
    }

    const content = sms_body || notification_body;
    if (!content) {
      return res.status(400).json({ error: 'No content provided' });
    }

    const parsed = parsePaymentAlert(content);
    if (!parsed) {
      return res.status(200).json({ processed: false, reason: 'No payment pattern found' });
    }

    const result = attributionEngine.processObservation({
      source: sms_body ? 'ANDROID_SMS' : 'ANDROID_PUSH',
      sourceDevice: device_id,
      amountPaise: parsed.amountPaise,
      receivingAccount: receiving_vpa || process.env.MERCHANT_VPA,
      utr: parsed.utr,
      rawContent: content,
      observedAt: new Date(timestamp).toISOString()
    });

    return res.status(200).json({ processed: true, matched: result.matched, orderId: result.orderId });
  });

  // Gmail observer endpoint
  app.post('/api/v1/observers/gmail', (req, res) => {
    const { email_subject, email_body, email_from, received_at, receiving_vpa } = req.body;

    if (!email_body) {
      return res.status(400).json({ error: 'No email body provided' });
    }

    const content = `${email_subject || ''} ${email_body}`;
    const parsed = parsePaymentAlert(content);

    if (!parsed) {
      return res.status(200).json({ processed: false, reason: 'No payment pattern found' });
    }

    const result = attributionEngine.processObservation({
      source: 'GMAIL',
      sourceDevice: email_from,
      amountPaise: parsed.amountPaise,
      receivingAccount: receiving_vpa || process.env.MERCHANT_VPA,
      utr: parsed.utr,
      rawContent: content,
      observedAt: received_at || new Date().toISOString()
    });

    return res.status(200).json({ processed: true, matched: result.matched, orderId: result.orderId });
  });

  // SMS observer endpoint (Google Messages Web)
  app.post('/api/v1/observers/sms', (req, res) => {
    const { sms_body, sender, received_at, receiving_vpa } = req.body;

    if (!sms_body) {
      return res.status(400).json({ error: 'No SMS body provided' });
    }

    const parsed = parsePaymentAlert(sms_body);

    if (!parsed) {
      return res.status(200).json({ processed: false, reason: 'No payment pattern found' });
    }

    const result = attributionEngine.processObservation({
      source: 'SMS_WEB',
      sourceDevice: sender,
      amountPaise: parsed.amountPaise,
      receivingAccount: receiving_vpa || process.env.MERCHANT_VPA,
      utr: parsed.utr,
      rawContent: sms_body,
      observedAt: received_at || new Date().toISOString()
    });

    return res.status(200).json({ processed: true, matched: result.matched, orderId: result.orderId });
  });

  // Manual payment verification (admin)
  app.post('/api/v1/observers/manual', (req, res) => {
    const { order_id, utr, amount_paise, receiving_vpa } = req.body;
    const adminToken = req.headers['x-admin-token'];

    if (adminToken !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!order_id || !utr || !amount_paise) {
      return res.status(400).json({ error: 'order_id, utr, and amount_paise are required' });
    }

    const result = attributionEngine.processObservation({
      source: 'MANUAL',
      amountPaise: parseInt(amount_paise, 10),
      receivingAccount: receiving_vpa || process.env.MERCHANT_VPA,
      utr,
      rawContent: `Manual verification: order=${order_id}`,
      observedAt: new Date().toISOString()
    });

    return res.status(200).json({ processed: true, matched: result.matched, orderId: result.orderId });
  });
}
