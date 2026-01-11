import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
    Send, 
    Plus, 
    MessageSquare, 
    Sparkles, 
    Workflow, 
    Trash2, 
    ChevronLeft,
    ChevronRight,
    Search,
    Zap,
    Brain,
    Copy,
    Check,
    Download,
    Upload,
    Share2
} from 'lucide-react';
import { aiApi, type Conversation, type Message, type Template } from '../../api/ai';
import { useAuth } from '../../contexts/AuthContext';
import { getAvatarUrl } from '../../utils/avatar';
import { useToast } from '../../contexts/ToastContext';
import PublishModal from '../../components/PublishModal';
import SelectInstanceModal from '../../components/SelectInstanceModal';
import { instancesApi } from '../../api/instances';
import workflowsApi from '../../api/workflows';

export default function Make() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [currentConversation, setCurrentConversation] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [showTemplates, setShowTemplates] = useState(false);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'workflow_generator' | 'prompt_generator'>('all');
    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [publishModalOpen, setPublishModalOpen] = useState(false);
    const [publishContent, setPublishContent] = useState('');
    const [publishType, setPublishType] = useState<'workflow' | 'prompt'>('workflow');
    const [publishTitle, setPublishTitle] = useState('');
    const [publishDescription, setPublishDescription] = useState('');
    const [showInstanceModal, setShowInstanceModal] = useState(false);
    const [importingWorkflow, setImportingWorkflow] = useState(false);
    const [selectedMessageContent, setSelectedMessageContent] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadConversations();
        loadTemplates();
    }, []);

    useEffect(() => {
        if (currentConversation) {
            loadConversation(currentConversation);
        }
    }, [currentConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadConversations = async () => {
        try {
            const { conversations } = await aiApi.getConversations();
            setConversations(conversations);
        } catch (error) {
            console.error('Error loading conversations:', error);
        }
    };

    const loadConversation = async (id: number) => {
        try {
            const { messages } = await aiApi.getConversation(id);
            setMessages(messages);
        } catch (error) {
            console.error('Error loading conversation:', error);
        }
    };

    const loadTemplates = async () => {
        try {
            const { templates } = await aiApi.getTemplates();
            setTemplates(templates);
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    };

    const createNewConversation = async (modelType: 'general' | 'workflow_generator' | 'prompt_generator' = 'general') => {
        try {
            const { conversationId } = await aiApi.createConversation('Nouvelle conversation', modelType);
            await loadConversations();
            setCurrentConversation(conversationId);
            setMessages([]);
            setShowTemplates(false);
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    const sendMessage = async () => {
        if (!inputMessage.trim() || !currentConversation || loading) return;

        const userMessage = inputMessage;
        setInputMessage('');
        setLoading(true);

        try {
            const { messages: newMessages } = await aiApi.sendMessage(currentConversation, userMessage);
            setMessages(newMessages);
            await loadConversations();
        } catch (error) {
            console.error('Error sending message:', error);
        } finally {
            setLoading(false);
        }
    };

    const deleteConversation = async (id: number) => {
        try {
            await aiApi.deleteConversation(id);
            await loadConversations();
            if (currentConversation === id) {
                setCurrentConversation(null);
                setMessages([]);
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
        }
    };

    const useTemplate = async (template: Template) => {
        await aiApi.useTemplate(template.id);
        await createNewConversation(template.category);
        setInputMessage(template.prompt_template);
    };

    const copyToClipboard = (text: string, id: number) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredTemplates = templates.filter(t => {
        const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            t.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleImportClick = async (messageContent: string) => {
        try {
            // Check if user has instances
            const { instances } = await instancesApi.getAll();
            const runningInstances = instances.filter((i: any) => i.status === 'running');
            
            if (runningInstances.length === 0) {
                showToast('warning', 'Aucune instance N8N active. Créez une instance d\'abord.');
                return;
            }
            
            setSelectedMessageContent(messageContent);
            
            // If only one instance, import directly, otherwise show modal
            if (runningInstances.length === 1) {
                const instance = runningInstances[0];
                await importToInstance(instance.id, `http://localhost:${instance.docker_port}`);
            } else {
                setShowInstanceModal(true);
            }
        } catch (error) {
            console.error('Error checking instances:', error);
            showToast('danger', 'Erreur lors de la vérification des instances');
        }
    };

    const importToInstance = async (instanceId: number, instanceUrl: string) => {
        try {
            setImportingWorkflow(true);
            
            // Extract JSON from markdown code block
            const jsonMatch = selectedMessageContent.match(/```json\s*([\s\S]*?)```/);
            let workflowContent = selectedMessageContent;
            
            if (jsonMatch && jsonMatch[1]) {
                workflowContent = jsonMatch[1].trim();
            }
            
            const result = await workflowsApi.import({
                instanceId,
                workflowContent
            });

            if (result.requiresAuth) {
                showToast('warning', 'Connectez-vous à votre instance N8N puis réessayez');
                window.open(instanceUrl, '_blank');
            } else if (result.success) {
                showToast('success', 'Workflow importé avec succès !');
                setShowInstanceModal(false);
                
                // Open workflow in N8N
                if (result.workflowUrl) {
                    window.open(result.workflowUrl, '_blank');
                }
            }
        } catch (error: any) {
            console.error('Error importing workflow:', error);
            if (error.response?.data?.requiresAuth) {
                showToast('warning', 'Authentification requise. Connectez-vous à votre instance N8N.');
                window.open(instanceUrl, '_blank');
            } else {
                showToast('danger', error.response?.data?.error || 'Erreur lors de l\'importation');
            }
        } finally {
            setImportingWorkflow(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#0A0A0A]">
            {/* Sidebar */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ x: -280 }}
                        animate={{ x: 0 }}
                        exit={{ x: -280 }}
                        transition={{ type: 'spring', damping: 20 }}
                        className="w-70 border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col"
                    >
                        {/* Sidebar Header */}
                        <div className="p-4 border-b border-white/10">
                            <button
                                onClick={() => {
                                    if (!currentConversation || messages.length > 0) {
                                        setShowTemplates(false);
                                        setCurrentConversation(null);
                                        setMessages([]);
                                    }
                                }}
                                className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white rounded-lg p-3 flex items-center justify-center gap-2 transition-colors"
                            >
                                <Plus className="size-5" />
                                <span className="font-medium">Nouvelle conversation</span>
                            </button>
                        </div>

                        {/* Conversations List */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 chat-scroll">
                            {conversations.map((conv) => (
                                <motion.div
                                    key={conv.id}
                                    className={`w-full text-left p-3 rounded-lg transition-all group relative cursor-pointer ${
                                        currentConversation === conv.id
                                            ? 'bg-white/10 text-white'
                                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setCurrentConversation(conv.id)}
                                >
                                    <div className="flex items-start gap-2">
                                        <MessageSquare className="size-4 mt-1 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{conv.title}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {conv.message_count} messages
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteConversation(conv.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                                        >
                                            <Trash2 className="size-3 text-red-400" />
                                        </button>
                                    </div>
                                    {conv.model_type !== 'general' && (
                                        <div className="mt-2 flex gap-1">
                                            {conv.model_type === 'workflow_generator' && (
                                                <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                                                    <Workflow className="size-3 inline mr-1" />
                                                    Workflow
                                                </span>
                                            )}
                                            {conv.model_type === 'prompt_generator' && (
                                                <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                                                    <Brain className="size-3 inline mr-1" />
                                                    Prompt
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Top Bar */}
                <div className="h-14 border-b border-white/10 flex items-center px-4 bg-black/40 backdrop-blur-xl">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        {sidebarOpen ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
                    </button>
                    <div className="ml-4 flex items-center gap-2">
                        <Sparkles className="size-5 text-brand-orange" />
                        <h1 className="text-lg font-semibold">IA Make</h1>
                        {currentConversation && (
                            <span className="text-sm text-gray-400 ml-2">
                                {conversations.find(c => c.id === currentConversation)?.title}
                            </span>
                        )}
                    </div>
                </div>

                {/* Templates Library */}
                {showTemplates && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex-1 overflow-y-auto p-6 chat-scroll"
                    >
                        <div className="max-w-5xl mx-auto">
                            <h2 className="text-2xl font-bold mb-2">Prompt Generator</h2>
                            <p className="text-gray-400 mb-6">Créez des prompts optimisés avec l'IA</p>

                            {/* Search & Filter */}
                            <div className="flex gap-4 mb-6">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Rechercher un modèle..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    {[
                                        { value: 'all', label: 'Tous', icon: Sparkles },
                                        { value: 'workflow_generator', label: 'Workflows', icon: Workflow },
                                        { value: 'prompt_generator', label: 'Prompts', icon: Brain }
                                    ].map((cat) => (
                                        <button
                                            key={cat.value}
                                            onClick={() => setSelectedCategory(cat.value as any)}
                                            className={`px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${
                                                selectedCategory === cat.value
                                                    ? 'bg-brand-orange text-white'
                                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                            }`}
                                        >
                                            <cat.icon className="size-4" />
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Templates Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTemplates.map((template) => (
                                    <motion.div
                                        key={template.id}
                                        whileHover={{ scale: 1.02 }}
                                        className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-all cursor-pointer group template-card"
                                        onClick={() => useTemplate(template)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${
                                                    template.category === 'workflow_generator'
                                                        ? 'bg-blue-500/20 text-blue-400'
                                                        : 'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                    {template.category === 'workflow_generator' ? (
                                                        <Workflow className="size-5" />
                                                    ) : (
                                                        <Brain className="size-5" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-white">{template.name}</h3>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {template.usage_count} utilisations
                                                    </p>
                                                </div>
                                            </div>
                                            <Zap className="size-5 text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <p className="text-sm text-gray-400 mb-3">{template.description}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {JSON.parse(template.tags as any).map((tag: string) => (
                                                <span
                                                    key={tag}
                                                    className="text-xs px-2 py-1 bg-white/5 text-gray-400 rounded"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Chat Area */}
                {!showTemplates && (
                    <>
                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-6 chat-scroll">
                            {!currentConversation ? (
                                <div className="h-full flex items-center justify-center">
                                    <div className="text-center max-w-md">
                                        <div className="mb-6 flex justify-center">
                                            <div className="p-6 bg-brand-orange/20 rounded-full">
                                                <Sparkles className="size-12 text-brand-orange" />
                                            </div>
                                        </div>
                                        <h2 className="text-2xl font-bold mb-2">Bienvenue dans l'AI Assistant</h2>
                                        <p className="text-gray-400 mb-6">
                                            Sélectionnez un type de générateur pour commencer
                                        </p>
                                        <div className="flex gap-3 justify-center">
                                            <button
                                                onClick={() => createNewConversation('workflow_generator')}
                                                className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center gap-2 font-medium"
                                            >
                                                <Workflow className="size-5" />
                                                Generator Workflow
                                            </button>
                                            <button
                                                onClick={() => createNewConversation('prompt_generator')}
                                                className="px-6 py-3 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors flex items-center gap-2 font-medium"
                                            >
                                                <Brain className="size-5" />
                                                Prompts Generator
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="max-w-4xl mx-auto space-y-6">
                                    {messages.map((message, index) => (
                                        <motion.div
                                            key={message.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className={`flex gap-4 ${
                                                message.role === 'user' ? 'flex-row-reverse' : ''
                                            } message-animate`}
                                        >
                                            <div className={`shrink-0 size-10 rounded-full flex items-center justify-center overflow-hidden ${
                                                message.role === 'user'
                                                    ? 'bg-brand-orange'
                                                    : 'bg-white/10'
                                            }`}>
                                                {message.role === 'user' ? (
                                                    user?.avatar ? (
                                                        <img 
                                                            src={getAvatarUrl(user.avatar, user.discord_id) || ''} 
                                                            alt={user.name}
                                                            className="size-full object-cover"
                                                        />
                                                    ) : (
                                                        <span className="text-white font-semibold">
                                                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                                                        </span>
                                                    )
                                                ) : (
                                                    <Sparkles className="size-5 text-brand-orange" />
                                                )}
                                            </div>
                                            <div className={`flex-1 min-w-0 ${message.role === 'user' ? 'text-right' : ''}`}>
                                                <div className={`inline-block max-w-full ${
                                                    message.role === 'user'
                                                        ? 'message-user'
                                                        : 'message-assistant'
                                                } rounded-xl p-4 text-left relative group message-group`}>
                                                    {message.role === 'assistant' && (
                                                        <button
                                                            onClick={() => copyToClipboard(message.content, message.id)}
                                                            className="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-white/10 rounded copy-button transition-opacity"
                                                            title="Copier"
                                                        >
                                                            {copiedId === message.id ? (
                                                                <Check className="size-4 text-green-400" />
                                                            ) : (
                                                                <Copy className="size-4" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <div className="text-sm message-content prose prose-invert prose-sm max-w-none overflow-hidden">
                                                        {message.role === 'assistant' ? (
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {message.content}
                                                            </ReactMarkdown>
                                                        ) : (
                                                            <div className="whitespace-pre-wrap">{message.content}</div>
                                                        )}
                                                    </div>
                                                    
                                                    {message.role === 'assistant' && (
                                                        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    // Extract JSON from markdown code block
                                                                    const jsonMatch = message.content.match(/```json\s*([\s\S]*?)```/);
                                                                    let jsonData = null;
                                                                    
                                                                    if (jsonMatch && jsonMatch[1]) {
                                                                        try {
                                                                            // Parse and re-stringify to ensure valid JSON
                                                                            jsonData = JSON.parse(jsonMatch[1].trim());
                                                                        } catch (e) {
                                                                            console.error('Failed to parse JSON from code block:', e);
                                                                        }
                                                                    }
                                                                    
                                                                    // If no JSON found in code block, fallback to full content
                                                                    const dataStr = jsonData 
                                                                        ? JSON.stringify(jsonData, null, 2)
                                                                        : message.content;
                                                                    
                                                                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                                                                    const url = URL.createObjectURL(dataBlob);
                                                                    const link = document.createElement('a');
                                                                    link.href = url;
                                                                    link.download = `workflow-${message.id}.json`;
                                                                    link.click();
                                                                    URL.revokeObjectURL(url);
                                                                }}
                                                                className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-sm text-gray-300 rounded-lg transition-colors flex items-center gap-2"
                                                            >
                                                                <Download className="size-4" />
                                                                Télécharger
                                                            </button>
                                                            <button
                                                                onClick={() => handleImportClick(message.content)}
                                                                disabled={importingWorkflow}
                                                                className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-sm text-blue-400 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Upload className="size-4" />
                                                                {importingWorkflow ? 'Import en cours...' : 'Importer sur N8N'}
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    const conv = conversations.find(c => c.id === currentConversation);
                                                                    const type = conv?.model_type === 'workflow_generator' ? 'workflow' : 'prompt';
                                                                    
                                                                    // Extract title and description
                                                                    let title = '';
                                                                    let description = '';
                                                                    
                                                                    if (type === 'workflow') {
                                                                        // For workflows, extract name from JSON
                                                                        const jsonMatch = message.content.match(/```json\s*([\s\S]*?)```/);
                                                                        if (jsonMatch && jsonMatch[1]) {
                                                                            try {
                                                                                const workflowData = JSON.parse(jsonMatch[1].trim());
                                                                                if (workflowData.name) {
                                                                                    title = workflowData.name.substring(0, 255);
                                                                                }
                                                                            } catch (e) {
                                                                                console.error('Failed to parse workflow JSON:', e);
                                                                            }
                                                                        }
                                                                        
                                                                        // Extract description from Description section
                                                                        const descMatch = message.content.match(/##\s*Description\s*([\s\S]*?)(?=##|$)/i);
                                                                        if (descMatch && descMatch[1]) {
                                                                            description = descMatch[1].trim().substring(0, 500);
                                                                        }
                                                                    } else {
                                                                        // For prompts, use first line as title
                                                                        const lines = message.content.split('\n').filter(l => l.trim());
                                                                        if (lines.length > 0) {
                                                                            title = lines[0].replace(/^#+\s*/, '').trim().substring(0, 255);
                                                                            description = lines.slice(1).join(' ').trim().substring(0, 500) || lines[0].trim();
                                                                        }
                                                                    }
                                                                    
                                                                    // Fallback
                                                                    if (!title) {
                                                                        title = type === 'workflow' ? 'Workflow N8N' : 'Prompt optimisé';
                                                                    }
                                                                    if (!description) {
                                                                        description = message.content.substring(0, 500).split('\n')[0] || 'Ressource générée par IA';
                                                                    }
                                                                    
                                                                    setPublishContent(message.content);
                                                                    setPublishType(type);
                                                                    setPublishTitle(title);
                                                                    setPublishDescription(description);
                                                                    setPublishModalOpen(true);
                                                                }}
                                                                className="px-3 py-1.5 bg-brand-orange/20 hover:bg-brand-orange/30 text-sm text-brand-orange rounded-lg transition-colors flex items-center gap-2"
                                                            >
                                                                <Share2 className="size-4" />
                                                                Publier sur LogicAI
                                                            </button>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="mt-2 text-xs text-gray-500">
                                                        {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                    {loading && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex gap-4"
                                        >
                                            <div className="shrink-0 size-10 rounded-full bg-white/10 flex items-center justify-center">
                                                <Sparkles className="size-5 text-brand-orange animate-pulse" />
                                            </div>
                                            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                                <div className="flex gap-2">
                                                    <div className="size-2 bg-gray-400 rounded-full typing-dot" />
                                                    <div className="size-2 bg-gray-400 rounded-full typing-dot" />
                                                    <div className="size-2 bg-gray-400 rounded-full typing-dot" />
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Input Area */}
                        {currentConversation && (
                            <div className="border-t border-white/10 p-4 bg-black/40 backdrop-blur-xl">
                                <div className="max-w-4xl mx-auto">
                                    <div className="flex gap-3">
                                        <textarea
                                            value={inputMessage}
                                            onChange={(e) => setInputMessage(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault();
                                                    sendMessage();
                                                }
                                            }}
                                            placeholder="Tapez votre message... (Shift+Enter pour nouvelle ligne)"
                                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 resize-none chat-input"
                                            rows={3}
                                        />
                                        <button
                                            onClick={sendMessage}
                                            disabled={!inputMessage.trim() || loading}
                                            className="px-6 bg-brand-orange hover:bg-brand-orange/90 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl transition-colors flex items-center gap-2"
                                        >
                                            <Send className="size-5" />
                                        </button>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500 text-center">
                                        L'IA peut faire des erreurs. Vérifiez les informations importantes.
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Publish Modal */}
            {publishModalOpen && (
                <PublishModal
                    content={publishContent}
                    type={publishType}
                    initialTitle={publishTitle}
                    initialDescription={publishDescription}
                    onClose={() => setPublishModalOpen(false)}
                    onSuccess={() => {
                        setPublishModalOpen(false);
                        showToast('success', 'Ressource publiée avec succès !');
                    }}
                />
            )}

            {/* Select Instance Modal */}
            {showInstanceModal && (
                <SelectInstanceModal
                    onClose={() => setShowInstanceModal(false)}
                    onSelect={importToInstance}
                    importing={importingWorkflow}
                />
            )}
        </div>
    );
}
