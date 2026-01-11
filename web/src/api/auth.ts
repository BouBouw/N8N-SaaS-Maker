const API_URL = 'http://localhost:5000';

export const api = {
    // Register
    async register(name: string, email: string, password: string) {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, password })
        });
        return response.json();
    },

    // Login
    async login(email: string, password: string) {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        return response.json();
    },

    // Logout
    async logout() {
        const response = await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    },

    // Get current user
    async me() {
        const response = await fetch(`${API_URL}/auth/me`, {
            credentials: 'include'
        });
        return response.json();
    },

    // Request password reset
    async requestPasswordReset(email: string) {
        const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email })
        });
        return response.json();
    },

    // Discord OAuth
    getDiscordAuthUrl() {
        return `${API_URL}/auth/discord`;
    },

    // Complete onboarding
    async completeOnboarding() {
        const response = await fetch(`${API_URL}/auth/complete-onboarding`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    }
};
