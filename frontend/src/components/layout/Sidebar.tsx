import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  Key,
  Shield,
  FileText,
  Activity,
  LogOut,
  UserCircle,
  RefreshCw,
  Globe,
  Menu,
  Sparkles,
  Database,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import gsap from 'gsap';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', color: '#22D3EE' },
  { to: '/playground', icon: Sparkles, label: 'Playground', color: '#8B5CF6' },
  { to: '/usage', icon: Activity, label: 'Usage', color: '#10B981' },
  { to: '/auth-files', icon: UserCircle, label: 'Auth Files', color: '#F59E0B' },
  { to: '/quota', icon: Database, label: 'Quota', color: '#3B82F6' },
  { to: '/model-settings', icon: SlidersHorizontal, label: 'Model Settings', color: '#A855F7' },
  { to: '/proxy-keys', icon: Shield, label: 'Proxy Keys', color: '#F97316' },
  { to: '/api-keys', icon: Key, label: 'AI Providers', color: '#F43F5E' },
  { to: '/oauth', icon: Globe, label: 'OAuth', color: '#06B6D4' },
  { to: '/logs', icon: FileText, label: 'Logs', color: '#A78BFA' },
  { to: '/config', icon: Settings, label: 'Config', color: '#94A3B8' },
  { to: '/routing', icon: RefreshCw, label: 'Routing', color: '#34D399' },
];

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const { logout } = useAuth();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const navItemsRef = useRef<(HTMLLIElement | null)[]>([]);
  const logoTextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sidebar toggle animation with GSAP timeline
    const tl = gsap.timeline();
    
    if (collapsed) {
      // Collapse animation
      tl.to(logoTextRef.current, {
        opacity: 0,
        x: -10,
        duration: 0.2,
        ease: 'power2.in',
      })
      .to(sidebarRef.current, {
        width: '80px',
        duration: 0.5,
        ease: 'power3.inOut',
      }, '-=0.1')
      .to('.nav-label', {
        opacity: 0,
        x: -10,
        duration: 0.2,
        stagger: 0.02,
        ease: 'power2.in',
      }, '-=0.4');
    } else {
      // Expand animation
      tl.to(sidebarRef.current, {
        width: '260px',
        duration: 0.5,
        ease: 'power3.inOut',
      })
      .to(logoTextRef.current, {
        opacity: 1,
        x: 0,
        duration: 0.3,
        ease: 'power2.out',
      }, '-=0.2')
      .to('.nav-label', {
        opacity: 1,
        x: 0,
        duration: 0.3,
        stagger: 0.03,
        ease: 'power2.out',
      }, '-=0.2');
    }
  }, [collapsed]);

  // Magnetic hover effect for nav items
  const handleNavHover = (e: React.MouseEvent<HTMLAnchorElement>, index: number) => {
    if (collapsed) return;
    
    const item = navItemsRef.current[index];
    if (!item) return;

    const rect = item.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    gsap.to(item, {
      x: x * 0.15,
      y: y * 0.15,
      duration: 0.3,
      ease: 'elastic.out(1, 0.3)',
    });
  };

  const handleNavLeave = (index: number) => {
    const item = navItemsRef.current[index];
    if (!item) return;

    gsap.to(item, {
      x: 0,
      y: 0,
      duration: 0.5,
      ease: 'elastic.out(1, 0.3)',
    });
  };

  return (
    <aside
      ref={sidebarRef}
      className="fixed left-0 top-0 h-screen z-40 overflow-hidden backdrop-blur-xl"
      style={{
        width: collapsed ? '80px' : '260px',
        background: 'rgba(9, 9, 11, 0.95)',
        borderRight: '1px solid rgba(255, 255, 255, 0.06)',
      }}
    >
      <div className="flex flex-col h-full relative">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-cyan-500/5 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-violet-500/5 to-transparent" />
        </div>

        {/* Logo & Toggle */}
          <div className="relative h-20 flex items-center justify-between px-5 border-b border-white/[0.06]" style={{ minHeight: '5rem' }}>
          <div className="flex items-center gap-3 overflow-hidden" style={{ maxWidth: collapsed ? '40px' : '100%', position: 'relative', overflow: 'hidden' }}>
            <div className="relative flex-shrink-0 overflow-hidden">
              {!collapsed && (
                <div className="absolute inset-0 bg-cyan-400 blur-lg opacity-30 animate-pulse" />
              )}
              <div className={`relative ${collapsed ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center overflow-hidden`}>
                <img src="/logo.png" alt="Pabrik Token" className={`${collapsed ? 'w-6 h-6' : 'w-8 h-8'} object-contain`} style={{ transform: 'none', marginLeft: 0 }} />
              </div>
            </div>
            <div ref={logoTextRef} className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-white tracking-tight">
                Pabrik Token
              </span>
              <span className="text-xs text-cyan-400 font-mono">v2.0</span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-slate-500 hover:text-cyan-400 transition-all group"
          >
            <Menu className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" strokeWidth={1.5} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 overflow-y-auto overflow-x-hidden px-3" style={{ overflowX: 'hidden' }}>
          <ul className="space-y-2">
            {navItems.map((item, index) => {
              const isActive = location.pathname === item.to;
              return (
                <li
                  key={item.to}
                  ref={(el) => { navItemsRef.current[index] = el; }}
                  className="relative"
                >
                  <NavLink
                    to={item.to}
                    onMouseMove={(e) => handleNavHover(e, index)}
                    onMouseLeave={() => handleNavLeave(index)}
                    className={`
                      relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                      ${collapsed ? 'justify-center' : ''}
                      ${isActive 
                        ? 'bg-white/[0.05] text-white border-l-2' 
                        : 'text-slate-400 hover:bg-white/[0.03] hover:text-white border-l-2 border-transparent'
                      }
                    `}
                    style={isActive ? { borderLeftColor: item.color } : undefined}
                  >
                    {/* Active indicator glow */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 opacity-10 rounded-xl"
                        style={{
                          background: `linear-gradient(90deg, ${item.color}40, transparent)`,
                        }}
                      />
                    )}
                    
                    {/* Icon with glow */}
                    <div className="relative flex-shrink-0">
                      {isActive && (
                        <div 
                          className="absolute inset-0 blur-md opacity-50"
                          style={{ background: item.color }}
                        />
                      )}
                      <item.icon 
                        className={`relative h-5 w-5 transition-colors ${
                          isActive ? 'electric-glow' : ''
                        }`}
                        style={{ color: isActive ? item.color : undefined }}
                        strokeWidth={1.5}
                      />
                    </div>
                    
                    {/* Label */}
                    <span 
                      className="nav-label text-sm font-medium tracking-tight whitespace-nowrap overflow-hidden"
                      style={{ fontFamily: 'Inter Tight, sans-serif' }}
                    >
                      {item.label}
                    </span>

                    {/* Active indicator dot (collapsed mode) */}
                    {isActive && collapsed && (
                      <div 
                        className="absolute -right-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: item.color }}
                      />
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* System Status */}
        <div className="relative px-3 py-4 border-t border-white/[0.06]">
          <div className={`bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 ${collapsed ? 'px-2' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-emerald-400 blur-md opacity-50 animate-pulse" />
                <div className="relative w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              {!collapsed && (
                <div className="nav-label flex-1">
                  <p className="text-xs text-slate-500 font-medium">Status</p>
                  <p className="text-xs text-emerald-400 font-semibold">Online</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="relative px-3 pb-4">
          <button
            onClick={logout}
            className={`
              flex items-center gap-3 w-full px-4 py-3 rounded-xl 
              text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 
              transition-all duration-200 group border border-white/[0.06] hover:border-rose-500/30
              ${collapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut className="h-5 w-5 group-hover:translate-x-0.5 transition-transform" strokeWidth={1.5} />
            <span className="nav-label text-sm font-medium overflow-hidden whitespace-nowrap">
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
