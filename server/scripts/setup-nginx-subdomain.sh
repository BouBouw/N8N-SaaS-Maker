#!/bin/bash
# Script d'automatisation pour créer un sous-domaine Nginx avec SSL pour une instance N8N
# Usage: ./setup-nginx-subdomain.sh <subdomain> <docker_port>

set -e  # Exit on error

# Vérifier les arguments
if [ "$#" -ne 2 ]; then
    echo "❌ Usage: $0 <subdomain> <docker_port>"
    echo "   Example: $0 14e1ee4622fe 5678"
    exit 1
fi

SUBDOMAIN=$1
DOCKER_PORT=$2
DOMAIN="logicai.fr"
FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
NGINX_CONFIG="/etc/nginx/sites-available/${FULL_DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${FULL_DOMAIN}"

echo "🚀 Configuration du sous-domaine: ${FULL_DOMAIN}"
echo "📍 Port Docker: ${DOCKER_PORT}"

# Étape 1: Créer la configuration Nginx temporaire (HTTP uniquement)
echo "📝 Création de la configuration Nginx temporaire..."
sudo tee "${NGINX_CONFIG}" > /dev/null <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${FULL_DOMAIN};

    # Logging
    access_log /var/log/nginx/${FULL_DOMAIN}.access.log;
    error_log /var/log/nginx/${FULL_DOMAIN}.error.log;

    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP traffic to HTTPS (will be added after SSL)
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

# Étape 2: Activer le site
echo "🔗 Activation du site..."
sudo ln -sf "${NGINX_CONFIG}" "${NGINX_ENABLED}"

# Étape 3: Tester la configuration
echo "🔍 Test de la configuration Nginx..."
sudo nginx -t

# Étape 4: Recharger Nginx
echo "🔄 Rechargement de Nginx..."
sudo systemctl reload nginx

# Étape 5: Attendre que le DNS se propage (optionnel)
echo "⏳ Vérification de la résolution DNS..."
for i in {1..10}; do
    if host "${FULL_DOMAIN}" > /dev/null 2>&1; then
        echo "✅ DNS résolu!"
        break
    fi
    echo "   Tentative $i/10 - En attente de la propagation DNS..."
    sleep 3
done

# Étape 6: Obtenir le certificat SSL avec Certbot
echo "🔒 Obtention du certificat SSL..."
sudo certbot certonly --nginx \
    --non-interactive \
    --agree-tos \
    --email admin@${DOMAIN} \
    --domains ${FULL_DOMAIN}

if [ $? -eq 0 ]; then
    echo "✅ Certificat SSL obtenu avec succès!"
    SSL_SUCCESS=true
else
    echo "⚠️  Impossible d'obtenir le certificat SSL"
    echo "    Cause possible: DNS wildcard non configuré (*.${DOMAIN})"
    echo "    Le site restera accessible en HTTP uniquement"
    echo ""
    echo "    Pour configurer le DNS:"
    echo "    - Ajoutez un enregistrement: * A $(curl -s ifconfig.me)"
    echo "    - Attendez la propagation (quelques minutes à 24h)"
    echo "    - Relancez: sudo certbot --nginx -d ${FULL_DOMAIN}"
    echo ""
    SSL_SUCCESS=false
fi

# Étape 7: Mettre à jour la configuration Nginx avec HTTPS (si SSL obtenu)
if [ "$SSL_SUCCESS" = true ]; then
    echo "📝 Mise à jour de la configuration Nginx avec HTTPS..."
    sudo tee "${NGINX_CONFIG}" > /dev/null <<EOF
# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name ${FULL_DOMAIN};

    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${FULL_DOMAIN};

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/${FULL_DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${FULL_DOMAIN}/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/${FULL_DOMAIN}/chain.pem;

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/${FULL_DOMAIN}.access.log;
    error_log /var/log/nginx/${FULL_DOMAIN}.error.log;

    # N8N Reverse Proxy
    location / {
        proxy_pass http://localhost:${DOCKER_PORT};
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Port \$server_port;
        
        # Timeouts for long-running workflows
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Buffer settings
        proxy_buffering off;
        proxy_request_buffering off;
        
        # Body size (for large workflow imports)
        client_max_body_size 50M;
    }

    # Health check endpoint
    location /healthz {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

    # Étape 8: Test final de la configuration
    echo "🔍 Test final de la configuration..."
    sudo nginx -t

    # Étape 9: Recharger Nginx avec la nouvelle configuration
    echo "🔄 Rechargement final de Nginx..."
    sudo systemctl reload nginx

    echo ""
    echo "✅ =============================================="
    echo "✅ Configuration terminée avec succès!"
    echo "✅ =============================================="
    echo ""
    echo "🌐 Votre instance N8N est maintenant accessible à:"
    echo "   https://${FULL_DOMAIN}"
    echo ""
    echo "🔒 Certificat SSL: Actif"
    echo "📝 Fichier de configuration: ${NGINX_CONFIG}"
    echo "📊 Logs:"
    echo "   - Access: /var/log/nginx/${FULL_DOMAIN}.access.log"
    echo "   - Error: /var/log/nginx/${FULL_DOMAIN}.error.log"
    echo ""
else
    # Pas de SSL - garder la config HTTP uniquement
    echo ""
    echo "⚠️  =============================================="
    echo "⚠️  Configuration terminée (HTTP uniquement)"
    echo "⚠️  =============================================="
    echo ""
    echo "🌐 Votre instance N8N est accessible à:"
    echo "   http://${FULL_DOMAIN}"
    echo ""
    echo "⚠️  Certificat SSL: NON CONFIGURÉ"
    echo "    Pour obtenir le SSL:"
    echo "    1. Configurez le DNS wildcard: *.${DOMAIN} → Votre IP"
    echo "    2. Attendez la propagation DNS"
    echo "    3. Exécutez: sudo certbot --nginx -d ${FULL_DOMAIN}"
    echo ""
    echo "📝 Fichier de configuration: ${NGINX_CONFIG}"
    echo "📊 Logs:"
    echo "   - Access: /var/log/nginx/${FULL_DOMAIN}.access.log"
    echo "   - Error: /var/log/nginx/${FULL_DOMAIN}.error.log"
    echo ""
fi
