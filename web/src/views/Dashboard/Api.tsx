import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router';
import {
    Key,
    Copy,
    RotateCw,
    Trash2,
    Eye,
    EyeOff,
    AlertTriangle,
    CheckCircle,
    Activity,
    Clock,
    TrendingUp,
    Zap,
    Code,
    Terminal,
    Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import apiKeysApi, { type ApiKeyInfo, type ApiStats } from '../../api/apiKeys';
import { instancesApi } from '../../api/instances';

export default function ApiPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const [instances, setInstances] = useState<any[]>([]);
    const [selectedInstance, setSelectedInstance] = useState<any>(null);
    const [apiKey, setApiKey] = useState<ApiKeyInfo | null>(null);
    const [newApiKey, setNewApiKey] = useState<string>('');

    const canUseApi = user?.subscription_plan === 'pro' || user?.subscription_plan === 'business';

    // Redirect if user doesn't have access
    useEffect(() => {
        if (user && !canUseApi) {
            showToast('warning', 'L\'accès API nécessite un plan Pro ou Business');
            navigate('/dashboard');
        }
    }, [user, canUseApi, navigate]);

    // Don't render anything if user can't access
    if (!canUseApi) {
        return null;
    }
    const [showApiKey, setShowApiKey] = useState(false);
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<ApiStats | null>(null);

    useEffect(() => {
        loadInstances();
    }, []);

    useEffect(() => {
        if (selectedInstance) {
            loadApiKey();
            loadStats();
        }
    }, [selectedInstance]);

    const loadInstances = async () => {
        try {
            const result = await instancesApi.getInstances();
            const runningInstances = result.instances.filter((i: any) => i.status === 'running');
            setInstances(runningInstances);
            if (runningInstances.length > 0) {
                setSelectedInstance(runningInstances[0]);
            }
        } catch (error) {
            console.error('Error loading instances:', error);
        }
    };

    const loadApiKey = async () => {
        try {
            const result = await apiKeysApi.getApiKey(selectedInstance.id);
            setApiKey(result.apiKey);
        } catch (error) {
            console.error('Error loading API key:', error);
        }
    };

    const loadStats = async () => {
        try {
            const result = await apiKeysApi.getStats(selectedInstance.id);
            setStats(result.stats);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleCreateApiKey = async () => {
        if (!selectedInstance) return;

        try {
            setLoading(true);
            const result = await apiKeysApi.createApiKey(selectedInstance.id);
            setNewApiKey(result.apiKey);
            showToast('success', result.message);
            await loadApiKey();
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de la création');
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerateApiKey = async () => {
        if (!selectedInstance || !confirm('Êtes-vous sûr de vouloir régénérer la clé API ? L\'ancienne clé ne fonctionnera plus.')) {
            return;
        }

        try {
            setLoading(true);
            const result = await apiKeysApi.regenerateApiKey(selectedInstance.id);
            setNewApiKey(result.apiKey);
            showToast('success', result.message);
            await loadApiKey();
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de la régénération');
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeApiKey = async () => {
        if (!selectedInstance || !confirm('Êtes-vous sûr de vouloir révoquer cette clé API ?')) {
            return;
        }

        try {
            setLoading(true);
            await apiKeysApi.revokeApiKey(selectedInstance.id);
            showToast('success', 'Clé API révoquée');
            setApiKey(null);
            setNewApiKey('');
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de la révocation');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('success', 'Copié dans le presse-papiers');
    };

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <div className="flex items-center gap-3 mb-2">
                        <h1 className="text-3xl font-bold">API REST</h1>
                    </div>
                    <p className="text-gray-400">Exécutez et gérez vos workflows N8N via l'API REST</p>
                </motion.div>

                {instances.length === 0 ? (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/5 border border-white/10 rounded-xl p-12 text-center"
                    >
                        <Terminal className="size-16 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Aucune instance disponible</h3>
                        <p className="text-gray-400 mb-6">Créez une instance N8N pour commencer à utiliser l'API</p>
                        <button 
                            onClick={() => navigate('/dashboard/instances')}
                            className="px-6 py-2.5 bg-brand-orange hover:bg-brand-orange/80 text-white rounded-lg font-semibold transition-all"
                        >
                            Créer une instance
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        {/* Main Content */}
                        <div className="xl:col-span-2 space-y-6">
                            {/* Instance Selector */}
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-linear-to-br from-white/[0.07] to-white/2 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
                            >
                                <label className="block text-sm font-medium text-gray-400 mb-3">Instance sélectionnée</label>
                                <select
                                    value={selectedInstance?.id || ''}
                                    onChange={(e) => {
                                        const instance = instances.find(i => i.id === parseInt(e.target.value));
                                        setSelectedInstance(instance);
                                        setNewApiKey('');
                                    }}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange/50 transition-all"
                                >
                                    {instances.map(instance => (
                                        <option key={instance.id} value={instance.id} className="bg-bg-card">
                                            {instance.name}
                                        </option>
                                    ))}
                                </select>
                            </motion.div>

                            {/* API Key Card */}
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-linear-to-br from-white/[0.07] to-white/2 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
                            >
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-brand-orange/10 rounded-lg">
                                            <Key className="size-5 text-brand-orange" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">Clé API</h3>
                                            <p className="text-sm text-gray-400">Authentification pour vos requêtes</p>
                                        </div>
                                    </div>
                                    {apiKey && (
                                        <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                                            apiKey.is_active
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        }`}>
                                            {apiKey.is_active ? 'Active' : 'Révoquée'}
                                        </span>
                                    )}
                                </div>

                                {newApiKey ? (
                                    <div className="space-y-4">
                                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                                            <div className="flex items-start gap-3">
                                                <CheckCircle className="size-5 text-green-500 shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="font-medium text-green-400 mb-1">Clé API créée avec succès</h4>
                                                    <p className="text-sm text-gray-300">
                                                        Copiez cette clé maintenant. Elle ne sera plus jamais affichée en clair.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="relative group">
                                            <input
                                                type="text"
                                                value={newApiKey}
                                                readOnly
                                                className="w-full bg-black/60 border border-green-500/30 rounded-lg px-4 py-4 pr-28 font-mono text-sm text-green-400 focus:outline-none"
                                            />
                                            <button
                                                onClick={() => copyToClipboard(newApiKey)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-brand-orange hover:bg-brand-orange/80 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg"
                                            >
                                                <Copy className="size-4" />
                                                Copier
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => setNewApiKey('')}
                                            className="text-sm text-gray-400 hover:text-white transition-colors font-medium"
                                        >
                                            ✓ J'ai sauvegardé ma clé
                                        </button>
                                    </div>
                                ) : apiKey ? (
                                    <div className="space-y-6">
                                        <div>
                                            <div className="relative">
                                                <input
                                                    type={showApiKey ? 'text' : 'password'}
                                                    value={apiKey.key_preview}
                                                    readOnly
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 pr-14 font-mono text-sm text-gray-300 focus:outline-none"
                                                />
                                                <button
                                                    onClick={() => setShowApiKey(!showApiKey)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-all"
                                                    title={showApiKey ? 'Masquer' : 'Afficher'}
                                                >
                                                    {showApiKey ? <EyeOff className="size-4 text-gray-400" /> : <Eye className="size-4 text-gray-400" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                                                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                                                    <Clock className="size-3" />
                                                    Créée le
                                                </p>
                                                <p className="font-medium">{new Date(apiKey.created_at).toLocaleDateString('fr-FR')}</p>
                                            </div>
                                            <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                                                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1.5">
                                                    <Activity className="size-3" />
                                                    Dernier usage
                                                </p>
                                                <p className="font-medium">
                                                    {apiKey.last_used_at
                                                        ? new Date(apiKey.last_used_at).toLocaleDateString('fr-FR')
                                                        : 'Jamais'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleRegenerateApiKey}
                                                disabled={loading}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-all disabled:opacity-50 font-medium"
                                            >
                                                <RotateCw className="size-4" />
                                                Régénérer
                                            </button>
                                            <button
                                                onClick={handleRevokeApiKey}
                                                disabled={loading}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-all disabled:opacity-50 font-medium"
                                            >
                                                <Trash2 className="size-4" />
                                                Révoquer
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <div className="inline-flex p-4 bg-white/5 rounded-full mb-4">
                                            <Lock className="size-8 text-gray-600" />
                                        </div>
                                        <h4 className="font-semibold mb-2">Aucune clé API</h4>
                                        <p className="text-gray-400 text-sm mb-6">Créez une clé API pour accéder à vos workflows</p>
                                        <button
                                            onClick={handleCreateApiKey}
                                            disabled={loading}
                                            className="px-6 py-3 bg-brand-orange hover:bg-brand-orange/80 text-white rounded-lg font-semibold transition-all disabled:opacity-50 shadow-lg"
                                        >
                                            {loading ? 'Création...' : 'Créer une clé API'}
                                        </button>
                                    </div>
                                )}
                            </motion.div>

                            {/* Quick Start Guide */}
                            <motion.div 
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-linear-to-br from-white/[0.07] to-white/2 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
                            >
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-purple-500/10 rounded-lg">
                                        <Terminal className="size-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold">Guide de démarrage</h3>
                                        <p className="text-sm text-gray-400">Exemples d'utilisation de l'API</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-sm font-medium text-gray-300">Endpoint de base</h4>
                                            <button 
                                                onClick={() => copyToClipboard(`${window.location.origin}/api/v1`)}
                                                className="text-xs text-brand-orange hover:text-brand-orange/80 transition-colors"
                                            >
                                                Copier
                                            </button>
                                        </div>
                                        <div className="bg-black/60 border border-white/10 rounded-lg p-3 font-mono text-sm text-green-400">
                                            {window.location.origin}/api/v1
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-medium text-gray-300 mb-2">En-tête d'authentification</h4>
                                        <div className="bg-black/60 border border-white/10 rounded-lg p-3 font-mono text-sm">
                                            <span className="text-blue-400">Authorization:</span> <span className="text-gray-300">Bearer</span> <span className="text-yellow-400">YOUR_API_KEY</span>
                                        </div>
                                    </div>

                                    <div className="border-t border-white/10 pt-4">
                                        <h4 className="text-sm font-medium text-gray-300 mb-3">Endpoints disponibles</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-white/5">
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-mono">GET</span>
                                                <code className="text-gray-300">/workflows</code>
                                                <span className="text-gray-500 ml-auto">Lister les workflows</span>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-white/5">
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-mono">GET</span>
                                                <code className="text-gray-300">/workflows/:id</code>
                                                <span className="text-gray-500 ml-auto">Détails workflow</span>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-white/5">
                                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-mono">POST</span>
                                                <code className="text-gray-300">/workflows/:id/execute</code>
                                                <span className="text-gray-500 ml-auto">Exécuter</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Statistics */}
                            {stats && apiKey && (
                                <motion.div 
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="bg-linear-to-br from-white/[0.07] to-white/2 border border-white/10 rounded-xl p-6 backdrop-blur-sm"
                                >
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-blue-500/10 rounded-lg">
                                            <Activity className="size-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">Statistiques</h3>
                                            <p className="text-xs text-gray-400">Utilisation de l'API</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-gray-400">Requêtes totales</span>
                                                <Zap className="size-4 text-yellow-400" />
                                            </div>
                                            <p className="text-3xl font-bold">{stats.total_requests.toLocaleString()}</p>
                                        </div>

                                        <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-gray-400">Taux de succès</span>
                                                <TrendingUp className="size-4 text-green-400" />
                                            </div>
                                            <p className="text-3xl font-bold text-green-400">
                                                {stats.total_requests > 0
                                                    ? Math.round((stats.success_count / stats.total_requests) * 100)
                                                    : 0}%
                                            </p>
                                        </div>

                                        <div className="bg-black/30 border border-white/10 rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm text-gray-400">Temps moyen</span>
                                                <Clock className="size-4 text-purple-400" />
                                            </div>
                                            <p className="text-3xl font-bold text-purple-400">
                                                {Math.round(stats.avg_response_time || 0)}<span className="text-lg text-gray-500">ms</span>
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-center">
                                                <p className="text-xs text-green-400 mb-1">Succès</p>
                                                <p className="text-xl font-bold text-green-400">{stats.success_count}</p>
                                            </div>
                                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                                                <p className="text-xs text-red-400 mb-1">Erreurs</p>
                                                <p className="text-xl font-bold text-red-400">{stats.error_count}</p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Security Tips */}
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-linear-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-6"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="size-5 text-orange-400" />
                                    <h4 className="font-semibold text-orange-400">Bonnes pratiques</h4>
                                </div>
                                <ul className="space-y-3 text-sm text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                                        <span>Ne partagez jamais votre clé API publiquement</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                                        <span>Régénérez immédiatement si elle est compromise</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                                        <span>Utilisez toujours HTTPS en production</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-orange-400 mt-0.5 shrink-0">•</span>
                                        <span>Stockez la clé dans des variables d'environnement</span>
                                    </li>
                                </ul>
                            </motion.div>

                            {/* Documentation Link */}
                            <motion.div 
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-linear-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6"
                            >
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <Code className="size-5 text-blue-400" />
                                    Documentation complète
                                </h4>
                                <p className="text-sm text-gray-300 mb-4">
                                    Consultez notre documentation pour plus d'exemples et de détails
                                </p>
                                <button 
                                    onClick={() => navigate('/dashboard/documentation')}
                                    className="w-full px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg font-medium transition-all border border-blue-500/30"
                                >
                                    Voir la documentation
                                </button>
                            </motion.div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
