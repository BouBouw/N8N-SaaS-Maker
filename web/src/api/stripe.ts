const API_URL = 'http://localhost:5000';

// Helper function for API calls
const apiClient = {
    async get(endpoint: string) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            credentials: 'include'
        });
        if (!response.ok) {
            const error = await response.json();
            throw { response: { data: error } };
        }
        return { data: await response.json() };
    },

    async post(endpoint: string, body?: any) {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: body ? JSON.stringify(body) : undefined
        });
        if (!response.ok) {
            const error = await response.json();
            throw { response: { data: error } };
        }
        return { data: await response.json() };
    }
};

export interface Subscription {
    id: number;
    user_id: number;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    plan_type: 'monthly' | 'annual';
    status: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
    current_period_start: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    created_at: string;
    updated_at: string;
    subscription_plan?: string;
    stripe_data?: {
        cancel_at: number | null;
        canceled_at: number | null;
        trial_end: number | null;
    };
}

export interface Payment {
    id: number;
    user_id: number;
    subscription_id: number | null;
    stripe_payment_intent_id: string;
    stripe_invoice_id: string | null;
    amount: number;
    currency: string;
    status: 'succeeded' | 'pending' | 'failed' | 'refunded';
    description: string;
    payment_date: string;
    created_at: string;
    plan_type?: string;
}

export const stripe = {
    /**
     * Create Stripe checkout session for subscription
     */
    async createCheckoutSession(planName: 'pro' | 'business', planType: 'monthly' | 'annual'): Promise<{ sessionId: string; url: string }> {
        const response = await apiClient.post('/stripe/create-checkout-session', { planName, planType });
        return response.data;
    },

    /**
     * Get current user subscription
     */
    async getSubscription(): Promise<{ subscription: Subscription | null }> {
        const response = await apiClient.get('/stripe/subscription');
        return response.data;
    },

    /**
     * Get payment history
     */
    async getPaymentHistory(limit: number = 10): Promise<{ payments: Payment[] }> {
        const response = await apiClient.get(`/stripe/payments?limit=${limit}`);
        return response.data;
    },

    /**
     * Cancel current subscription
     */
    async cancelSubscription(): Promise<{ success: boolean; message: string; subscription: any }> {
        const response = await apiClient.post('/stripe/cancel-subscription');
        return response.data;
    },

    /**
     * Create customer portal session
     */
    async createPortalSession(): Promise<{ url: string }> {
        const response = await apiClient.post('/stripe/create-portal-session');
        return response.data;
    },

    /**
     * Sync subscription from Stripe (manual sync)
     */
    async syncSubscription(): Promise<{ success: boolean; message: string; data: any }> {
        const response = await apiClient.post('/stripe/sync-subscription');
        return response.data;
    },

    /**
     * Verify checkout session status
     */
    async verifyCheckoutSession(sessionId: string): Promise<{ status: string; message: string; subscription?: any }> {
        const response = await apiClient.get(`/stripe/verify-session/${sessionId}`);
        return response.data;
    }
};
