import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CheckCircle2, Infinity } from 'lucide-react';
import { getRateLimits } from '../lib/api';

interface RateLimitData {
  provider: string;
  hourly_limit: number | string;
  hourly_usage: number;
  remaining: number | string;
  percentage: number;
  reset_time: string | null;
  weekly_limit?: number | string;
  weekly_usage?: number;
  weekly_remaining?: number | string;
  weekly_percentage?: number;
  note?: string;
}

interface RateLimitsResponse {
  rate_limits: Record<string, RateLimitData>;
  last_updated: string;
}

export function RateLimitsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ['rateLimits'],
    queryFn: async () => {
      const response = await getRateLimits();
      return response.data as RateLimitsResponse;
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading || !data) {
    return (
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Rate Limits</h3>
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const providers = Object.values(data.rate_limits);

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Rate Limits</h3>
        <button className="text-xs text-slate-400 hover:text-white transition-colors">
          Usage Period
        </button>
      </div>
      
      <div className="space-y-5">
        {providers.map((limit) => {
          const isUnlimited = limit.hourly_limit === 'Unlimited';
          const isString = typeof limit.hourly_limit === 'string' && !isUnlimited;
          const percentage = isUnlimited ? 0 : (limit.percentage || 0) * 100;
          const status = percentage > 90 ? 'critical' : percentage > 70 ? 'warning' : 'good';

          // Provider color mapping
          const colorMap: Record<string, { bg: string, dot: string, bar: string }> = {
            'OpenAI': { bg: 'bg-cyan-500/15', dot: 'bg-cyan-400', bar: 'bg-cyan-400' },
            'Anthropic': { bg: 'bg-violet-500/15', dot: 'bg-violet-400', bar: 'bg-violet-400' },
            'Google': { bg: 'bg-blue-500/15', dot: 'bg-blue-400', bar: 'bg-blue-400' },
          };
          const colors = colorMap[limit.provider] || colorMap['OpenAI'];

          return (
            <div key={limit.provider}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
                  <div className={`w-4 h-4 rounded-full ${colors.dot}`} />
                </div>
                <span className="text-sm font-medium text-white">{limit.provider}</span>
              </div>
              <div className="space-y-2 pl-11">
                {/* Hourly limit */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-400">5 hour usage limit</span>
                    {isUnlimited ? (
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-medium text-xs flex items-center gap-1">
                          <Infinity className="h-3 w-3" /> Unlimited
                        </span>
                      </div>
                    ) : isString ? (
                      <span className="font-mono text-slate-300">{limit.hourly_limit}</span>
                    ) : (
                      <span className="font-mono text-slate-300">
                        {typeof limit.hourly_usage === 'number' ? (limit.hourly_usage / 1000).toFixed(1) : 0}k /{' '}
                        {typeof limit.hourly_limit === 'number' ? (limit.hourly_limit / 1000).toFixed(0) : limit.hourly_limit}k
                      </span>
                    )}
                  </div>
                  
                  {!isUnlimited && (
                    <>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            status === 'critical' ? 'bg-rose-400' : 
                            status === 'warning' ? 'bg-amber-400' : 
                            colors.bar
                          }`} 
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className={
                          status === 'critical' ? 'text-rose-400' : 
                          status === 'warning' ? 'text-amber-400' : 
                          'text-emerald-400'
                        }>
                          {status === 'critical' ? (
                            <span className="flex items-center gap-1 font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              {(100 - percentage).toFixed(1)}% remaining
                            </span>
                          ) : status === 'warning' ? (
                            <span className="flex items-center gap-1 font-medium">
                              <Activity className="h-3 w-3" />
                              {(100 - percentage).toFixed(1)}% remaining
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 font-medium">
                              <CheckCircle2 className="h-3 w-3" />
                              {(100 - percentage).toFixed(1)}% remaining
                            </span>
                          )}
                        </span>
                        {limit.reset_time && (
                          <span className="text-slate-500">
                            Reset {new Date(limit.reset_time).toLocaleString('en-US', { 
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  
                  {limit.note && (
                    <p className="text-xs text-slate-500">{limit.note}</p>
                  )}
                </div>

                {/* Weekly limit */}
                {limit.weekly_limit && !isUnlimited && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-400">Weekly usage limit</span>
                      <span className="font-mono text-slate-300">
                        {typeof limit.weekly_usage === 'number' ? (limit.weekly_usage / 1000).toFixed(2) : '0'}k /{' '}
                        {typeof limit.weekly_limit === 'number' ? (limit.weekly_limit / 1000).toFixed(0) : limit.weekly_limit}k
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${colors.bar}`} 
                        style={{ 
                          width: `${Math.min((limit.weekly_percentage || 0) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-emerald-400 font-medium">
                        {typeof limit.weekly_percentage === 'number' 
                          ? `${(100 - limit.weekly_percentage * 100).toFixed(1)}% remaining`
                          : '100% remaining'
                        }
                      </span>
                      {limit.reset_time && (
                        <span className="text-slate-500">
                          Reset {new Date(limit.reset_time).toLocaleString('en-US', { 
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
