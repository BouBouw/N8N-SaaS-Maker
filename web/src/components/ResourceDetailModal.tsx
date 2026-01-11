import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Heart, Download, Upload, Eye, Tag as TagIcon, Trash2 } from 'lucide-react';
import type { Resource } from '../api/resources';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl, getAvatarInitials } from '../utils/avatar';

interface ResourceDetailModalProps {
    resource: Resource | null;
    onClose: () => void;
    onLike: () => void;
    onDownload: () => void;
    onImport?: () => void;
    onDelete?: () => void;
    importing?: boolean;
}

export default function ResourceDetailModal({ 
    resource, 
    onClose, 
    onLike, 
    onDownload,
    onImport,
    onDelete,
    importing = false
}: ResourceDetailModalProps) {
    if (!resource) return null;

    const { user } = useAuth();
    const isOwner = user?.id === resource.user_id;
    const isPaid = resource.price === 'paid';
    const tags = typeof resource.tags === 'string' 
        ? JSON.parse(resource.tags) 
        : resource.tags;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-[#1A1A1A] border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 flex items-start justify-between">
                        <div className="flex-1 pr-4">
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                    resource.type === 'workflow'
                                        ? 'bg-blue-500/20 text-blue-400'
                                        : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                    {resource.type === 'workflow' ? 'Workflow' : 'Prompt'}
                                </span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    isPaid
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : 'bg-green-500/20 text-green-400'
                                }`}>
                                    {isPaid ? `${resource.price_amount}€` : 'Gratuit'}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold mb-2">{resource.title}</h2>
                            <p className="text-gray-400 text-sm">{resource.description}</p>
                            
                            {/* Tags */}
                            {tags && tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3">
                                    {tags.map((tag: string, idx: number) => (
                                        <span key={idx} className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded flex items-center gap-1">
                                            <TagIcon className="size-3" />
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 chat-scroll">
                        {isPaid ? (
                            <div className="text-center py-12">
                                <div className="inline-flex items-center justify-center size-16 bg-yellow-500/20 rounded-full mb-4">
                                    <span className="text-3xl">🔒</span>
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Ressource Payante</h3>
                                <p className="text-gray-400 mb-4">
                                    Cette ressource nécessite un paiement pour accéder au contenu complet
                                </p>
                                <div className="text-2xl font-bold text-yellow-400 mb-6">
                                    {resource.price_amount}€
                                </div>
                                <button className="px-6 py-3 bg-yellow-500/20 text-yellow-400 rounded-lg hover:bg-yellow-500/30 transition-colors">
                                    Acheter (à venir)
                                </button>
                            </div>
                        ) : (
                            <div className="prose prose-invert prose-sm max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {resource.content}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>

                    {/* Footer with Stats and Actions */}
                    <div className="p-6 border-t border-white/10">
                        {/* Author and Stats */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                {getAvatarUrl(resource.author_avatar, resource.author_discord_id) ? (
                                    <img 
                                        src={getAvatarUrl(resource.author_avatar, resource.author_discord_id)!} 
                                        alt={resource.author_name} 
                                        className="size-8 rounded-full"
                                    />
                                ) : (
                                    <div className="size-8 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-sm text-white">
                                        {resource.author_name ? getAvatarInitials(resource.author_name) : 'U'}
                                    </div>
                                )}
                                <div>
                                    <div className="text-sm font-medium">{resource.author_name || 'Utilisateur'}</div>
                                    <div className="text-xs text-gray-500">Auteur</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                                <span className="flex items-center gap-1">
                                    <Eye className="size-4" />
                                    {resource.views_count}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Download className="size-4" />
                                    {resource.downloads_count}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Heart className={`size-4 ${resource.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
                                    {resource.likes_count}
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            {isOwner && onDelete ? (
                                <>
                                    <button
                                        onClick={onDelete}
                                        className="flex-1 px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Trash2 className="size-4" />
                                        Supprimer
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        Fermer
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={onLike}
                                        className={`flex-1 px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                                            resource.is_liked 
                                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                        }`}
                                    >
                                        <Heart className={`size-4 ${resource.is_liked ? 'fill-current' : ''}`} />
                                        {resource.is_liked ? 'Favori' : 'Ajouter aux favoris'}
                                    </button>
                                    
                                    {!isPaid && (
                                        <>
                                            {resource.type === 'workflow' && onImport && (
                                                <button
                                                    onClick={onImport}
                                                    disabled={importing}
                                                    className="flex-1 px-4 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <Upload className="size-4" />
                                                    {importing ? 'Import en cours...' : 'Importer sur N8N'}
                                                </button>
                                            )}
                                            
                                            <button
                                                onClick={onDownload}
                                                disabled={importing}
                                                className="flex-1 px-4 py-3 bg-brand-orange hover:bg-brand-orange/90 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Download className="size-4" />
                                                Télécharger
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
