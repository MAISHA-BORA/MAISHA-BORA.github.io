// api/create-order.js
const crypto = require('crypto');
const https = require('https');

module.exports = async (req, res) => {
  // CORS headers (keep existing)
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
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed'
    });
  }
  
  try {
    // Get environment variables
    const apiKey = process.env.SELCOM_API_KEY;
    const apiSecret = process.env.SELCOM_API_SECRET;
    const vendor = process.env.SELCOM_VENDOR_ID;
    const vendorPin = process.env.SELCOM_VENDOR_PIN; // Added for wallet payments
    
    if (!apiKey || !apiSecret || !vendor || !vendorPin) {
      console.error('Missing Selcom credentials');
      return res.status(503).json({
        error: 'Payment service temporarily unavailable',
        message: 'Please try again later or contact support'
      });
    }
    
    // Validate input
    const { 
      amount, 
      email, 
      name, 
      phone, 
      donationType, 
      isMonthly,
      paymentMethod = 'mobile', // 'card', 'mobile', 'selcompesa', 'bank'
      currency = 'TZS', // Default to TZS
      msisdn, // For mobile payments
      walletType, // For specific wallet: 'mpesa', 'airtel', 'tigo', 'halopesa'
      billing       // For card payments
    } = req.body;
    
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
    
    // Generate IDs
    const timestamp = Date.now();
    const orderId = `MBYF-${timestamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const transactionId = `DON-${timestamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Get domain
    const domain = process.env.NEXT_PUBLIC_DOMAIN || req.headers.origin || 'https://maishaborafoundation.org';
    
    // Determine which API to use based on payment method
    let apiPath, orderData, requiresAuth = true;
    
    if (paymentMethod === 'card') {
      // CARD PAYMENTS - Use Checkout API
      apiPath = '/v1/checkout/create-order';
      orderData = await buildCardOrderData({
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
      
    } else if (paymentMethod === 'mobile' || paymentMethod === 'selcompesa') {
      // MOBILE MONEY PAYMENTS - Use specific wallet APIs
      const walletConfig = getWalletConfig(walletType || 'mpesa');
      
      if (paymentMethod === 'mobile') {
        // Mobile money push payment
        apiPath = '/v1/wallet/pushussd';
        orderData = buildWalletOrderData({
          vendor,
          vendorPin,
          transactionId,
          amount,
          currency,
          msisdn: msisdn || phone,
          walletConfig,
          donationType
        });
        
      } else if (paymentMethod === 'selcompesa') {
        // Selcom Pesa specific API
        apiPath = '/v1/selcompesa/cashin';
        orderData = buildSelcomPesaOrderData({
          vendor,
          vendorPin,
          transactionId,
          amount,
          currency,
          msisdn: msisdn || phone,
          donationType
        });
      }
      
    } else if (paymentMethod === 'bank') {
      // BANK TRANSFER - Use Qwiksend API
      apiPath = '/v1/qwiksend/process';
      orderData = buildBankOrderData({
        vendor,
        vendorPin,
        transactionId,
        amount,
        currency,
        email,
        name,
        phone,
        donationType
      });
      
    } else {
      // DEFAULT: Minimal checkout for general mobile payments
      apiPath = '/v1/checkout/create-order-minimal';
      orderData = buildMinimalOrderData({
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
        domain
      });
    }
    
    console.log('Creating order:', { 
      apiPath,
      orderId,
      transactionId,
      amount,
      currency,
      paymentMethod,
      walletType
    });
    
    // Create authorization signature
    const timestamp_sig = getSelcomTimestamp();
    
    // Prepare data for the signature
    const dataToSign = {
      timestamp: timestamp_sig,
      ...orderData
    };
    
    // Create signature
    const signedFields = Object.keys(orderData).sort().join(',');
    const queryString = Object.keys(dataToSign)
      .sort()
      .map(key => `${key}=${dataToSign[key]}`)
      .join('&');
    
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('base64');
    
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
      message: response?.message
    });
    
    if (!response || (response.result !== 'SUCCESS' && response.result !== 'PENDING')) {
      throw new Error(response?.message || 'Payment gateway error');
    }
    
    // Process response based on API type
    const paymentData = response.data?.[0] || response.data || {};
    
    let result = {
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
    
    // Add specific response data based on API
    if (apiPath.includes('/checkout/')) {
      result.paymentGatewayUrl = paymentData?.payment_gateway_url ? 
        Buffer.from(paymentData.payment_gateway_url, 'base64').toString() : null;
      result.qrCode = paymentData?.qr || null;
      result.paymentToken = paymentData?.payment_token;
      result.gatewayBuyerUuid = paymentData?.gateway_buyer_uuid;
    } else if (apiPath.includes('/wallet/') || apiPath.includes('/selcompesa/')) {
      // For wallet payments, we need to trigger USSD push
      result.reference = response.reference;
      result.requiresPush = true;
    } else if (apiPath.includes('/qwiksend/')) {
      result.bankReference = response.reference;
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

// Helper Functions

function getSelcomTimestamp() {
  const now = new Date();
  const adjustedTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
  
  const year = adjustedTime.getUTCFullYear();
  const month = String(adjustedTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(adjustedTime.getUTCDate()).padStart(2, '0');
  const hours = String(adjustedTime.getUTCHours()).padStart(2, '0');
  const minutes = String(adjustedTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(adjustedTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
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
    
    // Debug logging
    console.log('Selcom Request:', {
      path,
      headers: {
        Authorization: options.headers.Authorization.substring(0, 30) + '...',
        Timestamp: options.headers.Timestamp,
        'Signed-Fields': options.headers['Signed-Fields']
      },
      data: path.includes('/checkout/') ? '*** CHECKOUT DATA ***' : data
    });
    
    const req = https.request(options, (response) => {
      let body = '';
      
      console.log('Selcom Response Status:', response.statusCode);
      
      response.on('data', (chunk) => {
        body += chunk;
      });
      
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          console.log('Selcom Response:', parsed);
          resolve(parsed);
        } catch (e) {
          console.error('Selcom Parse Error:', body);
          reject(new Error(`Invalid response from Selcom: ${body.substring(0, 200)}`));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Selcom Request Error:', error);
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
  if (!phone) return '255000000000';
  let cleaned = phone.toString().replace(/\D/g, '');
  if (!cleaned.startsWith('255') && cleaned.length <= 9) {
    cleaned = '255' + cleaned;
  }
  return cleaned.length >= 10 && cleaned.length <= 13 ? cleaned : '255000000000';
}

function formatAmount(amount, currency) {
  // Selcom expects TZS, convert if needed
  if (currency === 'USD') {
    // Convert USD to TZS (approximate rate)
    return Math.round(amount * 2500);
  }
  return Math.round(amount);
}

// Wallet configuration mapping
function getWalletConfig(walletType) {
  const wallets = {
    'mpesa': {
      utilitycode: 'MPESA-TZ',
      name: 'M-Pesa'
    },
    'airtel': {
      utilitycode: 'AIRTELMONEY',
      name: 'Airtel Money'
    },
    'tigo': {
      utilitycode: 'TIGOPESATZ',
      name: 'Tigo Pesa'
    },
    'halopesa': {
      utilitycode: 'HALOPESATZ',
      name: 'HaloPesa'
    },
    'ttcl': {
      utilitycode: 'TTCLMOBILE',
      name: 'TTCL Pesa'
    }
  };
  
  return wallets[walletType] || wallets.mpesa;
}

// Build order data for different payment methods

function buildCardOrderData(params) {
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
  
  return {
    vendor: vendor,
    order_id: orderId,
    buyer_email: email.trim().toLowerCase(),
    buyer_name: name?.trim() || 'Anonymous Donor',
    buyer_user_id: email.split('@')[0], // Simple user ID
    buyer_phone: formatPhoneNumber(phone),
    gateway_buyer_uuid: `mb-${email.split('@')[0]}-${Date.now()}`, // For stored cards
    amount: amountInTzs,
    currency: 'TZS', // Selcom Checkout uses TZS
    payment_methods: 'ALL', // ALL, CARD, MOBILEMONEYPULL, MASTERPASS
    redirect_url: Buffer.from(`${domain}/donate/thank-you?ref=${transactionId}`).toString('base64'),
    cancel_url: Buffer.from(`${domain}/donate?cancelled=true`).toString('base64'),
    webhook: Buffer.from(`${domain}/api/selcom-webhook`).toString('base64'),
    transid: transactionId,
    
    // Billing info (required for card payments)
    billing: {
      firstname: name?.split(' ')[0] || 'Donor',
      lastname: name?.split(' ').slice(1).join(' ') || 'Anonymous',
      address_1: billing?.address || 'Karatu District',
      address_2: billing?.address2 || '',
      city: billing?.city || 'Karatu',
      state_or_region: billing?.state || 'Arusha',
      postcode_or_pobox: billing?.postcode || '00000',
      country: billing?.country || 'TZ',
      phone: formatPhoneNumber(phone)
    },
    
    // Shipping info (same as billing for donations)
    shipping: {
      firstname: name?.split(' ')[0] || 'Donor',
      lastname: name?.split(' ').slice(1).join(' ') || 'Anonymous',
      address_1: billing?.address || 'Karatu District',
      address_2: billing?.address2 || '',
      city: billing?.city || 'Karatu',
      state_or_region: billing?.state || 'Arusha',
      postcode_or_pobox: billing?.postcode || '00000',
      country: billing?.country || 'TZ',
      phone: formatPhoneNumber(phone)
    },
    
    // Additional fields
    buyer_remarks: `Donation: ${donationType || 'General'}${isMonthly ? ' (Monthly)' : ''}`,
    merchant_remarks: `MBYF Donation - ${transactionId}`,
    no_of_items: 1,
    
    // Customization
    header_colour: '#2c5530',
    link_colour: '#4a7c59',
    button_colour: '#fc7d07',
    expiry: 60 // 60 minutes
  };
}

function buildMinimalOrderData(params) {
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
    domain
  } = params;
  
  const amountInTzs = formatAmount(amount, currency);
  
  return {
    vendor: vendor,
    order_id: orderId,
    buyer_email: email.trim().toLowerCase(),
    buyer_name: name?.trim() || 'Anonymous Donor',
    buyer_phone: formatPhoneNumber(phone),
    amount: amountInTzs,
    currency: 'TZS',
    payment_methods: 'MOBILEMONEYPULL', // Only mobile money
    redirect_url: Buffer.from(`${domain}/donate/thank-you?ref=${transactionId}`).toString('base64'),
    cancel_url: Buffer.from(`${domain}/donate?cancelled=true`).toString('base64'),
    webhook: Buffer.from(`${domain}/api/selcom-webhook`).toString('base64'),
    transid: transactionId,
    buyer_remarks: `Donation: ${donationType || 'General'}${isMonthly ? ' (Monthly)' : ''}`,
    merchant_remarks: `MBYF Donation - ${transactionId}`,
    no_of_items: 1
  };
}

function buildWalletOrderData(params) {
  const {
    vendor,
    vendorPin,
    transactionId,
    amount,
    currency,
    msisdn,
    walletConfig,
    donationType
  } = params;
  
  const amountInTzs = formatAmount(amount, currency);
  
  return {
    transid: transactionId,
    utilityref: donationType || 'MAISHABORA',
    amount: amountInTzs,
    vendor: vendor,
    pin: vendorPin,
    msisdn: formatPhoneNumber(msisdn),
    utilitycode: walletConfig.utilitycode
  };
}

function buildSelcomPesaOrderData(params) {
  const {
    vendor,
    vendorPin,
    transactionId,
    amount,
    currency,
    msisdn,
    donationType
  } = params;
  
  const amountInTzs = formatAmount(amount, currency);
  
  return {
    transid: transactionId,
    utilityref: formatPhoneNumber(msisdn), // Selcom Pesa account or mobile
    amount: amountInTzs,
    vendor: vendor,
    pin: vendorPin,
    msisdn: formatPhoneNumber(msisdn),
    utilitycode: 'SPSCASHIN' // Static for Selcom Pesa
  };
}

function buildBankOrderData(params) {
  const {
    vendor,
    vendorPin,
    transactionId,
    amount,
    currency,
    email,
    name,
    phone,
    donationType
  } = params;
  
  const amountInTzs = formatAmount(amount, currency);
  
  return {
    transid: transactionId,
    recipientFiCode: 'NMB', // Example: NMB Bank
    recipientAccount: 'DONATION', // Account to receive funds
    recipientName: 'MAISHA BORA YOUTH FOUNDATION',
    senderAccount: email, // Donor's email as account ID
    senderName: name?.trim() || 'Anonymous Donor',
    amount: amountInTzs,
    vendor: vendor,
    pin: vendorPin,
    msisdn: formatPhoneNumber(phone),
    purpose: 'DONATION',
    remarks: donationType || 'General Donation'
  };
}