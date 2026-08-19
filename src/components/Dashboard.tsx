import React from 'react';
import { CutOrder, MachineSettings, ScrapItem, SheetItem } from '../types';
import { GeometryService } from '../services/GeometryService';
import {
  Layers,
  Recycle,
  Scissors,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Camera,
  FileText,
  PlusCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  sheets: SheetItem[];
  scraps: ScrapItem[];
  orders: CutOrder[];
  settings: MachineSettings;
  onNavigate: (tab: string) => void;
  onQuickAction: (action: string) => void;
}

export const Dashboard: React.FC<Props> = ({
  sheets,
  scraps,
  orders,
  settings,
  onNavigate,
  onQuickAction,
}) => {
  const totalSheetsCount = sheets.reduce((acc, s) => acc + s.quantity, 0);
  const totalScrapsCount = scraps.filter((s) => s.status === 'disponivel').reduce((acc, s) => acc + s.quantity, 0);

  const totalSheetAreaMm2 = sheets.reduce((acc, s) => acc + s.width * s.length * s.quantity, 0);
  const totalScrapAreaMm2 = scraps
    .filter((s) => s.status === 'disponivel')
    .reduce((acc, s) => acc + s.width * s.length * s.quantity, 0);
  const totalAreaM2 = (totalSheetAreaMm2 + totalScrapAreaMm2) / 1_000_000;

  const completedOrders = orders.filter((o) => o.status === 'cortada');
  const pendingOrders = orders.filter((o) => o.status === 'planejamento' || o.status === 'confirmada');

  const avgYield =
    completedOrders.length > 0
      ? Math.round(
          (completedOrders.reduce((acc, o) => acc + (o.selectedSolution?.yieldPercentage || 0), 0) /
            completedOrders.length) *
            10
        ) / 10
      : null;

  const totalScrapsReused = completedOrders.reduce(
    (acc, o) => acc + (o.selectedSolution?.totalScrapsUsed || 0),
    0
  );

  const alerts: { type: 'warning' | 'info' | 'success'; text: string; actionText?: string; actionTab?: string }[] = [];

  if (totalSheetsCount === 0) {
    alerts.push({
      type: 'warning',
      text: 'Nenhuma chapa cadastrada no estoque. Cadastre suas bobinas ou chapas para calcular planos de corte.',
      actionText: '+ Cadastrar Chapa',
      actionTab: 'sheets',
    });
  } else if (totalSheetsCount < 5) {
    alerts.push({
      type: 'info',
      text: `Estoque de chapas inteiras: ${totalSheetsCount} unidade(s) disponível(is).`,
      actionText: 'Ver Estoque',
      actionTab: 'sheets',
    });
  }

  if (totalScrapsCount >= 3) {
    alerts.push({
      type: 'info',
      text: `Você possui ${totalScrapsCount} retalhos disponíveis prontos para reaproveitamento nos próximos cortes.`,
      actionText: 'Ver Retalhos',
      actionTab: 'scraps',
    });
  }

  alerts.push({
    type: 'success',
    text: `Guilhotina calibrada: Comprimento máx. de ${settings.maxCutLength} mm com kerf de ${settings.kerf} mm.`,
    actionText: 'Ajustar',
    actionTab: 'settings',
  });

  return (
    <div id="dashboard-view" className="space-y-6">
      {/* Header do Painel Geometric Balance */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
            Dashboard da Oficina
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Otimizador de Chapas Metálicas, Calhas, Rufos e Retalhos
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onQuickAction('photo')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-sm transition-all"
          >
            <Camera className="w-4 h-4 text-emerald-600" />
            <span>Foto IA</span>
          </button>

          <button
            onClick={() => onQuickAction('pdf')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 shadow-sm transition-all"
          >
            <FileText className="w-4 h-4 text-amber-600" />
            <span>PDF IA</span>
          </button>

          <button
            onClick={() => onNavigate('cut-orders')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md shadow-blue-900/30 transition-all active:scale-95"
          >
            <Scissors className="w-4 h-4" />
            <span>Novo Corte 2D</span>
          </button>
        </div>
      </header>

      {/* Grid de KPIs Principais (Geometric Balance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1 */}
        <div
          onClick={() => onNavigate('sheets')}
          className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chapas Inteiras</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">{totalSheetsCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">unidades em estoque</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-blue-600 font-bold flex items-center justify-between">
            <span>{sheets.length} tipos cadastrados</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* KPI 2 */}
        <div
          onClick={() => onNavigate('scraps')}
          className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-amber-400 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Retalhos & Sobras</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg group-hover:scale-105 transition-transform">
              <Recycle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">{totalScrapsCount}</div>
            <div className="text-xs text-slate-500 mt-0.5">disponíveis para corte</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-amber-600 font-bold flex items-center justify-between">
            <span>Reaproveitamento prioritário</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Área Total</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-600 font-mono">
              {totalAreaM2.toFixed(1)} <span className="text-sm font-sans font-bold">m²</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">matéria-prima disponível</div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            Chapas: {((totalSheetAreaMm2 / 1_000_000) || 0).toFixed(1)}m² | Sobras: {((totalScrapAreaMm2 / 1_000_000) || 0).toFixed(1)}m²
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Eficiência Média</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-purple-700 font-mono">
              {avgYield !== null ? `${avgYield}%` : '--'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {avgYield !== null ? 'aproveitamento médio' : 'aguardando primeiras ordens'}
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            {totalScrapsReused} retalho(s) reutilizados
          </div>
        </div>
      </div>

      {/* Seção Inferior: Alertas Técnicos + Bloco Escuro de Próximo Passo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alertas da Oficina */}
        <div className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Alertas Operacionais & Dicas Técnicas
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Oficina Ativa</span>
          </div>

          <div className="space-y-3">
            {alerts.map((alt, idx) => (
              <div
                key={`alt-${idx}`}
                className={`p-3.5 rounded-lg border flex items-start justify-between gap-3 text-xs ${
                  alt.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : alt.type === 'info'
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5">
                    {alt.type === 'warning' && '⚠️'}
                    {alt.type === 'info' && '💡'}
                    {alt.type === 'success' && '✅'}
                  </span>
                  <span className="font-medium">{alt.text}</span>
                </div>
                {alt.actionText && alt.actionTab && (
                  <button
                    onClick={() => onNavigate(alt.actionTab!)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 font-bold text-[11px] rounded border border-slate-300 shadow-sm shrink-0"
                  >
                    {alt.actionText}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Dica de Funilaria Geometric Balance */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3 text-xs text-slate-700">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-slate-900">Geometria Balanceada 2D:</strong> Peças com desenvolvimento variável (caimento) são emparelhadas de forma invertida pelo motor geométrico, anulando o desperdício angular da chapa!
            </div>
          </div>
        </div>

        {/* Card Escuro de Ação "Próximo Passo" (Fiel ao tema Geometric Balance) */}
        <div className="bg-slate-900 rounded-xl p-6 flex flex-col justify-between text-white shadow-md">
          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">
                Próximo Passo
              </span>
              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                <Scissors className="w-4 h-4" />
              </div>
            </div>

            <div>
              <h4 className="text-base font-bold text-white uppercase tracking-tight">
                Criar Nova Otimização 2D
              </h4>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Cadastre a lista de peças ou fotografe o orçamento para gerar a sequência de corte com até 98.4% de aproveitamento.
              </p>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-750 text-xs text-slate-300 font-mono space-y-1">
              <div>• Ordens Concluídas: <strong className="text-white">{completedOrders.length}</strong></div>
              <div>• Ordens em Planejamento: <strong className="text-amber-400">{pendingOrders.length}</strong></div>
            </div>
          </div>

          <button
            onClick={() => onNavigate('cut-orders')}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-500 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/50 transition-all active:scale-95"
          >
            INICIAR PLANO DE CORTE
          </button>
        </div>
      </div>
    </div>
  );
};
