import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, Eye, EyeOff, Save, RefreshCw, Cpu } from 'lucide-react';
import { 
  getGeminiKeys, 
  getClaudeKeys, 
  getCodexKeys,
  updateGeminiKeys,
  updateClaudeKeys,
  updateCodexKeys,
} from '../lib/api';
import { useState, useEffect, useRef } from 'react';
import { animatePageEnter } from '../lib/animations';

// Ambient Background
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div 
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.15), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}

interface KeySectionProps {
  title: string;
  provider: string;
  color: string;
  keys: string[];
  onSave: (keys: string[]) => void;
  isLoading: boolean;
  isSaving: boolean;
}

function KeySection({ 
  title, 
  provider, 
  color, 
  keys, 
  onSave, 
  isLoading,
  isSaving 
}: KeySectionProps) {
  const [showKeys, setShowKeys] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [localKeys, setLocalKeys] = useState<string[]>(keys);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync local keys when prop changes
  if (JSON.stringify(keys) !== JSON.stringify(localKeys) && !hasChanges) {
    setLocalKeys(keys);
  }

  const handleAddKey = () => {
    if (newKey.trim()) {
      const updatedKeys = [...localKeys, newKey.trim()];
      setLocalKeys(updatedKeys);
      setNewKey('');
      setHasChanges(true);
    }
  };

  const handleDeleteKey = (index: number) => {
    const updatedKeys = localKeys.filter((_, i) => i !== index);
    setLocalKeys(updatedKeys);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localKeys);
    setHasChanges(false);
  };

  return (
    <div className="key-section glass-panel rounded-2xl overflow-hidden">
      <div 
        className="px-6 py-4 border-b border-white/[0.06]"
        style={{ background: `${color}08` }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${color}15`, boxShadow: `0 0 20px ${color}20` }}
            >
              <Key className="h-5 w-5" style={{ color }} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              <span className="text-sm text-slate-500">{localKeys.length} keys configured</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeys(!showKeys)}
              className="p-2.5 rounded-xl hover:bg-white/[0.05] text-slate-400 hover:text-white transition-all duration-200"
            >
              {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all duration-300 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {/* Add new key */}
        <div className="flex gap-3">
          <input
            type={showKeys ? 'text' : 'password'}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
            placeholder={`Add new ${provider} API key`}
            className="flex-1 px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200"
          />
          <button
            onClick={handleAddKey}
            disabled={!newKey.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded-xl glass-panel hover:bg-white/[0.05] text-slate-300 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {/* Keys list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : localKeys.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No API keys configured
          </div>
        ) : (
          <div className="space-y-2">
            {localKeys.map((key, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-white/[0.04] rounded-xl group hover:bg-white/[0.03] transition-all duration-200"
              >
                <code className="text-sm text-slate-300 font-mono">
                  {showKeys ? key : `${key.substring(0, 10)}${'•'.repeat(20)}${key.substring(key.length - 6)}`}
                </code>
                <button
                  onClick={() => handleDeleteKey(index)}
                  className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all duration-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function APIKeysPage() {
  const queryClient = useQueryClient();
  const sectionsRef = useRef<HTMLDivElement>(null);

  const { data: geminiData, isLoading: geminiLoading } = useQuery({
    queryKey: ['geminiKeys'],
    queryFn: async () => {
      const response = await getGeminiKeys();
      return response.data;
    },
  });

  const { data: claudeData, isLoading: claudeLoading } = useQuery({
    queryKey: ['claudeKeys'],
    queryFn: async () => {
      const response = await getClaudeKeys();
      return response.data;
    },
  });

  const { data: codexData, isLoading: codexLoading } = useQuery({
    queryKey: ['codexKeys'],
    queryFn: async () => {
      const response = await getCodexKeys();
      return response.data;
    },
  });

  const geminiMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const response = await updateGeminiKeys(keys);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geminiKeys'] });
    },
  });

  const claudeMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const response = await updateClaudeKeys(keys);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claudeKeys'] });
    },
  });

  const codexMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      const response = await updateCodexKeys(keys);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codexKeys'] });
    },
  });

  useEffect(() => {
    if (sectionsRef.current) {
      const sections = sectionsRef.current.querySelectorAll('.key-section');
      animatePageEnter(sections, { stagger: 0.1 });
    }
  }, []);

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['geminiKeys'] });
    queryClient.invalidateQueries({ queryKey: ['claudeKeys'] });
    queryClient.invalidateQueries({ queryKey: ['codexKeys'] });
  };

  const isLoading = geminiLoading && claudeLoading && codexLoading;

  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <div className="relative z-10 flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <div className="relative inline-flex">
              <div className="absolute inset-0 bg-cyan-400 blur-2xl opacity-30 animate-pulse" />
              <Cpu className="relative h-14 w-14 text-cyan-400 animate-spin" strokeWidth={1.5} style={{ animationDuration: '2s' }} />
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
              AI Providers
            </h1>
            <p className="text-slate-400 text-sm">
              Manage API keys for different AI providers
            </p>
          </div>
          <button
            onClick={refetchAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300"
          >
            <RefreshCw className="h-4 w-4 text-cyan-400" strokeWidth={2} />
            <span className="text-white text-sm font-medium">Refresh All</span>
          </button>
        </div>

        {/* Key Sections */}
        <div ref={sectionsRef} className="space-y-6">
          <KeySection
            title="Gemini API Keys"
            provider="Gemini"
            color="#22D3EE"
            keys={geminiData?.keys || []}
            onSave={(keys) => geminiMutation.mutate(keys)}
            isLoading={geminiLoading}
            isSaving={geminiMutation.isPending}
          />

          <KeySection
            title="Claude API Keys"
            provider="Claude"
            color="#F97316"
            keys={claudeData?.keys || []}
            onSave={(keys) => claudeMutation.mutate(keys)}
            isLoading={claudeLoading}
            isSaving={claudeMutation.isPending}
          />

          <KeySection
            title="Codex (OpenAI) API Keys"
            provider="OpenAI"
            color="#10B981"
            keys={codexData?.keys || []}
            onSave={(keys) => codexMutation.mutate(keys)}
            isLoading={codexLoading}
            isSaving={codexMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
