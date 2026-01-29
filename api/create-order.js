// api/create-order.js - Direct HTTP implementation (no external dependencies)
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
    
    if (!apiKey || !apiSecret || !vendor) {
      console.error('Missing Selcom credentials');
      return res.status(503).json({
        error: 'Payment service temporarily unavailable',
        message: 'Please try again later or contact support'
      });
    }
    
    // Validate input
    const { amount, email, name, phone, donationType, isMonthly } = req.body;
    
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
    const orderId = `DONATE-${timestamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const transactionId = `MBYF-${timestamp}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Get domain
    const domain = process.env.NEXT_PUBLIC_DOMAIN || req.headers.origin || 'https://maishaborafoundation.org';
    
    // Prepare order data
    const orderData = {
      vendor: vendor,
      order_id: orderId,
      buyer_email: email.trim().toLowerCase(),
      buyer_name: name?.trim() || 'Anonymous Donor',
      buyer_phone: formatPhoneNumber(phone) || '255000000000',
      amount: parseFloat(amount), // amount: Math.round(parseFloat(amount) * 100),
      currency: 'TZS',
      buyer_remarks: `Donation to Maisha Bora${isMonthly ? ' (Monthly)' : ''}`,
      merchant_remarks: `MBYF - ${donationType || 'General'}`,
      no_of_items: 1,
      redirect_url: Buffer.from(`${domain}/donate/thank-you?ref=${transactionId}`).toString('base64'),
      cancel_url: Buffer.from(`${domain}/donate?cancelled=true`).toString('base64'),
      webhook: Buffer.from(`${domain}/api/payment-webhook`).toString('base64'),
      transid: transactionId
    };
    
    console.log('Creating order:', { orderId, amount: orderData.amount });
    
    // Create authorization signature according to Selcom specification
    const path = '/v1/checkout/create-order-minimal';
    
    // 1. Generate ISO 8601 timestamp with +03:00 timezone (East Africa Time)
    function getSelcomTimestamp() {
        const now = new Date();
        // Adjust for East Africa Time (UTC+3)
        const adjustedTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
        
        // Format: YYYY-MM-DDThh:mm:ss+03:00 (no milliseconds)
        const year = adjustedTime.getUTCFullYear();
        const month = String(adjustedTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(adjustedTime.getUTCDate()).padStart(2, '0');
        const hours = String(adjustedTime.getUTCHours()).padStart(2, '0');
        const minutes = String(adjustedTime.getUTCMinutes()).padStart(2, '0');
        const seconds = String(adjustedTime.getUTCSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+03:00`;
    }
    const timestamp_sig = getSelcomTimestamp();
    console.log('Selcom Timestamp:', timestamp_sig);
    
    // 2. Prepare data for the signature - include timestamp first
    const dataToSign = {
      timestamp: timestamp_sig,
      ...orderData
    };
    
    // 3. Create the query string for signing (sorted alphabetically by key)
    const signedFields = Object.keys(orderData).sort().join(',');
    const queryString = Object.keys(dataToSign)
      .sort()
      .map(key => `${key}=${dataToSign[key]}`)
      .join('&');
    
    console.log('String to sign:', queryString);
    
    // 4. Create the HMAC SHA256 signature and encode it in Base64
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('base64');
    
    // Make request to Selcom
    const response = await makeSelcomRequest(path, orderData, {
      apiKey,
      signature,
      timestamp: timestamp_sig,
      signedFields
    });
    
    console.log('Selcom response:', { result: response?.result });
    
    if (!response || response.result !== 'SUCCESS') {
      throw new Error(response?.message || 'Payment gateway error');
    }
    
    const paymentData = response.data?.[0];
    
    return res.status(200).json({
      success: true,
      orderId,
      transactionId,
      amount,
      paymentGatewayUrl: paymentData?.payment_gateway_url ? 
        Buffer.from(paymentData.payment_gateway_url, 'base64').toString() : null,
      qrCode: paymentData?.qr || null,
      timestamp: new Date().toISOString()
    });
    
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

// Helper function to make HTTPS requests to Selcom
function makeSelcomRequest(path, data, auth) {
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
        // Authorization must be base64 encoded API key with "SELCOM " prefix
        'Authorization': `SELCOM ${Buffer.from(auth.apiKey).toString('base64')}`,
        'Digest-Method': 'HS256',
        'Digest': auth.signature, // Base64 encoded signature
        'Timestamp': auth.timestamp, // ISO 8601 timestamp
        'Signed-Fields': auth.signedFields
      }
    };
    
    // Log request for debugging
    console.log('Request headers:', {
      Authorization: options.headers.Authorization,
      Timestamp: options.headers.Timestamp,
      Digest: options.headers.Digest,
      'Signed-Fields': options.headers['Signed-Fields']
    });
    
    const req = https.request(options, (response) => {
      let body = '';
      
      console.log('Response status:', response.statusCode);
      
      response.on('data', (chunk) => {
        body += chunk;
      });
      
      response.on('end', () => {
        console.log('Response body:', body);
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Invalid response from payment gateway: ${body.substring(0, 200)}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Payment gateway connection failed: ${error.message}`));
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Payment gateway timeout'));
    });
    
    req.write(postData);
    req.end();
  });
}

function formatPhoneNumber(phone) {
  if (!phone) return null;
  let cleaned = phone.toString().replace(/\D/g, '');
  if (!cleaned.startsWith('255') && cleaned.length <= 9) {
    cleaned = '255' + cleaned;
  }
  return cleaned.length >= 10 && cleaned.length <= 13 ? cleaned : null;
}