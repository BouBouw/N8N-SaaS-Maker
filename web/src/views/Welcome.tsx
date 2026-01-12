import { motion } from 'motion/react';
import {
    ArrowRight,
    Check,
    Zap,
    BarChart3,
    Globe,
    Shield,
    Plus,
    Minus,
    LogOut,
    LayoutDashboard,
    Loader2
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getAvatarUrl } from '../utils/avatar';
import { stripe } from '../api/stripe';
import { useToast } from '../contexts/ToastContext';

// --- Constants & Data ---

const NAV_LINKS = [
    { label: "Fonctionnalités", anchor: "features" },
    { label: "Témoignages", anchor: "testimonials" },
    { label: "Tarifs", anchor: "pricing" },
    { label: "FAQ", anchor: "faq" }
];

const LOGOS = [
    "/partners/1.png",
    "/partners/2.png",
    "/partners/3.png",
];

const FEATURES = [
    {
        title: "IA Make intégrée",
        desc: "Générez des workflows N8N complets à partir d'un simple prompt grâce à notre IA.",
        icon: <Zap className="text-yellow-400" />,
        colSpan: "col-span-1 md:col-span-2",
        bg: "bg-linear-to-br from-white/5 to-white/0"
    },
    {
        title: "Monitoring en temps réel",
        desc: "Surveillez toutes vos instances N8N depuis un tableau de bord unifié.",
        icon: <BarChart3 className="text-blue-400" />,
        colSpan: "col-span-1",
        bg: "bg-linear-to-br from-blue-500/10 to-purple-500/5"
    },
    {
        title: "API complète",
        desc: "Exportez et gérez vos workflows via notre API (JS, TS, Python).",
        icon: <Globe className="text-green-400" />,
        colSpan: "col-span-1",
        bg: "bg-linear-to-br from-green-500/10 to-emerald-500/5"
    },
    {
        title: "Infrastructure haute performance",
        desc: "Serveurs optimisés avec jusqu'à 16 Go RAM et 6 To de bande passante.",
        icon: <Shield className="text-purple-400" />,
        colSpan: "col-span-1 md:col-span-2",
        bg: "bg-linear-to-br from-purple-500/10 to-pink-500/5"
    }
];

const FAQS = [
    { q: "Puis-je héberger plusieurs instances N8N ?", a: "Oui, selon votre plan vous pouvez héberger de 1 à 10 instances N8N simultanément." },
    { q: "L'API est-elle disponible sur tous les plans ?", a: "L'API est disponible uniquement sur les plans Pro et Business. Chaque instance dispose de sa propre clé API." },
    { q: "Comment fonctionne l'IA Make ?", a: "Notre IA Make vous permet de générer des workflows N8N complets à partir d'un prompt, ou de créer des prompts optimisés pour vos agents IA." },
    { q: "Puis-je migrer mes workflows existants ?", a: "Absolument. Vous pouvez importer vos workflows N8N existants et utiliser notre API pour les exporter dans différents langages (JS, TS, Python)." }
];

const STEPS = [
    {
        id: "01",
        title: "Créez votre instance N8N",
        desc: "Choisissez votre plan et déployez une ou plusieurs instances N8N en quelques clics. Configuration automatique incluse.",
        color: "text-orange-500",
        bg: "bg-orange-500/10"
    },
    {
        id: "02",
        title: "Générez vos workflows avec l'IA",
        desc: "Utilisez notre IA Make pour créer des workflows complets à partir d'un prompt. Ou créez des prompts optimisés pour vos agents IA.",
        color: "text-orange-500",
        bg: "bg-orange-500/10"
    },
    {
        id: "03",
        title: "Exportez via l'API",
        desc: "Intégrez vos workflows dans vos applications via notre API complète. Support JavaScript, TypeScript, Python et package NPM à venir.",
        color: "text-orange-500",
        bg: "bg-orange-500/10"
    }
];

// --- Components ---

