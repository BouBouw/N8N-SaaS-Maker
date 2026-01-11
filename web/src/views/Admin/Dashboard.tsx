import { useEffect, useState } from 'react';
import { Users, Server, Workflow, TrendingUp, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '../../contexts/ToastContext';
import { adminApi } from '../../api/admin';

export default function AdminDashboard() {
    const { showToast } = useToast();
    const [stats, setStats] = useState<any>(null);
    const [recentActivities, setRecentActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            const data = await adminApi.getStats();
            setStats(data.stats);
            setRecentActivities(data.recentActivities || []);
        } catch (error: any) {
            showToast('danger', error.response?.data?.error || 'Erreur lors du chargement des statistiques');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-orange"></div>
            </div>
        );
    }

    const statCards = [
        {
            title: 'Utilisateurs',
            value: stats?.totalUsers || 0,
            icon: <Users className="size-8" />,
            color: 'from-blue-500 to-cyan-500',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/30'
        },
        {
            title: 'Instances',
            value: stats?.totalInstances || 0,
            subtitle: `${stats?.runningInstances || 0} actives`,
            icon: <Server className="size-8" />,
            color: 'from-green-500 to-emerald-500',
            bgColor: 'bg-green-500/10',
            borderColor: 'border-green-500/30'
        },
        {
            title: 'Workflows',
            value: stats?.totalWorkflows || 0,
            icon: <Workflow className="size-8" />,
            color: 'from-purple-500 to-pink-500',
            bgColor: 'bg-purple-500/10',
            borderColor: 'border-purple-500/30'
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold mb-2">Vue d'ensemble</h1>
                <p className="text-gray-400">Statistiques globales de la plateforme</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {statCards.map((card, index) => (
                    <motion.div
                        key={card.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`${card.bgColor} border ${card.borderColor} rounded-xl p-6`}
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className={`p-3 rounded-lg bg-linear-to-br ${card.color}`}>
                                {card.icon}
                            </div>
                            <TrendingUp className="size-5 text-green-400" />
                        </div>
                        <h3 className="text-gray-400 text-sm mb-1">{card.title}</h3>
                        <p className="text-3xl font-bold mb-1">{card.value}</p>
                        {card.subtitle && (
                            <p className="text-xs text-gray-500">{card.subtitle}</p>
                        )}
                    </motion.div>
                ))}
            </div>

            {/* Users by Plan */}
            {stats?.usersByPlan && stats.usersByPlan.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-bg-card border border-white/10 rounded-xl p-6"
                >
                    <h2 className="text-xl font-bold mb-4">Répartition des abonnements</h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {stats.usersByPlan.map((item: any) => (
                            <div key={item.plan} className="bg-white/5 rounded-lg p-4">
                                <p className="text-sm text-gray-400 mb-1">
                                    {item.plan === 'free' ? 'Gratuit' : 
                                     item.plan === 'pro' ? 'Pro' :
                                     item.plan === 'business' ? 'Business' : item.plan}
                                </p>
                                <p className="text-2xl font-bold">{item.count}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Recent Activities */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-bg-card border border-white/10 rounded-xl p-6"
            >
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="size-5 text-brand-orange" />
                    <h2 className="text-xl font-bold">Activités récentes</h2>
                </div>
                <div className="space-y-3">
                    {recentActivities.length === 0 ? (
                        <p className="text-gray-500 text-sm">Aucune activité récente</p>
                    ) : (
                        recentActivities.map((activity) => {
                            const metadata = activity.metadata ? JSON.parse(activity.metadata) : null;
                            return (
                                <div
                                    key={activity.id}
                                    className="flex items-start gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                                >
                                    <div className="p-2 rounded-lg bg-purple-500/20">
                                        <Workflow className="size-4 text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{activity.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {activity.user_name} ({activity.user_email})
                                        </p>
                                        {metadata && (
                                            <div className="flex gap-2 mt-1">
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                    metadata.status === 'success' 
                                                        ? 'bg-green-500/20 text-green-400' 
                                                        : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                    {metadata.status === 'success' ? '✓ Succès' : '✗ Erreur'}
                                                </span>
                                                {metadata.execution_id && (
                                                    <span className="text-xs text-gray-600">#{metadata.execution_id.slice(0, 8)}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-xs text-gray-500 whitespace-nowrap">
                                        {new Date(activity.created_at).toLocaleDateString('fr-FR', {
                                            day: '2-digit',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </motion.div>
        </div>
    );
}
