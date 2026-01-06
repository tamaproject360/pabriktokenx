import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, Trash2, Download, AlertCircle, ChevronDown, ChevronUp, Terminal, Cpu } from 'lucide-react';
import { getLogs, deleteLogs, getRequestErrorLogs } from '../lib/api';
import { useState, useEffect, useRef } from 'react';
import { animatePageEnter } from '../lib/animations';

// Ambient Background - darker for terminal feel
function AmbientBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <div 
        className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.1), transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
    </div>
  );
}

export default function LogsPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: logsData, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['logs'],
    queryFn: async () => {
      const response = await getLogs();
      return response.data;
    },
  });

  const { data: errorLogsData } = useQuery({
    queryKey: ['errorLogs'],
    queryFn: async () => {
      const response = await getRequestErrorLogs();
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await deleteLogs();
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      setDeleteConfirm(false);
    },
  });

  useEffect(() => {
    if (containerRef.current && !isLoading) {
      const sections = containerRef.current.querySelectorAll('.log-section');
      animatePageEnter(sections, { stagger: 0.1 });
    }
  }, [isLoading]);

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate();
    } else {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
    }
  };

  const logs = logsData?.logs || '';
  const errorFiles = errorLogsData?.files || [];
  const logLines = logs.split('\n').filter(Boolean);

  const getLogLevelColor = (line: string) => {
    if (line.includes('level=error') || line.includes('[ERROR]')) return 'text-rose-400';
    if (line.includes('level=warn') || line.includes('[WARN]')) return 'text-amber-400';
    if (line.includes('level=info') || line.includes('[INFO]')) return 'text-cyan-400';
    if (line.includes('level=debug') || line.includes('[DEBUG]')) return 'text-slate-500';
    return 'text-emerald-400';
  };

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
            <p className="text-slate-400 font-mono text-sm">Loading logs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div ref={containerRef} className="relative z-10 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white tracking-tight">
              Logs
            </h1>
            <p className="text-slate-400 text-sm">
              View server logs and error reports
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-200 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-cyan-400 ${isRefetching ? 'animate-spin' : ''}`} strokeWidth={2} />
              <span className="text-white text-sm font-medium">Refresh</span>
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 ${
                deleteConfirm
                  ? 'bg-rose-500/20 border border-rose-500/30 text-rose-400'
                  : 'glass-panel hover:bg-white/[0.05] text-slate-300 hover:text-white'
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {deleteConfirm ? 'Confirm Delete' : 'Clear Logs'}
            </button>
          </div>
        </div>

        {/* Error Log Files */}
        {errorFiles.length > 0 && (
          <div className="log-section glass-panel rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]" style={{ background: 'rgba(244, 63, 94, 0.05)' }}>
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(244, 63, 94, 0.15)', boxShadow: '0 0 20px rgba(244, 63, 94, 0.2)' }}
                >
                  <AlertCircle className="h-5 w-5 text-rose-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Error Log Files</h3>
                  <span className="text-sm text-slate-500">{errorFiles.length} files</span>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {errorFiles.map((file) => (
                  <div
                    key={file}
                    className="flex items-center justify-between px-4 py-3 bg-white/[0.02] border border-white/[0.04] rounded-xl hover:bg-white/[0.03] transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-rose-400" />
                      <span className="text-sm text-slate-300 truncate font-mono">{file}</span>
                    </div>
                    <button className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/[0.05] text-slate-400 hover:text-white transition-all duration-200">
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Main Log Viewer */}
        <div className="log-section glass-panel rounded-2xl overflow-hidden">
          <div 
            className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(34, 211, 238, 0.15)', boxShadow: '0 0 20px rgba(34, 211, 238, 0.2)' }}
              >
                <Terminal className="h-5 w-5 text-cyan-400" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Server Logs</h3>
                <span className="text-sm text-slate-500">{logLines.length} lines</span>
              </div>
            </div>
            <div className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors">
              {expanded ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </div>
          </div>
          
          {expanded && (
            <div 
              className="p-5 max-h-[600px] overflow-auto"
              style={{ background: '#020202' }}
            >
              {logLines.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-mono">
                  // No logs available
                </div>
              ) : (
                <div className="font-mono text-sm space-y-0.5">
                  {logLines.map((line, index) => (
                    <div 
                      key={index} 
                      className={`${getLogLevelColor(line)} hover:bg-white/[0.03] px-3 py-1 rounded transition-colors`}
                    >
                      <span className="text-slate-600 select-none mr-4">{String(index + 1).padStart(4, '0')}</span>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
