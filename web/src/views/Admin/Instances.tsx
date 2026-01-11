import { useEffect, useState } from 'react';
import { Search, ExternalLink, Key, Trash2, Calendar, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi } from '../../api/admin';

export default function AdminInstances() {
    const { showToast } = useToast();
    const { user: currentUser } = useAuth();
    const [instances, setInstances] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAccessModal, setShowAccessModal] = useState(false);
    const [manualUuid, setManualUuid] = useState('');

    useEffect(() => {
        loadInstances();
    }, []);

    const loadInstances = async () => {
        try {
            const data = await adminApi.getInstances();
            setInstances(data.instances || []);
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors du chargement des instances');
        } finally {
            setLoading(false);
        }
    };

    const handleGrantAccess = async (instanceId: number, instanceName: string) => {
        if (!confirm(`Voulez-vous vous accorder l'accès à l'instance "${instanceName}" ?`)) {
            return;
        }

        try {
            await adminApi.grantInstanceAccess(instanceId);
            showToast('success', `Accès accordé à l'instance ${instanceName}`);
            loadInstances();
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de l\'attribution de l\'accès');
        }
    };

    const handleDeleteInstance = async (instanceId: number, instanceName: string) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'instance "${instanceName}" ? Cette action est irréversible.`)) {
            return;
        }

        try {
            await adminApi.deleteInstance(instanceId);
            showToast('success', 'Instance supprimée avec succès');
            loadInstances();
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de la suppression');
        }
    };

    const handleAccessByUuid = () => {
        if (!manualUuid.trim()) {
            showToast('warning', 'Veuillez entrer un UUID');
            return;
        }

        window.open(`http://localhost:5000/proxy/${manualUuid.trim()}`, '_blank');
        setShowAccessModal(false);
        setManualUuid('');
    };

    const filteredInstances = instances.filter(instance => 
        instance.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        instance.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        instance.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        instance.uuid.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'running':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'creating':
                return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'error':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Gestion des instances</h1>
                    <p className="text-gray-400">{instances.length} instance(s) au total</p>
                </div>
                {currentUser?.role === 'admin' && (
                    <button
                        onClick={() => setShowAccessModal(true)}
                        className="flex items-center gap-2 bg-brand-blue hover:bg-brand-hover px-4 py-2 rounded-lg transition-colors"
                    >
                        <Key className="size-4" />
                        Accès par UUID
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher par nom, UUID, utilisateur..."
                    className="w-full bg-bg-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-blue transition-colors"
                />
            </div>

            {/* Instances Table */}
            <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Instance
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Propriétaire
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Statut
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Workflows
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Création
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredInstances.map((instance) => (
                                <motion.tr
                                    key={instance.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="hover:bg-white/5 transition-colors"
                                >
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-sm font-medium">{instance.name}</p>
                                            <p className="text-xs text-gray-500 font-mono">{instance.uuid}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <User className="size-4 text-gray-500" />
                                            <div>
                                                <p className="text-sm">{instance.user_name}</p>
                                                <p className="text-xs text-gray-500">{instance.user_email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(instance.status)}`}>
                                            <span className={`size-2 rounded-full ${
                                                instance.status === 'running' ? 'bg-green-500 animate-pulse' :
                                                instance.status === 'creating' ? 'bg-yellow-500 animate-pulse' :
                                                instance.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                                            }`}></span>
                                            {instance.status === 'running' ? 'Active' :
                                             instance.status === 'creating' ? 'Création' :
                                             instance.status === 'error' ? 'Erreur' : 'Arrêtée'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm">{instance.workflows_count}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <Calendar className="size-3" />
                                            {new Date(instance.created_at).toLocaleDateString('fr-FR')}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {instance.status === 'running' && (
                                                <a
                                                    href={`http://localhost:5000/proxy/${instance.uuid}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 transition-colors"
                                                    title="Ouvrir l'instance"
                                                >
                                                    <ExternalLink className="size-4" />
                                                </a>
                                            )}
                                            {currentUser?.role === 'admin' && (
                                                <>
                                                    <button
                                                        onClick={() => handleGrantAccess(instance.id, instance.name)}
                                                        className="text-green-400 hover:text-green-300 transition-colors"
                                                        title="S'accorder l'accès"
                                                    >
                                                        <Key className="size-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteInstance(instance.id, instance.name)}
                                                        className="text-red-400 hover:text-red-300 transition-colors"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Manual UUID Access Modal */}
            {showAccessModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-bg-card border border-white/10 rounded-xl p-6 max-w-md w-full mx-4"
                    >
                        <h3 className="text-xl font-bold mb-4">Accès par UUID</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Entrez l'UUID complet de l'instance pour y accéder directement
                        </p>
                        
                        <input
                            type="text"
                            value={manualUuid}
                            onChange={(e) => setManualUuid(e.target.value)}
                            placeholder="ex: 550e8400-e29b-41d4-a716-446655440000"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-brand-blue transition-colors mb-6"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowAccessModal(false);
                                    setManualUuid('');
                                }}
                                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleAccessByUuid}
                                className="flex-1 px-4 py-2 bg-brand-blue hover:bg-brand-hover rounded-lg transition-colors font-semibold"
                            >
                                Accéder
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
