const pool = require('../config/database');
const crypto = require('crypto');
const emailService = require('./emailService');

class MemberService {
    /**
     * Generate invitation token
     */
    generateToken() {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Search users by name or email
     */
    async searchUsers(query, limit = 10) {
        try {
            const searchTerm = `%${query}%`;
            const [users] = await pool.query(
                `SELECT id, name, email, created_at 
                 FROM users 
                 WHERE (name LIKE ? OR email LIKE ?) 
                 LIMIT ?`,
                [searchTerm, searchTerm, limit]
            );
            return users;
        } catch (error) {
            console.error('❌ Error searching users:', error);
            throw error;
        }
    }

    /**
     * Get instance members
     */
    async getInstanceMembers(instanceId) {
        try {
            // Get instance owner first
            const [instances] = await pool.query(
                `SELECT user_id as owner_id, u.name as owner_name, u.email as owner_email, u.avatar as owner_avatar, u.discord_id as owner_discord_id
                 FROM n8n_instances i
                 JOIN users u ON i.user_id = u.id
                 WHERE i.id = ?`,
                [instanceId]
            );

            const owner = instances.length > 0 ? {
                id: 0,
                instance_id: instanceId,
                user_id: instances[0].owner_id,
                user_name: instances[0].owner_name,
                user_email: instances[0].owner_email,
                user_avatar: instances[0].owner_avatar,
                user_discord_id: instances[0].owner_discord_id,
                email: instances[0].owner_email,
                role: 'owner',
                status: 'active',
                invited_by: null,
                inviter_name: null,
                invited_at: null,
                is_owner: true
            } : null;

            // Get invited members
            const [members] = await pool.query(
                `SELECT 
                    im.*,
                    u.name as user_name,
                    u.email as user_email,
                    u.avatar as user_avatar,
                    u.discord_id as user_discord_id,
                    inviter.name as inviter_name,
                    false as is_owner
                 FROM instance_members im
                 LEFT JOIN users u ON im.user_id = u.id
                 LEFT JOIN users inviter ON im.invited_by = inviter.id
                 WHERE im.instance_id = ?
                 ORDER BY im.invited_at DESC`,
                [instanceId]
            );

            // Return owner first, then members
            return owner ? [owner, ...members] : members;
        } catch (error) {
            console.error('❌ Error fetching members:', error);
            throw error;
        }
    }

    /**
     * Check if user is member of instance
     */
    async isMemberOfInstance(userId, instanceId) {
        try {
            const [members] = await pool.query(
                `SELECT id FROM instance_members 
                 WHERE instance_id = ? AND user_id = ? AND status = 'active'`,
                [instanceId, userId]
            );
            return members.length > 0;
        } catch (error) {
            console.error('❌ Error checking membership:', error);
            return false;
        }
    }

    /**
     * Check if user owns the instance
     */
    async isInstanceOwner(userId, instanceId) {
        try {
            const [instances] = await pool.query(
                `SELECT id FROM n8n_instances WHERE id = ? AND user_id = ?`,
                [instanceId, userId]
            );
            return instances.length > 0;
        } catch (error) {
            console.error('❌ Error checking ownership:', error);
            return false;
        }
    }

    /**
     * Get member role for instance
     */
    async getMemberRole(userId, instanceId) {
        try {
            // Check if owner first
            const isOwner = await this.isInstanceOwner(userId, instanceId);
            if (isOwner) return 'owner';
            
            // Check member role
            const [members] = await pool.query(
                `SELECT role FROM instance_members 
                 WHERE user_id = ? AND instance_id = ? AND status = 'active'`,
                [userId, instanceId]
            );
            return members.length > 0 ? members[0].role : null;
        } catch (error) {
            console.error('❌ Error getting member role:', error);
            return null;
        }
    }

    /**
     * Invite member to instance
     */
    async inviteMember(instanceId, email, role, invitedBy) {
        try {
            // Get instance details
            const [instances] = await pool.query(
                `SELECT i.*, u.name as owner_name 
                 FROM n8n_instances i 
                 JOIN users u ON i.user_id = u.id 
                 WHERE i.id = ?`,
                [instanceId]
            );

            if (instances.length === 0) {
                throw new Error('Instance not found');
            }

            const instance = instances[0];

            // Check if already invited
            const [existing] = await pool.query(
                `SELECT id FROM instance_members 
                 WHERE instance_id = ? AND email = ?`,
                [instanceId, email]
            );

            if (existing.length > 0) {
                throw new Error('User already invited');
            }

            // Check if user exists
            const [users] = await pool.query(
                `SELECT id, name FROM users WHERE email = ?`,
                [email]
            );

            const user = users.length > 0 ? users[0] : null;
            const token = this.generateToken();
            const invitationLink = `${process.env.FRONTEND_URL}/accept-invitation/${token}`;

            // Get inviter name
            const [inviters] = await pool.query(
                `SELECT name FROM users WHERE id = ?`,
                [invitedBy]
            );
            const inviterName = inviters[0]?.name || 'Someone';

            // Insert invitation
            await pool.query(
                `INSERT INTO instance_members 
                 (instance_id, user_id, email, role, status, invitation_token, invited_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    instanceId,
                    user?.id || null,
                    email,
                    role,
                    'pending',
                    token,
                    invitedBy
                ]
            );

            // Send email
            await emailService.sendInvitationEmail(
                email,
                instance.name,
                inviterName,
                invitationLink,
                !user // isNewUser
            );

            // Create notification if user exists
            if (user) {
                await this.createNotification(
                    user.id,
                    'instance_invitation',
                    `Invitation à rejoindre "${instance.name}"`,
                    `${inviterName} vous a invité à rejoindre l'instance "${instance.name}"`,
                    { instanceId, token }
                );
            }

            console.log(`✅ Member invited: ${email} to instance ${instance.name}`);
            return { token, invitationLink };
        } catch (error) {
            console.error('❌ Error inviting member:', error);
            throw error;
        }
    }

