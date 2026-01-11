import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Search, 
    Download, 
    Heart, 
    Eye, 
    Workflow, 
    Brain,
    Sparkles,
    Tag,
    AlertTriangle
} from 'lucide-react';
import { resourcesApi, type Resource } from '../../api/resources';
import instancesApi from '../../api/instances';
import workflowsApi from '../../api/workflows';
import { useToast } from '../../contexts/ToastContext';
import { getAvatarUrl } from '../../utils/avatar';
import ResourceDetailModal from '../../components/ResourceDetailModal';
import SelectInstanceModal from '../../components/SelectInstanceModal';

export default function Ressources() {
    const [resources, setResources] = useState<Resource[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        type: 'all' as 'all' | 'workflow' | 'prompt',
        price: 'all' as 'all' | 'free' | 'paid',
        search: ''
    });
    const [stats, setStats] = useState({
        total_resources: 0,
        total_workflows: 0,
        total_prompts: 0,
        total_downloads: 0
    });
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
    const [viewedResources, setViewedResources] = useState<Set<number>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showInstanceModal, setShowInstanceModal] = useState(false);
    const [importingWorkflow, setImportingWorkflow] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        loadResources();
        loadStats();
    }, [filters]);

    const loadResources = async () => {
        try {
            setLoading(true);
            const { resources: data } = await resourcesApi.getResources({
                type: filters.type === 'all' ? undefined : filters.type,
                price: filters.price === 'all' ? undefined : filters.price,
                search: filters.search || undefined
            });
            setResources(data);
        } catch (error) {
            console.error('Error loading resources:', error);
            showToast('danger', 'Erreur lors du chargement des ressources');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async () => {
        try {
            const { stats: data } = await resourcesApi.getStats();
            setStats(data);
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    };

    const handleViewResource = async (resource: Resource) => {
        setSelectedResource(resource);
        
        // Increment view count only once per user session
        if (!viewedResources.has(resource.id)) {
            try {
                await resourcesApi.getResource(resource.id);
                setViewedResources(prev => new Set(prev).add(resource.id));
                setResources(prev => prev.map(r => 
                    r.id === resource.id ? { ...r, views_count: r.views_count + 1 } : r
                ));
            } catch (error) {
                console.error('Error incrementing view:', error);
            }
        }
    };

    const handleDelete = async () => {
        if (!selectedResource) return;
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!selectedResource) return;
        
        try {
            await resourcesApi.deleteResource(selectedResource.id);
            setResources(prev => prev.filter(r => r.id !== selectedResource.id));
            setSelectedResource(null);
            setShowDeleteConfirm(false);
            showToast('success', 'Ressource supprimée avec succès');
            await loadStats(); // Refresh stats
        } catch (error) {
            console.error('Error deleting resource:', error);
            showToast('danger', 'Erreur lors de la suppression');
            setShowDeleteConfirm(false);
        }
    };

    const handleLike = async (resourceId: number) => {
        try {
            const { liked } = await resourcesApi.toggleLike(resourceId);
            setResources(prev => prev.map(r => 
                r.id === resourceId 
                    ? { ...r, is_liked: liked, likes_count: r.likes_count + (liked ? 1 : -1) }
                    : r
            ));
            if (selectedResource && selectedResource.id === resourceId) {
                setSelectedResource({ ...selectedResource, is_liked: liked, likes_count: selectedResource.likes_count + (liked ? 1 : -1) });
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            showToast('danger', 'Erreur');
        }
    };

    const handleDownload = async (resource: Resource) => {
        try {
            let dataToDownload = resource.content;
            
            if (resource.type === 'workflow') {
                const jsonMatch = resource.content.match(/```json\s*([\s\S]*?)```/);
                if (jsonMatch && jsonMatch[1]) {
                    try {
                        const jsonData = JSON.parse(jsonMatch[1].trim());
                        dataToDownload = JSON.stringify(jsonData, null, 2);
                    } catch (e) {
                        console.error('Failed to parse JSON:', e);
                    }
                }
            }

            const blob = new Blob([dataToDownload], { 
                type: resource.type === 'workflow' ? 'application/json' : 'text/plain' 
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${resource.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.${resource.type === 'workflow' ? 'json' : 'txt'}`;
            link.click();
            URL.revokeObjectURL(url);

            await resourcesApi.incrementDownload(resource.id);
            setResources(prev => prev.map(r => 
                r.id === resource.id ? { ...r, downloads_count: r.downloads_count + 1 } : r
            ));
            if (selectedResource && selectedResource.id === resource.id) {
                setSelectedResource({ ...selectedResource, downloads_count: selectedResource.downloads_count + 1 });
            }
            
            showToast('success', 'Téléchargement démarré');
        } catch (error) {
            console.error('Error downloading:', error);
            showToast('danger', 'Erreur lors du téléchargement');
        }
    };

    const handleImport = async () => {
        if (!selectedResource || selectedResource.type !== 'workflow') return;
        
        try {
            // Check if user has instances
            const { instances } = await instancesApi.getAll();
            const runningInstances = instances.filter((i: any) => i.status === 'running');
            
            if (runningInstances.length === 0) {
                showToast('warning', 'Aucune instance N8N active. Créez une instance d\'abord.');
                return;
            }
            
            // If only one instance, import directly, otherwise show modal
            if (runningInstances.length === 1) {
                const instance = runningInstances[0];
                await importToInstance(instance.id, `http://localhost:${instance.docker_port}`);
            } else {
                setShowInstanceModal(true);
            }
        } catch (error) {
            console.error('Error checking instances:', error);
            showToast('danger', 'Erreur lors de la vérification des instances');
        }
    };

    const importToInstance = async (instanceId: number, instanceUrl: string) => {
        if (!selectedResource) return;
        
        try {
            setImportingWorkflow(true);
            const result = await workflowsApi.import({
                instanceId,
                workflowContent: selectedResource.content
            });

            if (result.requiresAuth) {
                showToast('warning', 'Connectez-vous à votre instance N8N puis réessayez');
                window.open(instanceUrl, '_blank');
            } else if (result.success) {
                showToast('success', 'Workflow importé avec succès !');
                setShowInstanceModal(false);
                
                // Open workflow in N8N
                if (result.workflowUrl) {
                    window.open(result.workflowUrl, '_blank');
                }
                
                // Increment download count
                await resourcesApi.incrementDownload(selectedResource.id);
                setResources(prev => prev.map(r => 
                    r.id === selectedResource.id ? { ...r, downloads_count: r.downloads_count + 1 } : r
                ));
                if (selectedResource) {
                    setSelectedResource({ ...selectedResource, downloads_count: selectedResource.downloads_count + 1 });
                }
            }
        } catch (error: any) {
            console.error('Error importing workflow:', error);
            if (error.response?.data?.requiresAuth) {
                showToast('warning', 'Authentification requise. Connectez-vous à votre instance N8N.');
                window.open(instanceUrl, '_blank');
            } else {
                showToast('danger', error.response?.data?.error || 'Erreur lors de l\'import');
            }
        } finally {
            setImportingWorkflow(false);
        }
    };

    return (
        <div className="min-h-screen mt-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Ressources LogicAI</h1>
                    <p className="text-gray-400">Découvrez et téléchargez des workflows N8N et prompts créés par la communauté</p>
                </div>

                {/* Stats */}
                <div className="mb-6">
                    <span className=''>
                        <span className="font-semibold text-orange-500">{stats.total_resources}</span> ressources (<span className='text-blue-500'>{stats.total_workflows}</span> workflows, <span className='text-purple-500'>{stats.total_prompts}</span> prompts)
                    </span>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    {/* Search Bar */}
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 transition-all"
                        />
                    </div>

                    {/* Dropdowns Container */}
                    <div className="flex gap-3">
                        {/* Type Dropdown */}
                        <select
                            value={filters.type}
                            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 transition-all cursor-pointer hover:bg-white/10"
                        >
                            <option value="all" className="bg-[#1A1A1A]">Tous les types</option>
                            <option value="workflow" className="bg-[#1A1A1A]">Workflows</option>
                            <option value="prompt" className="bg-[#1A1A1A]">Prompts</option>
                        </select>

                        {/* Price Dropdown */}
                        <select
                            value={filters.price}
                            onChange={(e) => setFilters(prev => ({ ...prev, price: e.target.value as any }))}
                            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-brand-orange/50 transition-all cursor-pointer hover:bg-white/10"
                        >
                            <option value="all" className="bg-[#1A1A1A]">Tous les prix</option>
                            <option value="free" className="bg-[#1A1A1A]">Gratuit</option>
                            <option value="paid" className="bg-[#1A1A1A]">Payant</option>
                        </select>
                    </div>
                </div>

                {/* Resources Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
                    </div>
                ) : resources.length === 0 ? (
                    <div className="text-center py-20">
                        <Sparkles className="size-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Aucune ressource trouvée</h3>
                        <p className="text-gray-400">Essayez de modifier vos filtres</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {resources.map((resource) => (
                            <motion.div
                                key={resource.id}
                                whileHover={{ y: -4 }}
                                onClick={() => handleViewResource(resource)}
                                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all cursor-pointer"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`p-2 rounded-lg ${
                                        resource.type === 'workflow'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : 'bg-purple-500/20 text-purple-400'
                                    }`}>
                                        {resource.type === 'workflow' ? <Workflow className="size-5" /> : <Brain className="size-5" />}
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded ${
                                        resource.price === 'free'
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                        {resource.price === 'free' ? 'Gratuit' : `${resource.price_amount}€`}
                                    </span>
                                </div>

                                <h3 className="font-semibold text-lg mb-2 line-clamp-2">{resource.title}</h3>
                                <p className="text-sm text-gray-400 mb-4 line-clamp-3">{resource.description}</p>

                                {(() => {
                                    const tags = typeof resource.tags === 'string' 
                                        ? JSON.parse(resource.tags) 
                                        : resource.tags;
                                    return tags && tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mb-4">
                                            {tags.slice(0, 3).map((tag: string, idx: number) => (
                                                <span key={idx} className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded flex items-center gap-1">
                                                    <Tag className="size-3" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    );
                                })()}

                                <div className="flex items-center gap-2 mb-4 text-sm text-gray-400">
                                    {getAvatarUrl(resource.author_avatar, resource.author_discord_id) ? (
                                        <img src={getAvatarUrl(resource.author_avatar, resource.author_discord_id)!} alt={resource.author_name} className="size-6 rounded-full" />
                                    ) : (
                                        <div className="size-6 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xs text-white">
                                            {resource.author_name?.charAt(0).toUpperCase() || 'U'}
                                        </div>
                                    )}
                                    <span>{resource.author_name || 'Utilisateur'}</span>
                                </div>

                                <div className="flex items-center justify-between text-sm text-gray-400 mb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1"><Eye className="size-4" />{resource.views_count}</span>
                                        <span className="flex items-center gap-1"><Download className="size-4" />{resource.downloads_count}</span>
                                        <span className="flex items-center gap-1">
                                            <Heart className={`size-4 ${resource.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
                                            {resource.likes_count}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewResource(resource);
                                        }}
                                        className="flex-1 px-3 py-2 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        Voir plus
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleLike(resource.id);
                                        }}
                                        className={`px-3 py-2 rounded-lg transition-colors ${
                                            resource.is_liked ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        <Heart className={`size-4 ${resource.is_liked ? 'fill-current' : ''}`} />
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* Resource Detail Modal */}
            {selectedResource && (
                <ResourceDetailModal
                    resource={selectedResource}
                    onClose={() => setSelectedResource(null)}
                    onLike={() => handleLike(selectedResource.id)}
                    onDownload={() => handleDownload(selectedResource)}
                    onImport={handleImport}
                    onDelete={handleDelete}
                    importing={importingWorkflow}
                />
            )}

            {/* Select Instance Modal */}
            {showInstanceModal && (
                <SelectInstanceModal
                    onClose={() => setShowInstanceModal(false)}
                    onSelect={importToInstance}
                    importing={importingWorkflow}
                />
            )}

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {showDeleteConfirm && selectedResource && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-[#1A1A1A] border border-white/10 rounded-2xl max-w-md w-full p-6"
                        >
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-red-500/20 rounded-full">
                                    <AlertTriangle className="size-6 text-red-400" />
                                </div>
                                <h3 className="text-xl font-semibold">Confirmer la suppression</h3>
                            </div>
                            
                            <p className="text-gray-400 mb-6">
                                Êtes-vous sûr de vouloir supprimer <span className="text-white font-semibold">"{selectedResource.title}"</span> ? Cette action est irréversible.
                            </p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors font-semibold"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
