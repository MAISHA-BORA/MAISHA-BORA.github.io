// assets/js/donation-form.js - CORRECTED VERSION

document.addEventListener('DOMContentLoaded', function() {
  const donationForm = document.getElementById('donationForm');
  const paymentMethodSelect = document.getElementById('paymentMethod');
  const walletSelector = document.getElementById('walletSelector');
  const billingForm = document.getElementById('billingForm');
  const phoneInput = document.getElementById('donorPhone');

  // Handle payment method changes
  if (paymentMethodSelect) {
    paymentMethodSelect.addEventListener('change', function() {
      handlePaymentMethodChange(this.value);
    });
  }

  // Form submission
  if (donationForm) {
    donationForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      await processDonation();
    });
  }
});

function handlePaymentMethodChange(method) {
  const walletSelector = document.getElementById('walletSelector');
  const billingForm = document.getElementById('billingForm');
  const phoneInput = document.getElementById('donorPhone');

  // Show/hide wallet selection
  if (walletSelector) {
    walletSelector.style.display = method === 'mobile' ? 'block' : 'none';
  }

  // Show/hide billing form
  if (billingForm) {
    billingForm.style.display = method === 'card' ? 'block' : 'none';
    
    // Make billing fields required for card payments
    const billingInputs = billingForm.querySelectorAll('input, select');
    billingInputs.forEach(input => {
      if (method === 'card') {
        input.setAttribute('required', 'required');
      } else {
        input.removeAttribute('required');
      }
    });
  }

  // Phone number validation message
  if (phoneInput) {
    const hint = phoneInput.nextElementSibling;
    if (method === 'mobile') {
      if (!hint || !hint.classList.contains('phone-hint')) {
        const hintEl = document.createElement('small');
        hintEl.className = 'phone-hint';
        hintEl.style.color = '#666';
        hintEl.textContent = 'Enter your Tanzanian mobile number (e.g., 0712345678 or 255712345678)';
        phoneInput.parentNode.insertBefore(hintEl, phoneInput.nextSibling);
      }
    }
  }
}

