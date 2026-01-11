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
    AlertTriangle,
    User,
    Server,
    ExternalLink
} from 'lucide-react';
import { resourcesApi, type Resource } from '../../api/resources';
import workflowsApi, { type N8NWorkflow } from '../../api/workflows';
import { useToast } from '../../contexts/ToastContext';
import { getAvatarUrl, getAvatarInitials } from '../../utils/avatar';
import ResourceDetailModal from '../../components/ResourceDetailModal';
import SelectInstanceModal from '../../components/SelectInstanceModal';
import { instancesApi } from '../../api/instances';

type LibraryTab = 'favorites' | 'my-resources' | 'n8n-workflows';

export default function Library() {
    const [resources, setResources] = useState<Resource[]>([]);
    const [n8nWorkflows, setN8nWorkflows] = useState<N8NWorkflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<LibraryTab>('favorites');
    const [search, setSearch] = useState('');
    const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [viewedResources, setViewedResources] = useState<Set<number>>(new Set());
    const [showInstanceModal, setShowInstanceModal] = useState(false);
    const [importingWorkflow, setImportingWorkflow] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        loadResources();
    }, [activeTab]);

    // Auto-refresh N8N workflows every 30 seconds
    useEffect(() => {
        if (activeTab !== 'n8n-workflows') return;

        const interval = setInterval(() => {
            loadN8NWorkflows();
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [activeTab]);

    const loadN8NWorkflows = async () => {
        try {
            const { workflows } = await workflowsApi.list();
            setN8nWorkflows(workflows);
        } catch (error) {
            console.error('Error loading N8N workflows:', error);
        }
    };

    const loadResources = async () => {
        try {
            setLoading(true);
            if (activeTab === 'favorites') {
                // Load favorited resources
                const { resources: data } = await resourcesApi.getResources({});
                setResources(data.filter((r: Resource) => r.is_liked));
            } else if (activeTab === 'my-resources') {
                // Load user's own resources
                const { resources: data } = await resourcesApi.getUserResources();
                setResources(data);
            } else if (activeTab === 'n8n-workflows') {
                // Load N8N workflows from user's instances
                await loadN8NWorkflows();
                setResources([]);
            }
        } catch (error) {
            console.error('Error loading resources:', error);
            showToast('danger', 'Erreur lors du chargement');
        } finally {
            setLoading(false);
        }
    };

    const handleViewResource = async (resource: Resource) => {
        setSelectedResource(resource);
        
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
            // If unfavoriting in favorites tab, remove from list
            if (activeTab === 'favorites' && !liked) {
                setResources(prev => prev.filter(r => r.id !== resourceId));
                if (selectedResource?.id === resourceId) {
                    setSelectedResource(null);
                }
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

    const filteredResources = resources.filter(r => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return r.title.toLowerCase().includes(searchLower) || 
               r.description.toLowerCase().includes(searchLower);
    });

    const filteredN8NWorkflows = n8nWorkflows.filter(w => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return w.name.toLowerCase().includes(searchLower) ||
               w.instanceName.toLowerCase().includes(searchLower);
    });

    const tabs = [
        { id: 'favorites' as LibraryTab, label: 'Favoris', icon: Heart },
        { id: 'my-resources' as LibraryTab, label: 'Mes ressources', icon: User },
        { id: 'n8n-workflows' as LibraryTab, label: 'Workflows N8N', icon: Server }
    ];

    return (
        <div className="min-h-screen mt-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        Ma Bibliothèque
                    </h1>
                    <p className="text-gray-400">Gérez vos ressources favorites et vos propres créations</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-white/10">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                                activeTab === tab.id
                                    ? 'text-brand-orange'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            <tab.icon className="size-4" />
                            {tab.label}
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-orange"
                                    transition={{ type: 'spring', damping: 20 }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="mb-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher dans ma bibliothèque..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-orange/50 transition-all"
                        />
                    </div>
                </div>

                {/* Resources Grid */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
                    </div>
                ) : activeTab === 'n8n-workflows' ? (
                    // N8N Workflows Display
                    filteredN8NWorkflows.length === 0 ? (
                        <div className="text-center py-20">
                            <Server className="size-12 text-gray-600 mx-auto mb-4" />
                            <h3 className="text-xl font-semibold mb-2">Aucun workflow N8N</h3>
                            <p className="text-gray-400">Créez vos premiers workflows sur vos instances N8N</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredN8NWorkflows.map((workflow) => (
                                <motion.div
                                    key={workflow.id}
                                    whileHover={{ y: -4 }}
                                    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all flex flex-col h-full"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                                            <Workflow className="size-5" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-1 rounded ${
                                                workflow.active
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-gray-500/20 text-gray-400'
                                            }`}>
                                                {workflow.active ? 'Actif' : 'Inactif'}
                                            </span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(workflow.workflowUrl, '_blank');
                                                }}
                                                className="p-1.5 rounded-lg bg-brand-orange/20 text-brand-orange hover:bg-brand-orange/30 transition-colors"
                                                title="Ouvrir dans N8N"
                                            >
                                                <ExternalLink className="size-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">{workflow.name}</h3>
                                    
                                    {/* Spacer */}
                                    <div className="flex-1"></div>

                                    <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
                                        <Server className="size-4" />
                                        <span className="truncate">{workflow.instanceName}</span>
                                    </div>

                                    <div className="text-xs text-gray-500">
                                        <div>Créé: {new Date(workflow.createdAt).toLocaleDateString('fr-FR')}</div>
                                        <div>Modifié: {new Date(workflow.updatedAt).toLocaleDateString('fr-FR')}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )
                ) : filteredResources.length === 0 ? (
                    <div className="text-center py-20">
                        <Sparkles className="size-12 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">
                            {activeTab === 'favorites' && 'Aucun favori'}
                            {activeTab === 'my-resources' && 'Aucune ressource'}
                        </h3>
                        <p className="text-gray-400">
                            {activeTab === 'favorites' && 'Ajoutez des ressources à vos favoris pour les retrouver ici'}
                            {activeTab === 'my-resources' && 'Créez votre première ressource avec l\'IA'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredResources.map((resource) => (
                            <motion.div
                                key={resource.id}
                                whileHover={{ y: -4 }}
                                onClick={() => handleViewResource(resource)}
                                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all cursor-pointer flex flex-col"
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

                                {/* Spacer pour pousser le contenu en bas */}
                                <div className="flex-1"></div>

                                <div className="flex items-center gap-2 mb-4 text-sm text-gray-400">
                                    {getAvatarUrl(resource.author_avatar, resource.author_discord_id) ? (
                                        <img src={getAvatarUrl(resource.author_avatar, resource.author_discord_id)!} alt={resource.author_name} className="size-6 rounded-full" />
                                    ) : (
                                        <div className="size-6 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-xs text-white">
                                            {resource.author_name ? getAvatarInitials(resource.author_name) : 'U'}
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
                    onDelete={activeTab === 'my-resources' ? handleDelete : undefined}
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
