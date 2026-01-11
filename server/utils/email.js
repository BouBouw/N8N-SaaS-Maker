const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Send password creation email for Discord accounts
async function sendPasswordCreationEmail(email, name, resetUrl) {
    const mailOptions = {
        from: `"${process.env.APP_NAME || 'LogicAI'}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '🔐 Créez votre mot de passe - LogicAI',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        background-color: #f4f4f4;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }
                    .header {
                        background: linear-gradient(135deg, #f97316 0%, #fb923c 100%);
                        padding: 40px 30px;
                        text-align: center;
                        color: white;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        font-weight: 700;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .content h2 {
                        color: #1f2937;
                        margin-top: 0;
                        font-size: 22px;
                    }
                    .content p {
                        color: #4b5563;
                        margin: 16px 0;
                        font-size: 16px;
                    }
                    .button-container {
                        text-align: center;
                        margin: 32px 0;
                    }
                    .button {
                        display: inline-block;
                        padding: 14px 32px;
                        background: #f97316;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 16px;
                        transition: background 0.3s;
                    }
                    .button:hover {
                        background: #ea580c;
                    }
                    .info-box {
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 16px;
                        margin: 24px 0;
                        border-radius: 4px;
                    }
                    .info-box p {
                        margin: 0;
                        color: #92400e;
                        font-size: 14px;
                    }
                    .footer {
                        background: #f9fafb;
                        padding: 24px 30px;
                        text-align: center;
                        border-top: 1px solid #e5e7eb;
                    }
                    .footer p {
                        margin: 8px 0;
                        color: #6b7280;
                        font-size: 13px;
                    }
                    .link {
                        color: #f97316;
                        text-decoration: none;
                        word-break: break-all;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔐 LogicAI</h1>
                    </div>
                    
                    <div class="content">
                        <h2>Bonjour ${name || 'cher utilisateur'} 👋</h2>
                        
                        <p>
                            Vous avez demandé à créer un mot de passe pour votre compte LogicAI 
                            qui a été initialement créé via Discord.
                        </p>
                        
                        <p>
                            Cliquez sur le bouton ci-dessous pour définir votre mot de passe et 
                            pouvoir vous connecter également par email :
                        </p>
                        
                        <div class="button-container">
                            <a href="${resetUrl}" class="button">Créer mon mot de passe</a>
                        </div>
                        
                        <div class="info-box">
                            <p>⏰ Ce lien expire dans <strong>1 heure</strong> pour des raisons de sécurité.</p>
                        </div>
                        
                        <p>
                            Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :
                        </p>
                        <p>
                            <a href="${resetUrl}" class="link">${resetUrl}</a>
                        </p>
                        
                        <p style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
                            <strong>Vous n'avez pas demandé cette action ?</strong><br>
                            Ignorez simplement cet email. Votre compte reste sécurisé.
                        </p>
                    </div>
                    
                    <div class="footer">
                        <p><strong>LogicAI</strong> - Votre plateforme d'automatisation N8N</p>
                        <p>© ${new Date().getFullYear()} LogicAI. Tous droits réservés.</p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
Bonjour ${name || 'cher utilisateur'},

Vous avez demandé à créer un mot de passe pour votre compte LogicAI qui a été initialement créé via Discord.

Cliquez sur ce lien pour définir votre mot de passe :
${resetUrl}

⏰ Ce lien expire dans 1 heure pour des raisons de sécurité.

Vous n'avez pas demandé cette action ? Ignorez simplement cet email. Votre compte reste sécurisé.

---
LogicAI - Votre plateforme d'automatisation N8N
© ${new Date().getFullYear()} LogicAI. Tous droits réservés.
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        throw error;
    }
}

// Send password reset email
async function sendPasswordResetEmail(email, name, resetUrl) {
    const mailOptions = {
        from: `"${process.env.APP_NAME || 'LogicAI'}" <${process.env.SMTP_USER}>`,
        to: email,
        subject: '🔑 Réinitialisation de votre mot de passe - LogicAI',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        background-color: #f4f4f4;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background: #ffffff;
                        border-radius: 12px;
                        overflow: hidden;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    }
                    .header {
                        background: linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%);
                        padding: 40px 30px;
                        text-align: center;
                        color: white;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 28px;
                        font-weight: 700;
                    }
                    .content {
                        padding: 40px 30px;
                    }
                    .content h2 {
                        color: #1f2937;
                        margin-top: 0;
                        font-size: 22px;
                    }
                    .content p {
                        color: #4b5563;
                        margin: 16px 0;
                        font-size: 16px;
                    }
                    .button-container {
                        text-align: center;
                        margin: 32px 0;
                    }
                    .button {
                        display: inline-block;
                        padding: 14px 32px;
                        background: #3b82f6;
                        color: white !important;
                        text-decoration: none;
                        border-radius: 8px;
                        font-weight: 600;
                        font-size: 16px;
                    }
                    .info-box {
                        background: #fef3c7;
                        border-left: 4px solid #f59e0b;
                        padding: 16px;
                        margin: 24px 0;
                        border-radius: 4px;
                    }
                    .footer {
                        background: #f9fafb;
                        padding: 24px 30px;
                        text-align: center;
                        border-top: 1px solid #e5e7eb;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🔑 LogicAI</h1>
                    </div>
                    <div class="content">
                        <h2>Réinitialisation de mot de passe</h2>
                        <p>Bonjour ${name || 'cher utilisateur'},</p>
                        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
                        <div class="button-container">
                            <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
                        </div>
                        <div class="info-box">
                            <p>⏰ Ce lien expire dans <strong>1 heure</strong>.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>© ${new Date().getFullYear()} LogicAI</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Error sending email:', error);
        throw error;
    }
}

module.exports = {
    sendPasswordCreationEmail,
    sendPasswordResetEmail,
    transporter
};
