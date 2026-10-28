export class OtpService {
  constructor(db) {
    this.db = db;
    this.otpLength = 6;
    this.expiryMinutes = 10;
  }

  generateOTP(phone) {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + this.expiryMinutes * 60 * 1000).toISOString();

    this.db.prepare(`
      INSERT OR REPLACE INTO otp_verifications (phone, otp, expires_at, attempts, verified)
      VALUES (?, ?, ?, 0, 0)
    `).run(phone, otp, expiresAt);

    return { otp, expiresAt };
  }

  verifyOTP(phone, otp) {
    const record = this.db.prepare(`
      SELECT * FROM otp_verifications
      WHERE phone = ? AND otp = ? AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(phone, otp);

    if (!record) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    if (record.verified) {
      return { success: false, message: 'OTP already used' };
    }

    if (record.attempts >= 3) {
      return { success: false, message: 'Too many attempts' };
    }

    this.db.prepare('UPDATE otp_verifications SET verified = 1, attempts = attempts + 1 WHERE id = ?').run(record.id);

    return { success: true, message: 'OTP verified' };
  }

  sendOTPTOWhatsApp(phone, otp) {
    console.log(`[WhatsApp OTP] Sending OTP ${otp} to ${phone}`);
    console.log(`[WhatsApp OTP] This would send the OTP via WhatsApp in production`);
    return { sent: true, phone, otp };
  }

  sendOTPSMS(phone, otp) {
    console.log(`[SMS OTP] Sending OTP ${otp} to ${phone}`);
    return { sent: true, phone, otp };
  }

  verifyCustomer(phone, name = null, email = null) {
    const existing = this.db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);

    if (existing) {
      this.db.prepare('UPDATE customers SET last_seen_at = datetime("now") WHERE id = ?').run(existing.id);
      return existing;
    }

    const result = this.db.prepare(`
      INSERT INTO customers (phone, name, email, is_verified)
      VALUES (?, ?, ?, 1)
    `).run(phone, name, email);

    return { id: result.lastInsertRowid, phone, name, email, is_verified: 1 };
  }
}