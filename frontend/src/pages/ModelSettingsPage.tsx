import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { 
  Cpu, 
  Settings, 
  RefreshCw, 
  Plus,
  FlaskConical,
  Pencil,
  Trash2,
  X,
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
  addModelSetting,
  editModelSetting,
  removeModelSetting,
  restoreModelSetting,
  testModelSetting,
  type ModelSetting,
  type ModelTestResponse,
} from '../lib/api';
import gsap from 'gsap';
import { ViewToggle, type ViewMode } from '../components/ViewToggle';
import { getModelLabelWithProvider } from '../lib/modelLabels';

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

interface ModelTestState {
  success: boolean;
  message: string;
  statusCode?: number;
  durationMs?: number;
  testedAt: number;
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
  const [removingModels, setRemovingModels] = useState<Set<string>>(new Set());
  const [restoringModels, setRestoringModels] = useState<Set<string>>(new Set());
  const [testingModels, setTestingModels] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Map<string, ModelTestState>>(new Map());
  const [locallyHiddenModelIds, setLocallyHiddenModelIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newModel, setNewModel] = useState({
    modelId: '',
    displayName: '',
    provider: '',
    authFile: '',
  });
  const [editModel, setEditModel] = useState({
    oldModelId: '',
    oldAuthFile: '',
    modelId: '',
    displayName: '',
    provider: '',
    authFile: '',
    enabled: true,
  });

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

  // Group providers by type - MOVED UP BEFORE USAGE
  const groupedByProvider = useMemo(() => {
    if (!providersData) return [];

    const grouped = new Map<string, { type: string; authFiles: Set<string>; models: Map<string, { model: ModelInfo; authFile: string }> }>();

    providersData.forEach(provider => {
      if (!grouped.has(provider.type)) {
        grouped.set(provider.type, {
          type: provider.type,
          authFiles: new Set(),
          models: new Map()
        });
      }

      const group = grouped.get(provider.type)!;
      group.authFiles.add(provider.authFile);

      provider.models.forEach(model => {
        // Gunakan model.id sebagai key, jika ada duplikat gunakan dari auth file pertama
        if (!group.models.has(model.id)) {
          group.models.set(model.id, { model, authFile: provider.authFile });
        }
      });
    });

    return Array.from(grouped.values()).map(group => ({
      type: group.type,
      authFiles: Array.from(group.authFiles),
      models: Array.from(group.models.values())
    }));
  }, [providersData]);

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

