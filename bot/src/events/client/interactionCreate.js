import colors from 'colors';

export default {
    name: 'interactionCreate',
    async execute(interaction, client, connection) {
        // Gestion des commandes slash
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);

            if (!command) {
                console.error(`[WARN]`.yellow + ` Commande inconnue: ${interaction.commandName}`.white);
                return;
            }

            try {
                console.log(
                    `[CMD]`.bold.cyan + 
                    ` ${interaction.user.tag}`.white + 
                    ` used `.gray + 
                    `/${interaction.commandName}`.cyan +
                    ` in `.gray +
                    `${interaction.guild?.name || 'DM'}`.white
                );

                await command.execute(interaction, client, connection);
            } catch (error) {
                console.error(`[ERROR]`.bold.red + ` Error executing ${interaction.commandName}:`.red, error);

                const errorMessage = {
                    content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.',
                    ephemeral: true
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
        }

        // Gestion de l'autocomplete
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);

            if (!command || !command.autocomplete) {
                return;
            }

            try {
                await command.autocomplete(interaction, client, connection);
            } catch (error) {
                console.error(`[ERROR]`.bold.red + ` Error in autocomplete for ${interaction.commandName}:`.red, error);
            }
        }

        // Gestion des boutons, menus, etc.
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            // Les interactions des boutons sont gérées directement dans les commandes
            // via les collecteurs (collectors)
        }
    }
};
