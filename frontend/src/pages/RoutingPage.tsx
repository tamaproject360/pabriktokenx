import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Shuffle, ArrowRight, Plus, Trash2, Network, Check } from 'lucide-react';
import { 
  getRoutingStrategy, 
  setRoutingStrategy,
  getAmpModelMappings,
  updateAmpModelMappings,
} from '../lib/api';
import { useState, useEffect, useRef } from 'react';
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
        className="absolute bottom-[-150px] right-[-100px] w-[400px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.1), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
}

const ROUTING_STRATEGIES = [
  { value: 'round-robin', label: 'Round Robin', description: 'Distribute requests evenly across all accounts', color: '#22D3EE' },
  { value: 'random', label: 'Random', description: 'Randomly select an account for each request', color: '#8B5CF6' },
  { value: 'least-used', label: 'Least Used', description: 'Prefer accounts with fewer recent requests', color: '#10B981' },
  { value: 'failover', label: 'Failover', description: 'Use primary account, switch on failure', color: '#F59E0B' },
];

export default function RoutingPage() {
  const queryClient = useQueryClient();
  const [newMapping, setNewMapping] = useState({ from: '', to: '' });
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: strategyData, isLoading: strategyLoading } = useQuery({
    queryKey: ['routingStrategy'],
    queryFn: async () => {
      const response = await getRoutingStrategy();
      return response.data;
    },
  });

  const { data: mappingsData, isLoading: mappingsLoading } = useQuery({
    queryKey: ['modelMappings'],
    queryFn: async () => {
      const response = await getAmpModelMappings();
      return response.data;
    },
  });

  const strategyMutation = useMutation({
    mutationFn: async (strategy: string) => {
      const response = await setRoutingStrategy(strategy);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routingStrategy'] });
    },
  });

  const mappingsMutation = useMutation({
    mutationFn: async (mappings: Record<string, string>) => {
      const response = await updateAmpModelMappings(mappings);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelMappings'] });
    },
  });

  useEffect(() => {
    if (containerRef.current && !strategyLoading) {
      const sections = containerRef.current.querySelectorAll('.routing-section');
      animatePageEnter(sections, { stagger: 0.1 });
    }
  }, [strategyLoading]);

  const currentStrategy = strategyData?.strategy || 'round-robin';
  const modelMappings = (mappingsData?.mappings || mappingsData || {}) as Record<string, string>;

  const handleAddMapping = () => {
    if (newMapping.from && newMapping.to) {
      const updatedMappings = { ...modelMappings, [newMapping.from]: newMapping.to };
      mappingsMutation.mutate(updatedMappings);
      setNewMapping({ from: '', to: '' });
    }
  };

  const handleDeleteMapping = (key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [key]: _removed, ...rest } = modelMappings;
    mappingsMutation.mutate(rest);
  };

  const isLoading = strategyLoading || mappingsLoading;

  if (isLoading) {
    return (
      <div className="relative min-h-screen">
        <AmbientBackground />
        <div className="relative z-10 flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center space-y-4">
            <div className="relative inline-flex">
              <div className="absolute inset-0 bg-cyan-400 blur-2xl opacity-30 animate-pulse" />
              <Network className="relative h-14 w-14 text-cyan-400 animate-spin" strokeWidth={1.5} style={{ animationDuration: '2s' }} />
            </div>
            <p className="text-slate-400 font-mono text-sm">Initializing load balancer...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div ref={containerRef} className="relative z-10 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white tracking-tight">
              Load Balancer
            </h1>
            <p className="text-slate-400 text-sm">
              Network routing & model distribution
            </p>
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['routingStrategy'] });
              queryClient.invalidateQueries({ queryKey: ['modelMappings'] });
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300"
          >
            <RefreshCw className="h-4 w-4 text-cyan-400" strokeWidth={2} />
            <span className="text-white text-sm font-medium">Refresh</span>
          </button>
        </div>

        {/* Routing Strategy */}
        <div className="routing-section glass-panel rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(34, 211, 238, 0.15)', boxShadow: '0 0 20px rgba(34, 211, 238, 0.2)' }}
                >
                  <Shuffle className="h-5 w-5 text-cyan-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Routing Strategy</h3>
                  <span className="text-sm text-slate-500">Select load distribution method</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ROUTING_STRATEGIES.map((strategy) => {
                const isActive = currentStrategy === strategy.value;
                return (
                  <button
                    key={strategy.value}
                    onClick={() => strategyMutation.mutate(strategy.value)}
                    disabled={strategyMutation.isPending}
                    className={`strategy-card p-5 rounded-xl text-left transition-all duration-300 relative overflow-hidden group ${
                      isActive
                        ? 'bg-white/[0.04] border-2'
                        : 'bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.03] hover:border-white/[0.1]'
                    }`}
                    style={{
                      borderColor: isActive ? `${strategy.color}40` : undefined,
                    }}
                  >
                    {isActive && (
                      <div 
                        className="absolute inset-0 opacity-10"
                        style={{ background: `radial-gradient(circle at top left, ${strategy.color}, transparent)` }}
                      />
                    )}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ 
                              background: isActive ? strategy.color : '#475569',
                              boxShadow: isActive ? `0 0 10px ${strategy.color}` : undefined,
                            }}
                          />
                          <span className="font-semibold text-white">{strategy.label}</span>
                        </div>
                        {isActive && (
                          <span 
                            className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-full font-medium"
                            style={{ 
                              background: `${strategy.color}20`,
                              color: strategy.color,
                              border: `1px solid ${strategy.color}30`,
                            }}
                          >
                            <Check className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">{strategy.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Model Mappings */}
        <div className="routing-section glass-panel rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(139, 92, 246, 0.15)', boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }}
                >
                  <ArrowRight className="h-5 w-5 text-violet-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Model Mappings</h3>
                  <span className="text-sm text-slate-500">{Object.keys(modelMappings).length} aliases configured</span>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-5">
            {/* Add new mapping */}
            <div className="p-5 bg-white/[0.02] border border-white/[0.04] rounded-xl">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-medium">Add New Mapping</p>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={newMapping.from}
                  onChange={(e) => setNewMapping({ ...newMapping, from: e.target.value })}
                  placeholder="Source model"
                  className="flex-1 px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 font-mono text-sm"
                />
                <ArrowRight className="h-5 w-5 text-cyan-400 flex-shrink-0" strokeWidth={1.5} />
                <input
                  type="text"
                  value={newMapping.to}
                  onChange={(e) => setNewMapping({ ...newMapping, to: e.target.value })}
                  placeholder="Target model"
                  className="flex-1 px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all duration-200 font-mono text-sm"
                />
                <button
                  onClick={handleAddMapping}
                  disabled={!newMapping.from || !newMapping.to || mappingsMutation.isPending}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} />
                  Add
                </button>
              </div>
            </div>

            {/* Mappings list */}
            {Object.keys(modelMappings).length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Network className="h-12 w-12 mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                <p className="text-sm">No model mappings configured</p>
                <p className="text-xs text-slate-600 mt-1">Model mappings redirect requests from one model to another</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(modelMappings).map(([from, to]) => (
                  <div
                    key={from}
                    className="flex items-center justify-between px-5 py-4 bg-white/[0.02] border border-white/[0.04] rounded-xl group hover:bg-white/[0.03] transition-all duration-200"
                  >
                    <div className="flex items-center gap-4">
                      <code 
                        className="text-sm font-mono px-3 py-1.5 rounded-lg"
                        style={{ 
                          background: 'rgba(139, 92, 246, 0.15)',
                          color: '#A78BFA',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                        }}
                      >
                        {from}
                      </code>
                      <ArrowRight className="h-4 w-4 text-cyan-400" strokeWidth={1.5} />
                      <code 
                        className="text-sm font-mono px-3 py-1.5 rounded-lg"
                        style={{ 
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34D399',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                        }}
                      >
                        {to}
                      </code>
                    </div>
                    <button
                      onClick={() => handleDeleteMapping(from)}
                      disabled={mappingsMutation.isPending}
                      className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
