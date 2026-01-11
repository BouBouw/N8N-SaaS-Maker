import axios from 'axios';

const API_URL = 'http://localhost:5000';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const adminApi = {
    // Dashboard stats
    getStats: async () => {
        const response = await api.get('/admin/stats');
        return response.data;
    },

    // Users
    getUsers: async () => {
        const response = await api.get('/admin/users');
        return response.data;
    },

    updateUserRole: async (userId: number, role: string) => {
        const response = await api.patch(`/admin/users/${userId}/role`, { role });
        return response.data;
    },

    updateUser: async (userId: number, data: { name?: string; email?: string; password?: string; role?: string }) => {
        const response = await api.patch(`/admin/users/${userId}`, data);
        return response.data;
    },

    deleteUser: async (userId: number) => {
        const response = await api.delete(`/admin/users/${userId}`);
        return response.data;
    },

    // Instances
    getInstances: async () => {
        const response = await api.get('/admin/instances');
        return response.data;
    },

    grantInstanceAccess: async (instanceId: number) => {
        const response = await api.post(`/admin/instances/${instanceId}/grant-access`);
        return response.data;
    },

    deleteInstance: async (instanceId: number) => {
        const response = await api.delete(`/admin/instances/${instanceId}`);
        return response.data;
    },

    // Workflows
    getWorkflows: async () => {
        const response = await api.get('/admin/workflows');
        return response.data;
    },
};
