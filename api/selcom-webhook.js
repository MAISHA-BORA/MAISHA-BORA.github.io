// api/selcom-webhook.js - Handle payment notifications from Selcom
const crypto = require('crypto');

module.exports = async (req, res) => {
  console.log('Webhook received:', {
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiSecret = process.env.SELCOM_API_SECRET;

    if (!apiSecret) {
      console.error('SELCOM_API_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Extract headers
    const receivedSignature = req.headers['digest'];
    const timestamp = req.headers['timestamp'];
    const signedFields = req.headers['signed-fields'];

    console.log('Webhook headers:', {
      signature: receivedSignature?.substring(0, 20) + '...',
      timestamp,
      signedFields
    });

    // Verify signature
    if (receivedSignature && signedFields) {
      const fields = signedFields.split(',');
      const fieldPairs = fields.map(field => `${field}=${req.body[field]}`);
      const dataToSign = `timestamp=${timestamp}&${fieldPairs.join('&')}`;

      const computedSignature = crypto
        .createHmac('sha256', apiSecret)
        .update(dataToSign)
        .digest('base64');

      if (receivedSignature !== computedSignature) {
        console.error('Signature mismatch:', {
          received: receivedSignature,
          computed: computedSignature,
          dataToSign
        });
        return res.status(401).json({ error: 'Invalid signature' });
      }

      console.log('✓ Signature verified');
    }

    // Extract payment data
    const {
      result,
      resultcode,
      order_id,
      transid,
      reference,
      payment_status,
      amount,
      channel,
      phone,
      message
    } = req.body;

    console.log('Payment notification:', {
      order_id,
      payment_status,
      result,
      resultcode,
      amount,
      channel,
      reference
    });

    // Process based on payment status
    if (payment_status === 'COMPLETED' && result === 'SUCCESS') {
      console.log('✓ Payment successful:', {
        order_id,
        amount,
        channel,
        reference
      });

      // TODO: Update your database
      // await updateDonationStatus(order_id, {
      //   status: 'completed',
      //   reference,
      //   amount,
      //   channel,
      //   phone,
      //   completedAt: new Date()
      // });

      // TODO: Send confirmation email
      // await sendDonationConfirmation({
      //   order_id,
      //   amount,
      //   reference
      // });

      // TODO: Trigger any post-payment actions
      // - Add to CRM
      // - Generate tax receipt
      // - Update donor dashboard

    } else if (payment_status === 'FAILED' || result === 'FAIL') {
      console.log('✗ Payment failed:', {
        order_id,
        resultcode,
        message
      });

      // TODO: Update database with failure
      // TODO: Send failure notification

    } else if (payment_status === 'PENDING' || payment_status === 'INPROGRESS') {
      console.log('⧗ Payment pending:', {
        order_id,
        payment_status
      });

      // TODO: Update status to pending
      // TODO: Set up status check job

    } else if (payment_status === 'CANCELLED' || payment_status === 'USERCANCELLED') {
      console.log('⊘ Payment cancelled:', {
        order_id,
        payment_status
      });

      // TODO: Update status to cancelled

    } else {
      console.warn('Unknown payment status:', payment_status);
    }

    // Always return success to Selcom
    return res.status(200).json({
      result: 'SUCCESS',
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Webhook processing error:', {
      message: error.message,
      stack: error.stack
    });

    // Still return 200 to prevent Selcom retries for non-signature errors
    return res.status(200).json({
      result: 'FAIL',
      message: 'Webhook processing error'
    });
  }
};

// ============================================================================
// Helper functions (examples - customize for your database)
// ============================================================================

async function updateDonationStatus(orderId, data) {
  // Example: Update in your database
  // const db = await connectDatabase();
  // await db.collection('donations').updateOne(
  //   { order_id: orderId },
  //   {
  //     $set: {
  //       status: data.status,
  //       selcom_reference: data.reference,
  //       payment_channel: data.channel,
  //       payment_phone: data.phone,
  //       completed_at: data.completedAt,
  //       updated_at: new Date()
  //     }
  //   }
  // );

  console.log('Database update needed for:', orderId, data);
}

async function sendDonationConfirmation(data) {
  // Example: Send email using your email service
  // const emailService = getEmailService();
  // await emailService.send({
  //   to: donor.email,
  //   subject: 'Thank you for your donation!',
  //   template: 'donation-confirmation',
  //   data: {
  //     amount: data.amount,
  //     reference: data.reference,
  //     order_id: data.order_id
  //   }
  // });

  console.log('Email confirmation needed for:', data);
}