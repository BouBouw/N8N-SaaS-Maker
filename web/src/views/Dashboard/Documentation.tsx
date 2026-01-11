import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen,
    Code,
    Key,
    Play,
    List,
    Info,
    AlertCircle,
    CheckCircle,
    Copy,
    ChevronRight,
    Sparkles,
    Lock,
    Terminal,
    Zap,
    ChevronDown,
    ExternalLink,
    Award,
    Shield,
    Search
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Link } from 'react-router';

export default function Documentation() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [activeSection, setActiveSection] = useState('introduction');
    const [activeCodeTab, setActiveCodeTab] = useState<{ [key: string]: string }>({
        execute: 'curl',
        list: 'curl',
        details: 'curl',
    });
    const [expandedCategories, setExpandedCategories] = useState<{ [key: string]: boolean }>({
        getstarted: true,
        endpoints: true,
        advanced: true,
    });

    const canUseApi = user?.subscription_plan === 'pro' || user?.subscription_plan === 'business';

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast('success', 'Copié dans le presse-papiers');
    };

    const toggleCategory = (category: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const navigation = [
        {
            category: 'Commencer',
            id: 'getstarted',
            items: [
                { id: 'introduction', label: 'Introduction', icon: <BookOpen className="size-4" /> },
                { id: 'authentication', label: 'Authentification', icon: <Key className="size-4" /> },
                { id: 'quickstart', label: 'Démarrage Rapide', icon: <Zap className="size-4" /> },
            ]
        },
        {
            category: 'Endpoints API',
            id: 'endpoints',
            items: [
                { id: 'execute', label: 'Exécuter un Workflow', icon: <Play className="size-4" /> },
                { id: 'list', label: 'Lister les Workflows', icon: <List className="size-4" /> },
                { id: 'details', label: 'Détails d\'un Workflow', icon: <Info className="size-4" /> },
            ]
        },
        {
            category: 'Avancé',
            id: 'advanced',
            items: [
                { id: 'errors', label: 'Gestion des Erreurs', icon: <AlertCircle className="size-4" /> },
                { id: 'examples', label: 'Exemples de Code', icon: <Code className="size-4" /> },
                { id: 'best-practices', label: 'Bonnes Pratiques', icon: <Award className="size-4" /> },
            ]
        },
    ];

    const codeExamples = {
        execute: {
            curl: `curl -X POST https://api.logicai.fr/v1/workflows/123/execute \\
  -H "Authorization: Bearer sk_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "John", "email": "john@example.com"}'`,
            javascript: `const axios = require('axios');

async function executeWorkflow(workflowId, data) {
  const response = await axios.post(
    \`https://api.logicai.fr/v1/workflows/\${workflowId}/execute\`,
    data,
    {
      headers: {
        'Authorization': 'Bearer sk_live_your_api_key',
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data;
}

executeWorkflow('123', { name: 'John', email: 'john@example.com' });`,
            python: `import requests

def execute_workflow(workflow_id, data):
    response = requests.post(
        f'https://api.logicai.fr/v1/workflows/{workflow_id}/execute',
        headers={
            'Authorization': 'Bearer sk_live_your_api_key',
            'Content-Type': 'application/json'
        },
        json=data
    )
    return response.json()

execute_workflow('123', {'name': 'John', 'email': 'john@example.com'})`,
            php: `<?php
$ch = curl_init("https://api.logicai.fr/v1/workflows/123/execute");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'name' => 'John',
    'email' => 'john@example.com'
]));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer sk_live_your_api_key",
    "Content-Type: application/json"
]);
$response = curl_exec($ch);
curl_close($ch);
?>`
        },
        list: {
            curl: `curl -X GET https://api.logicai.fr/v1/workflows \\
  -H "Authorization: Bearer sk_live_your_api_key"`,
            javascript: `const axios = require('axios');

async function listWorkflows() {
  const response = await axios.get(
    'https://api.logicai.fr/v1/workflows',
    {
      headers: {
        'Authorization': 'Bearer sk_live_your_api_key'
      }
    }
  );
  return response.data;
}`,
            python: `import requests

def list_workflows():
    response = requests.get(
        'https://api.logicai.fr/v1/workflows',
        headers={'Authorization': 'Bearer sk_live_your_api_key'}
    )
    return response.json()`,
            php: `<?php
$ch = curl_init("https://api.logicai.fr/v1/workflows");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer sk_live_your_api_key"
]);
$response = curl_exec($ch);
curl_close($ch);
?>`
        },
        details: {
            curl: `curl -X GET https://api.logicai.fr/v1/workflows/123 \\
  -H "Authorization: Bearer sk_live_your_api_key"`,
            javascript: `const axios = require('axios');

async function getWorkflowDetails(workflowId) {
  const response = await axios.get(
    \`https://api.logicai.fr/v1/workflows/\${workflowId}\`,
    {
      headers: {
        'Authorization': 'Bearer sk_live_your_api_key'
      }
    }
  );
  return response.data;
}`,
            python: `import requests

def get_workflow_details(workflow_id):
    response = requests.get(
        f'https://api.logicai.fr/v1/workflows/{workflow_id}',
        headers={'Authorization': 'Bearer sk_live_your_api_key'}
    )
    return response.json()`,
            php: `<?php
$ch = curl_init("https://api.logicai.fr/v1/workflows/123");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer sk_live_your_api_key"
]);
$response = curl_exec($ch);
curl_close($ch);
?>`
        }
    };

    const CodeBlock = ({ code, exampleKey }: { code: any, exampleKey: string }) => {
        const tabs = [
            { id: 'curl', label: 'cURL', color: 'text-green-400' },
            { id: 'javascript', label: 'JavaScript', color: 'text-yellow-400' },
            { id: 'python', label: 'Python', color: 'text-blue-400' },
            { id: 'php', label: 'PHP', color: 'text-purple-400' },
        ];

        return (
            <div className="my-6">
                <div className="flex items-center gap-2 mb-2 border-b border-white/10">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveCodeTab(prev => ({ ...prev, [exampleKey]: tab.id }))}
                            className={`px-4 py-2 text-sm font-medium transition-all relative ${
                                activeCodeTab[exampleKey] === tab.id
                                    ? `${tab.color} border-b-2 border-current`
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="relative bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
                        <span className="text-xs text-gray-400 uppercase font-semibold">
                            {tabs.find(t => t.id === activeCodeTab[exampleKey])?.label}
                        </span>
                        <button
                            onClick={() => copyToClipboard(code[activeCodeTab[exampleKey]])}
                            className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                        >
                            <Copy className="size-4" />
                        </button>
                    </div>
                    <pre className="p-4 overflow-x-auto text-sm">
                        <code className={tabs.find(t => t.id === activeCodeTab[exampleKey])?.color}>
                            {code[activeCodeTab[exampleKey]]}
                        </code>
                    </pre>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-bg-dark">
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar Navigation - Fixed */}
                <aside className="w-72 border-r border-white/10 bg-bg-card/50 backdrop-blur-xl overflow-y-auto flex flex-col">
                    <div className="p-6 border-b border-white/10">
                        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                            Documentation
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">LogicAI REST API v1</p>
                    </div>

                    {/* Search Bar */}
                    <div className="p-4 border-b border-white/10">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:border-brand-orange transition-colors text-white"
                            />
                        </div>
                    </div>

                    <nav className="p-4 flex-1">
                        {navigation.map((section) => (
                            <div key={section.id} className="mb-4">
                                <button
                                    onClick={() => toggleCategory(section.id)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors group"
                                >
                                    <span>{section.category}</span>
                                    <ChevronDown
                                        className={`size-4 transition-transform ${
                                            expandedCategories[section.id] ? '' : '-rotate-90'
                                        }`}
                                    />
                                </button>
                                <AnimatePresence>
                                    {expandedCategories[section.id] && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-1 mt-2">
                                                {section.items.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => setActiveSection(item.id)}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                                                            activeSection === item.id
                                                                ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30 font-medium'
                                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                                        }`}
                                                    >
                                                        {item.icon}
                                                        <span>{item.label}</span>
                                                        {activeSection === item.id && (
                                                            <div className="ml-auto w-1 h-full bg-brand-orange rounded-full" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </nav>

                    {/* Bottom Info */}
                    <div className="p-4 border-t border-white/10">
                        <Link
                            to="/dashboard/api"
                            className="flex items-center gap-2 text-sm text-brand-orange hover:text-orange-400 transition-colors"
                        >
                            <Key className="size-4" />
                            Gérer mes clés API
                            <ExternalLink className="size-3 ml-auto" />
                        </Link>
                    </div>
                </aside>

                {/* Main Content - Scrollable */}
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto p-8 text-white">
                        {/* Free Plan Banner */}
                        {!canUseApi && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-8 bg-linear-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-xl p-6"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="p-3 rounded-lg bg-orange-500/20">
                                        <Lock className="size-6 text-orange-400" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                            <Sparkles className="size-5 text-orange-400" />
                                            Accès API Réservé aux Plans Pro & Business
                                        </h3>
                                        <p className="text-gray-300 mb-4">
                                            L'utilisation de l'API REST pour exécuter vos workflows N8N nécessite un plan Pro ou Business.
                                        </p>
                                        <Link
                                            to="/dashboard/subscription"
                                            className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-all"
                                        >
                                            <Zap className="size-4" />
                                            Passer au Plan Pro
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {/* Content Sections */}
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeSection}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.2 }}
                            >
                                {/* Introduction */}
                                {activeSection === 'introduction' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h1 className="text-4xl font-bold mb-3">Introduction</h1>
                                            <p className="text-lg text-gray-400">Bienvenue dans la documentation de l'API LogicAI</p>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <p className="text-gray-300 leading-relaxed">
                                                L'API LogicAI vous permet d'interagir programmatiquement avec vos workflows N8N hébergés sur notre plateforme. 
                                                Cette API REST vous offre la possibilité d'exécuter, lister et gérer vos workflows de manière automatisée depuis n'importe quelle application.
                                            </p>

                                            <div className="bg-blue-500/10 border-l-4 border-blue-500 rounded-r-lg p-6 my-8">
                                                <div className="flex items-start gap-3">
                                                    <Info className="size-6 text-blue-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-semibold text-blue-400 mb-2">URL de Base</h4>
                                                        <code className="text-sm text-blue-300 bg-blue-500/10 px-3 py-1 rounded">
                                                            https://api.logicai.fr/v1
                                                        </code>
                                                    </div>
                                                </div>
                                            </div>

                                            <h3 className="text-2xl font-semibold mt-8 mb-4">Fonctionnalités principales</h3>
                                            <div className="grid gap-4">
                                                {[
                                                    {
                                                        icon: <Play className="size-5 text-green-400" />,
                                                        title: 'Exécution de workflows',
                                                        desc: 'Déclenchez vos workflows N8N avec des données personnalisées en temps réel'
                                                    },
                                                    {
                                                        icon: <List className="size-5 text-blue-400" />,
                                                        title: 'Gestion complète',
                                                        desc: 'Listez et récupérez les détails de tous vos workflows via l\'API'
                                                    },
                                                    {
                                                        icon: <Shield className="size-5 text-purple-400" />,
                                                        title: 'Authentification sécurisée',
                                                        desc: 'Utilisation de clés API avec Bearer token pour une sécurité maximale'
                                                    },
                                                    {
                                                        icon: <Terminal className="size-5 text-orange-400" />,
                                                        title: 'Statistiques détaillées',
                                                        desc: 'Suivez l\'utilisation et les performances de votre API en temps réel'
                                                    }
                                                ].map((feature, i) => (
                                                    <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                                                        <div className="p-2 rounded-lg bg-white/5">
                                                            {feature.icon}
                                                        </div>
                                                        <div>
                                                            <h4 className="font-semibold mb-1">{feature.title}</h4>
                                                            <p className="text-sm text-gray-400">{feature.desc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <h3 className="text-2xl font-semibold mt-8 mb-4">Plans compatibles</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-linear-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-lg p-6">
                                                    <h4 className="font-semibold text-purple-400 mb-2 text-lg">Plan Pro</h4>
                                                    <p className="text-sm text-gray-300">Accès complet à l'API avec 1 clé par instance</p>
                                                </div>
                                                <div className="bg-linear-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 rounded-lg p-6">
                                                    <h4 className="font-semibold text-orange-400 mb-2 text-lg">Plan Business</h4>
                                                    <p className="text-sm text-gray-300">Accès complet à l'API avec 1 clé par instance</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Authentication - I'll add rest in next message due to length */}
                                {activeSection === 'authentication' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
                                                <Key className="size-10 text-brand-orange" />
                                                Authentification
                                            </h1>
                                            <p className="text-lg text-gray-400">Sécurisez vos requêtes API avec des clés d'authentification</p>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <p className="text-gray-300 leading-relaxed">
                                                L'API LogicAI utilise des clés API pour l'authentification. Chaque instance N8N peut avoir 
                                                une clé API unique que vous devez inclure dans l'en-tête <code className="bg-white/10 px-2 py-1 rounded text-orange-400">Authorization</code> de chaque requête.
                                            </p>

                                            <h3 className="text-2xl font-semibold mt-8 mb-4">Obtenir votre clé API</h3>
                                            <ol className="space-y-3 list-decimal list-inside text-gray-300">
                                                <li>Accédez à la <Link to="/dashboard/api" className="text-brand-orange hover:underline">page API</Link> de votre dashboard</li>
                                                <li>Sélectionnez l'instance N8N pour laquelle vous souhaitez créer une clé</li>
                                                <li>Cliquez sur "Créer une clé API"</li>
                                                <li>Copiez et sauvegardez votre clé en lieu sûr (elle ne sera affichée qu'une seule fois)</li>
                                            </ol>

                                            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 rounded-r-lg p-6 my-8">
                                                <div className="flex items-start gap-3">
                                                    <AlertCircle className="size-6 text-yellow-400 shrink-0 mt-0.5" />
                                                    <div>
                                                        <h4 className="font-semibold text-yellow-400 mb-3">Sécurité</h4>
                                                        <ul className="text-sm text-gray-300 space-y-2">
                                                            <li className="flex items-start gap-2">
                                                                <CheckCircle className="size-4 text-green-400 mt-0.5 shrink-0" />
                                                                <span>Ne partagez jamais votre clé API publiquement</span>
                                                            </li>
                                                            <li className="flex items-start gap-2">
                                                                <CheckCircle className="size-4 text-green-400 mt-0.5 shrink-0" />
                                                                <span>Stockez-la dans des variables d'environnement</span>
                                                            </li>
                                                            <li className="flex items-start gap-2">
                                                                <CheckCircle className="size-4 text-green-400 mt-0.5 shrink-0" />
                                                                <span>Régénérez votre clé si elle est compromise</span>
                                                            </li>
                                                            <li className="flex items-start gap-2">
                                                                <CheckCircle className="size-4 text-green-400 mt-0.5 shrink-0" />
                                                                <span>Une seule clé par instance est autorisée</span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>

                                            <h3 className="text-2xl font-semibold mt-8 mb-4">Utilisation dans vos requêtes</h3>
                                            <p className="text-gray-300">
                                                Incluez votre clé API dans l'en-tête <code className="bg-white/10 px-2 py-1 rounded text-orange-400">Authorization</code> de chaque requête :
                                            </p>

                                            <div className="relative mt-6 bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden">
                                                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
                                                    <span className="text-xs text-gray-400 uppercase font-semibold">HTTP Header</span>
                                                    <button
                                                        onClick={() => copyToClipboard('Authorization: Bearer sk_live_your_api_key_here')}
                                                        className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                                                    >
                                                        <Copy className="size-4" />
                                                    </button>
                                                </div>
                                                <pre className="p-4 text-sm">
                                                    <code className="text-green-400">Authorization: Bearer sk_live_your_api_key_here</code>
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Other sections continue... */}
                                {activeSection === 'quickstart' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
                                                <Zap className="size-10 text-brand-orange" />
                                                Démarrage Rapide
                                            </h1>
                                            <p className="text-lg text-gray-400">Faites votre première requête API en 5 minutes</p>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <div className="space-y-6">
                                                {[
                                                    {
                                                        step: '1',
                                                        title: 'Créez une clé API',
                                                        desc: 'Rendez-vous dans votre dashboard et générez une clé API pour votre instance N8N',
                                                        color: 'from-blue-500 to-cyan-500'
                                                    },
                                                    {
                                                        step: '2',
                                                        title: 'Récupérez l\'ID de votre workflow',
                                                        desc: 'Trouvez l\'ID du workflow que vous souhaitez exécuter dans votre instance N8N',
                                                        color: 'from-purple-500 to-pink-500'
                                                    },
                                                    {
                                                        step: '3',
                                                        title: 'Faites votre première requête',
                                                        desc: 'Utilisez cURL, Postman ou votre langage préféré pour appeler l\'API',
                                                        color: 'from-orange-500 to-amber-500'
                                                    }
                                                ].map((item) => (
                                                    <div key={item.step} className="flex gap-4 p-6 bg-white/5 rounded-lg border border-white/10">
                                                        <div className={`shrink-0 w-12 h-12 rounded-full bg-linear-to-br ${item.color} flex items-center justify-center text-white font-bold text-lg`}>
                                                            {item.step}
                                                        </div>
                                                        <div>
                                                            <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                                                            <p className="text-gray-400">{item.desc}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <h3 className="text-2xl font-semibold mt-8 mb-4">Exemple complet</h3>
                                            <CodeBlock code={codeExamples.execute} exampleKey="execute" />
                                        </div>
                                    </div>
                                )}

                                {/* Execute Endpoint */}
                                {activeSection === 'execute' && (
                                    <div className="space-y-6">
                                        <div>
                                            <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/30 px-4 py-2 rounded-lg mb-4">
                                                <span className="text-green-400 font-bold">POST</span>
                                                <code className="text-green-300">/workflows/:workflowId/execute</code>
                                            </div>
                                            <h1 className="text-4xl font-bold mb-3">Exécuter un Workflow</h1>
                                            <p className="text-lg text-gray-400">Déclenchez l'exécution d'un workflow avec des données personnalisées</p>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <p className="text-gray-300 leading-relaxed">
                                                Cet endpoint vous permet d'exécuter un workflow N8N spécifique avec des données en entrée. 
                                                Le workflow sera déclenché immédiatement et vous recevrez les résultats de l'exécution.
                                            </p>

                                            <h3 className="text-2xl font-semibold mt-8 mb-4">Paramètres</h3>
                                            <div className="bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden">
                                                <table className="w-full text-sm">
                                                    <thead className="bg-[#161b22]">
                                                        <tr>
                                                            <th className="text-left p-4 font-semibold text-gray-300">Paramètre</th>
                                                            <th className="text-left p-4 font-semibold text-gray-300">Type</th>
                                                            <th className="text-left p-4 font-semibold text-gray-300">Description</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/10">
                                                        <tr>
                                                            <td className="p-4">
                                                                <code className="text-orange-400 bg-orange-500/10 px-2 py-1 rounded">workflowId</code>
                                                            </td>
                                                            <td className="p-4 text-gray-400">string</td>
                                                            <td className="p-4 text-gray-300">L'identifiant unique du workflow (dans l'URL)</td>
                                                        </tr>
                                                        <tr>
                                                            <td className="p-4">
                                                                <code className="text-orange-400 bg-orange-500/10 px-2 py-1 rounded">Body</code>
                                                            </td>
                                                            <td className="p-4 text-gray-400">JSON</td>
                                                            <td className="p-4 text-gray-300">Données à envoyer au workflow (optionnel)</td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>

                                            <h3 className="text-2xl font-semibold mt-8 mb-4">Exemples de requêtes</h3>
                                            <CodeBlock code={codeExamples.execute} exampleKey="execute" />

                                            <h3 className="text-2xl font-semibold mt-8 mb-4">Réponse</h3>
                                            <div className="relative bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden">
                                                <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#161b22]">
                                                    <span className="text-xs text-gray-400 uppercase font-semibold">200 OK</span>
                                                </div>
                                                <pre className="p-4 text-sm text-blue-400">
{`{
  "success": true,
  "executionId": "abc123def456",
  "data": {
    // Résultat du workflow
  }
}`}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* List Workflows */}
                                {activeSection === 'list' && (
                                    <div className="space-y-6">
                                        <div>
                                            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 px-4 py-2 rounded-lg mb-4">
                                                <span className="text-blue-400 font-bold">GET</span>
                                                <code className="text-blue-300">/workflows</code>
                                            </div>
                                            <h1 className="text-4xl font-bold mb-3">Lister les Workflows</h1>
                                            <p className="text-lg text-gray-400">Récupérez la liste de tous vos workflows N8N</p>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <CodeBlock code={codeExamples.list} exampleKey="list" />
                                        </div>
                                    </div>
                                )}

                                {/* Workflow Details */}
                                {activeSection === 'details' && (
                                    <div className="space-y-6">
                                        <div>
                                            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 px-4 py-2 rounded-lg mb-4">
                                                <span className="text-blue-400 font-bold">GET</span>
                                                <code className="text-blue-300">/workflows/:workflowId</code>
                                            </div>
                                            <h1 className="text-4xl font-bold mb-3">Détails d'un Workflow</h1>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <CodeBlock code={codeExamples.details} exampleKey="details" />
                                        </div>
                                    </div>
                                )}

                                {/* Errors */}
                                {activeSection === 'errors' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
                                                <AlertCircle className="size-10 text-brand-orange" />
                                                Gestion des Erreurs
                                            </h1>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <div className="space-y-3">
                                                {[
                                                    { code: '200', label: 'OK', desc: 'La requête a réussi', color: 'green' },
                                                    { code: '400', label: 'Bad Request', desc: 'Paramètres invalides', color: 'yellow' },
                                                    { code: '401', label: 'Unauthorized', desc: 'Clé API invalide', color: 'red' },
                                                    { code: '403', label: 'Forbidden', desc: 'Plan insuffisant', color: 'red' },
                                                    { code: '404', label: 'Not Found', desc: 'Workflow introuvable', color: 'orange' },
                                                    { code: '500', label: 'Server Error', desc: 'Erreur serveur', color: 'purple' },
                                                ].map((error) => (
                                                    <div key={error.code} className={`bg-${error.color}-500/10 border border-${error.color}-500/30 rounded-lg p-4`}>
                                                        <div className="flex items-start gap-3">
                                                            <span className={`bg-${error.color}-500 text-white text-sm font-bold px-3 py-1 rounded shrink-0`}>
                                                                {error.code}
                                                            </span>
                                                            <div>
                                                                <h4 className={`font-semibold text-${error.color}-400 mb-1`}>{error.label}</h4>
                                                                <p className="text-sm text-gray-300">{error.desc}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Examples */}
                                {activeSection === 'examples' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
                                                <Code className="size-10 text-brand-orange" />
                                                Exemples de Code
                                            </h1>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <h3 className="text-2xl font-semibold mb-4">Exécuter un workflow</h3>
                                            <CodeBlock code={codeExamples.execute} exampleKey="execute" />
                                        </div>
                                    </div>
                                )}

                                {/* Best Practices */}
                                {activeSection === 'best-practices' && (
                                    <div className="space-y-6">
                                        <div>
                                            <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
                                                <Award className="size-10 text-brand-orange" />
                                                Bonnes Pratiques
                                            </h1>
                                        </div>

                                        <div className="prose prose-invert max-w-none">
                                            <div className="space-y-6">
                                                {[
                                                    {
                                                        icon: <Shield className="size-6 text-purple-400" />,
                                                        title: 'Sécurité',
                                                        tips: [
                                                            'Stockez vos clés API dans des variables d\'environnement',
                                                            'Ne commitez jamais vos clés dans votre code source',
                                                            'Régénérez votre clé si compromise',
                                                            'Utilisez HTTPS pour toutes les requêtes'
                                                        ]
                                                    },
                                                    {
                                                        icon: <Zap className="size-6 text-yellow-400" />,
                                                        title: 'Performance',
                                                        tips: [
                                                            'Implémentez un système de cache',
                                                            'Utilisez des requêtes asynchrones',
                                                            'Évitez les appels API inutiles',
                                                            'Optimisez la taille des données'
                                                        ]
                                                    }
                                                ].map((section, i) => (
                                                    <div key={i} className="bg-white/5 rounded-lg border border-white/10 p-6">
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <div className="p-2 rounded-lg bg-white/5">
                                                                {section.icon}
                                                            </div>
                                                            <h3 className="text-xl font-semibold">{section.title}</h3>
                                                        </div>
                                                        <ul className="space-y-2">
                                                            {section.tips.map((tip, j) => (
                                                                <li key={j} className="flex items-start gap-2 text-gray-300">
                                                                    <ChevronRight className="size-4 text-brand-orange mt-1 shrink-0" />
                                                                    <span>{tip}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    );
}