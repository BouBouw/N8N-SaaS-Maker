# 🤖 Automatisation des Sous-domaines N8N

## 📖 Vue d'ensemble

Ce système automatise complètement la création de sous-domaines HTTPS pour chaque instance N8N créée. Lorsqu'un utilisateur crée une instance, le système:

1. ✅ Crée automatiquement un conteneur Docker N8N
2. ✅ Configure le compte owner avec credentials sécurisés
3. ✅ Génère un sous-domaine unique (ex: `abc123.logicai.fr`)
4. ✅ Configure Nginx comme reverse proxy
5. ✅ Obtient un certificat SSL via Let's Encrypt
6. ✅ Envoie un email avec l'URL HTTPS et les credentials

## 🎯 Fonctionnalités

### Création Automatique
- **Sous-domaine unique** généré à partir de l'UUID
- **Certificat SSL** obtenu automatiquement via Certbot
- **Configuration Nginx** créée et activée automatiquement
- **URL publique HTTPS** enregistrée en base de données
- **Email de confirmation** avec credentials et URL

### Suppression Automatique
- **Nettoyage complet** de la configuration Nginx
- **Suppression des logs** associés
- **Conservation du certificat SSL** pour réutilisation

### Sécurité
- **TLS 1.2/1.3** uniquement
- **Headers de sécurité** (HSTS, X-Frame-Options, etc.)
- **Isolation complète** par conteneur Docker
- **Mots de passe forts** générés automatiquement

## 📁 Fichiers Créés

```
server/
├── services/
│   └── nginxService.js          # ✅ Service de gestion Nginx/SSL
├── scripts/
│   ├── setup-nginx-subdomain.sh # ✅ Script création sous-domaine + SSL
│   └── remove-nginx-subdomain.sh# ✅ Script suppression sous-domaine
└── migrations/
    └── add_public_url.sql       # ✅ Migration pour colonne public_url

Docs/
├── DEPLOYMENT_AUTOMATION.md     # ✅ Guide installation détaillé
├── AUTOMATION_SYSTEM.md         # ✅ Documentation technique
└── DEPLOYMENT_CHECKLIST.md      # ✅ Checklist étape par étape
```

## 📚 Documentation

### Pour l'Installation
👉 **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Suivez cette checklist pas à pas

### Pour Comprendre le Système
👉 **[AUTOMATION_SYSTEM.md](AUTOMATION_SYSTEM.md)** - Documentation technique complète

### Guide Détaillé
👉 **[DEPLOYMENT_AUTOMATION.md](DEPLOYMENT_AUTOMATION.md)** - Guide d'installation approfondi

## ⚡ Quick Start

### Prérequis Critiques

1. **DNS Wildcard configuré:**
   ```
   *.logicai.fr → VOTRE_IP_VPS
   ```

2. **Logiciels installés:**
   - Node.js 20.x
   - Nginx
   - Certbot
   - Docker
   - MySQL

### Installation en 5 Minutes

```bash
# 1. Configurer DNS wildcard chez votre provider
# (voir DEPLOYMENT_CHECKLIST.md)

# 2. Sur le VPS, rendre les scripts exécutables
cd /var/www/logicai-api/server
chmod +x scripts/*.sh

# 3. Configurer sudo sans mot de passe
sudo visudo
# Ajouter (remplacez 'ubuntu' par votre user):
ubuntu ALL=(ALL) NOPASSWD: /var/www/logicai-api/server/scripts/*.sh
ubuntu ALL=(ALL) NOPASSWD: /usr/sbin/nginx
ubuntu ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx
ubuntu ALL=(ALL) NOPASSWD: /usr/bin/certbot

# 4. Appliquer la migration DB
mysql -u logicai_user -p logicai_db < migrations/add_public_url.sql

# 5. Redémarrer l'application
pm2 restart logicai-api

# 6. Tester!
pm2 logs logicai-api --lines 0
# Puis créez une instance via l'interface web
```

## 🧪 Test du Système

### Test Manuel

```bash
# Tester la création d'un sous-domaine
sudo ./scripts/setup-nginx-subdomain.sh test123 5678

# Vérifier que ça fonctionne
curl -I https://test123.logicai.fr
# HTTP/2 200 OK

# Supprimer le test
sudo ./scripts/remove-nginx-subdomain.sh test123
```

### Test via l'Interface

