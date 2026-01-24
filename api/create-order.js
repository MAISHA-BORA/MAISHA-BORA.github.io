const { apigwClient } = require('selcom-apigw-client');

module.exports = async (req, res) => {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Get credentials from environment variables
        const apiKey = process.env.SELCOM_API_KEY;
        const apiSecret = process.env.SELCOM_API_SECRET;
        const baseUrl = 'https://apigw.selcommobile.com/v1';
        const vendor = process.env.SELCOM_VENDOR_ID; // Your Till Number
        
        // Initialize Selcom client
        const client = new apigwClient(baseUrl, apiKey, apiSecret);
        
        // Get data from frontend
        const { amount, email, name, phone } = req.body;
        
        // Prepare Selcom request (using minimal order for donations)
        const orderData = {
            vendor: vendor,
            order_id: `DONATE-${Date.now()}`, // Unique order ID
            buyer_email: email || 'donor@example.com',
            buyer_name: name || 'Anonymous Donor',
            buyer_phone: phone || '255000000000',
            amount: amount,
            currency: 'TZS',
            buyer_remarks: 'Website Donation',
            merchant_remarks: 'Maisha Bora Youth Foundation',
            no_of_items: 1
        };
        
        // Call Selcom API
        const response = await client.postFunc('/checkout/create-order-minimal', orderData);
        
        // Return Selcom's response to frontend
        res.status(200).json(response);
        
    } catch (error) {
        console.error('Selcom API Error:', error);
        res.status(500).json({ 
            error: 'Payment processing failed', 
            details: error.message 
        });
    }
};
