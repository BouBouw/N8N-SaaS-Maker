const Stripe = require('stripe');
const pool = require('../config/database');

// Initialize Stripe with secret key (lazy initialization)
let stripe = null;

const getStripe = () => {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not configured in environment variables');
    }
    if (!stripe) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
};

// Check if Stripe is configured
const isStripeConfigured = () => {
    return !!process.env.STRIPE_SECRET_KEY;
};

// Log warning if Stripe is not configured
if (!isStripeConfigured()) {
    console.log('⚠️  Stripe n\'est pas configuré. Les fonctionnalités de paiement seront désactivées.');
    console.log('   Pour activer les paiements, ajoutez STRIPE_SECRET_KEY dans votre fichier .env');
}

const stripeService = {
    /**
     * Create or get Stripe customer for user
     */
    async getOrCreateCustomer(userId, email, name) {
        const stripe = getStripe();
        try {
            // Check if user already has a Stripe customer ID
            const [users] = await pool.query(
                'SELECT stripe_customer_id FROM users WHERE id = ?',
                [userId]
            );

            if (users[0]?.stripe_customer_id) {
                return users[0].stripe_customer_id;
            }

            // Create new Stripe customer
            const customer = await stripe.customers.create({
                email,
                name,
                metadata: {
                    user_id: userId.toString()
                }
            });

            // Save customer ID to database
            await pool.query(
                'UPDATE users SET stripe_customer_id = ? WHERE id = ?',
                [customer.id, userId]
            );

            return customer.id;
        } catch (error) {
            console.error('Error creating Stripe customer:', error);
            throw error;
        }
    },

    /**
     * Create Stripe Checkout Session for subscription
     */
    async createCheckoutSession(userId, email, name, planName, planType, successUrl, cancelUrl) {
        const stripe = getStripe();
        try {
            const customerId = await this.getOrCreateCustomer(userId, email, name);

            // Define price IDs based on plan name (pro/business) and type (monthly/annual)
            let priceId;
            if (planName === 'pro') {
                priceId = planType === 'monthly' 
                    ? process.env.STRIPE_PRICE_ID_PRO_MONTHLY 
                    : process.env.STRIPE_PRICE_ID_PRO_ANNUAL;
            } else if (planName === 'business') {
                priceId = planType === 'monthly' 
                    ? process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY 
                    : process.env.STRIPE_PRICE_ID_BUSINESS_ANNUAL;
            }

            if (!priceId) {
                throw new Error(`Missing Stripe Price ID for ${planName} ${planType} plan`);
            }

            // Create checkout session
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: cancelUrl,
                metadata: {
                    user_id: userId.toString(),
                    plan_name: planName,
                    plan_type: planType
                },
                allow_promotion_codes: true,
                billing_address_collection: 'required',
            });

            return session;
        } catch (error) {
            console.error('Error creating checkout session:', error);
            throw error;
        }
    },

    /**
     * Handle successful subscription creation from webhook
     */
    async handleSubscriptionCreated(subscription) {
        try {
            const customerId = subscription.customer;
            const subscriptionId = subscription.id;

            // Get user from customer ID
            const [users] = await pool.query(
                'SELECT id FROM users WHERE stripe_customer_id = ?',
                [customerId]
            );

            if (users.length === 0) {
                console.error('User not found for customer:', customerId);
                return;
            }

            const userId = users[0].id;
            const planType = subscription.items.data[0].price.recurring.interval === 'month' ? 'monthly' : 'annual';
            
            // Determine plan name (pro or business) from metadata or price ID
            let planName = 'pro'; // Default
            if (subscription.metadata?.plan_name) {
                planName = subscription.metadata.plan_name;
            } else {
                // Try to determine from price ID
                const priceId = subscription.items.data[0].price.id;
                if (priceId === process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY || 
                    priceId === process.env.STRIPE_PRICE_ID_BUSINESS_ANNUAL) {
                    planName = 'business';
                }
            }

            // Insert or update subscription
            await pool.query(`
                INSERT INTO subscriptions (
                    user_id, 
                    stripe_customer_id, 
                    stripe_subscription_id, 
                    plan_type, 
                    status, 
                    current_period_start, 
                    current_period_end,
                    cancel_at_period_end
                ) VALUES (?, ?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?), ?)
                ON DUPLICATE KEY UPDATE
                    status = VALUES(status),
                    current_period_start = VALUES(current_period_start),
                    current_period_end = VALUES(current_period_end),
                    cancel_at_period_end = VALUES(cancel_at_period_end)
            `, [
                userId,
                customerId,
                subscriptionId,
                planType,
                subscription.status,
                subscription.current_period_start,
                subscription.current_period_end,
                subscription.cancel_at_period_end
            ]);

            // Update user subscription plan in users table
            await pool.query(
                'UPDATE users SET subscription_plan = ? WHERE id = ?',
                [planType, userId]
            );
            
            // Update user_subscriptions table with proper plan name and limits
            const planLimits = {
                pro: {
                    max_instances: 3,
                    storage_per_instance: 20,
                    ram_per_instance: 8,
                    bandwidth_per_instance: 10,
                    api_enabled: true
                },
                business: {
                    max_instances: 10,
                    storage_per_instance: 100,
                    ram_per_instance: 16,
                    bandwidth_per_instance: 50,
                    api_enabled: true
                }
            };
            
            const limits = planLimits[planName] || planLimits.pro;
            
            await pool.query(`
                INSERT INTO user_subscriptions (
                    user_id,
                    plan,
                    max_instances,
                    storage_per_instance,
                    ram_per_instance,
                    bandwidth_per_instance,
                    api_enabled
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    plan = VALUES(plan),
                    max_instances = VALUES(max_instances),
                    storage_per_instance = VALUES(storage_per_instance),
                    ram_per_instance = VALUES(ram_per_instance),
                    bandwidth_per_instance = VALUES(bandwidth_per_instance),
                    api_enabled = VALUES(api_enabled)
            `, [
                userId,
                planName,
                limits.max_instances,
                limits.storage_per_instance,
                limits.ram_per_instance,
                limits.bandwidth_per_instance,
                limits.api_enabled
            ]);

            console.log(`✅ Subscription created for user ${userId}: ${subscriptionId} (${planName} - ${planType})`);
        } catch (error) {
            console.error('Error handling subscription created:', error);
            throw error;
        }
    },

    /**
     * Handle subscription updates from webhook
     */
    async handleSubscriptionUpdated(subscription) {
        try {
            const subscriptionId = subscription.id;

            // Update subscription in database
            await pool.query(`
                UPDATE subscriptions 
                SET status = ?, 
                    current_period_start = FROM_UNIXTIME(?), 
                    current_period_end = FROM_UNIXTIME(?),
                    cancel_at_period_end = ?
                WHERE stripe_subscription_id = ?
            `, [
                subscription.status,
                subscription.current_period_start,
                subscription.current_period_end,
                subscription.cancel_at_period_end,
                subscriptionId
            ]);

            console.log(`✅ Subscription updated: ${subscriptionId}`);
        } catch (error) {
            console.error('Error handling subscription updated:', error);
            throw error;
        }
    },

    /**
     * Handle subscription deletion from webhook
     */
    async handleSubscriptionDeleted(subscription) {
        try {
            const subscriptionId = subscription.id;

            // Update subscription status to canceled
            await pool.query(
                'UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?',
                ['canceled', subscriptionId]
            );

            // Update user subscription plan to free
            const [subs] = await pool.query(
                'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?',
                [subscriptionId]
            );

            if (subs.length > 0) {
                await pool.query(
                    'UPDATE users SET subscription_plan = ? WHERE id = ?',
                    ['free', subs[0].user_id]
                );
            }

            console.log(`✅ Subscription deleted: ${subscriptionId}`);
        } catch (error) {
            console.error('Error handling subscription deleted:', error);
            throw error;
        }
    },

    /**
     * Handle successful payment from webhook
     */
    async handlePaymentSucceeded(paymentIntent) {
        try {
            const customerId = paymentIntent.customer;
            const amount = paymentIntent.amount / 100; // Convert from cents
            const currency = paymentIntent.currency.toUpperCase();

            // Get user and subscription
            const [users] = await pool.query(
                'SELECT id FROM users WHERE stripe_customer_id = ?',
                [customerId]
            );

            if (users.length === 0) {
                console.error('User not found for customer:', customerId);
                return;
            }

            const userId = users[0].id;

            // Get subscription ID if exists
            const [subs] = await pool.query(
                'SELECT id FROM subscriptions WHERE user_id = ? AND status = ?',
                [userId, 'active']
            );

            const subscriptionId = subs.length > 0 ? subs[0].id : null;

            // Record payment
            await pool.query(`
                INSERT INTO payments (
                    user_id, 
                    subscription_id, 
                    stripe_payment_intent_id, 
                    amount, 
                    currency, 
                    status, 
                    description
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                userId,
                subscriptionId,
                paymentIntent.id,
                amount,
                currency,
                'succeeded',
                paymentIntent.description || 'Subscription payment'
            ]);

            console.log(`✅ Payment recorded for user ${userId}: ${amount} ${currency}`);
        } catch (error) {
            console.error('Error handling payment succeeded:', error);
            throw error;
        }
    },

    /**
     * Get user subscription details
     */
    async getUserSubscription(userId) {
        const stripe = getStripe();
        try {
            const [subscriptions] = await pool.query(`
                SELECT 
                    s.*,
                    u.subscription_plan
                FROM subscriptions s
                JOIN users u ON s.user_id = u.id
                WHERE s.user_id = ? AND s.status IN ('active', 'trialing', 'past_due')
                ORDER BY s.created_at DESC
                LIMIT 1
            `, [userId]);

            if (subscriptions.length === 0) {
                return null;
            }

            const subscription = subscriptions[0];

            // Get Stripe subscription details for additional info
            if (subscription.stripe_subscription_id) {
                try {
                    const stripeSubscription = await stripe.subscriptions.retrieve(
                        subscription.stripe_subscription_id
                    );
                    
                    return {
                        ...subscription,
                        stripe_data: {
                            cancel_at: stripeSubscription.cancel_at,
                            canceled_at: stripeSubscription.canceled_at,
                            trial_end: stripeSubscription.trial_end,
                        }
                    };
                } catch (error) {
                    console.error('Error fetching Stripe subscription:', error);
                    return subscription;
                }
            }

            return subscription;
        } catch (error) {
            console.error('Error getting user subscription:', error);
            throw error;
        }
    },

    /**
     * Get payment history for user
     */
    async getPaymentHistory(userId, limit = 10) {
        try {
            const [payments] = await pool.query(`
                SELECT 
                    p.*,
                    s.plan_type
                FROM payments p
                LEFT JOIN subscriptions s ON p.subscription_id = s.id
                WHERE p.user_id = ?
                ORDER BY p.payment_date DESC
                LIMIT ?
            `, [userId, limit]);

            return payments;
        } catch (error) {
            console.error('Error getting payment history:', error);
            throw error;
        }
    },

    /**
     * Cancel subscription
     */
    async cancelSubscription(userId) {
        const stripe = getStripe();
        try {
            // Get active subscription
            const [subscriptions] = await pool.query(
                'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = ? AND status = ?',
                [userId, 'active']
            );

            if (subscriptions.length === 0) {
                throw new Error('No active subscription found');
            }

            const stripeSubscriptionId = subscriptions[0].stripe_subscription_id;

            // Cancel at period end (don't cancel immediately)
            const subscription = await stripe.subscriptions.update(stripeSubscriptionId, {
                cancel_at_period_end: true
            });

            // Update database
            await pool.query(
                'UPDATE subscriptions SET cancel_at_period_end = TRUE WHERE stripe_subscription_id = ?',
                [stripeSubscriptionId]
            );

            return subscription;
        } catch (error) {
            console.error('Error canceling subscription:', error);
            throw error;
        }
    },

    /**
     * Create customer portal session for managing subscription
     */
    async createPortalSession(userId, returnUrl) {
        const stripe = getStripe();
        try {
            const [users] = await pool.query(
                'SELECT stripe_customer_id FROM users WHERE id = ?',
                [userId]
            );

            if (!users[0]?.stripe_customer_id) {
                throw new Error('No Stripe customer found');
            }

            const session = await stripe.billingPortal.sessions.create({
                customer: users[0].stripe_customer_id,
                return_url: returnUrl,
            });

            return session;
        } catch (error) {
            console.error('Error creating portal session:', error);
            throw error;
        }
    },

    /**
     * Sync user subscription from Stripe (for manual synchronization)
     */
    async syncUserSubscription(userId) {
        const stripe = getStripe();
        try {
            // Get user's stripe customer ID
            const [users] = await pool.query(
                'SELECT stripe_customer_id FROM users WHERE id = ?',
                [userId]
            );

            if (!users[0]?.stripe_customer_id) {
                throw new Error('No Stripe customer found for this user');
            }

            const customerId = users[0].stripe_customer_id;

            // Get all subscriptions for this customer from Stripe
            const subscriptions = await stripe.subscriptions.list({
                customer: customerId,
                status: 'all',
                limit: 10
            });

            if (subscriptions.data.length === 0) {
                console.log('No subscriptions found in Stripe for user:', userId);
                return { synced: false, message: 'No subscriptions found' };
            }

            // Get the most recent active subscription
            const activeSubscription = subscriptions.data.find(sub => 
                sub.status === 'active' || sub.status === 'trialing'
            ) || subscriptions.data[0];

            // Sync this subscription
            await this.handleSubscriptionCreated(activeSubscription);

            // Get payment history from Stripe
            const invoices = await stripe.invoices.list({
                customer: customerId,
                limit: 10
            });

            // Record successful payments
            for (const invoice of invoices.data) {
                if (invoice.status === 'paid' && invoice.payment_intent) {
                    try {
                        // Check if payment already exists
                        const [existing] = await pool.query(
                            'SELECT id FROM payments WHERE stripe_payment_intent_id = ?',
                            [invoice.payment_intent]
                        );

                        if (existing.length === 0) {
                            const [subs] = await pool.query(
                                'SELECT id FROM subscriptions WHERE user_id = ? AND status = ?',
                                [userId, 'active']
                            );

                            await pool.query(`
                                INSERT INTO payments (
                                    user_id, 
                                    subscription_id, 
                                    stripe_payment_intent_id, 
                                    stripe_invoice_id,
                                    amount, 
                                    currency, 
                                    status, 
                                    description,
                                    payment_date
                                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))
                            `, [
                                userId,
                                subs.length > 0 ? subs[0].id : null,
                                invoice.payment_intent,
                                invoice.id,
                                invoice.amount_paid / 100,
                                invoice.currency.toUpperCase(),
                                'succeeded',
                                invoice.description || 'Subscription payment',
                                invoice.status_transitions.paid_at
                            ]);
                        }
                    } catch (error) {
                        console.error('Error recording payment:', error);
                    }
                }
            }

            console.log(`✅ Subscription synced for user ${userId}`);
            return { 
                synced: true, 
                subscription: activeSubscription,
                paymentsCount: invoices.data.filter(i => i.status === 'paid').length
            };
        } catch (error) {
            console.error('Error syncing subscription:', error);
            throw error;
        }
    },

    /**
     * Check Checkout Session status and sync subscription
     */
    async checkCheckoutSession(sessionId, userId) {
        const stripe = getStripe();
        try {
            // Retrieve the checkout session
            const session = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ['subscription', 'payment_intent']
            });

            console.log('📋 Checkout session status:', session.payment_status);
            console.log('📋 Session subscription:', session.subscription);
            console.log('📋 Session payment_intent:', session.payment_intent);

            // Check if payment was successful
            if (session.payment_status === 'paid' && session.subscription) {
                // Get the subscription details
                const subscription = typeof session.subscription === 'string'
                    ? await stripe.subscriptions.retrieve(session.subscription)
                    : session.subscription;

                // Add session metadata to subscription object for handleSubscriptionCreated
                if (session.metadata) {
                    subscription.metadata = {
                        ...subscription.metadata,
                        ...session.metadata
                    };
                }

                // Sync the subscription
                await this.handleSubscriptionCreated(subscription);

                // Also sync payment history from invoices
                try {
                    const [users] = await pool.query(
                        'SELECT stripe_customer_id FROM users WHERE id = ?',
                        [userId]
                    );

                    if (users[0]?.stripe_customer_id) {
                        const invoices = await stripe.invoices.list({
                            customer: users[0].stripe_customer_id,
                            limit: 10,
                            expand: ['data.payment_intent']
                        });

                        console.log(`📄 Found ${invoices.data.length} invoices for customer`);

                        // Record successful payments from invoices
                        for (const invoice of invoices.data) {
                            const paymentIntentId = typeof invoice.payment_intent === 'object' 
                                ? invoice.payment_intent?.id 
                                : invoice.payment_intent;
                                
                            console.log(`📄 Invoice ${invoice.id}: status=${invoice.status}, payment_intent=${paymentIntentId}, amount=${invoice.amount_paid / 100}`);
                            
                            if (invoice.status === 'paid') {
                                // Check if payment already exists by invoice ID (more reliable than payment_intent)
                                const [existing] = await pool.query(
                                    'SELECT id FROM payments WHERE stripe_invoice_id = ?',
                                    [invoice.id]
                                );

                                if (existing.length === 0) {
                                    const [subs] = await pool.query(
                                        'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?',
                                        [subscription.id]
                                    );

                                    console.log(`💾 Inserting payment: invoice=${invoice.id}, amount=${invoice.amount_paid / 100}, subscription_id=${subs.length > 0 ? subs[0].id : null}`);

                                    // Generate descriptive payment description
                                    const planName = subscription.metadata?.plan_name || 'Pro';
                                    const planType = subscription.items.data[0].price.recurring.interval === 'month' ? 'Mensuel' : 'Annuel';
                                    const description = invoice.description || `Abonnement ${planName.charAt(0).toUpperCase() + planName.slice(1)} ${planType}`;

                                    await pool.query(`
                                        INSERT INTO payments (
                                            user_id, 
                                            subscription_id, 
                                            stripe_payment_intent_id, 
                                            stripe_invoice_id,
                                            amount, 
                                            currency, 
                                            status, 
                                            description,
                                            payment_date
                                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))
                                    `, [
                                        userId,
                                        subs.length > 0 ? subs[0].id : null,
                                        paymentIntentId || null,
                                        invoice.id,
                                        invoice.amount_paid / 100,
                                        invoice.currency.toUpperCase(),
                                        'succeeded',
                                        description,
                                        invoice.status_transitions.paid_at
                                    ]);
                                    
                                    console.log(`✅ Payment recorded successfully`);
                                } else {
                                    console.log(`⚠️ Payment already exists in database`);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error syncing payment history:', error);
                }

                // Record the payment if there's a payment intent
                if (session.payment_intent) {
                    const paymentIntent = typeof session.payment_intent === 'string'
                        ? await stripe.paymentIntents.retrieve(session.payment_intent)
                        : session.payment_intent;

                    // Check if payment already exists
                    const [existing] = await pool.query(
                        'SELECT id FROM payments WHERE stripe_payment_intent_id = ?',
                        [paymentIntent.id]
                    );

                    if (existing.length === 0) {
                        const [subs] = await pool.query(
                            'SELECT id FROM subscriptions WHERE stripe_subscription_id = ?',
                            [subscription.id]
                        );

                        await pool.query(`
                            INSERT INTO payments (
                                user_id, 
                                subscription_id, 
                                stripe_payment_intent_id,
                                amount, 
                                currency, 
                                status, 
                                description,
                                payment_date
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
                        `, [
                            userId,
                            subs.length > 0 ? subs[0].id : null,
                            paymentIntent.id,
                            paymentIntent.amount / 100,
                            paymentIntent.currency.toUpperCase(),
                            'succeeded',
                            'Initial subscription payment'
                        ]);
                    }
                }

                return {
                    status: 'success',
                    message: 'Paiement réussi ! Votre abonnement a été activé.',
                    subscription
                };
            } else if (session.payment_status === 'unpaid') {
                return {
                    status: 'failed',
                    message: 'Le paiement a échoué. Veuillez réessayer.'
                };
            } else {
                return {
                    status: 'pending',
                    message: 'Le paiement est en cours de traitement.'
                };
            }
        } catch (error) {
            console.error('Error checking checkout session:', error);
            throw error;
        }
    }
};

module.exports = stripeService;
