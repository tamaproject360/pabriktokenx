import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Info,
  DownloadSimple,
  Shield,
  FilePdf,
  FileText,
  CaretLeft,
  CaretRight,
} from 'phosphor-react';
import { listAuthFiles, getAuthKey, getAPIKeys, getModelSettings } from '../lib/api';
import type { ModelSetting } from '../lib/api';
import { animateFadeIn, durations } from '../lib/animations';

// Toast notification types
interface Toast {
  id: string;
  type: 'info' | 'success' | 'error' | 'loading';
  message: string;
  duration?: number;
}

// Toast Notifications Component
function ToastContainer({ toasts, onRemove }: { toasts: Toast[], onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-md border transition-all duration-300 animate-slide-in ${
            toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' :
            toast.type === 'error' ? 'bg-red-500/20 border-red-500/30 text-red-300' :
            toast.type === 'loading' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300' :
            'bg-slate-700/80 border-slate-600/30 text-slate-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="h-5 w-5" weight="fill" />}
          {toast.type === 'error' && <XCircle className="h-5 w-5" weight="fill" />}
          {toast.type === 'loading' && <CircleNotch className="h-5 w-5 animate-spin" />}
          {toast.type === 'info' && <Info className="h-5 w-5" weight="fill" />}
          <span className="text-sm font-medium">{toast.message}</span>
          {toast.type !== 'loading' && (
            <button onClick={() => onRemove(toast.id)} className="ml-2 hover:opacity-70">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

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
  images?: string[]; // Array of base64 image data URLs
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
  status?: string;
  status_message?: string;
  disabled?: boolean;
  unavailable?: boolean;
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
  status?: string;
  statusMessage?: string;
}

/**
 * Provider category groups all accounts of the same type
 * and shows only unique models.
 */
interface ProviderCategory {
  type: string;
  models: ModelInfo[];
  totalAccounts: number;
  activeAccounts: number;
  status: string;
  statusLabel: string;
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
  'github-copilot': '#6366F1',
  copilot: '#6366F1',
};

const getProviderColor = (type: string): string => {
  const lowerType = type.toLowerCase();
  for (const [key, value] of Object.entries(PROVIDER_COLORS)) {
    if (lowerType.includes(key)) return value;
  }
  return '#64748B';
};

/**
 * Determine auth file status for display in playground.
 * Checks status_message for rate-limit vs unsupported API vs real errors.
 */
const getPlaygroundAuthStatus = (file: AuthFileInfo): { status: string; label: string; color: string } => {
  if (file.disabled) return { status: 'disabled', label: 'Inactive', color: '#EAB308' };
  const st = (file.status || '').toLowerCase();
  const msg = (file.status_message || '').toLowerCase();

  if (st === 'error' || file.unavailable) {
    // Rate-limited (429 / quota exhausted) - temporary, will recover
    if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('resource_exhausted')) {
      return { status: 'rate-limited', label: 'Rate Limited', color: '#F59E0B' };
    }
    // Unsupported API endpoint - account works, backend just tested against an incompatible model
    // Treat as active since other models work fine
    if (msg.includes('unsupported') || msg.includes('not accessible') || msg.includes('not supported')) {
      return { status: 'active', label: 'Active', color: '#22C55E' };
    }
    // Auth/token errors
    if (msg.includes('unauthorized') || msg.includes('401') || msg.includes('403') || msg.includes('invalid_token')) {
      return { status: 'error', label: 'Auth Error', color: '#EF4444' };
    }
    // Generic error
    return { status: 'error', label: 'Error', color: '#EF4444' };
  }

  if (st === 'active' || st === '' || st === 'unknown') return { status: 'active', label: 'Active', color: '#22C55E' };
  if (st === 'pending') return { status: 'pending', label: 'Pending', color: '#3B82F6' };
  if (st === 'refreshing') return { status: 'refreshing', label: 'Refreshing', color: '#06B6D4' };
  return { status: 'active', label: 'Active', color: '#22C55E' };
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
  const [selectedProviderType, setSelectedProviderType] = useState<string>('');
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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Toast helper functions
  const addToast = useCallback((type: Toast['type'], message: string, duration?: number) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, type, message, duration }]);
    if (type !== 'loading' && duration !== 0) {
      setTimeout(() => removeToast(id), duration || 4000);
    }
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateToast = useCallback((id: string, type: Toast['type'], message: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, type, message } : t));
    if (type !== 'loading') {
      setTimeout(() => removeToast(id), 4000);
    }
  }, [removeToast]);

  // Check if model is image generation model
  const isImageModel = useCallback((modelName: string) => {
    const lower = modelName.toLowerCase();
    return lower.includes('image') || lower.includes('dall-e') || lower.includes('imagen');
  }, []);

  // Export chat to markdown
  const exportChatToMarkdown = useCallback(() => {
    if (messages.length === 0) {
      addToast('error', 'No messages to export');
      return;
    }

    let markdown = `# Chat Export\n\n`;
    markdown += `**Model:** ${selectedModel}\n`;
    markdown += `**Date:** ${new Date().toLocaleString()}\n\n`;
    markdown += `---\n\n`;

    messages.forEach((message, index) => {
      const role = message.role === 'user' ? '👤 **User**' : '🤖 **Assistant**';
      markdown += `### ${role}\n\n`;
      
      if (message.content) {
        markdown += `${message.content}\n\n`;
      }
      
      if (message.images && message.images.length > 0) {
        markdown += `**Generated Images:** ${message.images.length}\n\n`;
        message.images.forEach((img, idx) => {
          markdown += `![Generated Image ${idx + 1}](${img})\n\n`;
        });
      }
      
      if (index < messages.length - 1) {
        markdown += `---\n\n`;
      }
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addToast('success', '📥 Chat exported as Markdown!');
  }, [messages, selectedModel, addToast]);

  // Export chat to PDF
  const exportChatToPDF = useCallback(() => {
    if (messages.length === 0) {
      addToast('error', 'No messages to export');
      return;
    }

    // Create a printable HTML content
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Chat Export</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            background: white;
            color: #1a1a1a;
          }
          h1 { color: #0ea5e9; margin-bottom: 10px; }
          .metadata { color: #64748b; margin-bottom: 30px; font-size: 14px; }
          .message {
            margin-bottom: 30px;
            padding: 20px;
            border-radius: 8px;
            page-break-inside: avoid;
          }
          .message.user {
            background: #f0f9ff;
            border-left: 4px solid #0ea5e9;
          }
          .message.assistant {
            background: #f8fafc;
            border-left: 4px solid #8b5cf6;
          }
          .message-header {
            font-weight: 600;
            margin-bottom: 10px;
            color: #0ea5e9;
          }
          .message.assistant .message-header { color: #8b5cf6; }
          .message-content {
            white-space: pre-wrap;
            line-height: 1.6;
          }
          .message-content code {
            background: #e2e8f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
          }
          .message-content pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #e2e8f0;
            padding: 10px;
            text-align: left;
          }
          th {
            background: #f1f5f9;
            font-weight: 600;
            color: #0ea5e9;
          }
          tr:nth-child(even) { background: #f8fafc; }
          hr { border: none; border-top: 2px solid #e2e8f0; margin: 20px 0; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <h1>💬 Chat Export</h1>
        <div class="metadata">
          <div><strong>Model:</strong> ${selectedModel}</div>
          <div><strong>Date:</strong> ${new Date().toLocaleString()}</div>
          <div><strong>Messages:</strong> ${messages.length}</div>
        </div>
        <hr>
    `;

    messages.forEach((message) => {
      const role = message.role === 'user' ? 'user' : 'assistant';
      const icon = message.role === 'user' ? '👤' : '🤖';
      const label = message.role === 'user' ? 'User' : 'Assistant';
      
      // Helper function to escape HTML
      const escapeHtml = (text: string) => {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
      };
      
      html += `
        <div class="message ${role}">
          <div class="message-header">${icon} ${label}</div>
          <div class="message-content">${escapeHtml(message.content || '')}</div>
      `;
      
      if (message.images && message.images.length > 0) {
        html += `<div style="margin-top: 15px; color: #64748b;"><em>🖼️ ${message.images.length} image(s) generated</em></div>`;
      }
      
      html += `</div>`;
    });

    html += `
        <hr>
        <div style="text-align: center; color: #94a3b8; font-size: 12px; margin-top: 30px;">
          Exported from Pabrik Token v2.8 • ${new Date().toLocaleDateString()}
        </div>
      </body>
      </html>
    `;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Wait for content to load, then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          addToast('success', '🖨️ PDF print dialog opened!');
        }, 250);
      };
    } else {
      addToast('error', 'Please allow popups to export PDF');
    }
    
    setShowExportMenu(false);
  }, [messages, selectedModel, addToast]);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await getAPIKeys();
        const keys = response.data?.['api-keys'] || [];
        console.log('Fetched proxy keys:', keys.length > 0 ? `Found ${keys.length} keys` : 'No keys found');
        if (keys.length > 0 && typeof keys[0] === 'object' && 'key' in keys[0]) {
          setApiKey(keys[0].key);
          console.log('Using proxy key for authentication');
        } else if (keys.length > 0 && typeof keys[0] === 'string') {
          setApiKey(keys[0]);
          console.log('Using proxy key for authentication');
        } else {
          console.warn('No proxy API keys configured. Please add a key in config.yaml or via Proxy Keys page.');
        }
      } catch (err) {
        console.error('Failed to fetch API keys:', err);
        console.error('Make sure you are logged in with a valid management key');
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

  // Fetch model settings to filter enabled/disabled models
  const { data: modelSettingsData } = useQuery({
    queryKey: ['modelSettings'],
    queryFn: async () => {
      const response = await getModelSettings();
      return response.data;
    },
  });

  // Store all models (unfiltered) from auth files
  const [allProviders, setAllProviders] = useState<AvailableProvider[]>([]);

  // Helper to check if a model is enabled
  const isModelEnabled = useCallback((modelId: string, authFile: string): boolean => {
    if (!modelSettingsData?.models) return true; // Default to enabled if no settings
    const setting = modelSettingsData.models.find(
      (s: ModelSetting) => s.model_id === modelId && s.auth_file === authFile
    );
    return setting?.enabled !== false; // Default to enabled if not found
  }, [modelSettingsData]);

  // Fetch all models from auth files (only when authFilesData changes)
  useEffect(() => {
    const fetchModels = async () => {
      if (!authFilesData?.files || authFilesData.files.length === 0) {
        setAllProviders([]);
        return;
      }

      setModelsLoading(true);
      const providersList: AvailableProvider[] = [];

      for (const file of authFilesData.files as AuthFileInfo[]) {
        try {
          const models = await fetchModelsForAuthFile(file.name);
          if (models.length > 0) {
            const authStatus = getPlaygroundAuthStatus(file);
            providersList.push({
              authFile: file.name,
              email: file.email,
              type: file.type || 'unknown',
              models: models,
              status: authStatus.status,
              statusMessage: authStatus.label,
            });
          }
        } catch (err) {
          console.error(`Failed to fetch models for ${file.name}:`, err);
        }
      }

      setAllProviders(providersList);
      setModelsLoading(false);
    };

    fetchModels();
  }, [authFilesData]);

  // Filter providers based on model settings (runs when settings or all providers change)
  useEffect(() => {
    if (allProviders.length === 0) {
      setProviders([]);
      return;
    }

    // Filter out disabled models from each provider
    const filteredProviders: AvailableProvider[] = [];
    for (const provider of allProviders) {
      const enabledModels = provider.models.filter((model: ModelInfo) =>
        isModelEnabled(model.id, provider.authFile)
      );
      if (enabledModels.length > 0) {
        filteredProviders.push({
          ...provider,
          models: enabledModels,
        });
      }
    }

    setProviders(filteredProviders);
  }, [allProviders, isModelEnabled]);

  /**
   * Group providers by category type and deduplicate models.
   * Each category shows unique models across all accounts of that type.
   */
  const providerCategories = useMemo((): ProviderCategory[] => {
    const categoryMap = new Map<string, {
      models: Map<string, ModelInfo>;
      totalAccounts: number;
      activeAccounts: number;
      statuses: string[];
    }>();

    for (const provider of providers) {
      const type = provider.type.toLowerCase();
      if (!categoryMap.has(type)) {
        categoryMap.set(type, { models: new Map(), totalAccounts: 0, activeAccounts: 0, statuses: [] });
      }
      const cat = categoryMap.get(type)!;
      cat.totalAccounts++;
      const st = provider.status || 'active';
      cat.statuses.push(st);
      // Only truly active/pending/refreshing count as active
      // rate-limited and warning are usable but degraded
      if (st === 'active' || st === 'pending' || st === 'refreshing') {
        cat.activeAccounts++;
      }
      for (const model of provider.models) {
        const displayName = (model.display_name || model.id).toLowerCase();
        // Deduplicate by display_name — keep canonical (shorter) model ID
        const existingKey = Array.from(cat.models.entries()).find(
          ([, m]) => (m.display_name || m.id).toLowerCase() === displayName
        );
        if (existingKey) {
          // Keep the shorter (canonical) ID version
          if (model.id.length < existingKey[0].length) {
            cat.models.delete(existingKey[0]);
            cat.models.set(model.id, model);
          }
        } else {
          cat.models.set(model.id, model);
        }
      }
    }

    const categories: ProviderCategory[] = [];
    for (const [type, data] of categoryMap) {
      // Determine aggregate status
      let status = 'error';
      let statusLabel = 'Error';
      if (data.activeAccounts > 0) {
        status = 'active';
        statusLabel = `${data.activeAccounts}/${data.totalAccounts} active`;
      } else if (data.statuses.includes('rate-limited')) {
        status = 'rate-limited';
        const rlCount = data.statuses.filter(s => s === 'rate-limited').length;
        statusLabel = `${rlCount}/${data.totalAccounts} rate limited`;
      } else if (data.statuses.includes('disabled')) {
        status = 'disabled';
        statusLabel = 'Inactive';
      }

      categories.push({
        type,
        models: Array.from(data.models.values()),
        totalAccounts: data.totalAccounts,
        activeAccounts: data.activeAccounts,
        status,
        statusLabel,
      });
    }

    return categories;
  }, [providers]);

  // Set initial selection when categories change
  useEffect(() => {
    if (providerCategories.length === 0) return;
    // If no model selected yet, pick the first one
    if (!selectedModel) {
      const first = providerCategories[0];
      setSelectedProviderType(first.type);
      if (first.models.length > 0) {
        setSelectedModel(first.models[0].id);
      }
    }
    // If current model no longer exists in any category, reset
    const modelExists = providerCategories.some(c => c.models.some(m => m.id === selectedModel));
    if (selectedModel && !modelExists && providerCategories.length > 0) {
      const first = providerCategories[0];
      setSelectedProviderType(first.type);
      setSelectedModel(first.models[0]?.id || '');
    }
  }, [providerCategories, selectedModel]);

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

  const getCurrentCategory = () => providerCategories.find(c => c.type === selectedProviderType);
  const getCurrentModel = () => {
    const category = getCurrentCategory();
    return category?.models.find(m => m.id === selectedModel);
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

    // Check if this is an image generation request
    const isImageRequest = isImageModel(selectedModel);
    let toastId: string | undefined;
    
    if (isImageRequest) {
      setIsGeneratingImage(true);
      toastId = addToast('loading', '🎨 Generating image... This may take 10-30 seconds');
    }

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

      // Filter out assistant messages with empty content (incomplete responses)
      const filteredMessages = messages.filter(m => 
        m.role === 'user' || (m.role === 'assistant' && m.content && m.content.trim() !== '')
      );

      const apiMessages = [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...filteredMessages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage.content },
      ];

      // Build request body with proper modalities for image generation
      const requestBody: any = {
        model: selectedModel,
        messages: apiMessages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      };

      // Add modalities for image generation models
      if (isImageRequest) {
        requestBody.modalities = ['image', 'text'];
      }

      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Chat completion failed: ${response.status} - ${errorText}`);
        console.error('Request model:', selectedModel, 'Has API key:', !!apiKey);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No reader available');

      let fullContent = '';
      const generatedImages: string[] = [];
      let imageFound = false;

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        
        // Split buffer by newlines and process complete lines
        const lines = buffer.split('\n');
        // Keep the last potentially incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              fullContent += content;

              // Check for image generation in streaming response (delta.images)
              const deltaImages = parsed.choices?.[0]?.delta?.images;
              if (deltaImages) {
                deltaImages.forEach((img: { image_url?: { url?: string }; url?: string }) => {
                  const imageUrl = img.image_url?.url || img.url;
                  if (imageUrl && !generatedImages.includes(imageUrl)) {
                    generatedImages.push(imageUrl);
                    imageFound = true;
                  }
                });
              }
              // Check for image generation in non-streaming response (message.images)
              if (parsed.choices?.[0]?.message?.images) {
                const msgImages = parsed.choices[0].message.images;
                msgImages.forEach((img: { image_url?: { url?: string }; url?: string }) => {
                  const imageUrl = img.image_url?.url || img.url;
                  if (imageUrl && !generatedImages.includes(imageUrl)) {
                    generatedImages.push(imageUrl);
                    imageFound = true;
                  }
                });
              }
              // OpenAI DALL-E format
              if (parsed.data && Array.isArray(parsed.data)) {
                parsed.data.forEach((item: { url?: string; b64_json?: string }) => {
                  if (item.url && !generatedImages.includes(item.url)) {
                    generatedImages.push(item.url);
                    imageFound = true;
                  } else if (item.b64_json) {
                    const imgUrl = `data:image/png;base64,${item.b64_json}`;
                    if (!generatedImages.includes(imgUrl)) {
                      generatedImages.push(imgUrl);
                      imageFound = true;
                    }
                  }
                });
              }
              
              // Check for base64 image data directly in message.content (Gemini image generation format)
              // Gemini returns base64 directly in content field as a very long string
              const messageContent = parsed.choices?.[0]?.message?.content || parsed.choices?.[0]?.delta?.content;
              if (messageContent && typeof messageContent === 'string' && messageContent.length > 1000) {
                // Check for common base64 image signatures
                const isJpeg = messageContent.startsWith('/9j/'); // JPEG magic bytes in base64
                const isPng = messageContent.startsWith('iVBOR'); // PNG magic bytes in base64
                const isGif = messageContent.startsWith('R0lGOD'); // GIF magic bytes in base64
                const isWebp = messageContent.startsWith('UklGR'); // WebP magic bytes in base64
                
                if (isJpeg || isPng || isGif || isWebp) {
                  const mimeType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isGif ? 'image/gif' : 'image/webp';
                  const imgUrl = `data:${mimeType};base64,${messageContent}`;
                  if (!generatedImages.includes(imgUrl)) {
                    generatedImages.push(imgUrl);
                    imageFound = true;
                    // Clear fullContent since this is an image, not text
                    fullContent = '';
                  }
                }
              }

              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMessage.id
                    ? { ...m, content: fullContent, images: generatedImages.length > 0 ? [...generatedImages] : undefined }
                    : m
                )
              );
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      // After streaming is complete, check if fullContent is actually a base64 image
      // This handles cases where the entire base64 string was streamed piece by piece
      if (fullContent && fullContent.length > 1000 && generatedImages.length === 0) {
        const trimmedContent = fullContent.trim();
        const isJpeg = trimmedContent.startsWith('/9j/');
        const isPng = trimmedContent.startsWith('iVBOR');
        const isGif = trimmedContent.startsWith('R0lGOD');
        const isWebp = trimmedContent.startsWith('UklGR');
        
        if (isJpeg || isPng || isGif || isWebp) {
          const mimeType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : isGif ? 'image/gif' : 'image/webp';
          const imgUrl = `data:${mimeType};base64,${trimmedContent}`;
          generatedImages.push(imgUrl);
          imageFound = true;
          fullContent = ''; // Clear the text content since it's an image
          
          // Update the message with the image
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessage.id
                ? { ...m, content: '', images: [...generatedImages] }
                : m
            )
          );
        }
      }

      // Show success toast for image generation
      if (isImageRequest && toastId) {
        if (imageFound && generatedImages.length > 0) {
          updateToast(toastId, 'success', `✨ Image generated successfully! (${generatedImages.length} image${generatedImages.length > 1 ? 's' : ''})`);
        } else if (!fullContent && !imageFound) {
          updateToast(toastId, 'error', '❌ Failed to generate image. Please try again.');
        } else {
          removeToast(toastId);
        }
      }

      const title = userMessage.content.slice(0, 50) + (userMessage.content.length > 50 ? '...' : '');
      const finalMessage = { ...assistantMessage, content: fullContent, images: generatedImages.length > 0 ? [...generatedImages] : undefined };
      
      if (currentConversationId) {
        setConversations(prev =>
          prev.map(c =>
            c.id === currentConversationId
              ? { ...c, messages: [...messages, userMessage, finalMessage] }
              : c
          )
        );
      } else {
        const newConv: ConversationHistory = {
          id: generateId(),
          title,
          messages: [userMessage, finalMessage],
          model: selectedModel,
          createdAt: new Date(),
        };
        setConversations(prev => [newConv, ...prev]);
        setCurrentConversationId(newConv.id);
      }

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // Request was cancelled
        if (toastId) {
          updateToast(toastId, 'info', 'Generation cancelled');
        }
      } else {
        console.error('Chat error:', error);
        const errorMessage = (error as Error).message;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessage.id
              ? { ...m, content: `Error: ${errorMessage}` }
              : m
          )
        );
        if (isImageRequest && toastId) {
          updateToast(toastId, 'error', `❌ Failed: ${errorMessage.slice(0, 50)}${errorMessage.length > 50 ? '...' : ''}`);
        } else {
          addToast('error', `Request failed: ${errorMessage.slice(0, 50)}${errorMessage.length > 50 ? '...' : ''}`);
        }
      }
    } finally {
      setIsLoading(false);
      setIsGeneratingImage(false);
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

  const currentCategory = getCurrentCategory();
  const currentModel = getCurrentModel();
  const providerColor = currentCategory ? getProviderColor(currentCategory.type) : '#64748B';
  const currentCategoryStatusColor = currentCategory?.status === 'active' ? '#22C55E' :
    currentCategory?.status === 'rate-limited' ? '#F59E0B' :
    currentCategory?.status === 'error' ? '#EF4444' :
    currentCategory?.status === 'disabled' ? '#EAB308' : '#22C55E';

  const filteredCategories = providerCategories.map(cat => ({
    ...cat,
    models: cat.models.filter(model =>
      model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(cat => cat.models.length > 0);

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
            className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
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
      
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      {/* Sidebar - Chat History */}
      <div className="relative z-10 flex-shrink-0">
        <div 
          className={`h-full border-r border-white/[0.06] flex flex-col bg-[#09090B]/90 transition-all duration-300 ease-in-out ${
            sidebarCollapsed ? 'w-12' : 'w-64'
          }`}
        >
          {sidebarCollapsed ? (
            /* Collapsed: icon-only strip */
            <div className="flex flex-col items-center pt-4 gap-3">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                title="Expand sidebar"
              >
                <CaretRight className="h-4 w-4 text-slate-400" weight="bold" />
              </button>
              <div className="w-6 h-px bg-white/[0.08]" />
              <button
                onClick={() => { setSidebarCollapsed(false); clearChat(); }}
                className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                title="New Chat"
              >
                <PencilSimple className="h-4 w-4 text-cyan-400" weight="bold" />
              </button>
              {conversations.length > 0 && (
                <div className="w-6 h-px bg-white/[0.08]" />
              )}
              {conversations.slice(0, 5).map(conv => (
                <button
                  key={conv.id}
                  onClick={() => { setSidebarCollapsed(false); loadConversation(conv); }}
                  className={`p-2 rounded-lg transition-colors ${
                    currentConversationId === conv.id
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'hover:bg-white/[0.05] text-slate-500'
                  }`}
                  title={conv.title}
                >
                  <ChatDots className="h-4 w-4" />
                </button>
              ))}
              {conversations.length > 5 && (
                <span className="text-[10px] text-slate-600">+{conversations.length - 5}</span>
              )}
            </div>
          ) : (
            /* Expanded: full sidebar */
            <>
              <div className="p-4 border-b border-white/[0.06] flex items-center gap-2">
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors flex-shrink-0"
                  title="Collapse sidebar"
                >
                  <CaretLeft className="h-4 w-4 text-slate-400" weight="bold" />
                </button>
                <button
                  onClick={clearChat}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300"
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
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="relative z-10 flex-1 flex flex-col">
        {/* Header */}
        <div className="h-16 border-b border-white/[0.06] flex items-center justify-between px-6 bg-[#09090B]/80 backdrop-blur-sm relative z-50">
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
              {currentCategory && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                  style={{ background: `${currentCategoryStatusColor}20`, color: currentCategoryStatusColor }}
                >
                  {currentCategory.statusLabel}
                </span>
              )}
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${showModelSelector ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Model Selector Dropdown */}
            {showModelSelector && (
              <>
                <div className="fixed inset-0 z-[100] bg-black/20" onClick={() => setShowModelSelector(false)} />
                <div className="absolute top-full left-0 mt-2 w-96 bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl z-[101] overflow-hidden">
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
                    {filteredCategories.map(category => {
                      const statusColor = category.status === 'active' ? '#22C55E' :
                        category.status === 'rate-limited' ? '#F59E0B' :
                        category.status === 'error' ? '#EF4444' :
                        category.status === 'disabled' ? '#EAB308' : '#22C55E';
                      return (
                      <div key={category.type} className="mb-3">
                        <div className="flex items-center gap-2 px-3 py-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ background: getProviderColor(category.type) }}
                          />
                          <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                            {category.type}
                          </span>
                          <span className="text-[10px] text-slate-600 tabular-nums">
                            {category.totalAccounts} {category.totalAccounts === 1 ? 'account' : 'accounts'}
                          </span>
                          <span
                            className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ 
                              background: `${statusColor}20`,
                              color: statusColor,
                            }}
                          >
                            {category.statusLabel}
                          </span>
                        </div>
                        {category.models.map(model => (
                          <button
                            key={`${category.type}-${model.id}`}
                            onClick={() => {
                              setSelectedProviderType(category.type);
                              setSelectedModel(model.id);
                              setShowModelSelector(false);
                              setSearchQuery('');
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 ${
                              selectedModel === model.id && selectedProviderType === category.type
                                ? 'bg-cyan-500/10 border border-cyan-500/20'
                                : 'hover:bg-white/[0.03]'
                            }`}
                          >
                            <span className={`text-sm pl-4 ${selectedModel === model.id && selectedProviderType === category.type ? 'text-white' : 'text-slate-300'}`}>
                              {model.display_name || model.id}
                            </span>
                          </button>
                        ))}
                      </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2.5 rounded-xl transition-all duration-300 hover:bg-white/[0.05] text-slate-400 hover:text-cyan-400"
                  title="Export chat"
                >
                  <DownloadSimple className="h-5 w-5" weight="bold" />
                </button>
                
                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute top-full right-0 mt-2 w-48 bg-[#0a0a0c] border border-white/10 rounded-xl shadow-2xl z-[101] overflow-hidden">
                      <button
                        onClick={exportChatToMarkdown}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05] transition-colors"
                      >
                        <FileText className="h-4 w-4 text-cyan-400" weight="bold" />
                        <span>Export as Markdown</span>
                      </button>
                      <button
                        onClick={exportChatToPDF}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-white/[0.05] transition-colors border-t border-white/[0.06]"
                      >
                        <FilePdf className="h-4 w-4 text-rose-400" weight="bold" />
                        <span>Export as PDF</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl transition-all duration-300 ${showSettings ? 'bg-cyan-500/20 text-cyan-400' : 'hover:bg-white/[0.05] text-slate-400'}`}
            >
              <GearSix className="h-5 w-5" weight="bold" />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div ref={chatContainerRef} className={`flex-1 overflow-y-auto ${messages.length === 0 ? 'flex flex-col' : ''}`}>
          {/* API Key Warning */}
          {!apiKey && (
            <div className={`max-w-4xl mx-auto px-6 ${messages.length === 0 ? 'mt-8' : 'mt-4'}`}>
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
            <div className="h-full flex items-center justify-center px-4">
              <div className="w-full max-w-3xl">
                {/* Title and Icon */}
                <div className="text-center mb-8">
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
                  <p className="text-slate-400 text-sm mb-8">
                    Test your authenticated models with real-time streaming responses.
                  </p>
                </div>

                {/* Centered Input Area */}
                <div>
                  {/* Image Generation Hint */}
                  {isImageModel(selectedModel) && (
                    <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
                      <ImageIcon className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" weight="duotone" />
                      <div className="flex-1">
                        <p className="text-sm text-purple-300 font-medium">🎨 Image Generation Mode</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Prompt contoh: <span className="text-cyan-400 font-mono">"Generate an image of a futuristic motorcycle"</span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          💡 Gunakan prompt dalam Bahasa Inggris untuk hasil terbaik. Jelaskan gambar yang ingin dibuat dengan detail.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isImageModel(selectedModel) ? "Describe the image you want to generate..." : "Type your message..."}
                        className="w-full px-5 py-4 bg-white/[0.05] border border-white/[0.12] rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-none text-base shadow-2xl"
                        rows={1}
                        disabled={isLoading}
                        autoFocus
                      />
                    </div>
                    
                    {isLoading ? (
                      <button
                        onClick={stopGeneration}
                        className="px-5 py-4 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:bg-rose-500/30 transition-all duration-300 flex items-center gap-2 shadow-2xl"
                      >
                        <Stop className="h-5 w-5" weight="fill" />
                      </button>
                    ) : (
                      <button
                        onClick={sendMessage}
                        disabled={!input.trim() || !selectedModel}
                        className="px-5 py-4 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2 shadow-2xl hover:shadow-cyan-500/25"
                      >
                        <PaperPlaneTilt className="h-5 w-5" weight="fill" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto py-8 px-6 pb-4">
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
                        <>
                          {/* Typing indicator - show when loading and no content yet */}
                          {isLoading && !message.content && !isGeneratingImage && (
                            <div className="flex items-center gap-3 py-1">
                              <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }} />
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.2s' }} />
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.2s' }} />
                              </div>
                              <span className="text-xs text-slate-500 animate-pulse">AI is thinking...</span>
                            </div>
                          )}
                          
                          {/* Streaming indicator - show when loading and content is being received */}
                          {isLoading && message.content && !isGeneratingImage && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                              <CircleNotch className="w-3 h-3 animate-spin text-cyan-400" />
                              <span>Generating response...</span>
                            </div>
                          )}

                          {message.content && (
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
                                table: ({ children }) => (
                                  <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
                                    <table className="min-w-full divide-y divide-white/10">{children}</table>
                                  </div>
                                ),
                                thead: ({ children }) => <thead className="bg-white/[0.03]">{children}</thead>,
                                tbody: ({ children }) => <tbody className="divide-y divide-white/10">{children}</tbody>,
                                tr: ({ children }) => <tr className="hover:bg-white/[0.02] transition-colors">{children}</tr>,
                                th: ({ children }) => (
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td className="px-4 py-3 text-sm text-slate-300 whitespace-nowrap">{children}</td>
                                ),
                              }}
                            >
                              {message.content || '...'}
                            </ReactMarkdown>
                          </div>
                          )}
                          
                          {/* Image Generation Loading Indicator - shown when no content yet */}
                          {isGeneratingImage && isLoading && !message.content && message.role === 'assistant' && (
                            <div className="mt-3 flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
                              <ImageIcon className="h-6 w-6 text-cyan-400 animate-pulse" weight="duotone" />
                              <div className="flex-1">
                                <p className="text-sm text-cyan-300 font-medium">🎨 Generating your image...</p>
                                <p className="text-xs text-slate-400 mt-0.5">This may take 10-30 seconds</p>
                              </div>
                              <CircleNotch className="h-6 w-6 text-cyan-400 animate-spin" />
                            </div>
                          )}
                          
                          {/* Display generated images */}
                          {message.images && message.images.length > 0 && (
                            <div className="mt-4 space-y-3">
                              {message.images.map((imageUrl, idx) => (
                                <div key={idx} className="relative group">
                                  <img 
                                    src={imageUrl} 
                                    alt={`Generated image ${idx + 1}`}
                                    className="rounded-xl border border-white/10 max-w-full h-auto"
                                  />
                                  <button
                                    onClick={() => {
                                      const link = document.createElement('a');
                                      link.href = imageUrl;
                                      link.download = `generated-image-${Date.now()}-${idx}.png`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    className="absolute top-2 right-2 p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm"
                                    title="Download image"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
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

        {/* Input Area - Only show when there are messages */}
        {messages.length > 0 && (
          <div className="border-t border-white/[0.06] p-4 bg-[#09090B]/80 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto">
              {/* Image Generation Hint */}
              {isImageModel(selectedModel) && (
                <div className="mb-3 flex items-start gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20">
                  <ImageIcon className="h-5 w-5 text-purple-400 mt-0.5 flex-shrink-0" weight="duotone" />
                  <div className="flex-1">
                    <p className="text-sm text-purple-300 font-medium">🎨 Image Generation Mode</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Prompt contoh: <span className="text-cyan-400 font-mono">"Generate an image of a futuristic motorcycle"</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      💡 Gunakan prompt dalam Bahasa Inggris untuk hasil terbaik. Jelaskan gambar yang ingin dibuat dengan detail.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isImageModel(selectedModel) ? "Describe the image you want to generate..." : "Type your message..."}
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
        )}
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
