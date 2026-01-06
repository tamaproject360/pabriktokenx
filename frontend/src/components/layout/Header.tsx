import { RefreshCw, Bell, ExternalLink, Zap, Command } from 'lucide-react';
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
      className="fixed top-0 right-0 h-20 z-30 backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
      style={{
        left: collapsed ? '80px' : '260px',
        background: 'rgba(9, 9, 11, 0.85)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="flex items-center justify-between h-full px-8">
        {/* Search / Command */}
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all duration-200 group">
            <Command className="h-4 w-4 text-slate-500 group-hover:text-cyan-400 transition-colors" strokeWidth={1.5} />
            <span className="text-sm text-slate-500 group-hover:text-slate-400 transition-colors">Quick actions...</span>
            <kbd className="ml-4 px-2 py-0.5 text-xs rounded bg-white/[0.05] text-slate-500 font-mono">⌘K</kbd>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="relative p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-cyan-400 hover:bg-white/[0.05] transition-all duration-200 disabled:opacity-50 group"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 transition-transform ${isRefetching ? 'animate-spin' : 'group-hover:rotate-180 duration-500'}`} strokeWidth={2} />
          </button>

          {/* Notifications */}
          <button className="relative p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:text-cyan-400 hover:bg-white/[0.05] transition-all duration-200 group">
            <Bell className="h-4 w-4" strokeWidth={2} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
          </button>

          {/* System Status */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-400 blur-md opacity-50 animate-pulse" />
              <Zap className="relative h-4 w-4 text-emerald-400" strokeWidth={2} />
            </div>
            <span className="text-xs text-slate-400 font-medium">Online</span>
          </div>

          {/* Version badge */}
          {versionData && (
            <a
              href="https://github.com/tamaproject360/pabriktokenx/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-slate-400 hover:text-white hover:bg-white/[0.05] hover:border-cyan-500/30 transition-all duration-200 group"
            >
              <span className="font-mono text-xs">v{versionData.version || '2.0.0'}</span>
              <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" strokeWidth={2} />
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
