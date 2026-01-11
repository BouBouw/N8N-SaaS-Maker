import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json'
    }
});

export interface ImportWorkflowRequest {
    instanceId: number;
    workflowContent: string;
}

export interface ImportWorkflowResponse {
    success: boolean;
    message: string;
    workflow?: any;
    workflowUrl?: string;
    workflowId?: string;
    requiresAuth?: boolean;
    instanceUrl?: string;
}

export interface N8NWorkflow {
    id: string;
    name: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    nodes?: any[];
    connections?: any;
    settings?: any;
    instanceId: number;
    instanceName: string;
    instancePort: number;
    workflowUrl: string;
}

const workflowsApi = {
    import: async (data: ImportWorkflowRequest): Promise<ImportWorkflowResponse> => {
        const response = await api.post('/workflows/import', data);
        return response.data;
    },

    list: async (): Promise<{ workflows: N8NWorkflow[] }> => {
        const response = await api.get('/workflows/list');
        return response.data;
    }
};

export default workflowsApi;
