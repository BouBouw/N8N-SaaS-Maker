import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

export interface Resource {
    id: number;
    user_id: number;
    type: 'workflow' | 'prompt';
    title: string;
    description: string;
    content: string;
    tags: string[] | null;
    price: 'free' | 'paid';
    price_amount: number;
    downloads_count: number;
    views_count: number;
    likes_count: number;
    is_featured: boolean;
    is_public: boolean;
    is_liked?: boolean;
    author_name?: string;
    author_avatar?: string;
    author_discord_id?: string;
    created_at: string;
    updated_at: string;
}

export interface ResourceFilters {
    type?: 'all' | 'workflow' | 'prompt';
    price?: 'all' | 'free' | 'paid';
    search?: string;
    limit?: number;
    offset?: number;
}

export interface ResourceStats {
    total_resources: number;
    total_workflows: number;
    total_prompts: number;
    total_downloads: number;
}

export const resourcesApi = {
    // Get all resources with filters
    getResources: async (filters?: ResourceFilters) => {
        const response = await api.get('/resources', { params: filters });
        return response.data;
    },

    // Get resource by ID
    getResource: async (id: number) => {
        const response = await api.get(`/resources/${id}`);
        return response.data;
    },

    // Get statistics
    getStats: async () => {
        const response = await api.get('/resources/stats');
        return response.data;
    },

    // Create resource (publish)
    createResource: async (data: {
        type: 'workflow' | 'prompt';
        title: string;
        description: string;
        content: string;
        tags?: string[];
        price?: 'free' | 'paid';
        priceAmount?: number;
    }) => {
        const response = await api.post('/resources', data);
        return response.data;
    },

    // Get user's resources
    getUserResources: async () => {
        const response = await api.get('/resources/user/me');
        return response.data;
    },

    // Update resource
    updateResource: async (id: number, data: Partial<Resource>) => {
        const response = await api.patch(`/resources/${id}`, data);
        return response.data;
    },

    // Delete resource
    deleteResource: async (id: number) => {
        const response = await api.delete(`/resources/${id}`);
        return response.data;
    },

    // Toggle like
    toggleLike: async (id: number) => {
        const response = await api.post(`/resources/${id}/like`);
        return response.data;
    },

    // Increment download
    incrementDownload: async (id: number) => {
        const response = await api.post(`/resources/${id}/download`);
        return response.data;
    }
};
