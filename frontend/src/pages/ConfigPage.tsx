import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, RefreshCw, Download, Upload, Code, AlertCircle } from 'lucide-react';
import { getConfigYAML, updateConfigYAML, getConfig, setDebug, getDebug } from '../lib/api';
import { useState, useRef, useEffect } from 'react';

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [yamlContent, setYamlContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const { data: yamlData, isLoading } = useQuery({
    queryKey: ['configYaml'],
    queryFn: async () => {
      const response = await getConfigYAML();
      return response.data;
    },
  });

  const { data: configData } = useQuery({
    queryKey: ['config'],
    queryFn: async () => {
      const response = await getConfig();
      return response.data;
    },
  });

  const { data: debugData, refetch: refetchDebug } = useQuery({
    queryKey: ['debug'],
    queryFn: async () => {
      const response = await getDebug();
      return response.data;
    },
  });

  useEffect(() => {
    if (yamlData && !hasChanges) {
      setYamlContent(typeof yamlData === 'string' ? yamlData : JSON.stringify(yamlData, null, 2));
    }
  }, [yamlData, hasChanges]);

  const saveMutation = useMutation({
    mutationFn: async (yaml: string) => {
      const response = await updateConfigYAML(yaml);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      queryClient.invalidateQueries({ queryKey: ['configYaml'] });
      setHasChanges(false);
    },
  });

  const debugMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await setDebug(enabled);
      return response.data;
    },
    onSuccess: () => {
      refetchDebug();
    },
  });

  const handleYamlChange = (value: string) => {
    setYamlContent(value);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(yamlContent);
  };

  const handleDownload = () => {
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.yaml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setYamlContent(content);
        setHasChanges(true);
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  const isDebugEnabled = debugData?.debug ?? configData?.debug ?? false;

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
          <h2 className="text-2xl font-bold text-white">Configuration</h2>
          <p className="text-gray-400 mt-1">Edit server configuration file</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            Upload
            <input
              type="file"
              accept=".yaml,.yml"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Quick Settings */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-400" />
          Quick Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Debug Mode Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
            <div>
              <p className="font-medium text-white">Debug Mode</p>
              <p className="text-sm text-gray-400">Enable verbose logging</p>
            </div>
            <button
              onClick={() => debugMutation.mutate(!isDebugEnabled)}
              disabled={debugMutation.isPending}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isDebugEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  isDebugEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* Server Info */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="font-medium text-white">Server Address</p>
            <p className="text-sm text-gray-400 mt-1">
              {configData?.host || '0.0.0.0'}:{configData?.port || 8080}
            </p>
          </div>

          {/* Retry Config */}
          <div className="p-4 bg-gray-800/50 rounded-lg">
            <p className="font-medium text-white">Request Retry</p>
            <p className="text-sm text-gray-400 mt-1">
              {configData?.request_retry || 0} retries, max {configData?.max_retry_interval || 0}s interval
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {saveMutation.isError && (
        <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to save configuration. Please check YAML syntax.</span>
        </div>
      )}

      {/* YAML Editor */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Code className="h-5 w-5 text-yellow-400" />
            <h3 className="text-lg font-semibold text-white">config.yaml</h3>
            {hasChanges && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">
                Modified
              </span>
            )}
          </div>
        </div>
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={yamlContent}
            onChange={(e) => handleYamlChange(e.target.value)}
            className="w-full h-[500px] px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg text-gray-300 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
