import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export interface User {
    id: number;
    name: string;
    email: string;
    created_at: string;
}

export interface Member {
    id: number;
    instance_id: number;
    user_id: number;
    email: string;
    role: 'admin' | 'editor' | 'viewer' | 'owner';
    status: 'pending' | 'active' | 'declined';
    invitation_token?: string;
    invited_at: string;
    accepted_at?: string;
    user_name?: string;
    user_email?: string;
    user_avatar?: string;
    user_discord_id?: string;
    inviter_name?: string;
    is_owner?: boolean;
}

export interface Notification {
    id: number;
    user_id: number;
    type: string;
    title: string;
    message: string;
    metadata: any;
    is_read: boolean;
    created_at: string;
}

export const membersApi = {
    // Search users
    async searchUsers(query: string): Promise<{ users: User[] }> {
        const response = await axios.get(`${API_URL}/members/search`, {
            params: { q: query },
            withCredentials: true
        });
        return response.data;
    },

    // Get instance members
    async getInstanceMembers(instanceId: number): Promise<{ members: Member[] }> {
        const response = await axios.get(`${API_URL}/members/instance/${instanceId}`, {
            withCredentials: true
        });
        return response.data;
    },

    // Invite member
    async inviteMember(instanceId: number, email: string, role: string): Promise<any> {
        const response = await axios.post(
            `${API_URL}/members/invite`,
            { instanceId, email, role },
            { withCredentials: true }
        );
        return response.data;
    },

    // Accept invitation
    async acceptInvitation(token: string): Promise<any> {
        const response = await axios.post(
            `${API_URL}/members/accept-invitation`,
            { token },
            { withCredentials: true }
        );
        return response.data;
    },

    // Decline invitation
    async declineInvitation(token: string): Promise<any> {
        const response = await axios.post(
            `${API_URL}/members/decline-invitation`,
            { token },
            { withCredentials: true }
        );
        return response.data;
    },

    // Remove member
    async removeMember(memberId: number, instanceId: number): Promise<void> {
        await axios.delete(`${API_URL}/members/${memberId}`, {
            data: { instanceId },
            withCredentials: true
        });
    },

    // Update member role
    async updateMemberRole(memberId: number, instanceId: number, role: string): Promise<void> {
        await axios.patch(
            `${API_URL}/members/${memberId}/role`,
            { instanceId, role },
            { withCredentials: true }
        );
    },

    // Get notifications
    async getNotifications(): Promise<{ notifications: Notification[] }> {
        const response = await axios.get(`${API_URL}/members/notifications`, {
            withCredentials: true
        });
        return response.data;
    },

    // Mark notification as read
    async markNotificationAsRead(notificationId: number): Promise<void> {
        await axios.patch(
            `${API_URL}/members/notifications/${notificationId}/read`,
            {},
            { withCredentials: true }
        );
    },

    // Delete notification
    async deleteNotification(notificationId: number): Promise<void> {
        await axios.delete(
            `${API_URL}/members/notifications/${notificationId}`,
            { withCredentials: true }
        );
    }
};
