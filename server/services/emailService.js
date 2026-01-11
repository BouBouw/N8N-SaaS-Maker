const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    /**
     * Email template wrapper
     */
    getEmailTemplate(content) {
        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LogicAI - N8N SaaS</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0A0A0A; color: #ffffff;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0A0A; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(20, 20, 20, 0.95) 0%, rgba(30, 30, 30, 0.95) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #FF6B2C 0%, #FF8C5C 100%); padding: 40px; text-align: center;">
                            <h1 style="margin: 0; font-size: 32px; font-weight: bold; color: #ffffff;">
                                ⚡ LogicAI
                            </h1>
                            <p style="margin: 10px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.9);">
                                N8N SaaS Platform
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px; background-color: rgba(0, 0, 0, 0.3); border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
                            <p style="margin: 0 0 10px 0; font-size: 12px; color: rgba(255, 255, 255, 0.5);">
                                © 2026 LogicAI. Tous droits réservés.
                            </p>
                            <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.5);">
                                Cet email a été envoyé par LogicAI N8N SaaS Platform
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    /**
     * Send instance invitation email
     */
    async sendInvitationEmail(to, instanceName, inviterName, invitationLink, isNewUser = false) {
        const content = `
            <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff;">
                ${isNewUser ? '🎉 Bienvenue sur LogicAI !' : '📨 Nouvelle invitation'}
            </h2>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.9);">
                <strong>${inviterName}</strong> vous invite à rejoindre l'instance N8N :
            </p>
            
            <div style="background: rgba(255, 107, 44, 0.1); border: 1px solid rgba(255, 107, 44, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; font-size: 18px; font-weight: bold; color: #FF6B2C;">
                    🚀 ${instanceName}
                </p>
            </div>
            
            ${isNewUser ? `
            <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.8);">
                Vous n'avez pas encore de compte LogicAI. En cliquant sur le bouton ci-dessous, vous pourrez :
            </p>
            <ul style="margin: 10px 0 20px 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: rgba(255, 255, 255, 0.8);">
                <li>Créer votre compte gratuitement</li>
                <li>Accéder automatiquement à l'instance</li>
                <li>Commencer à collaborer immédiatement</li>
            </ul>
            ` : `
            <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.8);">
                Cette invitation vous permettra d'accéder à l'instance N8N et de collaborer avec l'équipe.
            </p>
            `}
            
            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                    <td align="center">
                        <a href="${invitationLink}" style="display: inline-block; background: linear-gradient(135deg, #FF6B2C 0%, #FF8C5C 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(255, 107, 44, 0.3);">
                            ${isNewUser ? '✨ Créer mon compte et rejoindre' : '🚀 Accepter l\'invitation'}
                        </a>
                    </td>
                </tr>
            </table>
            
            <p style="margin: 30px 0 10px 0; font-size: 12px; color: rgba(255, 255, 255, 0.5);">
                Ou copiez ce lien dans votre navigateur :
            </p>
            <p style="margin: 0; font-size: 12px; color: #FF6B2C; word-break: break-all;">
                ${invitationLink}
            </p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                <p style="margin: 0; font-size: 12px; color: rgba(255, 255, 255, 0.5);">
                    ⚠️ Ce lien d'invitation est valable pendant 7 jours. Si vous n'êtes pas concerné par cette invitation, vous pouvez ignorer cet email.
                </p>
            </div>
        `;

        const mailOptions = {
            from: `"LogicAI" <${process.env.SMTP_USER}>`,
            to,
            subject: isNewUser 
                ? `🎉 Bienvenue sur LogicAI - Invitation à rejoindre "${instanceName}"`
                : `📨 Invitation à rejoindre l'instance "${instanceName}"`,
            html: this.getEmailTemplate(content)
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('✅ Invitation email sent to:', to);
            return true;
        } catch (error) {
            console.error('❌ Error sending email:', error);
            throw error;
        }
    }

    /**
     * Send welcome email for new members
     */
    async sendWelcomeEmail(to, name, instanceName) {
        const content = `
            <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff;">
                🎉 Bienvenue ${name} !
            </h2>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.9);">
                Vous avez été ajouté avec succès à l'instance :
            </p>
            
            <div style="background: rgba(255, 107, 44, 0.1); border: 1px solid rgba(255, 107, 44, 0.3); border-radius: 12px; padding: 20px; margin: 20px 0;">
                <p style="margin: 0; font-size: 18px; font-weight: bold; color: #FF6B2C;">
                    🚀 ${instanceName}
                </p>
            </div>
            
            <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.8);">
                Vous pouvez maintenant accéder à votre tableau de bord et commencer à travailler sur vos workflows N8N.
            </p>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                    <td align="center">
                        <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #FF6B2C 0%, #FF8C5C 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(255, 107, 44, 0.3);">
                            🎯 Accéder au Dashboard
                        </a>
                    </td>
                </tr>
            </table>
            
            <div style="margin-top: 30px; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #ffffff;">📚 Prochaines étapes :</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: rgba(255, 255, 255, 0.8);">
                    <li>Explorez votre instance N8N</li>
                    <li>Créez vos premiers workflows</li>
                    <li>Collaborez avec votre équipe</li>
                    <li>Consultez la documentation</li>
                </ul>
            </div>
        `;

        const mailOptions = {
            from: `"LogicAI" <${process.env.SMTP_USER}>`,
            to,
            subject: `🎉 Bienvenue sur l'instance "${instanceName}"`,
            html: this.getEmailTemplate(content)
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('✅ Welcome email sent to:', to);
            return true;
        } catch (error) {
            console.error('❌ Error sending email:', error);
            throw error;
        }
    }

    /**
     * Send instance creation confirmation with credentials
     */
    async sendInstanceCreatedEmail(to, name, instanceDetails) {
        const { instanceName, instanceUrl, email, password, port } = instanceDetails;
        
        const content = `
            <h2 style="margin: 0 0 20px 0; font-size: 24px; color: #ffffff;">
                🎉 Votre instance N8N est prête !
            </h2>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.9);">
                Bonjour <strong>${name}</strong>,
            </p>
            
            <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: rgba(255, 255, 255, 0.9);">
                Votre instance N8N <strong>"${instanceName}"</strong> a été créée et configurée avec succès ! 🚀
            </p>
            
            <div style="background: rgba(255, 107, 44, 0.1); border: 1px solid rgba(255, 107, 44, 0.3); border-radius: 12px; padding: 25px; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; font-size: 18px; color: #FF6B2C;">🔑 Identifiants de connexion</h3>
                
                <table width="100%" cellpadding="8" cellspacing="0" style="font-size: 14px;">
                    <tr>
                        <td style="color: rgba(255, 255, 255, 0.7); padding: 8px 0;">
                            <strong>🌐 URL d'accès :</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 16px; background: rgba(0, 0, 0, 0.3); border-radius: 8px; margin-bottom: 12px;">
                            <a href="${instanceUrl}" style="color: #FF8C5C; text-decoration: none; font-family: 'Courier New', monospace; word-break: break-all;">
                                ${instanceUrl}
                            </a>
                        </td>
                    </tr>
                    
                    <tr><td style="height: 12px;"></td></tr>
                    
                    <tr>
                        <td style="color: rgba(255, 255, 255, 0.7); padding: 8px 0;">
                            <strong>📧 Email :</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 16px; background: rgba(0, 0, 0, 0.3); border-radius: 8px; margin-bottom: 12px;">
                            <code style="color: #ffffff; font-family: 'Courier New', monospace;">${email}</code>
                        </td>
                    </tr>
                    
                    <tr><td style="height: 12px;"></td></tr>
                    
                    <tr>
                        <td style="color: rgba(255, 255, 255, 0.7); padding: 8px 0;">
                            <strong>🔒 Mot de passe :</strong>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 16px; background: rgba(0, 0, 0, 0.3); border-radius: 8px;">
                            <code style="color: #FF6B2C; font-family: 'Courier New', monospace; font-weight: bold; font-size: 16px;">${password}</code>
                        </td>
                    </tr>
                </table>
                
                <div style="margin-top: 20px; padding: 15px; background: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 8px;">
                    <p style="margin: 0; font-size: 13px; color: rgba(255, 193, 7, 0.9);">
                        ⚠️ <strong>Important :</strong> Conservez ces identifiants en lieu sûr. Vous pourrez changer votre mot de passe depuis les paramètres de N8N après votre première connexion.
                    </p>
                </div>
            </div>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                    <td align="center">
                        <a href="${instanceUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF6B2C 0%, #FF8C5C 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(255, 107, 44, 0.3);">
                            🚀 Se connecter maintenant
                        </a>
                    </td>
                </tr>
            </table>
            
            <div style="margin-top: 30px; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #ffffff;">📚 Prochaines étapes :</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: rgba(255, 255, 255, 0.8);">
                    <li>Connectez-vous à votre instance N8N</li>
                    <li>Explorez les modèles de workflows disponibles</li>
                    <li>Créez votre premier automatisation</li>
                    <li>Invitez des collaborateurs depuis le dashboard LogicAI</li>
                </ul>
            </div>
            
            <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: rgba(255, 255, 255, 0.7);">
                Besoin d'aide ? Consultez notre <a href="${process.env.FRONTEND_URL}/docs" style="color: #FF6B2C; text-decoration: none;">documentation</a> ou contactez notre support.
            </p>
        `;

        const mailOptions = {
            from: `"LogicAI" <${process.env.SMTP_USER}>`,
            to,
            subject: `🚀 Votre instance N8N "${instanceName}" est prête !`,
            html: this.getEmailTemplate(content)
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log('✅ Instance creation email sent to:', to);
            return true;
        } catch (error) {
            console.error('❌ Error sending instance creation email:', error);
            throw error;
        }
    }
}

module.exports = new EmailService();
