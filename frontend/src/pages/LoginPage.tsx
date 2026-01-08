import { useState, useEffect, useRef, Suspense, lazy, Component } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { KeyRound, Cpu, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import gsap from 'gsap';
import { 
  animateShake, 
  animateButtonPress, 
  animateButtonRelease,
  createMagneticEffect,
  easings,
  durations,
} from '../lib/animations';

// Lazy load Three.js component for better performance
const ParticleField = lazy(() => import('../components/three/ParticleField'));

// Error Boundary for ParticleField
interface ErrorBoundaryState {
  hasError: boolean;
}

class ParticleErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn('ParticleField error caught by boundary:', error.message);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI when Three.js fails
      return (
        <div 
          className="fixed inset-0 z-0 pointer-events-none"
          style={{ background: '#09090B' }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(34, 211, 238, 0.15) 0%, transparent 70%)',
              }}
            />
            <div 
              className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full animate-pulse"
              style={{
                background: 'radial-gradient(circle, rgba(34, 211, 238, 0.1) 0%, transparent 70%)',
                filter: 'blur(40px)',
              }}
            />
            <div 
              className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full animate-pulse"
              style={{
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
                filter: 'blur(60px)',
                animationDelay: '1s',
              }}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function LoginPage() {
  const { login } = useAuth();
  const [managementKey, setManagementKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Boot sequence animation
  useEffect(() => {
    const tl = gsap.timeline({
      onComplete: () => setIsReady(true),
    });

    // Initial state
    gsap.set([logoRef.current, formRef.current, '.status-text'], { 
      autoAlpha: 0,
    });

    // Animated reveal sequence
    tl.to(logoRef.current, {
      autoAlpha: 1,
      scale: 1,
      duration: durations.slow,
      ease: easings.emphasized,
      force3D: true,
    })
    .from('.logo-icon', {
      scale: 0.5,
      rotation: -180,
      duration: durations.medium,
      ease: easings.spring,
      force3D: true,
    }, '-=0.3')
    .to('.brand-text', {
      autoAlpha: 1,
      y: 0,
      duration: durations.normal,
      stagger: 0.05,
      ease: easings.decelerate,
      force3D: true,
    }, '-=0.2')
    .to(formRef.current, {
      autoAlpha: 1,
      y: 0,
      duration: durations.medium,
      ease: easings.emphasized,
      force3D: true,
    }, '-=0.1')
    .to('.status-text', {
      autoAlpha: 1,
      y: 0,
      duration: durations.normal,
      stagger: 0.1,
      ease: easings.decelerate,
      force3D: true,
    }, '-=0.2');

    // Focus input after animation
    setTimeout(() => {
      inputRef.current?.focus();
    }, 1200);
  }, []);

  // Magnetic hover effect for button
  useEffect(() => {
    if (!buttonRef.current) return;
    
    const { onMove, onLeave } = createMagneticEffect(buttonRef.current, 0.2);
    const button = buttonRef.current;
    
    button.addEventListener('mousemove', onMove as EventListener);
    button.addEventListener('mouseleave', onLeave);
    
    return () => {
      button.removeEventListener('mousemove', onMove as EventListener);
      button.removeEventListener('mouseleave', onLeave);
    };
  }, [isReady]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    animateButtonPress(buttonRef.current);

    try {
      const response = await fetch('/v0/management/config', {
        headers: {
          'Authorization': `Bearer ${managementKey}`,
        },
      });

      if (response.ok) {
        // Success - fade out and login
        gsap.to(containerRef.current, {
          autoAlpha: 0,
          scale: 1.02,
          duration: durations.normal,
          ease: easings.accelerate,
          force3D: true,
          onComplete: () => login(managementKey),
        });
      } else if (response.status === 401 || response.status === 403) {
        setError('INVALID_CREDENTIALS');
        animateShake(formRef.current);
      } else {
        setError('CONNECTION_FAILED');
        animateShake(formRef.current);
      }
    } catch {
      setError('SERVER_UNREACHABLE');
      animateShake(formRef.current);
    } finally {
      setLoading(false);
      animateButtonRelease(buttonRef.current);
    }
  };

  const getErrorMessage = () => {
    switch (error) {
      case 'INVALID_CREDENTIALS':
        return 'Access Denied: Invalid Management Key';
      case 'CONNECTION_FAILED':
        return 'System Error: Connection Failed';
      case 'SERVER_UNREACHABLE':
        return 'Critical: Proxy Server Unreachable';
      default:
        return error;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#09090B' }}>
      {/* Three.js Particle Background with Error Boundary */}
      <ParticleErrorBoundary>
        <Suspense fallback={null}>
          <ParticleField 
            particleCount={1200} 
            color="#22D3EE" 
            speed={0.25}
            mouseInteraction={true}
          />
        </Suspense>
      </ParticleErrorBoundary>

      {/* Ambient Light Gradient */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        <div 
          className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[700px] h-[500px]"
          style={{
            background: 'radial-gradient(ellipse, rgba(34, 211, 238, 0.12), transparent 70%)',
            filter: 'blur(100px)',
          }}
        />
        <div 
          className="absolute bottom-[-150px] right-[-100px] w-[400px] h-[400px]"
          style={{
            background: 'radial-gradient(ellipse, rgba(139, 92, 246, 0.08), transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Content */}
      <div 
        ref={containerRef} 
        className="relative min-h-screen flex items-center justify-center px-4 z-10"
      >
        <div className="w-full max-w-md space-y-8">
          
          {/* Logo & Branding */}
          <div ref={logoRef} className="text-center space-y-1" style={{ opacity: 0, marginTop: '40px' }}>
            <div className="inline-flex items-center justify-center">
              <div className="relative logo-icon">
                {/* Glow effect */}
                <div 
                  className="absolute inset-0 rounded-2xl animate-pulse"
                  style={{
                    background: 'rgba(34, 211, 238, 0.4)',
                    filter: 'blur(20px)',
                  }}
                />
                {/* Logo container */}
                <div 
                  className="relative w-[300px] h-[300px] rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <img src="/logo.png" alt="PabrikTokenX Logo" className="w-[300px] h-[300px] object-contain" />
                </div>
              </div>
            </div>
            
            <div className="space-y-1" style={{ marginTop: '-36px' }}>
              <h1 className="text-4xl font-semibold tracking-tight">
                <span className="brand-text text-white" style={{ opacity: 0, transform: 'translateY(10px)' }}>Pabrik</span>
                <span className="brand-text text-cyan-400 mx-2" style={{ opacity: 0, transform: 'translateY(10px)' }}>Token</span>
                <span className="brand-text text-white" style={{ opacity: 0, transform: 'translateY(10px)' }}>X</span>
              </h1>
              <p className="brand-text text-slate-500 text-sm font-medium" style={{ opacity: 0, transform: 'translateY(10px)' }}>
                Management Control System
              </p>
            </div>
          </div>

          {/* Login Form */}
          <form 
            ref={formRef} 
            className="space-y-6" 
            onSubmit={handleSubmit}
            style={{ opacity: 0, transform: 'translateY(20px)' }}
          >
            <div 
              className="rounded-2xl p-8 space-y-6"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              
              {/* Status Indicator */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">STATUS</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-400 rounded-full blur-sm animate-pulse" />
                    <div className="relative w-2 h-2 rounded-full bg-emerald-400" />
                  </div>
                  <span className="text-emerald-400 font-medium">Ready</span>
                </div>
              </div>

              {/* Key Input */}
              <div className="space-y-3">
                <label 
                  htmlFor="management-key" 
                  className="block text-sm font-medium text-slate-400"
                >
                  Access Key
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound 
                      className="h-5 w-5 text-slate-500 group-focus-within:text-cyan-400 transition-colors duration-200" 
                      strokeWidth={1.5} 
                    />
                  </div>
                  <input
                    ref={inputRef}
                    id="management-key"
                    name="key"
                    type="password"
                    required
                    value={managementKey}
                    onChange={(e) => setManagementKey(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 rounded-xl text-white placeholder-slate-600 font-mono transition-all duration-200 focus:outline-none"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      letterSpacing: '0.1em',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'rgba(34, 211, 238, 0.5)';
                      e.target.style.boxShadow = '0 0 0 3px rgba(34, 211, 238, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                      e.target.style.boxShadow = 'none';
                    }}
                    placeholder="••••••••••••"
                  />
                </div>
                <p className="text-xs text-slate-600">
                  Enter your management authentication key
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div 
                  className="flex items-start gap-3 p-4 rounded-xl"
                  style={{
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                  }}
                >
                  <AlertTriangle className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-rose-400">
                    {getErrorMessage()}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                ref={buttonRef}
                type="submit"
                disabled={loading || !managementKey}
                className="w-full relative py-4 px-6 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden group"
                style={{
                  background: loading 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'linear-gradient(135deg, #22D3EE 0%, #0891B2 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {/* Hover glow effect */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.3) 0%, transparent 100%)',
                  }}
                />
                
                {/* Button content */}
                <div className="relative flex items-center justify-center gap-3">
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                      <span className="text-white">Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-slate-900">Initialize Access</span>
                      <ArrowRight className="h-4 w-4 text-slate-900 group-hover:translate-x-1 transition-transform duration-200" />
                    </>
                  )}
                </div>
              </button>
            </div>
          </form>

          {/* Footer */}
          <div className="text-center space-y-2">
            <p className="status-text text-xs text-slate-600" style={{ opacity: 0, transform: 'translateY(10px)' }}>
              v2.0.0 • Pabrik Token X
            </p>
            <p className="status-text text-xs text-slate-700" style={{ opacity: 0, transform: 'translateY(10px)' }}>
              Ensure proxy server is active on PORT:9999
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
