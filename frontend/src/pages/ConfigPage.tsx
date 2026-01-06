import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, Download, Upload, Code, AlertCircle, Server, RefreshCw, Bug, Cpu } from 'lucide-react';
import { getConfigYAML, updateConfigYAML, getConfig, setDebug, getDebug } from '../lib/api';
import { useState, useRef, useEffect } from 'react';
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
      <div 
        className="absolute bottom-[-150px] left-[-100px] w-[400px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(245, 158, 11, 0.08), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
}

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [yamlContent, setYamlContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const { data: yamlData, isLoading } = useQuery({
    queryKey: ['configYaml'],
    queryFn: async () => {
      const response = await getConfigYAML();
      return response.data;
    },
  });

  const { data: configData } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await getConfig();
      return response.data;
    },
  });

  const { data: debugData, refetch: refetchDebug } = useQuery({
    queryKey: ['debug'],
    queryFn: async () => {
      const response = await getDebug();
      return response.data;
    },
  });

  useEffect(() => {
    if (yamlData && !hasChanges) {
      setYamlContent(typeof yamlData === 'string' ? yamlData : JSON.stringify(yamlData, null, 2));
    }
  }, [yamlData, hasChanges]);

  useEffect(() => {
    if (containerRef.current && !isLoading) {
      const sections = containerRef.current.querySelectorAll('.config-section');
      animatePageEnter(sections, { stagger: 0.1 });
    }
  }, [isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (yaml: string) => {
      const response = await updateConfigYAML(yaml);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['configYaml'] });
      setHasChanges(false);
    },
  });

  const debugMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await setDebug(enabled);
      return response.data;
    },
    onSuccess: () => {
      refetchDebug();
    },
  });

  const handleYamlChange = (value: string) => {
    setYamlContent(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(yamlContent);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setYamlContent(content);
        setHasChanges(true);
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  const isDebugEnabled = debugData?.debug ?? configData?.debug ?? false;

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
            <p className="text-slate-400 font-mono text-sm">Loading configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div ref={containerRef} className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white tracking-tight">
              Configuration
            </h1>
            <p className="text-slate-400 text-sm">
              Edit server configuration file
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-200"
            >
              <Download className="h-4 w-4 text-cyan-400" strokeWidth={2} />
              <span className="text-white text-sm font-medium">Download</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-200 cursor-pointer">
              <Upload className="h-4 w-4 text-violet-400" strokeWidth={2} />
              <span className="text-white text-sm font-medium">Upload</span>
              <input
                type="file"
                accept=".yaml,.yml"
                onChange={handleUpload}
                className="hidden"
              />
            </label>
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all duration-300 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>

        {/* Quick Settings */}
        <div className="config-section glass-panel rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(139, 92, 246, 0.15)', boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }}
              >
                <Settings className="h-5 w-5 text-violet-400" strokeWidth={1.5} />
              </div>
              <h3 className="text-lg font-semibold text-white">Quick Settings</h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Debug Mode Toggle */}
              <div className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ 
                      background: isDebugEnabled ? 'rgba(245, 158, 11, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                    }}
                  >
                    <Bug className={`h-5 w-5 ${isDebugEnabled ? 'text-amber-400' : 'text-slate-400'}`} strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-medium text-white">Debug Mode</p>
                    <p className="text-sm text-slate-500">Verbose logging</p>
                  </div>
                </div>
                <button
                  onClick={() => debugMutation.mutate(!isDebugEnabled)}
                  disabled={debugMutation.isPending}
                  className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
                    isDebugEnabled 
                      ? 'bg-cyan-500/30 border border-cyan-500/50' 
                      : 'bg-white/[0.05] border border-white/[0.1]'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300 ${
                      isDebugEnabled ? 'left-8' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Server Info */}
              <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(34, 211, 238, 0.15)' }}
                  >
                    <Server className="h-5 w-5 text-cyan-400" strokeWidth={1.5} />
                  </div>
                  <p className="font-medium text-white">Server Address</p>
                </div>
                <p className="text-2xl font-mono text-slate-200">
                  {configData?.host || '0.0.0.0'}:{configData?.port || 8080}
                </p>
              </div>

              {/* Retry Config */}
              <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(16, 185, 129, 0.15)' }}
                  >
                    <RefreshCw className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
                  </div>
                  <p className="font-medium text-white">Request Retry</p>
                </div>
                <p className="text-2xl font-mono text-slate-200">
                  {configData?.request_retry || 0}x
                  <span className="text-lg text-slate-500 ml-2">
                    / {configData?.max_retry_interval || 0}s
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {saveMutation.isError && (
          <div className="config-section flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to save configuration. Please check YAML syntax.</span>
          </div>
        )}

        {/* YAML Editor */}
        <div className="config-section glass-panel rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245, 158, 11, 0.15)', boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)' }}
              >
                <Code className="h-5 w-5 text-amber-400" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">config.yaml</h3>
                {hasChanges && (
                  <span className="text-xs text-amber-400">Modified</span>
                )}
              </div>
            </div>
          </div>
          <div className="p-5">
            <textarea
              ref={textareaRef}
              value={yamlContent}
              onChange={(e) => handleYamlChange(e.target.value)}
              className="w-full h-[500px] px-5 py-4 bg-[#020202] border border-white/[0.04] rounded-xl text-emerald-400 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
              spellCheck={false}
              style={{ lineHeight: '1.6' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
