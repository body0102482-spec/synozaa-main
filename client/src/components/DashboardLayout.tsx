import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LucideIcon, Activity, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';
import { ConnectionStatus } from './ConnectionStatus';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  activeId: string;
  onNavChange: (id: string) => void;
  children: ReactNode;
  homeLink?: string;
}

export function DashboardLayout({
  title,
  subtitle,
  navItems,
  activeId,
  onNavChange,
  children,
  homeLink = '/',
}: DashboardLayoutProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-dvh min-h-0 bg-slate-100 dark:bg-slate-950 flex overflow-hidden">
      {/* Sidebar — boutique-style dark panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[min(280px,85vw)] bg-[#0f1117] text-slate-300 transform transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:flex-shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-white/10">
            <Link to={homeLink} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Activity className="text-white" size={20} />
              </div>
              <div>
                <p className="font-bold text-white tracking-wide">{t('appName')}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Admin Panel</p>
              </div>
            </Link>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => {
                  onNavChange(id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  activeId === id
                    ? 'bg-white/10 text-white shadow-inner border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={activeId === id ? 'text-blue-400' : ''} />
                {label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <LogOut size={16} /> {t('logout')}
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main — constrained height so content scrolls in <main> and sticky bars work */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="shrink-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
                {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ConnectionStatus />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 p-4 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
