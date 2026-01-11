import express from 'express';

const router = express.Router();

// Configuration des rôles par plan
const ROLE_MAP = {
    'pro': '1459722762691018860',
    'business': '1459722787689337146'
};

// ID du serveur Discord (à configurer)
const GUILD_ID = process.env.DISCORD_GUILD_ID || '1459719943107903541';

/**
 * POST /discord-role
 * Attribuer un rôle Discord basé sur le plan de l'utilisateur
 */
router.post('/', async (req, res) => {
    try {
        const { discordId, plan } = req.body;
        const { client } = req.app.locals;

        console.log('🎭 Role assignment request:', { discordId, plan });

        if (!discordId || !plan) {
            return res.status(400).json({ error: 'discordId et plan requis' });
        }

        if (!client) {
            console.error('❌ Bot client not available');
            return res.status(503).json({ error: 'Bot non disponible' });
        }

        // Récupérer le serveur
        const guild = await client.guilds.fetch(GUILD_ID);
        
        if (!guild) {
            console.error('❌ Guild not found:', GUILD_ID);
            return res.status(404).json({ error: 'Serveur Discord non trouvé' });
        }

        // Récupérer le membre
        const member = await guild.members.fetch(discordId).catch(() => null);
        
        if (!member) {
            console.error('❌ Member not found:', discordId);
            return res.status(404).json({ error: 'Membre Discord non trouvé' });
        }

        // Récupérer le rôle correspondant au plan
        const roleId = ROLE_MAP[plan.toLowerCase()];
        
        if (!roleId) {
            console.log('ℹ️ No role mapping for plan:', plan);
            return res.json({ 
                success: true,
                message: 'Aucun rôle configuré pour ce plan'
            });
        }

        const role = await guild.roles.fetch(roleId);
        
        if (!role) {
            console.error('❌ Role not found:', roleId);
            return res.status(404).json({ error: 'Rôle Discord non trouvé' });
        }

        // Retirer tous les autres rôles de plan
        const otherRoles = Object.values(ROLE_MAP).filter(id => id !== roleId);
        for (const otherRoleId of otherRoles) {
            if (member.roles.cache.has(otherRoleId)) {
                await member.roles.remove(otherRoleId);
                console.log('🗑️ Removed role:', otherRoleId);
            }
        }

        // Ajouter le nouveau rôle
        await member.roles.add(role);
        console.log('✅ Role assigned:', role.name, 'to', member.user.tag);

        res.json({ 
            success: true,
            message: `Rôle ${role.name} attribué`,
            role: {
                id: role.id,
                name: role.name
            }
        });

    } catch (error) {
        console.error('❌ Erreur role assignment:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /discord-role/:discordId
 * Retirer tous les rôles de plan d'un utilisateur
 */
router.delete('/:discordId', async (req, res) => {
    try {
        const { discordId } = req.params;
        const { client } = req.app.locals;

        console.log('🗑️ Remove roles request:', discordId);

        if (!client) {
            console.error('❌ Bot client not available');
            return res.status(503).json({ error: 'Bot non disponible' });
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discordId).catch(() => null);
        
        if (!member) {
            return res.status(404).json({ error: 'Membre Discord non trouvé' });
        }

        // Retirer tous les rôles de plan
        const removedRoles = [];
        for (const [planName, roleId] of Object.entries(ROLE_MAP)) {
            if (member.roles.cache.has(roleId)) {
                await member.roles.remove(roleId);
                removedRoles.push(planName);
                console.log('🗑️ Removed role:', roleId);
            }
        }

        res.json({ 
            success: true,
            message: 'Rôles retirés',
            removedRoles
        });

    } catch (error) {
        console.error('❌ Erreur remove roles:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
