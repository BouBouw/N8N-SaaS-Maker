const express = require('express');
const router = express.Router();
const stripeService = require('../services/stripeService');
const { isAuthenticated } = require('../middleware/auth');

// Check if Stripe is configured
const isStripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

/**
 * Create Stripe Checkout Session
 * POST /stripe/create-checkout-session
 */
router.post('/create-checkout-session', isAuthenticated, async (req, res) => {
    if (!isStripeConfigured()) {
        return res.status(503).json({ 
            error: 'Les paiements ne sont pas encore configurés. Veuillez contacter l\'administrateur.' 
        });
    }

    try {
        const { planName, planType } = req.body; // planName: 'pro' or 'business', planType: 'monthly' or 'annual'
        const userId = req.session.userId;

        if (!planName || !['pro', 'business'].includes(planName)) {
            return res.status(400).json({ error: 'Invalid plan name' });
        }

        if (!planType || !['monthly', 'annual'].includes(planType)) {
            return res.status(400).json({ error: 'Invalid plan type' });
        }

        // Get user details
        const pool = require('../config/database');
        const [users] = await pool.query(
            'SELECT email, name FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];

        // Create checkout session
        const successUrl = `${process.env.FRONTEND_URL}/dashboard/settings?payment=success`;
        const cancelUrl = `${process.env.FRONTEND_URL}/?payment=canceled`;

        const session = await stripeService.createCheckoutSession(
            userId,
            user.email,
            user.name,
            planName,
            planType,
            successUrl,
            cancelUrl
        );

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Create checkout session error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

/**
 * Get user subscription details
 * GET /stripe/subscription
 */
router.get('/subscription', isAuthenticated, async (req, res) => {
    if (!isStripeConfigured()) {
        return res.json({ subscription: null });
    }

    try {
        const userId = req.session.userId;
        const subscription = await stripeService.getUserSubscription(userId);

        if (!subscription) {
            return res.json({ subscription: null });
        }

        res.json({ subscription });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({ error: 'Failed to get subscription' });
    }
});

/**
 * Get payment history
 * GET /stripe/payments
 */
router.get('/payments', isAuthenticated, async (req, res) => {
    if (!isStripeConfigured()) {
        return res.json({ payments: [] });
    }

    try {
        const userId = req.session.userId;
        const limit = parseInt(req.query.limit) || 10;
        
        const payments = await stripeService.getPaymentHistory(userId, limit);
        res.json({ payments });
    } catch (error) {
        console.error('Get payments error:', error);
        res.status(500).json({ error: 'Failed to get payment history' });
    }
});

/**
 * Cancel subscription
 * POST /stripe/cancel-subscription
 */
router.post('/cancel-subscription', isAuthenticated, async (req, res) => {
    if (!isStripeConfigured()) {
        return res.status(503).json({ 
            error: 'Les paiements ne sont pas encore configurés.' 
        });
    }

    try {
        const userId = req.session.userId;
        const subscription = await stripeService.cancelSubscription(userId);
        
        res.json({ 
            success: true, 
            message: 'Subscription will be canceled at the end of the billing period',
            subscription 
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ error: error.message || 'Failed to cancel subscription' });
    }
});

/**
 * Create customer portal session
 * POST /stripe/create-portal-session
 */
router.post('/create-portal-session', isAuthenticated, async (req, res) => {
    if (!isStripeConfigured()) {
        return res.status(503).json({ 
            error: 'Les paiements ne sont pas encore configurés.' 
        });
    }

    try {
        const userId = req.session.userId;
        const returnUrl = `${process.env.FRONTEND_URL}/dashboard/settings`;
        
        const session = await stripeService.createPortalSession(userId, returnUrl);
        res.json({ url: session.url });
    } catch (error) {
        console.error('Create portal session error:', error);
        res.status(500).json({ error: error.message || 'Failed to create portal session' });
    }
});

/**
 * Sync subscription from Stripe (manual sync)
 * POST /stripe/sync-subscription
 */
router.post('/sync-subscription', isAuthenticated, async (req, res) => {
    if (!isStripeConfigured()) {
        return res.status(503).json({ 
            error: 'Les paiements ne sont pas encore configurés.' 
        });
    }

    try {
        const userId = req.session.userId;
        const result = await stripeService.syncUserSubscription(userId);
        
        res.json({ 
            success: true,
            message: result.synced ? 'Abonnement synchronisé avec succès' : 'Aucun abonnement trouvé',
            data: result
        });
    } catch (error) {
        console.error('Sync subscription error:', error);
        res.status(500).json({ error: error.message || 'Failed to sync subscription' });
    }
});

/**
 * Verify checkout session and sync subscription
 * GET /stripe/verify-session/:sessionId
 */
router.get('/verify-session/:sessionId', isAuthenticated, async (req, res) => {
    if (!isStripeConfigured()) {
        return res.status(503).json({ 
            error: 'Les paiements ne sont pas encore configurés.' 
        });
    }

    try {
        const { sessionId } = req.params;
        const userId = req.session.userId;
        
        const result = await stripeService.checkCheckoutSession(sessionId, userId);
        res.json(result);
    } catch (error) {
        console.error('Verify session error:', error);
        res.status(500).json({ 
            status: 'error',
            message: error.message || 'Erreur lors de la vérification du paiement'
        });
    }
});

/**
 * Stripe webhook endpoint
 * POST /stripe/webhook
 * This should be called by Stripe when events occur
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('⚠️ Stripe webhook secret not configured');
        return res.status(400).send('Webhook secret not configured');
    }

    let event;

    try {
        const Stripe = require('stripe');
        
        if (!process.env.STRIPE_SECRET_KEY) {
            console.error('⚠️ STRIPE_SECRET_KEY not configured');
            return res.status(400).send('Stripe not configured');
        }
        
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('⚠️ Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'customer.subscription.created':
                await stripeService.handleSubscriptionCreated(event.data.object);
                break;
            
            case 'customer.subscription.updated':
                await stripeService.handleSubscriptionUpdated(event.data.object);
                break;
            
            case 'customer.subscription.deleted':
                await stripeService.handleSubscriptionDeleted(event.data.object);
                break;
            
            case 'payment_intent.succeeded':
                await stripeService.handlePaymentSucceeded(event.data.object);
                break;
            
            case 'invoice.payment_succeeded':
                console.log('✅ Invoice payment succeeded:', event.data.object.id);
                break;
            
            case 'invoice.payment_failed':
                console.log('❌ Invoice payment failed:', event.data.object.id);
                break;
            
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

module.exports = router;
