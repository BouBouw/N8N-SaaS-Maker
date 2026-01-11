import { motion, AnimatePresence } from 'motion/react';
import { X, Loader } from 'lucide-react';
import { useState } from 'react';
import { instancesApi } from '../api/instances';
import { useToast } from '../contexts/ToastContext';

interface CreateInstanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateInstanceModal({ isOpen, onClose, onSuccess }: CreateInstanceModalProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        setLoading(true);

        try {
            const result = await instancesApi.createInstance();
            
            if (result.error) {
                showToast('danger', result.error);
                setLoading(false);
            } else {
                showToast('success', 'Instance en cours de création...');
                setLoading(false);
                onSuccess();
            }
        } catch (err: any) {
            showToast('danger', err.message || 'Erreur lors de la création de l\'instance');
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-md bg-bg-card border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <h2 className="text-2xl font-bold">Nouvelle instance N8N</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        <p className="text-gray-400 text-sm">
                            Une nouvelle instance N8N va être créée avec un identifiant unique généré automatiquement.
                        </p>

                        {/* Instance specs */}
                        <div className="bg-linear-to-br from-orange-500/10 to-amber-500/10 border border-white/10 rounded-lg p-4">
                            <h3 className="text-sm font-semibold mb-3">Configuration (Plan Gratuit)</h3>
                            <div className="space-y-2 text-sm text-gray-400">
                                <div className="flex justify-between">
                                    <span>Stockage</span>
                                    <span className="text-white font-medium">5 GB</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>RAM</span>
                                    <span className="text-white font-medium">6 GB</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Bande passante</span>
                                    <span className="text-white font-medium">2 TB</span>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 rounded-lg bg-white/5 hover:bg-white/10 text-white font-semibold transition-colors"
                                disabled={loading}
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleCreate}
                                className="flex-1 px-4 py-3 rounded-lg bg-brand-orange hover:bg-orange-600 text-white font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader className="size-4 animate-spin" />
                                        Création...
                                    </>
                                ) : (
                                    'Créer l\'instance'
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}