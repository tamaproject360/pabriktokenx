import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, Download, Upload, RefreshCw, Trash2 } from 'lucide-react';
import { getUsage, exportUsage, importUsage } from '../lib/api';
import { useRef } from 'react';

export default function UsagePage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const usage = data?.usage;
  const models = usage?.models || {};
  const modelEntries = Object.entries(models).sort((a, b) => b[1].requests - a[1].requests);

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
          <h2 className="text-2xl font-bold text-white">Usage Statistics</h2>
          <p className="text-gray-400 mt-1">Track API usage and token consumption</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            Import
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span className="text-gray-400 text-sm">Total Requests</span>
          </div>
          <p className="text-2xl font-bold text-white">{(usage?.total_requests || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-5 w-5 text-green-400" />
            <span className="text-gray-400 text-sm">Input Tokens</span>
          </div>
          <p className="text-2xl font-bold text-white">{(usage?.total_input_tokens || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-5 w-5 text-purple-400" />
            <span className="text-gray-400 text-sm">Output Tokens</span>
          </div>
          <p className="text-2xl font-bold text-white">{(usage?.total_output_tokens || 0).toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Trash2 className="h-5 w-5 text-red-400" />
            <span className="text-gray-400 text-sm">Failed Requests</span>
          </div>
          <p className="text-2xl font-bold text-white">{(data?.failed_requests || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Model Usage Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-white">Usage by Model</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50">
                <th className="text-left py-3 px-6 text-sm font-medium text-gray-400">Model</th>
                <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">Requests</th>
                <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">Input Tokens</th>
                <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">Output Tokens</th>
                <th className="text-right py-3 px-6 text-sm font-medium text-gray-400">Total Tokens</th>
              </tr>
            </thead>
            <tbody>
              {modelEntries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-500">
                    No usage data available
                  </td>
                </tr>
              ) : (
                modelEntries.map(([model, stats]) => (
                  <tr key={model} className="border-t border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-4 px-6">
                      <span className="font-medium text-white">{model}</span>
                    </td>
                    <td className="text-right py-4 px-6 text-gray-300">
                      {stats.requests.toLocaleString()}
                    </td>
                    <td className="text-right py-4 px-6 text-gray-300">
                      {stats.input_tokens.toLocaleString()}
                    </td>
                    <td className="text-right py-4 px-6 text-gray-300">
                      {stats.output_tokens.toLocaleString()}
                    </td>
                    <td className="text-right py-4 px-6 text-gray-300">
                      {(stats.input_tokens + stats.output_tokens).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