  const addMutation = useMutation({
    mutationFn: addModelSetting,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['modelSettings'] }),
        queryClient.invalidateQueries({ queryKey: ['availableModels'] }),
      ]);
      await refetchModels();
      setShowAddModal(false);
      setNewModel({ modelId: '', displayName: '', provider: '', authFile: '' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: removeModelSetting,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['modelSettings'] }),
        queryClient.invalidateQueries({ queryKey: ['availableModels'] }),
      ]);
      await refetchModels();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: restoreModelSetting,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['modelSettings'] }),
        queryClient.invalidateQueries({ queryKey: ['availableModels'] }),
      ]);
      await refetchModels();
    },
  });

  const editMutation = useMutation({
    mutationFn: editModelSetting,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['modelSettings'] }),
        queryClient.invalidateQueries({ queryKey: ['availableModels'] }),
      ]);
      await refetchModels();
      setShowEditModal(false);
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
    if (!groupedByProvider) return;

    const allModels: ModelSetting[] = [];
    groupedByProvider.forEach(provider => {
      provider.models.forEach(({ model, authFile }) => {
        allModels.push({
          model_id: model.id,
          display_name: model.display_name || model.id,
          provider: provider.type,
          auth_file: authFile,
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
  }, [groupedByProvider, queryClient]);

  // Filter providers and models
  const filteredProviders = groupedByProvider.map(provider => {
    const filteredModels = provider.models.filter(({ model, authFile }) => {
      const normalizedModelId = model.id.trim().toLowerCase();
      if (locallyHiddenModelIds.has(normalizedModelId)) {
        return false;
      }

      const matchesSearch = searchQuery === '' || 
        model.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (model.display_name?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesProvider = filterProvider === 'all' || 
        provider.type.toLowerCase().includes(filterProvider.toLowerCase());
      
      const isEnabled = isModelEnabled(authFile, model.id);
      const matchesEnabled = filterEnabled === 'all' || 
        (filterEnabled === 'enabled' && isEnabled) ||
        (filterEnabled === 'disabled' && !isEnabled);

      return matchesSearch && matchesProvider && matchesEnabled;
    });

    return { ...provider, models: filteredModels };
  }).filter(p => p.models.length > 0);

  // Get unique provider types for filter
  const providerTypes = Array.from(new Set(groupedByProvider.map(p => p.type)));

  const removedModels = useMemo(() => {
    if (!savedSettings?.models) return [] as ModelSetting[];
    return savedSettings.models.filter((setting) => setting.removed);
  }, [savedSettings]);

  const authFileOptions = useMemo(() => {
    if (!authFilesData?.files) return [] as Array<{ name: string; provider: string }>;
    return authFilesData.files.map((file: { name: string; provider?: string; type?: string }) => ({
      name: file.name,
      provider: file.provider || file.type || 'unknown',
    }));
  }, [authFilesData]);

  const handleOpenAddModal = useCallback(() => {
    const firstAuth = authFileOptions[0];
    setNewModel({
      modelId: '',
      displayName: '',
      provider: firstAuth?.provider || providerTypes[0] || '',
      authFile: firstAuth?.name || '',
    });
    setShowAddModal(true);
  }, [authFileOptions, providerTypes]);

  const handleAddModel = useCallback(() => {
    const modelId = newModel.modelId.trim();
    const provider = newModel.provider.trim();
    const authFile = newModel.authFile.trim();
    if (!modelId || !provider) {
      return;
    }
    addMutation.mutate({
      model_id: modelId,
      display_name: newModel.displayName.trim() || modelId,
      provider,
      auth_file: authFile || undefined,
      enabled: true,
    });
  }, [addMutation, newModel]);

  const handleRemoveModel = useCallback((authFile: string, modelId: string, provider: string) => {
    const key = `${authFile}:${modelId}`;
    const normalizedModelId = modelId.trim().toLowerCase();
    if (!window.confirm(`Hapus model ${modelId} dari daftar provider ${provider} (semua auth file)?`)) {
      return;
    }

    setLocallyHiddenModelIds(prev => new Set(prev).add(normalizedModelId));
    setRemovingModels(prev => new Set(prev).add(key));
    removeMutation.mutate(
      {
        auth_file: authFile,
        model_id: modelId,
        provider,
      },
      {
        onError: () => {
          setLocallyHiddenModelIds(prev => {
            const next = new Set(prev);
            next.delete(normalizedModelId);
            return next;
          });
        },
        onSettled: () => {
          setRemovingModels(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        },
      },
    );
  }, [removeMutation]);

  const handleRestoreModel = useCallback((setting: ModelSetting) => {
    const key = `${setting.auth_file}:${setting.model_id}`;
    const normalizedModelId = setting.model_id.trim().toLowerCase();
    setRestoringModels(prev => new Set(prev).add(key));
    restoreMutation.mutate(
      {
        auth_file: setting.auth_file,
        model_id: setting.model_id,
        provider: setting.provider,
        display_name: setting.display_name,
        enabled: setting.enabled,
      },
      {
        onSuccess: () => {
          setLocallyHiddenModelIds(prev => {
            const next = new Set(prev);
            next.delete(normalizedModelId);
            return next;
          });
        },
        onSettled: () => {
          setRestoringModels(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        },
      },
    );
  }, [restoreMutation]);

  const handleOpenEditModal = useCallback((payload: {
    authFile: string;
    modelId: string;
    displayName?: string;
    provider: string;
    enabled: boolean;
  }) => {
    setEditModel({
      oldModelId: payload.modelId,
      oldAuthFile: payload.authFile,
      modelId: payload.modelId,
      displayName: payload.displayName || payload.modelId,
      provider: payload.provider,
      authFile: payload.authFile,
      enabled: payload.enabled,
    });
    setShowEditModal(true);
  }, []);

  const handleSubmitEditModel = useCallback(() => {
    const modelId = editModel.modelId.trim();
    const authFile = editModel.authFile.trim();
    const provider = editModel.provider.trim();
    if (!modelId || !provider) {
      return;
    }

    editMutation.mutate({
      old_model_id: editModel.oldModelId,
      old_auth_file: editModel.oldAuthFile.trim() || undefined,
      model_id: modelId,
      display_name: editModel.displayName.trim() || modelId,
      provider,
      auth_file: authFile || undefined,
      enabled: editModel.enabled,
    });
  }, [editModel, editMutation]);

  const handleTestModel = useCallback(async (authFile: string, modelId: string, provider: string) => {
    const key = `${authFile}:${modelId}`;
    setTestingModels(prev => new Set(prev).add(key));

    try {
      const response = await testModelSetting({
        auth_file: authFile,
        model_id: modelId,
        provider,
      });
      const payload = response.data as ModelTestResponse;

      setTestResults(prev => {
        const next = new Map(prev);
        next.set(key, {
          success: !!payload.success,
          message: payload.message || (payload.success ? 'Model merespons' : 'Model gagal merespons'),
          statusCode: payload.status_code,
          durationMs: payload.duration_ms,
          testedAt: Date.now(),
        });
        return next;
      });
    } catch (error) {
      const fallbackMessage = error instanceof Error ? error.message : 'Request gagal dijalankan';
      const apiErrorMessage = typeof error === 'object' && error !== null
        ? ((error as { response?: { data?: { error?: string } } }).response?.data?.error || fallbackMessage)
        : fallbackMessage;

      setTestResults(prev => {
        const next = new Map(prev);
        next.set(key, {
          success: false,
          message: apiErrorMessage,
          testedAt: Date.now(),
        });
        return next;
      });
    } finally {
      setTestingModels(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, []);

  // Stats
  const totalModels = groupedByProvider.reduce((acc, p) => acc + p.models.length, 0);
  const enabledModels = groupedByProvider.reduce((acc, provider) => {
    return acc + provider.models.filter(({ model, authFile }) => isModelEnabled(authFile, model.id)).length;
  }, 0);
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
                <p className="text-white/60 text-sm mt-1">Add/Edit/Remove berlaku lintas auth file dalam provider yang sama, plus test live untuk cek model benar-benar bisa dipakai</p>
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
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium transition-all duration-200 flex items-center gap-2 border border-blue-500/30"
            >
              <Plus className="w-4 h-4" />
              Add Model
            </button>
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
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Add Model</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-2">Model ID</label>
                  <input
                    value={newModel.modelId}
                    onChange={(e) => setNewModel(prev => ({ ...prev, modelId: e.target.value }))}
                    placeholder="Contoh: gpt-5.4-mini"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-2">Display Name</label>
                  <input
                    value={newModel.displayName}
                    onChange={(e) => setNewModel(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Contoh: GPT 5.4 Mini"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Provider</label>
                    <input
                      value={newModel.provider}
                      onChange={(e) => setNewModel(prev => ({ ...prev, provider: e.target.value }))}
                      placeholder="Contoh: codex"
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                    />
                    <p className="mt-1 text-xs text-blue-200/80">Model akan ditambahkan ke semua auth file dalam provider ini.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Auth File (opsional)</label>
                    <select
                      value={newModel.authFile}
                      onChange={(e) => {
                        const authFile = e.target.value;
                        const option = authFileOptions.find(item => item.name === authFile);
                        setNewModel(prev => ({
                          ...prev,
                          authFile,
                          provider: option?.provider || prev.provider,
                        }));
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="" className="bg-slate-800">Auto (semua auth file provider)</option>
                      {authFileOptions.map(item => (
                        <option key={item.name} value={item.name} className="bg-slate-800">
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddModel}
                  disabled={addMutation.isPending || !newModel.modelId.trim() || !newModel.provider.trim()}
                  className="px-4 py-2.5 rounded-xl bg-blue-500/30 hover:bg-blue-500/40 text-blue-100 border border-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addMutation.isPending ? 'Adding...' : 'Add Model'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">Edit Model</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/70 mb-2">Model ID</label>
                  <input
                    value={editModel.modelId}
                    onChange={(e) => setEditModel(prev => ({ ...prev, modelId: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/70 mb-2">Display Name</label>
                  <input
                    value={editModel.displayName}
                    onChange={(e) => setEditModel(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Provider</label>
                    <input
                      value={editModel.provider}
                      onChange={(e) => setEditModel(prev => ({ ...prev, provider: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
                    />
                    <p className="mt-1 text-xs text-amber-200/80">Perubahan akan diterapkan ke semua auth file provider ini.</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Auth File (opsional)</label>
                    <select
                      value={editModel.authFile}
                      onChange={(e) => setEditModel(prev => ({ ...prev, authFile: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50"
                    >
                      <option value="" className="bg-slate-800">Auto (semua auth file provider)</option>
                      {authFileOptions.map(item => (
                        <option key={item.name} value={item.name} className="bg-slate-800">
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={editModel.enabled}
                    onChange={(e) => setEditModel(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="rounded border-white/20 bg-white/5"
                  />
                  Enabled
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitEditModel}
                  disabled={editMutation.isPending || !editModel.modelId.trim() || !editModel.provider.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/30 hover:bg-amber-500/40 text-amber-100 border border-amber-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {removedModels.length > 0 && (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-amber-200">Hidden Models ({removedModels.length})</h3>
              <p className="text-xs text-amber-200/70">Model yang pernah dihapus bisa di-restore atau di-edit</p>
            </div>
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {removedModels.map((setting) => {
                const key = `${setting.auth_file}:${setting.model_id}`;
                const isRestoring = restoringModels.has(key);
                return (
                  <div key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{setting.display_name || setting.model_id}</p>
                      <p className="text-xs text-white/50 font-mono truncate">{setting.model_id} • {setting.provider || 'unknown'} • {setting.auth_file}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenEditModal({
                          authFile: setting.auth_file,
                          modelId: setting.model_id,
                          displayName: setting.display_name,
                          provider: setting.provider,
                          enabled: setting.enabled,
                        })}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs border border-amber-500/40"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRestoreModel(setting)}
                        disabled={isRestoring}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 text-xs border border-emerald-500/40 disabled:opacity-50"
                      >
                        {isRestoring ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              const enabledCount = provider.models.filter(({ model, authFile }) => 
                isModelEnabled(authFile, model.id)
              ).length;
              
              return (
                <div key={provider.type} className="space-y-4">
                  {/* Provider Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${providerColor}20` }}
                    >
                      <Cpu className="w-5 h-5" style={{ color: providerColor }} strokeWidth={2} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-lg font-semibold text-white capitalize">{provider.type}</h2>
                      <p className="text-sm text-white/50">{provider.authFiles.length} auth file{provider.authFiles.length > 1 ? 's' : ''} • {provider.models.length} models</p>
                    </div>
                    <div className="text-sm text-white/50">
                      {enabledCount} enabled
                    </div>
                  </div>

                  {/* Models - Card View */}
                  {viewMode === 'card' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {provider.models.map(({ model, authFile }) => {
                        const enabled = isModelEnabled(authFile, model.id);
                        const modelKey = `${authFile}:${model.id}`;
                        const isPending = pendingChanges.has(modelKey);
                        const isRemoving = removingModels.has(modelKey);
                        const isTesting = testingModels.has(modelKey);
                        const testResult = testResults.get(modelKey);
                        const displayLabel = getModelLabelWithProvider(model.display_name || model.id, provider.type);
                        
                        return (
                          <div
                            key={`${authFile}:${model.id}`}
                            className={`model-card relative overflow-hidden rounded-xl border backdrop-blur-sm p-4 transition-all duration-300 ${
                              enabled 
                                ? 'border-white/20 bg-gradient-to-br from-white/5 to-transparent' 
                                : 'border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
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
                                    className={`text-sm font-medium break-words transition-colors ${
                                      enabled ? 'text-white' : 'text-white/50'
                                    }`}
                                    title={displayLabel}
                                  >
                                    {displayLabel}
                                  </p>
                                  <p className="text-xs text-white/40 break-all font-mono" title={model.id}>
                                    {model.id}
                                  </p>
                                </div>
                              </div>
                              <div className="flex-shrink-0 flex items-center gap-2">
                                <button
                                  onClick={() => handleOpenEditModal({
                                    authFile,
                                    modelId: model.id,
                                    displayName: model.display_name,
                                    provider: provider.type,
                                    enabled,
                                  })}
                                  className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                  title="Edit model"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleRemoveModel(authFile, model.id, provider.type)}
                                  disabled={isRemoving}
                                  className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 disabled:opacity-50"
                                  title="Remove model"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleTestModel(authFile, model.id, provider.type)}
                                  disabled={isTesting}
                                  className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 disabled:opacity-50"
                                  title={isTesting ? 'Testing...' : 'Test model'}
                                >
                                  <FlaskConical className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse' : ''}`} />
                                </button>
                                <ToggleSwitch
                                  enabled={enabled}
                                  onChange={(newEnabled) => handleToggle(
                                    authFile,
                                    model.id,
                                    model.display_name || model.id,
                                    provider.type,
                                    newEnabled
                                  )}
                                  loading={isPending}
                                />
                              </div>
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
                              <span className={`truncate max-w-[52%] text-right ${
                                !testResult
                                  ? 'text-white/30'
                                  : testResult.success
                                    ? 'text-emerald-300'
                                    : 'text-rose-300'
                              }`} title={testResult?.message || 'Belum pernah dites'}>
                                {isTesting
                                  ? 'Testing...'
                                  : testResult
                                    ? `${testResult.success ? 'Test OK' : 'Test Gagal'}${testResult.statusCode ? ` (${testResult.statusCode})` : ''}`
                                    : 'Belum dites'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* List View */
                    <div className="glass-panel rounded-xl overflow-hidden border border-white/10">
                      <table className="w-full table-fixed">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.02]">
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-2/5">Model</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider w-1/3">Model ID</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider w-24">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider w-32">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {provider.models.map(({ model, authFile }) => {
                            const enabled = isModelEnabled(authFile, model.id);
                            const modelKey = `${authFile}:${model.id}`;
                            const isPending = pendingChanges.has(modelKey);
                            const isRemoving = removingModels.has(modelKey);
                            const isTesting = testingModels.has(modelKey);
                            const testResult = testResults.get(modelKey);
                            const displayLabel = getModelLabelWithProvider(model.display_name || model.id, provider.type);
                            
                            return (
                              <tr 
                                key={`${authFile}:${model.id}`}
                                className={`model-card hover:bg-white/[0.02] transition-colors ${
                                  !enabled ? 'opacity-60' : ''
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div 
                                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                                        enabled ? '' : 'grayscale opacity-50'
                                      }`}
                                      style={{ background: `${providerColor}15` }}
                                    >
                                      <Cpu className="w-4 h-4" style={{ color: providerColor }} strokeWidth={2} />
                                    </div>
                                    <span 
                                      className={`text-sm font-medium break-words ${
                                        enabled ? 'text-white' : 'text-white/50'
                                      }`}
                                      title={displayLabel}
                                    >
                                      {displayLabel}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-xs text-white/40 font-mono break-all" title={model.id}>
                                    {model.id}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                    enabled 
                                      ? 'bg-green-500/20 text-green-400' 
                                      : 'bg-white/5 text-white/40'
                                  }`}>
                                    {enabled ? (
                                      <>
                                        <CheckCircle className="w-3 h-3" />
                                        Enabled
                                      </>
                                    ) : (
                                      <>
                                        <XCircle className="w-3 h-3" />
                                        Disabled
                                      </>
                                    )}
                                  </span>
                                  <div
                                    className={`mt-1 text-[11px] ${
                                      !testResult
                                        ? 'text-white/30'
                                        : testResult.success
                                          ? 'text-emerald-300'
                                          : 'text-rose-300'
                                    }`}
                                    title={testResult?.message || 'Belum pernah dites'}
                                  >
                                    {isTesting
                                      ? 'Testing...'
                                      : testResult
                                        ? `${testResult.success ? 'OK' : 'Gagal'}${testResult.statusCode ? ` (${testResult.statusCode})` : ''}`
                                        : 'Belum dites'}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex justify-end items-center gap-2">
                                    <button
                                      onClick={() => handleOpenEditModal({
                                        authFile,
                                        modelId: model.id,
                                        displayName: model.display_name,
                                        provider: provider.type,
                                        enabled,
                                      })}
                                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                      title="Edit model"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoveModel(authFile, model.id, provider.type)}
                                      disabled={isRemoving}
                                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 disabled:opacity-50"
                                      title="Remove model"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleTestModel(authFile, model.id, provider.type)}
                                      disabled={isTesting}
                                      className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 disabled:opacity-50"
                                      title={isTesting ? 'Testing...' : 'Test model'}
                                    >
                                      <FlaskConical className={`w-3.5 h-3.5 ${isTesting ? 'animate-pulse' : ''}`} />
                                    </button>
                                    <ToggleSwitch
                                      enabled={enabled}
                                      onChange={(newEnabled) => handleToggle(
                                        authFile,
                                        model.id,
                                        model.display_name || model.id,
                                        provider.type,
                                        newEnabled
                                      )}
                                      loading={isPending}
                                    />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
