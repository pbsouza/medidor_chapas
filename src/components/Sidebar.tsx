import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Recycle,
  Scissors,
  Camera,
  FileText,
  Sparkles,
  FileSpreadsheet,
  Settings,
  X,
  Sliders,
} from 'lucide-react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenSettings: () => void;
  onOpenAssistant: () => void;
  onQuickAction: (action: string) => void;
}

export const Sidebar: React.FC<Props> = ({
  activeTab,
  onTabChange,
  isOpenMobile,
  onCloseMobile,
  onOpenSettings,
  onOpenAssistant,
  onQuickAction,
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard Geral', icon: LayoutDashboard },
    { id: 'cut-orders', label: 'Ordens & Otimizador 2D', icon: Scissors, badge: 'PRO' },
    { id: 'sheets', label: 'Estoque de Chapas', icon: Layers },
    { id: 'scraps', label: 'Retalhos & Sobras', icon: Recycle },
    { id: 'reports', label: 'Relatórios & Histórico', icon: FileSpreadsheet },
  ];

  return (
    <>
      {/* Overlay Mobile */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="main-sidebar"
        className={`fixed top-16 bottom-0 left-0 z-40 w-72 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex-1 overflow-y-auto p-4 flex flex-col">
          {/* Header da Barra Lateral */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Navegação Oficina
            </h2>
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg lg:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Menu Principal */}
          <div className="space-y-2 mb-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => {
                    onTabChange(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-xs font-bold transition-all border ${
                    isActive
                      ? 'bg-blue-50 border-blue-200 text-blue-900 shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Atalhos Rápidos com IA */}
          <div className="space-y-2 mb-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Ferramentas de Entrada
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onQuickAction('photo');
                  onCloseMobile();
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Camera className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Foto / Cota</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Leitura IA</div>
              </button>

              <button
                onClick={() => {
                  onQuickAction('pdf');
                  onCloseMobile();
                }}
                className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-left transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <FileText className="w-3.5 h-3.5 text-amber-600" />
                  <span>Arquivo PDF</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Projetos</div>
              </button>
            </div>
          </div>
        </div>

        {/* Bloco de Destaque IA VISION (Design Geometric Balance) */}
        <div className="p-4 bg-slate-900 text-white border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">IA VISION & CORTE</p>
              <p className="text-xs text-slate-300 leading-tight">Analisar medidas via foto ou PDF</p>
            </div>
          </div>
          <button
            onClick={() => {
              onQuickAction('photo');
              onCloseMobile();
            }}
            className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded text-xs font-bold uppercase tracking-wider shadow-lg shadow-blue-900/50 transition-all"
          >
            IMPORTAR ARQUIVO
          </button>
        </div>
      </aside>
    </>
  );
};
