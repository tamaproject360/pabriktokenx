import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, FileText, RefreshCw, Download, AlertCircle } from 'lucide-react';
import { listAuthFiles, uploadAuthFile, deleteAuthFile } from '../lib/api';
import { useRef, useState } from 'react';

export default function AuthFilesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['authFiles'],
    queryFn: async () => {
      const response = await listAuthFiles();
      return response.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const response = await uploadAuthFile(file);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authFiles'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (filename: string) => {
      const response = await deleteAuthFile(filename);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authFiles'] });
      setDeleteConfirm(null);
    },
  });

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (filename: string) => {
    if (deleteConfirm === filename) {
      deleteMutation.mutate(filename);
    } else {
      setDeleteConfirm(filename);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  };

  const files = data?.files || [];

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      anthropic: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      claude: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      gemini: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      google: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      codex: 'bg-green-500/10 text-green-400 border-green-500/20',
      openai: 'bg-green-500/10 text-green-400 border-green-500/20',
      vertex: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
      qwen: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
      iflow: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    };
    return colors[provider.toLowerCase()] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
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
          <h2 className="text-2xl font-bold text-white">Auth Files</h2>
          <p className="text-gray-400 mt-1">Manage OAuth credential files for different providers</p>
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
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            Upload File
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Upload status */}
      {uploadMutation.isPending && (
        <div className="flex items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Uploading file...
        </div>
      )}
      {uploadMutation.isError && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <AlertCircle className="h-4 w-4" />
          Failed to upload file
        </div>
      )}

      {/* Files Grid */}
      {files.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No auth files</h3>
          <p className="text-gray-400 mb-4">Upload credential files to enable OAuth authentication</p>
          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            Upload File
            <input
              type="file"
              accept=".json"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.map((file) => (
            <div
              key={file.name}
              className="bg-gray-900 rounded-xl border border-gray-800 p-4 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-800 rounded-lg">
                    <FileText className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white text-sm truncate max-w-[180px]">
                      {file.name}
                    </h4>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs rounded-full border ${getProviderColor(file.provider)}`}>
                  {file.provider}
                </span>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                <span className="text-xs text-gray-500">
                  {new Date(file.modified).toLocaleDateString()}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(file.name)}
                    disabled={deleteMutation.isPending}
                    className={`p-1.5 rounded-lg transition-colors ${
                      deleteConfirm === file.name
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'hover:bg-gray-800 text-gray-400 hover:text-red-400'
                    }`}
                    title={deleteConfirm === file.name ? 'Click again to confirm' : 'Delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
