const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Middleware to check admin/support role
const isAdminOrSupport = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Non authentifié' });
    }
    next();
};

// Middleware to check admin role only
const isAdmin = async (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    try {
        const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [req.session.userId]);
        if (!users.length || users[0].role !== 'admin') {
            return res.status(403).json({ error: 'Accès refusé - Admin uniquement' });
        }
        next();
    } catch (error) {
        console.error('Error checking admin role:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

// Get dashboard stats (support & admin)
router.get('/stats', isAdminOrSupport, async (req, res) => {
    try {
        // Total users
        const [totalUsers] = await pool.query('SELECT COUNT(*) as count FROM users');
        
        // Total instances
        const [totalInstances] = await pool.query('SELECT COUNT(*) as count FROM n8n_instances');
        
        // Running instances
        const [runningInstances] = await pool.query('SELECT COUNT(*) as count FROM n8n_instances WHERE status = "running"');
        
        // Total workflows (from activities)
        const [totalWorkflows] = await pool.query('SELECT COUNT(*) as count FROM activities WHERE action = "workflow_executed"');
        
        // Users by plan
        const [usersByPlan] = await pool.query(`
            SELECT 
                COALESCE(us.plan, 'free') as plan,
                COUNT(*) as count
            FROM users u
            LEFT JOIN user_subscriptions us ON u.id = us.user_id
            GROUP BY plan
        `);
        
        // Recent activities
        const [recentActivities] = await pool.query(`
            SELECT 
                a.id,
                a.action,
                a.title,
                a.metadata,
                a.created_at,
                u.name as user_name,
                u.email as user_email
            FROM activities a
            JOIN users u ON a.user_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 10
        `);

        res.json({
            stats: {
                totalUsers: totalUsers[0].count,
                totalInstances: totalInstances[0].count,
                runningInstances: runningInstances[0].count,
                totalWorkflows: totalWorkflows[0].count,
                usersByPlan
            },
            recentActivities
        });
    } catch (error) {
        console.error('Error getting admin stats:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

// Get all users (support & admin)
router.get('/users', isAdminOrSupport, async (req, res) => {
    try {
        const [users] = await pool.query(`
            SELECT 
                u.id,
                u.name,
                u.email,
                u.avatar,
                u.role,
                u.email_verified,
                u.created_at,
                COALESCE(us.plan, 'free') as subscription_plan,
                COUNT(DISTINCT i.id) as instances_count
            FROM users u
            LEFT JOIN user_subscriptions us ON u.id = us.user_id
            LEFT JOIN n8n_instances i ON u.id = i.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);

        res.json({ users });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
    }
});

// Update user role (admin only)
router.patch('/users/:userId/role', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!['user', 'support', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Rôle invalide' });
        }

        await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

        res.json({ success: true, message: 'Rôle mis à jour' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du rôle' });
    }
});

// Update user (admin only)
router.patch('/users/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, password, role } = req.body;

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (name) {
            updates.push('name = ?');
            values.push(name);
        }

        if (email) {
            updates.push('email = ?');
            values.push(email);
        }

        if (password) {
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            values.push(hashedPassword);
        }

        if (role && ['user', 'support', 'admin'].includes(role)) {
            updates.push('role = ?');
            values.push(role);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
        }

        values.push(userId);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

        res.json({ success: true, message: 'Utilisateur mis à jour' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour de l\'utilisateur' });
    }
});

// Delete user (admin only)
router.delete('/users/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // Don't allow deleting yourself
        if (parseInt(userId) === req.session.userId) {
            return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
        }

        // Delete user's instances, activities, etc. (cascade or manual)
        await pool.query('DELETE FROM activities WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM n8n_instances WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM user_subscriptions WHERE user_id = ?', [userId]);
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ success: true, message: 'Utilisateur supprimé' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur' });
    }
});

// Get all instances (support & admin)
router.get('/instances', isAdminOrSupport, async (req, res) => {
    try {
        const [instances] = await pool.query(`
            SELECT 
                i.*,
                u.name as user_name,
                u.email as user_email,
                COUNT(DISTINCT a.id) as workflows_count
            FROM n8n_instances i
            JOIN users u ON i.user_id = u.id
            LEFT JOIN activities a ON i.id = a.instance_id AND a.action = 'workflow_executed'
            GROUP BY i.id
            ORDER BY i.created_at DESC
        `);

        res.json({ instances });
    } catch (error) {
        console.error('Error getting instances:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des instances' });
    }
});

// Grant access to instance (admin only)
router.post('/instances/:instanceId/grant-access', isAdmin, async (req, res) => {
    try {
        const { instanceId } = req.params;
        const adminId = req.session.userId;

        // Check if instance exists
        const [instances] = await pool.query('SELECT * FROM n8n_instances WHERE id = ?', [instanceId]);
        if (!instances.length) {
            return res.status(404).json({ error: 'Instance non trouvée' });
        }

        // Check if access already granted
        const [existing] = await pool.query(
            'SELECT * FROM instance_members WHERE instance_id = ? AND user_id = ?',
            [instanceId, adminId]
        );

        if (existing.length) {
            return res.json({ success: true, message: 'Accès déjà accordé' });
        }

        // Get admin email
        const [adminUser] = await pool.query('SELECT email FROM users WHERE id = ?', [adminId]);
        
        // Grant access
        await pool.query(
            'INSERT INTO instance_members (instance_id, user_id, email, role, status, invited_by) VALUES (?, ?, ?, ?, ?, ?)',
            [instanceId, adminId, adminUser[0].email, 'admin', 'active', adminId]
        );

        res.json({ success: true, message: 'Accès accordé avec succès' });
    } catch (error) {
        console.error('Error granting instance access:', error);
        res.status(500).json({ error: 'Erreur lors de l\'attribution de l\'accès' });
    }
});

// Delete instance (admin only)
router.delete('/instances/:instanceId', isAdmin, async (req, res) => {
    try {
        const { instanceId } = req.params;

        // Delete related data
        await pool.query('DELETE FROM activities WHERE instance_id = ?', [instanceId]);
        await pool.query('DELETE FROM instance_members WHERE instance_id = ?', [instanceId]);
        await pool.query('DELETE FROM n8n_instances WHERE id = ?', [instanceId]);

        res.json({ success: true, message: 'Instance supprimée' });
    } catch (error) {
        console.error('Error deleting instance:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression de l\'instance' });
    }
});

// Get all workflows (support & admin)
router.get('/workflows', isAdminOrSupport, async (req, res) => {
    try {
        const [workflows] = await pool.query(`
            SELECT 
                a.id,
                a.title,
                a.metadata,
                a.created_at,
                u.name as user_name,
                u.email as user_email,
                i.name as instance_name,
                i.uuid as instance_uuid
            FROM activities a
            JOIN users u ON a.user_id = u.id
            LEFT JOIN n8n_instances i ON a.instance_id = i.id
            WHERE a.action = 'workflow_executed'
            ORDER BY a.created_at DESC
            LIMIT 100
        `);

        // Parse metadata
        const workflowsWithMeta = workflows.map(w => ({
            ...w,
            metadata: w.metadata ? JSON.parse(w.metadata) : null
        }));

        res.json({ workflows: workflowsWithMeta });
    } catch (error) {
        console.error('Error getting workflows:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des workflows' });
    }
});

module.exports = router;
