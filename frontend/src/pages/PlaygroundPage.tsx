import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  PencilSimple,
  Trash,
  Copy,
  Check,
  CircleNotch,
  MagnifyingGlass,
  User,
  Robot,
  X,
  ChatDots,
  GearSix,
  PaperPlaneTilt,
  Stop,
} from 'phosphor-react';
import { listAuthFiles, getAuthKey, getAPIKeys } from '../lib/api';
import { animateFadeIn, durations } from '../lib/animations';

// Ambient Background
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div 
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.12), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
}

interface ConversationHistory {
  id: string;
  title: string;
  messages: Message[];
  model: string;
  createdAt: Date;
}

interface AuthFileInfo {
  name: string;
  type?: string;
  email?: string;
}

interface ModelInfo {
  id: string;
  display_name?: string;
  type?: string;
  owned_by?: string;
}

interface AvailableProvider {
  authFile: string;
  email?: string;
  type: string;
  models: ModelInfo[];
}

const PROVIDER_COLORS: Record<string, string> = {
  gemini: '#22D3EE',
  'gemini-cli': '#22D3EE',
  claude: '#F97316',
  'claude-code': '#F97316',
  anthropic: '#F97316',
  openai: '#10B981',
  codex: '#10B981',
  qwen: '#8B5CF6',
  iflow: '#06B6D4',
  antigravity: '#A78BFA',
  vertex: '#F59E0B',
};

const getProviderColor = (type: string): string => {
  const lowerType = type.toLowerCase();
  for (const [key, value] of Object.entries(PROVIDER_COLORS)) {
    if (lowerType.includes(key)) return value;
  }
  return '#64748B';
};

const generateId = () => Math.random().toString(36).substring(2, 15);

