import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { api, BACKEND_URL } from '../server/app.js';

export default {
    data: new SlashCommandBuilder()
        .setName('workflow')
        .setDescription('Rechercher un workflow dans les ressources LogicAI')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Mot-clé de recherche')
                .setRequired(true)
                .setAutocomplete(true)
        ),
    
    async autocomplete(interaction) {
        try {
            const focusedValue = interaction.options.getFocused().toLowerCase();

            // Récupérer toutes les ressources
            const response = await api.get(`/discord/resources`);
            const resources = response.data.resources || [];

            // Si aucune ressource
            if (resources.length === 0) {
                return await interaction.respond([{
                    name: 'Aucune ressource disponible',
                    value: 'none'
                }]);
            }

            // Si aucun texte saisi, afficher les premières ressources
            if (!focusedValue) {
                return await interaction.respond(
                    resources.slice(0, 25).map(res => ({
                        name: `${res.title} (${res.type === 'workflow' ? 'Workflow' : 'Prompt'})`,
                        value: res.title
                    }))
                );
            }

            // Filtrer en fonction de ce que l'utilisateur tape
            const filtered = resources
                .filter(res => 
                    res.title.toLowerCase().includes(focusedValue) ||
                    (res.description && res.description.toLowerCase().includes(focusedValue)) ||
                    (res.category && res.category.toLowerCase().includes(focusedValue))
                )
                .slice(0, 25);

            // Si aucun résultat, proposer toutes les ressources
            if (filtered.length === 0) {
                return await interaction.respond(
                    resources.slice(0, 25).map(res => ({
                        name: `${res.title} (${res.type === 'workflow' ? 'Workflow' : 'Prompt'})`,
                        value: res.title
                    }))
                );
            }

            await interaction.respond(
                filtered.map(res => ({
                    name: `${res.title} (${res.type === 'workflow' ? 'Workflow' : 'Prompt'})`,
                    value: res.title
                }))
            );

        } catch (error) {
            console.error('Erreur autocomplete workflow:', error);
            await interaction.respond([]);
        }
    },
    
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const searchQuery = interaction.options.getString('search');

            // Rechercher dans les ressources publiques
            const response = await api.get(`/discord/resources/search`, {
                params: { q: searchQuery }
            });

            const resources = response.data.resources || [];

            if (resources.length === 0) {
                const embed = new EmbedBuilder()
                    .setColor('#F97316')
                    .setTitle('Aucun résultat')
                    .setDescription(`Aucun workflow trouvé pour **${searchQuery}**.`)
                    .addFields({ 
                        name: 'Suggestions', 
                        value: '• Essayez d\'autres mots-clés\n• Parcourez tous les workflows avec `/workflows`\n• Consultez vos favoris avec `/favorites`' 
                    });

                return await interaction.editReply({ embeds: [embed] });
            }

            // Pagination
            let currentPage = 0;
            const totalPages = resources.length;

            const generateEmbed = (page) => {
                const resource = resources[page];
                
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
                    .setFooter({ text: `Résultat ${page + 1}/${totalPages} • ID: ${resource.id}` })
                    .setTimestamp();

                if (resource.preview_image) {
                    embed.setThumbnail(resource.preview_image);
                }

                return embed;
            };

            const generateButtons = (page) => {
                const resource = resources[page];

                console.log(resource)
                
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
                    );

                if (resource.price !== "free") {
                    row2.addComponents(
                        new ButtonBuilder()
                            .setLabel(`Acheter (${resource.price_amount}€)`)
                            .setURL(`${BACKEND_URL.replace(':5000', '')}/dashboard/ressources/${resource.id}/checkout`)
                            .setStyle(ButtonStyle.Link)
                    );
                }

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
            console.error('Erreur /workflow:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#EF4444')
                .setTitle('❌ Erreur')
                .setDescription('Une erreur est survenue lors de la recherche.')
                .setFooter({ text: 'Veuillez réessayer plus tard' });

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
