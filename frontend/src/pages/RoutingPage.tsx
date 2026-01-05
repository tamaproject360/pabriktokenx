import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Shuffle, ArrowRight, Plus, Trash2 } from 'lucide-react';
import { 
  getRoutingStrategy, 
  setRoutingStrategy,
  getAmpModelMappings,
  updateAmpModelMappings,
} from '../lib/api';
import { useState } from 'react';

const ROUTING_STRATEGIES = [
  { value: 'round-robin', label: 'Round Robin', description: 'Distribute requests evenly across all accounts' },
  { value: 'random', label: 'Random', description: 'Randomly select an account for each request' },
  { value: 'least-used', label: 'Least Used', description: 'Prefer accounts with fewer recent requests' },
  { value: 'failover', label: 'Failover', description: 'Use primary account, switch on failure' },
];

export default function RoutingPage() {
  const queryClient = useQueryClient();
  const [newMapping, setNewMapping] = useState({ from: '', to: '' });

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
    const { [key]: _, ...rest } = modelMappings;
    mappingsMutation.mutate(rest);
  };

  const isLoading = strategyLoading || mappingsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Routing & Model Mapping</h2>
          <p className="text-gray-400 mt-1">Configure load balancing and model aliases</p>
        </div>
        <button
          onClick={() => {
            queryClient.invalidateQueries({ queryKey: ['routingStrategy'] });
            queryClient.invalidateQueries({ queryKey: ['modelMappings'] });
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Routing Strategy */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <Shuffle className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Routing Strategy</h3>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROUTING_STRATEGIES.map((strategy) => (
              <button
                key={strategy.value}
                onClick={() => strategyMutation.mutate(strategy.value)}
                disabled={strategyMutation.isPending}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  currentStrategy === strategy.value
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{strategy.label}</span>
                  {currentStrategy === strategy.value && (
                    <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{strategy.description}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Model Mappings */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <ArrowRight className="h-5 w-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Model Mappings</h3>
            <span className="text-sm text-gray-400">({Object.keys(modelMappings).length} mappings)</span>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {/* Add new mapping */}
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={newMapping.from}
              onChange={(e) => setNewMapping({ ...newMapping, from: e.target.value })}
              placeholder="Source model (e.g., claude-opus-4.5)"
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <ArrowRight className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <input
              type="text"
              value={newMapping.to}
              onChange={(e) => setNewMapping({ ...newMapping, to: e.target.value })}
              placeholder="Target model (e.g., claude-sonnet-4)"
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleAddMapping}
              disabled={!newMapping.from || !newMapping.to || mappingsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </div>

          {/* Mappings list */}
          {Object.keys(modelMappings).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No model mappings configured. Model mappings allow you to redirect requests from one model to another.
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(modelMappings).map(([from, to]) => (
                <div
                  key={from}
                  className="flex items-center justify-between px-4 py-3 bg-gray-800/50 rounded-lg group"
                >
                  <div className="flex items-center gap-4">
                    <code className="text-sm text-purple-400 font-mono bg-purple-500/10 px-2 py-1 rounded">
                      {from}
                    </code>
                    <ArrowRight className="h-4 w-4 text-gray-500" />
                    <code className="text-sm text-green-400 font-mono bg-green-500/10 px-2 py-1 rounded">
                      {to}
                    </code>
                  </div>
                  <button
                    onClick={() => handleDeleteMapping(from)}
                    disabled={mappingsMutation.isPending}
                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