async function processDonation() {
  const submitButton = document.querySelector('#donationForm button[type="submit"]');
  const originalButtonText = submitButton.textContent;
  
  try {
    // Disable submit button
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';

    // Collect form data
    const formData = collectFormData();

    // Validate
    const validation = validateDonationData(formData);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    console.log('Submitting donation:', {
      amount: formData.amount,
      paymentMethod: formData.paymentMethod,
      currency: formData.currency
    });

    // Call API
    const response = await fetch('/api/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    console.log('API response:', result);

    if (!response.ok || !result.success) {
      throw new Error(result.message || result.error || 'Payment failed');
    }

    // Handle successful response
    handlePaymentResponse(result, formData);

  } catch (error) {
    console.error('Donation error:', error);
    showError(error.message);
    
    // Re-enable button
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
}

function collectFormData() {
  const paymentMethod = document.getElementById('paymentMethod')?.value || 'checkout';
  const walletType = document.getElementById('walletType')?.value || 'mpesa';
  const currency = document.getElementById('currency')?.value || 'TZS';

  const data = {
    // Basic info
    name: document.getElementById('donorName')?.value?.trim(),
    email: document.getElementById('donorEmail')?.value?.trim(),
    phone: document.getElementById('donorPhone')?.value?.trim(),
    
    // Donation details
    amount: parseFloat(document.getElementById('donationAmount')?.value),
    currency: currency,
    donationType: document.getElementById('donationType')?.value || 'General Donation',
    isMonthly: document.getElementById('monthlyDonation')?.checked || false,
    
    // Payment method
    paymentMethod: paymentMethod,
    
    // Additional fields
    receiveUpdates: document.getElementById('receiveUpdates')?.checked || false
  };

  // Add wallet-specific data
  if (paymentMethod === 'mobile') {
    data.walletType = walletType;
    data.msisdn = data.phone; // Mobile payments need msisdn
  }

  // Add billing info for card payments
  if (paymentMethod === 'card') {
    data.billing = {
      address: document.getElementById('billingAddress')?.value?.trim(),
      address2: document.getElementById('billingAddress2')?.value?.trim() || '',
      city: document.getElementById('billingCity')?.value?.trim(),
      state: document.getElementById('billingState')?.value?.trim(),
      postcode: document.getElementById('billingPostcode')?.value?.trim(),
      country: document.getElementById('billingCountry')?.value || 'TZ'
    };
  }

  return data;
}

function validateDonationData(data) {
  // Amount validation
  if (!data.amount || data.amount < 1) {
    return { valid: false, error: 'Please enter a valid donation amount' };
  }

  // Email validation
  if (!data.email || !data.email.includes('@')) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  // Phone validation
  if (!data.phone) {
    return { valid: false, error: 'Phone number is required for payment verification' };
  }

  // Phone format validation for Tanzanian numbers
  const phoneDigits = data.phone.replace(/\D/g, '');
  if (phoneDigits.length < 9 || phoneDigits.length > 12) {
    return { valid: false, error: 'Please enter a valid Tanzanian phone number (9 digits)' };
  }

  // Billing validation for card payments
  if (data.paymentMethod === 'card') {
    if (!data.billing || !data.billing.address || !data.billing.city) {
      return { valid: false, error: 'Billing address is required for card payments' };
    }
  }

  return { valid: true };
}

function handlePaymentResponse(result, formData) {
  console.log('Processing payment response:', result);

  // If there's a payment gateway URL, redirect to it
  if (result.paymentGatewayUrl) {
    console.log('Redirecting to payment gateway...');
    window.location.href = result.paymentGatewayUrl;
    return;
  }

  // For mobile payments, show instructions
  if (formData.paymentMethod === 'mobile') {
    showMobilePaymentInstructions(result, formData);
    return;
  }

  // For other successful payments, redirect to thank you page
  if (result.success) {
    window.location.href = `/donate/thank-you?ref=${result.transactionId}`;
    return;
  }
}

function showMobilePaymentInstructions(result, formData) {
  const modal = document.getElementById('donationModal');
  const modalContent = modal.querySelector('.modal-content');

  const walletNames = {
    'mpesa': 'M-Pesa',
    'airtel': 'Airtel Money',
    'tigo': 'Tigo Pesa',
    'halopesa': 'HaloPesa',
    'ttcl': 'TTCL Pesa'
  };

  const walletName = walletNames[formData.walletType] || 'Mobile Money';

  modalContent.innerHTML = `
    <div class="payment-instructions">
      <div class="icon-success">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      
      <h3>Complete Payment on Your Phone</h3>
      
      <div class="instructions-box">
        <p><strong>Check your ${walletName} app or phone for a payment request</strong></p>
        
        <ol>
          <li>Open the payment notification on your phone</li>
          <li>Enter your ${walletName} PIN</li>
          <li>Confirm the payment of <strong>TZS ${formatCurrency(result.amount)}</strong></li>
        </ol>

        <div class="payment-details">
          <p><strong>Transaction Reference:</strong> ${result.transactionId}</p>
          <p><strong>Amount:</strong> TZS ${formatCurrency(result.amount)}</p>
        </div>

        <p class="note">
          💡 Didn't receive a notification? Check your phone and make sure it's on.
        </p>
      </div>

      <div class="button-group">
        <button onclick="checkPaymentStatus('${result.orderId}')" class="btn btn-primary">
          Check Payment Status
        </button>
        <button onclick="closeModal()" class="btn btn-secondary">
          Cancel
        </button>
      </div>

      <p class="help-text">
        Having trouble? Contact us at donations@maishaborafoundation.org
      </p>
    </div>
  `;
}

async function checkPaymentStatus(orderId) {
  try {
    const response = await fetch(`/api/check-payment?order_id=${orderId}`);
    const result = await response.json();

    console.log('Payment status:', result);

    if (result.data && result.data[0]) {
      const status = result.data[0].payment_status;

      if (status === 'COMPLETED') {
        window.location.href = `/donate/thank-you?ref=${result.reference}`;
      } else if (status === 'PENDING' || status === 'INPROGRESS') {
        showInfo('Payment is still processing. Please wait...');
        setTimeout(() => checkPaymentStatus(orderId), 5000); // Check again in 5 seconds
      } else if (status === 'FAILED' || status === 'CANCELLED') {
        showError('Payment was not completed. Please try again.');
      }
    }
  } catch (error) {
    console.error('Status check error:', error);
    showError('Could not check payment status. Please contact support if you completed the payment.');
  }
}

function showError(message) {
  // Create or update error message element
  let errorEl = document.getElementById('donation-error');
  
  if (!errorEl) {
    errorEl = document.createElement('div');
    errorEl.id = 'donation-error';
    errorEl.className = 'alert alert-error';
    errorEl.style.cssText = 'margin: 20px 0; padding: 15px; background: #fee; border: 1px solid #fcc; border-radius: 4px; color: #c00;';
    
    const form = document.getElementById('donationForm');
    form.parentNode.insertBefore(errorEl, form);
  }

  errorEl.textContent = '❌ ' + message;
  errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Auto-hide after 10 seconds
  setTimeout(() => {
    errorEl.style.display = 'none';
  }, 10000);
}

function showInfo(message) {
  let infoEl = document.getElementById('donation-info');
  
  if (!infoEl) {
    infoEl = document.createElement('div');
    infoEl.id = 'donation-info';
    infoEl.className = 'alert alert-info';
    infoEl.style.cssText = 'margin: 20px 0; padding: 15px; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 4px; color: #1976d2;';
    
    const form = document.getElementById('donationForm');
    form.parentNode.insertBefore(infoEl, form);
  }

  infoEl.textContent = '💡 ' + message;
  infoEl.style.display = 'block';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-TZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

function closeModal() {
  const modal = document.getElementById('donationModal');
  if (modal) {
    modal.style.display = 'none';
  }
}