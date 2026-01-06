import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/v0/management',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth key management
let authKey = localStorage.getItem('management_key') || '';

export const setAuthKey = (key: string) => {
  authKey = key;
  localStorage.setItem('management_key', key);
};

export const getAuthKey = () => authKey;

export const clearAuthKey = () => {
  authKey = '';
  localStorage.removeItem('management_key');
};

// Add auth header to all requests
api.interceptors.request.use((config) => {
  if (authKey) {
    config.headers['Authorization'] = `Bearer ${authKey}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Handle unauthorized
      console.error('Unauthorized access');
    }
    return Promise.reject(error);
  }
);

// API Types
export interface UsageStatistics {
  usage: {
    total_requests: number;
    total_input_tokens: number;
    total_output_tokens: number;
    models: Record<string, {
      requests: number;
      input_tokens: number;
      output_tokens: number;
    }>;
  };
  failed_requests: number;
}

export interface AuthFile {
  name: string;
  provider: string;
  type: string;
  size: number;
  modified: string;
}

export interface Config {
  host: string;
  port: number;
  debug: boolean;
  proxy_url?: string;
  request_retry: number;
  max_retry_interval: number;
  gemini_api_keys?: string[];
  claude_api_keys?: string[];
  codex_api_keys?: string[];
  [key: string]: unknown;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  model?: string;
  provider?: string;
}

export interface OAuthSession {
  provider: string;
  status: string;
  url?: string;
}

// API Functions

// Usage
export const getUsage = () => api.get<UsageStatistics>('/usage');
export const exportUsage = () => api.get('/usage/export');
export const importUsage = (data: unknown) => api.post('/usage/import', data);

// Config
export const getConfig = () => api.get<Config>('/config');
export const getConfigYAML = () => api.get<string>('/config.yaml');
export const updateConfigYAML = (yaml: string) => 
  api.put('/config.yaml', yaml, { headers: { 'Content-Type': 'text/yaml' } });

// Debug mode
export const getDebug = () => api.get<{ debug: boolean }>('/debug');
export const setDebug = (enabled: boolean) => api.put('/debug', { value: enabled });

// Logging
export const getLoggingToFile = () => api.get<{ 'logging-to-file': boolean }>('/logging-to-file');
export const setLoggingToFile = (enabled: boolean) => api.put('/logging-to-file', { value: enabled });

// Logs
export const getLogs = () => api.get<{ logs: string }>('/logs');
export const deleteLogs = () => api.delete('/logs');
export const getRequestErrorLogs = () => api.get<{ files: string[] }>('/request-error-logs');
export const getRequestLog = () => api.get('/request-log');
export const setRequestLog = (config: { enabled: boolean; max_size_mb?: number }) => 
  api.put('/request-log', config);

// Auth files
export const listAuthFiles = () => api.get<{ files: AuthFile[] }>('/auth-files');
export const getAuthFileModels = () => api.get('/auth-files/models');
export const uploadAuthFile = (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/auth-files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const deleteAuthFile = (filename: string) => 
  api.delete('/auth-files', { params: { filename } });

// API Keys
interface APIKeyEntry {
  key: string;
  'project-name'?: string;
}

export const getAPIKeys = () => api.get('/api-keys');
export const updateAPIKeys = (keys: APIKeyEntry[]) => api.put('/api-keys', keys);

export const getGeminiKeys = () => api.get('/gemini-api-key');
export const updateGeminiKeys = (keys: string[]) => api.put('/gemini-api-key', { keys });
export const deleteGeminiKey = (index: number) => api.delete('/gemini-api-key', { data: { index } });

export const getClaudeKeys = () => api.get('/claude-api-key');
export const updateClaudeKeys = (keys: string[]) => api.put('/claude-api-key', { keys });
export const deleteClaudeKey = (index: number) => api.delete('/claude-api-key', { data: { index } });

export const getCodexKeys = () => api.get('/codex-api-key');
export const updateCodexKeys = (keys: string[]) => api.put('/codex-api-key', { keys });
export const deleteCodexKey = (index: number) => api.delete('/codex-api-key', { data: { index } });

// Proxy URL
export const getProxyURL = () => api.get<{ 'proxy-url': string }>('/proxy-url');
export const setProxyURL = (url: string) => api.put('/proxy-url', { value: url });
export const deleteProxyURL = () => api.delete('/proxy-url');

// Request retry
export const getRequestRetry = () => api.get<{ 'request-retry': number }>('/request-retry');
export const setRequestRetry = (count: number) => api.put('/request-retry', { value: count });

export const getMaxRetryInterval = () => api.get<{ 'max-retry-interval': number }>('/max-retry-interval');
export const setMaxRetryInterval = (seconds: number) => api.put('/max-retry-interval', { value: seconds });

// Routing
export const getRoutingStrategy = () => api.get<{ strategy: string }>('/routing/strategy');
export const setRoutingStrategy = (strategy: string) => api.put('/routing/strategy', { value: strategy });

// OAuth
export const requestAnthropicAuth = () => api.get<OAuthSession>('/anthropic-auth-url?is_webui=true');
export const requestCodexAuth = () => api.get<OAuthSession>('/codex-auth-url?is_webui=true');
export const requestGeminiCLIAuth = () => api.get<OAuthSession>('/gemini-cli-auth-url?is_webui=true');
export const requestAntigravityAuth = () => api.get<OAuthSession>('/antigravity-auth-url?is_webui=true');
export const requestQwenAuth = () => api.get<OAuthSession>('/qwen-auth-url?is_webui=true');
export const requestIFlowAuth = () => api.get<OAuthSession>('/iflow-auth-url?is_webui=true');
export const getAuthStatus = () => api.get('/get-auth-status');

// Amp Code
export const getAmpCode = () => api.get('/ampcode');
export const getAmpModelMappings = () => api.get('/ampcode/model-mappings');
export const updateAmpModelMappings = (mappings: Record<string, string>) => 
  api.put('/ampcode/model-mappings', mappings);

// OpenAI Compatibility
export const getOpenAICompat = () => api.get('/openai-compatibility');
export const updateOpenAICompat = (config: unknown) => api.put('/openai-compatibility', config);

// Vertex
export const getVertexKeys = () => api.get('/vertex-api-key');
export const importVertexCredential = (credential: unknown) => 
  api.post('/vertex/import', credential);

// WebSocket Auth
export const getWebsocketAuth = () => api.get<{ 'ws-auth': boolean }>('/ws-auth');
export const setWebsocketAuth = (enabled: boolean) => api.put('/ws-auth', { value: enabled });

// Latest version check
export const getLatestVersion = () => api.get('/latest-version');

export default api;
