import express from 'express';
import { EmbedBuilder, AttachmentBuilder } from 'discord.js';

const router = express.Router();

// Configuration des tags et du canal forum
const FORUM_CHANNEL_ID = '1459728691511820510';
const TAG_MAP = {
    'Workflows': '1459733866628645089',
    'Prompts': '1459733891328905276',
    'Gratuit': '1459733917799022632',
    'Payant': '1459733955962998807'
};

/**
 * POST /forum-post
 * Endpoint pour créer un forum post (pour les nouvelles ressources)
 */
router.post('/', async (req, res) => {
    try {
        const { title, description, tags, resourceId, resourceType, price, priceAmount, content } = req.body;
        const { client } = req.app.locals;

        if (!client) {
            console.error('❌ Bot client not available');
            return res.status(503).json({ error: 'Bot non disponible' });
        }

        const channel = await client.channels.fetch(FORUM_CHANNEL_ID);

        if (!channel?.isThreadOnly()) {
            console.error('❌ Invalid forum channel:', channel?.type);
            return res.status(400).json({ error: 'Canal forum invalide' });
        }

        // Construire les tags automatiquement
        const appliedTagNames = [];
        
        // Tag de type
        if (resourceType === 'workflow') {
            appliedTagNames.push('Workflows');
        } else if (resourceType === 'prompt') {
            appliedTagNames.push('Prompts');
        }
        
        // Tag de prix
        if (price === 'free') {
            appliedTagNames.push('Gratuit');
        } else {
            appliedTagNames.push('Payant');
        }

        // Mapper aux IDs Discord
        const appliedTags = appliedTagNames
            .map(tag => TAG_MAP[tag])
            .filter(Boolean);

        // Créer l'embed
        const embed = new EmbedBuilder()
            .setColor('#F97316')
            .setTitle(title)
            .setDescription(description)
            .addFields(
                { name: '📦 Type', value: resourceType === 'workflow' ? 'Workflow' : 'Prompt', inline: true },
                { name: '💵 Prix', value: price === 'free' ? 'Gratuit' : `${priceAmount}€`, inline: true },
            )
            .setTimestamp()
            .setFooter({ text: 'LogicAI Marketplace' });

        // Préparer les fichiers si gratuit
        const files = [];
        if (price === 'free' && content && resourceType === 'workflow') {
            try {
                let workflowContent = content.trim();
                
                // Si le contenu est du Markdown avec un bloc JSON, extraire le JSON
                const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
                const jsonMatch = workflowContent.match(jsonBlockRegex);
                
                if (jsonMatch && jsonMatch[1]) {
                    // JSON trouvé dans un bloc markdown
                    workflowContent = jsonMatch[1].trim();
                } else if (!workflowContent.startsWith('{') && !workflowContent.startsWith('[')) {
                    // Contenu n'est ni JSON pur ni markdown avec bloc JSON
                    workflowContent = null;
                }
                
                if (workflowContent) {
                    const workflowJson = JSON.stringify(JSON.parse(workflowContent), null, 2);
                    const attachment = new AttachmentBuilder(Buffer.from(workflowJson), {
                        name: `workflow_${resourceId}.json`
                    });
                    files.push(attachment);
                }
            } catch (parseError) {
                console.error('⚠️ Failed to parse workflow content:', parseError.message);
            }
        }

        // Créer le thread forum
        const thread = await channel.threads.create({
            name: title,
            message: {
                embeds: [embed],
                files: files
            },
            appliedTags: appliedTags
        });

        res.json({ 
            success: true, 
            threadId: thread.id,
            url: `https://discord.com/channels/${channel.guildId}/${thread.id}`
        });

    } catch (error) {
        console.error('❌ Erreur forum post:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /forum-post/:threadId
 * Endpoint pour supprimer un forum thread
 */
router.delete('/:threadId', async (req, res) => {
    try {
        const { threadId } = req.params;
        const { client } = req.app.locals;

        console.log('🗑️ Delete forum thread request:', threadId);

        if (!client) {
            console.error('❌ Bot client not available');
            return res.status(503).json({ error: 'Bot non disponible' });
        }

        const channel = await client.channels.fetch(threadId);

        if (!channel?.isThread()) {
            console.error('❌ Invalid thread:', threadId);
            return res.status(400).json({ error: 'Thread invalide' });
        }

        await channel.delete();
        console.log('✅ Forum thread deleted:', threadId);

        res.json({ 
            success: true,
            message: 'Thread supprimé'
        });

    } catch (error) {
        console.error('❌ Erreur delete forum thread:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
