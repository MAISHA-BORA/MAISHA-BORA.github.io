// api/create-order.js
const { apigwClient } = require('selcom-apigw-client');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    // Handle OPTIONS for CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Get credentials from environment variables
        const apiKey = process.env.SELCOM_API_KEY;
        const apiSecret = process.env.SELCOM_API_SECRET;
        const baseUrl = 'https://apigw.selcommobile.com/v1';
        const vendor = process.env.SELCOM_VENDOR_ID || '000000';
        
        if (!apiKey || !apiSecret) {
            throw new Error('Server configuration error');
        }
        
        // Initialize Selcom client
        const client = new apigwClient(baseUrl, apiKey, apiSecret);
        
        // Get data from frontend
        const { amount, email, name, phone, donationType } = req.body;
        
        // Generate unique order ID
        const orderId = `DONATE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Prepare Selcom request for donation
        const orderData = {
            vendor: vendor,
            order_id: orderId,
            buyer_email: email || 'donor@example.com',
            buyer_name: name || 'Anonymous Donor',
            buyer_phone: phone || '255000000000',
            amount: parseInt(amount),
            currency: 'TZS',
            buyer_remarks: 'Website Donation - Maisha Bora',
            merchant_remarks: 'Maisha Bora Youth Foundation - Karatu District',
            no_of_items: 1,
            // Base64 encode your URLs (for real deployment)
            redirect_url: Buffer.from('https://your-vercel-url.com/donate/?thankyou=1').toString('base64'),
            cancel_url: Buffer.from('https://your-vercel-url.com/donate/').toString('base64'),
            webhook: Buffer.from('https://your-vercel-url.com/api/payment-webhook').toString('base64')
        };
        
        console.log('Calling Selcom API with:', { ...orderData, amount: orderData.amount });
        
        // Call Selcom API - using minimal order for donations
        const response = await client.postFunc('/checkout/create-order-minimal', orderData);
        
        console.log('Selcom API Response:', response);
        
        // Return Selcom's response to frontend
        res.status(200).json(response);
        
    } catch (error) {
        console.error('Selcom API Error:', error);
        
        // Provide helpful error messages
        let errorMessage = 'Payment processing failed';
        if (error.message.includes('network')) {
            errorMessage = 'Network error. Please check your connection.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Request timeout. Please try again.';
        } else if (error.message.includes('credentials')) {
            errorMessage = 'Server configuration error.';
        }
        
        res.status(500).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};