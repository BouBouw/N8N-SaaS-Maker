const express = require('express');
const aiService = require('../services/aiService');
const { isAuthenticated } = require('../middleware/auth');

const router = express.Router();

// Get user conversations
router.get('/conversations', isAuthenticated, async (req, res) => {
    try {
        const conversations = await aiService.getUserConversations(req.session.userId);
        res.json({ conversations });
    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des conversations' });
    }
});

// Create new conversation
router.post('/conversations', isAuthenticated, async (req, res) => {
    try {
        const { title, modelType } = req.body;
        const conversationId = await aiService.createConversation(
            req.session.userId,
            title,
            modelType || 'general'
        );

        res.json({ conversationId, success: true });
    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({ error: 'Erreur lors de la création de la conversation' });
    }
});

// Get conversation with messages
router.get('/conversations/:id', isAuthenticated, async (req, res) => {
    try {
        const conversation = await aiService.getConversation(
            req.params.id,
            req.session.userId
        );
        const messages = await aiService.getMessages(
            req.params.id,
            req.session.userId
        );

        res.json({ conversation, messages });
    } catch (error) {
        console.error('Get conversation error:', error);
        res.status(404).json({ error: 'Conversation non trouvée' });
    }
});

// Send message and get AI response
router.post('/conversations/:id/messages', isAuthenticated, async (req, res) => {
    try {
        const { content } = req.body;
        const conversationId = parseInt(req.params.id);

        // Verify conversation belongs to user
        const conversation = await aiService.getConversation(
            conversationId,
            req.session.userId
        );

        // Add user message
        await aiService.addMessage(conversationId, 'user', content);

        // Generate AI response
        const aiResponse = await aiService.generateResponse(
            conversationId,
            content,
            conversation.model_type
        );

        // Add AI response
        await aiService.addMessage(conversationId, 'assistant', aiResponse);

        // Get all messages
        const messages = await aiService.getMessages(conversationId, req.session.userId);

        res.json({ messages, success: true });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
    }
});

// Update conversation title
router.patch('/conversations/:id', isAuthenticated, async (req, res) => {
    try {
        const { title } = req.body;
        await aiService.updateConversationTitle(
            req.params.id,
            req.session.userId,
            title
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Update conversation error:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour' });
    }
});

// Delete conversation
router.delete('/conversations/:id', isAuthenticated, async (req, res) => {
    try {
        await aiService.deleteConversation(req.params.id, req.session.userId);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete conversation error:', error);
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// Get templates
router.get('/templates', isAuthenticated, async (req, res) => {
    try {
        const { category } = req.query;
        const templates = await aiService.getTemplates(category);
        res.json({ templates });
    } catch (error) {
        console.error('Get templates error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des modèles' });
    }
});

// Use template
router.post('/templates/:id/use', isAuthenticated, async (req, res) => {
    try {
        await aiService.incrementTemplateUsage(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Use template error:', error);
        res.status(500).json({ error: 'Erreur' });
    }
});

module.exports = router;
