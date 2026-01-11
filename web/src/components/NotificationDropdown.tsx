import { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, X, Mail, Users, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { membersApi } from '../api/members';
import { useToast } from '../contexts/ToastContext';

interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    metadata: any;
    is_read: boolean;
    created_at: string;
}

interface Activity {
    id: number;
    action: string;
    title: string;
    description: string;
    created_at: string;
}

interface NotificationDropdownProps {
    activities?: Activity[];
}

export default function NotificationDropdown({ activities = [] }: NotificationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [showActivities, setShowActivities] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { showToast } = useToast();

    useEffect(() => {
        loadNotifications();
        
        // Reload notifications every 30 seconds
        const interval = setInterval(() => {
            loadNotifications();
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const loadNotifications = async () => {
        try {
            const { notifications: notifs } = await membersApi.getNotifications();
            setNotifications(notifs || []);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    };

    const handleMarkAsRead = async (notificationId: number) => {
        try {
            await membersApi.markNotificationAsRead(notificationId);
            setNotifications(prev => 
                prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const handleDeleteNotification = async (notificationId: number) => {
        try {
            await membersApi.deleteNotification(notificationId);
            setNotifications(prev => prev.filter(n => n.id !== notificationId));
            showToast('success', 'Notification supprimée');
        } catch (error) {
            console.error('Error deleting notification:', error);
            showToast('danger', 'Erreur lors de la suppression');
        }
    };

    const handleAcceptInvitation = async (notification: Notification) => {
        if (!notification.metadata?.invitation_token) {
            showToast('danger', 'Token d\'invitation manquant');
            return;
        }

        setLoading(true);
        try {
            await membersApi.acceptInvitation(notification.metadata.invitation_token);
            showToast('success', 'Invitation acceptée ! Vous avez accès à l\'instance.');
            
            // Mark as read and reload
            await handleMarkAsRead(notification.id);
            await loadNotifications();
            
            // Reload page to show new instance
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error: any) {
            showToast('danger', error.message || 'Erreur lors de l\'acceptation');
        } finally {
            setLoading(false);
        }
    };

    const handleDeclineInvitation = async (notification: Notification) => {
        if (!notification.metadata?.invitation_token) {
            showToast('danger', 'Token d\'invitation manquant');
            return;
        }

        setLoading(true);
        try {
            await membersApi.declineInvitation(notification.metadata.invitation_token);
            showToast('info', 'Invitation refusée.');
            
            // Mark as read and reload
            await handleMarkAsRead(notification.id);
            await loadNotifications();
        } catch (error: any) {
            showToast('danger', error.message || 'Erreur lors du refus');
        } finally {
            setLoading(false);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'invitation':
                return <Mail className="size-5 text-blue-400" />;
            case 'member_added':
                return <Users className="size-5 text-green-400" />;
            case 'member_removed':
                return <Trash2 className="size-5 text-red-400" />;
            default:
                return <Bell className="size-5 text-gray-400" />;
        }
    };

    const formatTimeAgo = (date: string) => {
        const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
        
        if (seconds < 60) return 'À l\'instant';
        if (seconds < 3600) return `Il y a ${Math.floor(seconds / 60)} min`;
        if (seconds < 86400) return `Il y a ${Math.floor(seconds / 3600)} h`;
        return `Il y a ${Math.floor(seconds / 86400)} j`;
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Notification Bell Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
                <Bell className="size-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 size-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 mt-2 w-96 bg-bg-card border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                            <h3 className="font-semibold text-white">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="text-xs text-gray-400">
                                    {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {/* Notifications List */}
                        <div className="max-h-96 overflow-y-auto">
                            {notifications.length === 0 ? (
                                <div className="px-4 py-8 text-center text-gray-500">
                                    <Bell className="size-12 mx-auto mb-3 text-gray-600" />
                                    <p className="text-sm">Aucune notification</p>
                                </div>
                            ) : (
                                notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors ${
                                            !notification.is_read ? 'bg-blue-500/5' : ''
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Icon */}
                                            <div className="shrink-0 mt-0.5">
                                                {getNotificationIcon(notification.type)}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-1">
                                                    <h4 className="font-medium text-white text-sm">
                                                        {notification.title}
                                                    </h4>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {!notification.is_read && (
                                                            <div className="size-2 rounded-full bg-blue-500" />
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteNotification(notification.id);
                                                            }}
                                                            className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                                                            title="Supprimer la notification"
                                                        >
                                                            <X className="size-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-400 mb-2">
                                                    {notification.message}
                                                </p>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-gray-500">
                                                        {formatTimeAgo(notification.created_at)}
                                                    </span>
                                                    
                                                    {/* Action buttons */}
                                                    <div className="flex items-center gap-2">
                                                        {notification.type === 'invitation' && !notification.is_read && (
                                                            <>
                                                                <button
                                                                    onClick={() => handleAcceptInvitation(notification)}
                                                                    disabled={loading}
                                                                    className="text-xs px-3 py-1 bg-brand-orange hover:bg-orange-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                                                                >
                                                                    <CheckCircle className="size-3" />
                                                                    Accepter
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeclineInvitation(notification)}
                                                                    disabled={loading}
                                                                    className="text-xs px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                                                                >
                                                                    <X className="size-3" />
                                                                    Refuser
                                                                </button>
                                                            </>
                                                        )}
                                                        {!notification.is_read && notification.type !== 'invitation' && (
                                                            <button
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                                className="text-xs px-2 py-1 text-gray-400 hover:text-white transition-colors"
                                                                title="Marquer comme lu"
                                                            >
                                                                <CheckCircle className="size-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                            
                            {/* Activities Section */}
                            {activities.length > 0 && (
                                <>
                                    <button
                                        onClick={() => setShowActivities(!showActivities)}
                                        className="w-full px-4 py-2 bg-white/5 border-t border-white/10 flex items-center justify-between hover:bg-white/10 transition-colors"
                                    >
                                        <p className="text-xs font-semibold text-gray-400">ACTIVITÉS RÉCENTES</p>
                                        {showActivities ? (
                                            <ChevronUp className="size-4 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="size-4 text-gray-400" />
                                        )}
                                    </button>
                                    {showActivities && activities.slice(0, 3).map((activity) => (
                                        <div
                                            key={`activity-${activity.id}`}
                                            className="px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5">
                                                    {getNotificationIcon('activity')}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-white mb-0.5">
                                                        {activity.title}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mb-1">
                                                        {activity.description}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatTimeAgo(activity.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {notifications.length > 0 && (
                            <div className="px-4 py-3 border-t border-white/10 text-center">
                                <button
                                    onClick={loadNotifications}
                                    className="text-xs text-gray-400 hover:text-white transition-colors"
                                >
                                    Actualiser
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
