import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Key, Plus, Trash2, Eye, EyeOff, Save, RefreshCw } from 'lucide-react';
import { 
  getGeminiKeys, 
  getClaudeKeys, 
  getCodexKeys,
  updateGeminiKeys,
  updateClaudeKeys,
  updateCodexKeys,
  deleteGeminiKey,
  deleteClaudeKey,
  deleteCodexKey,
} from '../lib/api';
import { useState } from 'react';

interface KeySectionProps {
  title: string;
  provider: string;
  color: string;
  keys: string[];
  onAdd: (key: string) => void;
  onDelete: (index: number) => void;
  onSave: (keys: string[]) => void;
  isLoading: boolean;
  isSaving: boolean;
}

function KeySection({ 
  title, 
  provider, 
  color, 
  keys, 
  onAdd, 
  onDelete, 
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

  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
    orange: { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      <div className={`px-6 py-4 border-b border-gray-800 ${colors.bg}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Key className={`h-5 w-5 ${colors.text}`} />
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <span className="text-sm text-gray-400">({localKeys.length} keys)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKeys(!showKeys)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            >
              {showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
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
        <div className="flex gap-2">
          <input
            type={showKeys ? 'text' : 'password'}
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKey()}
            placeholder={`Add new ${provider} API key`}
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleAddKey}
            disabled={!newKey.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {/* Keys list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : localKeys.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No API keys configured
          </div>
        ) : (
          <div className="space-y-2">
            {localKeys.map((key, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-4 py-3 bg-gray-800/50 rounded-lg group"
              >
                <code className="text-sm text-gray-300 font-mono">
                  {showKeys ? key : `${key.substring(0, 8)}${'•'.repeat(20)}${key.substring(key.length - 4)}`}
                </code>
                <button
                  onClick={() => handleDeleteKey(index)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
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

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ['geminiKeys'] });
    queryClient.invalidateQueries({ queryKey: ['claudeKeys'] });
    queryClient.invalidateQueries({ queryKey: ['codexKeys'] });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">API Keys</h2>
          <p className="text-gray-400 mt-1">Manage API keys for different providers</p>
        </div>
        <button
          onClick={refetchAll}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh All
        </button>
      </div>

      {/* Key Sections */}
      <div className="space-y-6">
        <KeySection
          title="Gemini API Keys"
          provider="Gemini"
          color="blue"
          keys={geminiData?.keys || []}
          onAdd={() => {}}
          onDelete={(index) => deleteGeminiKey(index)}
          onSave={(keys) => geminiMutation.mutate(keys)}
          isLoading={geminiLoading}
          isSaving={geminiMutation.isPending}
        />

        <KeySection
          title="Claude API Keys"
          provider="Claude"
          color="orange"
          keys={claudeData?.keys || []}
          onAdd={() => {}}
          onDelete={(index) => deleteClaudeKey(index)}
          onSave={(keys) => claudeMutation.mutate(keys)}
          isLoading={claudeLoading}
          isSaving={claudeMutation.isPending}
        />

        <KeySection
          title="Codex (OpenAI) API Keys"
          provider="OpenAI"
          color="green"
          keys={codexData?.keys || []}
          onAdd={() => {}}
          onDelete={(index) => deleteCodexKey(index)}
          onSave={(keys) => codexMutation.mutate(keys)}
          isLoading={codexLoading}
          isSaving={codexMutation.isPending}
        />
      </div>
    </div>
  );
}
