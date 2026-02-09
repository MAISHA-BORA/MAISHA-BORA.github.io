// api/create-order.js - CORRECTED VERSION
const crypto = require('crypto');
const https = require('https');

module.exports = async (req, res) => {
  // CORS headers
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://maishaborafoundation.org',
    'https://www.maishaborafoundation.org',
    'http://localhost:4000',
    'http://localhost:3000',
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate environment
    validateEnvironment();

    const apiKey = process.env.SELCOM_API_KEY;
    const apiSecret = process.env.SELCOM_API_SECRET;
    const vendor = process.env.SELCOM_VENDOR_ID;

    // Extract and validate request data
    const {
      amount,
      email,
      name,
      phone,
      donationType,
      isMonthly,
      paymentMethod = 'checkout', // 'checkout', 'mobile', 'card'
      currency = 'TZS',
      msisdn,
      walletType = 'mpesa',
      billing
    } = req.body;

    // Validation
    if (!amount || amount < 1) {
      return res.status(400).json({
        error: 'Invalid amount',
        message: 'Please provide a valid donation amount'
      });
    }

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    if (!phone) {
      return res.status(400).json({
        error: 'Missing phone number',
        message: 'Phone number is required for payment verification'
      });
    }

    // Card payments require billing info
    if (paymentMethod === 'card' && (!billing || !billing.address || !billing.city)) {
      return res.status(400).json({
        error: 'Missing billing information',
        message: 'Billing address is required for card payments'
      });
    }

    // Generate IDs
    const timestamp = Date.now();
    const orderId = `MBYF-${timestamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const transactionId = `DON-${timestamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const domain = process.env.NEXT_PUBLIC_DOMAIN || req.headers.origin || 'https://maishaborafoundation.org';

    console.log('Processing donation:', {
      orderId,
      transactionId,
      amount,
      currency,
      paymentMethod,
      walletType
    });

    // Build order data based on payment method
    let apiPath, orderData;

    if (paymentMethod === 'mobile') {
      // Mobile wallet cashin
      apiPath = '/v1/walletcashin/process';
      orderData = buildWalletOrderData({
        vendor,
        vendorPin,
        transactionId,
        amount,
        currency,
        msisdn: msisdn || phone,
        walletType,
        donationType
      });
    } else {
      // Default: Checkout API (supports cards and mobile)
      apiPath = '/v1/checkout/create-order-minimal';
      orderData = buildCheckoutOrderData({
        vendor,
        orderId,
        transactionId,
        amount,
        currency,
        email,
        name,
        phone,
        donationType,
        isMonthly,
        billing,
        domain
      });
    }

    // Generate authentication signature
    const timestamp_sig = getSelcomTimestamp();
    const { signature, signedFields } = generateSignature(orderData, apiSecret, timestamp_sig);

    console.log('Request details:', {
      apiPath,
      orderId,
      amount,
      signedFields
    });

    // Make request to Selcom
    const response = await makeSelcomRequest(apiPath, orderData, {
      apiKey,
      signature,
      timestamp: timestamp_sig,
      signedFields
    });

    console.log('Selcom response:', {
      result: response?.result,
      resultcode: response?.resultcode,
      message: response?.message?.substring(0, 100)
    });

    if (!response || (response.result !== 'SUCCESS' && response.result !== 'PENDING')) {
      throw new Error(response?.message || 'Payment gateway error');
    }

    // Process response
    const paymentData = response.data?.[0] || response.data || {};

    const result = {
      success: true,
      orderId,
      transactionId: response.reference || transactionId,
      amount,
      currency,
      paymentMethod,
      resultcode: response.resultcode,
      result: response.result,
      message: response.message,
      timestamp: new Date().toISOString()
    };

    // Add payment-specific data
    if (apiPath.includes('/checkout/')) {
      result.paymentGatewayUrl = paymentData?.payment_gateway_url
        ? Buffer.from(paymentData.payment_gateway_url, 'base64').toString()
        : null;
      result.qrCode = paymentData?.qr || null;
      result.paymentToken = paymentData?.payment_token;
    } else if (apiPath.includes('/walletcashin/')) {
      result.reference = response.reference;
      result.walletType = walletType;
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Payment error:', {
      message: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      error: 'Payment processing failed',
      message: error.message || 'Please try again or contact support',
      reference: `ERR-${Date.now()}`
    });
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function validateEnvironment() {
  const required = [
    'SELCOM_API_KEY',
    'SELCOM_API_SECRET',
    'SELCOM_VENDOR_ID',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  if (process.env.SELCOM_API_KEY.length < 20) {
    throw new Error('SELCOM_API_KEY appears invalid');
  }
}

function getSelcomTimestamp() {
  // Get current time in EAT (UTC+3)
  const now = new Date();
  const eatTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));

  const year = eatTime.getUTCFullYear();
  const month = String(eatTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(eatTime.getUTCDate()).padStart(2, '0');
  const hours = String(eatTime.getUTCHours()).padStart(2, '0');
  const minutes = String(eatTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(eatTime.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
}

function generateSignature(orderData, apiSecret, timestamp) {
  // CRITICAL FIX: Proper signature generation
  // 1. Sort the fields
  const sortedKeys = Object.keys(orderData).sort();
  const signedFields = sortedKeys.join(',');

  // 2. Build the signature string
  // Format: timestamp=2019-02-26T09:30:46+03:00&field1=value1&field2=value2...
  const fieldPairs = sortedKeys.map(key => {
    const value = orderData[key];

    // Handle nested objects (billing, shipping)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // For nested objects, we need to flatten them
      return Object.keys(value)
        .sort()
        .map(subKey => `${key}.${subKey}=${value[subKey]}`)
        .join('&');
    }

    return `${key}=${value}`;
  });

  const dataString = `timestamp=${timestamp}&${fieldPairs.join('&')}`;

  console.log('Signature data:', {
    signedFields,
    dataLength: dataString.length,
    sample: dataString.substring(0, 150)
  });

  // 3. Generate HMAC SHA256 signature
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(dataString)
    .digest('base64');

  return { signature, signedFields };
}

async function makeSelcomRequest(path, data, auth) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);

    const options = {
      hostname: 'apigw.selcommobile.com',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'application/json',
        'Authorization': `SELCOM ${Buffer.from(auth.apiKey).toString('base64')}`,
        'Digest-Method': 'HS256',
        'Digest': auth.signature,
        'Timestamp': auth.timestamp,
        'Signed-Fields': auth.signedFields
      }
    };

    console.log('Selcom request:', {
      path,
      method: 'POST',
      timestamp: options.headers.Timestamp,
      signedFields: options.headers['Signed-Fields']
    });

    const req = https.request(options, (response) => {
      let body = '';

      response.on('data', (chunk) => {
        body += chunk;
      });

      response.on('end', () => {
        console.log('Selcom raw response:', {
          status: response.statusCode,
          body: body.substring(0, 500)
        });

        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          console.error('JSON parse error:', e.message);
          reject(new Error(`Invalid response from Selcom: ${body.substring(0, 200)}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Request error:', error);
      reject(new Error(`Selcom connection failed: ${error.message}`));
    });

    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Selcom API timeout (30s)'));
    });

    req.write(postData);
    req.end();
  });
}

function formatPhoneNumber(phone) {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  let cleaned = phone.toString().replace(/\D/g, '');

  // Remove leading zeros
  cleaned = cleaned.replace(/^0+/, '');

  // Add Tanzania country code if missing
  if (!cleaned.startsWith('255')) {
    // If it's a 9-digit TZ number
    if (cleaned.length === 9) {
      cleaned = '255' + cleaned;
    } else {
      throw new Error('Invalid phone number format');
    }
  }

  // Validate: must be 255 + 9 digits = 12 total
  if (cleaned.length !== 12) {
    throw new Error(`Invalid Tanzanian phone number. Expected 12 digits (255 + 9), got ${cleaned.length}`);
  }

  // Validate the mobile prefix (6, 7)
  const prefix = cleaned.charAt(3);
  if (prefix !== '6' && prefix !== '7') {
    throw new Error('Invalid Tanzanian mobile number. Must start with 06 or 07 after country code.');
  }

  return cleaned;
}

function formatAmount(amount, currency) {
  // Selcom expects amounts in TZS
  if (currency === 'USD') {
    // Approximate conversion: 1 USD = 2500 TZS
    return Math.round(amount * 2500);
  }
  if (currency === 'EUR') {
    return Math.round(amount * 2700);
  }
  if (currency === 'GBP') {
    return Math.round(amount * 3200);
  }
  return Math.round(amount);
}

function buildCheckoutOrderData(params) {
  const {
    vendor,
    orderId,
    transactionId,
    amount,
    currency,
    email,
    name,
    phone,
    donationType,
    isMonthly,
    billing,
    domain
  } = params;

  const amountInTzs = formatAmount(amount, currency);
  const formattedPhone = formatPhoneNumber(phone);

  const orderData = {
    vendor: vendor,
    order_id: orderId,
    buyer_email: email.trim().toLowerCase(),
    buyer_name: name?.trim() || 'Anonymous Donor',
    buyer_phone: formattedPhone,
    amount: amountInTzs,
    currency: 'TZS',
    webhook: Buffer.from(`${domain}/api/selcom-webhook`).toString('base64'),
    buyer_remarks: `Donation: ${donationType || 'General'}${isMonthly ? ' (Monthly)' : ''}`,
    merchant_remarks: `MBYF Donation - ${transactionId}`,
    no_of_items: 1
  };

  // Add optional redirect URLs
  if (domain) {
    orderData.redirect_url = Buffer.from(`${domain}/donate/thank-you?ref=${transactionId}`).toString('base64');
    orderData.cancel_url = Buffer.from(`${domain}/donate?cancelled=true`).toString('base64');
  }

  return orderData;
}

function buildWalletOrderData(params) {
  const {
    vendor,
    vendorPin,
    transactionId,
    amount,
    currency,
    msisdn,
    walletType,
    donationType
  } = params;

  const amountInTzs = formatAmount(amount, currency);
  const formattedPhone = formatPhoneNumber(msisdn);

  // Map wallet types to utility codes
  const walletCodes = {
    'mpesa': 'VMCASHIN',
    'airtel': 'AMCASHIN',
    'tigo': 'TPCASHIN',
    'halopesa': 'HPCASHIN',
    'ttcl': 'TTCASHIN'
  };

  const utilitycode = walletCodes[walletType] || 'VMCASHIN';

  return {
    transid: transactionId,
    utilitycode: utilitycode,
    utilityref: formattedPhone,
    amount: amountInTzs,
    vendor: vendor,
    pin: vendorPin,
    msisdn: formattedPhone
  };
}

