import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, Eye, EyeOff, Settings, RefreshCw, Shield, Copy, Check, X } from 'lucide-react';
import { getAPIKeys, updateAPIKeys } from '../lib/api';
import { useState, useEffect, useRef, useCallback } from 'react';


// API Key Entry type
interface APIKeyEntry {
  key: string;
  'project-name'?: string;
}

// Ambient Background
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div 
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(249, 115, 22, 0.15), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}

// Generate a random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'cl';
  const length = 32;
  let result = prefix;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Mask API key for display
function maskApiKey(key: string): string {
  if (!key || key.length < 10) return key;
  return `${key.substring(0, 4)}${'*'.repeat(16)}${key.substring(key.length - 2)}`;
}

interface AddKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: APIKeyEntry) => void;
  isSaving: boolean;
}

function AddKeyModal({ isOpen, onClose, onAdd, isSaving }: AddKeyModalProps) {
  const [newKey, setNewKey] = useState(() => isOpen ? generateApiKey() : '');
  const [projectName, setProjectName] = useState('');
  const [showKey, setShowKey] = useState(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      // Generate a key when modal opens
      requestAnimationFrame(() => {
        setNewKey(generateApiKey());
        setShowKey(true);
        inputRef.current?.focus();
      });
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  const handleGenerate = () => {
    setNewKey(generateApiKey());
    setShowKey(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKey.trim()) {
      const entry: APIKeyEntry = {
        key: newKey.trim(),
        ...(projectName.trim() && { 'project-name': projectName.trim() })
      };
      onAdd(entry);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newKey);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 glass-panel rounded-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Plus className="h-5 w-5 text-orange-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-white">Add New API Key</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Project Name (Optional)</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., My Web App, Mobile App, etc."
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm text-slate-400">API Key</label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Enter or generate API key"
                className="w-full px-4 py-3 pr-24 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-200 font-mono text-sm"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-white/[0.1] text-slate-400 hover:text-white hover:border-white/[0.2] hover:bg-white/[0.02] transition-all duration-200"
          >
            <RefreshCw className="h-4 w-4" />
            Generate New Key
          </button>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-300/90">
              <strong>Important:</strong> Make sure to copy your API key now. You won't be able to see the full key again after adding it.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] text-slate-300 font-medium transition-all duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newKey.trim() || isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="h-4 w-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Key
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: APIKeyEntry) => void;
  currentEntry: APIKeyEntry;
  isSaving: boolean;
}

function EditKeyModal({ isOpen, onClose, onSave, currentEntry, isSaving }: EditKeyModalProps) {
  const [editedKey, setEditedKey] = useState(currentEntry.key);
  const [projectName, setProjectName] = useState(currentEntry['project-name'] || '');
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      requestAnimationFrame(() => {
        setEditedKey(currentEntry.key);
        setProjectName(currentEntry['project-name'] || '');
        inputRef.current?.focus();
      });
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, currentEntry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedKey.trim()) {
      const entry: APIKeyEntry = {
        key: editedKey.trim(),
        ...(projectName.trim() && { 'project-name': projectName.trim() })
      };
      onSave(entry);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 glass-panel rounded-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center">
              <Settings className="h-5 w-5 text-cyan-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-semibold text-white">Edit API Key</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Project Name (Optional)</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., My Web App, Mobile App, etc."
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-slate-400">API Key</label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={editedKey}
                onChange={(e) => setEditedKey(e.target.value)}
                placeholder="Enter API key"
                className="w-full px-4 py-3 pr-12 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] text-slate-300 font-medium transition-all duration-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!editedKey.trim() || isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ApiKeyItemProps {
  entry: APIKeyEntry;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function ApiKeyItem({ entry, index, onEdit, onDelete, isDeleting }: ApiKeyItemProps) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Staggered fade-in animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, index * 50); // 50ms stagger delay per item
    return () => clearTimeout(timer);
  }, [index]);

  const handleCopy = () => {
    navigator.clipboard.writeText(entry.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className={`api-key-item group relative px-5 py-4 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.04] hover:border-white/[0.08] hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
      style={{
        transitionProperty: 'opacity, transform, background-color, border-color, box-shadow',
        transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Index Badge */}
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/10 border border-orange-500/20 flex items-center justify-center transition-all duration-300 group-hover:border-orange-500/40 group-hover:shadow-lg group-hover:shadow-orange-500/20">
            <span className="text-xs font-semibold text-orange-400">#{index + 1}</span>
          </div>
          
          {/* Key Info */}
          <div className="min-w-0 flex-1">
            {entry['project-name'] && (
              <div className="flex items-center gap-2 mb-1.5">
                <div className="text-sm font-semibold text-white transition-colors duration-200 group-hover:text-orange-300">{entry['project-name']}</div>
                <div className="px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 transition-all duration-200 group-hover:bg-orange-500/20 group-hover:border-orange-500/30">
                  <span className="text-xs text-orange-400 font-medium">Project</span>
                </div>
              </div>
            )}
            <div className="text-xs text-slate-500 mb-1.5 transition-colors duration-200 group-hover:text-slate-400">API Key</div>
            <code className="text-sm text-slate-400 font-mono transition-colors duration-200 group-hover:text-slate-300">
              {showKey ? entry.key : maskApiKey(entry.key)}
            </code>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <button
            onClick={() => setShowKey(!showKey)}
            className="p-2 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95"
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white transition-all duration-200 hover:scale-105 active:scale-95"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-all duration-200 hover:scale-105 active:scale-95"
            title="Edit"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
            title="Delete"
          >
            {isDeleting ? (
              <div className="h-4 w-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProxyKeysPage() {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [localKeys, setLocalKeys] = useState<APIKeyEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'curl' | 'javascript' | 'python' | 'nodejs'>('curl');
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [showTopFade, setShowTopFade] = useState(false);
  const [showBottomFade, setShowBottomFade] = useState(false);

  // Fetch API keys
  const { data: apiKeysData, isLoading } = useQuery({
    queryKey: ['proxyApiKeys'],
    queryFn: async () => {
      const response = await getAPIKeys();
      return response.data;
    },
  });

  // Update local keys when data changes
  useEffect(() => {
    if (apiKeysData) {
      // Handle different response formats
      const rawKeys = apiKeysData['api-keys'] || apiKeysData.keys || apiKeysData || [];
      const keys = Array.isArray(rawKeys) ? rawKeys : [];
      // Normalize to APIKeyEntry format
      const normalized = keys.map((k: any) => {
        if (typeof k === 'string') {
          return { key: k } as APIKeyEntry;
        }
        return k as APIKeyEntry;
      });
      setLocalKeys(normalized);
      
      // Check if scrollable
      setTimeout(() => {
        if (containerRef.current) {
          const isScrollable = containerRef.current.scrollHeight > containerRef.current.clientHeight;
          setShowScrollIndicator(isScrollable);
          checkScrollPosition();
        }
      }, 100);
    }
  }, [apiKeysData]);

  // Handle scroll position indicators
  const checkScrollPosition = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtTop = scrollTop <= 10;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    
    setShowTopFade(!isAtTop && scrollTop > 0);
    setShowBottomFade(!isAtBottom && scrollHeight > clientHeight);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', checkScrollPosition);
      return () => container.removeEventListener('scroll', checkScrollPosition);
    }
  }, [checkScrollPosition]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (keys: APIKeyEntry[]) => {
      const response = await updateAPIKeys(keys);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyApiKeys'] });
    },
  });

  // Handle add key
  const handleAddKey = useCallback(async (entry: APIKeyEntry) => {
    const updatedKeys = [...localKeys, entry];
    setLocalKeys(updatedKeys);
    try {
      await saveMutation.mutateAsync(updatedKeys);
      setAddModalOpen(false);
    } catch {
      // Revert on error
      setLocalKeys(localKeys);
    }
  }, [localKeys, saveMutation]);

  // Handle edit key
  const handleEditKey = useCallback(async (entry: APIKeyEntry) => {
    if (editingIndex === null) return;
    const updatedKeys = [...localKeys];
    updatedKeys[editingIndex] = entry;
    setLocalKeys(updatedKeys);
    try {
      await saveMutation.mutateAsync(updatedKeys);
      setEditModalOpen(false);
      setEditingIndex(null);
    } catch {
      // Revert on error
      setLocalKeys(localKeys);
    }
  }, [localKeys, editingIndex, saveMutation]);

  // Handle delete key
  const handleDeleteKey = useCallback(async (index: number) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;
    
    setDeletingIndex(index);
    const updatedKeys = localKeys.filter((_, i) => i !== index);
    try {
      await saveMutation.mutateAsync(updatedKeys);
      setLocalKeys(updatedKeys);
    } catch {
      // Keep original on error
    } finally {
      setDeletingIndex(null);
    }
  }, [localKeys, saveMutation]);

  // Open edit modal
  const openEditModal = (index: number) => {
    setEditingIndex(index);
    setEditModalOpen(true);
  };

  // Refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['proxyApiKeys'] });
  };

  // Scroll to top when keys list changes
  useEffect(() => {
    if (containerRef.current && !isLoading) {
      containerRef.current.scrollTop = 0;
      // Recheck scroll position after list changes
      setTimeout(checkScrollPosition, 100);
    }
  }, [isLoading, localKeys.length, checkScrollPosition]);

  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <div className="relative z-10 space-y-8">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="h-10 w-80 bg-white/[0.03] rounded-lg animate-pulse" />
              <div className="h-4 w-64 bg-white/[0.02] rounded animate-pulse" />
            </div>
          </div>

          {/* Card skeleton */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 w-48 bg-white/[0.03] rounded animate-pulse" />
                  <div className="h-3 w-32 bg-white/[0.02] rounded animate-pulse" />
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-white/[0.02] border border-white/[0.04] rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div className="relative z-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white tracking-tight">
              API Keys Management
            </h1>
            <p className="text-slate-400 text-sm">
              Manage authentication keys for accessing the proxy service
            </p>
          </div>
        </div>

        {/* Main Card */}
        <div className="glass-panel rounded-2xl overflow-hidden">
          {/* Card Header */}
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(249, 115, 22, 0.15)', boxShadow: '0 0 20px rgba(249, 115, 22, 0.2)' }}
              >
                <Shield className="h-5 w-5 text-orange-400" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Proxy Service Authentication Keys</h3>
                <span className="text-sm text-slate-500">{localKeys.length} keys configured</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4 text-slate-400" strokeWidth={2} />
                <span className="text-white text-sm font-medium">Refresh</span>
              </button>
              <button
                onClick={() => setAddModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-all duration-300"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm font-medium">Add Key</span>
              </button>
            </div>
          </div>

          {/* Card Content */}
          <div className="relative">
            {/* Top fade indicator */}
            {showTopFade && (
              <div 
                className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-[#0F0F12] to-transparent pointer-events-none z-10 transition-opacity duration-300"
                style={{ opacity: showTopFade ? 1 : 0 }}
              />
            )}
            
            <div className="p-6">
              {localKeys.length === 0 ? (
                <div className="text-center py-16">
                  <div className="relative inline-flex mb-4">
                    <div className="absolute inset-0 bg-orange-400 blur-2xl opacity-20" />
                    <Key className="relative h-16 w-16 text-slate-600" strokeWidth={1} />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">No API Keys</h3>
                  <p className="text-slate-500 mb-6">
                    Create your first API key to authenticate requests to the proxy service.
                  </p>
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-all duration-300"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="font-medium">Add Your First Key</span>
                  </button>
                </div>
              ) : (
                <div 
                  ref={containerRef}
                  className="space-y-3 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin smooth-scroll"
                  onScroll={checkScrollPosition}
                >
                  {localKeys.map((entry, index) => (
                    <ApiKeyItem
                      key={`${entry.key}-${index}`}
                      entry={entry}
                      index={index}
                      onEdit={() => openEditModal(index)}
                      onDelete={() => handleDeleteKey(index)}
                      isDeleting={deletingIndex === index}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Bottom fade indicator */}
            {showBottomFade && (
              <div 
                className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0F0F12] to-transparent pointer-events-none z-10 transition-opacity duration-300"
                style={{ opacity: showBottomFade ? 1 : 0 }}
              />
            )}

            {/* Scroll hint - only show when scrollable and user hasn't scrolled */}
            {showScrollIndicator && !showTopFade && localKeys.length > 4 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-10 animate-bounce">
                <div className="text-xs text-slate-500 font-medium">Scroll for more</div>
                <div className="w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="glass-panel rounded-2xl p-6 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-cyan-400" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-medium mb-2">How to use API Keys</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Use these API keys to authenticate your requests to the proxy service. Include the key in the <code className="px-1.5 py-0.5 bg-white/5 rounded text-cyan-400">Authorization</code> header as a Bearer token.
              </p>

              {/* Tab Navigation */}
              <div className="flex gap-2 mb-4 border-b border-white/6">
                <button
                  onClick={() => setActiveTab('curl')}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'curl'
                      ? 'text-orange-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  cURL
                  {activeTab === 'curl' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('javascript')}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'javascript'
                      ? 'text-orange-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  JavaScript
                  {activeTab === 'javascript' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('python')}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'python'
                      ? 'text-orange-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Python
                  {activeTab === 'python' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('nodejs')}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                    activeTab === 'nodejs'
                      ? 'text-orange-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Node.js SDK
                  {activeTab === 'nodejs' && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />
                  )}
                </button>
              </div>

              {/* Tab Content */}
              <div className="bg-black/30 border border-white/6 rounded-xl p-4 font-mono text-xs overflow-x-auto min-h-[280px]">
                {activeTab === 'curl' && (
                  <div>
                    <div className="text-slate-500 mb-2"># Example request to chat completion endpoint</div>
                    <div className="text-white">
                      <span className="text-cyan-400">curl</span> -X POST http://localhost:9999/v1/chat/completions \
                    </div>
                    <div className="text-white ml-4">
                      -H <span className="text-green-400">"Content-Type: application/json"</span> \
                    </div>
                    <div className="text-white ml-4">
                      -H <span className="text-green-400">"Authorization: Bearer YOUR_API_KEY"</span> \
                    </div>
                    <div className="text-white ml-4">
                      -d <span className="text-green-400">'&#123;"model": "gemini-2.5-flash", "messages": [&#123;"role": "user", "content": "Hello!"&#125;]&#125;'</span>
                    </div>
                  </div>
                )}

                {activeTab === 'javascript' && (
                  <div>
                    <div className="text-white">
                      <span className="text-purple-400">const</span> response = <span className="text-purple-400">await</span> <span className="text-cyan-400">fetch</span>(<span className="text-green-400">'http://localhost:9999/v1/chat/completions'</span>, &#123;
                    </div>
                    <div className="text-white ml-4">method: <span className="text-green-400">'POST'</span>,</div>
                    <div className="text-white ml-4">headers: &#123;</div>
                    <div className="text-white ml-8"><span className="text-green-400">'Content-Type'</span>: <span className="text-green-400">'application/json'</span>,</div>
                    <div className="text-white ml-8"><span className="text-green-400">'Authorization'</span>: <span className="text-green-400">`Bearer $&#123;YOUR_API_KEY&#125;`</span></div>
                    <div className="text-white ml-4">&#125;,</div>
                    <div className="text-white ml-4">body: <span className="text-cyan-400">JSON</span>.<span className="text-yellow-400">stringify</span>(&#123;</div>
                    <div className="text-white ml-8">model: <span className="text-green-400">'gemini-2.5-flash'</span>,</div>
                    <div className="text-white ml-8">messages: [&#123; role: <span className="text-green-400">'user'</span>, content: <span className="text-green-400">'Hello!'</span> &#125;]</div>
                    <div className="text-white ml-4">&#125;)</div>
                    <div className="text-white">&#125;);</div>
                    <div className="text-white mt-2">
                      <span className="text-purple-400">const</span> data = <span className="text-purple-400">await</span> response.<span className="text-yellow-400">json</span>();
                    </div>
                  </div>
                )}

                {activeTab === 'python' && (
                  <div>
                    <div className="text-white">
                      <span className="text-purple-400">import</span> requests
                    </div>
                    <div className="text-white mt-2">url = <span className="text-green-400">"http://localhost:9999/v1/chat/completions"</span></div>
                    <div className="text-white">headers = &#123;</div>
                    <div className="text-white ml-4"><span className="text-green-400">"Content-Type"</span>: <span className="text-green-400">"application/json"</span>,</div>
                    <div className="text-white ml-4"><span className="text-green-400">"Authorization"</span>: <span className="text-green-400">f"Bearer &#123;YOUR_API_KEY&#125;"</span></div>
                    <div className="text-white">&#125;</div>
                    <div className="text-white mt-1">data = &#123;</div>
                    <div className="text-white ml-4"><span className="text-green-400">"model"</span>: <span className="text-green-400">"gemini-2.5-flash"</span>,</div>
                    <div className="text-white ml-4"><span className="text-green-400">"messages"</span>: [&#123;<span className="text-green-400">"role"</span>: <span className="text-green-400">"user"</span>, <span className="text-green-400">"content"</span>: <span className="text-green-400">"Hello!"</span>&#125;]</div>
                    <div className="text-white">&#125;</div>
                    <div className="text-white mt-1">response = requests.<span className="text-yellow-400">post</span>(url, headers=headers, json=data)</div>
                    <div className="text-white mt-1">result = response.<span className="text-yellow-400">json</span>()</div>
                  </div>
                )}

                {activeTab === 'nodejs' && (
                  <div>
                    <div className="text-white">
                      <span className="text-purple-400">import</span> OpenAI <span className="text-purple-400">from</span> <span className="text-green-400">'openai'</span>;
                    </div>
                    <div className="text-white mt-2"><span className="text-purple-400">const</span> client = <span className="text-purple-400">new</span> <span className="text-cyan-400">OpenAI</span>(&#123;</div>
                    <div className="text-white ml-4">apiKey: <span className="text-green-400">'YOUR_API_KEY'</span>,</div>
                    <div className="text-white ml-4">baseURL: <span className="text-green-400">'http://localhost:9999/v1'</span></div>
                    <div className="text-white">&#125;);</div>
                    <div className="text-white mt-2"><span className="text-purple-400">const</span> response = <span className="text-purple-400">await</span> client.chat.completions.<span className="text-yellow-400">create</span>(&#123;</div>
                    <div className="text-white ml-4">model: <span className="text-green-400">'gemini-2.5-flash'</span>,</div>
                    <div className="text-white ml-4">messages: [&#123; role: <span className="text-green-400">'user'</span>, content: <span className="text-green-400">'Hello!'</span> &#125;]</div>
                    <div className="text-white">&#125;);</div>
                    <div className="text-white mt-2">
                      <span className="text-cyan-400">console</span>.<span className="text-yellow-400">log</span>(response.choices[<span className="text-orange-400">0</span>].message.content);
                    </div>
                  </div>
                )}
              </div>

              {/* Important Notes */}
              <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-200/90 space-y-1">
                    <div><strong>Important:</strong></div>
                    <ul className="list-disc list-inside space-y-1 text-amber-300/80">
                      <li>Replace <code className="px-1 py-0.5 bg-amber-500/20 rounded text-amber-300">YOUR_API_KEY</code> with your actual API key</li>
                      <li>Default base URL is <code className="px-1 py-0.5 bg-amber-500/20 rounded text-amber-300">http://localhost:9999</code></li>
                      <li>Keep your API keys secure and never expose them in client-side code</li>
                      <li>Use environment variables to store API keys in production</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <AddKeyModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={handleAddKey}
        isSaving={saveMutation.isPending}
      />

      {/* Edit Modal */}
      <EditKeyModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingIndex(null);
        }}
        onSave={handleEditKey}
        currentEntry={editingIndex !== null ? localKeys[editingIndex] : { key: '' }}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}
