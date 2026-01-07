import { 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Globe,
  ArrowUpRight,
} from 'lucide-react';
import { 
  requestAnthropicAuth, 
  requestCodexAuth, 
  requestGeminiCLIAuth,
  requestAntigravityAuth,
  requestQwenAuth,
  requestIFlowAuth,
} from '../lib/api';
import { useState, useEffect, useRef, useCallback } from 'react';
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
      <div 
        className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px]"
        style={{
          background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.1), transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  );
}

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
        window.open(result.url, '_blank', 'width=600,height=700');
      } else if (result.error) {
        setError(result.error);
        setStatus('error');
      }
    } catch {
      setError('Failed to initiate OAuth flow');
      setStatus('error');
    }
  };

  return (
    <div className="oauth-card glass-panel rounded-2xl overflow-hidden card-hover">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
            style={{ background: `${color}15`, boxShadow: `0 0 30px ${color}20` }}
          >
            {icon}
          </div>
          <div className="flex items-center gap-2">
            {status === 'success' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <CheckCircle className="h-3 w-3" />
                Ready
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-medium">
                <AlertCircle className="h-3 w-3" />
                Error
              </span>
            )}
          </div>
        </div>
        
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-5 leading-relaxed">{description}</p>
        
        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-sm text-rose-400">
            {error}
          </div>
        )}
        
        {status === 'success' && authUrl && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-sm text-emerald-400 mb-2">Auth URL generated!</p>
            <a 
              href={authUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
            >
              Open auth page <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={status === 'loading'}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50"
          style={{ 
            background: `${color}20`, 
            border: `1px solid ${color}30`,
            color: color,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${color}30`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `${color}20`;
          }}
        >
          {status === 'loading' ? (
            <>
              <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <ArrowUpRight className="h-4 w-4" />
              Login with {title.split(' ')[0]}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function OAuthPage() {
  const cardsRef = useRef<HTMLDivElement>(null);

  // Smooth card animation like AuthFilesPage
  const animateCards = useCallback(() => {
    if (!cardsRef.current) return;
    
    const cards = cardsRef.current.querySelectorAll('.oauth-card');
    if (cards.length === 0) return;
    
    gsap.set(cards, { 
      opacity: 0, 
      y: 12,
      willChange: 'transform, opacity'
    });
    
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
    requestAnimationFrame(() => {
      animateCards();
    });
  }, [animateCards]);

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />
      
      <div className="relative z-10 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-semibold text-white tracking-tight">
            OAuth Login
          </h1>
          <p className="text-slate-400 text-sm">
            Login to AI providers using OAuth for subscription-based access
          </p>
        </div>

        {/* Info box */}
        <div className="glass-panel rounded-2xl p-5">
          <div className="flex gap-4">
            <div 
              className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(34, 211, 238, 0.15)', boxShadow: '0 0 20px rgba(34, 211, 238, 0.2)' }}
            >
              <Globe className="h-5 w-5 text-cyan-400" strokeWidth={1.5} />
            </div>
            <div>
              <h4 className="font-medium text-white mb-1">How OAuth Login Works</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Click a provider to start the OAuth flow. A new window will open where you can sign in with your account. 
                After successful authentication, the credential file will be saved automatically.
              </p>
            </div>
          </div>
        </div>

        {/* OAuth Provider Grid */}
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <OAuthProviderCard
            title="Anthropic Claude"
            description="Login with your Claude subscription to access Claude Code models"
            color="#F97316"
            icon="🤖"
            onLogin={async () => {
              const response = await requestAnthropicAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="OpenAI Codex"
            description="Login with your ChatGPT subscription to access GPT models"
            color="#10B981"
            icon="🧠"
            onLogin={async () => {
              const response = await requestCodexAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="Gemini CLI"
            description="Login with your Google account to access Gemini models"
            color="#22D3EE"
            icon="✨"
            onLogin={async () => {
              const response = await requestGeminiCLIAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="Antigravity"
            description="Login with Antigravity for alternative AI access"
            color="#8B5CF6"
            icon="🚀"
            onLogin={async () => {
              const response = await requestAntigravityAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="Qwen Code"
            description="Login with Alibaba Cloud to access Qwen models"
            color="#06B6D4"
            icon="💫"
            onLogin={async () => {
              const response = await requestQwenAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="iFlow"
            description="Login with iFlow for AI coding assistance"
            color="#EC4899"
            icon="🌊"
            onLogin={async () => {
              const response = await requestIFlowAuth();
              return response.data;
            }}
          />
        </div>
      </div>
    </div>
  );
}
