import { motion } from 'motion/react';
import {
    TrendingUp,
    TrendingDown,
    Activity,
    Zap,
    CheckCircle,
    AlertCircle,
    Play,
    Pause,
    ArrowRight,
    Workflow,
    Server,
    Trash2,
    RefreshCw
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { instancesApi } from '../../api/instances';
import { useToast } from '../../contexts/ToastContext';
import { useWebSocket } from '../../contexts/WebSocketContext';

export default function Dashboard() {
    const { showToast, showDemand } = useToast();
    const { socket, isConnected } = useWebSocket();
    const [instances, setInstances] = useState<any[]>([]);
    const [activities, setActivities] = useState<any[]>([]);
    const [dashboardStats, setDashboardStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');

    useEffect(() => {
        loadInstances();
        loadActivities();
        loadDashboardStats();
        
        // Polling moins fréquent pour les statuts d'instances (toutes les 10 secondes)
        const interval = setInterval(() => {
            loadInstances();
        }, 10000);
        
        return () => clearInterval(interval);
    }, [chartPeriod]);

    // WebSocket listener for real-time workflow updates
    useEffect(() => {
        if (!socket) return;

        console.log('🔌 Setting up WebSocket listeners');

        // Listen for workflow execution events
        socket.on('workflow:executed', (data) => {
            console.log('📥 Workflow executed event received:', data);
            
            // Add new activity to the top of the list
            const newActivity = {
                id: Date.now(), // Temporary ID
                action: 'workflow_executed',
                title: `Workflow: ${data.workflowName || 'Unknown'}`,
                description: `Exécution ${data.status === 'success' ? 'réussie' : 'en cours'}`,
                created_at: data.timestamp || new Date().toISOString(),
                metadata: {
                    workflow_id: data.workflowId,
                    workflow_name: data.workflowName,
                    execution_id: data.executionId,
                    status: data.status
                }
            };
            
            // Add to activities list (keep only 5 most recent)
            setActivities(prev => [newActivity, ...prev].slice(0, 5));
            
            // Reload stats
            loadDashboardStats();
            
            // Show toast notification
            showToast('success', `✅ ${data.workflowName || 'Workflow'} exécuté avec succès`);
        });

        return () => {
            socket.off('workflow:executed');
        };
    }, [socket]);

    const loadInstances = async () => {
        try {
            const result = await instancesApi.getInstances();
            setInstances(result.instances || []);
        } catch (error) {
            console.error('Error loading instances:', error);
        } finally {
            setLoading(false);
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

    const loadDashboardStats = async () => {
        try {
            const response = await fetch(`http://localhost:5000/instances/dashboard-stats?period=${chartPeriod}`, {
                credentials: 'include',
                cache: 'no-store'
            });
            const data = await response.json();
            console.log('📊 Dashboard stats loaded:', data);
            setDashboardStats(data);
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
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

    const handleStartStop = async (instanceId: number, currentStatus: string) => {
        try {
            // Optimistic update
            setInstances(prev => prev.map(inst => 
                inst.id === instanceId 
                    ? { ...inst, status: currentStatus === 'running' ? 'stopped' : 'running' }
                    : inst
            ));

            if (currentStatus === 'running') {
                await instancesApi.stopInstance(instanceId);
                showToast('success', 'Instance arrêtée avec succès');
            } else {
                await instancesApi.startInstance(instanceId);
                showToast('success', 'Instance démarrée avec succès');
            }
            
            // Refresh to get actual status
            setTimeout(() => loadInstances(), 500);
        } catch (error) {
            console.error('Error toggling instance:', error);
            showToast('danger', 'Erreur lors de l\'action sur l\'instance');
            // Revert on error
            loadInstances();
        }
    };

    const handleDelete = async (instanceId: number, instanceName: string) => {
        showDemand(
            `Êtes-vous sûr de vouloir supprimer l'instance "${instanceName}" ?\n\nCette action est irréversible et supprimera toutes les données associées.`,
            async () => {
                try {
                    // Optimistic update
                    setInstances(prev => prev.filter(inst => inst.id !== instanceId));
                    
                    await instancesApi.deleteInstance(instanceId);
                    showToast('success', 'Instance supprimée avec succès');
                    
                    // Refresh activities after delete
                    loadActivities();
                } catch (error) {
                    console.error('Error deleting instance:', error);
                    showToast('danger', 'Erreur lors de la suppression de l\'instance');
                    // Revert on error
                    loadInstances();
                }
            }
        );
    };

    const stats = [
        {
            label: 'Instances actives',
            value: dashboardStats?.instances?.running?.toString() || '0',
            change: '',
            trend: null,
            icon: <Server className="size-5" />,
            color: 'from-blue-500 to-cyan-500'
        },
        {
            label: 'Workflows exécutés',
            value: dashboardStats?.workflows?.total_executions?.toLocaleString() || '0',
            change: '+' + (dashboardStats?.workflows?.total_executions || 0),
            trend: 'up',
            icon: <Workflow className="size-5" />,
            color: 'from-orange-500 to-amber-500'
        },
        {
            label: 'Requêtes API',
            value: dashboardStats?.api?.total_requests?.toLocaleString() || '0',
            change: '+' + (dashboardStats?.api?.total_requests || 0),
            trend: 'up',
            icon: <Activity className="size-5" />,
            color: 'from-green-500 to-emerald-500'
        },
        {
            label: 'Temps moyen',
            value: (dashboardStats?.api?.avg_response_time || 0) + 'ms',
            change: dashboardStats?.api?.avg_response_time ? `${dashboardStats.api.avg_response_time}ms` : '0ms',
            trend: 'down',
            icon: <Zap className="size-5" />,
            color: 'from-purple-500 to-pink-500'
        }
    ];

    // Generate chart data from activity
    const generateChartData = () => {
        if (!dashboardStats?.activity) {
            const emptyData = chartPeriod === 'week' 
                ? [
                    { day: 'Lun', value: 0 },
                    { day: 'Mar', value: 0 },
                    { day: 'Mer', value: 0 },
                    { day: 'Jeu', value: 0 },
                    { day: 'Ven', value: 0 },
                    { day: 'Sam', value: 0 },
                    { day: 'Dim', value: 0 }
                ]
                : [
                    { day: 'S1', value: 0 },
                    { day: 'S2', value: 0 },
                    { day: 'S3', value: 0 },
                    { day: 'S4', value: 0 }
                ];
            return emptyData;
        }

        const today = new Date();
        const chartData = [];

        if (chartPeriod === 'week') {
            const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
            
            // Generate last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dayName = daysOfWeek[date.getDay()];
                const dateStr = date.toISOString().split('T')[0];

                // Find activity count for this date
                const activity = dashboardStats.activity.find(
                    (a: any) => a.activity_date && a.activity_date.split('T')[0] === dateStr
                );

                chartData.push({
                    day: dayName,
                    value: activity ? activity.activity_count : 0
                });
            }
        } else {
            // Generate 4 weeks for monthly view
            // week_number: 1 = cette semaine, 2 = semaine dernière, etc.
            // On inverse pour afficher S1 = plus ancienne, S4 = cette semaine
            for (let weekNum = 1; weekNum <= 4; weekNum++) {
                // Trouver l'activité pour cette semaine (on inverse: S1 cherche week_number 4, S4 cherche week_number 1)
                const dbWeekNumber = 5 - weekNum; // S1=4, S2=3, S3=2, S4=1
                const activity = dashboardStats.activity.find(
                    (a: any) => parseInt(a.week_number) === dbWeekNumber
                );

                chartData.push({
                    day: `S${weekNum}`,
                    value: activity ? parseInt(activity.activity_count) : 0
                });
            }
        }

        return chartData;
    };

    const chartData = generateChartData();
    const maxValue = Math.max(...chartData.map(d => d.value), 1); // Minimum 1 to avoid division by 0

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Vue d'ensemble</h1>
                    <p className="text-gray-400">Bienvenue sur votre tableau de bord LogicAI</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <div className={`size-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-gray-400">
                        {isConnected ? 'Temps réel actif' : 'Déconnecté'}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative group"
                    >
                        <div className="absolute inset-0 bg-linear-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl -z-10"
                            style={{ backgroundImage: `linear-gradient(to bottom right, var(--tw-gradient-stops))` }}
                        />
                        <div className="bg-bg-card border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-xl bg-linear-to-br ${stat.color}`}>
                                    {stat.icon}
                                </div>
                                {stat.trend && (
                                    <div className={`flex items-center gap-1 text-sm font-semibold ${
                                        stat.trend === 'up' ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                        {stat.trend === 'up' ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                                        {stat.change}
                                    </div>
                                )}
                            </div>
                            <div className="text-3xl font-bold mb-1">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.label}</div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Charts and Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Activity Chart */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="lg:col-span-2 bg-bg-card border border-white/10 rounded-2xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold mb-1">Activité des workflows</h2>
                            <p className="text-sm text-gray-400">
                                {chartPeriod === 'week' ? '7 derniers jours' : '30 derniers jours'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setChartPeriod('week')}
                                className={`px-3 py-1 rounded-lg text-sm font-semibold border transition-colors ${
                                    chartPeriod === 'week'
                                        ? 'bg-orange-500/10 text-orange-500 border-orange-500/30'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                Semaine
                            </button>
                            <button 
                                onClick={() => setChartPeriod('month')}
                                className={`px-3 py-1 rounded-lg text-sm font-semibold border transition-colors ${
                                    chartPeriod === 'month'
                                        ? 'bg-orange-500/10 text-orange-500 border-orange-500/30'
                                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                Mois
                            </button>
                        </div>
                    </div>
                    <div className="h-110 flex items-end justify-between gap-4">
                        {chartData.map((data, index) => (
                            <div key={index} className="flex-1 flex flex-col-reverse items-center gap-2">
                                <span className="text-xs text-gray-500 font-medium">
                                    {data.day}
                                </span>
                                <div className="w-full relative group">
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: data.value > 0 ? `${(data.value / maxValue) * 100}%` : '8px' }}
                                        transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
                                        className={`w-full bg-linear-to-t from-orange-500 to-amber-500 rounded-t-lg relative overflow-hidden ${
                                            data.value === 0 ? 'opacity-20 min-h-2' : 'min-h-10'
                                        }`}
                                    >
                                        <div className="absolute inset-0 bg-linear-to-t from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </motion.div>
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-bg-dark px-2 py-1 rounded text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                        {data.value} {data.value <= 1 ? 'activité' : 'activités'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Recent Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-bg-card border border-white/10 rounded-2xl p-6"
                >
                    <h2 className="text-xl font-bold mb-6">Activité récente</h2>
                    <div className="space-y-4">
                        {activities.length === 0 ? (
                            <div className="text-center py-8 text-gray-500 text-sm">
                                Aucune activité récente
                            </div>
                        ) : (
                            activities.map((activity) => {
                                const getActivityIcon = () => {
                                    switch (activity.action) {
                                        case 'instance_created':
                                            return <CheckCircle className="size-4 text-green-500" />;
                                        case 'instance_started':
                                            return <Play className="size-4 text-green-500" />;
                                        case 'instance_stopped':
                                            return <Pause className="size-4 text-yellow-500" />;
                                        case 'instance_restarted':
                                            return <RefreshCw className="size-4 text-blue-500" />;
                                        case 'instance_deleted':
                                            return <Trash2 className="size-4 text-red-500" />;
                                        case 'instance_error':
                                            return <AlertCircle className="size-4 text-red-500" />;
                                        case 'workflow_executed':
                                            return <Workflow className="size-4 text-blue-400" />;
                                        default:
                                            return <Activity className="size-4 text-gray-500" />;
                                    }
                                };

                                const getActivityColor = () => {
                                    switch (activity.action) {
                                        case 'instance_created':
                                        case 'instance_started':
                                            return 'bg-green-500/10';
                                        case 'instance_stopped':
                                            return 'bg-yellow-500/10';
                                        case 'instance_restarted':
                                        case 'workflow_executed':
                                            return 'bg-blue-500/10';
                                        case 'instance_deleted':
                                        case 'instance_error':
                                            return 'bg-red-500/10';
                                        default:
                                            return 'bg-gray-500/10';
                                    }
                                };

                                const getTimeAgo = (date: string) => {
                                    const now = new Date();
                                    const activityDate = new Date(date);
                                    const diffInMinutes = Math.floor((now.getTime() - activityDate.getTime()) / 60000);
                                    
                                    if (diffInMinutes < 1) return 'À l\'instant';
                                    if (diffInMinutes < 60) return `Il y a ${diffInMinutes} min`;
                                    
                                    const diffInHours = Math.floor(diffInMinutes / 60);
                                    if (diffInHours < 24) return `Il y a ${diffInHours}h`;
                                    
                                    const diffInDays = Math.floor(diffInHours / 24);
                                    return `Il y a ${diffInDays}j`;
                                };

                                // Parse metadata for workflow executions
                                let metadata = null;
                                if (activity.metadata) {
                                    try {
                                        metadata = typeof activity.metadata === 'string' 
                                            ? JSON.parse(activity.metadata) 
                                            : activity.metadata;
                                    } catch (e) {
                                        // Ignore parse errors
                                    }
                                }

                                return (
                                    <motion.div 
                                        key={activity.id} 
                                        className="flex items-start gap-3"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <div className={`p-2 rounded-lg ${getActivityColor()}`}>
                                            {getActivityIcon()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{activity.title}</p>
                                            <p className="text-xs text-gray-500 truncate">{activity.description}</p>
                                            
                                            {/* Show workflow execution details */}
                                            {activity.action === 'workflow_executed' && metadata && (
                                                <div className="flex gap-2 mt-1">
                                                    {metadata.status && (
                                                        <span className={`text-xs px-2 py-0.5 rounded ${
                                                            metadata.status === 'success' 
                                                                ? 'bg-green-500/20 text-green-400' 
                                                                : metadata.status === 'error'
                                                                ? 'bg-red-500/20 text-red-400'
                                                                : 'bg-yellow-500/20 text-yellow-400'
                                                        }`}>
                                                            {metadata.status === 'success' ? '✓ Succès' : metadata.status === 'error' ? '✗ Erreur' : '⟳ En cours'}
                                                        </span>
                                                    )}
                                                    {metadata.execution_id && (
                                                        <span className="text-xs text-gray-600">
                                                            #{metadata.execution_id}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <p className="text-xs text-gray-600 mt-1">{getTimeAgo(activity.created_at)}</p>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Instances Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-bg-card border border-white/10 rounded-2xl p-6"
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold">Vos instances</h2>
                    <button 
                        onClick={createInstance}
                        disabled={creating}
                        className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                    >
                        <Play className="size-4" />
                        {creating ? 'Création...' : 'Nouvelle instance'}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="text-center py-12 text-gray-400">Chargement...</div>
                    ) : instances.length === 0 ? (
                        <div className="text-center py-12">
                            <Server className="size-12 mx-auto mb-4 text-gray-600" />
                            <p className="text-gray-400 mb-4">Aucune instance créée</p>
                            <button 
                                onClick={createInstance}
                                disabled={creating}
                                className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                            >
                                <Play className="size-4" />
                                {creating ? 'Création...' : 'Créer ma première instance'}
                            </button>
                        </div>
                    ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Instance</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Status</th>
                                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Subdomain</th>
                                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {instances.map((instance) => (
                                <tr key={instance.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-linear-to-br from-orange-500/10 to-amber-500/10">
                                                <Server className="size-4 text-orange-500" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{instance.name}</div>
                                                <div className="text-xs text-gray-500">Port: {instance.docker_port || 'N/A'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`size-2 rounded-full transition-all ${
                                                instance.status === 'running' ? 'bg-green-500 animate-pulse' : 
                                                instance.status === 'creating' ? 'bg-yellow-500 animate-pulse' :
                                                instance.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                                            }`} />
                                            <span className="text-sm capitalize">
                                                {instance.status === 'running' ? 'En ligne' : 
                                                 instance.status === 'creating' ? 'Création...' :
                                                 instance.status === 'error' ? 'Erreur' : 'Arrêté'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <a 
                                                href={`https://${instance.subdomain}.logicai.fr`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-brand-orange hover:text-orange-400 transition-colors font-mono"
                                            >
                                                {instance.subdomain}.logicai.fr
                                            </a>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handleStartStop(instance.id, instance.status)}
                                                disabled={instance.status === 'creating'}
                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
                                                title={instance.status === 'running' ? 'Arrêter' : 'Démarrer'}
                                            >
                                                {instance.status === 'running' ? (
                                                    <Pause className="size-4" />
                                                ) : (
                                                    <Play className="size-4" />
                                                )}
                                            </button>
                                            <Link 
                                                to={`/dashboard/instances/${instance.uuid}`}
                                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                                title="Voir les détails"
                                            >
                                                <ArrowRight className="size-4" />
                                            </Link>
                                            <button 
                                                onClick={() => handleDelete(instance.id, instance.name)}
                                                className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    )}
                </div>
            </motion.div>
        </div>
    );
}