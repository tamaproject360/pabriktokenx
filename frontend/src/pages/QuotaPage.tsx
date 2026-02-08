import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Activity, Database, TrendingUp, Cpu } from 'lucide-react';
import { listAuthFiles } from '../lib/api';
import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import type { AuthFile } from '../lib/api';
import { ViewToggle, type ViewMode } from '../components/ViewToggle';

// Ambient Background
function AmbientBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-float-delayed" />
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/3 to-blue-500/3 rounded-full blur-3xl animate-pulse-slow" />
    </div>
  );
}

type AuthStatus = 'active' | 'disabled' | 'rate-limited' | 'error' | 'pending' | 'refreshing' | 'unknown';

interface QuotaData {
  provider: string;
  status: AuthStatus;
  usage: number;
  limit: number;
  statusMessage?: string;
}

/**
 * Check if status_message indicates a rate limit (429 / quota exhausted).
 */
const isRateLimited = (statusMessage?: string): boolean => {
  if (!statusMessage) return false;
  const msg = statusMessage.toLowerCase();
  return msg.includes('429') ||
    msg.includes('rate') ||
    msg.includes('quota') ||
    msg.includes('exhausted') ||
    msg.includes('resource_exhausted') ||
    msg.includes('too many requests');
};

/**
 * Determine active/inactive status from backend auth file data.
 * Differentiates between rate-limited (temporary) and real errors.
 */
const getAuthFileStatus = (authFile: AuthFile): AuthStatus => {
  if (authFile.disabled) return 'disabled';

  const status = (authFile.status || '').toLowerCase();
  const statusMsg = authFile.status_message || '';

  // Rate-limited is temporary, not a real error
  if ((status === 'error' || authFile.unavailable) && isRateLimited(statusMsg)) {
    return 'rate-limited';
  }
  if (authFile.unavailable || status === 'error') return 'error';
  if (status === 'active') return 'active';
  if (status === 'disabled') return 'disabled';
  if (status === 'pending') return 'pending';
  if (status === 'refreshing') return 'refreshing';
  if (status === 'unknown' || status === '') return 'active';
  return 'active';
};

/**
 * Get human-readable status label
 */
const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    active: 'Active',
    disabled: 'Inactive',
    'rate-limited': 'Rate Limited',
    error: 'Error',
    pending: 'Pending',
    refreshing: 'Refreshing',
    unknown: 'Unknown',
  };
  return labels[status] || 'Unknown';
};

/**
 * Get status badge styling
 */
const getStatusStyle = (status: string): string => {
  const styles: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400',
    disabled: 'bg-yellow-500/20 text-yellow-400',
    'rate-limited': 'bg-amber-500/20 text-amber-400',
    error: 'bg-red-500/20 text-red-400',
    pending: 'bg-blue-500/20 text-blue-400',
    refreshing: 'bg-cyan-500/20 text-cyan-400',
    unknown: 'bg-gray-500/20 text-gray-400',
  };
  return styles[status] || 'bg-gray-500/20 text-gray-400';
};

interface QuotaCardProps {
  authFile: AuthFile & { authIndex?: number };
}

