import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { api, BACKEND_URL } from '../server/app.js';

export default {
    data: new SlashCommandBuilder()
        .setName('instance')
        .setDescription('Voir les détails d\'une instance N8N')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('ID ou identifiant de l\'instance')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    async autocomplete(interaction) {
        try {
            const discordId = interaction.user.id;
            const focusedValue = interaction.options.getFocused().toLowerCase();

            // Récupérer les instances de l'utilisateur
            const response = await api.get(`/discord/user/${discordId}/instances`);
            
            // Si le compte n'est pas lié, ne rien afficher
            if (!response.data.linked) {
                return await interaction.respond([]);
            }

            const instances = response.data.instances || [];
            
            // Si aucune instance, afficher un message
            if (instances.length === 0) {
                return await interaction.respond([{
                    name: 'Aucune instance disponible',
                    value: 'none'
                }]);
            }
            
            // Si aucun texte saisi, afficher toutes les instances
            if (!focusedValue) {
                return await interaction.respond(
                    instances.slice(0, 25).map(inst => ({
                        name: `${inst.name} (${inst.subdomain})`,
                        value: inst.subdomain
                    }))
                );
            }

            // Filtrer en fonction de ce que l'utilisateur tape
            const filtered = instances
                .filter(inst => 
                    inst.subdomain.toLowerCase().includes(focusedValue) ||
                    inst.name.toLowerCase().includes(focusedValue) ||
                    inst.id.toString().includes(focusedValue)
                )
                .slice(0, 25); // Discord limite à 25 suggestions

            // Si aucun résultat, proposer toutes les instances
            if (filtered.length === 0) {
                return await interaction.respond(
                    instances.slice(0, 25).map(inst => ({
                        name: `${inst.name} (${inst.subdomain})`,
                        value: inst.subdomain
                    }))
                );
            }

            await interaction.respond(
                filtered.map(inst => ({
                    name: `${inst.name} (${inst.subdomain})`,
                    value: inst.subdomain
                }))
            );

        } catch (error) {
            console.error('Erreur autocomplete instance:', error);
            await interaction.respond([]);
        }
    },

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const discordId = interaction.user.id;
            const instanceId = interaction.options.getString('id');

            // Vérifier le lien du compte
            const userResponse = await api.get(`/discord/user/${discordId}`);
            
            if (!userResponse.data.linked) {
                const embed = new EmbedBuilder()
                    .setColor('#EF4444')
                    .setTitle('Compte non lié')
                    .setDescription('Vous devez lier votre compte Discord à LogicAI pour utiliser cette commande.')
                    .addFields({ name: 'Comment lier ?', value: 'Utilisez `/account` pour lier votre compte.' });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Récupérer les détails de l'instance
            const response = await api.get(`/discord/user/${discordId}/instance/${instanceId}`);
            const instance = response.data.instance;

            if (!instance) {
                const embed = new EmbedBuilder()
                    .setColor('#EF4444')
                    .setTitle('❌ Instance introuvable')
                    .setDescription(`Aucune instance trouvée avec l'identifiant **${instanceId}**.`);

                return await interaction.editReply({ embeds: [embed] });
            }

            // Créer l'embed avec les détails de l'instance
            const statusEmoji = instance.status === 'running' ? '🟢' : '🔴';
            const statusText = instance.status === 'running' ? 'Active' : 'Inactive';
            const instanceUrl = `https://${instance.subdomain}.logicai.fr`;

            const embed = new EmbedBuilder()
                .setColor(instance.status === 'running' ? '#10B981' : '#EF4444')
                .setTitle(`🤖 ${instance.name || 'Instance'}`)
                .setDescription(`Instance N8N hébergée sur LogicAI`)
                .addFields(
                    { name: '🆔 Sous-domaine', value: instance.subdomain || 'N/A', inline: true },
                    { name: '📊 Statut', value: `${statusEmoji} ${statusText}`, inline: true },
                    { name: '🌐 URL', value: instanceUrl, inline: false },
                    { name: '🔑 API Key', value: instance.has_api_key ? '✅ Configurée' : '❌ Non configurée', inline: true },
                    { name: '📅 Créée le', value: instance.created_at ? new Date(instance.created_at).toLocaleDateString('fr-FR') : 'N/A', inline: true }
                )
                .setFooter({ text: `Instance ID: ${instance.id}` })
                .setTimestamp();

            // Boutons d'action
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Tableau de bord')
                        .setURL(`${BACKEND_URL.replace(':5000', '')}/dashboard/instances/${instance.subdomain}`)
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🌐'),
                    new ButtonBuilder()
                        .setLabel('Ouvrir N8N')
                        .setURL(instanceUrl)
                        .setStyle(ButtonStyle.Link)
                        .setEmoji('🚀')
                );

            await interaction.editReply({ 
                embeds: [embed],
                components: [row]
            });

        } catch (error) {
            console.error('Erreur /instance:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#EF4444')
                .setTitle('❌ Erreur')
                .setDescription('Une erreur est survenue lors de la récupération de l\'instance.')
                .setFooter({ text: 'Veuillez réessayer plus tard' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
