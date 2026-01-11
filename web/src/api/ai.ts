import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface Conversation {
    id: number;
    user_id: number;
    title: string;
    model_type: 'workflow_generator' | 'prompt_generator' | 'general';
    message_count: number;
    created_at: string;
    updated_at: string;
}

export interface Message {
    id: number;
    conversation_id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: any;
    created_at: string;
}

export interface Template {
    id: number;
    name: string;
    description: string;
    category: 'workflow_generator' | 'prompt_generator';
    prompt_template: string;
    example_output?: string;
    tags: string[];
    usage_count: number;
    created_at: string;
}

export const aiApi = {
    // Conversations
    async getConversations(): Promise<{ conversations: Conversation[] }> {
        const response = await axios.get(`${API_URL}/ai/conversations`, {
            withCredentials: true
        });
        return response.data;
    },

    async createConversation(title?: string, modelType?: string): Promise<{ conversationId: number }> {
        const response = await axios.post(
            `${API_URL}/ai/conversations`,
            { title, modelType },
            { withCredentials: true }
        );
        return response.data;
    },

    async getConversation(id: number): Promise<{ conversation: Conversation; messages: Message[] }> {
        const response = await axios.get(`${API_URL}/ai/conversations/${id}`, {
            withCredentials: true
        });
        return response.data;
    },

    async sendMessage(conversationId: number, content: string): Promise<{ messages: Message[] }> {
        const response = await axios.post(
            `${API_URL}/ai/conversations/${conversationId}/messages`,
            { content },
            { withCredentials: true }
        );
        return response.data;
    },

    async updateConversation(id: number, title: string): Promise<void> {
        await axios.patch(
            `${API_URL}/ai/conversations/${id}`,
            { title },
            { withCredentials: true }
        );
    },

    async deleteConversation(id: number): Promise<void> {
        await axios.delete(`${API_URL}/ai/conversations/${id}`, {
            withCredentials: true
        });
    },

    // Templates
    async getTemplates(category?: string): Promise<{ templates: Template[] }> {
        const response = await axios.get(`${API_URL}/ai/templates`, {
            params: { category },
            withCredentials: true
        });
        return response.data;
    },

    async useTemplate(id: number): Promise<void> {
        await axios.post(
            `${API_URL}/ai/templates/${id}/use`,
            {},
            { withCredentials: true }
        );
    }
};
