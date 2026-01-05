import { useMutation } from '@tanstack/react-query';
import { 
  ExternalLink, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Globe,
} from 'lucide-react';
import { 
  requestAnthropicAuth, 
  requestCodexAuth, 
  requestGeminiCLIAuth,
  requestAntigravityAuth,
  requestQwenAuth,
  requestIFlowAuth,
} from '../lib/api';
import { useState } from 'react';

interface OAuthProviderCardProps {
  title: string;
  description: string;
  color: string;
  icon: string;
  onLogin: () => Promise<{ url?: string; error?: string }>;
}

function OAuthProviderCard({ title, description, color, icon, onLogin }: OAuthProviderCardProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = await onLogin();
      if (result.url) {
        setAuthUrl(result.url);
        setStatus('success');
        // Open the auth URL in a new window
        window.open(result.url, '_blank', 'width=600,height=700');
      } else if (result.error) {
        setError(result.error);
        setStatus('error');
      }
    } catch (err) {
      setError('Failed to initiate OAuth flow');
      setStatus('error');
    }
  };

  const colorClasses: Record<string, { gradient: string; border: string }> = {
    orange: { gradient: 'from-orange-500 to-orange-600', border: 'border-orange-500/20' },
    green: { gradient: 'from-green-500 to-green-600', border: 'border-green-500/20' },
    blue: { gradient: 'from-blue-500 to-blue-600', border: 'border-blue-500/20' },
    purple: { gradient: 'from-purple-500 to-purple-600', border: 'border-purple-500/20' },
    cyan: { gradient: 'from-cyan-500 to-cyan-600', border: 'border-cyan-500/20' },
    pink: { gradient: 'from-pink-500 to-pink-600', border: 'border-pink-500/20' },
  };

  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg bg-gradient-to-br ${colors.gradient}`}>
            <span className="text-2xl">{icon}</span>
          </div>
          {status === 'success' && <CheckCircle className="h-5 w-5 text-green-400" />}
          {status === 'error' && <AlertCircle className="h-5 w-5 text-red-400" />}
        </div>
        
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-4">{description}</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}
        
        {status === 'success' && authUrl && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-400 mb-2">Auth URL generated!</p>
            <a 
              href={authUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              Open auth page <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={status === 'loading'}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white font-medium transition-colors bg-gradient-to-r ${colors.gradient} hover:opacity-90 disabled:opacity-50`}
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Globe className="h-4 w-4" />
              Login with {title.split(' ')[0]}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function OAuthPage() {
  const anthropicMutation = useMutation({
    mutationFn: async () => {
      const response = await requestAnthropicAuth();
      return response.data;
    },
  });

  const codexMutation = useMutation({
    mutationFn: async () => {
      const response = await requestCodexAuth();
      return response.data;
    },
  });

  const geminiMutation = useMutation({
    mutationFn: async () => {
      const response = await requestGeminiCLIAuth();
      return response.data;
    },
  });

  const antigravityMutation = useMutation({
    mutationFn: async () => {
      const response = await requestAntigravityAuth();
      return response.data;
    },
  });

  const qwenMutation = useMutation({
    mutationFn: async () => {
      const response = await requestQwenAuth();
      return response.data;
    },
  });

  const iflowMutation = useMutation({
    mutationFn: async () => {
      const response = await requestIFlowAuth();
      return response.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">OAuth Login</h2>
        <p className="text-gray-400 mt-1">Login to AI providers using OAuth for subscription-based access</p>
      </div>

      {/* Info box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex gap-3">
          <Globe className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-400 mb-1">How OAuth Login Works</h4>
            <p className="text-sm text-gray-400">
              Click a provider to start the OAuth flow. A new window will open where you can sign in with your account. 
              After successful authentication, the credential file will be saved automatically.
            </p>
          </div>
        </div>
      </div>

      {/* OAuth Provider Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <OAuthProviderCard
          title="Anthropic Claude"
          description="Login with your Claude subscription to access Claude Code models"
          color="orange"
          icon="🤖"
          onLogin={() => anthropicMutation.mutateAsync()}
        />

        <OAuthProviderCard
          title="OpenAI Codex"
          description="Login with your ChatGPT subscription to access GPT models"
          color="green"
          icon="🧠"
          onLogin={() => codexMutation.mutateAsync()}
        />

        <OAuthProviderCard
          title="Gemini CLI"
          description="Login with your Google account to access Gemini models"
          color="blue"
          icon="✨"
          onLogin={() => geminiMutation.mutateAsync()}
        />

        <OAuthProviderCard
          title="Antigravity"
          description="Login with Antigravity for alternative AI access"
          color="purple"
          icon="🚀"
          onLogin={() => antigravityMutation.mutateAsync()}
        />

        <OAuthProviderCard
          title="Qwen Code"
          description="Login with Alibaba Cloud to access Qwen models"
          color="cyan"
          icon="💫"
          onLogin={() => qwenMutation.mutateAsync()}
        />

        <OAuthProviderCard
          title="iFlow"
          description="Login with iFlow for AI coding assistance"
          color="pink"
          icon="🌊"
          onLogin={() => iflowMutation.mutateAsync()}
        />
      </div>
    </div>
  );
}
