#!/bin/bash
# Script pour supprimer un sous-domaine et sa configuration Nginx
# Usage: ./remove-nginx-subdomain.sh <subdomain>

set -e  # Exit on error

if [ "$#" -ne 1 ]; then
    echo "❌ Usage: $0 <subdomain>"
    echo "   Example: $0 14e1ee4622fe"
    exit 1
fi

SUBDOMAIN=$1
DOMAIN="logicai.fr"
FULL_DOMAIN="${SUBDOMAIN}.${DOMAIN}"
NGINX_CONFIG="/etc/nginx/sites-available/${FULL_DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${FULL_DOMAIN}"

echo "🗑️  Suppression du sous-domaine: ${FULL_DOMAIN}"

# Désactiver le site
if [ -L "${NGINX_ENABLED}" ]; then
    echo "🔗 Désactivation du site..."
    sudo rm "${NGINX_ENABLED}"
fi

# Supprimer la configuration
if [ -f "${NGINX_CONFIG}" ]; then
    echo "📝 Suppression de la configuration..."
    sudo rm "${NGINX_CONFIG}"
fi

# Supprimer les logs
echo "📊 Nettoyage des logs..."
sudo rm -f "/var/log/nginx/${FULL_DOMAIN}.access.log"
sudo rm -f "/var/log/nginx/${FULL_DOMAIN}.error.log"

# Recharger Nginx
echo "🔄 Rechargement de Nginx..."
sudo nginx -t && sudo systemctl reload nginx

# Note: Garder le certificat SSL car il peut être réutilisé
echo ""
echo "✅ Sous-domaine supprimé avec succès!"
echo "ℹ️  Note: Le certificat SSL a été conservé (réutilisable)"
echo "   Pour le supprimer: sudo certbot delete --cert-name ${FULL_DOMAIN}"
echo ""
