import React, { useState, useEffect } from 'react';
import {
  CutOrder,
  CutPiece,
  MachineSettings,
  OptimizationSolution,
  PieceType,
  PriorityMode,
  ScrapItem,
  SheetCutPlan,
  SheetItem,
  UnitType,
} from '../types';
import { CutOptimizationService } from '../services/CutOptimizationService';
import { GeometryService } from '../services/GeometryService';
import { ExportService } from '../services/ExportService';
import { AiCuttingService, AiOptimizationResult } from '../services/AiCuttingService';
import { StorageService } from '../services/StorageService';
import { FirebaseStorageService } from '../services/FirebaseStorageService';
import { VisualCutDiagram } from './VisualCutDiagram';
import { PhotoImportModal } from './PhotoImportModal';
import { SavedPlansModal } from './SavedPlansModal';
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
  Camera,
  Save,
  FolderOpen,
  Pencil,
  Copy,
  Check,
  X,
  FileText,
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

  // Estado de Edição de Peça Específica
  const [editingPieceId, setEditingPieceId] = useState<string | null>(null);

  // Modais de IA e Planos Salvos
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isSavedPlansModalOpen, setIsSavedPlansModalOpen] = useState(false);
  const [savedOrders, setSavedOrders] = useState<CutOrder[]>(() => StorageService.getOrders());
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  // Parâmetros de Otimização
  const [priority, setPriority] = useState<PriorityMode>(settings.defaultPriority || 'use_scraps_first');
  const [preferredWidth, setPreferredWidth] = useState<number>(settings.preferredWidth || 0);
  const [prioritizeMostInStock, setPrioritizeMostInStock] = useState<boolean>(settings.prioritizeMostInStock || false);
  const [customSafetyMargin, setCustomSafetyMargin] = useState<number>(settings.safetyMargin !== undefined ? settings.safetyMargin : 0);
  const [customKerf, setCustomKerf] = useState<number>(settings.kerf !== undefined ? settings.kerf : 0);
  const [orderName, setOrderName] = useState('Ordem de Corte #001');
  const [customerName, setCustomerName] = useState('');

  // Input de Nova Peça / Edição
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<PieceType>('calha_platibanda');
  const [newDevStart, setNewDevStart] = useState<string | number>(500);
  const [newDevEnd, setNewDevEnd] = useState<string | number>(500);
  const [newLength, setNewLength] = useState<string | number>(3000);
  const [newQuantity, setNewQuantity] = useState<string | number>(1);
  const [newMaterial, setNewMaterial] = useState('Galvanizado');
  const [newThickness, setNewThickness] = useState('0.50mm');
  const [inputUnit, setInputUnit] = useState<UnitType>('mm');
  const [isTrapezoidMode, setIsTrapezoidMode] = useState(false);

  // Helper para converter string/number com suporte a vírgula e campo vazio
  const parseNumInput = (val: string | number, fallback = 0): number => {
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    if (!val || typeof val !== 'string' || val.trim() === '') return fallback;
    const clean = val.replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? fallback : parsed;
  };

  // Soluções Calculadas
  const [solutions, setSolutions] = useState<OptimizationSolution[]>([]);
  const [selectedSolutionIndex, setSelectedSolutionIndex] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [aiResult, setAiResult] = useState<AiOptimizationResult | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Sincronização em tempo real das ordens salvas
  useEffect(() => {
    const unsub = FirebaseStorageService.subscribeToOrders((updatedOrders) => {
      setSavedOrders(updatedOrders);
    });
    return () => unsub();
  }, []);

  const showToast = (msg: string) => {
    setNotificationToast(msg);
    setTimeout(() => {
      setNotificationToast((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Executar Otimização com IA Gemini
  const handleAiOptimization = async () => {
    if (pieces.length === 0) return;
    setIsLoadingAi(true);
    try {
      const result = await AiCuttingService.requestAiOptimization(pieces, sheets, scraps, settings);
      setAiResult(result);
    } catch (err) {
      console.error('Erro na análise de IA Gemini:', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

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
    optMostStock = prioritizeMostInStock,
    optMargin = customSafetyMargin,
    optKerf = customKerf
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
          safetyMargin: optMargin,
          kerf: optKerf,
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

  // Calcula na inicialização e quando as chapas/retalhos/peças/margens mudarem
  React.useEffect(() => {
    if (pieces.length > 0) {
      runOptimizationWithPieces(pieces, priority, preferredWidth, prioritizeMostInStock, customSafetyMargin, customKerf);
    }
  }, [sheets, scraps, settings, priority, preferredWidth, prioritizeMostInStock, customSafetyMargin, customKerf]);

  // Iniciar Edição de Peça Específica
  const handleStartEditPiece = (piece: CutPiece) => {
    setEditingPieceId(piece.id);
    setNewName(piece.name);
    setNewType(piece.type);
    setNewDevStart(piece.devStart);
    setNewDevEnd(piece.devEnd);
    setNewLength(piece.length);
    setNewQuantity(piece.quantity);
    setNewMaterial(piece.material || 'Galvanizado');
    setNewThickness(piece.thickness || '0.50mm');
    setIsTrapezoidMode(piece.devStart !== piece.devEnd);
    setInputUnit('mm');

    // Rola suavemente até o formulário
    const formElement = document.getElementById('piece-input-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Cancelar Edição de Peça
  const handleCancelEditPiece = () => {
    setEditingPieceId(null);
    setNewName('');
    setNewDevStart(500);
    setNewDevEnd(500);
    setNewLength(3000);
    setNewQuantity(1);
    setIsTrapezoidMode(false);
  };

  // Adicionar ou Salvar Edição de Peça
  const handleAddOrSavePiece = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const devStartVal = parseNumInput(newDevStart, 0);
    const devEndVal = isTrapezoidMode ? parseNumInput(newDevEnd, 0) : devStartVal;
    const lengthVal = parseNumInput(newLength, 0);
    const quantityVal = Math.max(1, parseNumInput(newQuantity, 1));

    const devStartMm = GeometryService.convertToMm(devStartVal, inputUnit);
    const devEndMm = GeometryService.convertToMm(devEndVal, inputUnit);
    const lengthMm = GeometryService.convertToMm(lengthVal, inputUnit);

    if (devStartMm <= 0 || lengthMm <= 0) {
      alert('Informe desenvolvimento e comprimento válidos maiores que zero.');
      return;
    }

    if (editingPieceId) {
      // Modo Edição: Atualiza a peça existente
      const updatedPieces = pieces.map((p) =>
        p.id === editingPieceId
          ? {
              ...p,
              name: newName || p.name,
              type: newType,
              devStart: devStartMm,
              devEnd: devEndMm,
              length: lengthMm,
              quantity: quantityVal,
              material: newMaterial,
              thickness: newThickness,
            }
          : p
      );
      setPieces(updatedPieces);
      setEditingPieceId(null);
      setNewName('');
      runOptimizationWithPieces(updatedPieces);
      showToast(`Peça "${newName || 'atualizada'}" salva com sucesso!`);
    } else {
      // Modo Criação: Adiciona nova peça
      const piece: CutPiece = {
        id: `p_${Date.now()}`,
        name: newName || `Peça ${pieces.length + 1}`,
        type: newType,
        devStart: devStartMm,
        devEnd: devEndMm,
        length: lengthMm,
        quantity: quantityVal,
        material: newMaterial,
        thickness: newThickness,
      };

      const updatedPieces = [...pieces, piece];
      setPieces(updatedPieces);
      setNewName('');
      runOptimizationWithPieces(updatedPieces);
    }
  };

  // Importar Peças lidas por IA a partir de Foto/Croqui
  const handleImportPiecesFromPhoto = (importedPieces: CutPiece[]) => {
    if (!importedPieces || importedPieces.length === 0) return;
    const updated = [...pieces, ...importedPieces];
    setPieces(updated);
    runOptimizationWithPieces(updated);
    showToast(`✓ ${importedPieces.length} peça(s) extraída(s) da foto e adicionadas ao plano!`);
  };

  // Salvar Plano de Corte para Continuar Depois (Persistência)
  const handleSavePlanForLater = async () => {
    if (pieces.length === 0) {
      alert('Adicione pelo menos uma peça antes de salvar o plano de corte.');
      return;
    }

    const currentSolution = solutions[selectedSolutionIndex] || null;
    const orderIdToUse = currentOrderId || `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const orderToSave: CutOrder = {
      id: orderIdToUse,
      orderNumber: orderName || `Plano #${Date.now().toString().slice(-4)}`,
      title: orderName || 'Plano de Corte Personalizado',
      customerName: customerName || 'Cliente Balcão',
      status: 'planejamento',
      pieces: pieces,
      priority: priority,
      machineSettings: settings,
      selectedSolution: currentSolution || undefined,
      yieldPercentage: currentSolution ? currentSolution.yieldPercentage : undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      await FirebaseStorageService.saveOrder(orderToSave);
      setCurrentOrderId(orderIdToUse);
      setSavedOrders(StorageService.getOrders());
      showToast(`💾 Plano "${orderToSave.title}" salvo com sucesso! Você pode continuar a qualquer momento.`);
    } catch (err) {
      console.error('Erro ao salvar plano:', err);
      showToast('Plano salvo localmente!');
    }
  };

  // Carregar Plano Salvo para Continuar
  const handleLoadSavedPlan = (order: CutOrder) => {
    setCurrentOrderId(order.id);
    setOrderName(order.title || order.orderNumber || 'Plano Carregado');
    setCustomerName(order.customerName || '');
    setPieces(order.pieces || []);
    setEditingPieceId(null);

    if (order.selectedSolution && order.selectedSolution.plans) {
      setSolutions([order.selectedSolution]);
      setSelectedSolutionIndex(0);
    } else if (order.pieces && order.pieces.length > 0) {
      runOptimizationWithPieces(order.pieces);
    }

    showToast(`📂 Plano "${order.title || order.orderNumber}" carregado com sucesso!`);
  };

  // Excluir Plano Salvo
  const handleDeleteSavedPlan = async (orderId: string) => {
    try {
      await FirebaseStorageService.deleteOrder(orderId);
      setSavedOrders(StorageService.getOrders());
      if (currentOrderId === orderId) {
        setCurrentOrderId(null);
      }
      showToast('Plano excluído.');
    } catch (err) {
      console.error('Erro ao excluir:', err);
    }
  };

  // Duplicar Plano Salvo
  const handleDuplicateSavedPlan = async (order: CutOrder) => {
    const duplicatedOrder: CutOrder = {
      ...order,
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: `${order.title || order.orderNumber} (Cópia)`,
      orderNumber: `${order.orderNumber} (Cópia)`,
      createdAt: new Date().toISOString(),
    };

    try {
      await FirebaseStorageService.saveOrder(duplicatedOrder);
      setSavedOrders(StorageService.getOrders());
      showToast(`Plano duplicado com sucesso!`);
    } catch (err) {
      console.error('Erro ao duplicar:', err);
    }
  };

  // Iniciar Novo Plano Limpo do Zero
  const handleNewPlan = () => {
    setPieces([]);
    setSolutions([]);
    setCurrentOrderId(null);
    setOrderName(`Ordem de Corte #${(savedOrders.length + 1).toString().padStart(3, '0')}`);
    setCustomerName('');
    setEditingPieceId(null);
    setAiResult(null);
    showToast('Novo plano em branco pronto para edição.');
  };

  // Remover Peça
  const handleRemovePiece = (id: string) => {
    if (editingPieceId === id) {
      handleCancelEditPiece();
    }
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
    setEditingPieceId(null);
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
    const formDevStartMm = GeometryService.convertToMm(parseNumInput(newDevStart, 0), inputUnit);
    const formLengthMm = GeometryService.convertToMm(parseNumInput(newLength, 0), inputUnit);

    // Se a lista estiver vazia, adiciona a peça do formulário automaticamente!
    if (piecesToUse.length === 0 && formDevStartMm > 0 && formLengthMm > 0) {
      const devEndMm = isTrapezoidMode ? GeometryService.convertToMm(parseNumInput(newDevEnd, 0), inputUnit) : formDevStartMm;
      const piece: CutPiece = {
        id: `p_${Date.now()}`,
        name: newName || `Peça Personalizada (${formLengthMm}mm)`,
        type: newType,
        devStart: formDevStartMm,
        devEnd: devEndMm,
        length: formLengthMm,
        quantity: Math.max(1, parseNumInput(newQuantity, 1)),
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

  const handlePlanUpdated = (planIndex: number, updatedPlan: SheetCutPlan) => {
    if (!selectedSolution) return;
    const updatedPlans = [...selectedSolution.plans];
    updatedPlans[planIndex] = updatedPlan;

    // Recalcula totais da solução com base no ajuste manual
    let totalUsed = 0;
    let totalSheet = 0;
    let totalWaste = 0;
    for (const p of updatedPlans) {
      totalUsed += p.usedAreaMm2;
      totalSheet += p.totalAreaMm2;
      totalWaste += p.wasteAreaMm2;
    }
    const newYield = totalSheet > 0 ? Math.round((totalUsed / totalSheet) * 1000) / 10 : 0;

    const updatedSolution: OptimizationSolution = {
      ...selectedSolution,
      plans: updatedPlans,
      yieldPercentage: newYield,
      totalWasteAreaMm2: totalWaste,
    };

    const updatedSolutions = [...solutions];
    updatedSolutions[selectedSolutionIndex] = updatedSolution;
    setSolutions(updatedSolutions);
  };

  const hasLongPieces = pieces.some((p) => p.length > settings.maxCutLength);

  return (
    <div className="space-y-6" id="cut-order-manager-view">
      {/* Toast de Notificação */}
      {notificationToast && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700 text-xs font-semibold flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{notificationToast}</span>
        </div>
      )}

      {/* Cabeçalho da Ordem de Corte (Geometric Balance) */}
      <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
              Plano de Corte Recomendado
            </h1>
            {currentOrderId && (
              <span className="text-[10px] font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                Editando Plano Salvo
              </span>
            )}
          </div>
          <p className="text-slate-500 text-sm">
            {selectedSolution
              ? `Solução Otimizada: Prioridade em ${
                  selectedSolution.priority === 'use_scraps_first'
                    ? 'Aproveitamento de Retalhos'
                    : selectedSolution.priority === 'fewest_sheets'
                    ? 'Menor Número de Chapas'
                    : 'Máximo Rendimento (%)'
                }`
              : 'Configure as peças, use IA para ler croquis e execute a otimização matemática 2D'}
          </p>
        </div>

        {/* Ações de Gestão de Planos & Métricas Topo */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleNewPlan}
            className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            title="Iniciar novo plano em branco"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Plano</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSavedPlansModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
            title="Abrir lista de planos de corte salvos"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-600" />
            <span>Planos Salvos ({savedOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={handleSavePlanForLater}
            disabled={pieces.length === 0}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95"
            title="Salvar rascunho deste plano de corte para continuar o trabalho depois"
          >
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span>Salvar Plano (Continuar Depois)</span>
          </button>

          {selectedSolution && (
            <div className="flex items-center gap-3 bg-white border border-slate-200 px-3.5 py-1.5 rounded-xl shadow-sm ml-1">
              <div className="text-right">
                <div className="text-xl font-mono font-bold text-emerald-600 leading-tight">
                  {selectedSolution.yieldPercentage}%
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Eficiência</div>
              </div>
              <div className="h-8 w-px bg-slate-200"></div>
              <div className="text-right text-slate-900">
                <div className="text-xl font-mono font-bold leading-tight">
                  {GeometryService.formatAreaM2(selectedSolution.totalWasteAreaMm2)}
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Desperdício</div>
              </div>
            </div>
          )}
        </div>
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
                    runOptimizationWithPieces(pieces, priority, preferredWidth, val, customSafetyMargin, customKerf);
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
              />
            </div>

            {/* Controle Rápido de Margem de Segurança & Perda da Lâmina */}
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Margem de Segurança & Borda</span>
                  <span className="text-[10px] text-slate-500">
                    Ajuste ou anule a margem para encaixe 100% sem desperdício
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomSafetyMargin(0);
                    setCustomKerf(0);
                    if (pieces.length > 0) {
                      runOptimizationWithPieces(pieces, priority, preferredWidth, prioritizeMostInStock, 0, 0);
                    }
                  }}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    customSafetyMargin === 0 && customKerf === 0
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Anula margens e perdas para permitir aproveitamento de 100% da bobina"
                >
                  ⚡ Margem Zero (100% Útil)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Margem de Borda:
                  </label>
                  <select
                    value={customSafetyMargin}
                    onChange={(e) => {
                      const m = parseFloat(e.target.value) || 0;
                      setCustomSafetyMargin(m);
                      if (pieces.length > 0) {
                        runOptimizationWithPieces(pieces, priority, preferredWidth, prioritizeMostInStock, m, customKerf);
                      }
                    }}
                    className="w-full bg-white border border-slate-300 text-xs font-bold text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>0 mm (Anulada • Cravado)</option>
                    <option value={1}>1 mm</option>
                    <option value={2}>2 mm</option>
                    <option value={3}>3 mm</option>
                    <option value={5}>5 mm (Padrão Antigo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Perda de Corte (Kerf):
                  </label>
                  <select
                    value={customKerf}
                    onChange={(e) => {
                      const k = parseFloat(e.target.value) || 0;
                      setCustomKerf(k);
                      if (pieces.length > 0) {
                        runOptimizationWithPieces(pieces, priority, preferredWidth, prioritizeMostInStock, customSafetyMargin, k);
                      }
                    }}
                    className="w-full bg-white border border-slate-300 text-xs font-bold text-slate-900 px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>0 mm (Guilhotina / Faca)</option>
                    <option value={1}>1 mm</option>
                    <option value={2}>2 mm</option>
                    <option value={3}>3 mm</option>
                  </select>
                </div>
              </div>

              <div className="text-[10px] text-blue-900 bg-white/70 border border-blue-100 rounded p-1.5 leading-tight">
                💡 <em>Dica:</em> Com <strong>Margem 0mm</strong>, duas peças de 25cm usam exatamente os 50cm da bobina com <strong>100% de aproveitamento</strong> e zero sobra.
              </div>
            </div>
          </div>

          {/* Lista de Peças Cadastradas (Geometric Balance Style) */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <span>Peças da Ordem ({pieces.length})</span>
                </h2>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Botão de Câmera / Foto IA Vision */}
                <button
                  type="button"
                  onClick={() => setIsPhotoModalOpen(true)}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95"
                  title="Fotografar croqui, anotação ou projeto de calha para a IA ler, calcular desenvolvimento e inserir na lista"
                >
                  <Camera className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Ler Foto / Croqui (IA)</span>
                </button>

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
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {pieces.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs space-y-3">
                <p>Nenhuma peça adicionada ainda.</p>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPhotoModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-200"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Tirar Foto de Croqui / Anotação</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {pieces.map((piece) => {
                  const isTrapezoid = piece.devStart !== piece.devEnd;
                  const isExceeding = piece.length > settings.maxCutLength;
                  const isBeingEdited = editingPieceId === piece.id;

                  return (
                    <div
                      key={piece.id}
                      className={`p-3 rounded-lg border flex items-center justify-between transition-all ${
                        isBeingEdited
                          ? 'bg-blue-100/90 border-blue-500 ring-2 ring-blue-400 shadow-sm'
                          : isTrapezoid
                          ? 'bg-blue-50/70 border-blue-200 hover:border-blue-300'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 truncate">{piece.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              isBeingEdited
                                ? 'bg-blue-600 text-white'
                                : isTrapezoid
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isBeingEdited ? 'EDITANDO' : `${piece.quantity} unid.`}
                          </span>
                          {isExceeding && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold">
                              &gt; Guilhotina
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 font-mono flex items-center flex-wrap gap-x-2">
                          {isTrapezoid ? (
                            <span className="text-blue-700 font-semibold italic">
                              {piece.devStart} &gt; {piece.devEnd} mm (Var) × {piece.length} mm
                            </span>
                          ) : (
                            <span>
                              {piece.devStart} × {piece.length} mm
                            </span>
                          )}
                          <span className="text-slate-400">
                            • {piece.material} ({piece.thickness})
                          </span>
                        </div>
                      </div>

                      {/* Botões de Ação na Peça (Editar + Excluir) */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditPiece(piece)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isBeingEdited
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                          }`}
                          title="Editar medidas e propriedades desta peça"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemovePiece(piece.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Remover peça da lista"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Formulário de Inclusão ou Edição de Peça */}
          <form
            id="piece-input-form"
            onSubmit={handleAddOrSavePiece}
            className={`border rounded-xl p-5 shadow-sm space-y-4 transition-all ${
              editingPieceId
                ? 'bg-blue-50/60 border-blue-400 ring-2 ring-blue-400/30'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
                  {editingPieceId ? (
                    <>
                      <Pencil className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-blue-700">Editar Peça Selecionada</span>
                    </>
                  ) : (
                    <span>+ Adicionar Nova Peça</span>
                  )}
                </h3>
                {editingPieceId && (
                  <span className="text-[10px] bg-blue-200 text-blue-800 font-bold px-2 py-0.5 rounded">
                    Modo Edição
                  </span>
                )}
              </div>

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
                  placeholder="Ex: Calha Moldura Platibanda"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 font-medium"
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
                  placeholder="0"
                  value={newDevStart}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewDevStart(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
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
                    placeholder="0"
                    value={newDevEnd}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewDevEnd(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
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
                    placeholder="0"
                    value={newLength}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewLength(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
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
                    placeholder="0"
                    value={newLength}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setNewLength(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                  />
                </div>
              )}

              {/* Aviso dinâmico de divisão com emenda / transpasse para peças > 7m */}
              {(() => {
                const curLengthMm = GeometryService.convertToMm(parseNumInput(newLength, 0), inputUnit);
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
                  step="1"
                  required
                  placeholder="1"
                  value={newQuantity}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Material:</label>
                <select
                  value={newMaterial}
                  onChange={(e) => setNewMaterial(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none font-medium"
                >
                  <option value="Galvanizado">Galvanizado</option>
                  <option value="Galvalume">Galvalume</option>
                  <option value="Alumínio">Alumínio</option>
                  <option value="Inox">Inox</option>
                </select>
              </div>
            </div>

            {/* Botões de Ação do Formulário */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className={`flex-1 py-2.5 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2 ${
                  editingPieceId
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {editingPieceId ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Salvar Alterações da Peça</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Inserir Peça na Lista</span>
                  </>
                )}
              </button>

              {editingPieceId && (
                <button
                  type="button"
                  onClick={handleCancelEditPiece}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          {/* Botões de Ação de Cálculo */}
          <div className="space-y-2">
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

            <button
              type="button"
              disabled={pieces.length === 0 || isLoadingAi}
              onClick={handleAiOptimization}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className={`w-4 h-4 ${isLoadingAi ? 'animate-spin' : ''}`} />
              <span>{isLoadingAi ? 'IA Gemini Analisando...' : '✨ Otimizar & Diagnosticar com IA Gemini'}</span>
            </button>
          </div>
        </div>

        {/* Coluna Direita: Resultados & Diagramas Visuais 2D */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card de Diagnóstico Inteligente com IA Gemini */}
          {aiResult && aiResult.success && (
            <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-blue-950 text-white rounded-2xl p-5 shadow-xl border border-indigo-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-400/30">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-white">Diagnóstico & Estratégia de Corte (IA Gemini)</h4>
                    <p className="text-[11px] text-indigo-200">Recomendação técnica baseada em geometria de calharia</p>
                  </div>
                </div>
                <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/40 rounded-full text-emerald-300 font-mono text-xs font-black">
                  {aiResult.estimatedYieldPercentage}% Rendimento
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/5 border border-white/10 rounded-xl p-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Bobina Recomendada</span>
                  <span className="text-sm font-bold text-indigo-300 font-mono">Bobina {aiResult.bestCoilWidthCm} cm</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Desenrolar do Rolo</span>
                  <span className="text-sm font-bold text-white font-mono">{aiResult.unrollLengthMeters.toFixed(2)} metros</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Sobra Lateral Residual</span>
                  <span className="text-sm font-bold text-amber-300 font-mono">{aiResult.lateralWasteCm} cm</span>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 block">
                    📐 Distribuição de Tiras na Largura (Uma embaixo da outra)
                  </span>
                  <p className="text-slate-200 text-xs leading-relaxed">{aiResult.stripStackingExplanation}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                    ✂️ Passos Práticos para a Guilhotina
                  </span>
                  <ul className="space-y-1 text-slate-200">
                    {aiResult.guillotineStepByStep.map((step, sIdx) => (
                      <li key={sIdx} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold font-mono text-[11px]">{sIdx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {solutions.length > 0 && selectedSolution ? (
            <div className="space-y-6">
              {/* Cabeçalho de Seleção de Opções com Teste de Todas as Bobinas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Opções de Corte Calculadas ({solutions.length} alternativas)</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Testadas bobinas de 30cm a 1,20m
                  </span>
                </div>

                {/* Seletor das Soluções Calculadas */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${solutions.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3`}>
                  {solutions.map((sol, sIdx) => {
                    const isSelected = selectedSolutionIndex === sIdx;
                    const primaryWidth = sol.primaryWidthMm
                      ? `${sol.primaryWidthMm / 10} cm`
                      : `${sol.plans[0]?.width / 10} cm`;
                    const meters = sol.totalLengthCutMeters || Math.round((sol.plans.reduce((acc, p) => acc + p.length, 0) / 1000) * 100) / 100;
                    const wasteCm = sol.lateralWasteMm !== undefined
                      ? `${(sol.lateralWasteMm / 10).toFixed(1)} cm`
                      : 'mínima';

                    return (
                      <div
                        key={sol.id}
                        onClick={() => setSelectedSolutionIndex(sIdx)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between relative ${
                          isSelected
                            ? 'bg-blue-50 border-2 border-blue-600 shadow-md ring-1 ring-blue-500/30'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              sIdx === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {sIdx === 0 ? '🥇 Opção 1 (Melhor)' : sIdx === 1 ? '🥈 Opção 2' : sIdx === 2 ? '🥉 Opção 3' : `Opção ${sIdx + 1}`}
                            </span>
                            {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>}
                          </div>

                          <div className="font-bold text-xs text-slate-900 flex items-center gap-1">
                            <span>Bobina {primaryWidth}</span>
                          </div>

                          <div className="text-[11px] text-slate-600 font-mono mt-1 space-y-0.5">
                            <div>Desenrolar: <strong className="text-slate-900">{meters.toFixed(2)}m</strong></div>
                            <div>Sobra lateral: <strong className="text-amber-700">{wasteCm}</strong></div>
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Rendimento</span>
                          <span className={`text-base font-black font-mono ${
                            sol.yieldPercentage >= 85 ? 'text-emerald-600' : sol.yieldPercentage >= 70 ? 'text-blue-600' : 'text-slate-700'
                          }`}>
                            {sol.yieldPercentage}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comparativo Completo de Todas as Larguras de Bobinas Testadas (30cm a 1,20m) */}
              {selectedSolution.allTestedWidthsComparison && selectedSolution.allTestedWidthsComparison.length > 0 && (
                <details className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm text-xs group">
                  <summary className="cursor-pointer font-bold text-slate-700 flex items-center justify-between select-none">
                    <span className="flex items-center gap-2">
                      <span>📊</span>
                      <span>Ver Comparativo de Todas as Larguras Testadas (30cm, 40cm, 50cm, 60cm, 70cm, 80cm, 90cm, 1m, 1.20m)</span>
                    </span>
                    <span className="text-[10px] text-blue-600 font-bold group-open:hidden">+ Expandir</span>
                  </summary>

                  <div className="mt-3 pt-3 border-t border-slate-200 overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-400 font-mono">
                          <th className="pb-1.5 font-bold">Largura Bobina</th>
                          <th className="pb-1.5 font-bold">Status</th>
                          <th className="pb-1.5 font-bold">Desenrolar (m)</th>
                          <th className="pb-1.5 font-bold">Sobra Lateral</th>
                          <th className="pb-1.5 font-bold text-right">Rendimento</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {selectedSolution.allTestedWidthsComparison.map((comp) => {
                          const isCurrent = selectedSolution.primaryWidthMm === comp.widthMm;
                          return (
                            <tr
                              key={comp.widthMm}
                              className={`hover:bg-slate-100/80 transition-colors ${
                                isCurrent ? 'bg-blue-50/80 font-bold text-blue-900' : 'text-slate-700'
                              }`}
                            >
                              <td className="py-2 font-mono font-bold">
                                {comp.widthCm} cm ({comp.widthMm} mm)
                                {isCurrent && <span className="ml-1.5 text-[9px] px-1.5 py-0.2 bg-blue-600 text-white rounded font-sans">Selecionada</span>}
                              </td>
                              <td className="py-2">
                                {comp.feasible ? (
                                  <span className="text-emerald-700 font-bold text-[11px]">✓ Viável</span>
                                ) : (
                                  <span className="text-red-500 text-[10px] italic">Inviável</span>
                                )}
                              </td>
                              <td className="py-2 font-mono">
                                {comp.feasible ? `${comp.metersToUnroll.toFixed(2)}m` : '-'}
                              </td>
                              <td className="py-2 font-mono text-amber-800">
                                {comp.feasible ? `${comp.lateralWasteCm} cm` : '-'}
                              </td>
                              <td className="py-2 text-right font-mono font-bold">
                                {comp.feasible ? (
                                  <span className={comp.yieldPercentage >= 85 ? 'text-emerald-600' : 'text-slate-700'}>
                                    {comp.yieldPercentage}%
                                  </span>
                                ) : (
                                  '-'
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}

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
                  <VisualCutDiagram
                    key={`plan-${plan.sheetId}-${pIdx}`}
                    plan={plan}
                    index={pIdx}
                    onUpdatePlan={(updatedPlan) => handlePlanUpdated(pIdx, updatedPlan)}
                  />
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

      {/* Modal de Importação com Leitura de Foto / Croqui por IA Vision */}
      <PhotoImportModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onImportPieces={handleImportPiecesFromPhoto}
      />

      {/* Modal de Gestão de Planos de Corte Salvos (Continuar Depois) */}
      <SavedPlansModal
        isOpen={isSavedPlansModalOpen}
        onClose={() => setIsSavedPlansModalOpen(false)}
        savedOrders={savedOrders}
        currentOrderId={currentOrderId}
        onLoadOrder={handleLoadSavedPlan}
        onDeleteOrder={handleDeleteSavedPlan}
        onDuplicateOrder={handleDuplicateSavedPlan}
        onNewOrder={handleNewPlan}
      />
    </div>
  );
};