const fetchModelsForAuthFile = async (fileName: string): Promise<ModelInfo[]> => {
  const authKey = getAuthKey();
  try {
    const response = await fetch(`/v0/management/auth-files/models?name=${encodeURIComponent(fileName)}`, {
      headers: {
        ...(authKey ? { 'Authorization': `Bearer ${authKey}` } : {}),
      },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.models || [];
  } catch {
    return [];
  }
};

export default function PlaygroundPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedAuthFile, setSelectedAuthFile] = useState<string>('');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful AI assistant.');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationHistory[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await getAPIKeys();
        const keys = response.data?.['api-keys'] || [];
        if (keys.length > 0 && typeof keys[0] === 'object' && 'key' in keys[0]) {
          setApiKey(keys[0].key);
        } else if (keys.length > 0 && typeof keys[0] === 'string') {
          setApiKey(keys[0]);
        }
      } catch (err) {
        console.error('Failed to fetch API keys:', err);
      }
    };
    fetchApiKey();
  }, []);

  const { data: authFilesData, isLoading: authFilesLoading } = useQuery({
    queryKey: ['authFiles'],
    queryFn: async () => {
      const response = await listAuthFiles();
      return response.data;
    },
  });

  useEffect(() => {
    const fetchModels = async () => {
      if (!authFilesData?.files || authFilesData.files.length === 0) {
        setProviders([]);
        return;
      }

      setModelsLoading(true);
      const providersList: AvailableProvider[] = [];

      for (const file of authFilesData.files as AuthFileInfo[]) {
        try {
          const models = await fetchModelsForAuthFile(file.name);
          if (models.length > 0) {
            providersList.push({
              authFile: file.name,
              email: file.email,
              type: file.type || 'unknown',
              models: models,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch models for ${file.name}:`, err);
        }
      }

      setProviders(providersList);
      setModelsLoading(false);

      if (providersList.length > 0 && providersList[0].models.length > 0) {
        setSelectedAuthFile(providersList[0].authFile);
        setSelectedModel(providersList[0].models[0].id);
      }
    };

    fetchModels();
  }, [authFilesData]);

  // Animations
  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      const lastMessage = chatContainerRef.current.querySelector('.chat-message:last-child');
      if (lastMessage) {
        animateFadeIn(lastMessage, { duration: durations.normal, scale: 0.98 });
      }
    }
  }, [messages.length]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    const saved = localStorage.getItem('playground_conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed.map((c: ConversationHistory) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          messages: c.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))
        })));
      } catch (e) {
        console.error('Failed to load conversations', e);
      }
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('playground_conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  const getCurrentProvider = () => providers.find(p => p.authFile === selectedAuthFile);
  const getCurrentModel = () => {
    const provider = getCurrentProvider();
    return provider?.models.find(m => m.id === selectedModel);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !selectedModel) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      model: selectedModel,
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      abortControllerRef.current = new AbortController();

      const apiMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage.content },
      ];

      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: apiMessages,
          stream: true,
          temperature,
          max_tokens: maxTokens,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              fullContent += content;

              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessage.id
                    ? { ...m, content: fullContent }
                    : m
                )
              );
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      const title = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '');
      if (currentConversationId) {
        setConversations(prev =>
          prev.map(c =>
            c.id === currentConversationId
              ? { ...c, messages: [...messages, userMessage, { ...assistantMessage, content: fullContent }] }
              : c
          )
        );
      } else {
        const newConv: ConversationHistory = {
          id: generateId(),
          title,
          messages: [userMessage, { ...assistantMessage, content: fullContent }],
          model: selectedModel,
          createdAt: new Date(),
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled
      } else {
        console.error('Chat error:', error);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessage.id
              ? { ...m, content: `Error: ${(error as Error).message}` }
              : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  const clearChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
  };

  const copyToClipboard = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const loadConversation = (conv: ConversationHistory) => {
    setMessages(conv.messages);
    setSelectedModel(conv.model);
    setCurrentConversationId(conv.id);
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      clearChat();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentProvider = getCurrentProvider();
  const currentModel = getCurrentModel();
  const providerColor = currentProvider ? getProviderColor(currentProvider.type) : '#64748B';

  const filteredProviders = providers.map(provider => ({
    ...provider,
    models: provider.models.filter(model =>
      model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(provider => provider.models.length > 0);

  // Loading State
  if (authFilesLoading || modelsLoading) {
    return (
      <div className="relative min-h-screen flex items-center justify-center" style={{ background: '#09090B' }}>
        <AmbientBackground />
        <div className="relative z-10 text-center">
          <CircleNotch className="h-10 w-10 animate-spin text-cyan-400 mx-auto mb-4" weight="bold" />
          <p className="text-slate-400 font-mono text-sm">Loading models...</p>
        </div>
      </div>
    );
  }

  // No Providers State
  if (providers.length === 0) {
    return (
      <div className="relative min-h-screen flex items-center justify-center" style={{ background: '#09090B' }}>
        <AmbientBackground />
        <div className="relative z-10 text-center max-w-md px-4">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl glass-panel flex items-center justify-center">
            <ChatDots className="h-8 w-8 text-amber-400" weight="fill" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">No Models Available</h2>
          <p className="text-slate-400 text-sm mb-6">
            Please authenticate with a provider first to start chatting.
          </p>
          <button 
            onClick={() => window.location.href = '/oauth'}
            className="px-6 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all duration-300 font-medium"
          >
            Go to OAuth
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen overflow-hidden" style={{ background: '#09090B' }}>
      <AmbientBackground />
      
      {/* Sidebar - Chat History */}
      <div className="relative z-10 w-64 border-r border-white/[0.06] flex flex-col bg-[#09090B]/90">
        <div className="p-4 border-b border-white/[0.06]">
          <button
            onClick={clearChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300"
          >
            <PencilSimple className="h-4 w-4 text-cyan-400" weight="bold" />
            <span className="text-white text-sm font-medium">New Chat</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <ChatDots className="h-8 w-8 mx-auto mb-3 text-slate-600" />
              <p className="text-xs text-slate-500">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                    currentConversationId === conv.id
                      ? 'bg-cyan-500/10 border-l-2 border-cyan-400'
                      : 'hover:bg-white/[0.03]'
                  }`}
                  onClick={() => loadConversation(conv)}
                >
                  <ChatDots className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  <span className={`text-sm truncate flex-1 ${currentConversationId === conv.id ? 'text-white' : 'text-slate-400'}`}>
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-500/20 rounded-lg transition-all duration-200"
                  >
                    <Trash className="h-3.5 w-3.5 text-slate-500 hover:text-rose-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-white/[0.06] flex items-center justify-between px-6 bg-[#09090B]/80 backdrop-blur-sm">
          <div className="relative">
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-3 px-4 py-2 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300"
            >
              <div 
                className="w-2.5 h-2.5 rounded-full" 
                style={{ background: providerColor, boxShadow: `0 0 8px ${providerColor}` }}
              />
              <span className="text-sm font-medium text-white">
                {currentModel?.display_name || currentModel?.id || 'Select Model'}
              </span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Model Selector Dropdown */}
            {showModelSelector && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModelSelector(false)} />
                <div className="absolute top-full left-0 mt-2 w-96 glass-panel rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 border-b border-white/[0.06]">
                    <div className="relative">
                      <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search models..."
                        className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                      />
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {filteredProviders.map(provider => (
                      <div key={provider.authFile} className="mb-3">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ background: getProviderColor(provider.type) }}
                          />
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                            {provider.type}
                          </span>
                          {provider.email && (
                            <span className="text-xs text-slate-600">({provider.email})</span>
                          )}
                        </div>
                        {provider.models.map(model => (
                          <button
                            key={`${provider.authFile}-${model.id}`}
                            onClick={() => {
                              setSelectedAuthFile(provider.authFile);
                              setSelectedModel(model.id);
                              setShowModelSelector(false);
                              setSearchQuery('');
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 ${
                              selectedModel === model.id && selectedAuthFile === provider.authFile
                                ? 'bg-cyan-500/10 border border-cyan-500/20'
                                : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            <span className={`text-sm ${selectedModel === model.id ? 'text-white' : 'text-slate-300'}`}>
                              {model.display_name || model.id}
                            </span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-xl transition-all duration-300 ${showSettings ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/[0.05] text-slate-400'}`}
          >
            <GearSix className="h-5 w-5" weight="bold" />
          </button>
        </div>

        {/* Messages Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
          {/* API Key Warning */}
          {!apiKey && (
            <div className="max-w-4xl mx-auto mt-4 px-6">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-200/90">
                    <div className="font-semibold mb-1">⚠️ No API Key Found</div>
                    <p className="text-amber-300/80 mb-2">
                      You need to create a <strong>Proxy Key</strong> first to use the Playground.
                    </p>
                    <button
                      onClick={() => window.location.href = '/proxy-keys'}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium transition-colors"
                    >
                      Go to Proxy Keys →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg px-4">
                <div 
                  className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                  style={{ 
                    background: `${providerColor}15`,
                    boxShadow: `0 0 40px ${providerColor}20`,
                  }}
                >
                  <Robot className="h-10 w-10" style={{ color: providerColor }} weight="fill" />
                </div>
                <h2 className="text-3xl font-semibold text-white mb-3">
                  Start a conversation
                </h2>
                <p className="text-slate-400 text-sm">
                  Test your authenticated models with real-time streaming responses.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-8 px-6">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message mb-6 flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div 
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user' 
                        ? 'bg-slate-700' 
                        : ''
                    }`}
                    style={message.role === 'assistant' ? { 
                      background: `${providerColor}20`,
                    } : undefined}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4 text-slate-300" weight="bold" />
                    ) : (
                      <Robot className="h-4 w-4" style={{ color: providerColor }} weight="fill" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                    <div
                      className={`px-4 py-3 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-cyan-500/15 border border-cyan-500/20 text-white'
                          : 'glass-panel text-slate-200'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content || '...'}</p>
                      ) : (
                        <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                              em: ({ children }) => <em className="italic text-slate-300">{children}</em>,
                              code: ({ children }) => <code className="px-1.5 py-0.5 rounded bg-white/[0.08] text-cyan-400 font-mono text-xs">{children}</code>,
                              pre: ({ children }) => <pre className="bg-black/30 p-3 rounded-lg overflow-x-auto my-2">{children}</pre>,
                              ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>,
                              li: ({ children }) => <li className="text-slate-300">{children}</li>,
                              h1: ({ children }) => <h1 className="text-xl font-bold text-white mt-3 mb-2">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-semibold text-white mt-3 mb-2">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-semibold text-white mt-2 mb-1">{children}</h3>,
                              blockquote: ({ children }) => <blockquote className="border-l-2 border-cyan-400 pl-3 my-2 text-slate-400">{children}</blockquote>,
                              a: ({ children, href }) => <a href={href} className="text-cyan-400 hover:text-cyan-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                            }}
                          >
                            {message.content || '...'}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                    
                    {/* Copy Button */}
                    {message.role === 'assistant' && message.content && (
                      <button
                        onClick={() => copyToClipboard(message.content, message.id)}
                        className="mt-2 p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors inline-flex items-center gap-1.5"
                      >
                        {copiedId === message.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" weight="bold" />
                            <span className="text-xs text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-slate-500" />
                            <span className="text-xs text-slate-500">Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-white/[0.06] p-4 bg-[#09090B]/80 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none text-sm"
                  rows={1}
                  disabled={isLoading}
                />
              </div>
              
              {isLoading ? (
                <button
                  onClick={stopGeneration}
                  className="px-4 py-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 transition-all duration-300 flex items-center gap-2"
                >
                  <Stop className="h-5 w-5" weight="fill" />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || !selectedModel}
                  className="px-4 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
                >
                  <PaperPlaneTilt className="h-5 w-5" weight="fill" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="relative z-10 w-80 border-l border-white/[0.06] bg-[#09090B]/90 flex flex-col">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="text-white font-semibold">Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* System Prompt */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">System Prompt</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none text-sm"
                rows={4}
                placeholder="Enter system instructions..."
              />
            </div>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Temperature</label>
                <span className="text-sm text-cyan-400 font-mono">{temperature.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/[0.05] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Max Tokens</label>
                <span className="text-sm text-cyan-400 font-mono">{maxTokens.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="256"
                max="32768"
                step="256"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full h-2 bg-white/[0.05] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
