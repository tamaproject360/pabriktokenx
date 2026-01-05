import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Send,
  Square,
  Trash2,
  Settings,
  ChevronDown,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Bot,
  User,
  MessageSquare,
  Zap,
  X,
  Plus,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '../components/ui';
import { listAuthFiles, getAuthKey, getAPIKeys } from '../lib/api';

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
  gemini: 'from-blue-500 to-cyan-500',
  'gemini-cli': 'from-blue-500 to-cyan-500',
  claude: 'from-orange-500 to-amber-500',
  'claude-code': 'from-orange-500 to-amber-500',
  anthropic: 'from-orange-500 to-amber-500',
  openai: 'from-green-500 to-emerald-500',
  codex: 'from-green-500 to-emerald-500',
  qwen: 'from-purple-500 to-pink-500',
  iflow: 'from-cyan-500 to-teal-500',
  antigravity: 'from-indigo-500 to-purple-500',
  vertex: 'from-red-500 to-orange-500',
};

const getProviderColor = (type: string): string => {
  const lowerType = type.toLowerCase();
  for (const [key, value] of Object.entries(PROVIDER_COLORS)) {
    if (lowerType.includes(key)) return value;
  }
  return 'from-gray-500 to-gray-600';
};

const generateId = () => Math.random().toString(36).substring(2, 15);

