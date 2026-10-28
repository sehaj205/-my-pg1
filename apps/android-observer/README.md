# YOUPI SMS Observer for Android

A lightweight, battery-optimized Android foreground service that captures banking SMS and notifications to verify UPI payments cryptographically.

## Features

- Intercepts `android.provider.Telephony.SMS_RECEIVED` broadcasts
- Listens to bank push notifications via `NotificationListenerService`
- Secure pairing via ephemeral QR code
- HMAC-SHA256 signed payloads for integrity
- Anti-replay protection (60-second timestamp window)
- Minimal battery usage (foreground service with wake lock)
- Works with any bank's UPI notifications

## Installation

1. Install this APK on any Android phone with your bank SIM
2. Scan the pairing QR code from Merchant Admin panel
3. Grant SMS and Notification permissions
4. Enable "Battery Optimization" exemption for this app
5. Watch for payment alerts in Merchant Admin

## Technical Details

- **Package Name:** `com.youpi.observer`
- **Permissions:** 
  - RECEIVE_SMS
  - FOREGROUND_SERVICE
  - BIND_NOTIFICATION_LISTENER_SERVICE
  - ACCESS_FINE_LOCATION (for QR scanning)
- **HMAC Secret:** Derived from pairing QR code
- **Server Endpoint:** `POST /api/v1/observers/android`
- **Signature Header:** `X-Observer-Signature: sha256=<hash>`

## Security

- All payloads signed with HMAC-SHA256
- Timestamps must be within 60 seconds of server time
- Content must match bank notification patterns
- Device ID included for anti-spoofing

## Development

For development, you can use the provided android-observer directory with:
- Manifest file
- Java/Kotlin source
- Build scripts

## Testing

Use the Android test app to verify:
1. SMS reception
2. Notification listening
3. HMAC signature generation
4. Payload format

## Compliance

This app is designed for personal payment verification only.
Not a banking application.
Does not store sensitive financial data.
Complies with Android app store requirements.

## QR Pairing Flow

1. Merchant Admin generates QR code with secret key
2. User scans QR with Android app
3. App extracts secret and initializes HMAC signer
4. All future payloads are signed with this secret

## Battery Optimization

Enable "Don't optimize" for this app in Android settings to ensure:
- Foreground service continues running
- SMS notifications are captured immediately
- No battery optimization throttling

## Security Best Practices

- Never share the pairing QR code
- Rotate the pairing secret periodically
- Use dedicated device for payment verification
- Monitor app logs for suspicious activity

This service is designed to work with YouPI PG's payment gateway to verify UPI payments cryptographically without expensive banking APIs.