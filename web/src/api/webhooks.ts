const API_URL = 'http://localhost:5000';

export const webhooksApi = {
    /**
     * Sync workflow executions from N8N instance
     */
    async syncExecutions(instanceId: number) {
        const response = await fetch(`${API_URL}/webhooks/n8n/sync-executions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ instanceId })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to sync executions');
        }

        return response.json();
    }
};
