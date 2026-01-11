import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { api, BACKEND_URL } from '../server/app.js';

export default {
    data: new SlashCommandBuilder()
        .setName('favorites')
        .setDescription('Voir vos ressources favorites'),
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const discordId = interaction.user.id;

            // Vérifier le lien du compte
            const userResponse = await api.get(`/discord/user/${discordId}`);
            
            if (!userResponse.data.linked) {
                const embed = new EmbedBuilder()
                    .setColor('#EF4444')
                    .setTitle('❌ Compte non lié')
                    .setDescription('Vous devez lier votre compte Discord à LogicAI pour utiliser cette commande.')
                    .addFields({ name: 'Comment lier ?', value: 'Utilisez `/account` pour lier votre compte.' });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Récupérer les favoris
            const response = await api.get(`/discord/user/${discordId}/favorites`);
            const favorites = response.data.favorites || [];

            if (favorites.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#F97316')
                    .setTitle('⭐ Aucun favori')
                    .setDescription('Vous n\'avez pas encore de ressources favorites.')
                    .addFields({ 
                        name: 'Ajouter des favoris', 
                        value: 'Parcourez les ressources avec `/workflows` et ajoutez-les à vos favoris !' 
                    });

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Parcourir les ressources')
                            .setURL(`${BACKEND_URL.replace(':5000', '')}/dashboard/ressources`)
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('🔍')
                    );

                return await interaction.editReply({ 
                    embeds: [embed],
                    components: [row]
                });
            }

            // Pagination
            let currentPage = 0;
            const totalPages = favorites.length;

            const generateEmbed = (page) => {
                const favorite = favorites[page];
                const resource = favorite.resource;
                
                const typeEmoji = resource.type === 'workflow' ? '⚙️' : '💬';
                const typeText = resource.type === 'workflow' ? 'Workflow' : 'Prompt';
                const priceEmoji = resource.is_free ? '🆓' : '💰';
                const priceText = resource.is_free ? 'Gratuit' : `${resource.price}€`;

                const embed = new EmbedBuilder()
                    .setColor('#FBBF24')
                    .setTitle(`⭐ ${resource.name}`)
                    .setDescription(resource.description || 'Aucune description')
                    .addFields(
                        { name: '📦 Type', value: typeText, inline: true },
                        { name: '💵 Prix', value: `${priceEmoji} ${priceText}`, inline: true },
                        { name: '📊 Catégorie', value: resource.category || 'Non classé', inline: true },
                        { name: '👤 Auteur', value: resource.author_name || 'LogicAI', inline: true },
                        { name: '💾 Ajouté le', value: new Date(favorite.created_at).toLocaleDateString('fr-FR'), inline: true }
                    )
                    .setFooter({ text: `Favori ${page + 1}/${totalPages} • ID: ${resource.id}` })
                    .setTimestamp();

                if (resource.preview_image) {
                    embed.setThumbnail(resource.preview_image);
                }

                return embed;
            };

            const generateButtons = (page) => {
                const favorite = favorites[page];
                const resource = favorite.resource;
                
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
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('📖'),
                        new ButtonBuilder()
                            .setCustomId(`remove_${favorite.id}`)
                            .setLabel('Retirer des favoris')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🗑️')
                    );

                if (!resource.is_free) {
                    row2.addComponents(
                        new ButtonBuilder()
                            .setLabel(`Acheter (${resource.price}€)`)
                            .setURL(`${BACKEND_URL.replace(':5000', '')}/dashboard/ressources/${resource.id}/checkout`)
                            .setStyle(ButtonStyle.Link)
                            .setEmoji('💳')
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

                // Gestion retrait favoris
                if (i.customId.startsWith('remove_')) {
                    const favoriteId = i.customId.replace('remove_', '');
                    
                    try {
                        const discordId = i.user.id;
                        const favorite = favorites.find(f => f.id.toString() === favoriteId);
                        
                        if (favorite) {
                            await api.delete(`/discord/user/${discordId}/favorites/${favorite.resource.id}`);
                            
                            // Retirer le favori de la liste
                            favorites.splice(currentPage, 1);
                            
                            if (favorites.length === 0) {
                                const embed = new EmbedBuilder()
                                    .setColor('#F97316')
                                    .setTitle('⭐ Aucun favori')
                                    .setDescription('Vous n\'avez plus de ressources favorites.');

                                return await i.update({ 
                                    embeds: [embed],
                                    components: []
                                });
                            }
                            
                            // Ajuster la page si nécessaire
                            if (currentPage >= favorites.length) {
                                currentPage = favorites.length - 1;
                            }
                            
                            await i.update({ 
                                embeds: [generateEmbed(currentPage)],
                                components: generateButtons(currentPage)
                            });
                            
                            await i.followUp({ 
                                content: '🗑️ Retiré des favoris !', 
                                ephemeral: true 
                            });
                        }
                    } catch (error) {
                        await i.reply({ 
                            content: '❌ Erreur lors du retrait des favoris.', 
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
                        currentPage = Math.min(favorites.length - 1, currentPage + 1);
                        break;
                    case 'last':
                        currentPage = favorites.length - 1;
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
            console.error('Erreur /favorites:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#EF4444')
                .setTitle('❌ Erreur')
                .setDescription('Une erreur est survenue lors de la récupération de vos favoris.')
                .setFooter({ text: 'Veuillez réessayer plus tard' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