// Helper to fetch models for an auth file
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
  const [showHistory, setShowHistory] = useState(true);
  const [providers, setProviders] = useState<AvailableProvider[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch API keys for chat completions
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await getAPIKeys();
        const keys = response.data?.['api-keys'] || [];
        if (keys.length > 0) {
          setApiKey(keys[0]);
        }
      } catch (err) {
        console.error('Failed to fetch API keys:', err);
      }
    };
    fetchApiKey();
  }, []);

  // Fetch auth files
  const { data: authFilesData, isLoading: authFilesLoading, error: authFilesError } = useQuery({
    queryKey: ['authFiles'],
    queryFn: async () => {
      const response = await listAuthFiles();
      return response.data;
    },
  });

  // Fetch models for each auth file
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

      // Set default selection
      if (providersList.length > 0 && providersList[0].models.length > 0) {
        setSelectedAuthFile(providersList[0].authFile);
        setSelectedModel(providersList[0].models[0].id);
      }
    };

    fetchModels();
  }, [authFilesData]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // Load conversations from localStorage
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

  // Save conversations to localStorage
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

      // Update conversation history
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

  const regenerateLastResponse = () => {
    if (messages.length < 2) return;
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMessage) {
      setMessages(prev => prev.slice(0, -1));
      setInput(lastUserMessage.content);
    }
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

  // Loading state
  if (authFilesLoading || modelsLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-gray-950">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading available models...</p>
        </div>
      </div>
    );
  }

  // Error or no auth files
  if (authFilesError || providers.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-gray-950">
        <div className="text-center max-w-md px-4">
          <div className="h-16 w-16 mx-auto mb-6 rounded-2xl bg-gray-800 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Models Available</h2>
          <p className="text-gray-400 mb-6">
            {authFilesError 
              ? 'Failed to load auth files. Please check your connection.'
              : 'No OAuth accounts found. Please login via OAuth first to use the Playground.'}
          </p>
          <Button 
            variant="primary" 
            onClick={() => window.location.href = '/oauth'}
          >
            Go to OAuth Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-950">
      {/* Conversation History Sidebar */}
      {showHistory && (
        <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800">
            <Button
              variant="primary"
              className="w-full justify-center"
              icon={Plus}
              onClick={clearChat}
            >
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {conversations.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                      currentConversationId === conv.id
                        ? 'bg-gray-800 text-white'
                        : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                    }`}
                    onClick={() => loadConversation(conv)}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{conv.title}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              <MessageSquare className="h-5 w-5" />
            </button>

            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              >
                <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${currentProvider ? getProviderColor(currentProvider.type) : 'from-gray-500 to-gray-600'}`} />
                <span className="text-sm font-medium text-white">
                  {currentModel?.display_name || currentModel?.id || 'Select Model'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {showModelSelector && (
                <div className="absolute top-full left-0 mt-2 w-96 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-gray-700">
                    <div className="text-xs text-gray-500 uppercase tracking-wider px-2 py-1">Select Model</div>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {providers.map(provider => (
                      <div key={provider.authFile} className="mb-3">
                        <div className="text-xs text-gray-500 uppercase tracking-wider px-2 py-1 flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${getProviderColor(provider.type)}`} />
                          <span>{provider.type}</span>
                          {provider.email && (
                            <span className="text-gray-600 normal-case">({provider.email})</span>
                          )}
                        </div>
                        {provider.models.map(model => (
                          <button
                            key={`${provider.authFile}-${model.id}`}
                            onClick={() => {
                              setSelectedAuthFile(provider.authFile);
                              setSelectedModel(model.id);
                              setShowModelSelector(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                              selectedModel === model.id && selectedAuthFile === provider.authFile
                                ? 'bg-blue-600/20 text-blue-400'
                                : 'text-gray-300 hover:bg-gray-700'
                            }`}
                          >
                            <div className="font-medium text-sm">{model.display_name || model.id}</div>
                            {model.type && (
                              <div className="text-xs text-gray-500">{model.type}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={RefreshCw} onClick={regenerateLastResponse} disabled={messages.length < 2}>
              Regenerate
            </Button>
            <Button variant="ghost" size="sm" icon={Trash2} onClick={clearChat} disabled={messages.length === 0}>
              Clear
            </Button>
            <Button variant="ghost" size="sm" icon={Settings} onClick={() => setShowSettings(!showSettings)}>
              Settings
            </Button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md px-4">
                  <div className="h-16 w-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">AI Playground</h2>
                  <p className="text-gray-400 mb-6">
                    Test your authenticated models with a chat interface. 
                    Select a model and start chatting!
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {['Write code', 'Explain concept', 'Debug issue', 'Generate ideas'].map(suggestion => (
                      <button
                        key={suggestion}
                        onClick={() => setInput(`${suggestion}: `)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-sm text-gray-300 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${currentProvider ? getProviderColor(currentProvider.type) : 'from-gray-500 to-gray-600'} flex items-center justify-center flex-shrink-0`}>
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                    )}
                    
                    <div className={`max-w-3xl ${message.role === 'user' ? 'order-first' : ''}`}>
                      <div
                        className={`px-4 py-3 rounded-2xl ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-100'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{message.content}</div>
                        {message.role === 'assistant' && isLoading && messages[messages.length - 1]?.id === message.id && (
                          <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                        )}
                      </div>
                      
                      {message.role === 'assistant' && message.content && (
                        <div className="flex items-center gap-2 mt-1 px-2">
                          <button
                            onClick={() => copyToClipboard(message.content, message.id)}
                            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {message.model && (
                            <span className="text-xs text-gray-600">{message.model}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {message.role === 'user' && (
                      <div className="h-8 w-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-gray-300" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="w-80 border-l border-gray-800 bg-gray-900 overflow-y-auto">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white">Settings</h3>
                  <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-800 rounded">
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">System Prompt</label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder="Enter system prompt..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Temperature: {temperature}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>Precise</span>
                      <span>Creative</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Max Tokens: {maxTokens}
                    </label>
                    <input
                      type="range"
                      min="256"
                      max="32768"
                      step="256"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="w-full accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>256</span>
                      <span>32768</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-800">
                    <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Quick Tips
                    </h4>
                    <ul className="text-xs text-gray-500 space-y-1">
                      <li>• Press Enter to send, Shift+Enter for new line</li>
                      <li>• Lower temperature = more focused responses</li>
                      <li>• Higher max tokens = longer responses</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-gray-800 rounded-2xl border border-gray-700 focus-within:border-blue-500 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message..."
                className="w-full px-4 py-3 pr-24 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none max-h-48"
                rows={1}
                disabled={isLoading || !selectedModel}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-2">
                {isLoading ? (
                  <Button variant="danger" size="sm" icon={Square} onClick={stopGeneration}>
                    Stop
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Send}
                    onClick={sendMessage}
                    disabled={!input.trim() || !selectedModel}
                  >
                    Send
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-600 text-center mt-2">
              Using {currentModel?.display_name || currentModel?.id || 'No model selected'} • Responses may vary
            </p>
          </div>
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {showModelSelector && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowModelSelector(false)}
        />
      )}
    </div>
  );
}
