import React from 'react';
import { Menu, Scissors, Sparkles, Sliders, Layers, Plus, Cloud, CheckCircle } from 'lucide-react';

interface Props {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
  onOpenAssistant: () => void;
  onNavigateTab: (tab: string) => void;
  activeTab: string;
  isCloudSyncing?: boolean;
}

const TAB_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'cut-orders', label: 'Ordens de Corte' },
  { id: 'sheets', label: 'Estoque de Chapas' },
  { id: 'scraps', label: 'Retalhos' },
  { id: 'reports', label: 'Relatórios' },
];

export const Navbar: React.FC<Props> = ({
  onToggleSidebar,
  onOpenSettings,
  onOpenAssistant,
  onNavigateTab,
  activeTab,
  isCloudSyncing = false,
}) => {
  return (
    <nav className="h-16 w-full bg-slate-900 text-white flex items-center justify-between px-4 sm:px-6 border-b border-slate-800 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          id="mobile-menu-toggle-btn"
          onClick={onToggleSidebar}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          onClick={() => onNavigateTab('dashboard')}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-lg text-white shadow-md shadow-blue-500/30">
            C
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight uppercase">
            CorteFácil <span className="text-blue-400 font-light hidden xs:inline">| Otimizador</span>
          </span>
        </div>

        {/* Status de Conexão com a Nuvem Firebase */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/80 border border-slate-700/80 rounded-full text-[11px] font-medium text-slate-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 font-semibold">Firebase Cloud Ativo</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 text-[10px]">Sincronização em tempo real</span>
        </div>
      </div>

      {/* Navegação Topo Desktop */}
      <div className="hidden md:flex items-center gap-5 text-xs font-semibold">
        {TAB_NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigateTab(item.id)}
              className={`pb-1 transition-all uppercase tracking-wider ${
                isActive
                  ? 'text-blue-400 border-b-2 border-blue-400 font-bold'
                  : 'text-slate-300 hover:text-blue-400'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Ações Rápidas Direita */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenAssistant}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-blue-300 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition-all shadow-sm"
        >
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="hidden sm:inline">IA Assistente</span>
        </button>

        <div className="h-6 w-px bg-slate-800 mx-1 hidden sm:block"></div>

        <button
          onClick={() => onNavigateTab('cut-orders')}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-blue-900/40 active:scale-95 text-white"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">+ Novo Corte</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          title="Configurações da Guilhotina & Nuvem"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>
    </nav>
  );
};

