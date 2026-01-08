import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { 
  Cpu, 
  Settings, 
  RefreshCw, 
} from 'lucide-react';
import {
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  Funnel,
  ToggleLeft,
  ToggleRight,
} from 'phosphor-react';
import { 
  listAuthFiles, 
  getAuthKey, 
  getModelSettings, 
  updateModelSetting,
  bulkUpdateModelSettings,
  type ModelSetting,
} from '../lib/api';
import gsap from 'gsap';

// Ambient Background
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div 
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.15), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div 
        className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.1), transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
    </div>
  );
}

interface ModelInfo {
  id: string;
  display_name?: string;
  type?: string;
  owned_by?: string;
}

interface ProviderModels {
  authFile: string;
  type: string;
  models: ModelInfo[];
}

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

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  loading?: boolean;
}

function ToggleSwitch({ enabled, onChange, loading }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      disabled={loading}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 ${
        enabled ? 'bg-purple-500' : 'bg-slate-600'
      } ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function ModelSettingsPage() {
  const queryClient = useQueryClient();
  const gridRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [filterEnabled, setFilterEnabled] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [modelSettings, setModelSettings] = useState<Map<string, boolean>>(new Map());
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  // Fetch auth files
  const { data: authFilesData } = useQuery({
    queryKey: ['authFiles'],
    queryFn: async () => {
      const response = await listAuthFiles();
      return response.data;
    },
  });

  // Fetch available models from all auth files
  const { data: providersData, isLoading: modelsLoading, refetch: refetchModels } = useQuery({
    queryKey: ['availableModels', authFilesData?.files],
    queryFn: async () => {
      if (!authFilesData?.files || authFilesData.files.length === 0) return [];
      
      const providersPromises = authFilesData.files.map(async (file: { name: string; provider?: string; type?: string }) => {
        const models = await fetchModelsForAuthFile(file.name);
        return {
          authFile: file.name,
          type: file.provider || file.type || 'unknown',
          models,
        };
      });
      
      const providers = await Promise.all(providersPromises);
      return providers.filter(p => p.models.length > 0) as ProviderModels[];
    },
    enabled: !!authFilesData?.files,
  });

  // Fetch saved model settings
  const { data: savedSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['modelSettings'],
    queryFn: async () => {
      const response = await getModelSettings();
      return response.data;
    },
  });

  // Compute model settings from saved data using useMemo instead of useEffect+setState
  const computedModelSettings = useMemo(() => {
    const settingsMap = new Map<string, boolean>();
    if (savedSettings?.models) {
      savedSettings.models.forEach((setting) => {
        const key = `${setting.auth_file}:${setting.model_id}`;
        settingsMap.set(key, setting.enabled);
      });
    }
    // Merge with local state for pending changes
    modelSettings.forEach((value, key) => {
      if (pendingChanges.has(key)) {
        settingsMap.set(key, value);
      }
    });
    return settingsMap;
  }, [savedSettings, modelSettings, pendingChanges]);

  // Mutation for updating model settings
  const updateMutation = useMutation({
    mutationFn: async (setting: ModelSetting) => {
      const response = await updateModelSetting(setting);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelSettings'] });
    },
  });

  // Handle toggle change
  const handleToggle = useCallback((authFile: string, modelId: string, displayName: string, provider: string, enabled: boolean) => {
    const key = `${authFile}:${modelId}`;
    
    // Update local state immediately
    setModelSettings(prev => {
      const newMap = new Map(prev);
      newMap.set(key, enabled);
      return newMap;
    });
    
    setPendingChanges(prev => new Set(prev).add(key));

    // Send update to server
    updateMutation.mutate({
      model_id: modelId,
      display_name: displayName,
      provider: provider,
      auth_file: authFile,
      enabled: enabled,
    }, {
      onSettled: () => {
        setPendingChanges(prev => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    });
  }, [updateMutation]);

  // Get model enabled status
  const isModelEnabled = useCallback((authFile: string, modelId: string) => {
    const key = `${authFile}:${modelId}`;
    // Default to true if not configured
    return computedModelSettings.get(key) ?? true;
  }, [computedModelSettings]);

  // Enable/Disable all models
  const handleBulkToggle = useCallback((enabled: boolean) => {
    if (!providersData) return;

    const allModels: ModelSetting[] = [];
    providersData.forEach(provider => {
      provider.models.forEach(model => {
        allModels.push({
          model_id: model.id,
          display_name: model.display_name || model.id,
          provider: provider.type,
          auth_file: provider.authFile,
          enabled: enabled,
        });
      });
    });

    // Update local state
    setModelSettings(() => {
      const newMap = new Map<string, boolean>();
      allModels.forEach(m => {
        newMap.set(`${m.auth_file}:${m.model_id}`, enabled);
      });
      return newMap;
    });

    // Send bulk update
    bulkUpdateModelSettings(allModels).then(() => {
      queryClient.invalidateQueries({ queryKey: ['modelSettings'] });
    });
  }, [providersData, queryClient]);

  // Filter providers and models
  const filteredProviders = providersData?.map(provider => {
    const filteredModels = provider.models.filter(model => {
      const matchesSearch = searchQuery === '' || 
        model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (model.display_name?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesProvider = filterProvider === 'all' || 
        provider.type.toLowerCase().includes(filterProvider.toLowerCase());
      
      const isEnabled = isModelEnabled(provider.authFile, model.id);
      const matchesEnabled = filterEnabled === 'all' || 
        (filterEnabled === 'enabled' && isEnabled) ||
        (filterEnabled === 'disabled' && !isEnabled);

      return matchesSearch && matchesProvider && matchesEnabled;
    });

    return { ...provider, models: filteredModels };
  }).filter(p => p.models.length > 0) || [];

  // Get unique provider types for filter
  const providerTypes = Array.from(new Set(providersData?.map(p => p.type) || []));

  // Stats
  const totalModels = providersData?.reduce((acc, p) => acc + p.models.length, 0) || 0;
  const enabledModels = providersData?.reduce((acc, provider) => {
    return acc + provider.models.filter(m => isModelEnabled(provider.authFile, m.id)).length;
  }, 0) || 0;
  const disabledModels = totalModels - enabledModels;

  // Animate cards
  const animateCards = useCallback(() => {
    if (!gridRef.current) return;
    
    const cards = gridRef.current.querySelectorAll('.model-card');
    if (cards.length === 0) return;
    
    gsap.set(cards, { 
      opacity: 0, 
      y: 12,
      willChange: 'transform, opacity'
    });
    
    gsap.to(cards, {
      opacity: 1,
      y: 0,
      duration: 0.2,
      stagger: 0.03,
      ease: 'power2.out',
      force3D: true,
      clearProps: 'willChange',
    });
  }, []);

  useEffect(() => {
    if (!modelsLoading && providersData) {
      requestAnimationFrame(() => {
        animateCards();
      });
    }
  }, [modelsLoading, providersData, animateCards, searchQuery, filterProvider, filterEnabled]);

  const isLoading = modelsLoading || settingsLoading;

  return (
    <>
      <AmbientBackground />
      <div className="min-h-screen p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Model Settings</h1>
                <p className="text-white/60 text-sm mt-1">Enable or disable models for Playground and API requests</p>
              </div>
            </div>
            <button
              onClick={() => refetchModels()}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-white/10"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="stat-card relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <Cpu className="w-8 h-8 text-purple-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{totalModels}</div>
            <div className="text-sm text-white/60">Total Models</div>
          </div>

          <div className="stat-card relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{enabledModels}</div>
            <div className="text-sm text-white/60">Enabled</div>
          </div>

          <div className="stat-card relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-red-500/10 to-red-600/5 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{disabledModels}</div>
            <div className="text-sm text-white/60">Disabled</div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          {/* Provider Filter */}
          <div className="relative">
            <Funnel className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value)}
              className="pl-10 pr-8 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
            >
              <option value="all" className="bg-slate-800">All Providers</option>
              {providerTypes.map(type => (
                <option key={type} value={type} className="bg-slate-800">{type}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={filterEnabled}
            onChange={(e) => setFilterEnabled(e.target.value as 'all' | 'enabled' | 'disabled')}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="all" className="bg-slate-800">All Status</option>
            <option value="enabled" className="bg-slate-800">Enabled Only</option>
            <option value="disabled" className="bg-slate-800">Disabled Only</option>
          </select>

          {/* Bulk Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => handleBulkToggle(true)}
              className="px-4 py-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 font-medium transition-all duration-200 flex items-center gap-2 border border-green-500/30"
            >
              <ToggleRight className="w-4 h-4" />
              Enable All
            </button>
            <button
              onClick={() => handleBulkToggle(false)}
              className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition-all duration-200 flex items-center gap-2 border border-red-500/30"
            >
              <ToggleLeft className="w-4 h-4" />
              Disable All
            </button>
          </div>
        </div>

        {/* Models Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-white/40 mx-auto mb-4" />
              <p className="text-white/60">Loading models...</p>
            </div>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="text-center py-20">
            <Cpu className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white/80 mb-2">No Models Found</h3>
            <p className="text-white/50">
              {searchQuery || filterProvider !== 'all' || filterEnabled !== 'all' 
                ? 'Try adjusting your filters'
                : 'Upload authentication files to see available models'}
            </p>
          </div>
        ) : (
          <div ref={gridRef} className="space-y-8">
            {filteredProviders.map((provider) => {
              const providerColor = getProviderColor(provider.type);
              
              return (
                <div key={provider.authFile} className="space-y-4">
                  {/* Provider Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${providerColor}20` }}
                    >
                      <Cpu className="w-5 h-5" style={{ color: providerColor }} strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-white">{provider.authFile}</h2>
                      <p className="text-sm text-white/50">{provider.type} • {provider.models.length} models</p>
                    </div>
                    <div className="text-sm text-white/50">
                      {provider.models.filter(m => isModelEnabled(provider.authFile, m.id)).length} enabled
                    </div>
                  </div>

                  {/* Models Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {provider.models.map((model) => {
                      const enabled = isModelEnabled(provider.authFile, model.id);
                      const isPending = pendingChanges.has(`${provider.authFile}:${model.id}`);
                      
                      return (
                        <div
                          key={model.id}
                          className={`model-card relative overflow-hidden rounded-xl border backdrop-blur-sm p-4 transition-all duration-300 ${
                            enabled 
                              ? 'border-white/20 bg-gradient-to-br from-white/5 to-transparent' 
                              : 'border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div 
                                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${
                                  enabled ? '' : 'grayscale opacity-50'
                                }`}
                                style={{ background: `${providerColor}15` }}
                              >
                                <Cpu className="w-4 h-4" style={{ color: providerColor }} strokeWidth={2} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p 
                                  className={`text-sm font-mono truncate transition-colors ${
                                    enabled ? 'text-white' : 'text-white/50'
                                  }`}
                                  title={model.display_name || model.id}
                                >
                                  {model.display_name || model.id}
                                </p>
                                {model.display_name && model.display_name !== model.id && (
                                  <p className="text-xs text-white/40 truncate" title={model.id}>
                                    {model.id}
                                  </p>
                                )}
                              </div>
                            </div>
                            <ToggleSwitch
                              enabled={enabled}
                              onChange={(newEnabled) => handleToggle(
                                provider.authFile,
                                model.id,
                                model.display_name || model.id,
                                provider.type,
                                newEnabled
                              )}
                              loading={isPending}
                            />
                          </div>
                          
                          {/* Status indicator */}
                          <div className={`mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs ${
                            enabled ? 'text-green-400' : 'text-white/40'
                          }`}>
                            <span className="flex items-center gap-1">
                              {enabled ? (
                                <>
                                  <CheckCircle className="w-3 h-3" />
                                  Available in Playground & API
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3" />
                                  Disabled
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
