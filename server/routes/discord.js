const express = require('express');
const axios = require('axios');
const router = express.Router();
const discordService = require('../services/discordService');
const { isAuthenticated } = require('../middleware/auth');
const pool = require('../config/database');

const BOT_URL = process.env.BOT_URL || 'http://localhost:3002';

/**
 * GET /discord/auth-url
 * Get Discord OAuth2 authorization URL
 */
router.get('/auth-url', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const authUrl = discordService.getAuthorizationUrl(userId);

        res.json({ url: authUrl });
    } catch (error) {
        console.error('Discord auth URL error:', error);
        res.status(500).json({ error: 'Failed to generate Discord authorization URL' });
    }
});

/**
 * POST /discord/callback
 * Handle Discord OAuth2 callback
 */
router.post('/callback', isAuthenticated, async (req, res) => {
    try {
        const { code, state } = req.body;
        const userId = req.session.userId;

        // Verify state matches user ID
        if (state !== userId.toString()) {
            return res.status(400).json({ error: 'Invalid state parameter' });
        }

        if (!code) {
            return res.status(400).json({ error: 'Authorization code is required' });
        }

        // Link Discord account
        const discordUser = await discordService.linkDiscordAccount(userId, code);

        res.json({
            message: 'Discord account linked successfully',
            discord: discordUser
        });
    } catch (error) {
        console.error('Discord callback error:', error);
        res.status(500).json({ error: error.message || 'Failed to link Discord account' });
    }
});

/**
 * GET /discord/connection
 * Get user's Discord connection info
 */
router.get('/connection', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        const connection = await discordService.getDiscordConnection(userId);

        if (!connection) {
            return res.json({ connected: false, discord: null });
        }

        res.json({ connected: true, discord: connection });
    } catch (error) {
        console.error('Discord connection fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch Discord connection' });
    }
});

/**
 * DELETE /discord/unlink
 * Unlink Discord account
 */
router.delete('/unlink', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;
        await discordService.unlinkDiscordAccount(userId);

        res.json({ message: 'Discord account unlinked successfully' });
    } catch (error) {
        console.error('Discord unlink error:', error);
        res.status(500).json({ error: 'Failed to unlink Discord account' });
    }
});

// ===== ROUTES POUR LE BOT DISCORD =====

/**
 * DELETE /discord/user/:discordId/unlink
 * Délier un compte Discord (depuis le bot)
 */
