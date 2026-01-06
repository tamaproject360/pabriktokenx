import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Download, Upload, RefreshCw, Database, TrendingUp, Zap, Cpu, AlertTriangle } from 'lucide-react';
import { getUsage, exportUsage, importUsage } from '../lib/api';
import { useRef, useEffect } from 'react';
import { animatePageEnter, animateCounter } from '../lib/animations';

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
}

function StatCard({ title, value, icon: Icon, color, subtitle }: StatCardProps) {
  const countRef = useRef<HTMLParagraphElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (countRef.current && !hasAnimated.current) {
      hasAnimated.current = true;
      animateCounter(countRef.current, value, {
        duration: 1.5,
        decimals: 0,
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
        <p 
          ref={countRef}
          className="text-4xl font-bold text-white tracking-tight"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          0
        </p>
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
      return response.data;
    },
    refetchInterval: 30000,
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

  useEffect(() => {
    if (statsRef.current && !isLoading) {
      const cards = statsRef.current.querySelectorAll('.stat-card');
      animatePageEnter(cards);
    }
  }, [isLoading]);

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

  const usage = data?.usage;
  const models = usage?.models || {};
  const modelEntries = Object.entries(models).sort((a, b) => b[1].requests - a[1].requests);

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
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white tracking-tight">
              Usage Analytics
            </h1>
            <p className="text-slate-400 text-sm">
              Track API consumption and token metrics
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
        <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            title="Total Requests"
            value={usage?.total_requests || 0}
            icon={Activity}
            color="#22D3EE"
            subtitle="system throughput"
          />
          <StatCard
            title="Input Tokens"
            value={usage?.total_input_tokens || 0}
            icon={TrendingUp}
            color="#10B981"
            subtitle="data ingestion"
          />
          <StatCard
            title="Output Tokens"
            value={usage?.total_output_tokens || 0}
            icon={Zap}
            color="#8B5CF6"
            subtitle="data generation"
          />
          <StatCard
            title="Failed Requests"
            value={data?.failed_requests || 0}
            icon={AlertTriangle}
            color={(data?.failed_requests || 0) > 0 ? '#F43F5E' : '#10B981'}
            subtitle="error rate"
          />
        </div>

        {/* Model Usage Table */}
        <div className="glass-panel rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">
                Model Usage
              </h2>
              <p className="text-sm text-slate-500 mt-1">Detailed consumption breakdown by model</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Model</th>
                  <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Requests</th>
                  <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Input</th>
                  <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Output</th>
                  <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody>
                {modelEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 text-slate-500">
                      <Database className="h-14 w-14 mx-auto mb-4 opacity-40" strokeWidth={1.5} />
                      <p className="font-mono text-sm text-slate-400">No usage data detected</p>
                    </td>
                  </tr>
                ) : (
                  modelEntries.map(([model, stats]) => (
                    <tr key={model} className="border-b border-white/[0.04] transition-colors duration-200 hover:bg-white/[0.02]">
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-slate-200 hover:text-cyan-400 transition-colors">
                          {model}
                        </span>
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="text-sm text-slate-300 font-mono">{stats.requests.toLocaleString()}</span>
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="text-sm text-slate-400 font-mono">{(stats.input_tokens / 1000).toFixed(1)}K</span>
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="text-sm text-slate-400 font-mono">{(stats.output_tokens / 1000).toFixed(1)}K</span>
                      </td>
                      <td className="text-right py-4 px-4">
                        <span className="text-sm text-cyan-400 font-mono font-semibold">
                          {((stats.input_tokens + stats.output_tokens) / 1000).toFixed(1)}K
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
