import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { api, BACKEND_URL } from '../server/app.js';

export default {
    data: new SlashCommandBuilder()
        .setName('workflows')
        .setDescription('Parcourir toutes les ressources LogicAI')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Filtrer par type')
                .setRequired(false)
                .addChoices(
                    { name: 'Tous', value: 'all' },
                    { name: 'Workflows', value: 'workflow' },
                    { name: 'Prompts', value: 'prompt' }
                )
        )
        .addStringOption(option =>
            option.setName('prix')
                .setDescription('Filtrer par prix')
                .setRequired(false)
                .addChoices(
                    { name: 'Tous', value: 'all' },
                    { name: 'Gratuit', value: 'free' },
                    { name: 'Payant', value: 'paid' }
                )
        ),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const typeFilter = interaction.options.getString('type') || 'all';
            const priceFilter = interaction.options.getString('prix') || 'all';

            // Récupérer toutes les ressources avec filtres
            const response = await api.get(`/discord/resources`, {
                params: { 
                    type: typeFilter !== 'all' ? typeFilter : undefined,
                    free: priceFilter === 'free' ? 'true' : priceFilter === 'paid' ? 'false' : undefined
                }
            });

            const resources = response.data.resources || [];

            if (resources.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#F97316')
                    .setTitle('Aucune ressource')
                    .setDescription('Aucune ressource disponible pour le moment.')
                    .addFields({ 
                        name: 'Suggestions', 
                        value: '• Modifiez vos filtres\n• Recherchez un workflow spécifique avec `/workflow`' 
                    });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Pagination
            let currentPage = 0;
            const totalPages = resources.length;

            const generateEmbed = (page) => {
                const resource = resources[page];

                console.log(resource)
                
                const typeText = resource.type === 'workflow' ? 'Workflow' : 'Prompt';
                const priceText = resource.price === "free" ? 'Gratuit' : `${resource.price_amount}€`;

                const embed = new EmbedBuilder()
                    .setColor('#F97316')
                    .setTitle(`${resource.title}`)
                    .setDescription(resource.description || 'Aucune description')
                    .addFields(
                        { name: '📦 Type', value: typeText, inline: true },
                        { name: '💵 Prix', value: `${priceText}`, inline: true },
                        { name: '📊 Catégorie', value: resource.category || 'Non classé', inline: true },
                        { name: '👤 Auteur', value: resource.author_name || 'LogicAI', inline: true },
                        { name: '📅 Publié le', value: new Date(resource.created_at).toLocaleDateString('fr-FR'), inline: true }
                    )
                    .setFooter({ text: `Ressource ${page + 1}/${totalPages} • ID: ${resource.id}` })
                    .setTimestamp();

                if (resource.preview_image) {
                    embed.setThumbnail(resource.preview_image);
                }

                return embed;
            };

            const generateButtons = (page) => {
                const resource = resources[page];
                
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
                const row2 = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Voir détails')
                            .setURL(`${BACKEND_URL.replace(':5000', '')}/dashboard/ressources/${resource.id}`)
                            .setStyle(ButtonStyle.Link),
                        new ButtonBuilder()
                            .setCustomId(`favorite_${resource.id}`)
                            .setLabel('Favoris')
                            .setStyle(ButtonStyle.Secondary)
                    );

                if (resource.price !== "free") {
                    row2.addComponents(
                        new ButtonBuilder()
                            .setLabel(`Acheter (${resource.price_amount}€)`)
                            .setURL(`${BACKEND_URL.replace(':5000', '')}/dashboard/ressources/${resource.id}/checkout`)
                            .setStyle(ButtonStyle.Link)
                    );
                }

                return [row1, row2];
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

                // Gestion favoris
                if (i.customId.startsWith('favorite_')) {
                    const resourceId = i.customId.replace('favorite_', '');
                    
                    try {
                        const discordId = i.user.id;
                        await api.post(`/discord/user/${discordId}/favorites/${resourceId}`);
                        
                        await i.reply({ 
                            content: '⭐ Ajouté aux favoris !', 
                            ephemeral: true 
                        });
                    } catch (error) {
                        await i.reply({ 
                            content: '❌ Erreur lors de l\'ajout aux favoris. Assurez-vous que votre compte est lié avec `/account`.', 
                            ephemeral: true 
                        });
                    }
                    return;
                }

                // Navigation
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
            console.error('Erreur /workflows:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#EF4444')
                .setTitle('❌ Erreur')
                .setDescription('Une erreur est survenue lors de la récupération des ressources.')
                .setFooter({ text: 'Veuillez réessayer plus tard' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
