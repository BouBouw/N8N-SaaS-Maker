import express from 'express';

const router = express.Router();

/**
 * GET /discord-user/:discordId
 * Récupérer les informations d'un utilisateur Discord
 */
router.get('/:discordId', async (req, res) => {
    try {
        const { discordId } = req.params;
        const { client } = req.app.locals;

        if (!client) {
            console.error('❌ Bot client not available');
            return res.status(503).json({ error: 'Bot non disponible' });
        }

        // Récupérer l'utilisateur Discord
        const user = await client.users.fetch(discordId).catch(() => null);
        
        if (!user) {
            return res.status(404).json({ error: 'Utilisateur Discord non trouvé' });
        }

        // Construire l'URL de l'avatar
        const avatarURL = user.displayAvatarURL({ 
            format: 'png', 
            size: 256 
        });

        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                discriminator: user.discriminator,
                tag: user.tag,
                avatar: avatarURL,
                bot: user.bot
            }
        });

    } catch (error) {
        console.error('❌ Erreur fetch Discord user:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
