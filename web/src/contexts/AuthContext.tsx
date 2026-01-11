import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { api } from '../api/auth';

interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    discord_id?: string;
    subscription_plan?: string;
    has_completed_onboarding?: boolean;
    role?: 'user' | 'support' | 'admin';
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<any>;
    register: (name: string, email: string, password: string) => Promise<any>;
    logout: () => Promise<void>;
    checkAuth: () => Promise<void>;
    completeOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const result = await api.me();
            if (result.user) {
                setUser(result.user);
            } else {
                setUser(null);
            }
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const login = async (email: string, password: string) => {
        const result = await api.login(email, password);
        if (result.user) {
            setUser(result.user);
        }
        return result;
    };

    const register = async (name: string, email: string, password: string) => {
        const result = await api.register(name, email, password);
        if (result.user) {
            setUser(result.user);
        }
        return result;
    };

    const logout = async () => {
        await api.logout();
        setUser(null);
    };

    const completeOnboarding = async () => {
        try {
            await api.completeOnboarding();
            if (user) {
                setUser({ ...user, has_completed_onboarding: true });
            }
        } catch (error) {
            console.error('Error completing onboarding:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth, completeOnboarding }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
