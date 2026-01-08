import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Download, Upload, RefreshCw, Database, TrendingUp, Zap, Cpu, AlertTriangle, DollarSign, Clock, BarChart3 } from 'lucide-react';
import { getUsage, exportUsage, importUsage, getConfig } from '../lib/api';
import { useRef, useEffect, useCallback } from 'react';
import { animateCounter } from '../lib/animations';
import gsap from 'gsap';
import { RateLimitsSection } from '../components/RateLimitsSection';
import { RequestTrendsChart } from '../components/RequestTrendsChart';

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

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  subtitle: string;
  prefix?: string;
  suffix?: string;
}

function StatCard({ title, value, icon: Icon, color, subtitle, prefix, suffix }: StatCardProps) {
  const countRef = useRef<HTMLParagraphElement>(null);
  const prevValueRef = useRef<number>(0);

  useEffect(() => {
    if (countRef.current && value !== prevValueRef.current) {
      const startValue = prevValueRef.current;
      prevValueRef.current = value;
      const decimals = value < 10 && value % 1 !== 0 ? 2 : 0;
      animateCounter(countRef.current, value, {
        duration: 1.2,
        decimals: decimals,
        startValue, // Start from previous value, not 0
      });
    }
  }, [value]);

  return (
    <div className="stat-card glass-panel rounded-2xl p-6 card-hover relative overflow-hidden">
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{ background: `linear-gradient(135deg, ${color}, transparent 60%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1">{title}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
          <div 
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: `${color}15`, boxShadow: `0 0 20px ${color}25` }}
          >
            <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.5} />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          {prefix && <span className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{prefix}</span>}
          <p 
            ref={countRef}
            className="text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {value}
          </p>
          {suffix && <span className="text-2xl font-bold text-white" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{suffix}</span>}
        </div>
      </div>
    </div>
  );
}

export default function UsagePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const response = await getUsage();
      console.log('[Usage] Fetched data:', {
        total_requests: response.data?.usage?.total_requests,
        total_tokens: response.data?.usage?.total_tokens,
        timestamp: new Date().toISOString()
      });
      return response.data;
    },
    refetchInterval: 2000, // Refresh setiap 2 detik untuk real-time
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await exportUsage();
      return response.data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await importUsage(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usage'] });
    },
  });

  // Smooth card animation like AuthFilesPage
  const animateCards = useCallback(() => {
    if (!statsRef.current) return;
    
    const cards = statsRef.current.querySelectorAll('.stat-card');
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
      stagger: 0.05,
      ease: 'power2.out',
      force3D: true,
      clearProps: 'willChange',
    });
  }, []);

  useEffect(() => {
    if (!isLoading && data) {
      requestAnimationFrame(() => {
        animateCards();
      });
    }
  }, [isLoading, data, animateCards]);

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          importMutation.mutate(data);
        } catch {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Parse usage data dengan struktur backend yang benar
  const usage = data?.usage || data;
  const totalRequests = usage?.total_requests || 0;
  const successCount = usage?.success_count || 0;
  const failureCount = usage?.failure_count || 0;
  const totalTokens = usage?.total_tokens || 0;
  const failedRequests = data?.failed_requests || failureCount || 0;
  
  // Extract models from APIs structure
  const apis = usage?.apis || {};
  const allModels: Record<string, { requests: number; tokens: number; details?: any[] }> = {};
  
  Object.values(apis).forEach((api: any) => {
    if (api.models) {
      Object.entries(api.models).forEach(([modelName, modelData]: [string, any]) => {
        if (!allModels[modelName]) {
          allModels[modelName] = { requests: 0, tokens: 0, details: [] };
        }
        allModels[modelName].requests += modelData.total_requests || 0;
        allModels[modelName].tokens += modelData.total_tokens || 0;
        if (modelData.details) {
          allModels[modelName].details = [...(allModels[modelName].details || []), ...modelData.details];
        }
      });
    }
  });
  
  const modelEntries = Object.entries(allModels).sort((a, b) => b[1].requests - a[1].requests);

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
            <p className="text-slate-400 font-mono text-sm">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div className="relative z-10 space-y-8">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-semibold text-white tracking-tight">
                Usage Analytics
              </h1>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-emerald-400 blur-md opacity-50 animate-pulse" />
                  <div className="relative w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs font-medium text-emerald-400">Live (3s)</span>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              Real-time API consumption and token metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-cyan-400 ${isRefetching ? 'animate-spin' : ''}`} strokeWidth={2} />
              <span className="text-white text-sm font-medium">Refresh</span>
            </button>
            <button
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300 disabled:opacity-50"
            >
              <Download className="h-4 w-4 text-emerald-400" strokeWidth={2} />
              <span className="text-white text-sm font-medium">Export</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300 cursor-pointer">
              <Upload className="h-4 w-4 text-violet-400" strokeWidth={2} />
              <span className="text-white text-sm font-medium">Import</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Stats Grid */}
        <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <StatCard
            title="Total Requests"
            value={totalRequests}
            icon={Activity}
            color="#22D3EE"
            subtitle={`Success: ${successCount} • Failed: ${failedRequests}`}
          />
          <StatCard
            title="Total Tokens"
            value={totalTokens}
            icon={TrendingUp}
            color="#F59E0B"
            subtitle={`TPM: ${Math.round(totalTokens / 60)}`}
          />
          <StatCard
            title="RPM"
            value={parseFloat((totalRequests / 60).toFixed(2))}
            icon={Clock}
            color="#10B981"
            subtitle={`Requests: ${totalRequests}`}
          />
          <StatCard
            title="TPM"
            value={Math.round(totalTokens / 60)}
            icon={Cpu}
            color="#8B5CF6"
            subtitle={`Tokens: ${(totalTokens / 1000).toFixed(0)}K`}
          />
          <StatCard
            title="Total Cost"
            value={parseFloat(((totalTokens / 1000000) * 2.8).toFixed(2))}
            icon={DollarSign}
            color="#10B981"
            subtitle="Estimated"
            prefix="$"
          />
          <StatCard
            title="Success Rate"
            value={totalRequests > 0 ? parseFloat(((successCount / totalRequests) * 100).toFixed(1)) : 100}
            icon={Zap}
            color={successCount === totalRequests ? '#10B981' : '#F59E0B'}
            subtitle="successful requests"
            suffix="%"
          />
        </div>

        {/* Rate Limits & Request Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <RateLimitsSection />
          <RequestTrendsChart />
        </div>

        {/* Model Usage Cards - Comprehensive View */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white tracking-tight">
                Model Usage Breakdown
              </h2>
              <p className="text-sm text-slate-400 mt-1">Detailed consumption by model with authentication sources</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
          </div>

          {modelEntries.length === 0 ? (
            <div className="glass-panel rounded-2xl p-16 text-center">
              <Database className="h-16 w-16 mx-auto mb-4 text-slate-600" strokeWidth={1.5} />
              <p className="text-slate-400 font-medium">No usage data detected</p>
              <p className="text-sm text-slate-500 mt-2">Start making API requests to see analytics here</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {modelEntries.map(([model, stats]) => {
                // Group details by source and auth
                const sourceMap = new Map<string, { count: number; tokens: number; authIndex: string }>();
                stats.details?.forEach((detail) => {
                  const source = detail.source || 'api-key';
                  const authIndex = detail.auth_index || 'default';
                  const key = `${source}:${authIndex}`;
                  const existing = sourceMap.get(key) || { count: 0, tokens: 0, authIndex };
                  existing.count += 1;
                  existing.tokens += detail.tokens.total_tokens;
                  sourceMap.set(key, existing);
                });

                return (
                  <div key={model} className="glass-panel rounded-2xl overflow-hidden">
                    {/* Model Header */}
                    <div className="p-6 border-b border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                            style={{ background: 'rgba(34, 211, 238, 0.15)', boxShadow: '0 0 20px rgba(34, 211, 238, 0.2)' }}
                          >
                            <Cpu className="h-6 w-6 text-cyan-400" strokeWidth={1.5} />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">{model}</h3>
                            <p className="text-sm text-slate-400 mt-0.5">
                              {sourceMap.size} authentication source{sourceMap.size !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-cyan-400 font-mono">
                            {(stats.tokens / 1000).toFixed(1)}K
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {stats.requests.toLocaleString()} request{stats.requests !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {Array.from(sourceMap.entries()).map(([key, info]) => {
                          const [source, authIndex] = key.split(':');
                          const isOAuth = source.toLowerCase().includes('oauth') || source.toLowerCase().includes('vertex') || source.toLowerCase().includes('gemini') || source.toLowerCase().includes('claude');
                          
                          return (
                            <div 
                              key={key} 
                              className="glass-panel rounded-xl p-4 hover:bg-white/[0.02] transition-all duration-200"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    {isOAuth ? (
                                      <div className="px-2 py-0.5 rounded-md bg-violet-500/20 border border-violet-500/30">
                                        <span className="text-xs font-semibold text-violet-400">OAuth</span>
                                      </div>
                                    ) : (
                                      <div className="px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-500/30">
                                        <span className="text-xs font-semibold text-cyan-400">API Key</span>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium text-white truncate" title={authIndex}>
                                    {authIndex === 'default' ? 'Primary Account' : authIndex}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5 capitalize">{source.replace(/-/g, ' ')}</p>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-baseline justify-between">
                                  <span className="text-xs text-slate-400">Requests</span>
                                  <span className="text-sm font-mono text-slate-200">{info.count}</span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-xs text-slate-400">Tokens</span>
                                  <span className="text-sm font-mono font-semibold text-cyan-400">
                                    {(info.tokens / 1000).toFixed(1)}K
                                  </span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-xs text-slate-400">Avg/Req</span>
                                  <span className="text-xs font-mono text-slate-500">
                                    {Math.round(info.tokens / info.count)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
