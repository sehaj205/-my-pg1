import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';

export class WebhookEngine {
  constructor(db) {
    this.db = db;
    this.maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES, 10) || 5;
    this.timeoutMs = parseInt(process.env.WEBHOOK_TIMEOUT_MS, 10) || 10000;
  }

  sign(secret, payload) {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  async dispatch({ orderId, amountPaise, utr, sessionId, verificationTag, verificationLevel }) {
    const merchant = this.db.prepare(`
      SELECT m.webhook_url, m.webhook_secret
      FROM payment_sessions ps
      JOIN merchants m ON m.id = ps.merchant_id
      WHERE ps.id = ?
    `).get(sessionId);

    if (!merchant?.webhook_url) {
      console.log(`[Webhook] No webhook URL configured for session ${sessionId}`);
      return;
    }

    const deliveryId = crypto.randomUUID();
    const timestamp = Date.now();
    const amount = (amountPaise / 100).toFixed(2);

    const payload = JSON.stringify({
      event: 'SUCCESS',
      orderId,
      amount,
      amountPaise,
      utr,
      paymentId: `pay_${sessionId}`,
      deliveryId,
      timestamp,
      verificationTag,
      verificationLevel
    });

    const signature = this.sign(merchant.webhook_secret, payload);
    const signatureV2 = this.sign(merchant.webhook_secret, `${timestamp}.${payload}`);

    await this._deliverWithRetry({
      url: merchant.webhook_url,
      payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-Signature': signature,
        'X-Gateway-Signature-V2': signatureV2,
        'X-Gateway-Event': 'SUCCESS',
        'X-Gateway-Delivery-Id': deliveryId,
        'X-Gateway-Timestamp': String(timestamp)
      },
      attempt: 0,
      deliveryId
    });
  }

  async _deliverWithRetry({ url, payload, headers, attempt, deliveryId }) {
    const backoffMs = Math.min(1000 * Math.pow(2, attempt), 60000);

    try {
      await this._post(url, payload, headers);
      console.log(`[Webhook] Delivered successfully (attempt ${attempt + 1}): ${deliveryId}`);
    } catch (err) {
      console.error(`[Webhook] Delivery failed (attempt ${attempt + 1}): ${err.message}`);
      if (attempt < this.maxRetries) {
        setTimeout(() => {
          this._deliverWithRetry({ url, payload, headers, attempt: attempt + 1, deliveryId });
        }, backoffMs);
      } else {
        console.error(`[Webhook] Gave up after ${this.maxRetries} retries: ${deliveryId}`);
      }
    }
  }

  _post(url, payload, headers) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(payload) },
        timeout: this.timeoutMs
      };

      const req = lib.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.statusCode);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.resume();
      });

      req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
