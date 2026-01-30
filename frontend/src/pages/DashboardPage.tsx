import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Zap,
  Server,
  Users,
  TrendingUp,
  Cpu,
  Network,
  SlidersHorizontal,
  Database,
} from 'lucide-react';
import { getUsage, getConfig, listAuthFiles, getAuthKey } from '../lib/api';
import { animateCounter } from '../lib/animations';
import gsap from 'gsap';

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
  suffix?: string; // Added for % or other suffixes
}

function StatCard({ title, value, icon: Icon, color, subtitle, large = false, suffix = '' }: StatCardProps) {
  const countRef = useRef<HTMLParagraphElement>(null);
  const targetValue = typeof value === 'number' ? value : parseInt(value.toString().replace(/,/g, '')) || 0;
  const prevValueRef = useRef<number>(0);

  useEffect(() => {
    if (countRef.current && targetValue !== prevValueRef.current) {
      prevValueRef.current = targetValue;
      animateCounter(countRef.current, targetValue, {
        duration: 1.2,
        decimals: 0,
      });
    }
  }, [targetValue]);

  // Format number untuk display
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

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
        <div className="flex items-baseline gap-1">
          <p 
            ref={countRef}
            className={`font-bold text-white tracking-tight ${large ? 'text-5xl' : 'text-4xl'}`}
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {value}
          </p>
          {suffix && (
            <span className="text-2xl font-semibold text-slate-400">{suffix}</span>
          )}
        </div>
      </div>
    </div>
  );
}

interface ModelUsageProps {
  models: Record<string, { requests: number; tokens: number }>;
}

function ModelUsageTable({ models }: ModelUsageProps) {
  const tableRef = useRef<HTMLDivElement>(null);
  const entries = Object.entries(models || {}).sort((a, b) => b[1].requests - a[1].requests);
  const prevEntriesLength = useRef(0);

  useEffect(() => {
    if (tableRef.current && entries.length > 0 && entries.length !== prevEntriesLength.current) {
      prevEntriesLength.current = entries.length;
      const rows = tableRef.current.querySelectorAll('tbody tr');
      
      gsap.set(rows, { 
        opacity: 0, 
        x: -8,
        willChange: 'transform, opacity'
      });
      
      gsap.to(rows, {
        opacity: 1,
        x: 0,
        duration: 0.15,
        stagger: 0.03,
        ease: 'power2.out',
        force3D: true,
        clearProps: 'willChange',
      });
    }
  }, [entries.length]);

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
            <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Tokens</th>
            <th className="text-right py-4 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg/Request</th>
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
                <span className="text-sm text-slate-400 font-mono">{(stats.tokens / 1000).toFixed(1)}K</span>
              </td>
              <td className="text-right py-4 px-4">
                <span className="text-xs text-slate-500 font-mono">
                  {stats.requests > 0 ? Math.round(stats.tokens / stats.requests) : 0}
                </span>
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
  
  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const response = await getUsage();
      console.log('[Dashboard] Usage data:', {
        total_requests: response.data?.usage?.total_requests || response.data?.total_requests,
        timestamp: new Date().toISOString()
      });
      return response.data;
    },
    refetchInterval: 2000, // Refresh setiap 2 detik untuk real-time
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: configData, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await getConfig();
      return response.data;
    },
    refetchInterval: 10000, // Refresh setiap 10 detik
    refetchOnWindowFocus: true,
  });

  const { data: authFilesData } = useQuery({
    queryKey: ['authFiles'],
    queryFn: async () => {
      const response = await listAuthFiles();
      return response.data;
    },
    refetchInterval: 5000, // Refresh setiap 5 detik
    refetchOnWindowFocus: true,
  });

  // Parse usage data dengan fallback - HARUS DI ATAS SEBELUM HOOKS LAIN
  const usage = usageData?.usage || usageData;
  const totalRequests = usage?.total_requests || 0;
  const successCount = usage?.success_count || 0;
  const failureCount = usage?.failure_count || 0;
  const totalTokens = usage?.total_tokens || 0;
  const failedRequests = usageData?.failed_requests || failureCount || 0;
  const authFilesCount = authFilesData?.files?.length || authFilesData?.length || 0;
  const serverPort = configData?.port || 9999;
  
  // Extract models from APIs
  const apis = usage?.apis || {};
  const allModels: Record<string, { requests: number; tokens: number }> = {};
  
  Object.values(apis).forEach((api: any) => {
    if (api.models) {
      Object.entries(api.models).forEach(([modelName, modelData]: [string, any]) => {
        if (!allModels[modelName]) {
          allModels[modelName] = { requests: 0, tokens: 0 };
        }
        allModels[modelName].requests += modelData.total_requests || 0;
        allModels[modelName].tokens += modelData.total_tokens || 0;
      });
    }
  });
  
  const modelCount = Object.keys(allModels).length;

  // Smooth card animation like AuthFilesPage
  const animateCards = useCallback(() => {
    if (!gridRef.current) return;
    
    const cards = gridRef.current.querySelectorAll('.dashboard-card');
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

  // SEMUA useEffect HARUS DI SINI - SEBELUM CONDITIONAL RETURN
  useEffect(() => {
    if (!usageLoading && !configLoading && usageData) {
      requestAnimationFrame(() => {
        animateCards();
      });
    }
  }, [usageLoading, configLoading, usageData, animateCards]);

  // Debug logging untuk melihat data yang diterima
  useEffect(() => {
    if (usageData) {
      console.log('📊 Dashboard Data Update:', {
        totalRequests,
        totalTokens,
        successCount,
        failureCount,
        modelCount,
        models: Object.keys(allModels),
        rawData: usageData
      });
    }
  }, [usageData, totalRequests, totalTokens, modelCount, successCount, failureCount]);

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

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div className="relative z-10 space-y-8">
        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white tracking-tight">
              Control Center
            </h1>
            <p className="text-slate-400 text-sm">
              Real-time system diagnostics and performance metrics
            </p>
          </div>
          
          {/* Live Indicator */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl glass-panel">
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-emerald-400 blur-md opacity-50 animate-pulse" />
              <div className="relative w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <span className="text-sm font-medium text-emerald-400">Live (3s refresh)</span>
          </div>
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
            title="Total Tokens"
            value={totalTokens}
            icon={TrendingUp}
            color="#10B981"
            subtitle="tokens processed"
          />
          
          <StatCard
            title="Success Rate"
            value={totalRequests > 0 ? Math.round((successCount / totalRequests) * 100) : 0}
            icon={Zap}
            color="#8B5CF6"
            subtitle="% successful"
            suffix="%"
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
            subtitle="in use"
          />
        </div>

        {/* Model Settings Link Card */}
        <Link 
          to="/model-settings"
          className="dashboard-card glass-panel rounded-2xl p-6 card-hover relative overflow-hidden block group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
                style={{ 
                  background: 'rgba(168, 85, 247, 0.15)',
                  boxShadow: '0 0 20px rgba(168, 85, 247, 0.25)',
                }}
              >
                <SlidersHorizontal className="h-6 w-6 text-purple-400" strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight group-hover:text-purple-300 transition-colors">
                  Model Settings
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Enable or disable models for Playground and API requests
                </p>
              </div>
            </div>
            <div className="px-4 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
              <span className="text-sm font-medium text-purple-400">Configure →</span>
            </div>
          </div>
        </Link>

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
          <ModelUsageTable models={allModels} />
        </div>
      </div>
    </div>
  );
}