    /**
     * Accept invitation
     */
    async acceptInvitation(token, userId) {
        try {
            // Find invitation
            const [invitations] = await pool.query(
                `SELECT im.*, i.name as instance_name 
                 FROM instance_members im
                 JOIN n8n_instances i ON im.instance_id = i.id
                 WHERE im.invitation_token = ? AND im.status = 'pending'`,
                [token]
            );

            if (invitations.length === 0) {
                throw new Error('Invalid or expired invitation');
            }

            const invitation = invitations[0];

            // Check if invitation is for this user
            const [users] = await pool.query(
                `SELECT email FROM users WHERE id = ?`,
                [userId]
            );

            if (users.length === 0 || users[0].email !== invitation.email) {
                throw new Error('This invitation is not for you');
            }

            // Update invitation
            await pool.query(
                `UPDATE instance_members 
                 SET status = 'active', 
                     user_id = ?, 
                     accepted_at = NOW(),
                     invitation_token = NULL
                 WHERE id = ?`,
                [userId, invitation.id]
            );

            // Send welcome email
            await emailService.sendWelcomeEmail(
                invitation.email,
                users[0].name,
                invitation.instance_name
            );

            // Create notification
            await this.createNotification(
                userId,
                'member_added',
                'Vous avez rejoint une instance',
                `Vous êtes maintenant membre de l'instance "${invitation.instance_name}"`,
                { instanceId: invitation.instance_id }
            );

            console.log(`✅ Invitation accepted by user ${userId}`);
            return invitation;
        } catch (error) {
            console.error('❌ Error accepting invitation:', error);
            throw error;
        }
    }

    /**
     * Decline invitation
     */
    async declineInvitation(token, userId) {
        try {
            // Find invitation
            const [invitations] = await pool.query(
                `SELECT im.*, i.name as instance_name 
                 FROM instance_members im
                 JOIN n8n_instances i ON im.instance_id = i.id
                 WHERE im.invitation_token = ? AND im.status = 'pending'`,
                [token]
            );

            if (invitations.length === 0) {
                throw new Error('Invalid or expired invitation');
            }

            const invitation = invitations[0];

            // Check if invitation is for this user
            const [users] = await pool.query(
                `SELECT email FROM users WHERE id = ?`,
                [userId]
            );

            if (users.length === 0 || users[0].email !== invitation.email) {
                throw new Error('This invitation is not for you');
            }

            // Update invitation status to declined
            await pool.query(
                `UPDATE instance_members 
                 SET status = 'declined',
                     invitation_token = NULL
                 WHERE id = ?`,
                [invitation.id]
            );

            console.log(`✅ Invitation declined by user ${userId}`);
            return invitation;
        } catch (error) {
            console.error('❌ Error declining invitation:', error);
            throw error;
        }
    }

