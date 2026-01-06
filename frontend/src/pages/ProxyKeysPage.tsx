import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, Eye, EyeOff, Settings, RefreshCw, Cpu, Shield, Copy, Check, X } from 'lucide-react';
import { getAPIKeys, updateAPIKeys } from '../lib/api';
import { useState, useEffect, useRef, useCallback } from 'react';
import { animatePageEnter } from '../lib/animations';

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
  onAdd: (key: string) => void;
  isSaving: boolean;
}

function AddKeyModal({ isOpen, onClose, onAdd, isSaving }: AddKeyModalProps) {
  const [newKey, setNewKey] = useState(() => isOpen ? generateApiKey() : '');
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
      onAdd(newKey.trim());
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
  onSave: (newKey: string) => void;
  currentKey: string;
  isSaving: boolean;
}

function EditKeyModal({ isOpen, onClose, onSave, currentKey, isSaving }: EditKeyModalProps) {
  const [editedKey, setEditedKey] = useState(currentKey);
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      requestAnimationFrame(() => {
        setEditedKey(currentKey);
        inputRef.current?.focus();
      });
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, currentKey]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedKey.trim()) {
      onSave(editedKey.trim());
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
  keyValue: string;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function ApiKeyItem({ keyValue, index, onEdit, onDelete, isDeleting }: ApiKeyItemProps) {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="api-key-item group relative px-5 py-4 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.03] hover:border-white/[0.06] transition-all duration-200">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Index Badge */}
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <span className="text-xs font-semibold text-orange-400">#{index + 1}</span>
          </div>
          
          {/* Key Info */}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white mb-1">API Key</div>
            <code className="text-sm text-slate-400 font-mono">
              {showKey ? keyValue : maskApiKey(keyValue)}
            </code>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={() => setShowKey(!showKey)}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
            title={showKey ? 'Hide key' : 'Show key'}
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-white transition-colors"
            title="Copy to clipboard"
          >
            {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-lg hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Edit"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-50"
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
  const [localKeys, setLocalKeys] = useState<string[]>([]);

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
      const keys = apiKeysData['api-keys'] || apiKeysData.keys || apiKeysData || [];
      setLocalKeys(Array.isArray(keys) ? keys : []);
    }
  }, [apiKeysData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const response = await updateAPIKeys(keys);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proxyApiKeys'] });
    },
  });

  // Handle add key
  const handleAddKey = useCallback(async (newKey: string) => {
    const updatedKeys = [...localKeys, newKey];
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
  const handleEditKey = useCallback(async (newKey: string) => {
    if (editingIndex === null) return;
    const updatedKeys = [...localKeys];
    updatedKeys[editingIndex] = newKey;
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

  // Animation on mount
  useEffect(() => {
    if (containerRef.current && !isLoading) {
      const items = containerRef.current.querySelectorAll('.api-key-item');
      animatePageEnter(items, { stagger: 0.05 });
    }
  }, [isLoading, localKeys]);

  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <div className="relative z-10 flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <div className="relative inline-flex">
              <div className="absolute inset-0 bg-orange-400 blur-2xl opacity-30 animate-pulse" />
              <Cpu className="relative h-14 w-14 text-orange-400 animate-spin" strokeWidth={1.5} style={{ animationDuration: '2s' }} />
            </div>
            <p className="text-slate-400 font-mono text-sm">Loading API keys...</p>
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
          <div className="p-6" ref={containerRef}>
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
              <div className="space-y-3">
                {localKeys.map((key, index) => (
                  <ApiKeyItem
                    key={`${key}-${index}`}
                    keyValue={key}
                    index={index}
                    onEdit={() => openEditModal(index)}
                    onDelete={() => handleDeleteKey(index)}
                    isDeleting={deletingIndex === index}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-cyan-400" strokeWidth={1.5} />
            </div>
            <div>
              <h4 className="text-white font-medium mb-2">How to use API Keys</h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-3">
                Use these API keys to authenticate your requests to the proxy service. Include the key in the <code className="px-1.5 py-0.5 bg-white/[0.05] rounded text-cyan-400">Authorization</code> header:
              </p>
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 font-mono text-sm">
                <span className="text-slate-500">Authorization:</span>{' '}
                <span className="text-cyan-400">Bearer</span>{' '}
                <span className="text-orange-400">{'<your-api-key>'}</span>
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
        currentKey={editingIndex !== null ? localKeys[editingIndex] : ''}
        isSaving={saveMutation.isPending}
      />
    </div>
  );
}
