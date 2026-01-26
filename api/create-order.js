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
    const baseUrl = process.env.SELCOM_BASE_URL || 'https://apigw.selcommobile.com';
    
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
      amount: Math.round(parseFloat(amount) * 100), // Convert to cents
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
    
    // Create authorization signature
    const path = '/v1/checkout/create-order-minimal';
    const signedFields = 'vendor,order_id,buyer_email,buyer_name,buyer_phone,amount,currency,buyer_remarks,merchant_remarks,no_of_items';
    const timestamp_sig = Math.floor(Date.now() / 1000);
    
    // Create signature string
    const signatureString = `${path}${timestamp_sig}${signedFields}${orderData.vendor}${orderData.order_id}${orderData.buyer_email}${orderData.buyer_name}${orderData.buyer_phone}${orderData.amount}${orderData.currency}${orderData.buyer_remarks}${orderData.merchant_remarks}${orderData.no_of_items}`;
    
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureString)
      .digest('hex');
    
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
        'Authorization': `SELCOM ${auth.apiKey}`,
        'Digest-Method': 'HS256',
        'Digest': auth.signature,
        'Timestamp': auth.timestamp.toString(),
        'Signed-Fields': auth.signedFields
      }
    };
    
    const req = https.request(options, (response) => {
      let body = '';
      
      response.on('data', (chunk) => {
        body += chunk;
      });
      
      response.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Invalid response from payment gateway'));
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

