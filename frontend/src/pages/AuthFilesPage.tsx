import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Trash2, FileText, RefreshCw, Download, AlertCircle, Cpu } from 'lucide-react';
import { listAuthFiles, uploadAuthFile, deleteAuthFile } from '../lib/api';
import { useRef, useState, useEffect, useCallback } from 'react';
import gsap from 'gsap';

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
    </div>
  );
}

export default function AuthFilesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

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

  // Smooth card animation with proper GPU acceleration
  const animateCards = useCallback(() => {
    if (!gridRef.current) return;
    
    const cards = gridRef.current.querySelectorAll('.file-card');
    if (cards.length === 0) return;
    
    // Set initial state
    gsap.set(cards, { 
      opacity: 0, 
      y: 12,
      willChange: 'transform, opacity'
    });
    
    // Animate with proper timing (200ms per card, 50ms stagger)
    gsap.to(cards, {
      opacity: 1,
      y: 0,
      duration: 0.2,
      stagger: 0.05,
      ease: 'power2.out',
      force3D: true,
      clearProps: 'willChange',
    });
  }, []);

  useEffect(() => {
    if (!isLoading && data) {
      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        animateCards();
      });
    }
  }, [isLoading, data, animateCards]);

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
      anthropic: '#F97316',
      claude: '#F97316',
      gemini: '#22D3EE',
      google: '#22D3EE',
      codex: '#10B981',
      openai: '#10B981',
      vertex: '#8B5CF6',
      qwen: '#EC4899',
      iflow: '#06B6D4',
    };
    return colors[provider.toLowerCase()] || '#64748B';
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
            <p className="text-slate-400 font-mono text-sm">Loading auth files...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div className="relative z-10 space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-semibold text-white tracking-tight">
              Auth Files
            </h1>
            <p className="text-slate-400 text-sm">
              Manage OAuth credential files for API providers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              disabled={isRefetching}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-panel hover:bg-white/[0.05] transition-all duration-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-cyan-400 ${isRefetching ? 'animate-spin' : ''}`} strokeWidth={2} />
              <span className="text-white text-sm font-medium">Refresh</span>
            </button>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all duration-300 cursor-pointer">
              <Upload className="h-4 w-4" strokeWidth={2} />
              <span className="text-sm font-medium">Upload File</span>
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

        {/* Upload/Error Status */}
        {uploadMutation.isPending && (
          <div className="flex items-center gap-3 p-4 glass-panel rounded-xl border-cyan-500/20">
            <div className="h-4 w-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-cyan-400 text-sm">Uploading file...</span>
          </div>
        )}
        {uploadMutation.isError && (
          <div className="flex items-center gap-3 p-4 glass-panel rounded-xl border-rose-500/20">
            <AlertCircle className="h-5 w-5 text-rose-400" strokeWidth={2} />
            <span className="text-rose-400 text-sm">Upload failed</span>
          </div>
        )}

        {/* Files Grid */}
        {files.length === 0 ? (
          <div className="glass-panel rounded-2xl p-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl glass-panel flex items-center justify-center">
              <FileText className="h-10 w-10 text-slate-500" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">
              No Auth Files
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              Upload credential files to authenticate with API providers
            </p>
            <label className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-all duration-300 cursor-pointer text-sm font-medium">
              <Upload className="h-4 w-4" strokeWidth={2} />
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
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {files.map((file) => {
              const providerColor = getProviderColor(file.provider);
              return (
                <div
                  key={file.name}
                  className="file-card glass-panel rounded-2xl p-6 card-hover relative overflow-hidden"
                >
                  {/* Subtle gradient */}
                  <div 
                    className="absolute inset-0 opacity-[0.03]"
                    style={{ background: `linear-gradient(135deg, ${providerColor}, transparent 60%)` }}
                  />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ background: `${providerColor}15`, boxShadow: `0 0 20px ${providerColor}20` }}
                        >
                          <FileText className="h-5 w-5" style={{ color: providerColor }} strokeWidth={1.5} />
                        </div>
                        <div>
                          <h4 className="font-medium text-white text-sm truncate max-w-[140px]">
                            {file.name}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <span 
                        className="px-2.5 py-1 text-xs rounded-lg border font-medium"
                        style={{ 
                          background: `${providerColor}15`,
                          color: providerColor,
                          borderColor: `${providerColor}30`
                        }}
                      >
                        {file.provider.toUpperCase()}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                      <span className="text-xs text-slate-500">
                        {new Date(file.modified).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-400 hover:text-cyan-400 transition-all duration-200"
                          title="Download"
                        >
                          <Download className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => handleDelete(file.name)}
                          disabled={deleteMutation.isPending}
                          className={`p-2 rounded-lg transition-all duration-200 ${
                            deleteConfirm === file.name
                              ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                              : 'hover:bg-white/[0.05] text-slate-400 hover:text-rose-400'
                          }`}
                          title={deleteConfirm === file.name ? 'Click to confirm' : 'Delete'}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
