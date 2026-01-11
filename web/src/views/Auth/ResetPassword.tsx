import { motion } from 'motion/react';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../api/auth';

export default function ResetPassword() {
    const [email, setEmail] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await api.requestPasswordReset(email);
            if (result.error) {
                setError(result.error);
            } else {
                setIsSubmitted(true);
            }
        } catch (err) {
            setError('Erreur de connexion au serveur');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-dark text-white flex items-center justify-center p-4">
            {/* Background Effects */}
            <div className="absolute top-1/4 left-1/2 w-125 h-125 bg-orange-500/10 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/2 w-125 h-125 bg-amber-500/10 blur-[120px] rounded-full pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative w-full max-w-md"
            >
                {/* Back Button */}
                <Link to="/login" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8">
                    <ArrowLeft className="size-4" />
                    <span className="text-sm">Retour à la connexion</span>
                </Link>

                {/* Card */}
                <div className="bg-bg-card border border-border-dark rounded-2xl p-8 shadow-2xl">
                    {!isSubmitted ? (
                        <>
                            {/* Header */}
                            <div className="mb-8">
                                <h1 className="text-3xl font-bold mb-2">Mot de passe oublié ?</h1>
                                <p className="text-gray-400">
                                    Entrez votre email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
                                </p>
                            </div>

                            {error && (
                                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium mb-2">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-500" />
                                        <input
                                            type="email"
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-11 py-3 focus:outline-none focus:border-brand-blue transition-colors"
                                            placeholder="votre@email.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-brand-blue hover:bg-brand-hover text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-[0_4px_14px_0_rgba(0,112,255,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <>
                            {/* Success State */}
                            <div className="text-center">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ duration: 0.5, type: 'spring' }}
                                    className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-6"
                                >
                                    <CheckCircle className="size-8 text-green-500" />
                                </motion.div>
                                <h1 className="text-2xl font-bold mb-3">Email envoyé !</h1>
                                <p className="text-gray-400 mb-8">
                                    Nous avons envoyé un lien de réinitialisation à <span className="text-white font-semibold">{email}</span>
                                </p>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6">
                                    <p className="text-sm text-gray-400 leading-relaxed">
                                        <strong className="text-white">Vous n'avez pas reçu l'email ?</strong><br />
                                        Vérifiez votre dossier spam ou{' '}
                                        <button
                                            onClick={() => setIsSubmitted(false)}
                                            className="text-brand-blue hover:text-brand-hover transition-colors"
                                        >
                                            réessayez
                                        </button>
                                    </p>
                                </div>
                                <Link
                                    to="/login"
                                    className="inline-block w-full bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-lg font-semibold transition-all border border-white/10"
                                >
                                    Retour à la connexion
                                </Link>
                            </div>
                        </>
                    )}

                    {/* Footer */}
                    {!isSubmitted && (
                        <p className="text-center text-sm text-gray-400 mt-6">
                            Vous vous souvenez de votre mot de passe ?{' '}
                            <Link to="/login" className="text-brand-blue hover:text-brand-hover transition-colors font-semibold">
                                Se connecter
                            </Link>
                        </p>
                    )}
                </div>
            </motion.div>
        </div>
    );
}