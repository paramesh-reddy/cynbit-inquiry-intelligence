import { useEffect, useState } from 'react';
import {
  BookOpen,
  Inbox,
  LayoutDashboard,
  Menu,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { api } from './api';
import { DashboardView } from './components/DashboardView';
import { InquiriesListView } from './components/InquiriesListView';
import { InquiryDetailView } from './components/InquiryDetailView';
import { KnowledgeBaseView } from './components/KnowledgeBaseView';
import { NewInquiryView } from './components/NewInquiryView';
import { SettingsView } from './components/SettingsView';
import type { DashboardMetrics, InquiryRecord } from './types';

type ActiveRoute = 'dashboard' | 'inquiries' | 'new-inquiry' | 'detail' | 'knowledge' | 'settings';

export default function App() {
  const [route, setRoute] = useState<ActiveRoute>('dashboard');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const refreshMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const data = await api.getDashboardMetrics();
      setMetrics(data);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    refreshMetrics();
  }, []);

  const navigate = (next: ActiveRoute) => {
    setRoute(next);
    setMobileMenuOpen(false);
  };

  const openInquiry = (id: number) => {
    setSelectedId(id);
    setRoute('detail');
    setMobileMenuOpen(false);
  };

  const handleInquiryCreated = (rec: InquiryRecord) => {
    refreshMetrics();
    openInquiry(rec.id);
  };

  const navItems: Array<{ id: ActiveRoute; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'inquiries', label: 'Inquiries', icon: Inbox },
    { id: 'new-inquiry', label: 'New Inquiry', icon: Plus },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const pageTitle: Record<ActiveRoute, string> = {
    dashboard: 'Overview',
    inquiries: 'Inquiry History',
    'new-inquiry': 'New Inquiry Intake',
    detail: selectedId ? `Inquiry #${selectedId}` : 'Inquiry Detail',
    knowledge: 'Cynbit Knowledge Base',
    settings: 'Workspace Settings',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-slate-200 shrink-0">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="text-left focus:outline-none"
          >
            <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Cynbit Intelligence
            </span>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              route === item.id || (route === 'detail' && item.id === 'inquiries');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 flex items-center gap-3">
          <img
            src="/src/assets/images/avatar_bdm_reviewer_1794586016022.jpg"
            alt="Reviewer profile portrait"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-900 truncate">BDM Review Desk</div>
            <div className="text-xs text-slate-500 truncate">Human-in-the-Loop</div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-xs bg-white h-full border-r border-slate-200 flex flex-col z-50">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <span className="font-display text-base font-bold text-slate-900">
                Cynbit Intelligence
              </span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = route === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg ${
                      active ? 'bg-slate-100 text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-400 hidden sm:inline">Workspace</span>
              <span className="text-slate-300 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">{pageTitle[route]}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('new-inquiry')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-700 rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Inquiry</span>
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {route === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              loading={loadingMetrics}
              onSelectInquiry={openInquiry}
              onNavigate={(v) => navigate(v)}
            />
          )}

          {route === 'new-inquiry' && (
            <NewInquiryView onCreated={handleInquiryCreated} />
          )}

          {route === 'inquiries' && (
            <InquiriesListView
              onSelectInquiry={openInquiry}
              onRefreshMetrics={refreshMetrics}
            />
          )}

          {route === 'detail' && selectedId !== null && (
            <InquiryDetailView
              inquiryId={selectedId}
              onBack={() => navigate('inquiries')}
              onUpdated={refreshMetrics}
            />
          )}

          {route === 'knowledge' && <KnowledgeBaseView />}

          {route === 'settings' && (
            <SettingsView onSettingsUpdated={refreshMetrics} />
          )}
        </main>
      </div>
    </div>
  );
}