function Navbar({ activeSection }: { activeSection: string }) {
    const [isScrolled, setIsScrolled] = useState(false);
    const { user, logout } = useAuth();
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 0);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLogout = async () => {
        await logout();
        window.location.href = '/';
    };

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'backdrop-blur-md bg-black/50' : 'bg-transparent'}`}>
            <div className="flex items-center justify-between px-6 py-4 mx-auto max-w-7xl">
                <div className="flex items-center gap-2">
                    <div className="size-8 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src="/LogicAI.ico" alt="LogicAI" className="size-full object-contain" />
                    </div>
                    <span className="text-lg font-bold tracking-tight">LogicAI</span>
                </div>

                <div className="hidden md:flex items-center gap-8">
                    {NAV_LINKS.map(link => (
                        <a 
                            key={link.anchor} 
                            href={`#${link.anchor}`}
                            onClick={(e) => {
                                e.preventDefault();
                                document.getElementById(link.anchor)?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className={`text-sm font-medium transition-colors ${
                                activeSection === link.anchor ? 'text-orange-500' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                <div className="flex items-center gap-4">
                    {user ? (
                        <>
                            <div className="relative">
                                <button
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    className="flex items-center justify-end gap-2 hover:bg-white/5 px-3 py-2 rounded-lg transition-all w-48"
                                >
                                    <span className="hidden md:block text-sm font-medium">{user.name}</span>
                                    {getAvatarUrl(user.avatar, user.discord_id) ? (
                                        <img src={getAvatarUrl(user.avatar, user.discord_id)!} alt={user.name} className="size-8 rounded-full border border-white/10" />
                                    ) : (
                                        <div className="size-8 rounded-full bg-linear-to-br from-orange-500 to-amber-500 flex items-center justify-center text-sm font-semibold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </button>
                                {showDropdown && (
                                    <div className="absolute right-0 mt-1 w-48 bg-bg-card border border-white/10 rounded-lg shadow-2xl py-2 z-50">
                                        <div className="px-4 py-2 border-b border-white/10">
                                            <p className="text-sm font-medium">{user.name}</p>
                                            <p className="text-xs text-gray-500">{user.email}</p>
                                        </div>
                                        <a href="/dashboard" className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-white/5 transition-colors">
                                            <LayoutDashboard className="size-4" />
                                            Tableau de bord
                                        </a>
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
                        </>
                    ) : (
                        <>
                            <a href="/login" className="hidden md:block text-sm font-medium hover:text-white transition-colors text-gray-400">Connexion</a>
                            <a href="/register" className="bg-brand-blue hover:bg-brand-hover text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-[0_4px_14px_0_rgba(0,112,255,0.3)] cursor-pointer">
                                Commencer
                            </a>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}

function Hero() {
    const { user } = useAuth();
    const [totalInstances, setTotalInstances] = useState<number>(0);
    
    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/stats/public`);
                if (response.ok) {
                    const data = await response.json();
                    setTotalInstances(data.totalInstances);
                }
            } catch (error) {
                console.error('Error fetching stats:', error);
            }
        };
        fetchStats();
    }, []);
    
    return (
        <section id="hero" className="relative min-h-screen overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-1/4 right-1/3 w-200 h-200 bg-orange-600/20 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute top-1/3 right-1/4 w-200 h-200 bg-amber-600/15 blur-[120px] rounded-full pointer-events-none" />

            <div className="max-w-8xl mx-auto px-8 pt-50 pb-20 relative z-10">
                <div className="flex flex-col lg:flex-row items-center justify-center gap-32">
                    {/* Left Content */}
                    <div className="space-y-8 pt-12 shrink-0">
                        {/* Main Heading */}
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]"
                        >
                            <div className="text-white">Hébergement N8N</div>
                            <div className="text-white">avec <span className="text-gray-500">IA intégrée</span></div>
                            <div><span className="text-transparent bg-clip-text bg-linear-to-r from-orange-500 to-amber-500">Simple</span> <span className="text-gray-500">& Puissant</span></div>
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="text-lg text-gray-400 max-w-xl leading-relaxed"
                        >
                            Déployez et gérez vos instances N8N en quelques clics. IA Make intégrée pour générer vos workflows automatiquement. API complète disponible.
                        </motion.p>

                        {/* CTA Buttons */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                            className="flex flex-wrap items-center gap-4"
                        >
                            <a href={user ? "/dashboard" : "/register"} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 shadow-[0_4px_14px_0_rgba(37,99,235,0.4)] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.5)]">
                                Commencer gratuitement
                            </a>
                            <button className="px-6 py-3 rounded-lg font-semibold text-white hover:bg-white/5 transition-all flex items-center gap-2 border border-transparent hover:border-white/10">
                                Regarder une démo
                                <ArrowRight className="size-4" />
                            </button>
                        </motion.div>

                        {/* Trust Badge */}
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="text-sm text-gray-500"
                        >
                            Déjà <span className="text-orange-500 font-semibold">{totalInstances || 0}+</span> instances N8N déployées
                        </motion.p>
                    </div>

                    {/* Right - Dashboard Mockup */}
                    <motion.div
                        initial={{ opacity: 0, x: 40, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="relative shrink-0 w-full lg:w-150"
                    >
                        <div className="relative rounded-xl overflow-hidden shadow-2xl">
                            <img 
                                src="/Hero.png" 
                                alt="Dashboard Preview"
                                className="w-full h-auto"
                            />
                            {/* Dashboard Glow */}
                            <div className="absolute -inset-20 bg-linear-to-br from-blue-600/20 via-transparent to-purple-600/20 blur-3xl -z-10 opacity-40" />
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

function SocialProof() {
    return (
        <section className="py-12 bg-black/50 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 flex items-center gap-18">
                <div className="text-sm font-medium text-gray-500 whitespace-nowrap shrink-0">
                    <div>Plus de <span className="text-amber-500">3+</span> équipes</div>
                    <div>nous font confiance pour leurs workflows.</div>
                </div>
                <div className="relative flex w-full overflow-hidden mask-linear-fade">
                    <motion.div
                        animate={{ x: ["0%", "-33.33%"] }}
                        transition={{ duration: 60, repeat: Infinity, ease: "linear", repeatType: "loop" }}
                        className="flex items-center gap-16 min-w-max px-8"
                    >
                        {[...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS, ...LOGOS].map((logo, i) => (
                            <img key={i} src={logo} alt="Company Logo" className="h-8 w-auto grayscale opacity-40 hover:opacity-100 transition-opacity duration-300 invert brightness-0" />
                        ))}
                    </motion.div>
                    <div className="absolute inset-y-0 left-0 w-32 bg-linear-to-r from-bg-dark to-transparent z-10" />
                    <div className="absolute inset-y-0 right-0 w-32 bg-linear-to-l from-bg-dark to-transparent z-10" />
                </div>
            </div>
        </section>
    );
}

function Features() {
    return (
        <section id="features" className="py-32 px-4 max-w-7xl mx-auto">
            <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
                    Une plateforme <span className="text-[#868686]">complète</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto">
                    Hébergez, générez et exportez vos workflows N8N avec notre plateforme tout-en-un alimentée par l'IA.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {FEATURES.map((feature, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className={`${feature.colSpan} group relative p-8 rounded-2xl bg-bg-card border border-border-dark overflow-hidden hover:border-white/20 transition-all duration-500 hover:shadow-2xl hover:scale-[1.01]`}
                    >
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${feature.bg}`} />

                        <div className="relative z-10">
                            <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-2xl">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                            <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}



function HowItWorks() {
    return (
        <section id="how-it-works" className="py-32 px-4 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <div className="space-y-16">
                    <div className="space-y-6">
                        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
                            Comment ça <span className="text-[#868686]">fonctionne</span>
                        </h2>
                        <p className="text-lg text-gray-400 max-w-md">
                            Soyez opérationnel en quelques minutes, pas en mois. Notre processus intuitif rend l'automatisation accessible à tous.
                        </p>
                    </div>
                    <div className="space-y-12">
                        {STEPS.map((step, i) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.2 }}
                                className="flex gap-6 group"
                            >
                                <div className={`flex flex-col items-center`}>
                                    <div className={`py-3 px-4 rounded-xl flex items-center justify-center font-bold text-lg border border-white/10 transition-colors duration-300 ${step.bg} ${step.color}`}>
                                        {step.id}
                                    </div>
                                    {i !== STEPS.length - 1 && <div className="w-0.5 h-full bg-white/10 mt-4 group-hover:bg-white/20 transition-colors" />}
                                </div>
                                <div className="pb-12">
                                    <h3 className="text-2xl font-bold mb-3 group-hover:text-brand-blue transition-colors duration-300">{step.title}</h3>
                                    <p className="text-gray-400 leading-relaxed max-w-sm">{step.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 bg-linear-to-tr from-brand-blue/20 to-purple-600/20 blur-3xl -z-10 rounded-full opacity-40" />
                    <div className="relative rounded-2xl border border-white/10 bg-bg-card/80 backdrop-blur-xl p-2 shadow-2xl overflow-hidden aspect-square flex items-center justify-center">
                        {/* Abstract Representation of "Working" */}
                        <div className="relative size-full p-8 flex flex-col justify-between">
                            <div className="flex justify-between items-center">
                                <div className="h-2 w-20 bg-white/20 rounded-full" />
                                <div className="size-8 rounded-full bg-white/10" />
                            </div>

                            <div className="space-y-4">
                                <motion.div
                                    animate={{ x: [0, 20, 0], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="h-16 w-3/4 bg-linear-to-r from-orange-500/20 to-transparent rounded-lg border border-orange-500/30"
                                />
                                <motion.div
                                    animate={{ x: [0, -20, 0], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                    className="h-16 w-full bg-linear-to-r from-amber-200/20 to-transparent rounded-lg border border-amber-200/30 ml-auto"
                                />
                                <motion.div
                                    animate={{ x: [0, 10, 0], opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                                    className="h-16 w-2/3 bg-linear-to-r from-yellow-500/20 to-transparent rounded-lg border border-yellow-500/30"
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="h-12 w-12 rounded-lg bg-white/5 border border-white/10" />
                                <div className="h-12 w-full rounded-lg bg-white/5 border border-white/10" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Testimonials() {
    useEffect(() => {
        // Charger le script Trustpilot
        const script = document.createElement('script');
        script.src = '//widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            // Nettoyer le script au démontage
            if (document.body.contains(script)) {
                document.body.removeChild(script);
            }
        };
    }, []);

    return (
        <section id="testimonials" className="py-20 border-y border-white/5 bg-black/30">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold tracking-tight mb-4">
                        Avis de nos <span className="text-[#868686]">clients</span>
                    </h2>
                    <p className="text-gray-400">Découvrez ce que nos utilisateurs disent de LogicAI</p>
                </div>
                
                {/* Widget Trustpilot */}
                <div className="flex justify-center">
                    <div 
                        className="trustpilot-widget" 
                        data-locale="fr-FR" 
                        data-template-id="56278e9abfbbba0bdcd568bc" 
                        data-businessunit-id="6963f73c996fbae488146d55" 
                        data-style-height="52px" 
                        data-style-width="100%" 
                        data-token="875a397d-13d6-4959-93d2-9898eb5a6528"
                    >
                        <a href="https://fr.trustpilot.com/review/logicai.fr" target="_blank" rel="noopener">
                            Trustpilot
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Pricing() {
    const [isYearly, setIsYearly] = useState(false);
    const { user } = useAuth();
    const { showToast } = useToast();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [userPlan, setUserPlan] = useState<string>('free');

    useEffect(() => {
        const fetchUserPlan = async () => {
            if (user) {
                try {
                    const response = await fetch(`${import.meta.env.VITE_API_URL}/instances/subscription`, {
                        credentials: 'include'
                    });
                    if (response.ok) {
                        const data = await response.json();
                        setUserPlan(data.plan || 'free');
                    }
                } catch (error) {
                    console.error('Error fetching user plan:', error);
                }
            }
        };
        fetchUserPlan();
    }, [user]);

    const handleSubscribe = async (planName: string, planType: 'monthly' | 'annual') => {
        if (!user) {
            showToast('danger', 'Vous devez être connecté pour souscrire');
            window.location.href = '/login';
            return;
        }

        setLoadingPlan(planName);
        try {
            const planNameLower = planName.toLowerCase() as 'pro' | 'business';
            const { url } = await stripe.createCheckoutSession(planNameLower, planType);
            // Redirect to Stripe Checkout
            window.location.href = url;
        } catch (error: any) {
            console.error('Error creating checkout session:', error);
            showToast('danger', error.response?.data?.error || 'Erreur lors de la création de la session de paiement');
            setLoadingPlan(null);
        }
    };

    return (
        <section id="pricing" className="py-32 px-4 max-w-7xl mx-auto relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-200 h-125 bg-brand-blue/10 blur-[150px] rounded-full pointer-events-none -z-10" />

            <div className="text-center mb-16">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">Tarification simple</h2>
                <div className="inline-flex items-center p-1 rounded-full bg-white/5 border border-white/10">
                    <button
                        onClick={() => setIsYearly(false)}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${!isYearly ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Mensuel
                    </button>
                    <button
                        onClick={() => setIsYearly(true)}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${isYearly ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                    >
                        Annuel <span className="text-brand-orange text-xs ml-1">-20%</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { name: "Gratuit", price: "0", desc: "Parfait pour découvrir.", features: ["1 instance N8N", "5 Go de stockage", "6 Go de RAM", "2 To de bande passante", "Pas d'API"], isFree: true, planId: 'free', level: 0 },
                    { name: "Pro", price: isYearly ? "24.99" : "2.99", desc: "Pour les créateurs sérieux.", features: ["3 instances N8N", "15 Go de stockage", "8 Go de RAM", "2 To de bande passante", "API disponible"], popular: true, planId: 'pro', level: 1 },
                    { name: "Business", price: isYearly ? "64.99" : "6.99", desc: "Pour les équipes.", features: ["10 instances N8N", "35 Go de stockage", "16 Go de RAM", "6 To de bande passante", "API disponible"], planId: 'business', level: 2 }
                ].map((plan, i) => {
                    const planLevels: Record<string, number> = { free: 0, pro: 1, business: 2 };
                    const currentPlanLevel = planLevels[userPlan] || 0;
                    const isCurrentPlan = userPlan === plan.planId;
                    const isLowerPlan = plan.level < currentPlanLevel;
                    const isDisabled = isCurrentPlan || isLowerPlan;
                    return (
                        <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className={`relative p-8 rounded-2xl bg-bg-card border ${plan.popular ? 'border-orange-500 shadow-[0_0_40px_-10px_rgba(255,165,0,0.3)]' : 'border-border-dark'} flex flex-col h-full hover:scale-105 transition-transform duration-300`}
                    >
                        {plan.popular && (
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                Plus populaire
                            </div>
                        )}
                        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                        <p className="text-gray-400 text-sm mb-6">{plan.desc}</p>
                        <div className="mb-8">
                            <span className="text-4xl font-bold">{plan.price === "Sur mesure" ? plan.price : `${plan.price}€`}</span>
                            {plan.price !== "Sur mesure" && <span className="text-gray-500">/mois</span>}
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                            {plan.features.map(f => (
                                <li key={f} className="flex items-center gap-3 text-sm text-gray-300">
                                    <div className="size-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                                        <Check className="size-3 text-white" />
                                    </div>
                                    {f}
                                </li>
                            ))}
                        </ul>
                        <button 
                            onClick={() => {
                                if (plan.isFree) {
                                    if (user) {
                                        window.location.href = '/dashboard';
                                    } else {
                                        window.location.href = '/register';
                                    }
                                } else {
                                    handleSubscribe(plan.name, isYearly ? 'annual' : 'monthly');
                                }
                            }}
                            disabled={loadingPlan === plan.name || isDisabled}
                            className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                                isCurrentPlan
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                    : isDisabled
                                    ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                                    : plan.popular 
                                    ? 'bg-brand-blue hover:bg-brand-hover text-white' 
                                    : 'bg-white/5 hover:bg-white/10 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {loadingPlan === plan.name ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    <span>Redirection...</span>
                                </>
                            ) : isCurrentPlan ? (
                                `Votre offre`
                            ) : isLowerPlan ? (
                                `Choisir ${plan.name}`
                            ) : (
                                `Choisir ${plan.name}`
                            )}
                        </button>
                    </motion.div>
                    );
                })}
            </div>
        </section>
    );
}

function AskQuestions() {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section id="faq" className="py-32 px-4 max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold text-center mb-16">Questions fréquemment posées</h2>
            <div className="space-y-4">
                {FAQS.map((faq, i) => (
                    <div key={i} className="border border-white/10 rounded-2xl bg-bg-card overflow-hidden">
                        <button
                            onClick={() => setOpenIndex(openIndex === i ? null : i)}
                            className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <span className={`font-semibold text-lg transition-colors ${openIndex === i ? 'text-brand-blue' : ''}`}>{faq.q}</span>
                            {openIndex === i ? <Minus className="size-5 text-gray-400" /> : <Plus className="size-5 text-gray-400" />}
                        </button>
                        <motion.div
                            initial={false}
                            animate={{ height: openIndex === i ? 'auto' : 0, opacity: openIndex === i ? 1 : 0 }}
                            className="overflow-hidden"
                        >
                            <div className="p-6 pt-0 text-gray-400 leading-relaxed">
                                {faq.a}
                            </div>
                        </motion.div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function Footer() {
    return (
        <footer className="border-t border-white/10 pt-20 pb-10 bg-black">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-10 mb-20">
                <div className="col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="size-8 rounded-lg overflow-hidden flex items-center justify-center">
                            <img src="/LogicAI.ico" alt="LogicAI" className="size-full object-contain" />
                        </div>
                        <span className="text-lg font-bold">LogicAI</span>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Hébergement N8N professionnel avec IA intégrée. Déployez, générez et exportez vos workflows en toute simplicité.
                    </p>
                </div>
                <div>
                    <h4 className="font-semibold mb-6">Produit</h4>
                    <ul className="space-y-4 text-sm text-gray-500">
                        <li><a href="#" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Intégrations</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Tarifs</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold mb-6">Entreprise</h4>
                    <ul className="space-y-4 text-sm text-gray-500">
                        <li><a href="#" className="hover:text-white transition-colors">À propos</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Carrières</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                    </ul>
                </div>
                <div>
                    <h4 className="font-semibold mb-6">Légal</h4>
                    <ul className="space-y-4 text-sm text-gray-500">
                        <li><a href="#" className="hover:text-white transition-colors">Confidentialité</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Conditions</a></li>
                        <li><a href="#" className="hover:text-white transition-colors">Sécurité</a></li>
                    </ul>
                </div>
            </div>
            <div className="text-center text-gray-600 text-sm">
                © {new Date().getFullYear()} LogicAI Inc. Tous droits réservés.
            </div>
        </footer>
    );
}

export function Welcome() {
    const [activeSection, setActiveSection] = useState('hero');

    useEffect(() => {
        const handleScroll = () => {
            const sections = ['hero', 'features', 'how-it-works', 'testimonials', 'pricing', 'faq'];
            const scrollPosition = window.scrollY + 100;

            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const { offsetTop, offsetHeight } = element;
                    if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                        setActiveSection(section);
                        break;
                    }
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="min-h-screen bg-bg-dark text-white selection:bg-brand-blue/30 selection:text-brand-blue font-sans overflow-x-hidden">

            <Navbar activeSection={activeSection} />
            <main className="relative">
                <Hero />
                <SocialProof />
                <Features />
                <HowItWorks />
                <Testimonials />
                <Pricing />
                <AskQuestions />
            </main>
            <Footer />
        </div>
    );
}