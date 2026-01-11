import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import {
    LayoutDashboard,
    Workflow,
    Settings,
    FileCode,
    Search,
    LogOut,
    Plus,
    Sparkles,
    ChevronDown,
    ChevronRight,
    BookOpen,
    Library,
    FolderOpen,
    Users
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { instancesApi } from '../../api/instances';
import workflowsApi from '../../api/workflows';
import { useToast } from '../../contexts/ToastContext';
import NotificationDropdown from '../NotificationDropdown';
import { getAvatarInitials, getAvatarUrl } from '../../utils/avatar';
import { stripe } from '../../api/stripe';
import Onboarding from '../Onboarding';

export default function DashboardLayout() {
    const { user, logout, completeOnboarding } = useAuth();
    const { showToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showInstancesSubMenu, setShowInstancesSubMenu] = useState(true);
    const [userInstances, setUserInstances] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [subscription, setSubscription] = useState<any>(null);
    const [creating, setCreating] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [n8nWorkflows, setN8nWorkflows] = useState<any[]>([]);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Check for payment redirect with session_id
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        if (sessionId) {
            handleVerifyCheckoutSession(sessionId);
            // Clean URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    // Check for payment redirect with session_id
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        if (sessionId) {
            handleVerifyCheckoutSession(sessionId);
            // Clean URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    }, []);

    // Load instances and subscription
    useEffect(() => {
        loadInstances();
        loadSubscription();
        loadActivities();
        loadWorkflows();

        // Auto-refresh every 3 seconds
        const interval = setInterval(() => {
            loadInstances();
            loadActivities();
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    // Check if user needs onboarding
    useEffect(() => {
        if (user && !user.has_completed_onboarding && location.pathname === '/dashboard') {
            // Wait for DOM to be ready
            setTimeout(() => {
                setShowOnboarding(true);
            }, 500);
        }
    }, [user, location.pathname]);

    // Close search results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSearchResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Search when query changes
    useEffect(() => {
        if (searchQuery.trim()) {
            performSearch(searchQuery);
        } else {
            setSearchResults([]);
            setShowSearchResults(false);
        }
    }, [searchQuery, userInstances, n8nWorkflows]);

    const loadInstances = async () => {
        try {
            const result = await instancesApi.getInstances();
            setUserInstances(result.instances || []);
        } catch (error) {
            console.error('Error loading instances:', error);
        }
    };

    const loadSubscription = async () => {
        try {
            // Get subscription limits from user_subscriptions table (updated by Stripe)
            const result = await instancesApi.getSubscription();
            setSubscription(result);
        } catch (error) {
            console.error('Error loading subscription:', error);
            setSubscription({ plan: 'free', max_instances: 1 });
        }
    };

    const loadActivities = async () => {
        try {
            const result = await instancesApi.getActivities(5);
            setActivities(result.activities || []);
        } catch (error) {
            console.error('Error loading activities:', error);
        }
    };

    const loadWorkflows = async () => {
        try {
            const { workflows } = await workflowsApi.list();
            setN8nWorkflows(workflows || []);
        } catch (error) {
            console.error('Error loading workflows:', error);
        }
    };

    const handleVerifyCheckoutSession = async (sessionId: string) => {
        try {
            showToast('info', 'Vérification du paiement en cours...');

            const result = await stripe.verifyCheckoutSession(sessionId);

            if (result.status === 'success') {
                showToast('success', result.message);
                // Reload subscription data
                loadSubscription();
            } else if (result.status === 'failed') {
                showToast('danger', result.message);
            } else {
                showToast('warning', result.message);
            }
        } catch (error: any) {
            console.error('Error verifying checkout session:', error);
            showToast('danger', 'Erreur lors de la vérification du paiement');
        }
    };

    const performSearch = (query: string) => {
        const searchLower = query.toLowerCase();
        const results: any[] = [];

        // Search instances
        userInstances.forEach(instance => {
            if (instance.name.toLowerCase().includes(searchLower)) {
                results.push({
                    type: 'instance',
                    id: instance.id,
                    uuid: instance.uuid,
                    name: instance.name,
                    status: instance.status,
                    path: `/dashboard/instances/${instance.uuid}`
                });
            }
        });

        // Search workflows
        n8nWorkflows.forEach(workflow => {
            if (workflow.name.toLowerCase().includes(searchLower)) {
                results.push({
                    type: 'workflow',
                    id: workflow.id,
                    name: workflow.name,
                    instanceName: workflow.instanceName,
                    active: workflow.active,
                    url: workflow.workflowUrl
                });
            }
        });

        // Limit to 3 results
        setSearchResults(results.slice(0, 3));
        setShowSearchResults(results.length > 0);
    };

    const createInstance = async () => {
        if (creating) return;

        setCreating(true);
        try {
            const result = await instancesApi.createInstance();

            if (result.error) {
                showToast('danger', result.error);
            } else {
                showToast('success', 'Instance créée avec succès!');
                loadInstances();
            }
        } catch (error: any) {
            showToast('danger', error.message || 'Erreur lors de la création de l\'instance');
        } finally {
            setCreating(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const isActive = (path: string) => {
        if (path === '/dashboard') {
            return location.pathname === path;
        }
        return location.pathname.startsWith(path);
    };

    const menuItems = [
        { icon: <LayoutDashboard className="size-5" />, label: 'Vue d\'ensemble', path: '/dashboard' },
        { icon: <Workflow className="size-5" />, label: 'Instances N8N', path: '/dashboard/instances', hasSubMenu: true },
        { icon: <Sparkles className="size-5" />, label: 'IA Make', path: '/dashboard/ai-make' },
        { icon: <FolderOpen className="size-5" />, label: 'Ressources', path: '/dashboard/resources' },
        { icon: <Library className="size-5" />, label: 'Bibliothèque', path: '/dashboard/library' },
    ];

    const canUseApi = subscription?.plan === 'pro' || subscription?.plan === 'business' ||
        user?.subscription_plan === 'monthly' || user?.subscription_plan === 'annual';

    const bottomMenuItems = [
        { icon: <BookOpen className="size-5" />, label: 'Documentation', path: '/dashboard/documentation' },
        ...(canUseApi ? [{ icon: <FileCode className="size-5" />, label: 'API', path: '/dashboard/api' }] : []),
    ];

    const onboardingSteps = [
        {
            target: '[data-onboarding="new-instance"]',
            title: 'Créer une instance N8N',
            description: 'Cliquez ici pour créer votre première instance N8N hébergée. Votre instance sera prête en quelques secondes et accessible via un sous-domaine dédié.',
            position: 'bottom' as const
        },
        {
            target: '[data-onboarding="search"]',
            title: 'Recherche rapide',
            description: 'Utilisez la barre de recherche pour trouver rapidement vos instances et workflows N8N. Tapez simplement le nom et accédez-y en un clic.',
            position: 'bottom' as const
        },
        {
            target: '[data-onboarding="instances-menu"]',
            title: 'Vos instances N8N',
            description: 'Gérez toutes vos instances depuis ce menu. Vous verrez leur statut en temps réel et pourrez y accéder directement.',
            position: 'right' as const
        },
        {
            target: '[data-onboarding="ai-make"]',
            title: 'IA Make - Génération automatique',
            description: 'Utilisez l\'IA pour créer automatiquement des workflows N8N complexes. Décrivez simplement ce que vous voulez automatiser.',
            position: 'right' as const
        },
        {
            target: '[data-onboarding="library"]',
            title: 'Bibliothèque de ressources',
            description: 'Découvrez et importez des workflows pré-construits, prompts et ressources créés par la communauté.',
            position: 'right' as const
        },
        {
            target: '[data-onboarding="usage-card"]',
            title: 'Limites et upgrade',
            description: 'Suivez l\'utilisation de vos instances et passez à un plan supérieur pour débloquer plus de ressources et fonctionnalités.',
            position: 'top' as const
        }
    ];

    const handleOnboardingComplete = async () => {
        setShowOnboarding(false);
        await completeOnboarding();
        showToast('success', '🎉 Bienvenue sur LogicAI! Vous êtes prêt à automatiser.');
    };

    const handleOnboardingSkip = async () => {
        setShowOnboarding(false);
        await completeOnboarding();
    };

    return (
        <div className="min-h-screen bg-bg-dark text-white">
            {/* Top Bar */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-bg-card/80 backdrop-blur-xl border-b border-white/10 z-50">
                <div className="flex items-center justify-between h-full px-6">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-2">
                        <div className="size-8 rounded-lg overflow-hidden flex items-center justify-center">
                            <img src="/LogicAI.ico" alt="LogicAI" className="size-full object-contain" />
                        </div>
                        <span className="text-lg font-bold tracking-tight">LogicAI</span>
                    </Link>

                    {/* Search Bar */}
                    <div className="flex-1 max-w-2xl mx-8" ref={searchRef} data-onboarding="search">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => searchQuery && setShowSearchResults(true)}
                                placeholder="Rechercher une instance, un workflow..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-blue transition-colors"
                            />

                            {/* Search Results Dropdown */}
                            {showSearchResults && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-bg-card border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50">
                                    {searchResults.map((result, index) => (
                                        <div key={`${result.type}-${result.id || result.uuid}`}>
                                            {result.type === 'instance' ? (
                                                <Link
                                                    to={result.path}
                                                    onClick={() => {
                                                        setShowSearchResults(false);
                                                        setSearchQuery('');
                                                    }}
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                                        <Workflow className="size-4 text-blue-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{result.name}</p>
                                                        <p className="text-xs text-gray-500">Instance N8N</p>
                                                    </div>
                                                    <span className={`size-2 rounded-full ${result.status === 'running' ? 'bg-green-500' :
                                                            result.status === 'creating' ? 'bg-yellow-500' :
                                                                result.status === 'error' ? 'bg-red-500' :
                                                                    'bg-gray-500'
                                                        }`}></span>
                                                </Link>
                                            ) : (
                                                <a
                                                    href={result.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => {
                                                        setShowSearchResults(false);
                                                        setSearchQuery('');
                                                    }}
                                                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                                                >
                                                    <div className="p-2 rounded-lg bg-purple-500/20">
                                                        <Sparkles className="size-4 text-purple-400" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{result.name}</p>
                                                        <p className="text-xs text-gray-500">Workflow · {result.instanceName}</p>
                                                    </div>
                                                    <span className={`text-xs px-2 py-1 rounded ${result.active
                                                            ? 'bg-green-500/20 text-green-400'
                                                            : 'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {result.active ? 'Actif' : 'Inactif'}
                                                    </span>
                                                </a>
                                            )}
                                            {index < searchResults.length - 1 && (
                                                <div className="border-b border-white/5"></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        {/* New Instance Button */}
                        <button
                            onClick={createInstance}
                            disabled={creating}
                            data-onboarding="new-instance"
                            className="hidden md:flex items-center gap-2 bg-brand-blue hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                        >
                            <Plus className="size-4" />
                            {creating ? 'Création...' : 'Nouvelle instance'}
                        </button>

                        {/* Notifications */}
                        <NotificationDropdown activities={activities} />

                        {/* Profile Menu */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    console.log('🖼️ Avatar DEBUG - user.avatar:', user?.avatar?.substring(0, 50));
                                    console.log('🖼️ Avatar DEBUG - user.discord_id:', user?.discord_id);
                                    setShowProfileMenu(!showProfileMenu);
                                }}
                                className="flex items-center gap-2 hover:bg-white/5 px-3 py-2 rounded-lg transition-all"
                            >
                                {user?.avatar ? (
                                    <img 
                                        src={user.avatar.startsWith('data:') || user.avatar.startsWith('http') 
                                            ? user.avatar 
                                            : getAvatarUrl(user.avatar, user.discord_id) || ''} 
                                        alt={user?.name || 'User'} 
                                        className="size-8 rounded-full border border-white/10 object-cover"
                                        onLoad={() => console.log('✅ Avatar loaded successfully')}
                                        onError={(e) => console.error('❌ Avatar failed to load:', e)}
                                    />
                                ) : (
                                    <div className="size-8 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-sm font-semibold">
                                        {user?.name ? getAvatarInitials(user.name) : '?'}
                                    </div>
                                )}
                            </button>
                            {showProfileMenu && (
                                <div className="absolute right-0 mt-1 w-48 bg-bg-card border border-white/10 rounded-lg shadow-2xl py-2 z-50">
                                    <div className="px-4 py-2 border-b border-white/10">
                                        <p className="text-sm font-medium">{user?.name}</p>
                                        <p className="text-xs text-gray-500">{user?.email}</p>
                                    </div>
                                    {(user?.role === 'admin' || user?.role === 'support') && (
                                        <Link
                                            to="/administration"
                                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                                        >
                                            <LayoutDashboard className="size-4" />
                                            Administration
                                        </Link>
                                    )}
                                    <Link
                                        to="/dashboard/settings"
                                        className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5 transition-colors"
                                    >
                                        <Settings className="size-4" />
                                        Paramètres
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <LogOut className="size-4" />
                                        Déconnexion
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Sidebar */}
            <aside className="fixed top-16 left-0 bottom-0 w-64 bg-bg-card/50 backdrop-blur-xl border-r border-white/10 z-40 overflow-y-auto">
                <nav className="p-4 space-y-1 flex flex-col h-[calc(100%-140px)]">
                    <div className="space-y-1">
                        {menuItems.map((item) => (
                            <div key={item.path} data-onboarding={
                                item.path === '/dashboard/instances' ? 'instances-menu' :
                                    item.path === '/dashboard/ai-make' ? 'ai-make' :
                                        item.path === '/dashboard/library' ? 'library' :
                                            undefined
                            }>
                                {item.hasSubMenu ? (
                                    <>
                                        <button
                                            onClick={() => setShowInstancesSubMenu(!showInstancesSubMenu)}
                                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all group ${isActive(item.path)
                                                ? 'bg-orange-500/10 text-amber-500 border border-orange-500/30'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className={`transition-colors ${isActive(item.path) ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500'
                                                    }`}>
                                                    {item.icon}
                                                </span>
                                                <span className="text-sm font-medium">{item.label}</span>
                                            </div>
                                            {showInstancesSubMenu ? (
                                                <ChevronDown className="size-4" />
                                            ) : (
                                                <ChevronRight className="size-4" />
                                            )}
                                        </button>
                                        {showInstancesSubMenu && userInstances.length > 0 && (
                                            <div className="ml-4 mt-1 space-y-1 border-l border-white/10 pl-4">
                                                {userInstances.map((instance) => (
                                                    <Link
                                                        key={instance.id}
                                                        to={`/dashboard/instances/${instance.uuid}`}
                                                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group ${location.pathname === `/dashboard/instances/${instance.uuid}`
                                                            ? 'bg-orange-500/5 text-amber-500'
                                                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <span className="truncate">{instance.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {instance.is_shared && (
                                                                <Users className="size-3.5 text-blue-400" />
                                                            )}
                                                            <span className={`size-2 rounded-full transition-all ${instance.status === 'running' ? 'bg-green-500 animate-pulse' :
                                                                    instance.status === 'creating' ? 'bg-yellow-500 animate-pulse' :
                                                                        instance.status === 'error' ? 'bg-red-500' :
                                                                            'bg-gray-500'
                                                                }`}></span>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <Link
                                        to={item.path}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${isActive(item.path)
                                            ? 'bg-orange-500/10 text-amber-500 border border-orange-500/30'
                                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <span className={`transition-colors ${isActive(item.path) ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500'
                                            }`}>
                                            {item.icon}
                                        </span>
                                        <span className="text-sm font-medium">{item.label}</span>
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Bottom Menu Items */}
                    <div className="mt-auto space-y-1 pt-4 border-t border-white/10">
                        {bottomMenuItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${isActive(item.path)
                                    ? 'bg-orange-500/10 text-amber-500 border border-orange-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <span className={`transition-colors ${isActive(item.path) ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500'
                                    }`}>
                                    {item.icon}
                                </span>
                                <span className="text-sm font-medium">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </nav>

                {/* Usage Card */}
                <div className="absolute bottom-4 left-4 right-4" data-onboarding="usage-card">
                    <div className="bg-linear-to-br from-orange-500/10 to-amber-300/10 border border-white/10 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="size-4 text-brand-orange" />
                            <span className="text-xs font-semibold text-gray-400">
                                PLAN {subscription?.plan?.toUpperCase() || 'GRATUIT'}
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                                <span>Instances</span>
                                <span>{userInstances.filter(i => !i.is_shared).length}/{subscription?.max_instances || 1}</span>
                            </div>
                            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                <div
                                    className="h-full bg-linear-to-r from-orange-500 to-amber-500 transition-all duration-500 ease-out"
                                    style={{
                                        width: `${Math.min(100, (userInstances.filter(i => !i.is_shared).length / (subscription?.max_instances || 1)) * 100)}%`
                                    }}
                                />
                            </div>
                        </div>

                        {subscription?.plan !== 'business' && (
                            <Link
                                to="/#pricing"
                                className="block w-full text-center bg-brand-blue hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                            >
                                {subscription?.plan === 'pro' ? 'Passer au Business' : 'Passer au Pro'}
                            </Link>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 mt-16 min-h-[calc(100vh-4rem)]">
                <div className={location.pathname.includes('ai-make') || location.pathname.includes('documentation') ? '' : 'p-8'}>
                    <Outlet />
                </div>
            </main>

            {/* Onboarding */}
            {showOnboarding && (
                <Onboarding
                    steps={onboardingSteps}
                    onComplete={handleOnboardingComplete}
                    onSkip={handleOnboardingSkip}
                />
            )}
        </div>
    );
}