function QuotaCard({ authFile }: QuotaCardProps) {
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      'claude': 'from-orange-500/20 to-orange-600/10',
      'gemini': 'from-blue-500/20 to-blue-600/10',
      'codex': 'from-green-500/20 to-green-600/10',
      'antigravity': 'from-cyan-500/20 to-cyan-600/10',
      'iflow': 'from-purple-500/20 to-purple-600/10',
    };
    return colors[provider.toLowerCase()] || 'from-gray-500/20 to-gray-600/10';
  };

  const fetchQuota = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const provider = authFile.provider || authFile.type || 'unknown';
      const status = getAuthFileStatus(authFile);

      setQuotaData({
        provider,
        status,
        usage: 0,
        limit: 100,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quota');
    } finally {
      setLoading(false);
    }
  }, [authFile]);

  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  return (
    <div className={`quota-card relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${getProviderColor(authFile.provider || authFile.type || 'unknown')} backdrop-blur-sm p-6 hover:border-white/20 transition-all duration-300 group`}>
      {/* Provider Badge */}
      <div className="absolute top-4 right-4">
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/90 backdrop-blur-sm">
          {authFile.provider || authFile.type || 'Unknown'}
        </span>
      </div>

      {/* Auth File Info */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1 pr-24">
          {authFile.name}
        </h3>
        {authFile.provider && (
          <p className="text-sm text-white/60">Provider: {authFile.provider}</p>
        )}
      </div>

      {/* Quota Information */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-white/60" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-400 bg-red-500/10 rounded-lg p-3">
            {error}
          </div>
        ) : quotaData ? (
          <>
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-white/70">Usage</span>
                <span className="text-sm font-semibold text-white">
                  {quotaData.usage}% / {quotaData.limit}%
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${quotaData.usage}%` }}
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-sm text-white/70">Status</span>
              <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${getStatusStyle(quotaData.status)}`}>
                {getStatusLabel(quotaData.status)}
              </span>
            </div>
          </>
        ) : (
          <div className="text-sm text-white/50 text-center py-4">
            No quota data available
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => fetchQuota()}
        disabled={loading}
        className="mt-4 w-full px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}

export default function QuotaPage() {
  const gridRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');

  const { data: authFilesData, isLoading, refetch } = useQuery({
    queryKey: ['authFiles'],
    queryFn: async () => {
      const response = await listAuthFiles();
      return response.data;
    },
  });

  const getQuotaData = (authFile: AuthFile): QuotaData => {
    const provider = authFile.provider || authFile.type || 'unknown';
    const status = getAuthFileStatus(authFile);

    return {
      provider,
      status,
      usage: 0,
      limit: 100,
    };
  };

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      'claude': 'from-orange-500/20 to-orange-600/10',
      'gemini': 'from-blue-500/20 to-blue-600/10',
      'codex': 'from-green-500/20 to-green-600/10',
      'antigravity': 'from-cyan-500/20 to-cyan-600/10',
      'iflow': 'from-purple-500/20 to-purple-600/10',
    };
    return colors[provider.toLowerCase()] || 'from-gray-500/20 to-gray-600/10';
  };

  const handleRefreshAll = () => {
    setRefreshing(true);
    refetch().finally(() => {
      setTimeout(() => setRefreshing(false), 500);
    });
  };

  // Animate stats cards with proper GPU acceleration
  const animateStats = useCallback(() => {
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

  // Animate quota cards with proper GPU acceleration
  const animateCards = useCallback(() => {
    if (!gridRef.current) return;
    
    const cards = gridRef.current.querySelectorAll('.quota-card');
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
    if (!isLoading && authFilesData) {
      requestAnimationFrame(() => {
        animateStats();
        animateCards();
      });
    }
  }, [isLoading, authFilesData, animateStats, animateCards]);

  const authFiles = (authFilesData?.files || []) as (AuthFile & { authIndex?: number })[];
  const hasAuthFiles = authFiles.length > 0;

  // Calculate unique providers (by provider category, not per-account)
  const uniqueProviders = new Set(authFiles.map(f => (f.provider || f.type || 'unknown').toLowerCase()));
  const totalProviders = uniqueProviders.size;

  // Calculate active accounts using actual backend status
  // Rate-limited accounts are still valid (temporary condition)
  const activeAccounts = authFiles.filter(f => {
    const status = getAuthFileStatus(f);
    return status === 'active' || status === 'refreshing' || status === 'pending' || status === 'rate-limited';
  }).length;

  // Calculate average usage (placeholder since real usage requires API calls)
  const totalAccounts = authFiles.length;

  return (
    <>
      <AmbientBackground />
      <div className="min-h-screen p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10">
                <Database className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Quota Management</h1>
                <p className="text-white/60 text-sm mt-1">Monitor and manage API quotas for all providers</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ViewToggle viewMode={viewMode} onChange={setViewMode} />
              <button
                onClick={handleRefreshAll}
                disabled={refreshing || isLoading}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-white/10"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh All
              </button>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="stat-card relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <Cpu className="w-8 h-8 text-purple-400" />
              <TrendingUp className="w-5 h-5 text-purple-400/60" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{totalProviders}</div>
            <div className="text-sm text-white/60">Total Providers</div>
          </div>

          <div className="stat-card relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-8 h-8 text-blue-400" />
              <TrendingUp className="w-5 h-5 text-blue-400/60" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {activeAccounts}
            </div>
            <div className="text-sm text-white/60">Active Accounts</div>
          </div>

          <div className="stat-card relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <Database className="w-8 h-8 text-green-400" />
              <TrendingUp className="w-5 h-5 text-green-400/60" />
            </div>
            <div className="text-3xl font-bold text-white mb-1">{totalAccounts}</div>
            <div className="text-sm text-white/60">Total Accounts</div>
          </div>
        </div>

        {/* Quota Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-white/40 mx-auto mb-4" />
              <p className="text-white/60">Loading quota information...</p>
            </div>
          </div>
        ) : !hasAuthFiles ? (
          <div className="text-center py-20">
            <Database className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white/80 mb-2">No Auth Files Found</h3>
            <p className="text-white/50 mb-6">
              Upload authentication files to start monitoring quotas
            </p>
            <button
              onClick={() => window.location.href = '/auth-files'}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-200"
            >
              Go to Auth Files
            </button>
          </div>
        ) : viewMode === 'card' ? (
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {authFiles.map((authFile, index) => (
              <QuotaCard
                key={authFile.name}
                authFile={{ ...authFile, authIndex: index }}
              />
            ))}
          </div>
        ) : (
          <div ref={gridRef} className="overflow-hidden rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm">
            <table className="min-w-full table-fixed">
              <thead className="bg-white/5">
                <tr>
                  <th className="w-1/3 px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="w-1/5 px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="w-1/5 px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-1/5 px-6 py-4 text-left text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="w-32 px-6 py-4 text-center text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {authFiles.map((authFile, index) => {
                  const quotaData = getQuotaData(authFile);
                  return (
                    <tr key={authFile.name} className="hover:bg-white/5 transition-colors duration-200">
                      <td className="px-6 py-4">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white break-words">
                            {authFile.name}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex-shrink-0">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/90">
                            {quotaData.provider}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(quotaData.status)}`}>
                          {getStatusLabel(quotaData.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-1 mr-3">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                                style={{ width: `${quotaData.usage}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-sm text-white/70 min-w-0">
                            {quotaData.usage}%
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => {}}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all duration-200"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
