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

    // Complete onboarding
    async completeOnboarding() {
        const response = await fetch(`${API_URL}/auth/complete-onboarding`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    },

    // Update profile
    async updateProfile(formData: FormData) {
        const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PATCH',
            credentials: 'include',
            body: formData
        });
        return response.json();
    },

    // Update password
    async updatePassword(currentPassword: string, newPassword: string) {
        const response = await fetch(`${API_URL}/auth/password`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        return response.json();
    },

    // Update preferences
    async updatePreferences(preferences: any) {
        const response = await fetch(`${API_URL}/auth/preferences`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preferences)
        });
        return response.json();
    },

    // Sync Discord avatar
    async syncDiscordAvatar() {
        const response = await fetch(`${API_URL}/auth/sync-discord-avatar`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    },

    // Discord connection
    async getDiscordConnection() {
        const response = await fetch(`${API_URL}/discord/connection`, {
            credentials: 'include'
        });
        return response.json();
    },

    // Get Discord OAuth URL (synchronous)
    getDiscordAuthUrl(): string {
        return `${API_URL}/auth/discord`;
    },

    // Get Discord auth-url from API (for Settings page)
    async fetchDiscordAuthUrl() {
        const response = await fetch(`${API_URL}/discord/auth-url`, {
            credentials: 'include'
        });
        return response.json();
    },

    async unlinkDiscord() {
        const response = await fetch(`${API_URL}/discord/unlink`, {
            method: 'DELETE',
            credentials: 'include'
        });
        return response.json();
    },

    async linkDiscord(code: string, state: string) {
        const response = await fetch(`${API_URL}/discord/callback`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, state })
        });
        return response.json();
    }
};