    /**
     * Accept invitation and create account (for new users)
     */
    async acceptInvitationWithNewAccount(token, name, password) {
        try {
            // Find invitation
            const [invitations] = await pool.query(
                `SELECT im.*, i.name as instance_name 
                 FROM instance_members im
                 JOIN n8n_instances i ON im.instance_id = i.id
                 WHERE im.invitation_token = ? AND im.status = 'pending'`,
                [token]
            );

            if (invitations.length === 0) {
                throw new Error('Invalid or expired invitation');
            }

            const invitation = invitations[0];

            // Check if user already exists
            const [existingUsers] = await pool.query(
                `SELECT id FROM users WHERE email = ?`,
                [invitation.email]
            );

            if (existingUsers.length > 0) {
                throw new Error('User already exists. Please login and accept the invitation.');
            }

            // Hash password
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const [userResult] = await pool.query(
                `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
                [name, invitation.email, hashedPassword]
            );

            const userId = userResult.insertId;

            // Create free subscription for new user
            await pool.query(
                `INSERT INTO user_subscriptions (user_id, plan) VALUES (?, 'free')`,
                [userId]
            );

            // Update invitation
            await pool.query(
                `UPDATE instance_members 
                 SET status = 'active', 
                     user_id = ?, 
                     accepted_at = NOW(),
                     invitation_token = NULL
                 WHERE id = ?`,
                [userId, invitation.id]
            );

            // Send welcome email
            await emailService.sendWelcomeEmail(
                invitation.email,
                name,
                invitation.instance_name
            );

            console.log(`✅ New user created and invitation accepted: ${invitation.email}`);
            return { userId, instanceId: invitation.instance_id };
        } catch (error) {
            console.error('❌ Error accepting invitation with new account:', error);
            throw error;
        }
    }

    /**
     * Remove member from instance
     */
    async removeMember(instanceId, memberId, removedBy) {
        try {
            const [members] = await pool.query(
                `SELECT im.*, u.name, u.email 
                 FROM instance_members im
                 LEFT JOIN users u ON im.user_id = u.id
                 WHERE im.id = ? AND im.instance_id = ?`,
                [memberId, instanceId]
            );

            if (members.length === 0) {
                throw new Error('Member not found');
            }

            const member = members[0];

            await pool.query(
                `DELETE FROM instance_members WHERE id = ?`,
                [memberId]
            );

            // Create notification
            if (member.user_id) {
                await this.createNotification(
                    member.user_id,
                    'member_removed',
                    'Vous avez été retiré d\'une instance',
                    `Vous n'êtes plus membre de cette instance`,
                    { instanceId }
                );
            }

            console.log(`✅ Member removed: ${member.email}`);
        } catch (error) {
            console.error('❌ Error removing member:', error);
            throw error;
        }
    }

    /**
     * Update member role
     */
    async updateMemberRole(instanceId, memberId, newRole) {
        try {
            await pool.query(
                `UPDATE instance_members 
                 SET role = ? 
                 WHERE id = ? AND instance_id = ?`,
                [newRole, memberId, instanceId]
            );

            console.log(`✅ Member role updated: ${memberId} -> ${newRole}`);
        } catch (error) {
            console.error('❌ Error updating member role:', error);
            throw error;
        }
    }

    /**
     * Create notification
     */
    async createNotification(userId, type, title, message, metadata = null) {
        try {
            await pool.query(
                `INSERT INTO member_notifications 
                 (user_id, type, title, message, metadata)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, type, title, message, metadata ? JSON.stringify(metadata) : null]
            );
        } catch (error) {
            console.error('❌ Error creating notification:', error);
        }
    }

    /**
     * Get user notifications
     */
    async getUserNotifications(userId, limit = 20) {
        try {
            const [notifications] = await pool.query(
                `SELECT * FROM member_notifications 
                 WHERE user_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT ?`,
                [userId, limit]
            );
            return notifications;
        } catch (error) {
            console.error('❌ Error fetching notifications:', error);
            throw error;
        }
    }

    /**
     * Mark notification as read
     */
    async markNotificationAsRead(notificationId, userId) {
        try {
            await pool.query(
                `UPDATE member_notifications 
                 SET is_read = TRUE 
                 WHERE id = ? AND user_id = ?`,
                [notificationId, userId]
            );
        } catch (error) {
            console.error('❌ Error marking notification as read:', error);
            throw error;
        }
    }

    /**
     * Delete notification
     */
    async deleteNotification(notificationId, userId) {
        try {
            await pool.query(
                `DELETE FROM member_notifications 
                 WHERE id = ? AND user_id = ?`,
                [notificationId, userId]
            );
        } catch (error) {
            console.error('❌ Error deleting notification:', error);
            throw error;
        }
    }
}

module.exports = new MemberService();
