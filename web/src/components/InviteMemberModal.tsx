import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, UserPlus, Mail, Loader2 } from 'lucide-react';
import { membersApi, type User } from '../api/members';
import { useToast } from '../contexts/ToastContext';

interface InviteMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    instanceId: number;
    instanceName: string;
    onInvited: () => void;
}

export default function InviteMemberModal({
    isOpen,
    onClose,
    instanceId,
    instanceName,
    onInvited
}: InviteMemberModalProps) {
    const { showToast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [searching, setSearching] = useState(false);
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        if (searchQuery.length >= 2) {
            searchUsers();
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const searchUsers = async () => {
        setSearching(true);
        try {
            const { users } = await membersApi.searchUsers(searchQuery);
            setSearchResults(users);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleInvite = async (inviteEmail: string) => {
        if (!inviteEmail.trim()) {
            showToast('warning', 'Veuillez entrer une adresse email');
            return;
        }

        setInviting(true);
        try {
            await membersApi.inviteMember(instanceId, inviteEmail, role);
            showToast('success', `Invitation envoyée à ${inviteEmail}`);
            onInvited();
            onClose();
            setEmail('');
            setSearchQuery('');
            setSearchResults([]);
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de l\'invitation');
        } finally {
            setInviting(false);
        }
    };

    const selectUser = (user: User) => {
        setEmail(user.email);
        setSearchQuery(user.name);
        setSearchResults([]);
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
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative bg-bg-card border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-brand-orange/20">
                                <UserPlus className="size-5 text-brand-orange" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Inviter un membre</h2>
                                <p className="text-sm text-gray-400">{instanceName}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="size-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Search by name */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Rechercher un utilisateur
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Nom ou email..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                                />
                                {searching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-gray-400 animate-spin" />
                                )}
                            </div>

                            {/* Search Results */}
                            {searchResults.length > 0 && (
                                <div className="mt-2 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                                    {searchResults.map((user) => (
                                        <button
                                            key={user.id}
                                            onClick={() => selectUser(user)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors text-left"
                                        >
                                            <div className="size-10 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-semibold">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{user.name}</div>
                                                <div className="text-sm text-gray-400 truncate">{user.email}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex-1 border-t border-white/10" />
                            <span className="text-sm text-gray-400">OU</span>
                            <div className="flex-1 border-t border-white/10" />
                        </div>

                        {/* Direct email input */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Adresse email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="membre@example.com"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                                />
                            </div>
                            <p className="mt-2 text-xs text-gray-500">
                                Si l'utilisateur n'a pas de compte, il recevra un email pour en créer un.
                            </p>
                        </div>

                        {/* Role selection */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Rôle
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { value: 'viewer', label: 'Lecteur', desc: 'Lecture seule', color: 'green' },
                                    { value: 'editor', label: 'Éditeur', desc: 'Créer & modifier', color: 'orange' },
                                    { value: 'admin', label: 'Admin', desc: 'Accès complet', color: 'red' }
                                ].map((r) => (
                                    <button
                                        key={r.value}
                                        onClick={() => setRole(r.value as any)}
                                        className={`p-3 rounded-lg border-2 transition-all ${
                                            role === r.value
                                                ? `border-${r.color}-500 bg-${r.color}-500/10`
                                                : 'border-white/10 bg-white/5 hover:bg-white/10'
                                        }`}
                                    >
                                        <div className={`size-2 rounded-full bg-${r.color}-500 mb-2`} />
                                        <div className="font-medium text-sm">{r.label}</div>
                                        <div className="text-xs text-gray-400 mt-1">{r.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={() => handleInvite(email)}
                            disabled={!email.trim() || inviting}
                            className="flex items-center gap-2 px-6 py-2 bg-brand-orange hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold"
                        >
                            {inviting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Envoi en cours...
                                </>
                            ) : (
                                <>
                                    <UserPlus className="size-4" />
                                    Envoyer l'invitation
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}