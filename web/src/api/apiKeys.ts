import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

export interface ApiKeyInfo {
    id: number;
    key_preview: string;
    is_active: boolean;
    created_at: string;
    last_used_at: string | null;
    request_count: number;
}

export interface ApiKeyResponse {
    success: boolean;
    apiKey: string;
    keyPreview: string;
    message: string;
}

export interface ApiStats {
    total_requests: number;
    active_days: number;
    avg_response_time: number;
    success_count: number;
    error_count: number;
}

const apiKeysApi = {
    getApiKey: async (instanceId: number): Promise<{ apiKey: ApiKeyInfo | null }> => {
        const response = await api.get(`/api-keys/${instanceId}`);
        return response.data;
    },

    createApiKey: async (instanceId: number): Promise<ApiKeyResponse> => {
        const response = await api.post(`/api-keys/${instanceId}`);
        return response.data;
    },

    regenerateApiKey: async (instanceId: number): Promise<ApiKeyResponse> => {
        const response = await api.put(`/api-keys/${instanceId}/regenerate`);
        return response.data;
    },

    revokeApiKey: async (instanceId: number): Promise<{ success: boolean; message: string }> => {
        const response = await api.delete(`/api-keys/${instanceId}`);
        return response.data;
    },

    getStats: async (instanceId: number): Promise<{ stats: ApiStats }> => {
        const response = await api.get(`/api-keys/${instanceId}/stats`);
        return response.data;
    }
};

export default apiKeysApi;
