import { RefreshCw, Bell, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getLatestVersion } from '../../lib/api';

interface HeaderProps {
  collapsed: boolean;
}

export default function Header({ collapsed }: HeaderProps) {
  const { data: versionData, refetch, isRefetching } = useQuery({
    queryKey: ['version'],
    queryFn: async () => {
      const response = await getLatestVersion();
      return response.data;
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  return (
    <header
      className={`fixed top-0 right-0 h-16 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 z-30 transition-all duration-300 ${
        collapsed ? 'left-16' : 'left-64'
      }`}
    >
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold text-white">Management Dashboard</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Refresh button */}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Check for updates"
          >
            <RefreshCw className={`h-5 w-5 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>

          {/* Notifications placeholder */}
          <button className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors relative">
            <Bell className="h-5 w-5" />
          </button>

          {/* Version info */}
          {versionData && (
            <a
              href="https://github.com/router-for-me/CLIProxyAPI/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <span>v{versionData.version || 'unknown'}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
