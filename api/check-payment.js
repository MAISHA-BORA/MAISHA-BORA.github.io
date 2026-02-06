// api/check-payment.js
const crypto = require('crypto');
const https = require('https');

module.exports = async (req, res) => {
  // CORS headers (similar to create-order.js)
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { order_id } = req.query;
    
    if (!order_id) {
      return res.status(400).json({ error: 'Order ID required' });
    }
    
    const apiKey = process.env.SELCOM_API_KEY;
    const apiSecret = process.env.SELCOM_API_SECRET;
    
    const timestamp_sig = getSelcomTimestamp();
    
    // Create signature for GET request
    const dataToSign = {
      timestamp: timestamp_sig,
      order_id
    };
    
    const queryString = Object.keys(dataToSign)
      .sort()
      .map(key => `${key}=${dataToSign[key]}`)
      .join('&');
    
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(queryString)
      .digest('base64');
    
    const options = {
      hostname: 'apigw.selcommobile.com',
      port: 443,
      path: `/v1/checkout/order-status?order_id=${order_id}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `SELCOM ${Buffer.from(apiKey).toString('base64')}`,
        'Digest-Method': 'HS256',
        'Digest': signature,
        'Timestamp': timestamp_sig,
        'Signed-Fields': 'order_id'
      }
    };
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
    
    return res.status(200).json(response);
    
  } catch (error) {
    console.error('Payment check error:', error);
    return res.status(500).json({ error: 'Failed to check payment status' });
  }
};