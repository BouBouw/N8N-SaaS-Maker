import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import { api, BACKEND_URL, FRONTEND_URL } from '../server/app.js';

export default {
    data: new SlashCommandBuilder()
        .setName('account')
        .setDescription('Voir votre compte LogicAI ou lier votre compte Discord'),
    
    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const discordId = interaction.user.id;

            // Vérifier si le compte Discord est lié
            const response = await api.get(`/discord/user/${discordId}`);
            
            if (response.data.linked) {
                const user = response.data.user;
                
                const embed = new EmbedBuilder()
                    .setColor('#F97316')
                    .setTitle('Compte LogicAI')
                    .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                    .setDescription(`Votre compte Discord est lié à **${user.email}**`)
                    .addFields(
                        { name: "Nom d'utilisateur", value: user.name || 'Non défini', inline: true },
                        { name: 'Abonnement', value: user.plan || 'Gratuit', inline: true },
                        { name: '\u200B', value: '\u200B', inline: true },
                        { name: 'Instances', value: `${user.instance_count || 0}`, inline: true },
                        { name: 'Favoris', value: `${user.favorites_count || 0}`, inline: true },
                        { name: 'Membre depuis', value: new Date(user.created_at).toLocaleDateString('fr-FR'), inline: true }
                    )
                    .setFooter({ text: 'LogicAI - www.logicai.fr' })

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Tableau de bord')
                            .setURL(FRONTEND_URL + '/dashboard')
                            .setStyle(ButtonStyle.Link),
                        new ButtonBuilder()
                            .setCustomId('unlink_account')
                            .setLabel('Délier mon compte')
                            .setStyle(ButtonStyle.Danger)
                    );

                const message = await interaction.editReply({ 
                    embeds: [embed],
                    components: [row]
                });

                // Collecteur pour le bouton de déliage
                const collector = message.createMessageComponentCollector({ 
                    time: 300000 // 5 minutes
                });

                collector.on('collect', async i => {
                    if (i.user.id !== interaction.user.id) {
                        return await i.reply({ 
                            content: '❌ Ce bouton n\'est pas pour vous !', 
                            flags: MessageFlags.Ephemeral
                        });
                    }

                    if (i.customId === 'unlink_account') {
                        await i.deferUpdate();

                        try {
                            // Délier le compte via l'API
                            await api.delete(`/discord/user/${discordId}/unlink`);

                            const unlinkEmbed = new EmbedBuilder()
                                .setColor('#10B981')
                                .setTitle('Compte délié')
                                .setDescription('Votre compte Discord a été délié avec succès de LogicAI.')
                                .setFooter({ text: 'Vous pouvez le relié à tout moment avec /account' })

                            await i.editReply({ 
                                embeds: [unlinkEmbed],
                                components: []
                            });
                        } catch (error) {
                            console.error('Erreur déliage:', error);
                            
                            const errorEmbed = new EmbedBuilder()
                                .setColor('#EF4444')
                                .setTitle('❌ Erreur')
                                .setDescription('Une erreur est survenue lors du déliage de votre compte.')
                                .setTimestamp();

                            await i.editReply({ 
                                embeds: [errorEmbed],
                                components: []
                            });
                        }
                    }
                });

                collector.on('end', () => {
                    interaction.editReply({ components: [] }).catch(() => {});
                });
            } else {
                // Compte non lié
                const embed = new EmbedBuilder()
                    .setColor('#F97316')
                    .setTitle('Compte non lié')
                    .setDescription('Votre compte Discord n\'est pas encore lié à LogicAI.\n\nLiez votre compte pour accéder à vos instances, workflows et favoris sur votre serveur !')
                    .addFields(
                        { name: 'Comment lier ?', value: 'Cliquez sur le bouton ci-dessous pour vous connecter et lier votre compte Discord.' }
                    )
                    .setFooter({ text: 'LogicAI - www.logicai.fr' })

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setLabel('Lier mon compte')
                            .setURL(`${BACKEND_URL}/auth/discord/link?discord_id=${discordId}`)
                            .setStyle(ButtonStyle.Link)
                    );

                const message = await interaction.editReply({ 
                    embeds: [embed],
                    components: [row]
                });

                // Vérifier automatiquement si le compte a été lié (toutes les 5 secondes pendant 2 minutes)
                let attempts = 0;
                const maxAttempts = 24; // 2 minutes
                
                const checkInterval = setInterval(async () => {
                    attempts++;
                    
                    try {
                        // Vérifier si le compte est maintenant lié
                        const checkResponse = await api.get(`/discord/user/${discordId}`);
                        
                        if (checkResponse.data.linked) {
                            clearInterval(checkInterval);
                            
                            const user = checkResponse.data.user;
                            
                            // Mettre à jour le message avec les infos du compte lié
                            const linkedEmbed = new EmbedBuilder()
                                .setColor('#10B981')
                                .setTitle('Compte lié avec succès !')
                                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
                                .setDescription(`Votre compte Discord est maintenant lié à **${user.email}**`)
                                .addFields(
                                    { name: "Nom d'utilisateur", value: user.name || 'Non défini', inline: true },
                                    { name: 'Abonnement', value: user.plan || 'Gratuit', inline: true },
                                    { name: '\u200B', value: '\u200B', inline: true },
                                    { name: 'Instances', value: `${user.instance_count || 0}`, inline: true },
                                    { name: 'Favoris', value: `${user.favorites_count || 0}`, inline: true },
                                    { name: 'Membre depuis', value: new Date(user.created_at).toLocaleDateString('fr-FR'), inline: true }
                                )
                                .setFooter({ text: 'LogicAI - www.logicai.fr' });

                            const linkedRow = new ActionRowBuilder()
                                .addComponents(
                                    new ButtonBuilder()
                                        .setLabel('Tableau de bord')
                                        .setURL(FRONTEND_URL + '/dashboard')
                                        .setStyle(ButtonStyle.Link),
                                    new ButtonBuilder()
                                        .setCustomId('unlink_account')
                                        .setLabel('Délier mon compte')
                                        .setStyle(ButtonStyle.Danger)
                                );

                            await interaction.editReply({ 
                                embeds: [linkedEmbed],
                                components: [linkedRow]
                            });
                        }
                    } catch (error) {
                        // Ignorer les erreurs de vérification
                    }
                    
                    // Arrêter après 2 minutes
                    if (attempts >= maxAttempts) {
                        clearInterval(checkInterval);
                    }
                }, 5000); // Vérifier toutes les 5 secondes
            }

        } catch (error) {
            console.error('Erreur /account:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#EF4444')
                .setTitle('❌ Erreur')
                .setDescription('Une erreur est survenue lors de la récupération de votre compte.')
                .setFooter({ text: 'Veuillez réessayer plus tard' })
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
