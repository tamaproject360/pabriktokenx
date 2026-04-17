import { 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Globe,
  ArrowUpRight,
  Cookie,
  Copy,
} from 'lucide-react';
import { 
  requestAnthropicAuth, 
  requestCodexAuth, 
  requestGeminiCLIAuth,
  requestAntigravityAuth,
  requestQwenAuth,
  requestIFlowAuth,
  requestGitHubCopilotAuth,
  requestGeminiWebCookieAuth,
  submitOAuthCallback,
  getAuthStatus,
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
  icon: string; // Path to image or emoji
  onLogin: () => Promise<{ url?: string; error?: string; state?: string; user_code?: string; device_flow?: boolean; verification_uri?: string }>;
  isDeviceFlow?: boolean;
  manualCallbackProvider?: string;
  onNotify?: (type: 'success' | 'error' | 'info', message: string) => void;
}

function OAuthProviderCard({ title, description, color, icon, onLogin, manualCallbackProvider, onNotify }: OAuthProviderCardProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [oauthState, setOAuthState] = useState<string | null>(null);
  const [callbackURL, setCallbackURL] = useState('');
  const [callbackSubmitting, setCallbackSubmitting] = useState(false);
  const [callbackMessage, setCallbackMessage] = useState<string | null>(null);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitForAuthCompletion = async (state: string) => {
    const maxAttempts = 60;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const response = await getAuthStatus(state);
      const currentStatus = response?.data?.status;

      if (currentStatus === 'ok') {
        return;
      }

      if (currentStatus === 'error') {
        const statusError = response?.data?.error || 'Authentication failed';
        throw new Error(statusError);
      }

      await sleep(2000);
    }

    throw new Error('Timeout waiting for authentication confirmation');
  };

  const handleLogin = async () => {
    setStatus('loading');
    setError(null);
    setUserCode(null);
    setOAuthState(null);
    setCallbackURL('');
    setCallbackMessage(null);
    setAuthCompleted(false);
    try {
      const result = await onLogin();
      if (result.url) {
        setAuthUrl(result.url);
        setOAuthState(result.state || null);
        setStatus('success');
        
        // For device flow, show the user code
        if (result.device_flow && result.user_code) {
          setUserCode(result.user_code);
        }
        
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

  const handleSubmitCallbackURL = async () => {
    const trimmedCallbackURL = callbackURL.trim();
    if (!manualCallbackProvider || !trimmedCallbackURL) {
      return;
    }

    setCallbackSubmitting(true);
    setCallbackMessage('Submitting callback URL...');
    try {
      await submitOAuthCallback(manualCallbackProvider, trimmedCallbackURL, oauthState || undefined);
      setCallbackMessage('Callback URL submitted. Verifying authentication...');
      setCallbackURL('');

      if (oauthState) {
        await waitForAuthCompletion(oauthState);
      }

      setAuthCompleted(true);
      setCallbackMessage('Authentication successful. Account has been added.');
      onNotify?.('success', `${title} berhasil ditambahkan.`);
    } catch (err: any) {
      const apiError = err?.response?.data?.error || err?.message || 'Failed to submit callback URL';
      setCallbackMessage(apiError);
      onNotify?.('error', `${title} gagal ditambahkan: ${apiError}`);
    } finally {
      setCallbackSubmitting(false);
    }
  };

  return (
    <div className="oauth-card glass-panel rounded-2xl overflow-hidden card-hover">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl overflow-hidden"
            style={{ background: `${color}15`, boxShadow: `0 0 30px ${color}20` }}
          >
            {icon.startsWith('/') || icon.includes('.png') || icon.includes('.svg') ? (
              <img src={icon} alt={title} className="w-10 h-10 object-contain" />
            ) : (
              <span>{icon}</span>
            )}
          </div>
          <div className="flex items-center gap-2">{status === 'success' && !authCompleted && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium">
                <CheckCircle className="h-3 w-3" />
                Ready
              </span>
            )}
            {authCompleted && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <CheckCircle className="h-3 w-3" />
                Connected
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
            {userCode && (
              <div className="mb-2 p-2 bg-slate-800/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Enter this code at GitHub:</p>
                <p className="text-lg font-mono font-bold text-white tracking-wider">{userCode}</p>
              </div>
            )}
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

        {status === 'success' && authUrl && manualCallbackProvider && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-3">
            <p className="text-sm text-amber-300">
              Remote browser mode: after provider redirects to <span className="font-mono">http://localhost...</span>,
              copy full URL and paste it below.
            </p>
            <input
              type="text"
              value={callbackURL}
              onChange={(e) => setCallbackURL(e.target.value)}
              placeholder="http://localhost:8085/oauth2callback?code=...&state=..."
              className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 text-sm"
            />
            <button
              onClick={handleSubmitCallbackURL}
              disabled={callbackSubmitting || !callbackURL.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium bg-amber-500/20 border border-amber-500/40 text-amber-300 disabled:opacity-50"
            >
              {callbackSubmitting ? 'Submitting...' : 'Submit Callback URL'}
            </button>
            {callbackMessage && (
              <p className={`text-xs ${authCompleted ? 'text-emerald-300' : 'text-slate-300'}`}>{callbackMessage}</p>
            )}
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

// Cookie-based authentication card
interface CookieAuthCardProps {
  title: string;
  description: string;
  color: string;
  icon: string; // Path to image or emoji
  onSubmit: (cookie: string, email: string) => Promise<void>;
}

function CookieAuthCard({ title, description, color, icon, onSubmit }: CookieAuthCardProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [cookie, setCookie] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCookieInput, setShowCookieInput] = useState(false);

  const handleSubmit = async () => {
    if (!cookie.trim()) {
      setError('Cookie cannot be empty');
      return;
    }

    setStatus('loading');
    setError(null);
    
    try {
      await onSubmit(cookie.trim(), email.trim());
      setStatus('success');
      setCookie('');
      setEmail('');
      setTimeout(() => {
        setStatus('idle');
        setShowCookieInput(false);
      }, 3000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.message || 'Authentication failed';
      setError(errorMsg);
      setStatus('error');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setCookie(text);
    } catch (err) {
      setError('Failed to read clipboard');
    }
  };

  return (
    <div className="oauth-card glass-panel rounded-2xl overflow-hidden card-hover">
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl overflow-hidden"
            style={{ background: `${color}15`, boxShadow: `0 0 30px ${color}20` }}
          >
            {icon.startsWith('/') || icon.includes('.png') || icon.includes('.svg') ? (
              <img src={icon} alt={title} className="w-10 h-10 object-contain" />
            ) : (
              <span>{icon}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {status === 'success' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                <CheckCircle className="h-3 w-3" />
                Success
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium">
                <AlertCircle className="h-3 w-3" />
                Failed
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <h3 className="text-lg font-medium text-white">{title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            {description}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {showCookieInput ? (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Browser Cookies <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <textarea
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  placeholder="Paste your Google cookies here..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors resize-none h-24 text-sm font-mono"
                />
                <button
                  onClick={handlePaste}
                  className="absolute top-2 right-2 p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors"
                  title="Paste from clipboard"
                >
                  <Copy className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Open DevTools → Application → Cookies, copy all Google cookies
              </p>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                Email (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={status === 'loading' || !cookie.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 disabled:opacity-50"
                style={{ 
                  background: `${color}20`, 
                  border: `1px solid ${color}30`,
                  color: color,
                }}
              >
                {status === 'loading' ? (
                  <>
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Cookie className="h-4 w-4" />
                    Submit
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowCookieInput(false);
                  setCookie('');
                  setEmail('');
                  setError(null);
                }}
                className="px-4 py-3 rounded-xl font-medium bg-slate-700/30 border border-slate-600/30 text-slate-400 hover:bg-slate-600/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCookieInput(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300"
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
            <Cookie className="h-4 w-4" />
            Login with Cookies
          </button>
        )}
      </div>
    </div>
  );
}

export default function OAuthPage() {
  const cardsRef = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const pushNotice = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotice({ type, message });
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 5000);
  }, []);

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

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative min-h-screen">
      <AmbientBackground />

      {notice && (
        <div className="fixed top-6 right-6 z-50 max-w-sm animate-slide-in">
          <div className={`rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md ${notice.type === 'success' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' : notice.type === 'error' ? 'bg-rose-500/15 border-rose-400/40 text-rose-200' : 'bg-cyan-500/15 border-cyan-400/40 text-cyan-200'}`}>
            <p className="text-sm font-medium">{notice.message}</p>
          </div>
        </div>
      )}
      
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
            icon="/src/assets/claude.png"
            onNotify={pushNotice}
            onLogin={async () => {
              const response = await requestAnthropicAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="OpenAI Codex"
            description="Login with your ChatGPT subscription to access GPT models"
            color="#10B981"
            icon="/src/assets/codex.png"
            onNotify={pushNotice}
            onLogin={async () => {
              const response = await requestCodexAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="Gemini CLI"
            description="Login with your Google account to access Gemini models"
            color="#22D3EE"
            icon="/src/assets/gemini-cli.png"
            manualCallbackProvider="gemini"
            onNotify={pushNotice}
            onLogin={async () => {
              const response = await requestGeminiCLIAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="Antigravity"
            description="Login with Antigravity for alternative AI access"
            color="#8B5CF6"
            icon="/src/assets/antigravity.png"
            onNotify={pushNotice}
            onLogin={async () => {
              const response = await requestAntigravityAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="Qwen Code"
            description="Login with Alibaba Cloud to access Qwen models"
            color="#06B6D4"
            icon="/src/assets/qwen.png"
            onNotify={pushNotice}
            onLogin={async () => {
              const response = await requestQwenAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="iFlow"
            description="Login with iFlow for AI coding assistance"
            color="#EC4899"
            icon="/src/assets/iflow.png"
            onNotify={pushNotice}
            onLogin={async () => {
              const response = await requestIFlowAuth();
              return response.data;
            }}
          />

          <OAuthProviderCard
            title="GitHub Copilot"
            description="Login with GitHub Copilot subscription to access Copilot models"
            color="#6366F1"
            icon="/src/assets/github.png"
            isDeviceFlow={true}
            onNotify={pushNotice}
            onLogin={async () => {
              const response = await requestGitHubCopilotAuth();
              return response.data;
            }}
          />

          <CookieAuthCard
            title="Gemini Web (Cookie)"
            description="Login using Google session cookies for image generation models"
            color="#22D3EE"
            icon="/src/assets/gemini-web.png"
            onSubmit={async (cookie: string, email: string) => {
              await requestGeminiWebCookieAuth(cookie, email);
            }}
          />
        </div>

        {/* Kiro Note Section */}
        <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <h4 className="text-amber-400 font-semibold mb-2 flex items-center gap-2">
            <span>🤖</span> AWS CodeWhisperer (Kiro)
          </h4>
          <p className="text-sm text-slate-400 mb-2">
            Kiro OAuth requires direct integration with Kiro IDE. To use Kiro authentication:
          </p>
          <ol className="text-sm text-slate-400 list-decimal list-inside space-y-1">
            <li>Download and install <a href="https://kiro.dev" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Kiro IDE</a></li>
            <li>Login to Kiro IDE using Google, GitHub, or AWS Builder ID</li>
            <li>Run CLI command: <code className="px-2 py-0.5 bg-slate-800 rounded text-cyan-300">cliproxy.exe -kiro-import</code></li>
          </ol>
        </div>
      </div>
    </div>
  );
}
