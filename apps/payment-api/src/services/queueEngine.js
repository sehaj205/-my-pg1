export class QueueEngine {
  constructor(db) {
    this.db = db;
    this.activeTimeoutMs = parseInt(process.env.PAYMENT_ACTIVE_WINDOW_MS, 10) || 300000;
    this.processingTimeoutMs = parseInt(process.env.PAYMENT_PROCESSING_WINDOW_MS, 10) || 30000;
  }

  // Check if a VPA slot is available
  checkSlotAvailability(vpa) {
    const account = this.db.prepare(`
      SELECT id, is_slot_busy FROM receiving_accounts WHERE vpa = ? AND is_active = 1
    `).get(vpa);

    return account ? account.is_slot_busy === 0 : false;
  }

  // Acquire a payment slot for a session
  acquireSlot(sessionId, vpa, amountPaise) {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');

    try {
      const account = this.db.prepare(`
        SELECT id, is_slot_busy FROM receiving_accounts WHERE vpa = ? AND is_active = 1
      `).get(vpa);

      if (!account) {
        this.db.exec('ROLLBACK');
        throw new Error('Receiving account not found or inactive');
      }

      if (account.is_slot_busy === 0) {
        // Slot available - acquire it
        this.db.prepare(`
          UPDATE receiving_accounts SET is_slot_busy = 1 WHERE id = ?
        `).run(account.id);

        this.db.prepare(`
          UPDATE payment_sessions SET
            status = 'ACTIVE',
            receiving_account_id = ?,
            activated_at = datetime('now'),
            expires_at = datetime('now', '+5 minutes')
          WHERE id = ?
        `).run(account.id, sessionId);

        this.db.exec('COMMIT');
        return { success: true, status: 'ACTIVE', queuePosition: null };
      } else {
        // Slot occupied - enqueue
        const queuePos = this.db.prepare(`
          SELECT COALESCE(MAX(queue_position), 0) + 1 AS pos
          FROM payment_sessions
          WHERE receiving_account_id = ? AND status IN ('QUEUED', 'ACTIVE')
        `).get(account.id).pos;

        this.db.prepare(`
          UPDATE payment_sessions SET
            status = 'QUEUED',
            queue_position = ?
          WHERE id = ?
        `).run(queuePos, sessionId);

        this.db.exec('COMMIT');
        return { success: true, status: 'QUEUED', queuePosition: queuePos };
      }
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // Release a slot and promote from queue
  releaseSlot(sessionId) {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION');

    try {
      const session = this.db.prepare(`
        SELECT receiving_account_id FROM payment_sessions WHERE id = ?
      `).get(sessionId);

      if (!session || !session.receiving_account_id) {
        this.db.exec('ROLLBACK');
        return { success: false, message: 'Session not found or no receiving account' };
      }

      // Release the current slot
      this.db.prepare(`
        UPDATE receiving_accounts SET is_slot_busy = 0 WHERE id = ?
      `).run(session.receiving_account_id);

      // Promote next queued session
      const nextSession = this.db.prepare(`
        SELECT id FROM payment_sessions
        WHERE receiving_account_id = ? AND status = 'QUEUED'
        ORDER BY queue_position ASC LIMIT 1
      `).get(session.receiving_account_id);

      if (nextSession) {
        this.db.prepare(`
          UPDATE payment_sessions SET
            status = 'ACTIVE',
            queue_position = NULL,
            activated_at = datetime('now'),
            expires_at = datetime('now', '+5 minutes')
          WHERE id = ?
        `).run(nextSession.id);

        this.db.exec('COMMIT');
        return { success: true, promotedSessionId: nextSession.id };
      } else {
        this.db.exec('COMMIT');
        return { success: true, promotedSessionId: null };
      }
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // Check and expire sessions
  checkExpiredSessions() {
    const expired = this.db.prepare(`
      SELECT id, order_id, status FROM payment_sessions
      WHERE status IN ('ACTIVE', 'QUEUED')
      AND expires_at < datetime('now')
    `).all();

    for (const session of expired) {
      this.releaseSlot(session.id);
      this.db.prepare(`
        UPDATE payment_sessions SET status = 'EXPIRED' WHERE id = ?
      `).run(session.id);
    }

    return expired.length;
  }

  // Get queue status for a VPA
  getQueueStatus(vpa) {
    const account = this.db.prepare(`
      SELECT id, is_slot_busy FROM receiving_accounts WHERE vpa = ?
    `).get(vpa);

    if (!account) return null;

    const queued = this.db.prepare(`
      SELECT COUNT(*) as count FROM payment_sessions
      WHERE receiving_account_id = ? AND status = 'QUEUED'
    `).get(account.id).count;

    return {
      active: account.is_slot_busy === 1,
      queued: queued,
      totalInQueue: queued
    };
  }

  // Start payment processing (customer clicks "Payment Done")
  startProcessing(sessionId) {
    this.db.prepare(`
      UPDATE payment_sessions SET
        status = 'PROCESSING',
        processing_started_at = datetime('now'),
        expires_at = datetime('now', '+30 seconds')
      WHERE id = ?
    `).run(sessionId);

    return { success: true };
  }

  // Complete a payment session
  completeSession(sessionId, utr, amountPaise) {
    this.releaseSlot(sessionId);

    this.db.prepare(`
      UPDATE payment_sessions SET
        status = 'SUCCESS',
        utr = ?,
        completed_at = datetime('now')
      WHERE id = ?
    `).run(utr, sessionId);

    return { success: true, sessionStatus: 'SUCCESS' };
  }

  // Fail a payment session
  failSession(sessionId, reason) {
    this.releaseSlot(sessionId);

    this.db.prepare(`
      UPDATE payment_sessions SET
        status = 'FAILED',
        completed_at = datetime('now'),
        metadata = json_replace(metadata, '$.failure_reason', ?)
      WHERE id = ?
    `).run(reason, sessionId);

    return { success: true, sessionStatus: 'FAILED' };
  }
}