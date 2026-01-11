import { useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { adminApi } from '../../api/admin';
import { Search, Shield, Trash2, Mail, Calendar, MoreVertical, Edit, User, Lock, AtSign } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminUsers() {
    const { showToast } = useToast();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [newRole, setNewRole] = useState('');
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        email: '',
        password: '',
        role: ''
    });
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const data = await adminApi.getUsers();
            setUsers(data.users || []);
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors du chargement des utilisateurs');
        } finally {
            setLoading(false);
        }
    };

    const handleChangeRole = async () => {
        if (!selectedUser || !newRole) return;

        try {
            await adminApi.updateUserRole(selectedUser.id, newRole);
            showToast('success', 'Rôle mis à jour avec succès');
            setShowRoleModal(false);
            setSelectedUser(null);
            loadUsers();
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de la mise à jour du rôle');
        }
    };

    const handleEditUser = async () => {
        if (!selectedUser) return;

        try {
            await adminApi.updateUser(selectedUser.id, editForm);
            showToast('success', 'Utilisateur mis à jour avec succès');
            setShowEditModal(false);
            setSelectedUser(null);
            setEditForm({ name: '', email: '', password: '', role: '' });
            loadUsers();
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de la mise à jour');
        }
    };

    const openEditModal = (user: any) => {
        setSelectedUser(user);
        setEditForm({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role
        });
        setShowEditModal(true);
        setOpenMenuId(null);
    };

    const handleDeleteUser = async (userId: number, userName: string) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur "${userName}" ? Cette action est irréversible.`)) {
            return;
        }

        try {
            await adminApi.deleteUser(userId);
            showToast('success', 'Utilisateur supprimé avec succès');
            loadUsers();
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors de la suppression');
        }
    };

    const filteredUsers = users.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'support':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getPlanBadge = (plan: string) => {
        switch (plan) {
            case 'business':
                return 'bg-purple-500/20 text-purple-400';
            case 'pro':
                return 'bg-orange-500/20 text-orange-400';
            default:
                return 'bg-gray-500/20 text-gray-400';
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
                    <h1 className="text-3xl font-bold mb-2">Gestion des utilisateurs</h1>
                    <p className="text-gray-400">{users.length} utilisateur(s) au total</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher un utilisateur..."
                    className="w-full bg-bg-card border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-blue transition-colors"
                />
            </div>

            {/* Users Table */}
            <div className="bg-bg-card border border-white/10 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-white/5">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Utilisateur
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Rôle
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Plan
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Instances
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                    Inscription
                                </th>
                                {currentUser?.role === 'admin' && (
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((user) => (
                                <motion.tr
                                    key={user.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="hover:bg-white/5 transition-colors"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-sm font-semibold">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{user.name}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Mail className="size-3" />
                                                    {user.email}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => {
                                                if (currentUser?.role === 'admin') {
                                                    setSelectedUser(user);
                                                    setNewRole(user.role);
                                                    setShowRoleModal(true);
                                                }
                                            }}
                                            disabled={currentUser?.role !== 'admin'}
                                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getRoleBadge(user.role)} ${
                                                currentUser?.role === 'admin' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
                                            }`}
                                        >
                                            <Shield className="size-3" />
                                            {user.role === 'admin' ? 'Admin' : user.role === 'support' ? 'Support' : 'User'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanBadge(user.subscription_plan)}`}>
                                            {user.subscription_plan === 'business' ? 'Business' :
                                             user.subscription_plan === 'pro' ? 'Pro' : 'Gratuit'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm">{user.instances_count}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                            <Calendar className="size-3" />
                                            {new Date(user.created_at).toLocaleDateString('fr-FR')}
                                        </div>
                                    </td>
                                    {currentUser?.role === 'admin' && (
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {user.id !== currentUser.id && (
                                                <div className="relative inline-block">
                                                    <button
                                                        onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                                                        className="text-gray-400 hover:text-white transition-colors p-1"
                                                    >
                                                        <MoreVertical className="size-5" />
                                                    </button>
                                                    {openMenuId === user.id && (
                                                        <>
                                                            <div 
                                                                className="fixed inset-0 z-10" 
                                                                onClick={() => setOpenMenuId(null)}
                                                            />
                                                            <div className="absolute right-0 mt-2 w-48 bg-bg-card border border-white/10 rounded-lg shadow-2xl py-2 z-20">
                                                                <button
                                                                    onClick={() => openEditModal(user)}
                                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
                                                                >
                                                                    <Edit className="size-4" />
                                                                    Modifier
                                                                </button>
                                                                <div className="border-t border-white/10 my-1"></div>
                                                                <button
                                                                    onClick={() => {
                                                                        setOpenMenuId(null);
                                                                        handleDeleteUser(user.id, user.name);
                                                                    }}
                                                                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                    Supprimer
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    )}
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Role Modal */}
            {showRoleModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-bg-card border border-white/10 rounded-xl p-6 max-w-md w-full mx-4"
                    >
                        <h3 className="text-xl font-bold mb-4">Modifier le rôle</h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Utilisateur : <span className="text-white font-medium">{selectedUser.name}</span>
                        </p>
                        
                        <div className="space-y-2 mb-6">
                            {['user', 'support', 'admin'].map((role) => (
                                <button
                                    key={role}
                                    onClick={() => setNewRole(role)}
                                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                                        newRole === role
                                            ? 'bg-orange-500/10 border-orange-500/30 text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                    }`}
                                >
                                    <span className="font-medium">
                                        {role === 'admin' ? 'Administrateur' : role === 'support' ? 'Support' : 'Utilisateur'}
                                    </span>
                                    {newRole === role && <Shield className="size-4 text-orange-500" />}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowRoleModal(false);
                                    setSelectedUser(null);
                                }}
                                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleChangeRole}
                                className="flex-1 px-4 py-2 bg-brand-blue hover:bg-brand-hover rounded-lg transition-colors font-semibold"
                            >
                                Confirmer
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-bg-card border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
                    >
                        <h3 className="text-xl font-bold mb-4">Modifier l'utilisateur</h3>
                        <p className="text-sm text-gray-400 mb-6">
                            ID : <span className="text-white font-medium">#{selectedUser.id}</span>
                        </p>
                        
                        <div className="space-y-4 mb-6">
                            {/* Name */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                                    <User className="size-4" />
                                    Nom d'utilisateur
                                </label>
                                <input
                                    type="text"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                                    placeholder="Nom d'utilisateur"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                                    <AtSign className="size-4" />
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={editForm.email}
                                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                                    placeholder="email@example.com"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                                    <Lock className="size-4" />
                                    Nouveau mot de passe
                                </label>
                                <input
                                    type="password"
                                    value={editForm.password}
                                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand-blue transition-colors"
                                    placeholder="Laisser vide pour ne pas changer"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                                    <Shield className="size-4" />
                                    Rôle
                                </label>
                                <div className="space-y-2">
                                    {['user', 'support', 'admin'].map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => setEditForm({ ...editForm, role })}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                                                editForm.role === role
                                                    ? 'bg-orange-500/10 border-orange-500/30 text-white'
                                                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                        >
                                            <span className="font-medium">
                                                {role === 'admin' ? 'Administrateur' : role === 'support' ? 'Support' : 'Utilisateur'}
                                            </span>
                                            {editForm.role === role && <Shield className="size-4 text-orange-500" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedUser(null);
                                    setEditForm({ name: '', email: '', password: '', role: '' });
                                }}
                                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleEditUser}
                                className="flex-1 px-4 py-2 bg-brand-blue hover:bg-brand-hover rounded-lg transition-colors font-semibold"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
