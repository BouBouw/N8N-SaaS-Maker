const express = require('express');
const resourceService = require('../services/resourceService');
const { isAuthenticated } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

const BOT_URL = process.env.BOT_URL || 'http://localhost:3002';

// Get all public resources with filters
router.get('/', async (req, res) => {
    try {
        const { type, price, search, limit, offset } = req.query;
        
        const resources = await resourceService.getResources({
            type,
            price,
            search,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0
        });

        // Add isLiked flag if user is authenticated
        if (req.session?.userId) {
            for (const resource of resources) {
                resource.is_liked = await resourceService.isLikedByUser(
                    resource.id,
                    req.session.userId
                );
            }
        }

        res.json({ resources });
    } catch (error) {
        console.error('Get resources error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des ressources' });
    }
});

// Get resource statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await resourceService.getStats();
        res.json({ stats });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
    }
});

// Get resource by ID
router.get('/:id', async (req, res) => {
    try {
        const resource = await resourceService.getResourceById(req.params.id);
        
        // Add isLiked flag if user is authenticated
        if (req.session?.userId) {
            resource.is_liked = await resourceService.isLikedByUser(
                resource.id,
                req.session.userId
            );
        }

        res.json({ resource });
    } catch (error) {
        console.error('Get resource error:', error);
        res.status(404).json({ error: 'Ressource non trouvée' });
    }
});

// Create new resource (publish)
router.post('/', isAuthenticated, async (req, res) => {
    try {
        const { type, title, description, content, tags, price, priceAmount } = req.body;

        // Validation
        if (!type || !title || !description || !content) {
            return res.status(400).json({ 
                error: 'Type, titre, description et contenu sont requis' 
            });
        }

        if (!['workflow', 'prompt'].includes(type)) {
            return res.status(400).json({ error: 'Type invalide' });
        }

        const resourceId = await resourceService.createResource(req.session.userId, {
            type,
            title,
            description,
            content,
            tags: tags || [],
            price: price || 'free',
            priceAmount: priceAmount || 0
        });

        // Notifier le bot Discord pour créer un post forum
        try {
            const response = await axios.post(`${BOT_URL}/forum-post`, {
                title,
                description,
                tags: tags || [],
                resourceId,
                resourceType: type,
                price: price || 'free',
                priceAmount: priceAmount || 0,
                content: content // Ajouter le contenu pour les ressources gratuites
            }, {
                timeout: 10000
            });
            
            // Sauvegarder le thread ID dans la base de données
            if (response.data.threadId) {
                await resourceService.updateForumThreadId(resourceId, response.data.threadId);
                console.log('✅ Forum post created for resource:', resourceId, '-> Thread:', response.data.threadId);
            }
        } catch (botError) {
            console.error('⚠️ Failed to notify Discord bot:', botError.message);
            // Ne pas échouer la création si le bot ne répond pas
        }

        res.json({ 
            success: true, 
            resourceId,
            message: 'Ressource publiée avec succès !' 
        });
    } catch (error) {
        console.error('Create resource error:', error);
        res.status(500).json({ error: 'Erreur lors de la publication' });
    }
});

// Get user's resources
router.get('/user/me', isAuthenticated, async (req, res) => {
    try {
        const resources = await resourceService.getUserResources(req.session.userId);
        
        // Add isLiked flag
        for (const resource of resources) {
            resource.is_liked = await resourceService.isLikedByUser(
                resource.id,
                req.session.userId
            );
        }
        
        res.json({ resources });
    } catch (error) {
        console.error('Get user resources error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
});

// Update resource
router.patch('/:id', isAuthenticated, async (req, res) => {
    try {
        const { title, description, content, tags, price, priceAmount, isPublic } = req.body;

        await resourceService.updateResource(
            req.params.id,
            req.session.userId,
            { title, description, content, tags, price, priceAmount, isPublic }
        );

        res.json({ success: true, message: 'Ressource mise à jour' });
    } catch (error) {
        console.error('Update resource error:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

// Delete resource
router.delete('/:id', isAuthenticated, async (req, res) => {
    try {
        // Récupérer les infos de la ressource avant suppression
        const resource = await resourceService.getResourceById(req.params.id);
        
        await resourceService.deleteResource(req.params.id, req.session.userId);
        
        // Notifier le bot pour supprimer le thread forum
        if (resource && resource.forum_thread_id) {
            try {
                await axios.delete(`${BOT_URL}/forum-post/${resource.forum_thread_id}`, {
                    timeout: 5000
                });
                console.log('✅ Forum thread deleted:', resource.forum_thread_id);
            } catch (botError) {
                console.error('⚠️ Failed to delete forum thread:', botError.message);
            }
        }
        
        res.json({ success: true, message: 'Ressource supprimée' });
    } catch (error) {
        console.error('Delete resource error:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// Toggle like
router.post('/:id/like', isAuthenticated, async (req, res) => {
    try {
        const result = await resourceService.toggleLike(
            req.params.id,
            req.session.userId
        );
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Toggle like error:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

// Increment download
router.post('/:id/download', async (req, res) => {
    try {
        await resourceService.incrementDownload(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Increment download error:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

module.exports = router;
