import { useParams, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Loader2, CheckCircle, XCircle, Users, Server } from 'lucide-react';
import { membersApi } from '../api/members';
import { useToast } from '../contexts/ToastContext';

export default function AcceptInvitation() {
    const { token } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [invitation, setInvitation] = useState<any>(null);
    const [error, setError] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [isNewUser, setIsNewUser] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Form state for new users
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        checkAuthAndLoadInvitation();
    }, [token]);

    const checkAuthAndLoadInvitation = async () => {
        if (!token) {
            navigate('/');
            return;
        }

        // Check if user is authenticated
        try {
            const authResponse = await fetch('http://localhost:5000/auth/me', {
                credentials: 'include'
            });
            setIsAuthenticated(authResponse.ok);
        } catch (err) {
            setIsAuthenticated(false);
        }

        // Load invitation details
        try {
            const response = await fetch(`http://localhost:5000/members/invitation/${token}`);
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Cette invitation n\'est pas valide ou a expiré.');
                setLoading(false);
                return;
            }

            setInvitation(data.invitation);
            
            // Check if invitation email matches an existing user
            const invitationEmail = data.invitation.email;
            
            // Try to find if a user with this email exists
            try {
                const userCheckResponse = await fetch(`http://localhost:5000/members/search?q=${encodeURIComponent(invitationEmail)}`, {
                    credentials: 'include'
                });
                
                if (userCheckResponse.ok) {
                    const userData = await userCheckResponse.json();
                    const existingUser = userData.users?.find((u: any) => u.email === invitationEmail);
                    setIsNewUser(!existingUser);
                } else {
                    setIsNewUser(true);
                }
            } catch (err) {
                // If search fails, assume new user
                setIsNewUser(true);
            }
        } catch (err: any) {
            console.error('Error loading invitation:', err);
            setError('Impossible de charger l\'invitation. Veuillez réessayer.');
            setLoading(false);
        }
    };

    const handleAccept = async (e: React.FormEvent) => {
        e.preventDefault();

        // If user exists but not authenticated, redirect to login
        if (!isNewUser && !isAuthenticated) {
            showToast('info', 'Veuillez vous connecter pour accepter l\'invitation');
            navigate('/login?email=' + encodeURIComponent(invitation.email) + '&redirect=/accept-invitation/' + token);
            return;
        }

        if (isNewUser && !isAuthenticated) {
            // Validation for new users
            if (!name.trim()) {
                showToast('danger', 'Veuillez entrer votre nom');
                return;
            }
            if (password.length < 8) {
                showToast('danger', 'Le mot de passe doit contenir au moins 8 caractères');
                return;
            }
            if (password !== confirmPassword) {
                showToast('danger', 'Les mots de passe ne correspondent pas');
                return;
            }
        }

        setSubmitting(true);

        try {
            if (isNewUser && !isAuthenticated) {
                // Create new account and accept invitation
                const response = await fetch('http://localhost:5000/members/accept-invitation-new', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        name,
                        password
                    }),
                    credentials: 'include'
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Erreur lors de l\'acceptation');
                }

                showToast('success', 'Compte créé avec succès ! Connexion...');
                
                // Auto-login after account creation
                const loginResponse = await fetch('http://localhost:5000/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: invitation.email,
                        password: password
                    }),
                    credentials: 'include'
                });

                if (!loginResponse.ok) {
                    showToast('warning', 'Compte créé. Veuillez vous connecter.');
                    navigate('/login?email=' + encodeURIComponent(invitation.email));
                    return;
                }

                showToast('success', 'Bienvenue ! Redirection vers l\'instance...');
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            } else {
                // Existing user - accept invitation
                await membersApi.acceptInvitation(token!);
                showToast('success', 'Invitation acceptée ! Redirection vers l\'instance...');
                
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1500);
            }
        } catch (err: any) {
            console.error('Error accepting invitation:', err);
            showToast('danger', err.message || 'Erreur lors de l\'acceptation');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="size-12 animate-spin text-brand-orange mx-auto mb-4" />
                    <p className="text-gray-400">Chargement de l'invitation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full bg-bg-card border border-red-500/20 rounded-2xl p-8 text-center"
                >
                    <XCircle className="size-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Invitation Invalide</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        Retour à l'accueil
                    </button>
                </motion.div>
            </div>
        );
    }

    if (!invitation) {
        return null;
    }

    return (
        <div className="min-h-screen bg-bg-main flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-lg w-full"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center size-20 rounded-full bg-linear-to-br from-orange-500 to-amber-500 mb-4">
                        <Mail className="size-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Invitation à rejoindre
                    </h1>
                    <div className="flex items-center justify-center gap-2 text-xl text-gray-400">
                        <Server className="size-5" />
                        <span className="font-semibold text-brand-orange">{invitation.instance_name}</span>
                    </div>
                </div>

                {/* Invitation Card */}
                <div className="bg-bg-card border border-white/10 rounded-2xl p-8 mb-6">
                    <div className="text-center mb-6">
                        <p className="text-gray-400 mb-2">Vous avez été invité par</p>
                        <p className="text-xl font-semibold text-white">{invitation.inviter_name}</p>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4 mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Email</span>
                            <span className="text-sm font-mono text-white">{invitation.email}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">Rôle</span>
                            <span className="text-sm font-semibold text-brand-orange capitalize">
                                {invitation.role === 'admin' && 'Administrateur'}
                                {invitation.role === 'editor' && 'Éditeur'}
                                {invitation.role === 'viewer' && 'Lecteur'}
                            </span>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleAccept} className="space-y-4">
                        {!isNewUser && !isAuthenticated && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                                <p className="text-sm text-yellow-400 flex items-center gap-2 mb-3">
                                    <Users className="size-4" />
                                    Un compte existe déjà avec cet email. Connectez-vous pour accepter l'invitation.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate('/login?email=' + encodeURIComponent(invitation.email) + '&redirect=/accept-invitation/' + token)}
                                    className="w-full py-3 bg-brand-orange hover:bg-orange-600 text-white font-semibold rounded-lg transition-all"
                                >
                                    Se connecter
                                </button>
                            </div>
                        )}

                        {isNewUser && !isAuthenticated && (
                            <>
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
                                    <p className="text-sm text-blue-400 flex items-center gap-2">
                                        <Users className="size-4" />
                                        Créez votre compte pour rejoindre l'instance
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Nom complet
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/50 text-white"
                                        placeholder="Votre nom"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/50 text-white"
                                        placeholder="Minimum 8 caractères"
                                        minLength={8}
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Confirmer le mot de passe
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange/50 text-white"
                                        placeholder="Confirmez votre mot de passe"
                                        minLength={8}
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {!isNewUser && isAuthenticated && (
                            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
                                <p className="text-sm text-green-400 flex items-center gap-2">
                                    <CheckCircle className="size-4" />
                                    Vous êtes connecté. Cliquez pour accepter l'invitation.
                                </p>
                            </div>
                        )}

                        {((isNewUser && !isAuthenticated) || (isAuthenticated)) && (
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-4 bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="size-5 animate-spin" />
                                        {isNewUser ? 'Création du compte...' : 'Acceptation...'}
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="size-5" />
                                        {isNewUser ? 'Créer mon compte et rejoindre' : 'Accepter l\'invitation'}
                                    </>
                                )}
                            </button>
                        )}
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => navigate('/')}
                            className="text-sm text-gray-400 hover:text-white transition-colors"
                        >
                            Retour à l'accueil
                        </button>
                    </div>
                </div>

                {/* Info */}
                <div className="text-center text-sm text-gray-500">
                    <p>En acceptant cette invitation, vous acceptez les conditions d'utilisation de LogicAI</p>
                </div>
            </motion.div>
        </div>
    );
}