1. Connectez-vous à https://logicai.fr
2. Créez une instance N8N
3. Surveillez les logs: `pm2 logs logicai-api`
4. Vérifiez l'email reçu
5. Accédez à l'URL HTTPS fournie

## 🔍 Logs et Monitoring

```bash
# Logs application
pm2 logs logicai-api --lines 100

# Logs Nginx (tous les sous-domaines)
sudo tail -f /var/log/nginx/*.logicai.fr.access.log

# Logs Certbot
sudo cat /var/log/letsencrypt/letsencrypt.log

# Lister tous les sous-domaines configurés
ls /etc/nginx/sites-available/ | grep logicai.fr

# Lister tous les certificats SSL
sudo certbot certificates
```

## 🐛 Dépannage Rapide

### DNS ne résout pas
```bash
# Vérifier la résolution DNS
nslookup test.logicai.fr

# Si ça ne fonctionne pas:
# 1. Vérifiez que le wildcard DNS est configuré
# 2. Attendez la propagation (jusqu'à 24h)
```

### Script échoue avec "Permission denied"
```bash
# Vérifier que les scripts sont exécutables
ls -la scripts/*.sh

# Les rendre exécutables
chmod +x scripts/*.sh

# Vérifier sudo
sudo ./scripts/setup-nginx-subdomain.sh test 5678
# Ne devrait PAS demander de mot de passe
```

### Certbot échoue
```bash
# Voir les logs détaillés
sudo cat /var/log/letsencrypt/letsencrypt.log

# Vérifier que le port 80 est ouvert
sudo ufw status | grep 80

# Tester manuellement
sudo certbot certonly --nginx -d test.logicai.fr
```

### Instance créée mais pas de sous-domaine
```bash
# Vérifier les logs PM2
pm2 logs logicai-api --err --lines 100

# Vérifier que nginxService fonctionne
cd /var/www/logicai-api/server
node -e "const ns = require('./services/nginxService'); console.log('OK');"

# Tester le script manuellement
sudo ./scripts/setup-nginx-subdomain.sh test 5678
```

## 🎯 Workflow Complet

```
┌─────────────────────────────────────────────────────┐
│  Utilisateur crée une instance via l'interface     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Backend crée l'entrée en DB (status: 'creating')  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  dockerService.createN8NInstance()                  │
│  - Crée conteneur Docker                            │
│  - Attend que N8N soit prêt (max 2 min)            │
│  - Configure compte owner via API N8N               │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  nginxService.setupSubdomain()                      │
│  - Exécute setup-nginx-subdomain.sh                 │
│  - Crée config Nginx HTTP                           │
│  - Obtient certificat SSL                           │
│  - Met à jour config avec HTTPS                     │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Mise à jour DB                                     │
│  - public_url = https://abc123.logicai.fr          │
│  - status = 'running'                               │
│  - owner_password = mot de passe généré             │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│  Email envoyé à l'utilisateur                       │
│  - URL HTTPS publique                               │
│  - Email de connexion                               │
│  - Mot de passe                                     │
└─────────────────────────────────────────────────────┘
```

## 📊 Métriques

Après installation, vous pouvez suivre:

- **Nombre d'instances actives:** `docker ps | grep n8n_ | wc -l`
- **Sous-domaines configurés:** `ls /etc/nginx/sites-enabled/ | grep logicai.fr | wc -l`
- **Certificats SSL:** `sudo certbot certificates | grep "Certificate Name" | wc -l`
- **Usage RAM par instance:** `docker stats --no-stream | grep n8n_`

## 🚀 Optimisations Futures

- **Queue System:** Gérer les créations en file d'attente (Bull/BullMQ)
- **Health Checks:** Vérification périodique des instances
- **DNS API:** Créer les enregistrements A dynamiquement via API
- **Traefik:** Reverse proxy automatique avec détection Docker
- **Monitoring:** Prometheus + Grafana pour métriques avancées

## 📞 Support

**En cas de problème, dans l'ordre:**

1. ✅ Vérifiez `pm2 logs logicai-api`
2. ✅ Testez les scripts manuellement
3. ✅ Vérifiez la config DNS (nslookup)
4. ✅ Consultez les logs Nginx/Certbot
5. ✅ Lisez [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)

---

## ✨ Résumé

**Avant:** Les utilisateurs devaient accéder aux instances via `localhost:PORT` uniquement.

**Après:** Chaque instance reçoit automatiquement une URL HTTPS publique sécurisée type `https://abc123.logicai.fr` 🎉

**Le système est maintenant entièrement automatisé!**
