import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, RefreshCw, Trash2, Download, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { getLogs, deleteLogs, getRequestErrorLogs } from '../lib/api';
import { useState } from 'react';

export default function LogsPage() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
    if (line.includes('level=error') || line.includes('[ERROR]')) return 'text-red-400';
    if (line.includes('level=warn') || line.includes('[WARN]')) return 'text-yellow-400';
    if (line.includes('level=info') || line.includes('[INFO]')) return 'text-blue-400';
    if (line.includes('level=debug') || line.includes('[DEBUG]')) return 'text-gray-500';
    return 'text-gray-300';
  };

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
          <h2 className="text-2xl font-bold text-white">Logs</h2>
          <p className="text-gray-400 mt-1">View server logs and error reports</p>
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
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              deleteConfirm
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <Trash2 className="h-4 w-4" />
            {deleteConfirm ? 'Confirm Delete' : 'Clear Logs'}
          </button>
        </div>
      </div>

      {/* Error Log Files */}
      {errorFiles.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 bg-red-500/5">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <h3 className="text-lg font-semibold text-white">Error Log Files</h3>
              <span className="text-sm text-gray-400">({errorFiles.length} files)</span>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {errorFiles.map((file) => (
                <div
                  key={file}
                  className="flex items-center justify-between px-4 py-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-red-400" />
                    <span className="text-sm text-gray-300 truncate">{file}</span>
                  </div>
                  <button className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Log Viewer */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div 
          className="px-6 py-4 border-b border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-white">Server Logs</h3>
            <span className="text-sm text-gray-400">({logLines.length} lines)</span>
          </div>
          {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
        </div>
        
        {expanded && (
          <div className="p-4 max-h-[600px] overflow-auto">
            {logLines.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No logs available
              </div>
            ) : (
              <pre className="font-mono text-sm space-y-1">
                {logLines.map((line, index) => (
                  <div key={index} className={`${getLogLevelColor(line)} hover:bg-gray-800/50 px-2 py-0.5 rounded`}>
                    {line}
                  </div>
                ))}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
