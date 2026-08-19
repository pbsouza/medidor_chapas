import React, { useState } from 'react';
import {
  CutOrder,
  CutPiece,
  MachineSettings,
  OptimizationSolution,
  PieceType,
  PriorityMode,
  ScrapItem,
  SheetItem,
  UnitType,
} from '../types';
import { CutOptimizationService } from '../services/CutOptimizationService';
import { GeometryService } from '../services/GeometryService';
import { ExportService } from '../services/ExportService';
import { VisualCutDiagram } from './VisualCutDiagram';
import {
  Scissors,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Download,
  FileSpreadsheet,
  Layers,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Award,
} from 'lucide-react';

interface Props {
  sheets: SheetItem[];
  scraps: ScrapItem[];
  settings: MachineSettings;
  onExecuteOrder: (order: CutOrder, solution: OptimizationSolution) => void;
  onNavigate: (tab: string) => void;
}

const PIECE_PRESETS: { name: string; type: PieceType; defaultDev: number; defaultDevEnd?: number }[] = [
  { name: 'Calha Platibanda', type: 'calha_platibanda', defaultDev: 600 },
  { name: 'Calha Beiral', type: 'calha_beiral', defaultDev: 400 },
  { name: 'Calha Moldura', type: 'calha_moldura', defaultDev: 500 },
  { name: 'Rufo Externo (Var)', type: 'rufo_externo', defaultDev: 400, defaultDevEnd: 350 },
  { name: 'Rufo Encoste', type: 'rufo_encoste', defaultDev: 300 },
  { name: 'Pingadeira T01', type: 'pingadeira', defaultDev: 250 },
  { name: 'Colarinho Chaminé', type: 'colarinho', defaultDev: 350 },
  { name: 'Contra-Rufo', type: 'contra_rufo', defaultDev: 200 },
];

