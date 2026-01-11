# 🔄 Système de Tracking en Temps Réel

## ✅ Fonctionnement Automatique

Le système est configuré pour tracker automatiquement vos workflows N8N **sans aucune configuration requise** !

### Comment ça marche ?

1. **Auto-Sync en arrière-plan** 🔄
   - Le serveur vérifie automatiquement toutes les **10 secondes** s'il y a de nouvelles exécutions
   - Synchronise toutes vos instances N8N actives
   - Détecte et enregistre les nouvelles exécutions

2. **WebSocket temps réel** ⚡
   - Dès qu'une exécution est détectée, un événement est émis
   - Le dashboard se met à jour **instantanément** (sans rechargement)
   - Notification toast affichée pour chaque nouvelle exécution

3. **Indicateur de connexion** 🟢
   - En haut à droite du dashboard
   - 🟢 "Temps réel actif" = Tout fonctionne
   - 🔴 "Déconnecté" = Perte de connexion WebSocket

## 📊 Ce que vous verrez

### Dans les logs du serveur
```
🔄 Starting auto-sync service (every 10 seconds)...
🔄 Auto-syncing 2 running instances...
  ✅ instance-abc123: 3 new executions
```

### Dans le dashboard
- Les stats se mettent à jour automatiquement
- Notification toast : "Workflow exécuté: Mon Workflow"
- Nouvelle entrée dans les activités récentes
- Compteur "Workflows exécutés" incrémenté

## ⚙️ Configuration

**Aucune configuration requise !** Le système démarre automatiquement avec le serveur.

### Personnalisation (optionnel)

Pour modifier la fréquence de synchronisation, éditez `server/services/autoSyncService.js` :

```javascript
// Change 10000 (10 secondes) à la valeur souhaitée en millisecondes
syncInterval = setInterval(autoSyncAllInstances, 10000);
```

## 🐛 Dépannage

### Les stats ne se mettent pas à jour

1. **Vérifiez que l'instance N8N est démarrée**
   - Status : "running" dans le dashboard

2. **Vérifiez les logs du serveur**
   - Recherchez : "Auto-syncing X running instances"
   - Si absent, redémarrez le serveur

3. **Vérifiez la connexion WebSocket**
   - Indicateur 🟢 en haut à droite du dashboard
   - Console navigateur : "🔌 WebSocket connected"

4. **Vérifiez que la migration est appliquée**
   ```bash
   cd server
   node update-activities.js
   ```

### Délai de mise à jour

- **Maximum 10 secondes** entre l'exécution et l'affichage
- Pour des mises à jour instantanées, configurez le webhook N8N (optionnel, voir ci-dessous)

## 🚀 Webhook N8N (Optionnel - Pour mises à jour instantanées)

Si vous voulez des mises à jour **immédiates** (< 1 seconde), ajoutez un nœud HTTP Request à la fin de vos workflows :

```json
{
  "parameters": {
    "method": "POST",
    "url": "http://localhost:5000/webhooks/n8n/execution",
    "bodyParametersUi": {
      "parameter": [
        {
          "name": "workflowId",
          "value": "={{ $workflow.id }}"
        },
        {
          "name": "workflowName",
          "value": "={{ $workflow.name }}"
        },
        {
          "name": "executionId",
          "value": "={{ $execution.id }}"
        },
        {
          "name": "finished",
          "value": true
        },
        {
          "name": "instancePort",
          "value": "5680"  // Remplacez par votre port
        }
      ]
    }
  },
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2
}
```

**Note :** L'auto-sync fonctionne parfaitement sans cette configuration !
