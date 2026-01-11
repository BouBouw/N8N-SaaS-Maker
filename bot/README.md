# LogicAI Discord Bot 🤖

Bot Discord pour interagir avec la plateforme LogicAI directement depuis Discord.

## 🚀 Fonctionnalités

### Commandes disponibles

- **`/account`** - Voir votre compte LogicAI ou lier votre compte Discord
- **`/instance <id>`** - Voir les détails d'une instance N8N (avec autocomplete)
- **`/instances`** - Parcourir toutes vos instances N8N (pagination)
- **`/workflow <search>`** - Rechercher un workflow dans les ressources
- **`/workflows [type] [prix]`** - Parcourir toutes les ressources avec filtres
- **`/favorites`** - Voir vos ressources favorites

### Système de forum posts

Le bot peut automatiquement publier dans le forum Discord lorsqu'une nouvelle ressource est ajoutée sur la plateforme.

**Canal forum:** 1459728691511820510

**Tags disponibles:**
- Workflows: 1459733866628645089
- Prompts: 1459733891328905276
- Gratuit: 1459733917799022632
- Payant: 1459733955962998807

## 📦 Installation

1. **Cloner le projet** (déjà fait si vous lisez ceci)

2. **Installer les dépendances**
```bash
cd bot
npm install
```

3. **Configuration**

Copier `.env.example` en `.env` et configurer:
```bash
cp .env.example .env
```

Variables à configurer:
- `TOKEN`: Token du bot Discord (depuis Discord Developer Portal)
- `CLIENT_ID`: ID de l'application Discord
- `DB_*`: Configuration de la base de données (identique au serveur)
- `BACKEND_URL`: URL de l'API backend (par défaut: http://localhost:5000)
- `BOT_PORT`: Port du serveur HTTP du bot (par défaut: 3002)

4. **Créer le bot Discord**

- Aller sur [Discord Developer Portal](https://discord.com/developers/applications)
- Créer une nouvelle application
- Aller dans "Bot" et créer un bot
- Copier le token et le mettre dans `.env`
- Activer les intents nécessaires:
  - Presence Intent
  - Server Members Intent
  - Message Content Intent
- Inviter le bot sur votre serveur avec les permissions:
  - Send Messages
  - Embed Links
  - Use Slash Commands
  - Create Forum Posts

5. **Lancer le bot**

```bash
npm start
```

Ou en mode développement:
```bash
npm run dev
```

## 🏗️ Structure du projet

```
bot/
├── index.js                 # Point d'entrée principal
├── handlers/
│   └── handler.js          # Gestionnaire de commandes/événements
├── src/
│   ├── commands/           # Commandes slash
│   │   ├── account.js
│   │   ├── instance.js
│   │   ├── instances.js
│   │   ├── workflow.js
│   │   ├── workflows.js
│   │   └── favorites.js
│   ├── events/             # Événements Discord
│   │   └── client/
│   │       ├── clientReady.js
│   │       └── interactionCreate.js
│   └── server/             # Serveur HTTP du bot
│       └── app.js          # Express server + API backend
```

## 🔧 API Backend

Le bot communique avec le backend LogicAI via les endpoints suivants:

### Endpoints pour le bot
- `GET /discord/user/:discordId` - Infos utilisateur
- `GET /discord/user/:discordId/instances` - Liste des instances
- `GET /discord/user/:discordId/instance/:identifier` - Détails instance
- `GET /discord/resources/search?q=<query>` - Recherche ressources
- `GET /discord/resources?type=<type>&free=<true|false>` - Liste ressources
- `GET /discord/user/:discordId/favorites` - Liste favoris
- `POST /discord/user/:discordId/favorites/:resourceId` - Ajouter favori
- `DELETE /discord/user/:discordId/favorites/:resourceId` - Retirer favori

### Endpoint pour forum posts (webhook)
- `POST /forum-post` - Publier dans le forum Discord

Exemple:
```json
{
  "title": "Nouveau workflow: Automation Instagram",
  "description": "Automatisez vos posts Instagram avec ce workflow...",
  "tags": ["Workflows", "Payant"],
  "resourceId": 123,
  "resourceType": "workflow"
}
```

## 🔗 Liaison des comptes

Les utilisateurs doivent lier leur compte LogicAI à leur compte Discord pour utiliser les commandes.

1. L'utilisateur tape `/account`
2. Le bot vérifie si le compte est lié via `discord_id` dans la table `users`
3. Si non lié, un bouton "Lier mon compte" est affiché
4. L'utilisateur clique et est redirigé vers le site pour l'OAuth Discord
5. Après liaison, toutes les commandes deviennent disponibles

## 📊 Base de données

Le bot utilise la même base de données que le backend. Assurez-vous que:
- La table `users` a une colonne `discord_id` (VARCHAR)
- Les tables nécessaires existent: `n8n_instances`, `resources`, `favorites`, etc.

## 🐛 Débogage

Les logs du bot affichent:
- Connexion du bot
- Chargement des commandes
- Utilisation des commandes
- Erreurs API

Format des logs:
```
[BOT] Connected as LogicAI#1234
[CMDS] Loading command: account
[CMD] User#1234 used /account in ServerName
[ERROR] Error executing account: ...
```

## 📝 Développement

### Ajouter une commande

1. Créer un fichier dans `src/commands/`
2. Exporter un objet avec `data` (SlashCommandBuilder) et `execute`
3. Le handler chargera automatiquement la commande

Exemple:
```javascript
import { SlashCommandBuilder } from 'discord.js';
import { api } from '../../server/app.js';

export default {
    data: new SlashCommandBuilder()
        .setName('macommande')
        .setDescription('Description'),
    
    async execute(interaction) {
        await interaction.reply('Hello!');
    }
};
```

### Ajouter un événement

1. Créer un fichier dans `src/events/client/`
2. Exporter un objet avec `name` et `execute`
3. Le handler chargera automatiquement l'événement

## 🚀 Production

Pour le déploiement en production:

1. Utiliser PM2 pour gérer le processus:
```bash
npm install -g pm2
pm2 start index.js --name logicai-bot
pm2 save
pm2 startup
```

2. Configurer les variables d'environnement de production
3. S'assurer que le backend est accessible
4. Vérifier que le bot a les permissions nécessaires sur Discord

## 📄 License

Ce bot fait partie du projet LogicAI.
