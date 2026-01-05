import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Server,
  Users,
  Clock,
} from 'lucide-react';
import { getUsage, getConfig, listAuthFiles } from '../lib/api';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  trendValue?: string;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

function StatCard({ title, value, icon: Icon, trend, trendValue, color }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
              {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

interface ModelUsageProps {
  models: Record<string, { requests: number; input_tokens: number; output_tokens: number }>;
}

function ModelUsageTable({ models }: ModelUsageProps) {
  const entries = Object.entries(models || {}).sort((a, b) => b[1].requests - a[1].requests);

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No model usage data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Model</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Requests</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Input Tokens</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Output Tokens</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 10).map(([model, stats]) => (
            <tr key={model} className="border-b border-gray-800/50 hover:bg-gray-800/30">
              <td className="py-3 px-4">
                <span className="text-sm font-medium text-white">{model}</span>
              </td>
              <td className="text-right py-3 px-4 text-sm text-gray-300">
                {stats.requests.toLocaleString()}
              </td>
              <td className="text-right py-3 px-4 text-sm text-gray-300">
                {stats.input_tokens.toLocaleString()}
              </td>
              <td className="text-right py-3 px-4 text-sm text-gray-300">
                {stats.output_tokens.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DashboardPage() {
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['usage'],
    queryFn: async () => {
      const response = await getUsage();
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
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

  const isLoading = usageLoading || configLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const usage = usageData?.usage;
  const totalRequests = usage?.total_requests || 0;
  const totalInputTokens = usage?.total_input_tokens || 0;
  const totalOutputTokens = usage?.total_output_tokens || 0;
  const failedRequests = usageData?.failed_requests || 0;
  const authFilesCount = authFilesData?.files?.length || 0;
  const serverPort = configData?.port || 8080;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard</h2>
        <p className="text-gray-400 mt-1">Overview of your CLI Proxy API server</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Requests"
          value={totalRequests.toLocaleString()}
          icon={Activity}
          color="blue"
        />
        <StatCard
          title="Input Tokens"
          value={totalInputTokens.toLocaleString()}
          icon={Zap}
          color="green"
        />
        <StatCard
          title="Output Tokens"
          value={totalOutputTokens.toLocaleString()}
          icon={Zap}
          color="purple"
        />
        <StatCard
          title="Failed Requests"
          value={failedRequests.toLocaleString()}
          icon={AlertTriangle}
          color={failedRequests > 0 ? 'red' : 'green'}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Auth Files"
          value={authFilesCount}
          icon={Users}
          color="orange"
        />
        <StatCard
          title="Server Port"
          value={serverPort}
          icon={Server}
          color="blue"
        />
        <StatCard
          title="Models Used"
          value={Object.keys(usage?.models || {}).length}
          icon={Clock}
          color="purple"
        />
      </div>

      {/* Model Usage Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Model Usage</h3>
        <ModelUsageTable models={usage?.models || {}} />
      </div>
    </div>
  );
}
