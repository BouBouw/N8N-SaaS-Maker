import { createContext, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
    id: string;
    type: 'success' | 'warning' | 'danger' | 'info';
    message: string;
    duration?: number;
}

interface DemandToast {
    id: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

interface ToastContextType {
    showToast: (type: Toast['type'], message: string, duration?: number) => void;
    showDemand: (message: string, onConfirm: () => void, onCancel?: () => void) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [demands, setDemands] = useState<DemandToast[]>([]);

    const showToast = (type: Toast['type'], message: string, duration: number = 5000) => {
        const id = Math.random().toString(36).substring(7);
        const toast: Toast = { id, type, message, duration };
        
        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, duration);
        }
    };

    const showDemand = (message: string, onConfirm: () => void, onCancel?: () => void) => {
        const id = Math.random().toString(36).substring(7);
        const demand: DemandToast = {
            id,
            message,
            onConfirm: () => {
                onConfirm();
                setDemands(prev => prev.filter(d => d.id !== id));
            },
            onCancel: () => {
                onCancel?.();
                setDemands(prev => prev.filter(d => d.id !== id));
            }
        };
        
        setDemands(prev => [...prev, demand]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const getToastIcon = (type: Toast['type']) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="size-5" />;
            case 'warning':
                return <AlertTriangle className="size-5" />;
            case 'danger':
                return <AlertCircle className="size-5" />;
            case 'info':
                return <Info className="size-5" />;
        }
    };

    const getToastColors = (type: Toast['type']) => {
        switch (type) {
            case 'success':
                return 'bg-green-500/10 border-green-500/30 text-green-400';
            case 'warning':
                return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
            case 'danger':
                return 'bg-red-500/10 border-red-500/30 text-red-400';
            case 'info':
                return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, showDemand }}>
            {children}
            
            {/* Toast Container - Bottom Right */}
            <div className="fixed bottom-4 right-4 z-9999 space-y-2 max-w-md">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 100, scale: 0.8 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.8 }}
                            className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-xl ${getToastColors(toast.type)}`}
                        >
                            <span className="shrink-0 mt-0.5">
                                {getToastIcon(toast.type)}
                            </span>
                            <p className="flex-1 text-sm font-medium">{toast.message}</p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="shrink-0 hover:bg-white/10 rounded p-1 transition-colors"
                            >
                                <X className="size-4" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Demand Toasts (Confirmation dialogs) */}
                <AnimatePresence>
                    {demands.map((demand) => (
                        <motion.div
                            key={demand.id}
                            initial={{ opacity: 0, x: 100, scale: 0.8 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 100, scale: 0.8 }}
                            className="bg-bg-card/95 border border-white/20 backdrop-blur-xl p-4 rounded-lg shadow-2xl"
                        >
                            <div className="flex items-start gap-3 mb-4">
                                <AlertCircle className="size-5 text-orange-500 shrink-0 mt-0.5" />
                                <p className="flex-1 text-sm font-medium text-white">{demand.message}</p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={demand.onCancel}
                                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={demand.onConfirm}
                                    className="px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                                >
                                    Confirmer
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
