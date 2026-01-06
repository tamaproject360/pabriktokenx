import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  Zap,
  Server,
  Users,
  Database,
  TrendingUp,
  Cpu,
  Network,
} from 'lucide-react';
import { getUsage, getConfig, listAuthFiles } from '../lib/api';
import { animatePageEnter, animateCounter, animateList } from '../lib/animations';

// Ambient Background Component
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Main cyan spotlight */}
      <div 
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.15), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      {/* Secondary purple glow */}
      <div 
        className="absolute top-[200px] right-[-100px] w-[400px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.1), transparent 70%)',
          filter: 'blur(100px)',
        }}
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  large?: boolean;
}

function StatCard({ title, value, icon: Icon, color, subtitle, large = false }: StatCardProps) {
  const countRef = useRef<HTMLParagraphElement>(null);
  const targetValue = typeof value === 'number' ? value : parseInt(value.toString().replace(/,/g, '')) || 0;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (countRef.current && !hasAnimated.current) {
      hasAnimated.current = true;
      animateCounter(countRef.current, targetValue, {
        duration: 1.5,
        decimals: 0,
      });
    }
  }, [targetValue]);

  return (
    <div className={`dashboard-card glass-panel rounded-2xl p-6 card-hover relative overflow-hidden ${large ? 'lg:col-span-2' : ''}`}>
      {/* Subtle gradient overlay */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          background: `linear-gradient(135deg, ${color}, transparent 60%)`,
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-medium mb-1">{title}</p>
            {subtitle && (
              <p className="text-xs text-slate-500 font-mono">{subtitle}</p>
            )}
          </div>
          
          {/* Glowing Icon */}
          <div 
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ 
              background: `${color}15`,
              boxShadow: `0 0 20px ${color}25`,
            }}
          >
            <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.5} />
          </div>
        </div>

        {/* Big Value */}
        <p 
          ref={countRef}
          className={`font-bold text-white tracking-tight ${large ? 'text-5xl' : 'text-4xl'}`}
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          0
        </p>
      </div>
    </div>
  );
}

interface ModelUsageProps {
  models: Record<string, { requests: number; input_tokens: number; output_tokens: number }>;
}

function ModelUsageTable({ models }: ModelUsageProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const entries = Object.entries(models || {}).sort((a, b) => b[1].requests - a[1].requests);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (tableRef.current && !hasAnimated.current && entries.length > 0) {
      hasAnimated.current = true;
      const rows = tableRef.current.querySelectorAll('tbody tr');
      animateList(rows, { delay: 0.2 });
    }
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <Database className="h-14 w-14 mx-auto mb-4 opacity-40" strokeWidth={1.5} />
        <p className="font-mono text-sm text-slate-400">No model activity detected</p>
      </div>
    );
  }

  return (
    <div ref={tableRef} className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Model</th>
            <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Requests</th>
            <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Input</th>
            <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Output</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 10).map(([model, stats]) => (
            <tr 
              key={model} 
              className="border-b border-white/[0.04] transition-colors duration-200 hover:bg-white/[0.02]"
            >
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const gridRef = useRef<HTMLDivElement>(null);
  
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const response = await getUsage();
      return response.data;
    },
    refetchInterval: 30000,
  });

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await getConfig();
      return response.data;
    },
  });

  const { data: authFilesData } = useQuery({
    queryKey: ['authFiles'],
    queryFn: async () => {
      const response = await listAuthFiles();
      return response.data;
    },
  });

  useEffect(() => {
    // Page Entry Animation - Using standardized animation utilities
    if (gridRef.current && !usageLoading && !configLoading) {
      const cards = gridRef.current.querySelectorAll('.dashboard-card');
      animatePageEnter(cards);
    }
  }, [usageLoading, configLoading]);

  const isLoading = usageLoading || configLoading;

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
            <p className="text-slate-400 font-mono text-sm tracking-wide">Initializing Control Matrix...</p>
          </div>
        </div>
      </div>
    );
  }

  const usage = usageData?.usage;
  const totalRequests = usage?.total_requests || 0;
  const totalInputTokens = usage?.total_input_tokens || 0;
  const totalOutputTokens = usage?.total_output_tokens || 0;
  const failedRequests = usageData?.failed_requests || 0;
  const authFilesCount = authFilesData?.files?.length || 0;
  const serverPort = configData?.port || 9999;
  const modelCount = Object.keys(usage?.models || {}).length;

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div className="relative z-10 space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold text-white tracking-tight">
            Control Center
          </h1>
          <p className="text-slate-400 text-sm">
            Real-time system diagnostics and performance metrics
          </p>
        </div>

        {/* Stats Grid */}
        <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Primary Stats - Large */}
          <StatCard
            title="Total Requests"
            value={totalRequests}
            icon={Activity}
            color="#22D3EE"
            subtitle="system throughput"
            large
          />
          
          <StatCard
            title="Input Tokens"
            value={totalInputTokens}
            icon={TrendingUp}
            color="#10B981"
            subtitle="data ingestion"
          />
          
          <StatCard
            title="Output Tokens"
            value={totalOutputTokens}
            icon={Zap}
            color="#8B5CF6"
            subtitle="data generation"
          />

          {/* Secondary Stats */}
          <StatCard
            title="Auth Files"
            value={authFilesCount}
            icon={Users}
            color="#F59E0B"
            subtitle="credentials"
          />
          
          <StatCard
            title="Failed Requests"
            value={failedRequests}
            icon={AlertTriangle}
            color={failedRequests > 0 ? '#F43F5E' : '#10B981'}
            subtitle="error rate"
          />
          
          <StatCard
            title="Server Port"
            value={serverPort}
            icon={Server}
            color="#06B6D4"
            subtitle="endpoint"
          />
          
          <StatCard
            title="Active Models"
            value={modelCount}
            icon={Network}
            color="#A78BFA"
            subtitle="neural networks"
          />
        </div>

        {/* Model Usage Table */}
        <div className="dashboard-card glass-panel rounded-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white tracking-tight">
                Model Activity
              </h2>
              <p className="text-sm text-slate-500 mt-1">Usage analytics across all neural networks</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Live</span>
            </div>
          </div>
          <ModelUsageTable models={usage?.models || {}} />
        </div>
      </div>
    </div>
  );
}
