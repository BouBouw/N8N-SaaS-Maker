import colors from 'colors';

export default {
    name: 'ready',
    once: true,
    async execute(client, connection) {
        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'.cyan);
        console.log('           LogicAI Discord Bot          '.cyan.bold);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'.cyan);
        console.log('');
        console.log('[BOT]'.bold.green + ` Connected as ${client.user.tag}`.white);
        console.log('[BOT]'.bold.green + ` Serving ${client.guilds.cache.size} guild(s)`.white);
        console.log('[BOT]'.bold.green + ` ${client.commands.size} command(s) loaded`.white);
        console.log('');
        console.log('[STATUS]'.bold.yellow + ' Bot is ready!'.white);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'.cyan);
        console.log('');

        // Vérifier la connexion à la base de données et récupérer le nombre d'utilisateurs
        let userCount = 0;
        try {
            const conn = await connection;
            const [rows] = await conn.query('SELECT COUNT(*) as count FROM users');
            userCount = rows[0].count;
            console.log('[DB]'.bold.blue + ` ${userCount} utilisateur(s) enregistré(s)`.white);
        } catch (error) {
            console.error('[DB]'.bold.red + ' Erreur de connexion à la base de données:'.red, error.message);
        }

        // Statuts à faire tourner
        const statuses = [
            { name: 'www.logicai.fr', type: 0 },
            { name: 'Hébergeur N8N & Automatisation IA', type: 0 },
            { name: '-20% avec NEWLOGIC jusqu\'au 14/02/2026', type: 0 },
            { name: `+${userCount} utilisateurs inscrits`, type: 0 }
        ];

        let currentStatusIndex = 0;

        // Définir le premier statut
        client.user.setPresence({
            activities: [statuses[currentStatusIndex]],
            status: 'online'
        });

        // Changer le statut toutes les 60 secondes
        setInterval(async () => {
            currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
            
            // Mettre à jour le nombre d'utilisateurs si c'est ce statut
            if (currentStatusIndex === 3) {
                try {
                    const conn = await connection;
                    const [rows] = await conn.query('SELECT COUNT(*) as count FROM users');
                    statuses[3].name = `+${rows[0].count} utilisateurs inscrits`;
                } catch (error) {
                    console.error('[DB]'.bold.red + ' Erreur mise à jour statut:'.red, error.message);
                }
            }
            
            client.user.setPresence({
                activities: [statuses[currentStatusIndex]],
                status: 'online'
            });
        }, 60000); // 60 secondes
    }
};
