const pool = require('../config/database');
const deepseekService = require('./deepseekService');

class AIService {
    /**
     * Create a new conversation
     */
    async createConversation(userId, title = 'Nouvelle conversation', modelType = 'general') {
        try {
            const [result] = await pool.query(
                `INSERT INTO ai_conversations (user_id, title, model_type)
                 VALUES (?, ?, ?)`,
                [userId, title, modelType]
            );

            return result.insertId;
        } catch (error) {
            console.error('❌ Error creating conversation:', error);
            throw error;
        }
    }

    /**
     * Get user conversations
     */
    async getUserConversations(userId, limit = 50) {
        try {
            const [conversations] = await pool.query(
                `SELECT c.*, 
                        (SELECT COUNT(*) FROM ai_messages WHERE conversation_id = c.id) as message_count
                 FROM ai_conversations c
                 WHERE c.user_id = ?
                 ORDER BY c.updated_at DESC
                 LIMIT ?`,
                [userId, limit]
            );

            return conversations;
        } catch (error) {
            console.error('❌ Error fetching conversations:', error);
            throw error;
        }
    }

    /**
     * Get conversation by ID
     */
    async getConversation(conversationId, userId) {
        try {
            const [conversations] = await pool.query(
                `SELECT * FROM ai_conversations
                 WHERE id = ? AND user_id = ?`,
                [conversationId, userId]
            );

            if (conversations.length === 0) {
                throw new Error('Conversation not found');
            }

            return conversations[0];
        } catch (error) {
            console.error('❌ Error fetching conversation:', error);
            throw error;
        }
    }

    /**
     * Get messages for a conversation
     */
    async getMessages(conversationId, userId = null) {
        try {
            // Verify conversation belongs to user (if userId provided)
            if (userId) {
                await this.getConversation(conversationId, userId);
            }

            const [messages] = await pool.query(
                `SELECT * FROM ai_messages
                 WHERE conversation_id = ?
                 ORDER BY created_at ASC`,
                [conversationId]
            );

            return messages;
        } catch (error) {
            console.error('❌ Error fetching messages:', error);
            throw error;
        }
    }

    /**
     * Add message to conversation
     */
    async addMessage(conversationId, role, content, metadata = null) {
        try {
            const [result] = await pool.query(
                `INSERT INTO ai_messages (conversation_id, role, content, metadata)
                 VALUES (?, ?, ?, ?)`,
                [conversationId, role, content, metadata ? JSON.stringify(metadata) : null]
            );

            // Update conversation updated_at
            await pool.query(
                `UPDATE ai_conversations SET updated_at = NOW() WHERE id = ?`,
                [conversationId]
            );

            return result.insertId;
        } catch (error) {
            console.error('❌ Error adding message:', error);
            throw error;
        }
    }

    /**
     * Generate AI response (placeholder - integrate with OpenAI or other AI service)
     */
    async generateResponse(conversationId, userMessage, modelType) {
        try {
            // Get conversation history for context
            const conversationHistory = await this.getMessages(conversationId, null);
            
            // Use DeepSeek API for workflow generation
            if (modelType === 'workflow_generator') {
                try {
                    const workflowResponse = await deepseekService.generateWorkflow(
                        userMessage,
                        conversationHistory
                    );
                    return workflowResponse;
                } catch (deepseekError) {
                    console.error('❌ DeepSeek workflow generation failed:', deepseekError.message);
                    // Fallback to default response
                    return `Erreur lors de la génération du workflow: ${deepseekError.message}\n\nVeuillez vérifier la configuration de l'API DeepSeek.`;
                }
            }
            
            // Use DeepSeek API for prompt generation
            if (modelType === 'prompt_generator') {
                try {
                    const promptResponse = await deepseekService.generatePrompt(
                        userMessage,
                        conversationHistory
                    );
                    return promptResponse;
                } catch (deepseekError) {
                    console.error('❌ DeepSeek prompt generation failed:', deepseekError.message);
                    // Fallback to default response
                    return `Erreur lors de la génération du prompt: ${deepseekError.message}\n\nVeuillez vérifier la configuration de l'API DeepSeek.`;
                }
            }

            // Default general response (no API call)
            const aiResponse = `Je suis un assistant IA (mode: ${modelType}). 
            
Voici ma réponse à votre message: "${userMessage}"

*Note: Configuration de l'API DeepSeek requise pour des réponses avancées.*`;

            return aiResponse;
        } catch (error) {
            console.error('❌ Error generating AI response:', error);
            throw error;
        }
    }

    /**
     * Update conversation title
     */
    async updateConversationTitle(conversationId, userId, title) {
        try {
            await this.getConversation(conversationId, userId);

            await pool.query(
                `UPDATE ai_conversations SET title = ? WHERE id = ?`,
                [title, conversationId]
            );
        } catch (error) {
            console.error('❌ Error updating conversation title:', error);
            throw error;
        }
    }

    /**
     * Delete conversation
     */
    async deleteConversation(conversationId, userId) {
        try {
            await this.getConversation(conversationId, userId);

            await pool.query(
                `DELETE FROM ai_conversations WHERE id = ?`,
                [conversationId]
            );
        } catch (error) {
            console.error('❌ Error deleting conversation:', error);
            throw error;
        }
    }

    /**
     * Get all templates
     */
    async getTemplates(category = null) {
        try {
            let query = `SELECT * FROM ai_templates WHERE is_public = TRUE`;
            const params = [];

            if (category) {
                query += ` AND category = ?`;
                params.push(category);
            }

            query += ` ORDER BY usage_count DESC, created_at DESC`;

            const [templates] = await pool.query(query, params);
            return templates;
        } catch (error) {
            console.error('❌ Error fetching templates:', error);
            throw error;
        }
    }

    /**
     * Increment template usage
     */
    async incrementTemplateUsage(templateId) {
        try {
            await pool.query(
                `UPDATE ai_templates SET usage_count = usage_count + 1 WHERE id = ?`,
                [templateId]
            );
        } catch (error) {
            console.error('❌ Error incrementing template usage:', error);
        }
    }
}

module.exports = new AIService();
