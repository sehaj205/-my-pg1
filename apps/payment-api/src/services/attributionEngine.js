import crypto from 'node:crypto';

// Parse bank SMS/email for credit alerts
const BANK_PATTERNS = [
  // HDFC Bank
  { bank: 'HDFC', regex: /(?:credited|received|cr)\s+(?:rs\.?|inr\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:to|in|into)?.*?(?:utr|ref|neft|imps)[\s:#]*([0-9]{12,22})/i },
  { bank: 'HDFC', regex: /(?:rs\.?|inr\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s+(?:credited|received|cr)\s+(?:to|in).*?(?:utr|ref)[\s:#]*([0-9]{12,22})/i },
  // ICICI Bank
  { bank: 'ICICI', regex: /(?:acct|a\/c).*?(?:credited|cr).*?(?:rs\.?|inr\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?).*?(?:utr|ref)[\s:#]*([0-9]{12,22})/i },
  // SBI
  { bank: 'SBI', regex: /(?:credited|received)\s+(?:rs\.?|inr\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?).*?(?:utr|ref|txn)[\s:#]*([0-9]{12,22})/i },
  // Axis Bank
  { bank: 'Axis', regex: /(?:credited|received|cr)\s*(?:rs\.?|inr\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?).*?(?:utr|ref)[\s:#]*([0-9]{12,22})/i },
  // Kotak
  { bank: 'Kotak', regex: /(?:credited|received)\s*(?:rs\.?|inr\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?).*?(?:utr|ref)[\s:#]*([0-9]{12,22})/i },
  // Generic UPI credit
  { bank: 'UPI', regex: /(?:upi|pay).*?(?:credited|received|cr)\s*(?:rs\.?|inr\.?|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?).*?(?:utr|ref)[\s:#]*([0-9]{12,22})/i },
  // Generic: Amount credited + UTR
  { bank: 'GENERIC', regex: /(?:rs\.?|inr\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?).*?(?:credited|cr)\b.*?(?:utr|ref|txn)[\s:#]*([0-9a-z]{8,22})/i },
];

export function parsePaymentAlert(text) {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, ' ').trim();

  for (const { bank, regex } of BANK_PATTERNS) {
    const match = normalized.match(regex);
    if (match) {
      const rawAmount = match[1].replace(/,/g, '');
      const amount = parseFloat(rawAmount);
      const utr = match[2];
      if (!isNaN(amount) && amount > 0 && utr) {
        return { bank, amount, amountPaise: Math.round(amount * 100), utr: utr.trim(), raw: normalized };
      }
    }
  }

  return null;
}

export class AttributionEngine {
  constructor(db, queueEngine, webhookEngine) {
    this.db = db;
    this.queueEngine = queueEngine;
    this.webhookEngine = webhookEngine;
    this.recentObservations = new Map(); // fingerprint → timestamp (in-memory dedup)
  }

  // Compute dedup fingerprint for an observation
  computeFingerprint(amountPaise, receivingAccount, utr, source) {
    const raw = `${receivingAccount}:${amountPaise}:${utr}:${source}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  // Process an incoming observation (SMS, Gmail, Android)
  processObservation({ source, sourceDevice, amountPaise, receivingAccount, utr, senderVpa, rawContent, observedAt }) {
    // 1. Compute dedup fingerprint
    const fingerprint = this.computeFingerprint(amountPaise, receivingAccount, utr, source);

    // 2. Check in-memory dedup first (fast path)
    if (this.recentObservations.has(fingerprint)) {
      console.log(`[Attribution] Duplicate observation skipped: ${fingerprint}`);
      return { success: false, reason: 'DUPLICATE', fingerprint };
    }

    // 3. Check DB dedup
    const existingObs = this.db.prepare('SELECT id FROM observations WHERE fingerprint = ?').get(fingerprint);
    if (existingObs) {
      this.recentObservations.set(fingerprint, Date.now());
      return { success: false, reason: 'DUPLICATE', fingerprint };
    }

    // 4. Find matching ACTIVE/PROCESSING payment session
    const account = this.db.prepare(`
      SELECT id FROM receiving_accounts WHERE vpa = ? OR id = ?
    `).get(receivingAccount, 0);

    const session = this.db.prepare(`
      SELECT ps.* FROM payment_sessions ps
      JOIN receiving_accounts ra ON ra.id = ps.receiving_account_id
      WHERE ps.status IN ('ACTIVE', 'PROCESSING')
        AND ps.amount_paise = ?
        AND (ra.vpa = ? OR ps.receiving_account_id = ?)
      ORDER BY ps.activated_at ASC LIMIT 1
    `).get(amountPaise, receivingAccount, account?.id || 0);

    // 5. Record observation
    const obsResult = this.db.prepare(`
      INSERT OR IGNORE INTO observations
        (session_id, source, source_device, amount_paise, receiving_account, utr, sender_vpa, raw_content, observed_at, fingerprint)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      session?.id || null,
      source,
      sourceDevice || null,
      amountPaise,
      receivingAccount,
      utr,
      senderVpa || null,
      rawContent,
      observedAt || new Date().toISOString(),
      fingerprint
    );

    // Remember in-memory
    this.recentObservations.set(fingerprint, Date.now());
    // Prune old entries (keep last 1000)
    if (this.recentObservations.size > 1000) {
      const oldest = this.recentObservations.keys().next().value;
      this.recentObservations.delete(oldest);
    }

    if (!session) {
      console.log(`[Attribution] No matching session found for amount ${amountPaise} paise on ${receivingAccount}`);
      return { success: true, matched: false, fingerprint, obsId: obsResult.lastInsertRowid };
    }

    // 6. Determine verification level (how many sources have confirmed)
    const priorObs = this.db.prepare(`
      SELECT COUNT(DISTINCT source) as count FROM observations
      WHERE session_id = ? AND utr = ?
    `).get(session.id, utr).count;

    const verificationLevel = Math.min(priorObs, 3);
    const verificationTag = priorObs >= 3 ? 'L3_TRIPLE' : priorObs === 2 ? 'L2_DUAL' : 'L1_SINGLE';

    // 7. Mark session as SUCCESS
    this.db.prepare(`
      UPDATE payment_sessions SET
        status = 'SUCCESS',
        utr = ?,
        verification_tag = ?,
        verification_level = ?,
        completed_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(utr, verificationTag, verificationLevel, session.id);

    // 8. Release slot and promote queue
    this.queueEngine.releaseSlot(session.id);

    // 9. Dispatch webhook
    this.webhookEngine.dispatch({
      orderId: session.order_id,
      amountPaise: session.amount_paise,
      utr,
      sessionId: session.id,
      verificationTag,
      verificationLevel
    });

    console.log(`[Attribution] Payment confirmed: order=${session.order_id} utr=${utr} level=${verificationTag}`);

    return {
      success: true,
      matched: true,
      sessionId: session.id,
      orderId: session.order_id,
      fingerprint,
      verificationTag,
      verificationLevel
    };
  }
}