export const CutOrderManager: React.FC<Props> = ({
  sheets,
  scraps,
  settings,
  onExecuteOrder,
  onNavigate,
}) => {
  // Peças da Ordem (inicia totalmente limpo sem dados de exemplo)
  const [pieces, setPieces] = useState<CutPiece[]>([]);

  // Parâmetros de Otimização
  const [priority, setPriority] = useState<PriorityMode>(settings.defaultPriority || 'use_scraps_first');
  const [preferredWidth, setPreferredWidth] = useState<number>(settings.preferredWidth || 0);
  const [prioritizeMostInStock, setPrioritizeMostInStock] = useState<boolean>(settings.prioritizeMostInStock || false);
  const [orderName, setOrderName] = useState('Ordem de Corte #001');
  const [customerName, setCustomerName] = useState('');

  // Input de Nova Peça
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PieceType>('calha_platibanda');
  const [newDevStart, setNewDevStart] = useState<number>(500);
  const [newDevEnd, setNewDevEnd] = useState<number>(500);
  const [newLength, setNewLength] = useState<number>(3000);
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [newMaterial, setNewMaterial] = useState('Galvanizado');
  const [newThickness, setNewThickness] = useState('0.50mm');
  const [inputUnit, setInputUnit] = useState<UnitType>('mm');
  const [isTrapezoidMode, setIsTrapezoidMode] = useState(false);

  // Soluções Calculadas
  const [solutions, setSolutions] = useState<OptimizationSolution[]>([]);
  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);

  // Coleta larguras disponíveis no estoque
  const availableWidths: number[] = Array.from(
    new Set<number>(
      sheets
        .map((s) => Number(s.width))
        .filter((w): w is number => typeof w === 'number' && !isNaN(w) && w > 0)
    )
  ).sort((a: number, b: number) => b - a);

  // Executar Otimização 2D
  const runOptimizationWithPieces = (
    piecesToOptimize: CutPiece[],
    optPriority = priority,
    optWidth = preferredWidth,
    optMostStock = prioritizeMostInStock
  ) => {
    if (piecesToOptimize.length === 0) {
      setSolutions([]);
      return;
    }

    setIsCalculating(true);
    setTimeout(() => {
      try {
        const effectiveSettings: MachineSettings = {
          ...settings,
          defaultPriority: optPriority,
          preferredWidth: optWidth > 0 ? optWidth : undefined,
          prioritizeMostInStock: optPriority === 'most_stock_first' || optMostStock,
        };

        const results = CutOptimizationService.generateSolutions(
          piecesToOptimize,
          sheets,
          scraps,
          effectiveSettings
        );
        setSolutions(results);
        setSelectedSolutionIndex(0);
      } catch (err: any) {
        console.error('Erro na otimização:', err);
      } finally {
        setIsCalculating(false);
      }
    }, 150);
  };

  // Calcula na inicialização e quando as chapas/retalhos/peças mudarem
  React.useEffect(() => {
    if (pieces.length > 0) {
      runOptimizationWithPieces(pieces, priority, preferredWidth, prioritizeMostInStock);
    }
  }, [sheets, scraps, settings, priority, preferredWidth, prioritizeMostInStock]);

  // Adicionar Peça
  const handleAddPiece = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const devStartMm = GeometryService.convertToMm(newDevStart, inputUnit);
    const devEndMm = isTrapezoidMode ? GeometryService.convertToMm(newDevEnd, inputUnit) : devStartMm;
    const lengthMm = GeometryService.convertToMm(newLength, inputUnit);

    if (devStartMm <= 0 || lengthMm <= 0) {
      alert('Informe desenvolvimento e comprimento válidos.');
      return;
    }

    const piece: CutPiece = {
      id: `p_${Date.now()}`,
      name: newName || `Peça ${pieces.length + 1}`,
      type: newType,
      devStart: devStartMm,
      devEnd: devEndMm,
      length: lengthMm,
      quantity: Math.max(1, newQuantity),
      material: newMaterial,
      thickness: newThickness,
    };

    const updatedPieces = [...pieces, piece];
    setPieces(updatedPieces);
    setNewName('');
    // Recalcula imediatamente para exibir a representação visual na hora
    runOptimizationWithPieces(updatedPieces);
  };

  // Remover Peça
  const handleRemovePiece = (id: string) => {
    const updated = pieces.filter((p) => p.id !== id);
    setPieces(updated);
    if (updated.length > 0) {
      runOptimizationWithPieces(updated);
    } else {
      setSolutions([]);
    }
  };

  // Limpar todas as peças
  const handleClearAllPieces = () => {
    setPieces([]);
    setSolutions([]);
  };

  // Predefinir valores rápidos de peças
  const handleSelectPreset = (preset: typeof PIECE_PRESETS[0]) => {
    setNewName(preset.name);
    setNewType(preset.type);
    setNewDevStart(preset.defaultDev);
    if (preset.defaultDevEnd && preset.defaultDevEnd !== preset.defaultDev) {
      setIsTrapezoidMode(true);
      setNewDevEnd(preset.defaultDevEnd);
    } else {
      setIsTrapezoidMode(false);
      setNewDevEnd(preset.defaultDev);
    }
  };

  // Dividir peças longas que excedem a guilhotina
  const handleSplitLongPieces = () => {
    let modified = false;
    const updated: CutPiece[] = [];
    const overlap = settings.spliceOverlapLength || 100;

    pieces.forEach((p) => {
      if (p.length > settings.maxCutLength) {
        modified = true;
        const modules = GeometryService.suggestSegmentSplit(
          p,
          settings.maxCutLength,
          overlap
        );
        modules.forEach((mod) => updated.push(mod));
      } else {
        updated.push(p);
      }
    });

    if (modified) {
      setPieces(updated);
      runOptimizationWithPieces(updated);
      alert(`Peças longas foram divididas simetricamente com transpasse de ${overlap / 10} cm para emenda!`);
    }
  };

  // Executar Otimização 2D ao clicar no grande botão azul
  const handleRunOptimization = () => {
    let piecesToUse = [...pieces];

    // Se o usuário tem valores válidos preenchidos no formulário (ex: digitou 9m e quantidade 11)
    const formDevStartMm = GeometryService.convertToMm(newDevStart, inputUnit);
    const formLengthMm = GeometryService.convertToMm(newLength, inputUnit);

    // Se a lista estiver vazia, adiciona a peça do formulário automaticamente!
    if (piecesToUse.length === 0 && formDevStartMm > 0 && formLengthMm > 0) {
      const devEndMm = isTrapezoidMode ? GeometryService.convertToMm(newDevEnd, inputUnit) : formDevStartMm;
      const piece: CutPiece = {
        id: `p_${Date.now()}`,
        name: newName || `Peça Personalizada (${formLengthMm}mm)`,
        type: newType,
        devStart: formDevStartMm,
        devEnd: devEndMm,
        length: formLengthMm,
        quantity: Math.max(1, newQuantity),
        material: newMaterial,
        thickness: newThickness,
      };
      piecesToUse = [piece];
      setPieces(piecesToUse);
    }

    if (piecesToUse.length === 0) {
      alert('Informe os dados da peça e clique em "Inserir Peça na Lista" ou preencha as dimensões para calcular.');
      return;
    }

    runOptimizationWithPieces(piecesToUse);
  };

  const selectedSolution = solutions[selectedSolutionIndex] || null;

  // Confirmar Ordem e Abater Estoque
  const handleConfirmAndExecute = () => {
    if (!selectedSolution) return;

    if (
      !confirm(
        `Deseja confirmar o corte da ordem "${orderName}"?\n\nIsso irá:\n• Abater ${selectedSolution.totalSheetsUsed} chapa(s) e ${selectedSolution.totalScrapsUsed} retalho(s) do estoque.\n• Cadastrar automaticamente as novas sobras aproveitáveis geradas.`
      )
    ) {
      return;
    }

    const order: CutOrder = {
      id: `ord_${Date.now()}`,
      orderNumber: orderName,
      title: orderName,
      customerName,
      status: 'cortada',
      pieces,
      priority,
      selectedSolution,
      machineSettings: settings,
      yieldPercentage: selectedSolution.yieldPercentage,
      createdAt: new Date().toISOString(),
      executedAt: new Date().toISOString(),
    };

    onExecuteOrder(order, selectedSolution);
    alert('Ordem executada e estoque atualizado com sucesso!');
  };

  const hasLongPieces = pieces.some((p) => p.length > settings.maxCutLength);

  return (
    <div className="space-y-6" id="cut-order-manager-view">
      {/* Cabeçalho da Ordem de Corte (Geometric Balance) */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
            Plano de Corte Recomendado
          </h1>
          <p className="text-slate-500 text-sm">
            {selectedSolution
              ? `Solução Otimizada: Prioridade em ${
                  selectedSolution.priority === 'use_scraps_first'
                    ? 'Aproveitamento de Retalhos'
                    : selectedSolution.priority === 'fewest_sheets'
                    ? 'Menor Número de Chapas'
                    : 'Máximo Rendimento (%)'
                }`
              : 'Configure as peças e execute a otimização matemática 2D'}
          </p>
        </div>

        {/* Métricas Topo */}
        {selectedSolution && (
          <div className="flex items-center gap-4 bg-white border border-slate-200 px-4 py-2 rounded-xl shadow-sm">
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-emerald-600">
                {selectedSolution.yieldPercentage}%
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eficiência</div>
            </div>
            <div className="h-10 w-px bg-slate-200 mx-1"></div>
            <div className="text-right text-slate-900">
              <div className="text-2xl font-mono font-bold">
                {GeometryService.formatAreaM2(selectedSolution.totalWasteAreaMm2)}
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Desperdício</div>
            </div>
          </div>
        )}
      </header>

      {/* Grid Principal: Painel Esquerdo (Peças/Entrada) e Painel Direito (Diagramas de Corte) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda: Peças da Ordem & Cadastro */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card de Identificação da Ordem */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Dados da Ordem
              </h2>
              <span className="text-[10px] font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">
                {pieces.reduce((acc, p) => acc + p.quantity, 0)} PEÇAS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Identificação / Nº:</label>
                <input
                  type="text"
                  value={orderName}
                  onChange={(e) => setOrderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Cliente / Obra:</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Estratégia de Otimização 2D:
                </label>
                <select
                  value={priority}
                  onChange={(e) => {
                    const newP = e.target.value as PriorityMode;
                    setPriority(newP);
                    if (pieces.length > 0) {
                      runOptimizationWithPieces(pieces, newP, preferredWidth, prioritizeMostInStock);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium px-3 py-2 rounded-lg focus:outline-none"
                >
                  <option value="most_stock_first">📦 Priorizar Chapa com Mais Estoque</option>
                  <option value="preferred_width">📏 Priorizar Largura Específica</option>
                  <option value="use_scraps_first">♻️ Priorizar Uso de Retalhos / Sobras</option>
                  <option value="max_yield">🎯 Máximo Rendimento Geral (%)</option>
                  <option value="fewest_sheets">▦ Menor Número de Chapas</option>
                  <option value="balanced">⚖️ Equilibrado (Custo-Benefício)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">
                  Largura Preferida da Chapa (mm):
                </label>
                <select
                  value={preferredWidth}
                  onChange={(e) => {
                    const w = parseFloat(e.target.value) || 0;
                    setPreferredWidth(w);
                    if (pieces.length > 0) {
                      runOptimizationWithPieces(pieces, priority, w, prioritizeMostInStock);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-medium px-3 py-2 rounded-lg focus:outline-none"
                >
                  <option value={0}>Todas as Larguras (Automático)</option>
                  {availableWidths.map((w) => (
                    <option key={w} value={w}>
                      Largura {w} mm (Cadastrada no Estoque)
                    </option>
                  ))}
                  {/* Padrões Industriais caso não haja no estoque */}
                  {!availableWidths.includes(1200) && <option value={1200}>Largura 1200 mm (Padrão)</option>}
                  {!availableWidths.includes(1000) && <option value={1000}>Largura 1000 mm (Padrão)</option>}
                  {!availableWidths.includes(1250) && <option value={1250}>Largura 1250 mm (Padrão)</option>}
                  {!availableWidths.includes(600) && <option value={600}>Largura 600 mm (Tira Meia-Chapa)</option>}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="text-xs text-slate-700">
                <strong className="block text-slate-900">Priorizar Maior Saldo em Estoque:</strong>
                <span className="text-[10px] text-slate-500">
                  Consome primeiro as bobinas/chapas que tiverem mais unidades ou metros disponíveis
                </span>
              </div>
              <input
                type="checkbox"
                checked={prioritizeMostInStock || priority === 'most_stock_first'}
                onChange={(e) => {
                  const val = e.target.checked;
                  setPrioritizeMostInStock(val);
                  if (pieces.length > 0) {
                    runOptimizationWithPieces(pieces, priority, preferredWidth, val);
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Lista de Peças Cadastradas (Geometric Balance Style) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Peças da Ordem ({pieces.length})
              </h2>

              <div className="flex items-center gap-2">
                {hasLongPieces && (
                  <button
                    type="button"
                    onClick={handleSplitLongPieces}
                    className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-2 py-1 rounded transition-colors"
                    title="Dividir peças com comprimento maior que a guilhotina em módulos"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Dividir Peças Longas</span>
                  </button>
                )}

                {pieces.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllPieces}
                    className="text-[10px] text-slate-400 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    title="Limpar todas as peças da lista"
                  >
                    Limpar Lista
                  </button>
                )}
              </div>
            </div>

            {pieces.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">
                Nenhuma peça adicionada. Preencha o formulário abaixo.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {pieces.map((piece) => {
                  const isTrapezoid = piece.devStart !== piece.devEnd;
                  const isExceeding = piece.length > settings.maxCutLength;

                  return (
                    <div
                      key={piece.id}
                      className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                        isTrapezoid
                          ? 'bg-blue-50/70 border-blue-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{piece.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              isTrapezoid
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {piece.quantity} unid.
                          </span>
                          {isExceeding && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold">
                              &gt; Guilhotina
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 font-mono">
                          {isTrapezoid ? (
                            <span className="text-blue-700 font-semibold italic">
                              {piece.devStart} &gt; {piece.devEnd} mm (Var) × {piece.length} mm
                            </span>
                          ) : (
                            <span>
                              {piece.devStart} × {piece.length} mm
                            </span>
                          )}
                          <span className="text-slate-400 ml-2">
                            • {piece.material} ({piece.thickness})
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemovePiece(piece.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remover peça"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formulário de Inclusão de Peça */}
          <form
            onSubmit={handleAddPiece}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                + Adicionar Peça
              </h3>
              <div className="flex items-center gap-1">
                {(['mm', 'cm', 'm'] as UnitType[]).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setInputUnit(u)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono ${
                      inputUnit === u
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Presets Rápidos */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Modelos de Calhas / Rufos:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PIECE_PRESETS.map((pr, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectPreset(pr)}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md border border-slate-200 transition-colors"
                  >
                    {pr.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Nome da Peça:</label>
                <input
                  type="text"
                  placeholder="Ex: Calha Frontal Beiral"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Botão de Modo Trapézio */}
              <div className="col-span-2 flex items-center justify-between p-2.5 bg-blue-50/60 rounded-lg border border-blue-200">
                <div className="text-xs text-blue-900">
                  <strong className="block">Peça Trapezoidal (Caimento):</strong>
                  <span className="text-[10px] text-blue-700">Desenvolvimento inicial diferente do final</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTrapezoidMode(!isTrapezoidMode)}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                    isTrapezoidMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  {isTrapezoidMode ? 'Ativado' : 'Desativado'}
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  {isTrapezoidMode ? `Desenv. Inicial (${inputUnit}):` : `Desenvolvimento / Largura (${inputUnit}):`}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={newDevStart}
                  onChange={(e) => setNewDevStart(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              {isTrapezoidMode ? (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Desenv. Final ({inputUnit}):
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newDevEnd}
                    onChange={(e) => setNewDevEnd(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Comprimento ({inputUnit}):
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLength}
                    onChange={(e) => setNewLength(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {isTrapezoidMode && (
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Comprimento ({inputUnit}):
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newLength}
                    onChange={(e) => setNewLength(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Aviso dinâmico de divisão com emenda / transpasse para peças > 7m */}
              {(() => {
                const curLengthMm = GeometryService.convertToMm(newLength, inputUnit);
                if (curLengthMm > settings.maxCutLength) {
                  const splice = GeometryService.calculateSpliceDetails(
                    curLengthMm,
                    settings.maxCutLength,
                    settings.spliceOverlapLength || 100
                  );
                  return (
                    <div className="col-span-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <span>Peça Maior que {settings.maxCutLength / 1000}m (Divisão Simétrica com Emenda):</span>
                      </div>
                      <p className="text-slate-700 leading-tight">
                        Para total de <strong>{(curLengthMm / 1000).toFixed(2)}m</strong>, serão produzidos <strong>{splice.segmentsCount} lances simétricos de {(splice.segmentLengthMm / 1000).toFixed(2)}m</strong> cada, com <strong>{(splice.overlapTotalMm / 10).toFixed(0)}cm</strong> de transpasse para emenda perfeita no meio.
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Quantidade:</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Material:</label>
                <select
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none"
                >
                  <option value="Galvanizado">Galvanizado</option>
                  <option value="Galvalume">Galvalume</option>
                  <option value="Alumínio">Alumínio</option>
                  <option value="Inox">Inox</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Inserir Peça na Lista</span>
            </button>
          </form>

          {/* Botão de Calcular Otimização 2D */}
          <button
            id="run-optimization-btn"
            type="button"
            disabled={pieces.length === 0 || isCalculating}
            onClick={handleRunOptimization}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black text-sm uppercase tracking-widest rounded-xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Play className={`w-4 h-4 fill-white ${isCalculating ? 'animate-spin' : ''}`} />
            <span>{isCalculating ? 'Calculando Otimização 2D...' : 'CALCULAR PLANO DE CORTE'}</span>
          </button>
        </div>

        {/* Coluna Direita: Resultados & Diagramas Visuais 2D */}
        <div className="lg:col-span-7 space-y-6">
          {solutions.length > 0 && selectedSolution ? (
            <div className="space-y-6">
              {/* Seletor das 3 Soluções Calculadas (Geometric Balance Style) */}
              <div className="grid grid-cols-3 gap-3">
                {solutions.map((sol, sIdx) => {
                  const isSelected = selectedSolutionIndex === sIdx;
                  return (
                    <div
                      key={sol.id}
                      onClick={() => setSelectedSolutionIndex(sIdx)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-50 border-2 border-blue-500 shadow-md'
                          : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {sIdx === 0 ? '🥇 Opção A' : sIdx === 1 ? '🥈 Opção B' : '🥉 Opção C'}
                        </span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600"></span>}
                      </div>

                      <div className="text-lg font-black text-slate-900 font-mono">
                        {sol.yieldPercentage}%
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        {sol.totalSheetsUsed} chapa(s) • {sol.totalScrapsUsed} retalho(s)
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Destaque para Cortes de Bobina / Rolo de 30-40 metros */}
              {selectedSolution.coilCutSuggestions && selectedSolution.coilCutSuggestions.length > 0 && (
                <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                    <span className="text-lg">🌀</span>
                    <span>Medida Calculada para Tirar do Rolo de Chapa (30 a 40m)</span>
                  </div>
                  <div className="space-y-2">
                    {selectedSolution.coilCutSuggestions.map((sug, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3 rounded-lg border border-indigo-200 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-900">
                            {sug.coilName} (Largura: {sug.width} mm)
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Peças agrupadas: {sug.piecesSummary}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-mono font-black text-indigo-700">
                            {(sug.cutLengthMm / 1000).toFixed(2)} metros
                          </div>
                          <div className="text-[10px] uppercase font-bold text-indigo-500">
                            Tamanho da Folha a Cortar
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-indigo-700 italic">
                    💡 O sistema calculou a folha exata a ser desenrolada do rolo contínuo, evitando desperdício de medidas fixas de 5m ou 6m.
                  </p>
                </div>
              )}

              {/* Diagramas Visuais SVG de Cada Chapa/Retalho Utilizado */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Chapas & Retalhos do Corte ({selectedSolution.plans.length})
                  </h3>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <button
                      onClick={() => ExportService.exportToPdf(orderName, customerName, selectedSolution)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5 text-xs"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>PDF Técnico</span>
                    </button>
                    <button
                      onClick={() => ExportService.exportToCsv(orderName, selectedSolution)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5 text-xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {selectedSolution.plans.map((plan, pIdx) => (
                  <VisualCutDiagram key={`plan-${plan.sheetId}-${pIdx}`} plan={plan} index={pIdx} />
                ))}
              </div>

              {/* 3 Blocos de Resumo Inferior (Geometric Balance Footer Grid) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Bloco 1: Retalhos Gerados */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                      Retalhos Gerados
                    </span>
                    <span className="text-lg font-mono font-bold text-amber-600">
                      +{selectedSolution.plans.reduce((acc, p) => acc + p.remnants.filter((r) => r.isUsable).length, 0)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 leading-tight space-y-0.5 mt-2">
                    {selectedSolution.plans
                      .flatMap((p) => p.remnants.filter((r) => r.isUsable))
                      .slice(0, 2)
                      .map((r, rIdx) => (
                        <p key={rIdx}>
                          {r.code}: {r.width}×{r.length}mm ({r.material})
                        </p>
                      ))}
                    {selectedSolution.plans.flatMap((p) => p.remnants.filter((r) => r.isUsable)).length === 0 && (
                      <p className="italic text-slate-400">Sem sobras reaproveitáveis significativas.</p>
                    )}
                  </div>
                  <div className="text-[10px] text-amber-700 font-bold uppercase mt-2">
                    Integradas automaticamente
                  </div>
                </div>

                {/* Bloco 2: Limite Máquina */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                    Limite Máquina
                  </span>
                  <div className="space-y-1.5 my-2">
                    <div className="flex items-center justify-between text-xs font-mono font-bold">
                      <span className="text-slate-600">Guilhotina</span>
                      <span className="text-slate-900">
                        {Math.max(...pieces.map((p) => p.length), 0)}mm / {settings.maxCutLength}mm
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-slate-800 h-full rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (Math.max(...pieces.map((p) => p.length), 0) / settings.maxCutLength) * 100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Capacidade operacional em conformidade.</p>
                </div>

                {/* Bloco 3: Confirmar Corte (Escuro) */}
                <div className="bg-slate-900 rounded-lg p-4 flex flex-col justify-between text-white shadow-md">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                      Próximo Passo
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-xs text-slate-300 leading-tight my-2">
                    Gerar PDF da sequência de corte e atualizar inventário de chapas e sobras.
                  </p>
                  <button
                    onClick={handleConfirmAndExecute}
                    className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors active:scale-95"
                  >
                    CONFIRMAR CORTE
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Scissors className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold text-slate-900 uppercase">
                  Pronto para Otimização 2D
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Adicione as peças desejadas à lista e clique no botão azul <strong>"Calcular Plano de Corte"</strong> para visualizar os diagramas em escala, o aproveitamento geométrico e a sequência de guilhotina.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
