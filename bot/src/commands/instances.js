import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { api, BACKEND_URL } from '../server/app.js';

export default {
    data: new SlashCommandBuilder()
        .setName('instances')
        .setDescription('Voir toutes vos instances N8N'),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const discordId = interaction.user.id;

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

            // Récupérer toutes les instances
            const response = await api.get(`/discord/user/${discordId}/instances`);
            const instances = response.data.instances || [];

            if (instances.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#F97316')
                    .setTitle('Aucune instance')
                    .setDescription('Vous n\'avez pas encore créé d\'instance N8N.')
                    .addFields({ 
                        name: 'Créer une instance', 
                        value: 'Rendez-vous sur votre tableau de bord pour créer votre première instance.' 
                    });

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Créer une instance')
                            .setURL(`${BACKEND_URL.replace(':5000', '')}/dashboard/instances`)
                            .setStyle(ButtonStyle.Link)
                    );

                return await interaction.editReply({ 
                    embeds: [embed],
                    components: [row]
                });
            }

            // Pagination
            let currentPage = 0;
            const totalPages = instances.length;

            const generateEmbed = (page) => {
                const instance = instances[page];
                const statusEmoji = instance.status === 'running' ? '🟢' : '🔴';
                const statusText = instance.status === 'running' ? 'Active' : 'Inactive';
                const instanceUrl = `https://${instance.subdomain}.logicai.fr`;

                return new EmbedBuilder()
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
                    .setFooter({ text: `Instance ${page + 1}/${totalPages} • ID: ${instance.id}` })
                    .setTimestamp();
            };

            const generateButtons = (page) => {
                const row1 = new ActionRowBuilder();
                
                // Boutons de navigation
                row1.addComponents(
                    new ButtonBuilder()
                        .setCustomId('first')
                        .setLabel('⏮️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('◀️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages - 1),
                    new ButtonBuilder()
                        .setCustomId('last')
                        .setLabel('⏭️')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(page === totalPages - 1)
                );

                // Boutons d'action
                const row2 = new ActionRowBuilder();
                const instance = instances[page];
                const instanceUrl = `https://${instance.subdomain}.logicai.fr`;
                
                row2.addComponents(
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

                return [row2, row1];
            };

            const message = await interaction.editReply({ 
                embeds: [generateEmbed(currentPage)],
                components: generateButtons(currentPage)
            });

            // Collecteur pour les boutons
            const collector = message.createMessageComponentCollector({ 
                time: 300000 // 5 minutes
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return await i.reply({ 
                        content: '❌ Ces boutons ne sont pas pour vous !', 
                        ephemeral: true 
                    });
                }

                switch (i.customId) {
                    case 'first':
                        currentPage = 0;
                        break;
                    case 'prev':
                        currentPage = Math.max(0, currentPage - 1);
                        break;
                    case 'next':
                        currentPage = Math.min(totalPages - 1, currentPage + 1);
                        break;
                    case 'last':
                        currentPage = totalPages - 1;
                        break;
                }

                await i.update({ 
                    embeds: [generateEmbed(currentPage)],
                    components: generateButtons(currentPage)
                });
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });

        } catch (error) {
            console.error('Erreur /instances:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#EF4444')
                .setTitle('❌ Erreur')
                .setDescription('Une erreur est survenue lors de la récupération de vos instances.')
                .setFooter({ text: 'Veuillez réessayer plus tard' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
