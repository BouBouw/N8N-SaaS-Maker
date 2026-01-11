const express = require('express');
const memberService = require('../services/memberService');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Search users
router.get('/search', isAuthenticated, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({ users: [] });
        }

        const users = await memberService.searchUsers(q);
        res.json({ users });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Erreur lors de la recherche' });
    }
});

// Get instance members
router.get('/instance/:instanceId', isAuthenticated, async (req, res) => {
    try {
        const { instanceId } = req.params;

        // Check if user is owner or member
        const isOwner = await memberService.isInstanceOwner(req.session.userId, instanceId);
        const isMember = await memberService.isMemberOfInstance(req.session.userId, instanceId);

        if (!isOwner && !isMember) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const members = await memberService.getInstanceMembers(instanceId);
        res.json({ members });
    } catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des membres' });
    }
});

// Invite member
router.post('/invite', isAuthenticated, async (req, res) => {
    try {
        const { instanceId, email, role } = req.body;

        // Check if user is owner or admin
        const isOwner = await memberService.isInstanceOwner(req.session.userId, instanceId);
        const memberRole = await memberService.getMemberRole(req.session.userId, instanceId);
        
        if (!isOwner && memberRole !== 'admin') {
            return res.status(403).json({ error: 'Seul le propriétaire ou un administrateur peut inviter des membres' });
        }

        const result = await memberService.inviteMember(
            instanceId,
            email,
            role || 'viewer',
            req.session.userId
        );

        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Invite member error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de l\'invitation' });
    }
});

// Accept invitation
router.post('/accept-invitation', isAuthenticated, async (req, res) => {
    try {
        const { token } = req.body;

        const invitation = await memberService.acceptInvitation(token, req.session.userId);
        res.json({ success: true, invitation });
    } catch (error) {
        console.error('Accept invitation error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de l\'acceptation' });
    }
});

// Decline invitation
router.post('/decline-invitation', isAuthenticated, async (req, res) => {
    try {
        const { token } = req.body;

        const invitation = await memberService.declineInvitation(token, req.session.userId);
        res.json({ success: true, invitation });
    } catch (error) {
        console.error('Decline invitation error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors du refus' });
    }
});

// Accept invitation with new account (public route)
router.post('/accept-invitation-new', async (req, res) => {
    try {
        const { token, name, password } = req.body;

        if (!name || !password || password.length < 6) {
            return res.status(400).json({ error: 'Données invalides' });
        }

        const result = await memberService.acceptInvitationWithNewAccount(token, name, password);
        
        // Auto-login the new user
        req.session.userId = result.userId;
        req.session.isAuthenticated = true;

        res.json({ success: true, userId: result.userId, instanceId: result.instanceId });
    } catch (error) {
        console.error('Accept invitation with new account error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de la création du compte' });
    }
});

// Get invitation details (public route for checking token validity)
router.get('/invitation/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const pool = require('../config/database');

        const [invitations] = await pool.query(
            `SELECT im.email, im.role, i.name as instance_name, u.name as inviter_name
             FROM instance_members im
             JOIN n8n_instances i ON im.instance_id = i.id
             JOIN users u ON im.invited_by = u.id
             WHERE im.invitation_token = ? AND im.status = 'pending'`,
            [token]
        );

        if (invitations.length === 0) {
            return res.status(404).json({ error: 'Invitation invalide ou expirée' });
        }

        res.json({ invitation: invitations[0] });
    } catch (error) {
        console.error('Get invitation error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération de l\'invitation' });
    }
});

// Remove member
router.delete('/:memberId', isAuthenticated, async (req, res) => {
    try {
        const { memberId } = req.params;
        const { instanceId } = req.body;

        // Check if user is owner or admin
        const isOwner = await memberService.isInstanceOwner(req.session.userId, instanceId);
        const memberRole = await memberService.getMemberRole(req.session.userId, instanceId);
        
        if (!isOwner && memberRole !== 'admin') {
            return res.status(403).json({ error: 'Seul le propriétaire ou un administrateur peut retirer des membres' });
        }

        await memberService.removeMember(instanceId, memberId, req.session.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// Update member role
router.patch('/:memberId/role', isAuthenticated, async (req, res) => {
    try {
        const { memberId } = req.params;
        const { instanceId, role } = req.body;

        // Check if user is owner or admin
        const isOwner = await memberService.isInstanceOwner(req.session.userId, instanceId);
        const memberRole = await memberService.getMemberRole(req.session.userId, instanceId);
        
        if (!isOwner && memberRole !== 'admin') {
            return res.status(403).json({ error: 'Seul le propriétaire ou un administrateur peut modifier les rôles' });
        }

        await memberService.updateMemberRole(instanceId, memberId, role);
        res.json({ success: true });
    } catch (error) {
        console.error('Update member role error:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

// Get user notifications
router.get('/notifications', isAuthenticated, async (req, res) => {
    try {
        const notifications = await memberService.getUserNotifications(req.session.userId);
        res.json({ notifications });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des notifications' });
    }
});

// Mark notification as read
router.patch('/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
        await memberService.markNotificationAsRead(req.params.id, req.session.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

// Delete notification
router.delete('/notifications/:id', isAuthenticated, async (req, res) => {
    try {
        await memberService.deleteNotification(req.params.id, req.session.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

module.exports = router;
