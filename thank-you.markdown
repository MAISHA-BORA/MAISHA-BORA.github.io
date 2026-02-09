---
layout: page
permalink: /donate/thank-you/
title: Thank You for Your Donation
---

<section class="thank-you-section">
    <div class="container">
        <div class="thank-you-content">
            <div class="success-icon">🎉</div>
            <h1>Thank You for Your Generous Donation!</h1>
            
            <div class="donation-summary" id="donationSummary">
                <div class="summary-item">
                    <span class="label">Amount:</span>
                    <span class="value" id="donationAmount">$0.00</span>
                </div>
                <div class="summary-item">
                    <span class="label">Transaction ID:</span>
                    <span class="value" id="transactionId">Loading...</span>
                </div>
                <div class="summary-item">
                    <span class="label">Date:</span>
                    <span class="value" id="donationDate">{{ site.time | date: "%B %d, %Y" }}</span>
                </div>
            </div>
            
            <div class="confirmation-message">
                <h3>What Happens Next?</h3>
                <div class="next-steps">
                    <div class="step">
                        <div class="step-number">1</div>
                        <p>You will receive a confirmation email with your receipt</p>
                    </div>
                    <div class="step">
                        <div class="step-number">2</div>
                        <p>Your donation will be processed within 24 hours</p>
                    </div>
                    <div class="step">
                        <div class="step-number">3</div>
                        <p>We'll send you updates on how your donation is making a difference</p>
                    </div>
                </div>
            </div>
            
            <div class="impact-reminder">
                <h3>Your Impact</h3>
                <p>Your contribution will help provide:</p>
                <ul class="impact-list">
                    <li>📚 Educational materials for Tanzanian youth</li>
                    <li>💻 Computer and skills training</li>
                    <li>🗣️ English language programs</li>
                    <li>🤝 Mentorship and guidance</li>
                </ul>
            </div>
            
            <div class="actions">
                <a href="/" class="btn btn-primary">Return to Home</a>
                <a href="/donate/" class="btn btn-secondary">Make Another Donation</a>
                <a href="/contact/" class="btn btn-outline">Contact Us</a>
            </div>
            
            <div class="receipt-note">
                <p><strong>Tax Receipt:</strong> Your donation receipt will be emailed to you within 24 hours. Please keep it for your records.</p>
                <p><strong>Questions?</strong> Email us at <a href="mailto:donations@maishaborafoundation.org">donations@maishaborafoundation.org</a></p>
            </div>
        </div>
    </div>
</section>

<style>
.thank-you-section {
    padding: 80px 0;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    min-height: 100vh;
}

.thank-you-content {
    max-width: 800px;
    margin: 0 auto;
    text-align: center;
    background: white;
    padding: 60px;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(44, 85, 48, 0.1);
}

.success-icon {
    font-size: 4rem;
    margin-bottom: 30px;
    animation: bounce 1s ease infinite;
}

@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
}

.thank-you-content h1 {
    color: var(--primary-color);
    margin-bottom: 40px;
    font-size: 2.5rem;
}

.donation-summary {
    background: var(--light-color);
    padding: 30px;
    border-radius: 15px;
    margin: 40px 0;
    text-align: left;
}

.summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 0;
    border-bottom: 1px solid rgba(0,0,0,0.1);
}

.summary-item:last-child {
    border-bottom: none;
}

.summary-item .label {
    font-weight: 600;
    color: var(--dark-color);
}

.summary-item .value {
    font-weight: 700;
    color: var(--primary-color);
    font-size: 1.1rem;
}

.confirmation-message {
    margin: 40px 0;
}

.next-steps {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-top: 30px;
}

.step {
    background: var(--accent-color);
    padding: 25px;
    border-radius: 10px;
    position: relative;
}

.step-number {
    position: absolute;
    top: -15px;
    left: -15px;
    background: var(--primary-color);
    color: white;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 1.2rem;
}

.impact-reminder {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    padding: 40px;
    border-radius: 15px;
    margin: 40px 0;
}

.impact-reminder h3 {
    margin-bottom: 20px;
}

.impact-list {
    list-style: none;
    margin: 20px 0 0;
    text-align: left;
}

.impact-list li {
    padding: 10px 0;
    font-size: 1.1rem;
}

.actions {
    display: flex;
    gap: 20px;
    justify-content: center;
    flex-wrap: wrap;
    margin: 40px 0;
}

.receipt-note {
    background: #fff8e1;
    padding: 25px;
    border-radius: 10px;
    border-left: 5px solid #ffb300;
    margin-top: 40px;
    text-align: left;
}

@media (max-width: 768px) {
    .thank-you-content {
        padding: 30px 20px;
    }
    
    .actions {
        flex-direction: column;
    }
    
    .btn {
        width: 100%;
        margin-bottom: 10px;
    }
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
    // Get donation details from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const transactionRef = urlParams.get('ref');
    
    if (transactionRef) {
        document.getElementById('transactionId').textContent = transactionRef;
        
        // Try to get amount from localStorage
        const donationData = localStorage.getItem(`donation_${transactionRef}`);
        if (donationData) {
            const data = JSON.parse(donationData);
            document.getElementById('donationAmount').textContent = `$${data.amount}`;
        }
        
        // Clear donation data from localStorage
        localStorage.removeItem(`donation_${transactionRef}`);
    }
    
    // Send analytics event
    if (typeof gtag !== 'undefined') {
        gtag('event', 'donation_completed', {
            'transaction_id': transactionRef,
            'value': parseFloat(document.getElementById('donationAmount').textContent.replace('$', '')) || 0
        });
    }
    
    // Update date
    document.getElementById('donationDate').textContent = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
});
</script>