router.delete('/user/:discordId/unlink', async (req, res) => {
    try {
        const { discordId } = req.params;

        // Mettre à jour l'utilisateur en retirant le discord_id
        const [result] = await pool.query(
            'UPDATE users SET discord_id = NULL WHERE discord_id = ?',
            [discordId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Compte Discord non trouvé' });
        }

        // Retirer les rôles Discord
        try {
            await axios.delete(`${BOT_URL}/discord-role/${discordId}`, {
                timeout: 5000
            });
            console.log('✅ Discord roles removed for:', discordId);
        } catch (roleError) {
            console.error('⚠️ Failed to remove Discord roles:', roleError.message);
            // Ne pas bloquer le délinkage si le retrait des rôles échoue
        }

        res.json({ 
            success: true,
            message: 'Compte Discord délié avec succès' 
        });
    } catch (error) {
        console.error('Erreur /discord/user/unlink:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /discord/user/:discordId
 * Obtenir les informations d'un utilisateur via son Discord ID
 */
router.get('/user/:discordId', async (req, res) => {
    try {
        const { discordId } = req.params;

        // Vérifier si l'utilisateur existe et est lié
        const [users] = await pool.query(
            `SELECT u.id, u.name, u.email, u.created_at, u.discord_id,
                    COUNT(DISTINCT ni.id) as instance_count,
                    COUNT(DISTINCT f.id) as favorites_count,
                    s.plan as plan
             FROM users u
             LEFT JOIN n8n_instances ni ON u.id = ni.user_id
             LEFT JOIN resource_likes f ON u.id = f.user_id
             LEFT JOIN user_subscriptions s ON u.id = s.user_id
             WHERE u.discord_id = ?
             GROUP BY u.id`,
            [discordId]
        );

        if (users.length === 0) {
            return res.json({ linked: false });
        }

        res.json({
            linked: true,
            user: users[0]
        });
    } catch (error) {
        console.error('Erreur /discord/user:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /discord/user/:discordId/instances
 * Obtenir les instances d'un utilisateur
 */
router.get('/user/:discordId/instances', async (req, res) => {
    try {
        const { discordId } = req.params;

        // Vérifier l'utilisateur
        const [users] = await pool.query('SELECT id FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0) {
            return res.json({ linked: false });
        }

        const userId = users[0].id;

        // Récupérer les instances
        const [instances] = await pool.query(
            `SELECT ni.*, 
                    EXISTS(SELECT 1 FROM api_keys WHERE instance_id = ni.id) as has_api_key
             FROM n8n_instances ni
             WHERE ni.user_id = ?
             ORDER BY ni.created_at DESC`,
            [userId]
        );

        res.json({
            linked: true,
            instances: instances.map(inst => ({
                ...inst,
                has_api_key: !!inst.has_api_key
            }))
        });
    } catch (error) {
        console.error('Erreur /discord/user/instances:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /discord/user/:discordId/instance/:identifier
 * Obtenir une instance spécifique
 */
router.get('/user/:discordId/instance/:identifier', async (req, res) => {
    try {
        const { discordId, identifier } = req.params;

        // Vérifier l'utilisateur
        const [users] = await pool.query('SELECT id FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0) {
            return res.json({ linked: false });
        }

        const userId = users[0].id;

        // Récupérer l'instance (par ID ou subdomain)
        const [instances] = await pool.query(
            `SELECT ni.*, 
                    EXISTS(SELECT 1 FROM api_keys WHERE instance_id = ni.id) as has_api_key
             FROM n8n_instances ni
             WHERE ni.user_id = ? AND (ni.subdomain = ? OR ni.id = ?)`,
            [userId, identifier, identifier]
        );

        if (instances.length === 0) {
            return res.json({ linked: true, instance: null });
        }

        res.json({
            linked: true,
            instance: {
                ...instances[0],
                has_api_key: !!instances[0].has_api_key
            }
        });
    } catch (error) {
        console.error('Erreur /discord/user/instance:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /discord/resources/search
 * Rechercher dans les ressources
 */
router.get('/resources/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json({ resources: [] });
        }

        const searchTerm = `%${q}%`;

        const [resources] = await pool.query(
            `SELECT r.*, u.name as author_name
             FROM resources r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE r.is_public = 1 
             AND (r.title LIKE ? OR r.description LIKE ? OR r.type LIKE ?)
             ORDER BY r.created_at DESC
             LIMIT 50`,
            [searchTerm, searchTerm, searchTerm]
        );

        res.json({ resources });
    } catch (error) {
        console.error('Erreur /discord/resources/search:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /discord/resources
 * Obtenir toutes les ressources (avec filtres)
 */
router.get('/resources', async (req, res) => {
    try {
        const { type, free } = req.query;
        
        let whereConditions = ['r.is_public = 1'];
        let params = [];

        if (type && type !== 'all') {
            whereConditions.push('r.type = ?');
            params.push(type);
        }

        if (free === 'true') {
            whereConditions.push('r.is_free = 1');
        } else if (free === 'false') {
            whereConditions.push('r.is_free = 0');
        }

        const whereClause = whereConditions.join(' AND ');

        const [resources] = await pool.query(
            `SELECT r.*, u.name as author_name
             FROM resources r
             LEFT JOIN users u ON r.user_id = u.id
             WHERE ${whereClause}
             ORDER BY r.created_at DESC
             LIMIT 100`,
            params
        );

        res.json({ resources });
    } catch (error) {
        console.error('Erreur /discord/resources:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /discord/user/:discordId/favorites/:resourceId
 * Ajouter aux favoris
 */
router.post('/user/:discordId/favorites/:resourceId', async (req, res) => {
    try {
        const { discordId, resourceId } = req.params;

        // Vérifier l'utilisateur
        const [users] = await pool.query('SELECT id FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const userId = users[0].id;

        // Vérifier si déjà en favoris
        const [existing] = await pool.query(
            'SELECT id FROM resource_likes WHERE user_id = ? AND resource_id = ?',
            [userId, resourceId]
        );

        if (existing.length > 0) {
            return res.json({ success: true, message: 'Déjà en favoris' });
        }

        // Ajouter aux favoris
        await pool.query(
            'INSERT INTO resource_likes (user_id, resource_id) VALUES (?, ?)',
            [userId, resourceId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur /discord/user/favorites:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /discord/user/:discordId/favorites
 * Obtenir les favoris
 */
router.get('/user/:discordId/favorites', async (req, res) => {
    try {
        const { discordId } = req.params;

        // Vérifier l'utilisateur
        const [users] = await pool.query('SELECT id FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0) {
            return res.json({ linked: false });
        }

        const userId = users[0].id;

        // Récupérer les favoris
        const [favorites] = await pool.query(
            `SELECT f.id, f.created_at, r.*, u.name as author_name
             FROM resource_likes f
             JOIN resources r ON f.resource_id = r.id
             LEFT JOIN users u ON r.user_id = u.id
             WHERE f.user_id = ?
             ORDER BY f.created_at DESC`,
            [userId]
        );

        res.json({
            linked: true,
            favorites: favorites.map(fav => ({
                id: fav.id,
                created_at: fav.created_at,
                resource: {
                    id: fav.resource_id,
                    name: fav.name,
                    description: fav.description,
                    type: fav.type,
                    category: fav.category,
                    is_free: fav.is_free,
                    price: fav.price,
                    preview_image: fav.preview_image,
                    rating: fav.rating,
                    review_count: fav.review_count,
                    author_name: fav.author_name
                }
            }))
        });
    } catch (error) {
        console.error('Erreur /discord/user/favorites:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /discord/user/:discordId/favorites/:resourceId
 * Retirer des favoris
 */
router.delete('/user/:discordId/favorites/:resourceId', async (req, res) => {
    try {
        const { discordId, resourceId } = req.params;

        // Vérifier l'utilisateur
        const [users] = await pool.query('SELECT id FROM users WHERE discord_id = ?', [discordId]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }

        const userId = users[0].id;

        // Retirer des favoris
        await pool.query(
            'DELETE FROM resource_likes WHERE user_id = ? AND resource_id = ?',
            [userId, resourceId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Erreur /discord/user/favorites/delete:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
