import { useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { adminApi } from '../../api/admin';
import { Workflow, Search, ExternalLink, Calendar, User, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminWorkflows() {
    const { showToast } = useToast();
    const [workflows, setWorkflows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    useEffect(() => {
        loadWorkflows();
    }, []);

    const loadWorkflows = async () => {
        try {
            const data = await adminApi.getWorkflows();
            setWorkflows(data.workflows || []);
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors du chargement des workflows');
        } finally {
            setLoading(false);
        }
    };

    const filteredWorkflows = workflows.filter(workflow => {
        const matchesSearch = 
            workflow.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            workflow.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            workflow.instance_name?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesStatus = 
            statusFilter === 'all' || 
            workflow.metadata?.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'success':
                return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'error':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'running':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const successCount = workflows.filter(w => w.metadata?.status === 'success').length;
    const errorCount = workflows.filter(w => w.metadata?.status === 'error').length;

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
                    <h1 className="text-3xl font-bold mb-2">Gestion des workflows</h1>
                    <p className="text-gray-400">
                        {workflows.length} exécution(s) au total · 
                        <span className="text-green-400 ml-1">{successCount} réussie(s)</span> · 
                        <span className="text-red-400 ml-1">{errorCount} échouée(s)</span>
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher par workflow, utilisateur, instance..."
                        className="w-full bg-bg-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-blue transition-colors"
                    />
                </div>

                {/* Status Filter */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            statusFilter === 'all'
                                ? 'bg-brand-blue text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        Tous
                    </button>
                    <button
                        onClick={() => setStatusFilter('success')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            statusFilter === 'success'
                                ? 'bg-green-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        Succès
                    </button>
                    <button
                        onClick={() => setStatusFilter('error')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            statusFilter === 'error'
                                ? 'bg-red-500 text-white'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                    >
                        Erreurs
                    </button>
                </div>
            </div>

            {/* Workflows Table */}
            <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Workflow
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Instance
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Utilisateur
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Statut
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Exécution
                                </th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredWorkflows.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <Activity className="size-12 mx-auto mb-4 opacity-50" />
                                        <p>Aucun workflow trouvé</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredWorkflows.map((workflow) => (
                                    <motion.tr
                                        key={workflow.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-purple-500/20">
                                                    <Workflow className="size-4 text-purple-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{workflow.title}</p>
                                                    {workflow.metadata?.workflow_id && (
                                                        <p className="text-xs text-gray-500 font-mono">
                                                            ID: {workflow.metadata.workflow_id}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {workflow.instance_name ? (
                                                <div>
                                                    <p className="text-sm">{workflow.instance_name}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{workflow.instance_uuid}</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <User className="size-4 text-gray-500" />
                                                <div>
                                                    <p className="text-sm">{workflow.user_name}</p>
                                                    <p className="text-xs text-gray-500">{workflow.user_email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {workflow.metadata?.status ? (
                                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(workflow.metadata.status)}`}>
                                                    {workflow.metadata.status === 'success' && '✓'}
                                                    {workflow.metadata.status === 'error' && '✗'}
                                                    {workflow.metadata.status === 'success' ? 'Succès' : 
                                                     workflow.metadata.status === 'error' ? 'Erreur' : 
                                                     workflow.metadata.status}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-1 text-xs text-gray-500">
                                                <Calendar className="size-3" />
                                                {new Date(workflow.created_at).toLocaleDateString('fr-FR', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </div>
                                            {workflow.metadata?.execution_id && (
                                                <p className="text-xs text-gray-600 font-mono mt-1">
                                                    #{workflow.metadata.execution_id.slice(0, 8)}
                                                </p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {workflow.instance_uuid && workflow.metadata?.execution_id && (
                                                <a
                                                    href={`http://localhost:5000/proxy/${workflow.instance_uuid}/execution/${workflow.metadata.execution_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1"
                                                    title="Voir l'exécution"
                                                >
                                                    <ExternalLink className="size-4" />
                                                </a>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
