import { useParams, Link } from 'react-router';
import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
    Server,
    Activity,
    HardDrive,
    Cpu,
    Network,
    Clock,
    ExternalLink,
    Play,
    Pause,
    RefreshCw,
    Trash2,
    ArrowLeft,
    Zap,
    Globe,
    Terminal,
    RotateCw,
    Users,
    LayoutGrid,
    Mail,
    X,
    ChevronDown,
    Check,
    Crown
} from 'lucide-react';
import { instancesApi } from '../../../api/instances';
import { membersApi, type Member } from '../../../api/members';
import { getAvatarUrl, getAvatarInitials } from '../../../utils/avatar';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router';
import InviteMemberModal from '../../../components/InviteMemberModal';

export default function Instance() {
    const { uuid } = useParams();
    const { showToast, showDemand } = useToast();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [instance, setInstance] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [logs, setLogs] = useState<string>('');
    const [statsHistory, setStatsHistory] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'principal' | 'membres'>('principal');
    const [members, setMembers] = useState<Member[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [roleDropdownOpen, setRoleDropdownOpen] = useState<number | null>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadInstance();
        
        // Auto-refresh every 5 seconds
        const interval = setInterval(() => {
            loadInstance();
            if (instance?.id) {
                loadLogs();
            }
            // Also reload members if on members tab
            if (activeTab === 'membres') {
                loadMembers();
            }
        }, 5000);
        
        return () => clearInterval(interval);
    }, [uuid, activeTab]);

    useEffect(() => {
        if (activeTab === 'membres') {
            loadMembers();
        }
    }, [instance?.id, activeTab]);

    useEffect(() => {
        // Scroll logs to bottom
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    useEffect(() => {
        // Close dropdown when clicking outside
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.role-dropdown')) {
                setRoleDropdownOpen(null);
            }
        };

        if (roleDropdownOpen !== null) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [roleDropdownOpen]);

    const loadInstance = async () => {
        try {
            const result = await instancesApi.getInstance(uuid as string);
            const inst = result.instance;
            setInstance(inst);
            
            // Store stats history for graphs
            if (inst?.live_stats) {
                setStatsHistory(prev => {
                    const newHistory = [...prev, {
                        timestamp: Date.now(),
                        cpu: inst.live_stats.cpu_percent || 0,
                        memory: inst.live_stats.memory_percent || 0
                    }];
                    // Keep last 20 data points
                    return newHistory.slice(-20);
                });
            }
        } catch (error) {
            console.error('Error loading instance:', error);
            showToast('danger', 'Instance non trouvée');
            navigate('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    // Check if user has permission for an action
    const canPerformAction = (requiredRole: 'owner' | 'admin' | 'editor') => {
        if (!instance?.user_role) return false;
        
        const roleHierarchy = {
            'owner': 4,
            'admin': 3,
            'editor': 2,
            'viewer': 1
        };
        
        const userRoleLevel = roleHierarchy[instance.user_role as keyof typeof roleHierarchy] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 999;
        
        return userRoleLevel >= requiredRoleLevel;
    };

    const loadLogs = async () => {
        if (!instance?.id) return;
        try {
            const result = await instancesApi.getInstanceLogs(instance.id, 50);
            setLogs(result.logs || '');
        } catch (error) {
            console.error('Error loading logs:', error);
        }
    };

    const loadMembers = async () => {
        if (!instance?.id) return;
        try {
            const { members } = await membersApi.getInstanceMembers(instance.id);
            setMembers(members);
        } catch (error) {
            console.error('Error loading members:', error);
        }
    };

    const handleRemoveMember = async (memberId: number, memberEmail: string) => {
        if (!instance) return;
        
        showDemand(
            `Êtes-vous sûr de vouloir retirer ${memberEmail} de cette instance ?`,
            async () => {
                try {
                    await membersApi.removeMember(memberId, instance.id);
                    showToast('success', 'Membre retiré');
                    loadMembers();
                } catch (error) {
                    showToast('danger', 'Erreur lors de la suppression');
                }
            }
        );
    };

    const handleUpdateRole = async (memberId: number, newRole: string) => {
        if (!instance) return;
        try {
            await membersApi.updateMemberRole(memberId, instance.id, newRole);
            showToast('success', 'Rôle mis à jour');
            loadMembers();
        } catch (error) {
            showToast('danger', 'Erreur lors de la mise à jour');
        }
    };

    const handleStartStop = async () => {
        if (!instance) return;
        setActionLoading(true);
        
        try {
            if (instance.status === 'running') {
                await instancesApi.stopInstance(instance.id);
                showToast('success', 'Instance arrêtée');
            } else {
                await instancesApi.startInstance(instance.id);
                showToast('success', 'Instance démarrée');
            }
            setTimeout(() => loadInstance(), 1000);
        } catch (error) {
            showToast('danger', 'Erreur lors de l\'action');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRestart = async () => {
        if (!instance) return;
        setActionLoading(true);
        
        try {
            await instancesApi.restartInstance(instance.id);
            showToast('success', 'Instance redémarrée');
            setTimeout(() => loadInstance(), 1000);
        } catch (error) {
            showToast('danger', 'Erreur lors du redémarrage');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = () => {
        if (!instance) return;
        
        showDemand(
            `Êtes-vous sûr de vouloir supprimer l'instance "${instance.name}" ?\n\nCette action est irréversible.`,
            async () => {
                try {
                    await instancesApi.deleteInstance(instance.id);
                    showToast('success', 'Instance supprimée');
                    navigate('/dashboard');
                } catch (error) {
                    showToast('danger', 'Erreur lors de la suppression');
                }
            }
        );
    };

    const getRoleBadgeColor = (role: string) => {
        const colors = {
            admin: 'bg-red-500',
            editor: 'bg-orange-500',
            viewer: 'bg-green-500'
        } as const;
        return colors[role as keyof typeof colors] || 'bg-gray-500';
    };

    const getRoleLabel = (role: string) => {
        const labels = {
            admin: 'Administrateur',
            editor: 'Éditeur',
            viewer: 'Lecteur'
        } as const;
        return labels[role as keyof typeof labels] || role;
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            active: { label: 'Actif', color: 'bg-green-500/20 text-green-400' },
            pending: { label: 'En attente', color: 'bg-yellow-500/20 text-yellow-400' },
            declined: { label: 'Refusé', color: 'bg-red-500/20 text-red-400' }
        } as const;
        return badges[status as keyof typeof badges] || badges.pending;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <RefreshCw className="size-8 animate-spin text-brand-orange" />
            </div>
        );
    }

    if (!instance) {
        return (
            <div className="text-center py-12">
                <Server className="size-16 mx-auto mb-4 text-gray-600" />
                <h2 className="text-2xl font-bold mb-2">Instance non trouvée</h2>
                <p className="text-gray-400 mb-6">Cette instance n'existe pas ou a été supprimée</p>
                <Link to="/dashboard" className="text-brand-orange hover:text-orange-400">
                    Retour au tableau de bord
                </Link>
            </div>
        );
    }

    const statusColor = ({
        running: 'bg-green-500',
        stopped: 'bg-gray-500',
        creating: 'bg-yellow-500',
        error: 'bg-red-500'
    } as const)[instance.status as 'running' | 'stopped' | 'creating' | 'error'] || 'bg-gray-500';

    const statusText = ({
        running: 'En ligne',
        stopped: 'Arrêté',
        creating: 'Création...',
        error: 'Erreur'
    } as const)[instance.status as 'running' | 'stopped' | 'creating' | 'error'] || 'Inconnu';

    const cpuUsage = instance.live_stats?.cpu_percent || 0;
    const memoryUsage = instance.live_stats?.memory_percent || 0;
    const memoryUsedMB = instance.live_stats?.memory_used_mb || 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        to="/dashboard"
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="size-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            {instance.name}
                            <span className={`size-3 rounded-full ${statusColor} ${instance.status === 'running' || instance.status === 'creating' ? 'animate-pulse' : ''}`} />
                            {/* User role badge */}
                            {instance.user_role && instance.user_role !== 'owner' && (
                                <span className={`text-sm px-3 py-1 rounded-full ${
                                    instance.user_role === 'admin' ? 'bg-red-500/20 text-red-400' :
                                    instance.user_role === 'editor' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-green-500/20 text-green-400'
                                }`}>
                                    {getRoleLabel(instance.user_role)}
                                </span>
                            )}
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">{statusText}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canPerformAction('editor') && (
                        <button
                            onClick={handleStartStop}
                            disabled={actionLoading || instance.status === 'creating'}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {instance.status === 'running' ? (
                                <>
                                    <Pause className="size-4" />
                                    Arrêter
                                </>
                            ) : (
                                <>
                                    <Play className="size-4" />
                                    Démarrer
                                </>
                            )}
                        </button>
                    )}
                    {canPerformAction('editor') && (
                        <button
                            onClick={handleRestart}
                            disabled={actionLoading || instance.status !== 'running'}
                            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <RotateCw className="size-4" />
                            Redémarrer
                        </button>
                    )}
                    {canPerformAction('owner') && (
                        <button
                            onClick={handleDelete}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                        >
                            <Trash2 className="size-4" />
                            Supprimer
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 border-b border-white/10">
                <button
                    onClick={() => setActiveTab('principal')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                        activeTab === 'principal'
                            ? 'border-brand-orange text-brand-orange'
                            : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                    <LayoutGrid className="size-4" />
                    Principal
                </button>
                <button
                    onClick={() => setActiveTab('membres')}
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                        activeTab === 'membres'
                            ? 'border-brand-orange text-brand-orange'
                            : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                >
                    <Users className="size-4" />
                    Membres
                </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'principal' && (
                <div className="space-y-6">{/* Quick Access */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-bg-card border border-white/10 rounded-2xl p-6"
            >
                <h2 className="text-xl font-bold mb-4">Accès rapide</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <a
                        href={`https://${instance.subdomain}.logicai.fr`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group"
                    >
                        <div className="p-3 rounded-lg bg-linear-to-br from-orange-500/20 to-amber-500/20">
                            <ExternalLink className="size-5 text-orange-500" />
                        </div>
                        <div className="flex-1">
                            <div className="font-medium">Interface N8N</div>
                            <div className="text-sm text-gray-400 font-mono">{instance.subdomain}.logicai.fr</div>
                        </div>
                        <ExternalLink className="size-4 text-gray-500 group-hover:text-white transition-colors" />
                    </a>

                    <div className="flex items-center gap-3 p-4 bg-white/5 rounded-lg">
                        <div className="p-3 rounded-lg bg-linear-to-br from-blue-500/20 to-cyan-500/20">
                            <Globe className="size-5 text-blue-500" />
                        </div>
                        <div className="flex-1">
                            <div className="font-medium">Port Docker</div>
                            <div className="text-sm text-gray-400">{instance.docker_port || 'N/A'}</div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Stats Grid with Graphs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-bg-card border border-white/10 rounded-2xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-linear-to-br from-purple-500/20 to-pink-500/20">
                                <Cpu className="size-5 text-purple-500" />
                            </div>
                            <h3 className="font-semibold">CPU</h3>
                        </div>
                        <div className="text-2xl font-bold">{cpuUsage.toFixed(1)}%</div>
                    </div>
                    
                    {/* CPU Graph */}
                    <div className="h-32 relative">
                        <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="cpuGradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="rgb(168, 85, 247)" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="rgb(168, 85, 247)" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {statsHistory.length > 1 && (
                                <>
                                    <polyline
                                        fill="url(#cpuGradient)"
                                        stroke="none"
                                        points={statsHistory.map((stat, i) => 
                                            `${(i / (statsHistory.length - 1)) * 400},${100 - stat.cpu}`
                                        ).join(' ') + ' 400,100 0,100'}
                                    />
                                    <polyline
                                        fill="none"
                                        stroke="rgb(168, 85, 247)"
                                        strokeWidth="2"
                                        points={statsHistory.map((stat, i) => 
                                            `${(i / (statsHistory.length - 1)) * 400},${100 - stat.cpu}`
                                        ).join(' ')}
                                    />
                                </>
                            )}
                        </svg>
                        <div className="absolute inset-0 border border-white/5 rounded-lg pointer-events-none" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-bg-card border border-white/10 rounded-2xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-linear-to-br from-green-500/20 to-emerald-500/20">
                                <Activity className="size-5 text-green-500" />
                            </div>
                            <h3 className="font-semibold">RAM</h3>
                        </div>
                        <div className="text-2xl font-bold">{memoryUsage.toFixed(1)}%</div>
                    </div>
                    
                    {/* RAM Graph */}
                    <div className="h-32 relative">
                        <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="ramGradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.4" />
                                    <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            {statsHistory.length > 1 && (
                                <>
                                    <polyline
                                        fill="url(#ramGradient)"
                                        stroke="none"
                                        points={statsHistory.map((stat, i) => 
                                            `${(i / (statsHistory.length - 1)) * 400},${100 - stat.memory}`
                                        ).join(' ') + ' 400,100 0,100'}
                                    />
                                    <polyline
                                        fill="none"
                                        stroke="rgb(34, 197, 94)"
                                        strokeWidth="2"
                                        points={statsHistory.map((stat, i) => 
                                            `${(i / (statsHistory.length - 1)) * 400},${100 - stat.memory}`
                                        ).join(' ')}
                                    />
                                </>
                            )}
                        </svg>
                        <div className="absolute inset-0 border border-white/5 rounded-lg pointer-events-none" />
                    </div>
                    <div className="text-sm text-gray-400 mt-2">
                        {memoryUsedMB.toFixed(0)} MB / {instance.ram_limit * 1024} MB
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-bg-card border border-white/10 rounded-2xl p-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-linear-to-br from-orange-500/20 to-amber-500/20">
                            <HardDrive className="size-5 text-orange-500" />
                        </div>
                        <h3 className="font-semibold">Stockage</h3>
                    </div>
                    <div className="text-3xl font-bold mb-2">
                        {((instance.storage_used / instance.storage_limit) * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400 mb-2">
                        {instance.storage_used} GB / {instance.storage_limit} GB
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                        <div
                            className="bg-linear-to-r from-orange-500 to-amber-500 h-2 rounded-full transition-all"
                            style={{ width: `${(instance.storage_used / instance.storage_limit) * 100}%` }}
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-bg-card border border-white/10 rounded-2xl p-6"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-linear-to-br from-blue-500/20 to-cyan-500/20">
                            <Network className="size-5 text-blue-500" />
                        </div>
                        <h3 className="font-semibold">Bande passante</h3>
                    </div>
                    <div className="text-3xl font-bold mb-2">
                        {((instance.bandwidth_used / instance.bandwidth_limit) * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400 mb-2">
                        {instance.bandwidth_used} TB / {instance.bandwidth_limit} TB
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                        <div
                            className="bg-linear-to-r from-blue-500 to-cyan-500 h-2 rounded-full transition-all"
                            style={{ width: `${(instance.bandwidth_used / instance.bandwidth_limit) * 100}%` }}
                        />
                    </div>
                </motion.div>
            </div>

            {/* Console Logs */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-bg-card border border-white/10 rounded-2xl overflow-hidden"
            >
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-linear-to-br from-gray-500/20 to-gray-600/20">
                            <Terminal className="size-5 text-gray-400" />
                        </div>
                        <h2 className="text-xl font-bold">Console</h2>
                    </div>
                    <button
                        onClick={loadLogs}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <RefreshCw className="size-4" />
                    </button>
                </div>
                <div className="p-6">
                    <div className="bg-black/50 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs">
                        {logs ? (
                            <pre className="text-green-400 whitespace-pre-wrap">{logs}</pre>
                        ) : (
                            <div className="text-gray-500 text-center py-8">
                                {instance.status === 'running' ? 'Chargement des logs...' : 'Instance arrêtée - Aucun log disponible'}
                            </div>
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            </motion.div>

            {/* Instance Info */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-bg-card border border-white/10 rounded-2xl p-6"
            >
                <h2 className="text-xl font-bold mb-6">Informations</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <div className="text-sm text-gray-400">ID</div>
                        <div className="font-mono text-sm">{instance.id}</div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-sm text-gray-400">UUID</div>
                        <div className="font-mono text-sm break-all">{instance.uuid}</div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-sm text-gray-400">Créé le</div>
                        <div className="text-sm flex items-center gap-2">
                            <Clock className="size-4 text-gray-500" />
                            {new Date(instance.created_at).toLocaleDateString('fr-FR')}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="text-sm text-gray-400">Dernière activité</div>
                        <div className="text-sm flex items-center gap-2">
                            <Zap className="size-4 text-gray-500" />
                            {new Date(instance.last_activity).toLocaleDateString('fr-FR')}
                        </div>
                    </div>
                </div>
            </motion.div>
                </div>
            )}

            {/* Membres Tab */}
            {activeTab === 'membres' && (
                <div className="space-y-6">
                    {/* Members List */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-bg-card border border-white/10 rounded-2xl p-6"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold">Membres de l'instance</h2>
                            {canPerformAction('admin') && (
                                <button
                                    onClick={() => setShowInviteModal(true)}
                                    className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                                >
                                    <Users className="size-4" />
                                    Ajouter un membre
                                </button>
                            )}
                        </div>

                        {/* Members List */}
                        <div className="space-y-3">
                            {members.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <Users className="size-12 mx-auto mb-4 text-gray-600" />
                                    <p className="text-sm">Aucun membre ajouté pour cette instance</p>
                                    <p className="text-xs text-gray-600 mt-2">Invitez des membres pour collaborer sur cette instance N8N</p>
                                </div>
                            ) : (
                                members.map((member) => (
                                    <div
                                        key={member.id}
                                        className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group"
                                    >
                                        <div className="flex items-center gap-4 flex-1">
                                            {getAvatarUrl(member.user_avatar, member.user_discord_id) ? (
                                                <img 
                                                    src={getAvatarUrl(member.user_avatar, member.user_discord_id)!} 
                                                    alt={member.user_name || member.email}
                                                    className="size-12 rounded-full object-cover shrink-0"
                                                />
                                            ) : (
                                                <div className="size-12 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white font-semibold text-lg shrink-0">
                                                    {member.user_name ? getAvatarInitials(member.user_name) : member.email.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="font-medium truncate">
                                                        {member.user_name || member.email}
                                                    </div>
                                                    {member.is_owner && (
                                                        <Crown className="size-4 text-yellow-500" />
                                                    )}
                                                    {member.status === 'pending' && (
                                                        <span className={`text-xs px-2 py-0.5 rounded ${getStatusBadge(member.status).color}`}>
                                                            <Mail className="size-3 inline mr-1" />
                                                            {getStatusBadge(member.status).label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-400 truncate">
                                                    {member.user_email || member.email}
                                                </div>
                                                {member.inviter_name && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        Invité par {member.inviter_name} • {new Date(member.invited_at).toLocaleDateString('fr-FR')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Don't show role selector for owner or for current user */}
                                            {!member.is_owner && member.user_id !== user?.id && (
                                                canPerformAction('admin') ? (
                                                    <div className="relative role-dropdown">
                                                        <button
                                                            onClick={() => setRoleDropdownOpen(roleDropdownOpen === member.id ? null : member.id)}
                                                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors group"
                                                        >
                                                            <div className={`size-2 rounded-full ${getRoleBadgeColor(member.role)}`} />
                                                            <span className="text-gray-300">{getRoleLabel(member.role)}</span>
                                                            <ChevronDown className={`size-4 text-gray-500 transition-transform ${roleDropdownOpen === member.id ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {/* Dropdown */}
                                                        {roleDropdownOpen === member.id && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: -10 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -10 }}
                                                                className="absolute right-0 mt-2 w-56 bg-bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                                                            >
                                                                {[
                                                                    { value: 'viewer', label: 'Lecteur', color: 'bg-green-500', description: 'Accès en lecture seule' },
                                                                    { value: 'editor', label: 'Éditeur', color: 'bg-orange-500', description: 'Peut modifier les workflows' },
                                                                    { value: 'admin', label: 'Administrateur', color: 'bg-red-500', description: 'Accès complet' }
                                                                ].map((role) => (
                                                                    <button
                                                                        key={role.value}
                                                                        onClick={() => {
                                                                            handleUpdateRole(member.id, role.value);
                                                                            setRoleDropdownOpen(null);
                                                                        }}
                                                                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors ${
                                                                            member.role === role.value ? 'bg-white/5' : ''
                                                                        }`}
                                                                    >
                                                                        <div className={`size-2 rounded-full ${role.color}`} />
                                                                        <div className="flex-1 text-left">
                                                                            <div className="text-sm font-medium text-white">{role.label}</div>
                                                                            <div className="text-xs text-gray-500">{role.description}</div>
                                                                        </div>
                                                                        {member.role === role.value && (
                                                                            <Check className="size-4 text-brand-orange" />
                                                                        )}
                                                                    </button>
                                                                ))}
                                                            </motion.div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
                                                        <div className={`size-2 rounded-full ${getRoleBadgeColor(member.role)}`} />
                                                        <span className="text-sm text-gray-400">{getRoleLabel(member.role)}</span>
                                                    </div>
                                                )
                                            )}

                                            {/* Remove button - only for owner/admin and not for the owner or current user */}
                                            {canPerformAction('admin') && !member.is_owner && member.user_id !== user?.id && (
                                                <button
                                                    onClick={() => handleRemoveMember(member.id, member.email)}
                                                    className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Retirer le membre"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Invite Member Modal */}
            {showInviteModal && instance && (
                <InviteMemberModal
                    isOpen={showInviteModal}
                    onClose={() => setShowInviteModal(false)}
                    instanceId={instance.id}
                    instanceName={instance.name}
                    onInvited={loadMembers}
                />
            )}
        </div>
    );
}