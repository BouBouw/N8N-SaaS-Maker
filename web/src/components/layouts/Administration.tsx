import { Outlet, Link, useNavigate, useLocation } from 'react-router';
import {
    LayoutDashboard,
    Users,
    Server,
    Workflow,
    ArrowLeft,
    LogOut,
    Settings
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarInitials, getAvatarUrl } from '../../utils/avatar';

export default function AdministrationLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // Check if user has admin/support role
    useEffect(() => {
        if (user && user.role !== 'admin' && user.role !== 'support') {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const isActive = (path: string) => {
        if (path === '/administration') {
            return location.pathname === path;
        }
        return location.pathname.startsWith(path);
    };

    const menuItems = [
        { icon: <LayoutDashboard className="size-5" />, label: 'Vue d\'ensemble', path: '/administration' },
        { icon: <Users className="size-5" />, label: 'Utilisateurs', path: '/administration/users' },
        { icon: <Server className="size-5" />, label: 'Instances', path: '/administration/instances' },
        { icon: <Workflow className="size-5" />, label: 'Workflows', path: '/administration/workflows' },
    ];

    if (!user || (user.role !== 'admin' && user.role !== 'support')) {
        return null;
    }

    return (
        <div className="min-h-screen bg-bg-dark text-white">
            {/* Top Bar */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-bg-card/80 backdrop-blur-xl border-b border-white/10 z-50">
                <div className="flex items-center justify-between h-full px-6">
                    {/* Logo & Back */}
                    <div className="flex items-center gap-4">
                        <Link to="/dashboard" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="size-5" />
                            <span className="text-sm">Retour au dashboard</span>
                        </Link>
                        <div className="h-6 w-px bg-white/10"></div>
                        <div className="flex items-center gap-2">
                            <div className="size-8 rounded-lg overflow-hidden flex items-center justify-center">
                                <img src="/LogicAI.ico" alt="LogicAI" className="size-full object-contain" />
                            </div>
                            <div>
                                <span className="text-lg font-bold tracking-tight">Administration</span>
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                                    user.role === 'admin' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                    {user.role === 'admin' ? 'Admin' : 'Support'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-4">
                        {/* Profile Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowProfileMenu(!showProfileMenu)}
                                className="flex items-center gap-2 hover:bg-white/5 px-3 py-2 rounded-lg transition-all"
                            >
                                {getAvatarUrl(user?.avatar, user?.discord_id) ? (
                                    <img src={getAvatarUrl(user?.avatar, user?.discord_id)!} alt={user?.name || 'User'} className="size-8 rounded-full border border-white/10" />
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
                <nav className="p-4 space-y-1">
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all group ${
                                isActive(item.path)
                                    ? 'bg-orange-500/10 text-amber-500 border border-orange-500/30'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <span className={`transition-colors ${
                                isActive(item.path) ? 'text-orange-500' : 'text-gray-500 group-hover:text-orange-500'
                            }`}>
                                {item.icon}
                            </span>
                            <span className="text-sm font-medium">{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Info Card */}
                <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-linear-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-xs text-gray-400 mb-2">
                            {user.role === 'admin' 
                                ? 'Vous avez un accès complet à toutes les fonctionnalités d\'administration.'
                                : 'Vous avez un accès en lecture seule aux données d\'administration.'
                            }
                        </p>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="ml-64 mt-16 min-h-[calc(100vh-4rem)] p-8">
                <Outlet />
            </main>
        </div>
    );
}
