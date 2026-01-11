const API_URL = 'http://localhost:5000';

export const instancesApi = {
    // Get all instances
    async getInstances() {
        const response = await fetch(`${API_URL}/instances`, {
            credentials: 'include'
        });
        return response.json();
    },

    // Get single instance
    async getInstance(identifier: string | number) {
        const response = await fetch(`${API_URL}/instances/${identifier}`, {
            credentials: 'include'
        });
        return response.json();
    },

    // Create new instance
    async createInstance() {
        const response = await fetch(`${API_URL}/instances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({})
        });
        return response.json();
    },

    // Start instance
    async startInstance(id: number) {
        const response = await fetch(`${API_URL}/instances/${id}/start`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    },

    // Stop instance
    async stopInstance(id: number) {
        const response = await fetch(`${API_URL}/instances/${id}/stop`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    },

    // Restart instance
    async restartInstance(id: number) {
        const response = await fetch(`${API_URL}/instances/${id}/restart`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    },

    // Get instance logs
    async getInstanceLogs(id: number, tail: number = 100) {
        const response = await fetch(`${API_URL}/instances/${id}/logs?tail=${tail}`, {
            credentials: 'include'
        });
        return response.json();
    },

    // Delete instance
    async deleteInstance(id: number) {
        const response = await fetch(`${API_URL}/instances/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        return response.json();
    },

    // Get user subscription
    async getSubscription() {
        const response = await fetch(`${API_URL}/instances/subscription`, {
            credentials: 'include'
        });
        return response.json();
    },

    // Get user activities
    async getActivities(limit: number = 10) {
        const response = await fetch(`${API_URL}/activities?limit=${limit}`, {
            credentials: 'include'
        });
        return response.json();
    },

    // Alias for getInstances (for compatibility)
    async getAll() {
        return this.getInstances();
    }
};

export default instancesApi;
