import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    User,
    Mail,
    Lock,
    Camera,
    Save,
    Bell,
    Globe,
    Shield,
    CreditCard,
    Trash2,
    AlertTriangle,
    Eye,
    EyeOff,
    Plug,
    Link2,
    CheckCircle2,
    XCircle,
    ExternalLink,
    Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Link } from 'react-router';
import { getAvatarInitials } from '../../utils/avatar';
import { stripe, type Subscription, type Payment } from '../../api/stripe';
import { instancesApi } from '../../api/instances';
import { api } from '../../api/auth';

export default function Settings() {
    const { user, logout } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeTab, setActiveTab] = useState('profile');
    const [loading, setLoading] = useState(false);
    const [discordConnection, setDiscordConnection] = useState<any>(null);
    const [loadingDiscord, setLoadingDiscord] = useState(false);
    const [isDiscordAccount, setIsDiscordAccount] = useState(false);
    
    // Subscription data
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loadingSubscription, setLoadingSubscription] = useState(false);
    
    // Confirmation modal
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        isDanger?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
        isDanger: false
    });
    
    // Profile form
    const [profileForm, setProfileForm] = useState({
        name: user?.name || '',
        email: user?.email || '',
        avatar: user?.avatar || '',
        customAvatar: null as File | null
    });
    const [syncingAvatar, setSyncingAvatar] = useState(false);

    // Password form
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    // Preferences
    const [preferences, setPreferences] = useState({
        emailNotifications: true,
        workflowNotifications: true,
        securityAlerts: true,
        darkMode: true,
        language: 'fr'
    });

    const tabs = [
        { id: 'profile', label: 'Profil', icon: <User className="size-5" /> },
        { id: 'security', label: 'Sécurité', icon: <Lock className="size-5" /> },
        { id: 'preferences', label: 'Préférences', icon: <Bell className="size-5" /> },
        { id: 'integrations', label: 'Intégrations', icon: <Plug className="size-5" /> },
        { id: 'subscription', label: 'Abonnement', icon: <CreditCard className="size-5" /> },
        { id: 'danger', label: 'Zone de danger', icon: <AlertTriangle className="size-5" /> },
    ];

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                showToast('danger', 'L\'image ne doit pas dépasser 2MB');
                return;
            }
            
            const reader = new FileReader();
            reader.onloadend = () => {
                console.log('Avatar loaded:', reader.result);
                setProfileForm(prev => ({ 
                    ...prev, 
                    avatar: reader.result as string,
                    customAvatar: file
                }));
                showToast('success', 'Image chargée avec succès');
            };
            reader.onerror = () => {
                console.error('Error reading file');
                showToast('danger', 'Erreur lors de la lecture du fichier');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSyncDiscordAvatar = async () => {
        if (!user?.discord_id) {
            showToast('warning', 'Connectez d\'abord votre compte Discord');
            return;
        }

        setSyncingAvatar(true);
        try {
            const data = await api.syncDiscordAvatar();
            
            if (data.success) {
                showToast('success', 'Avatar Discord synchronisé');
                window.location.reload();
            } else {
                showToast('danger', data.error || 'Erreur lors de la synchronisation');
            }
        } catch (error) {
            console.error('Error syncing Discord avatar:', error);
            showToast('danger', 'Erreur lors de la synchronisation');
        } finally {
            setSyncingAvatar(false);
        }
    };

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const formData = new FormData();
            formData.append('name', profileForm.name);
            formData.append('email', profileForm.email);
            
            if (profileForm.customAvatar) {
                formData.append('avatar', profileForm.customAvatar);
            }
            
            const data = await api.updateProfile(formData);
            
            if (data.success) {
                showToast('success', 'Profil mis à jour avec succès');
                // Reload user data
                window.location.reload();
            } else {
                showToast('danger', data.error || 'Erreur lors de la mise à jour');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('danger', 'Erreur lors de la mise à jour du profil');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showToast('danger', 'Les mots de passe ne correspondent pas');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            showToast('danger', 'Le mot de passe doit contenir au moins 8 caractères');
            return;
        }

        setLoading(true);
        
        try {
            const data = await api.updatePassword(
                passwordForm.currentPassword,
                passwordForm.newPassword
            );
            
            if (data.success) {
                // Check if email verification is required (Discord account without password)
                if (data.requiresEmailVerification) {
                    showToast('info', '📧 Un email a été envoyé à votre adresse pour créer votre mot de passe. Vous allez être déconnecté.');
                    // Wait 3 seconds then logout
                    setTimeout(async () => {
                        await logout();
                        window.location.href = '/login';
                    }, 3000);
                } else {
                    showToast('success', 'Mot de passe modifié avec succès');
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }
            } else {
                showToast('danger', data.error || 'Erreur lors du changement de mot de passe');
            }
        } catch (error) {
            console.error('Error updating password:', error);
            showToast('danger', 'Erreur lors du changement de mot de passe');
        } finally {
            setLoading(false);
        }
    };

    const handlePreferencesSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        try {
            const data = await api.updatePreferences(preferences);
            
            if (data.success) {
                showToast('success', 'Préférences sauvegardées');
            } else {
                showToast('danger', data.error || 'Erreur lors de la sauvegarde des préférences');
            }
        } catch (error) {
            console.error('Error updating preferences:', error);
            showToast('danger', 'Erreur lors de la sauvegarde des préférences');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAccount = () => {
        setConfirmModal({
            isOpen: true,
            title: '⚠️ Supprimer le compte',
            message: 'ATTENTION : Cette action est irréversible. Toutes vos données, instances N8N, workflows et abonnements seront définitivement supprimés. Voulez-vous vraiment continuer ?',
            isDanger: true,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    const response = await fetch('http://localhost:3000/api/auth/delete-account', {
                        method: 'DELETE',
                        credentials: 'include'
                    });

                    const data = await response.json();

                    if (data.success) {
                        showToast('success', '✅ Votre compte a été supprimé définitivement');
                        setConfirmModal({ ...confirmModal, isOpen: false });
                        
                        // Redirect to login after 2 seconds
                        setTimeout(() => {
                            window.location.href = '/login';
                        }, 2000);
                    } else {
                        showToast('danger', data.error || 'Erreur lors de la suppression du compte');
                        setConfirmModal({ ...confirmModal, isOpen: false });
                    }
                } catch (error) {
                    console.error('Error deleting account:', error);
                    showToast('danger', 'Erreur lors de la suppression du compte');
                    setConfirmModal({ ...confirmModal, isOpen: false });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleDeleteAllInstances = () => {
        setConfirmModal({
            isOpen: true,
            title: '🗑️ Supprimer toutes les instances',
            message: 'Êtes-vous sûr de vouloir supprimer toutes vos instances N8N ? Tous vos workflows et données seront perdus. Cette action est irréversible.',
            isDanger: true,
            onConfirm: async () => {
                try {
                    setLoading(true);
                    
                    // Get all user instances
                    const instancesResponse = await instancesApi.getInstances();
                    const instances = instancesResponse.instances || [];
                    
                    if (instances.length === 0) {
                        showToast('info', 'Aucune instance à supprimer');
                        setConfirmModal({ ...confirmModal, isOpen: false });
                        return;
                    }

                    // Delete each instance
                    let deletedCount = 0;
                    let failedCount = 0;

                    for (const instance of instances) {
                        try {
                            await instancesApi.deleteInstance(instance.id);
                            deletedCount++;
                        } catch (error) {
                            console.error(`Failed to delete instance ${instance.id}:`, error);
                            failedCount++;
                        }
                    }

                    if (deletedCount > 0) {
                        showToast('success', `✅ ${deletedCount} instance(s) supprimée(s)${failedCount > 0 ? ` (${failedCount} échec(s))` : ''}`);
                    } else {
                        showToast('danger', 'Échec de la suppression des instances');
                    }

                    setConfirmModal({ ...confirmModal, isOpen: false });
                } catch (error) {
                    console.error('Error deleting instances:', error);
                    showToast('danger', 'Erreur lors de la suppression des instances');
                    setConfirmModal({ ...confirmModal, isOpen: false });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleResetPreferences = async () => {
        try {
            setLoading(true);
            const defaultPreferences = {
                emailNotifications: true,
                workflowNotifications: true,
                securityAlerts: true,
                darkMode: true,
                language: 'fr'
            };

            const data = await api.updatePreferences(defaultPreferences);
            
            if (data.success) {
                setPreferences(defaultPreferences);
                showToast('success', '✅ Préférences réinitialisées aux valeurs par défaut');
            } else {
                showToast('danger', data.error || 'Erreur lors de la réinitialisation');
            }
        } catch (error) {
            console.error('Error resetting preferences:', error);
            showToast('danger', 'Erreur lors de la réinitialisation des préférences');
        } finally {
            setLoading(false);
        }
    };

    // Discord integration handlers
    const fetchDiscordConnection = async () => {
        try {
            console.log('🔍 Fetching Discord connection...');
            const data = await api.getDiscordConnection();
            console.log('📡 Discord connection data:', data);
            
            if (data.connected) {
                setDiscordConnection(data.discord);
                console.log('✅ Discord connected:', data.discord);
            } else {
                setDiscordConnection(null);
                console.log('❌ Discord not connected');
            }
        } catch (error) {
            console.error('Error fetching Discord connection:', error);
        }
    };

    const fetchSubscriptionData = async () => {
        try {
            setLoadingSubscription(true);
            const [subData, paymentsData, planData] = await Promise.all([
                stripe.getSubscription(),
                stripe.getPaymentHistory(10),
                instancesApi.getSubscription() // Get plan name (pro/business) from user_subscriptions
            ]);
            
            // Merge Stripe subscription data with plan name
            if (subData.subscription && planData) {
                (subData.subscription as any).plan_name = planData.plan;
            }
            
            setSubscription(subData.subscription);
            setPayments(paymentsData.payments);
        } catch (error) {
            console.error('Error fetching subscription data:', error);
        } finally {
            setLoadingSubscription(false);
        }
    };

    const getPlanDisplayName = (sub: any) => {
        if (!sub) return 'GRATUIT';
        const planName = sub.plan_name?.toUpperCase() || 'PRO';
        const billingCycle = sub.plan_type === 'monthly' ? 'Mensuel' : 'Annuel';
        return `${planName} - ${billingCycle}`;
    };

    const handleManageSubscription = async () => {
        try {
            setLoadingSubscription(true);
            const { url } = await stripe.createPortalSession();
            window.location.href = url;
        } catch (error: any) {
            console.error('Error opening customer portal:', error);
            showToast('danger', error.response?.data?.error || 'Erreur lors de l\'ouverture du portail client');
            setLoadingSubscription(false);
        }
    };

    const handleVerifyCheckoutSession = async (sessionId: string) => {
        try {
            setLoadingSubscription(true);
            showToast('info', 'Vérification du paiement en cours...');
            
            const result = await stripe.verifyCheckoutSession(sessionId);
            
            if (result.status === 'success') {
                showToast('success', result.message);
                fetchSubscriptionData();
            } else if (result.status === 'failed') {
                showToast('danger', result.message);
            } else {
                showToast('warning', result.message);
            }
        } catch (error: any) {
            console.error('Error verifying checkout session:', error);
            showToast('danger', error.response?.data?.message || 'Erreur lors de la vérification du paiement');
        } finally {
            setLoadingSubscription(false);
        }
    };

    const handleCancelSubscription = async () => {
        setConfirmModal({
            isOpen: true,
            title: 'Annuler l\'abonnement',
            message: 'Êtes-vous sûr de vouloir annuler votre abonnement ? Il restera actif jusqu\'à la fin de la période en cours.',
            isDanger: true,
            onConfirm: async () => {
                try {
                    setLoadingSubscription(true);
                    await stripe.cancelSubscription();
                    showToast('success', 'Votre abonnement sera annulé à la fin de la période en cours');
                    fetchSubscriptionData();
                } catch (error: any) {
                    console.error('Error canceling subscription:', error);
                    showToast('danger', error.response?.data?.error || 'Erreur lors de l\'annulation de l\'abonnement');
                } finally {
                    setLoadingSubscription(false);
                    setConfirmModal({ ...confirmModal, isOpen: false });
                }
            }
        });
    };

    const handleSyncSubscription = async () => {
        try {
            setLoadingSubscription(true);
            const result = await stripe.syncSubscription();
            showToast('success', result.message);
            fetchSubscriptionData();
        } catch (error: any) {
            console.error('Error syncing subscription:', error);
            showToast('danger', error.response?.data?.error || 'Erreur lors de la synchronisation');
        } finally {
            setLoadingSubscription(false);
        }
    };

    const handleConnectDiscord = async () => {
        setLoadingDiscord(true);
        try {
            const data = await api.fetchDiscordAuthUrl();
            
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('Error connecting Discord:', error);
            showToast('danger', 'Erreur lors de la connexion à Discord');
            setLoadingDiscord(false);
        }
    };

    const handleDisconnectDiscord = async () => {
        setConfirmModal({
            isOpen: true,
            title: 'Déconnecter Discord',
            message: 'Êtes-vous sûr de vouloir déconnecter votre compte Discord ?',
            isDanger: false,
            onConfirm: async () => {
                setLoadingDiscord(true);
                try {
                    const data = await api.unlinkDiscord();

                    if (data.success) {
                        setDiscordConnection(null);
                        showToast('success', 'Compte Discord déconnecté avec succès');
                    } else {
                        throw new Error('Failed to disconnect Discord');
                    }
                } catch (error) {
                    console.error('Error disconnecting Discord:', error);
                    showToast('danger', 'Erreur lors de la déconnexion de Discord');
                } finally {
                    setLoadingDiscord(false);
                    setConfirmModal({ ...confirmModal, isOpen: false });
                }
            }
        });
    };

    // Handle Discord OAuth callback
    const handleDiscordCallback = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const discordParam = urlParams.get('discord');

        if (discordParam === 'callback' && code && state) {
            // Check if we're already processing or have processed this callback
            const processedKey = `discord_processed_${code}`;
            if (sessionStorage.getItem(processedKey)) {
                console.log('Discord callback already processed, skipping...');
                window.history.replaceState({}, '', '/dashboard/settings');
                return;
            }

            // Mark as being processed
            sessionStorage.setItem(processedKey, 'true');
            
            setLoadingDiscord(true);
            try {
                const data = await api.linkDiscord(code, state);

                if (data.success || data.discord) {
                    setDiscordConnection(data.discord);
                    showToast('success', 'Compte Discord connecté avec succès !');
                    setActiveTab('integrations');
                    // Clean URL
                    window.history.replaceState({}, '', '/dashboard/settings');
                } else {
                    // Remove the processed flag if it failed
                    sessionStorage.removeItem(processedKey);
                    throw new Error(data.error || 'Failed to link Discord');
                }
            } catch (error) {
                console.error('Error handling Discord callback:', error);
                showToast('danger', 'Erreur lors de la liaison du compte Discord');
            } finally {
                setLoadingDiscord(false);
            }
        }
    };

    // Update profile form when user data is loaded
    useEffect(() => {
        if (user) {
            setProfileForm({
                name: user.name || '',
                email: user.email || '',
                avatar: user.avatar || '',
                customAvatar: null
            });
            
            // Load preferences from user if available
            if ((user as any).preferences) {
                setPreferences((user as any).preferences);
            }
            
            // Check if it's a Discord account (has discord_id)
            setIsDiscordAccount(!!(user.discord_id));
        }
    }, [user]);

    // Load Discord connection on mount and handle callback
    useEffect(() => {
        console.log('⚡ Settings useEffect triggered');
        fetchDiscordConnection();
        handleDiscordCallback();
        
        // Check for successful payment redirect
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        
        if (sessionId) {
            // Verify checkout session first
            handleVerifyCheckoutSession(sessionId);
            // Clean URL
            window.history.replaceState({}, '', '/dashboard/settings');
        } else if (urlParams.get('payment') === 'success') {
            // Legacy fallback for old success redirects
            showToast('success', 'Paiement effectué ! Synchronisation en cours...');
            handleSyncSubscription();
            // Clean URL
            window.history.replaceState({}, '', '/dashboard/settings');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load subscription data when subscription tab is active
    useEffect(() => {
        if (activeTab === 'subscription') {
            fetchSubscriptionData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);


    return (
        <div className="min-h-screen bg-bg-dark text-white">
            <div className="flex gap-6">
                {/* Sidebar */}
                <aside className="w-72 shrink-0 border-r border-white/10 p-6">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold mb-2">Paramètres</h1>
                        <p className="text-gray-400 text-sm">Gérez votre compte et vos préférences</p>
                    </div>
                    <nav className="space-y-1 sticky top-24">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left ${
                                        activeTab === tab.id
                                            ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                                >
                                    {tab.icon}
                                    <span className="text-sm font-medium">{tab.label}</span>
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className="flex-1">
                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-bg-card border border-white/10 rounded-xl p-6"
                            >
                                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                    <User className="size-6 text-brand-orange" />
                                    Informations du profil
                                </h2>

                                <form onSubmit={handleProfileSubmit} className="space-y-6">
                                    {/* Avatar */}
                                    <div>
                                        <label className="block text-sm font-medium mb-3">Photo de profil</label>
                                        <div className="flex items-center gap-6">
                                            <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
                                                {profileForm.avatar ? (
                                                    <img
                                                        src={profileForm.avatar}
                                                        alt="Avatar"
                                                        className="size-24 rounded-full object-cover border-2 border-white/10"
                                                    />
                                                ) : (
                                                    <div className="size-24 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-3xl font-bold">
                                                        {profileForm.name ? getAvatarInitials(profileForm.name) : '?'}
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Camera className="size-6" />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleAvatarClick}
                                                    className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                                                >
                                                    Changer la photo
                                                </button>
                                                {user?.discord_id && (
                                                    <button
                                                        type="button"
                                                        onClick={handleSyncDiscordAvatar}
                                                        disabled={syncingAvatar}
                                                        className="bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-indigo-400 flex items-center justify-center gap-2"
                                                    >
                                                        {syncingAvatar ? (
                                                            <Loader2 className="size-4 animate-spin" />
                                                        ) : (
                                                            <Link2 className="size-4" />
                                                        )}
                                                        Sync Discord
                                                    </button>
                                                )}
                                                <p className="text-xs text-gray-500">JPG, PNG ou GIF. Max 2MB</p>
                                            </div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAvatarChange}
                                                className="hidden"
                                            />
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Nom complet</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                                            <input
                                                type="text"
                                                value={profileForm.name}
                                                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                                                placeholder="John Doe"
                                            />
                                        </div>
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-medium mb-2">Adresse e-mail</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                                            <input
                                                type="email"
                                                value={profileForm.email}
                                                onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold transition-all"
                                    >
                                        <Save className="size-5" />
                                        {loading ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        {/* Security Tab */}
                        {activeTab === 'security' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {/* Change Password */}
                                <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                        <Lock className="size-6 text-brand-orange" />
                                        {isDiscordAccount ? 'Créer un mot de passe' : 'Modifier le mot de passe'}
                                    </h2>

                                    {isDiscordAccount && (
                                        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm">
                                            👋 Votre compte a été créé via Discord. Pour créer un mot de passe et pouvoir vous connecter par email, 
                                            entrez un nouveau mot de passe ci-dessous. Un email vous sera envoyé pour finaliser la création.
                                        </div>
                                    )}

                                    <form onSubmit={handlePasswordSubmit} className="space-y-6">
                                        {!isDiscordAccount && (
                                            <div>
                                                <label className="block text-sm font-medium mb-2">Mot de passe actuel</label>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                                                    <input
                                                        type={showPasswords.current ? 'text' : 'password'}
                                                        value={passwordForm.currentPassword}
                                                        onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-12 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                                    >
                                                        {showPasswords.current ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-sm font-medium mb-2">Nouveau mot de passe</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                                                <input
                                                    type={showPasswords.new ? 'text' : 'password'}
                                                    value={passwordForm.newPassword}
                                                    onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-12 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                                >
                                                    {showPasswords.new ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-2">Confirmer le mot de passe</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                                                <input
                                                    type={showPasswords.confirm ? 'text' : 'password'}
                                                    value={passwordForm.confirmPassword}
                                                    onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-12 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                                                >
                                                    {showPasswords.confirm ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold transition-all"
                                        >
                                            <Save className="size-5" />
                                            {loading ? 'Modification...' : 'Modifier le mot de passe'}
                                        </button>
                                    </form>
                                </div>

                                {/* Two-Factor Authentication */}
                                <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                                <Shield className="size-6 text-green-400" />
                                                Authentification à deux facteurs
                                            </h3>
                                            <p className="text-gray-400 text-sm">Ajoutez une couche de sécurité supplémentaire à votre compte</p>
                                        </div>
                                        <button className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                            Activer
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Integrations Tab */}
                        {activeTab === 'integrations' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-bg-card border border-white/10 rounded-xl p-6"
                            >
                                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                    <Plug className="size-6 text-brand-orange" />
                                    Intégrations
                                </h2>

                                <div className="space-y-6">
                                    {/* Discord Integration */}
                                    <div className="border border-white/10 rounded-xl p-6 bg-white/5">
                                        <div className="flex items-start gap-4">
                                            <div className="size-16 bg-[#5865F2] rounded-xl flex items-center justify-center shrink-0">
                                                <svg className="size-10 text-white" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <g clipPath="url(#clip0)">
                                                        <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="currentColor"/>
                                                    </g>
                                                    <defs>
                                                        <clipPath id="clip0">
                                                            <rect width="71" height="55" fill="white"/>
                                                        </clipPath>
                                                    </defs>
                                                </svg>
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-xl font-bold">Discord</h3>
                                                    {discordConnection && (
                                                        <span className="flex items-center gap-1 bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">
                                                            <CheckCircle2 className="size-3" />
                                                            Connecté
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-400 mb-4">
                                                    Connectez votre compte Discord pour recevoir des notifications et accéder à des fonctionnalités exclusives
                                                </p>

                                                {discordConnection ? (
                                                    <div className="space-y-4">
                                                        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                                                            <div className="relative">
                                                                {discordConnection.avatarUrl ? (
                                                                    <img
                                                                        src={discordConnection.avatarUrl}
                                                                        alt="Discord"
                                                                        className="size-12 rounded-full"
                                                                    />
                                                                ) : (
                                                                    <div className="size-12 bg-[#5865F2] rounded-full flex items-center justify-center text-white font-bold">
                                                                        <svg className="size-6 text-white" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                            <path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z" fill="currentColor"/>
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                                <div className="absolute -bottom-1 -right-1 size-5 bg-green-500 rounded-full border-2 border-bg-card flex items-center justify-center">
                                                                    <CheckCircle2 className="size-3 text-white" />
                                                                </div>
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="font-semibold">Compte Discord connecté</p>
                                                                <p className="text-sm text-gray-400">ID: {discordConnection.id}</p>
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={handleDisconnectDiscord}
                                                            disabled={loadingDiscord}
                                                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                        >
                                                            <XCircle className="size-4" />
                                                            {loadingDiscord ? 'Déconnexion...' : 'Déconnecter Discord'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={handleConnectDiscord}
                                                        disabled={loadingDiscord}
                                                        className="flex items-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        <Link2 className="size-4" />
                                                        {loadingDiscord ? 'Connexion...' : 'Connecter Discord'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Future integrations placeholder */}
                                    <div className="border border-white/10 rounded-xl p-6 bg-white/5 opacity-50">
                                        <div className="flex items-center gap-4">
                                            <div className="size-16 bg-linear-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center shrink-0">
                                                <Plug className="size-8 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold mb-1">Plus d'intégrations à venir</h3>
                                                <p className="text-sm text-gray-400">
                                                    Slack, Telegram, Webhooks et bien d'autres...
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Preferences Tab */}
                        {activeTab === 'preferences' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-bg-card border border-white/10 rounded-xl p-6"
                            >
                                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                    <Bell className="size-6 text-brand-orange" />
                                    Préférences
                                </h2>

                                <form onSubmit={handlePreferencesSubmit} className="space-y-8">
                                    {/* Notifications */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Notifications</h3>
                                        <div className="space-y-4">
                                            {[
                                                { key: 'emailNotifications', label: 'Notifications par e-mail', desc: 'Recevez des e-mails pour les mises à jour importantes' },
                                                { key: 'workflowNotifications', label: 'Alertes de workflow', desc: 'Notifications lorsque vos workflows s\'exécutent' },
                                                { key: 'securityAlerts', label: 'Alertes de sécurité', desc: 'Avertissements sur les activités suspectes' },
                                            ].map((item) => (
                                                <div key={item.key} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                                                    <div>
                                                        <p className="font-medium">{item.label}</p>
                                                        <p className="text-sm text-gray-400">{item.desc}</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreferences(prev => ({ ...prev, [item.key]: !prev[item.key as keyof typeof prev] }))}
                                                        className={`relative w-12 h-6 rounded-full transition-colors ${
                                                            preferences[item.key as keyof typeof preferences]
                                                                ? 'bg-brand-orange'
                                                                : 'bg-gray-600'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`absolute top-0.5 left-0.5 size-5 bg-white rounded-full transition-transform ${
                                                                preferences[item.key as keyof typeof preferences]
                                                                    ? 'translate-x-6'
                                                                    : 'translate-x-0'
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Appearance */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Apparence</h3>
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                                                <div className="flex items-center gap-3">
                                                    <div>
                                                        <p className="font-medium">Mode sombre</p>
                                                        <p className="text-sm text-gray-400">Utiliser le thème sombre</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreferences(prev => ({ ...prev, darkMode: !prev.darkMode }))}
                                                    className={`relative w-12 h-6 rounded-full transition-colors ${
                                                        preferences.darkMode ? 'bg-brand-orange' : 'bg-gray-600'
                                                    }`}
                                                >
                                                    <span
                                                        className={`absolute top-0.5 left-0.5 size-5 bg-white rounded-full transition-transform ${
                                                            preferences.darkMode ? 'translate-x-6' : 'translate-x-0'
                                                        }`}
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Language */}
                                    <div>
                                        <h3 className="text-lg font-semibold mb-4">Langue</h3>
                                        <div className="relative">
                                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                                            <select
                                                value={preferences.language}
                                                onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                                            >
                                                <option value="fr">Français</option>
                                                <option value="en">English</option>
                                                <option value="es">Español</option>
                                                <option value="de">Deutsch</option>
                                            </select>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold transition-all"
                                    >
                                        <Save className="size-5" />
                                        {loading ? 'Sauvegarde...' : 'Sauvegarder les préférences'}
                                    </button>
                                </form>
                            </motion.div>
                        )}

                        {/* Subscription Tab */}
                        {activeTab === 'subscription' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {loadingSubscription && !subscription ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="size-8 animate-spin text-brand-orange" />
                                    </div>
                                ) : (
                                    <>
                                        {/* Current Plan */}
                                        <div className="bg-linear-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-6">
                                            <div className="flex items-start justify-between mb-6">
                                                <div>
                                                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                                                        Plan {getPlanDisplayName(subscription)}
                                                    </h2>
                                                    <p className="text-gray-400">
                                                        {subscription?.status === 'active' 
                                                            ? `Renouvellement le ${new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}` 
                                                            : 'Votre abonnement actuel et ses fonctionnalités'}
                                                    </p>
                                                    {subscription?.cancel_at_period_end && (
                                                        <p className="text-red-400 text-sm mt-2">
                                                            Votre abonnement sera annulé le {new Date(subscription.current_period_end).toLocaleDateString('fr-FR')}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    {subscription && (
                                                        <button
                                                            onClick={handleManageSubscription}
                                                            disabled={loadingSubscription}
                                                            className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
                                                        >
                                                            {loadingSubscription ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
                                                            Gérer
                                                        </button>
                                                    )}
                                                    {!subscription && (
                                                        <Link
                                                            to="/"
                                                            className="bg-brand-orange hover:bg-orange-600 px-6 py-3 rounded-lg font-semibold transition-all"
                                                        >
                                                            Mettre à niveau
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                                    <p className="text-sm text-gray-400 mb-1">Instances N8N</p>
                                                    <p className="text-2xl font-bold">
                                                        {subscription?.plan_type === 'annual' || subscription?.plan_type === 'monthly' 
                                                            ? '3' 
                                                            : '1'}
                                                    </p>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                                    <p className="text-sm text-gray-400 mb-1">Workflows</p>
                                                    <p className="text-2xl font-bold">Illimité</p>
                                                </div>
                                                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                                                    <p className="text-sm text-gray-400 mb-1">Accès API</p>
                                                    <p className="text-2xl font-bold">
                                                        {subscription || user?.subscription_plan === 'pro' || user?.subscription_plan === 'business' || user?.subscription_plan === 'monthly' || user?.subscription_plan === 'annual' ? '✓' : '✗'}
                                                    </p>
                                                </div>
                                            </div>

                                            {subscription?.status === 'active' && !subscription?.cancel_at_period_end && (
                                                <div className="mt-6 pt-6 border-t border-white/10">
                                                    <button
                                                        onClick={handleCancelSubscription}
                                                        disabled={loadingSubscription}
                                                        className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        Annuler l'abonnement
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Billing History */}
                                        <div className="bg-bg-card border border-white/10 rounded-xl p-6">
                                            <h3 className="text-xl font-bold mb-4">Historique de facturation</h3>
                                            {payments.length === 0 ? (
                                                <p className="text-gray-400 text-center py-8">Aucun paiement enregistré</p>
                                            ) : (
                                                <div className="space-y-3">
                                                    {payments.map((payment) => (
                                                        <div key={payment.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                                                            <div className="flex items-center gap-4">
                                                                <CreditCard className="size-5 text-gray-400" />
                                                                <div>
                                                                    <p className="font-medium">
                                                                        {new Date(payment.payment_date).toLocaleDateString('fr-FR', { 
                                                                            day: '2-digit', 
                                                                            month: 'short', 
                                                                            year: 'numeric' 
                                                                        })}
                                                                    </p>
                                                                    <p className="text-sm text-gray-400">
                                                                        {payment.description || `Plan ${payment.plan_type}`}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                <span className="font-bold">{Number(payment.amount).toFixed(2)} {payment.currency}</span>
                                                                <span className={`text-xs px-3 py-1 rounded-full ${
                                                                    payment.status === 'succeeded' 
                                                                        ? 'bg-green-500/20 text-green-400' 
                                                                        : payment.status === 'pending'
                                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                                        : 'bg-red-500/20 text-red-400'
                                                                }`}>
                                                                    {payment.status === 'succeeded' ? 'Payé' : payment.status === 'pending' ? 'En attente' : 'Échoué'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Danger Zone Tab */}
                        {activeTab === 'danger' && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-bg-card border border-white/10 rounded-xl p-6"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="size-10 rounded-lg  flex items-center justify-center">
                                        <AlertTriangle className="size-5 text-red-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold">Zone de danger</h2>
                                </div>
                                <p className="text-gray-400 mb-8">
                                    Gérez les actions critiques et irréversibles de votre compte
                                </p>

                                <div className="space-y-4">
                                    {/* Reset Preferences */}
                                    <div className="border border-white/10 rounded-lg p-6 hover:border-white/20 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-semibold mb-1">Réinitialiser les préférences</h3>
                                                <p className="text-sm text-gray-400">
                                                    Restaure toutes vos préférences aux valeurs par défaut 
                                                    (notifications activées, thème sombre, langue française).
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleResetPreferences}
                                                disabled={loading}
                                                className="shrink-0 flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loading ? <Loader2 className="size-4 animate-spin" /> : <Shield className="size-4" />}
                                                Réinitialiser
                                            </button>
                                        </div>
                                    </div>

                                    {/* Delete All Instances */}
                                    <div className="border border-white/10 rounded-lg p-6 hover:border-orange-500/30 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-semibold">Supprimer toutes les instances</h3>
                                                    <span className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">Irréversible</span>
                                                </div>
                                                <p className="text-sm text-gray-400">
                                                    Supprime toutes vos instances N8N et leurs workflows. 
                                                    Cette action libérera votre quota d'instances.
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleDeleteAllInstances}
                                                disabled={loading}
                                                className="shrink-0 flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                                Supprimer tout
                                            </button>
                                        </div>
                                    </div>

                                    {/* Delete Account */}
                                    <div className="border border-red-500/30 rounded-lg p-6 hover:border-red-500/50 transition-colors bg-red-500/5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="text-lg font-semibold text-red-400">Supprimer mon compte</h3>
                                                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">Danger</span>
                                                </div>
                                                <p className="text-sm text-gray-400 mb-3">
                                                    Une fois votre compte supprimé, il n'y a pas de retour en arrière. 
                                                    Toutes vos données, instances N8N, workflows et abonnements seront définitivement supprimés.
                                                </p>
                                                <ul className="text-xs text-gray-500 space-y-1">
                                                    <li>→ Téléchargez vos workflows importants</li>
                                                    <li>→ Exportez vos données si nécessaire</li>
                                                    <li>→ Annulez votre abonnement actif</li>
                                                </ul>
                                            </div>
                                            <button
                                                onClick={handleDeleteAccount}
                                                disabled={loading}
                                                className="shrink-0 flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                                                Supprimer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </main>
                </div>

                {/* Confirmation Modal */}
                {confirmModal.isOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-bg-card border border-white/10 rounded-xl p-6 max-w-md w-full shadow-2xl"
                        >
                            <div className="flex items-start gap-4 mb-6">
                                <div className={`size-12 rounded-full flex items-center justify-center shrink-0 ${
                                    confirmModal.isDanger 
                                        ? 'bg-red-500/20 text-red-400' 
                                        : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                    <AlertTriangle className="size-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold mb-2">{confirmModal.title}</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">{confirmModal.message}</p>
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg font-medium transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => {
                                        confirmModal.onConfirm();
                                    }}
                                    className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-all ${
                                        confirmModal.isDanger
                                            ? 'bg-red-500 hover:bg-red-600 text-white'
                                            : 'bg-brand-orange hover:bg-orange-600 text-white'
                                    }`}
                                >
                                    Confirmer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
    );
}
