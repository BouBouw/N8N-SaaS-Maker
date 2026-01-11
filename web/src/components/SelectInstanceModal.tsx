import { motion, AnimatePresence } from 'framer-motion';
import { X, Server, AlertTriangle, ExternalLink } from 'lucide-react';
import { useState, useEffect } from 'react';
import instancesApi from '../api/instances';

interface Instance {
    id: number;
    name: string;
    status: string;
    docker_port: number;
}

interface SelectInstanceModalProps {
    onClose: () => void;
    onSelect: (instanceId: number, instanceUrl: string) => void;
    importing?: boolean;
}

export default function SelectInstanceModal({ onClose, onSelect, importing = false }: SelectInstanceModalProps) {
    const [instances, setInstances] = useState<Instance[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        loadInstances();
    }, []);

    const loadInstances = async () => {
        try {
            const response = await instancesApi.getAll();
            // Filter only running instances
            const runningInstances = response.instances.filter((i: Instance) => i.status === 'running');
            setInstances(runningInstances);
            if (runningInstances.length === 1) {
                setSelectedId(runningInstances[0].id);
            }
        } catch (error) {
            console.error('Error loading instances:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        if (selectedId) {
            const instance = instances.find(i => i.id === selectedId);
            if (instance) {
                const url = `http://localhost:${instance.docker_port}`;
                onSelect(selectedId, url);
            }
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#1A1A1A] border border-white/10 rounded-2xl max-w-md w-full"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex items-start justify-between">
                        <div>
                            <h3 className="text-xl font-bold mb-1">Sélectionner une instance</h3>
                            <p className="text-sm text-gray-400">Choisissez l'instance N8N où importer le workflow</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {/* Warning */}
                        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex gap-3">
                            <AlertTriangle className="size-5 text-yellow-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold text-yellow-500 mb-1">Attention</p>
                                <p className="text-yellow-500/80">
                                    Si un workflow avec le même nom existe déjà, il sera écrasé par cette importation.
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <div className="text-center py-8 text-gray-400">
                                Chargement des instances...
                            </div>
                        ) : instances.length === 0 ? (
                            <div className="text-center py-8">
                                <Server className="size-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400 mb-2">Aucune instance active</p>
                                <p className="text-sm text-gray-500">Créez une instance N8N pour importer des workflows</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {instances.map((instance) => (
                                    <button
                                        key={instance.id}
                                        onClick={() => setSelectedId(instance.id)}
                                        className={`w-full p-4 rounded-lg border transition-all flex items-center justify-between ${
                                            selectedId === instance.id
                                                ? 'bg-brand-orange/20 border-brand-orange text-white'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Server className={`size-5 ${
                                                selectedId === instance.id ? 'text-brand-orange' : 'text-gray-400'
                                            }`} />
                                            <div className="text-left">
                                                <div className="font-medium">{instance.name}</div>
                                                <div className="text-xs text-gray-500">
                                                    localhost:{instance.docker_port}
                                                </div>
                                            </div>
                                        </div>
                                        {selectedId === instance.id && (
                                            <div className="size-5 rounded-full bg-brand-orange flex items-center justify-center">
                                                <div className="size-2 rounded-full bg-white" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/10 flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={importing}
                            className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!selectedId || instances.length === 0 || importing}
                            className="flex-1 px-4 py-3 bg-brand-orange hover:bg-brand-orange/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <ExternalLink className="size-4" />
                            {importing ? 'Import en cours...' : 'Importer'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
