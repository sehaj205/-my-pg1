import { fetch } from 'node-fetch';

document.addEventListener('DOMContentLoaded', () => {
  const statusIcon = document.getElementById('status-icon');
  const title = document.getElementById('title');
  const amount = document.getElementById('amount');
  const timer = document.getElementById('timer');
  const queue = document.getElementById('queue');
  const qrContainer = document.getElementById('qr-container');
  const instructions = document.getElementById('instructions');
  const payBtn = document.getElementById('pay-btn');
  const statusElement = document.getElementById('status-icon');
  const orderIdElement = document.getElementById('order-id');

  // Initialize with sample order
  const sampleOrder = {
    order_id: 'ORDER-1001',
    amount: 499.00,
    currency: 'INR',
    purpose: 'Pro Subscription Top-Up',
    customer_phone: '+919876543210',
    customer_name: 'Customer Name',
    customer_email: 'customer@example.com'
  };

  // Start checkout process
  async function startCheckout() {
    try {
      // 1. Create payment session via API
      const response = await fetch('https://your-api-domain.com/api/v1/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleOrder)
      });

      const data = await response.json();

      // 2. Update UI with order details
      amount.textContent = `₹${data.amount.toFixed(2)}`;
      title.textContent = `Payment: ${data.orderId}`;

      // 3. Generate dynamic UPI QR code
      const upiUri = `upi://pay?pa=${data.vpa}&pn=${encodeURIComponent(data.merchantName)}&am=${data.amount}&cu=INR&tn=${encodeURIComponent(data.orderId)}`;

      // 4. Generate SVG QR code
      qrContainer.innerHTML = `
        <svg width="150" height="150" viewBox="0 0 150 150" xmlns="http://www.w3.org/2000/svg">
          <rect width="150" height="150" fill="#ffffff" />
          <path d="M15 15 L135 15 L135 135 L15 135 Z" fill="#f0f0f0" />
          <text x="15" y="15" font-size="12" fill="#333">YourBusiness</text>
          <text x="15" y="25" font-size="12" fill="#333">ORDER-1001</text>
          <text x="15" y="35" font-size="12" fill="#333">499.00 INR</text>
        </svg>
      `;

      // 5. Show queue status if available
      if (data.queuePosition !== null) {
        queue.innerHTML = `
          <div>You are in queue position: <strong>${data.queuePosition}</strong></div>
          <div class="timer">Next payment: <span id="next-payment">--</span></div>
        `;
        queue.classList.remove('hidden');

        // Simulate queue updates
        setInterval(() => {
          const newPos = Math.max(1, data.queuePosition - 1);
          queue.innerHTML = `
            <div>You are in queue position: <strong>${newPos}</strong></div>
            <div class="timer">Next payment: <span id="next-payment">${newPos}</span></div>
          `;
        }, 5000);
      } else {
        queue.classList.add('hidden');
      }

      // 6. Show countdown timer
      const expiry = new Date(Date.now() + 300000); // 5 minutes
      const updateTimer = () => {
        const now = new Date();
        const diff = expiry - now;
        if (diff <= 0) {
          timer.textContent = 'Time remaining: EXPIRED';
          payBtn.classList.add('hidden');
          return;
        }
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        timer.textContent = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;

        if (diff < 10000) {
          timer.style.color = '#ef4444';
        }
      };

      updateTimer();
      setInterval(updateTimer, 1000);

      // 7. Show payment instructions
      instructions.innerHTML = `
        <p>Scan this QR code with your UPI app to complete payment</p>
        <p>Payment will expire in 5 minutes</p>
        <p>After payment, you'll see a success screen automatically</p>
      `;

      // 8. Enable payment button
      payBtn.classList.remove('hidden');

    } catch (error) {
      console.error('Checkout failed:', error);
      title.textContent = 'Payment Failed';
      amount.textContent = '₹0.00';
      statusIcon.textContent = '💸';
      instructions.innerHTML = '<p>Error: Failed to create payment session. Please try again.</p>';
      queue.classList.add('hidden');
      payBtn.classList.add('hidden');
    }
  }

  // Handle payment button click
  payBtn.addEventListener('click', () => {
    payBtn.disabled = true;
    payBtn.textContent = 'Processing...';
    // In production, this would trigger actual payment flow
    // For demo, we'll simulate success after 2 seconds
    setTimeout(() => {
      title.textContent = 'Payment Successful!';
      amount.textContent = '₹499.00';
      statusIcon.textContent = '✅';
      timer.textContent = 'Time remaining: --';
      queue.classList.add('hidden');
      payBtn.classList.add('hidden');
      instructions.innerHTML = '<p>Payment confirmed! Your order is being processed.</p>';
    }, 2000);
  });

  // Start the checkout process
  startCheckout();
});