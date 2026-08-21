import React, { useState, useRef, useEffect } from 'react';
import { SheetCutPlan, PlacedPiece, RemnantArea, SheetItem, ScrapItem, MachineSettings } from '../types';
import { GeometryService } from '../services/GeometryService';
import { CutOptimizationService, StockCandidate, STANDARD_COMMERCIAL_WIDTHS } from '../services/CutOptimizationService';
import {
  Scissors,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Maximize2,
  Minimize2,
  Compass,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

interface Props {
  plan: SheetCutPlan;
  index: number;
  availableSheets?: SheetItem[];
  availableScraps?: ScrapItem[];
  machineSettings?: MachineSettings;
  onUpdatePlan?: (updatedPlan: SheetCutPlan) => void;
}

// Cores técnicas de alta visibilidade e contraste para cada peça (Geometric Balance Theme)
const PIECE_COLORS = [
  { fill: 'rgba(59, 130, 246, 0.25)', stroke: '#2563eb', text: '#1e3a8a', name: 'Azul' },
  { fill: 'rgba(16, 185, 129, 0.25)', stroke: '#059669', text: '#064e3b', name: 'Verde' },
  { fill: 'rgba(245, 158, 11, 0.25)', stroke: '#d97706', text: '#78350f', name: 'Âmbar' },
  { fill: 'rgba(139, 92, 246, 0.25)', stroke: '#7c3aed', text: '#4c1d95', name: 'Roxo' },
  { fill: 'rgba(236, 72, 153, 0.25)', stroke: '#db2777', text: '#831843', name: 'Rosa' },
  { fill: 'rgba(6, 182, 212, 0.25)', stroke: '#0891b2', text: '#164e63', name: 'Ciano' },
];

const DEFAULT_MACHINE_SETTINGS: MachineSettings = {
  maxCutLength: 7000,
  spliceOverlapLength: 100,
  autoSplitLongPieces: true,
  allowCoilCustomCut: true,
  supportCoilRolls: true,
  kerf: 0,
  safetyMargin: 0,
  minSpacing: 0,
  scrapMinLength: 400,
  scrapMinWidth: 150,
  defaultPriority: 'max_yield',
  defaultUnit: 'mm',
  preferredWidth: 0,
  prioritizeMostInStock: true,
};

export const VisualCutDiagram: React.FC<Props> = ({
  plan,
  index,
  availableSheets = [],
  availableScraps = [],
  machineSettings = DEFAULT_MACHINE_SETTINGS,
  onUpdatePlan,
}) => {
  // Estado local do plano para permitir ajustes manuais interativos
  const [currentPlan, setCurrentPlan] = useState<SheetCutPlan>(plan);
  const [originalPlan] = useState<SheetCutPlan>(JSON.parse(JSON.stringify(plan)));

  // Modal / Dropdown de troca de bobina
  const [showCoilSelector, setShowCoilSelector] = useState<boolean>(false);

  // Atualiza se o prop mudar externamente (ex: novo cálculo)
  useEffect(() => {
    setCurrentPlan(plan);
  }, [plan]);

  const [zoom, setZoom] = useState(1);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [isManualEditMode, setIsManualEditMode] = useState<boolean>(false);
  const [sheetRotation, setSheetRotation] = useState<number>(0); // 0, 45, 90, 180
  const [stepSizeMm, setStepSizeMm] = useState<number>(5); // Passo de micro-ajuste: 1, 5, 10, 50mm

  // Se o tamanho da chapa/bobina acompanha automaticamente o ajuste das peças
  const isCoil = currentPlan.isCoilCut || currentPlan.stockCategory === 'rolo' || currentPlan.stockCategory === 'sugestao_compra';
  const [autoFitLength, setAutoFitLength] = useState<boolean>(true);
  const [manualSheetLengthInput, setManualSheetLengthInput] = useState<string>(String(currentPlan.length));

  // Sincroniza input de comprimento se o plano mudar
  useEffect(() => {
    setManualSheetLengthInput(String(currentPlan.length));
  }, [currentPlan.length]);

  // Lista de Bobinas do Estoque do Usuário + Opções Comerciais Padrão
  const userStockCoils = availableSheets.filter((s) => s.isCoil || s.length >= 20000);
  const distinctStockWidths = Array.from(new Set(userStockCoils.map((s) => s.width))).sort((a, b) => a - b);

  // Manipulador de Troca de Bobina
  const handleSelectCoilWidth = (targetWidthMm: number, stockItem?: SheetItem) => {
    setShowCoilSelector(false);

    const maxPieceWidth = Math.max(
      ...currentPlan.placedPieces.map((p) => Math.max(p.devStart, p.devEnd || p.devStart))
    );

    if (maxPieceWidth > targetWidthMm) {
      alert(
        `Atenção: A maior peça desta folha requer ${maxPieceWidth} mm (${maxPieceWidth / 10} cm) de largura. A bobina de ${targetWidthMm / 10} cm não suporta essa largura sem cortar a peça.`
      );
      return;
    }

    const targetStockCandidate: StockCandidate = stockItem
      ? {
          id: stockItem.id,
          code: `ROLO-${stockItem.width}`,
          name: stockItem.name || `Bobina ${stockItem.width}mm (${stockItem.width / 10}cm)`,
          isScrap: false,
          width: stockItem.width,
          length: stockItem.length || 50000,
          material: stockItem.material || currentPlan.material,
          thickness: stockItem.thickness || currentPlan.thickness,
          availableQty: stockItem.quantity || 1,
          isCoil: true,
          coilRemainingLength: stockItem.coilRemainingLength || stockItem.length || 50000,
          isFromUserStock: true,
          stockCategory: 'rolo',
        }
      : {
          id: `custom_coil_${targetWidthMm}`,
          code: `ROLO-${targetWidthMm}`,
          name: `Bobina ${targetWidthMm} mm (${targetWidthMm / 10} cm)`,
          isScrap: false,
          width: targetWidthMm,
          length: 50000,
          material: currentPlan.material,
          thickness: currentPlan.thickness,
          availableQty: 1,
          isCoil: true,
          coilRemainingLength: 50000,
          isFromUserStock: userStockCoils.some((c) => c.width === targetWidthMm),
          stockCategory: userStockCoils.some((c) => c.width === targetWidthMm) ? 'rolo' : 'sugestao_compra',
        };

    const repackedPlan = CutOptimizationService.repackPiecesOnStockCandidate(
      currentPlan.placedPieces,
      targetStockCandidate,
      machineSettings
    );

    if (repackedPlan) {
      setCurrentPlan(repackedPlan);
      if (onUpdatePlan) {
        onUpdatePlan(repackedPlan);
      }
    } else {
      // Fallback: altera a largura da chapa mantendo as posições
      applyPiecesUpdate(currentPlan.placedPieces, undefined, targetWidthMm);
    }
  };

  // Estado de Arraste (Drag and Drop)
  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [pieceStartPos, setPieceStartPos] = useState<{ x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const svgWidth = 900;
  const scale = svgWidth / currentPlan.length;

  // Peça atualmente selecionada
  const selectedPiece = currentPlan.placedPieces.find((p) => p.pieceId === selectedPieceId);

  // Recalcula áreas, sobras e rendimento quando posições mudam (com tamanho de chapa dinâmico)
  const recalculatePlanMetrics = (
    updatedPieces: PlacedPiece[],
    overrideLength?: number,
    overrideWidth?: number
  ): SheetCutPlan => {
    let usedAreaMm2 = 0;
    for (const p of updatedPieces) {
      usedAreaMm2 += GeometryService.calculatePieceAreaMm2(p);
    }

    let maxY = 0;
    let maxX = 0;

    for (const p of updatedPieces) {
      const pieceDev = Math.max(p.devStart, p.devEnd);
      const pieceH = (p.rotation === 90 || p.rotation === 270) ? p.length : pieceDev;
      const pieceL = (p.rotation === 90 || p.rotation === 270) ? pieceDev : p.length;
      maxY = Math.max(maxY, p.y + pieceH);
      maxX = Math.max(maxX, p.x + pieceL);
    }

    // Comprimento dinâmico da Chapa / Bobina
    let newLength = currentPlan.length;
    if (overrideLength !== undefined && overrideLength > 0) {
      newLength = overrideLength;
    } else if (autoFitLength || isCoil) {
      // Ajusta dinamicamente ao ponto máximo das peças (desenrolar do rolo ou chapa auto-fit)
      newLength = Math.max(50, Math.ceil(maxX));
    } else {
      // Garante que não corta peças se ultrapassarem o tamanho anterior
      newLength = Math.max(currentPlan.length, Math.ceil(maxX));
    }

    let newWidth = overrideWidth !== undefined && overrideWidth > 0 ? overrideWidth : currentPlan.width;
    newWidth = Math.max(newWidth, Math.ceil(maxY));

    const totalAreaMm2 = newWidth * newLength;

    // Sobra lateral recalculada
    const remnants: RemnantArea[] = [];
    const unusedY = Math.max(0, newWidth - maxY);
    if (unusedY > 0) {
      const isUsable = unusedY >= 150 && newLength >= 400;
      remnants.push({
        id: `rem_${currentPlan.sheetId}_manual`,
        code: isUsable ? `SOBRA-L${Math.round(unusedY)}` : `APARA-L${Math.round(unusedY)}`,
        x: 0,
        y: maxY,
        length: newLength,
        width: Math.round(unusedY),
        isUsable,
        areaMm2: Math.round(unusedY * newLength),
      });
    }

    let usableScrapAreaMm2 = 0;
    for (const r of remnants) {
      if (r.isUsable) usableScrapAreaMm2 += r.areaMm2;
    }

    const wasteAreaMm2 = Math.max(0, totalAreaMm2 - usedAreaMm2 - usableScrapAreaMm2);
    const yieldPercentage = totalAreaMm2 > 0 ? Math.round((usedAreaMm2 / totalAreaMm2) * 1000) / 10 : 0;

    // Atualiza nome descritivo se for corte de rolo/bobina
    let sheetName = currentPlan.sheetName;
    if (isCoil && (sheetName.includes('Desenrolar') || sheetName.includes('Bobina') || sheetName.includes('Rolo'))) {
      sheetName = `Bobina ${newWidth}mm • Desenrolar ${(newLength / 1000).toFixed(2)}m`;
    }

    const newPlan: SheetCutPlan = {
      ...currentPlan,
      sheetName,
      width: newWidth,
      length: newLength,
      coilCutLengthMm: isCoil ? newLength : currentPlan.coilCutLengthMm,
      placedPieces: updatedPieces,
      remnants,
      usedAreaMm2: Math.round(usedAreaMm2),
      totalAreaMm2: Math.round(totalAreaMm2),
      wasteAreaMm2: Math.round(wasteAreaMm2),
      usableScrapAreaMm2: Math.round(usableScrapAreaMm2),
      yieldPercentage,
    };

    return newPlan;
  };

  const applyPiecesUpdate = (
    updatedPieces: PlacedPiece[],
    overrideLength?: number,
    overrideWidth?: number
  ) => {
    const updatedPlan = recalculatePlanMetrics(updatedPieces, overrideLength, overrideWidth);
    setCurrentPlan(updatedPlan);
    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan);
    }
  };

  // Ajustar tamanho da chapa diretamente pelo botão ou input
  const handleApplyCustomSheetLength = (val: number) => {
    if (val <= 0 || isNaN(val)) return;
    applyPiecesUpdate(currentPlan.placedPieces, val);
  };

  // Forçar auto-ajuste imediato da chapa para o limite das peças
  const handleAutoFitSheetToPieces = () => {
    let maxX = 0;
    for (const p of currentPlan.placedPieces) {
      const pieceDev = Math.max(p.devStart, p.devEnd);
      const pieceL = (p.rotation === 90 || p.rotation === 270) ? pieceDev : p.length;
      maxX = Math.max(maxX, p.x + pieceL);
    }
    const fitLength = Math.max(50, Math.ceil(maxX));
    applyPiecesUpdate(currentPlan.placedPieces, fitLength);
  };

  // Funções de Micro-Ajuste (Setas)
  const moveSelectedPiece = (dx: number, dy: number) => {
    if (!selectedPieceId) return;
    const updated = currentPlan.placedPieces.map((p) => {
      if (p.pieceId !== selectedPieceId) return p;
      const newX = Math.max(0, Math.min(currentPlan.length - 10, p.x + dx));
      const newY = Math.max(0, Math.min(currentPlan.width - 10, p.y + dy));
      return { ...p, x: Math.round(newX), y: Math.round(newY) };
    });
    applyPiecesUpdate(updated);
  };

  // Funções de Rotação de Peças
  const rotatePiece90 = () => {
    if (!selectedPieceId) return;
    const updated = currentPlan.placedPieces.map((p) => {
      if (p.pieceId !== selectedPieceId) return p;
      const currentRot = p.rotation || 0;
      const nextRot = (currentRot + 90) % 360;
      return {
        ...p,
        rotation: nextRot,
        isRotated: nextRot !== 0,
      };
    });
    applyPiecesUpdate(updated);
  };

  const rotatePiece45 = () => {
    if (!selectedPieceId) return;
    const updated = currentPlan.placedPieces.map((p) => {
      if (p.pieceId !== selectedPieceId) return p;
      const currentRot = p.rotation || 0;
      const nextRot = (currentRot + 45) % 360;
      return {
        ...p,
        rotation: nextRot,
        isRotated: nextRot !== 0,
      };
    });
    applyPiecesUpdate(updated);
  };

  // Inverter Trapézio / Flip 180º
  const flipTrapezoidPiece = () => {
    if (!selectedPieceId) return;
    const updated = currentPlan.placedPieces.map((p) => {
      if (p.pieceId !== selectedPieceId) return p;
      return {
        ...p,
        isFlipped: !p.isFlipped,
        polygonPoints: undefined,
      };
    });
    applyPiecesUpdate(updated);
  };

  // Alinhamentos Rápidos
  const alignPiece = (alignment: 'top' | 'bottom' | 'left' | 'right') => {
    if (!selectedPieceId || !selectedPiece) return;
    const pieceH = (selectedPiece.rotation === 90 || selectedPiece.rotation === 270)
      ? selectedPiece.length
      : Math.max(selectedPiece.devStart, selectedPiece.devEnd);
    const pieceL = (selectedPiece.rotation === 90 || selectedPiece.rotation === 270)
      ? Math.max(selectedPiece.devStart, selectedPiece.devEnd)
      : selectedPiece.length;

    const updated = currentPlan.placedPieces.map((p) => {
      if (p.pieceId !== selectedPieceId) return p;
      let newX = p.x;
      let newY = p.y;

      if (alignment === 'top') newY = 0;
      if (alignment === 'bottom') newY = Math.max(0, currentPlan.width - pieceH);
      if (alignment === 'left') newX = 0;
      if (alignment === 'right') newX = Math.max(0, currentPlan.length - pieceL);

      return { ...p, x: Math.round(newX), y: Math.round(newY) };
    });
    applyPiecesUpdate(updated);
  };

  // Restaurar Posicionamento Original
  const resetToOriginal = () => {
    const fresh = JSON.parse(JSON.stringify(originalPlan));
    setCurrentPlan(fresh);
    if (onUpdatePlan) {
      onUpdatePlan(fresh);
    }
  };

  // Conversão de Coordenadas de Mouse/Touch para SVG em Milímetros
  const getSvgCoordinates = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) return null;
    const svgPoint = pt.matrixTransform(screenCTM.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
  };

  // Início do Arraste (Mouse & Touch)
  const handlePointerDownPiece = (e: React.PointerEvent, piece: PlacedPiece) => {
    e.stopPropagation();
    setSelectedPieceId(piece.pieceId);

    if (!isManualEditMode) return;

    try {
      (e.target as Element).setPointerCapture(e.pointerId);
    } catch (_) {
      // Ignora erro de pointer capture em navegadores legados
    }

    const coords = getSvgCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    setDraggingPieceId(piece.pieceId);
    setDragStartPos(coords);
    setPieceStartPos({ x: piece.x, y: piece.y });
  };

  // Movimentação do Arraste (com Snap Magnético e suporte a touch)
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!draggingPieceId || !dragStartPos || !pieceStartPos || !isManualEditMode) return;

    const coords = getSvgCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    const deltaX = coords.x - dragStartPos.x;
    const deltaY = coords.y - dragStartPos.y;

    let targetX = pieceStartPos.x + deltaX;
    let targetY = pieceStartPos.y + deltaY;

    // Snapping Magnético inteligente (15mm das bordas da chapa)
    if (Math.abs(targetX) < 15) targetX = 0;
    if (Math.abs(targetY) < 15) targetY = 0;

    const piece = currentPlan.placedPieces.find((p) => p.pieceId === draggingPieceId);
    if (piece) {
      const pieceH = (piece.rotation === 90 || piece.rotation === 270)
        ? piece.length
        : Math.max(piece.devStart, piece.devEnd);
      const pieceL = (piece.rotation === 90 || piece.rotation === 270)
        ? Math.max(piece.devStart, piece.devEnd)
        : piece.length;

      // Snap na borda direita e inferior
      if (Math.abs(targetX + pieceL - currentPlan.length) < 15) {
        targetX = currentPlan.length - pieceL;
      }
      if (Math.abs(targetY + pieceH - currentPlan.width) < 15) {
        targetY = currentPlan.width - pieceH;
      }

      // Snap magnético com outras peças
      for (const other of currentPlan.placedPieces) {
        if (other.pieceId === piece.pieceId) continue;
        const otherH = (other.rotation === 90 || other.rotation === 270)
          ? other.length
          : Math.max(other.devStart, other.devEnd);
        // Snap logo abaixo de outra peça
        if (Math.abs(targetY - (other.y + otherH)) < 12) {
          targetY = other.y + otherH;
        }
        // Snap logo acima de outra peça
        if (Math.abs(targetY + pieceH - other.y) < 12) {
          targetY = other.y - pieceH;
        }
      }
    }

    // Limites da Chapa
    targetX = Math.max(0, targetX);
    targetY = Math.max(0, targetY);

    const updated = currentPlan.placedPieces.map((p) => {
      if (p.pieceId !== draggingPieceId) return p;
      return { ...p, x: Math.round(targetX), y: Math.round(targetY) };
    });

    setCurrentPlan((prev) => ({ ...prev, placedPieces: updated }));
  };

  // Fim do Arraste
  const handlePointerUpCanvas = (e: React.PointerEvent) => {
    if (draggingPieceId) {
      try {
        (e.target as Element).releasePointerCapture(e.pointerId);
      } catch (_) {}
      applyPiecesUpdate(currentPlan.placedPieces);
      setDraggingPieceId(null);
      setDragStartPos(null);
      setPieceStartPos(null);
    }
  };

  // Cancelamento de Arraste (ex: troca de app no mobile)
  const handlePointerCancelCanvas = () => {
    if (draggingPieceId) {
      setDraggingPieceId(null);
      setDragStartPos(null);
      setPieceStartPos(null);
    }
  };

  // Verifica se uma peça está ultrapassando os limites da chapa
  const isPieceOutOfBounds = (p: PlacedPiece) => {
    const pieceH = (p.rotation === 90 || p.rotation === 270) ? p.length : Math.max(p.devStart, p.devEnd);
    const pieceL = (p.rotation === 90 || p.rotation === 270) ? Math.max(p.devStart, p.devEnd) : p.length;
    return p.x + pieceL > currentPlan.length + 0.1 || p.y + pieceH > currentPlan.width + 0.1;
  };

  return (
    <div
      id={`sheet-plan-card-${currentPlan.sheetId}-${index}`}
      className="bg-white border-2 border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm mb-6 flex flex-col relative overflow-hidden"
    >
      {/* Cabeçalho da Chapa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-3 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
          <span
            className={`inline-flex items-center px-2.5 py-1 text-[10px] font-black rounded uppercase tracking-wider whitespace-nowrap shrink-0 self-start sm:self-auto ${
              currentPlan.isScrap || currentPlan.stockCategory === 'retalho'
                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
                : currentPlan.stockCategory === 'sugestao_compra' || (!currentPlan.isFromUserStock && currentPlan.isCoilCut)
                ? 'bg-violet-100 text-violet-900 border border-violet-300 shadow-xs'
                : currentPlan.isCoilCut || currentPlan.stockCategory === 'rolo'
                ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 shadow-xs'
                : 'bg-blue-100 text-blue-800 border border-blue-200'
            }`}
          >
            {currentPlan.isScrap || currentPlan.stockCategory === 'retalho'
              ? '♻️ RETALHO DA OFICINA'
              : currentPlan.stockCategory === 'sugestao_compra'
              ? `💡 SUGESTÃO DE COMPRA • ${(currentPlan.length / 1000).toFixed(2)}m`
              : currentPlan.isCoilCut || currentPlan.stockCategory === 'rolo'
              ? `🌀 ROLO DO ESTOQUE • ${(currentPlan.length / 1000).toFixed(2)}m`
              : '📋 CHAPA PLANA'}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-slate-900 font-black text-sm sm:text-base flex items-center gap-2 flex-wrap">
                <span className="truncate">{currentPlan.sheetName}</span>
                <span className="text-xs font-mono text-slate-500 font-normal whitespace-nowrap">
                  ({currentPlan.width} × {currentPlan.length} mm)
                </span>
              </h4>

              {/* BOTÃO PARA ESCOLHER OUTRA BOBINA / CHAPA DO ESTOQUE */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowCoilSelector(!showCoilSelector)}
                  className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer select-none"
                  title="Trocar bobina desta folha por outra largura do estoque ou comercial (ex: 1,20m, 1,00m, 70cm)"
                >
                  <span>🌀 Escolher Bobina</span>
                  <ChevronDown className="w-3 h-3 text-indigo-600" />
                </button>

                {/* Dropdown de Seleção de Bobina */}
                {showCoilSelector && (
                  <div className="absolute left-0 top-full mt-1.5 z-40 bg-white border-2 border-indigo-200 rounded-xl shadow-xl p-3 w-72 sm:w-80 text-xs space-y-3 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                        <span>🌀</span>
                        <span>Escolher Bobina para Este Corte</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCoilSelector(false)}
                        className="text-slate-400 hover:text-slate-700 text-sm font-bold px-1"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Bobinas Cadastradas no Estoque do Usuário */}
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-indigo-900 mb-1.5 flex items-center justify-between">
                        <span>📦 Bobinas do Seu Estoque</span>
                        <span className="text-[9px] text-slate-500 lowercase font-normal">disponíveis</span>
                      </div>
                      {userStockCoils.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          {distinctStockWidths.map((w) => {
                            const matching = userStockCoils.find((c) => c.width === w);
                            const isCurrent = currentPlan.width === w;
                            return (
                              <button
                                key={w}
                                type="button"
                                onClick={() => handleSelectCoilWidth(w, matching)}
                                className={`p-2 rounded-lg border text-left flex flex-col transition-all cursor-pointer ${
                                  isCurrent
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                    : 'bg-indigo-50/70 hover:bg-indigo-100 text-indigo-950 border-indigo-200'
                                }`}
                              >
                                <span className="font-bold font-mono text-xs">
                                  {w / 10} cm ({w}mm)
                                </span>
                                <span className={`text-[10px] truncate ${isCurrent ? 'text-indigo-100' : 'text-slate-500'}`}>
                                  {matching?.name || 'Bobina Estoque'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-200">
                          Nenhuma bobina cadastrada no estoque. Você pode escolher as larguras comerciais abaixo:
                        </p>
                      )}
                    </div>

                    {/* Todas as Larguras Comerciais Padrão (30cm, 40cm, 50cm, 60cm, 70cm, 80cm, 90cm, 100cm, 120cm) */}
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                        📐 Outras Medidas Comerciais
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {STANDARD_COMMERCIAL_WIDTHS.map((stdW) => {
                          const isCurrent = currentPlan.width === stdW;
                          const inStock = distinctStockWidths.includes(stdW);
                          return (
                            <button
                              key={stdW}
                              type="button"
                              onClick={() => handleSelectCoilWidth(stdW)}
                              className={`px-2 py-1.5 rounded-lg border text-center font-mono font-bold text-xs transition-colors cursor-pointer ${
                                isCurrent
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : inStock
                                  ? 'bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {stdW >= 1000 ? `${(stdW / 1000).toFixed(2).replace('.00', '')}m` : `${stdW / 10}cm`}
                              {inStock && <span className="block text-[8px] font-sans text-indigo-600">Estoque</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-[10px] text-slate-500 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                      💡 Ao escolher a bobina (ex: 1,20m), o sistema recalcula e remonta automaticamente as tiras e sobras aproveitáveis.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium flex items-center flex-wrap gap-x-2 mt-0.5">
              <span className="whitespace-nowrap">Material: <strong className="text-slate-700">{currentPlan.material} ({currentPlan.thickness})</strong></span>
              <span className="whitespace-nowrap">• Peças: <strong className="text-slate-900">{currentPlan.placedPieces.length}</strong></span>
              {currentPlan.isCoilCut && (
                <span className="text-indigo-700 font-bold whitespace-nowrap">
                  • Desenrolar: {((currentPlan.width * currentPlan.length) / 1000000).toFixed(2)} m²
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Métricas de Rendimento & Controles de Zoom */}
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className="text-left sm:text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Aproveitamento</div>
            <div className="text-lg sm:text-xl font-black text-emerald-600 font-mono whitespace-nowrap">
              {currentPlan.yieldPercentage}%
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="text-left sm:text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Desperdício</div>
            <div className="text-xs sm:text-sm font-bold text-slate-700 font-mono whitespace-nowrap">
              {GeometryService.formatAreaM2(currentPlan.wasteAreaMm2)}
            </div>
          </div>

          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 shrink-0">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              className="p-1.5 hover:bg-white text-slate-600 rounded transition-colors"
              title="Reduzir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-600 hover:text-slate-900"
              title="Ajustar à Largura (100%)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="p-1.5 hover:bg-white text-slate-600 rounded transition-colors"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS INTERATIVAS: MODO EDIÇÃO MANUAL & ROTAÇÃO DA CHAPA */}
      <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-3 mb-3 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        {/* Toggle de Ajuste Manual */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsManualEditMode(!isManualEditMode)}
            className={`px-3 py-2 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-xs touch-manipulation cursor-pointer ${
              isManualEditMode
                ? 'bg-blue-600 text-white border border-blue-700 shadow-blue-500/30'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Move className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">{isManualEditMode ? '✓ Modo Ajuste Ativo' : 'Ajuste Manual (Arrastar / Mover)'}</span>
          </button>

          {isManualEditMode && (
            <button
              type="button"
              onClick={resetToOriginal}
              className="px-3 py-2 bg-white text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 transition-colors touch-manipulation cursor-pointer font-semibold whitespace-nowrap"
              title="Restaurar posições originais do algoritmo de corte"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Restaurar</span>
            </button>
          )}
        </div>

        {/* ROTAÇÃO DA CHAPA / DIAGRAMA (0º, 45º, 90º, 180º) */}
        <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-lg border border-slate-300 flex-wrap">
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1 whitespace-nowrap">
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">Virar Chapa:</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSheetRotation(0)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                sheetRotation === 0 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              0º Horiz.
            </button>
            <button
              type="button"
              onClick={() => setSheetRotation(45)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                sheetRotation === 45 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              45º
            </button>
            <button
              type="button"
              onClick={() => setSheetRotation(90)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                sheetRotation === 90 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              90º Vert.
            </button>
            <button
              type="button"
              onClick={() => setSheetRotation(180)}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                sheetRotation === 180 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              180º
            </button>
          </div>
        </div>
      </div>

      {/* CONTROLE DE TAMANHO DINÂMICO DA CHAPA / DESENROLAR DA BOBINA */}
      {isManualEditMode && (
        <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 mb-3 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5 whitespace-nowrap">
              <Scissors className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>Tamanho da Chapa / Desenrolar:</span>
            </span>
            <span className="font-mono font-bold bg-white px-2 py-1 rounded border border-emerald-300 text-emerald-900 whitespace-nowrap">
              {currentPlan.width} × {currentPlan.length} mm ({(currentPlan.length / 1000).toFixed(2)}m)
            </span>

            <label className="flex items-center gap-1.5 text-emerald-900 font-semibold cursor-pointer select-none bg-white px-2.5 py-1 rounded-lg border border-emerald-300 hover:bg-emerald-100/50 transition-colors">
              <input
                type="checkbox"
                checked={autoFitLength}
                onChange={(e) => {
                  const val = e.target.checked;
                  setAutoFitLength(val);
                  if (val) {
                    handleAutoFitSheetToPieces();
                  }
                }}
                className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
              />
              <span className="whitespace-nowrap">Acompanhar Peças Automaticamente (Auto-Fit)</span>
            </label>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoFitSheetToPieces}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer whitespace-nowrap"
              title="Ajusta o comprimento da chapa exatamente no final da última peça posicionada"
            >
              <Scissors className="w-3 h-3" />
              <span>Ajustar ao Fim do Corte</span>
            </button>

            <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-emerald-300">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Comprimento:</span>
              <input
                type="number"
                value={manualSheetLengthInput}
                onChange={(e) => setManualSheetLengthInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseInt(manualSheetLengthInput, 10);
                  if (!isNaN(parsed) && parsed > 0) {
                    setAutoFitLength(false);
                    handleApplyCustomSheetLength(parsed);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const parsed = parseInt(manualSheetLengthInput, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      setAutoFitLength(false);
                      handleApplyCustomSheetLength(parsed);
                    }
                  }
                }}
                className="w-20 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-900 border border-slate-200 rounded text-center focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
              <span className="text-[10px] font-bold text-slate-400">mm</span>
            </div>
          </div>
        </div>
      )}

      {/* PAINEL DE CONTROLE DA PEÇA SELECIONADA (ROTAÇÃO 45º/90º, FLIP, D-PAD TOUCH E MICRO-AJUSTE) */}
      {selectedPiece && (
        <div className="mb-3 p-3 sm:p-4 bg-indigo-50/90 border-2 border-indigo-300 rounded-xl flex flex-col gap-3 text-xs shadow-xs animate-in fade-in">
          {/* Informações da Peça Selecionada */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/80 pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-3.5 h-3.5 rounded-full bg-blue-600 shrink-0"></div>
              <div className="min-w-0">
                <span className="font-bold text-slate-900 text-xs sm:text-sm truncate block">
                  Peça #{selectedPiece.cutIndex} • {selectedPiece.pieceName}
                </span>
                <span className="font-mono text-[11px] text-indigo-800 font-bold whitespace-nowrap">
                  Medida: {selectedPiece.length} × {selectedPiece.devStart}mm
                  {selectedPiece.rotation ? ` (Giro: ${selectedPiece.rotation}º)` : ''}
                  {selectedPiece.isFlipped ? ' [Invertida]' : ''}
                </span>
              </div>
            </div>

            {/* Inputs Diretos de Posição X e Y em mm */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-white px-2.5 py-1.5 rounded-lg border border-indigo-200">
              <div className="flex items-center gap-1 font-mono">
                <span className="text-[10px] font-bold text-slate-500">X:</span>
                <input
                  type="number"
                  value={selectedPiece.x}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    const updated = currentPlan.placedPieces.map((p) =>
                      p.pieceId === selectedPieceId ? { ...p, x: val } : p
                    );
                    applyPiecesUpdate(updated);
                  }}
                  className="w-14 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded py-0.5"
                />
                <span className="text-[10px] text-slate-400">mm</span>
              </div>
              <div className="w-px h-4 bg-slate-200"></div>
              <div className="flex items-center gap-1 font-mono">
                <span className="text-[10px] font-bold text-slate-500">Y:</span>
                <input
                  type="number"
                  value={selectedPiece.y}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value) || 0);
                    const updated = currentPlan.placedPieces.map((p) =>
                      p.pieceId === selectedPieceId ? { ...p, y: val } : p
                    );
                    applyPiecesUpdate(updated);
                  }}
                  className="w-14 text-center font-bold text-xs bg-slate-50 border border-slate-300 rounded py-0.5"
                />
                <span className="text-[10px] text-slate-400">mm</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Botões de Ações Rápidas (Giro e Inversão) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={rotatePiece90}
                className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs touch-manipulation cursor-pointer active:scale-95 transition-transform"
                title="Girar peça em 90 graus"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                <span className="whitespace-nowrap">Girar 90º</span>
              </button>

              <button
                type="button"
                onClick={rotatePiece45}
                className="min-h-[38px] px-2.5 py-1.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs touch-manipulation cursor-pointer active:scale-95 transition-transform"
                title="Girar peça em 45 graus para corte em ângulo"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-600" />
                <span className="whitespace-nowrap">Girar 45º</span>
              </button>

              {selectedPiece.isTrapezoid && (
                <button
                  type="button"
                  onClick={flipTrapezoidPiece}
                  className="min-h-[38px] px-2.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs touch-manipulation cursor-pointer active:scale-95 transition-transform"
                  title="Inverter lados do trapézio"
                >
                  <span className="whitespace-nowrap">⇄ Inverter (180º)</span>
                </button>
              )}
            </div>

            {/* Alinhamentos Rápidos */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-indigo-200">
              <span className="text-[10px] font-bold text-slate-400 px-1 uppercase hidden md:inline">Alinhar:</span>
              <button
                type="button"
                onClick={() => alignPiece('top')}
                className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold whitespace-nowrap cursor-pointer touch-manipulation"
                title="Alinhar ao topo (Y=0)"
              >
                Topo
              </button>
              <button
                type="button"
                onClick={() => alignPiece('bottom')}
                className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold whitespace-nowrap cursor-pointer touch-manipulation"
                title="Alinhar à base"
              >
                Base
              </button>
              <button
                type="button"
                onClick={() => alignPiece('left')}
                className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold whitespace-nowrap cursor-pointer touch-manipulation"
                title="Alinhar à esquerda (X=0)"
              >
                Esq.
              </button>
              <button
                type="button"
                onClick={() => alignPiece('right')}
                className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 rounded text-xs font-bold whitespace-nowrap cursor-pointer touch-manipulation"
                title="Alinhar à direita"
              >
                Dir.
              </button>
            </div>

            {/* Micro-Ajuste com D-Pad Direcional (Otimizado para Touch Mobile) */}
            <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-indigo-200">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase hidden sm:inline">Passo:</span>
                <select
                  value={stepSizeMm}
                  onChange={(e) => setStepSizeMm(Number(e.target.value))}
                  className="text-xs font-bold bg-slate-50 border border-slate-200 rounded px-1.5 py-1"
                  title="Tamanho do passo de ajuste"
                >
                  <option value={1}>±1mm</option>
                  <option value={5}>±5mm</option>
                  <option value={10}>±10mm</option>
                  <option value={50}>±50mm</option>
                  <option value={100}>±100mm</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSelectedPiece(-stepSizeMm, 0)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-100 active:bg-blue-200 rounded-md text-slate-700 hover:text-blue-700 font-bold transition-colors touch-manipulation cursor-pointer"
                  title={`Mover para Esquerda (-${stepSizeMm}mm)`}
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSelectedPiece(stepSizeMm, 0)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-100 active:bg-blue-200 rounded-md text-slate-700 hover:text-blue-700 font-bold transition-colors touch-manipulation cursor-pointer"
                  title={`Mover para Direita (+${stepSizeMm}mm)`}
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSelectedPiece(0, -stepSizeMm)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-100 active:bg-blue-200 rounded-md text-slate-700 hover:text-blue-700 font-bold transition-colors touch-manipulation cursor-pointer"
                  title={`Mover para Cima (-${stepSizeMm}mm)`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSelectedPiece(0, stepSizeMm)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-blue-100 active:bg-blue-200 rounded-md text-slate-700 hover:text-blue-700 font-bold transition-colors touch-manipulation cursor-pointer"
                  title={`Mover para Baixo (+${stepSizeMm}mm)`}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blueprint Canvas com Suporte a Rotação de Chapa & Drag and Drop Touch */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-4 overflow-x-auto select-none touch-pan-x touch-pan-y">
        <div
          className="transition-transform duration-200 origin-center mx-auto"
          style={{
            width: zoom === 1 ? '100%' : `${Math.max(650, Math.round(1000 * zoom))}px`,
            minWidth: zoom > 1 ? `${Math.round(900 * zoom)}px` : undefined,
            transform: `rotate(${sheetRotation}deg)`,
            transformOrigin: 'center center',
          }}
        >
          {/* Eixos Dimensionais */}
          <div className="flex justify-between text-[11px] sm:text-xs font-mono text-slate-500 font-bold uppercase pb-1.5 px-1 whitespace-nowrap">
            <span>0 mm</span>
            <span className="text-slate-700 truncate px-2 font-black">
              {isManualEditMode ? '✋ MODO AJUSTE ATIVO — Toque e arraste as peças ou use os botões direcionais' : `Eixo Longitudinal: ${currentPlan.length} mm (${(currentPlan.length / 1000).toFixed(2)}m) ➔`}
            </span>
            <span>{currentPlan.length} mm</span>
          </div>

          <div
            className={`relative border-2 rounded-lg shadow-sm overflow-hidden bg-white touch-none ${
              isManualEditMode ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300'
            }`}
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              touchAction: 'none',
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${currentPlan.length} ${currentPlan.width}`}
              className="w-full h-auto block select-none touch-none"
              style={{
                maxHeight: 'min(75vh, 600px)',
                minHeight: '160px',
                cursor: isManualEditMode ? 'crosshair' : 'default',
                touchAction: 'none',
              }}
              onPointerMove={handlePointerMoveCanvas}
              onPointerUp={handlePointerUpCanvas}
              onPointerCancel={handlePointerCancelCanvas}
            >
              <defs>
                <pattern id={`gb-waste-${index}`} width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(239, 68, 68, 0.35)" strokeWidth="2" />
                </pattern>
                <pattern id={`gb-scrap-${index}`} width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2="16" stroke="rgba(245, 158, 11, 0.4)" strokeWidth="2" />
                </pattern>
              </defs>

              {/* Fundo da Chapa */}
              <rect
                x="0"
                y="0"
                width={currentPlan.length}
                height={currentPlan.width}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
              />

              {/* Sobras e Retalhos Identificados */}
              {currentPlan.remnants.map((r, rIdx) => {
                const isTrap = r.isTrapezoid || (r.widthEnd !== undefined && r.widthEnd !== r.width);
                const shape = r.shapeType || (isTrap ? (r.widthEnd === 0 ? 'triangulo' : 'trapezio') : 'retangular');
                const labelText = r.isUsable
                  ? isTrap
                    ? `♻️ SOBRA ${shape === 'triangulo' ? 'TRI' : 'TRAP'}: ${r.width}→${r.widthEnd || 0}×${r.length}mm`
                    : `♻️ SOBRA: ${r.width}×${r.length}mm (${r.code})`
                  : isTrap
                  ? `APARA ${shape === 'triangulo' ? 'TRI' : 'TRAP'}: ${r.width}→${r.widthEnd || 0}×${r.length}mm`
                  : `APARA: ${r.width}×${r.length}mm`;

                return (
                  <g key={`rem-${r.id}-${rIdx}`}>
                    {r.polygonPoints ? (
                      <polygon
                        points={r.polygonPoints}
                        fill={r.isUsable ? `url(#gb-scrap-${index})` : `url(#gb-waste-${index})`}
                        stroke={r.isUsable ? '#d97706' : '#ef4444'}
                        strokeWidth="1.5"
                        strokeDasharray={r.isUsable ? '6,3' : '4,2'}
                      />
                    ) : (
                      <rect
                        x={r.x}
                        y={r.y}
                        width={r.length}
                        height={r.width}
                        fill={r.isUsable ? `url(#gb-scrap-${index})` : `url(#gb-waste-${index})`}
                        stroke={r.isUsable ? '#d97706' : '#ef4444'}
                        strokeWidth="1.5"
                        strokeDasharray={r.isUsable ? '6,3' : '4,2'}
                      />
                    )}
                    {r.length > 250 && r.width > 60 && (
                      <text
                        x={r.x + r.length / 2}
                        y={r.y + (r.widthEnd !== undefined ? (r.width + r.widthEnd) / 4 : r.width / 2) + 5}
                        fill={r.isUsable ? '#b45309' : '#dc2626'}
                        fontSize={Math.max(13, Math.min(20, r.width / 4.5))}
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-mono select-none uppercase tracking-wider"
                      >
                        {labelText}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Peças Posicionadas com Suporte a Drag and Drop & Rotação SVG */}
              {currentPlan.placedPieces.map((p, pIdx) => {
                const color = PIECE_COLORS[(p.colorIndex || pIdx) % PIECE_COLORS.length];
                const isSelected = selectedPieceId === p.pieceId;
                const rot = p.rotation || 0;
                const isDragging = draggingPieceId === p.pieceId;
                const isOutOfBounds = isPieceOutOfBounds(p);

                if (p.isTrapezoid) {
                  const geo = GeometryService.getTrapezoidGeometry(p);
                  const transformAttr = rot !== 0 ? `rotate(${rot} ${geo.centroidX} ${geo.centroidY})` : undefined;
                  const avgHeight = (p.devStart + p.devEnd) / 2;

                  return (
                    <g
                      key={`piece-${p.pieceId}-${pIdx}`}
                      transform={transformAttr}
                      onPointerDown={(e) => handlePointerDownPiece(e, p)}
                      style={{ touchAction: 'none' }}
                      className={`transition-opacity touch-none select-none ${
                        isManualEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      } ${isDragging ? 'opacity-70' : 'hover:opacity-90'}`}
                    >
                      <polygon
                        points={geo.points}
                        fill={color.fill}
                        stroke={isOutOfBounds ? '#ef4444' : isSelected ? '#1e293b' : color.stroke}
                        strokeWidth={isSelected ? 4 : 2}
                        strokeDasharray={isOutOfBounds ? '6,3' : undefined}
                      />

                      {/* Texto de Identificação da Peça */}
                      <text
                        x={geo.centroidX}
                        y={geo.centroidY + 5}
                        fill={color.text}
                        fontSize={Math.max(12, Math.min(20, avgHeight / 3.5))}
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-sans select-none drop-shadow-sm uppercase pointer-events-none"
                      >
                        #{p.cutIndex} {p.pieceName} ({p.length}mm | {p.devStart}→{p.devEnd}mm)
                        {p.isFlipped ? ' [INV]' : ''}
                        {p.rotation ? ` [${p.rotation}º]` : ''}
                      </text>
                    </g>
                  );
                }

                const rectCenterX = p.x + p.length / 2;
                const rectCenterY = p.y + p.devStart / 2;
                const rectTransformAttr = rot !== 0 ? `rotate(${rot} ${rectCenterX} ${rectCenterY})` : undefined;

                return (
                  <g
                    key={`piece-${p.pieceId}-${pIdx}`}
                    transform={rectTransformAttr}
                    onPointerDown={(e) => handlePointerDownPiece(e, p)}
                    style={{ touchAction: 'none' }}
                    className={`transition-opacity touch-none select-none ${
                      isManualEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${isDragging ? 'opacity-70' : 'hover:opacity-90'}`}
                  >
                    <rect
                      x={p.x}
                      y={p.y}
                      width={p.length}
                      height={p.devStart}
                      fill={color.fill}
                      stroke={isOutOfBounds ? '#ef4444' : isSelected ? '#1e293b' : color.stroke}
                      strokeWidth={isSelected ? 4 : 2}
                      strokeDasharray={isOutOfBounds ? '6,3' : undefined}
                      rx="2"
                    />

                    <text
                      x={p.x + p.length / 2}
                      y={p.y + p.devStart / 2 + 5}
                      fill={color.text}
                      fontSize={Math.max(12, Math.min(20, p.devStart / 3.5))}
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-sans select-none drop-shadow-sm uppercase pointer-events-none"
                    >
                      #{p.cutIndex} {p.pieceName} ({p.length} × {p.devStart} mm)
                      {p.rotation ? ` [${p.rotation}º]` : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between text-[11px] font-mono text-slate-400 font-bold uppercase pt-1.5 px-1 whitespace-nowrap">
            <span>0 mm</span>
            <span className="text-slate-600 truncate px-2">Desenvolvimento (Largura da Chapa): {currentPlan.width} mm</span>
            <span>{currentPlan.width} mm</span>
          </div>
        </div>
      </div>

      {/* Roteiro e Sequência Técnica de Corte */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Peças cortadas */}
          <div>
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2 whitespace-nowrap">
              <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              Peças nesta Chapa ({currentPlan.placedPieces.length})
            </h5>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {currentPlan.placedPieces.map((p, pIdx) => {
                const color = PIECE_COLORS[(p.colorIndex || pIdx) % PIECE_COLORS.length];
                const isSelected = selectedPieceId === p.pieceId;

                return (
                  <div
                    key={`list-p-${p.pieceId}-${pIdx}`}
                    onClick={() => setSelectedPieceId(isSelected ? null : p.pieceId)}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg text-xs cursor-pointer border transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: color.stroke }}
                      ></span>
                      <span className="font-bold truncate">#{p.cutIndex} {p.pieceName}</span>
                      {p.isTrapezoid && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold whitespace-nowrap shrink-0">
                          {p.isFlipped ? '📐 Trap. Inv.' : '📐 Trapézio'}
                        </span>
                      )}
                      {p.rotation ? (
                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-mono whitespace-nowrap shrink-0 font-bold">
                          {p.rotation}º
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-slate-500 font-semibold text-right shrink-0">
                      <div className="whitespace-nowrap">{p.isTrapezoid ? `${p.devStart}→${p.devEnd} mm` : `${p.devStart} mm`} × {p.length} mm</div>
                      <div className="text-[10px] text-slate-400 whitespace-nowrap">X: {p.x}mm, Y: {p.y}mm</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Passos de Guilhotina */}
          <div>
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
              <Scissors className="w-3.5 h-3.5 text-emerald-600" />
              Sequência Recomendada de Corte
            </h5>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {currentPlan.cutSequence.map((step, sIdx) => (
                <div
                  key={`step-${sIdx}`}
                  className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                    {step.step}
                  </span>
                  <div className="flex-1 text-slate-700 font-medium">{step.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notificação de Sobras Reutilizáveis */}
        {currentPlan.remnants.some((r) => r.isUsable) && (
          <div className="mt-3.5 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="text-xs text-amber-900">
              <strong>Sobra Reaproveitável Detectada:</strong> Este corte gerará{' '}
              {currentPlan.remnants
                .filter((r) => r.isUsable)
                .map((r) => {
                  if (r.isTrapezoid || (r.widthEnd !== undefined && r.widthEnd !== r.width)) {
                    const isTri = r.shapeType === 'triangulo' || r.widthEnd === 0;
                    return `${isTri ? 'Triangular' : 'Trapezoidal'} ${r.width}→${r.widthEnd || 0} × ${r.length} mm (${r.code})`;
                  }
                  return `${r.width} × ${r.length} mm (${r.code})`;
                })
                .join(', ')}.
              Ao confirmar a ordem, esses retalhos serão automaticamente integrados ao estoque!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
