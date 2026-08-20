import React, { useState, useRef, useEffect } from 'react';
import { SheetCutPlan, PlacedPiece, RemnantArea } from '../types';
import { GeometryService } from '../services/GeometryService';
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
} from 'lucide-react';

interface Props {
  plan: SheetCutPlan;
  index: number;
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

export const VisualCutDiagram: React.FC<Props> = ({ plan, index, onUpdatePlan }) => {
  // Estado local do plano para permitir ajustes manuais interativos
  const [currentPlan, setCurrentPlan] = useState<SheetCutPlan>(plan);
  const [originalPlan] = useState<SheetCutPlan>(JSON.parse(JSON.stringify(plan)));

  // Atualiza se o prop mudar externamente (ex: novo cálculo)
  useEffect(() => {
    setCurrentPlan(plan);
  }, [plan]);

  const [zoom, setZoom] = useState(1);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [isManualEditMode, setIsManualEditMode] = useState<boolean>(false);
  const [sheetRotation, setSheetRotation] = useState<number>(0); // 0, 45, 90, 180
  const [stepSizeMm, setStepSizeMm] = useState<number>(5); // Passo de micro-ajuste: 1, 5, 10, 50mm

  // Estado de Arraste (Drag and Drop)
  const [draggingPieceId, setDraggingPieceId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [pieceStartPos, setPieceStartPos] = useState<{ x: number; y: number } | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const svgWidth = 900;
  const scale = svgWidth / currentPlan.length;

  // Peça atualmente selecionada
  const selectedPiece = currentPlan.placedPieces.find((p) => p.pieceId === selectedPieceId);

  // Recalcula áreas, sobras e rendimento quando posições mudam
  const recalculatePlanMetrics = (updatedPieces: PlacedPiece[]): SheetCutPlan => {
    let usedAreaMm2 = 0;
    for (const p of updatedPieces) {
      usedAreaMm2 += GeometryService.calculatePieceAreaMm2(p);
    }

    const totalAreaMm2 = currentPlan.width * currentPlan.length;
    let maxY = 0;
    let maxX = 0;

    for (const p of updatedPieces) {
      const pieceDev = Math.max(p.devStart, p.devEnd);
      const pieceH = (p.rotation === 90 || p.rotation === 270) ? p.length : pieceDev;
      const pieceL = (p.rotation === 90 || p.rotation === 270) ? pieceDev : p.length;
      maxY = Math.max(maxY, p.y + pieceH);
      maxX = Math.max(maxX, p.x + pieceL);
    }

    // Sobra lateral recalculada
    const remnants: RemnantArea[] = [];
    const unusedY = Math.max(0, currentPlan.width - maxY);
    if (unusedY > 0) {
      const isUsable = unusedY >= 150 && currentPlan.length >= 400;
      remnants.push({
        id: `rem_${currentPlan.sheetId}_manual`,
        code: isUsable ? `SOBRA-L${Math.round(unusedY)}` : `APARA-L${Math.round(unusedY)}`,
        x: 0,
        y: maxY,
        length: currentPlan.length,
        width: Math.round(unusedY),
        isUsable,
        areaMm2: Math.round(unusedY * currentPlan.length),
      });
    }

    let usableScrapAreaMm2 = 0;
    for (const r of remnants) {
      if (r.isUsable) usableScrapAreaMm2 += r.areaMm2;
    }

    const wasteAreaMm2 = Math.max(0, totalAreaMm2 - usedAreaMm2 - usableScrapAreaMm2);
    const yieldPercentage = totalAreaMm2 > 0 ? Math.round((usedAreaMm2 / totalAreaMm2) * 1000) / 10 : 0;

    const newPlan: SheetCutPlan = {
      ...currentPlan,
      placedPieces: updatedPieces,
      remnants,
      usedAreaMm2: Math.round(usedAreaMm2),
      wasteAreaMm2: Math.round(wasteAreaMm2),
      usableScrapAreaMm2: Math.round(usableScrapAreaMm2),
      yieldPercentage,
    };

    return newPlan;
  };

  const applyPiecesUpdate = (updatedPieces: PlacedPiece[]) => {
    const updatedPlan = recalculatePlanMetrics(updatedPieces);
    setCurrentPlan(updatedPlan);
    if (onUpdatePlan) {
      onUpdatePlan(updatedPlan);
    }
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

  // Início do Arraste
  const handlePointerDownPiece = (e: React.PointerEvent, piece: PlacedPiece) => {
    e.stopPropagation();
    setSelectedPieceId(piece.pieceId);

    if (!isManualEditMode) return;

    (e.target as Element).setPointerCapture(e.pointerId);
    const coords = getSvgCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    setDraggingPieceId(piece.pieceId);
    setDragStartPos(coords);
    setPieceStartPos({ x: piece.x, y: piece.y });
  };

  // Movimentação do Arraste (com Snap Magnético)
  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!draggingPieceId || !dragStartPos || !pieceStartPos || !isManualEditMode) return;

    const coords = getSvgCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    const deltaX = coords.x - dragStartPos.x;
    const deltaY = coords.y - dragStartPos.y;

    let targetX = pieceStartPos.x + deltaX;
    let targetY = pieceStartPos.y + deltaY;

    // Snapping Magnético inteligente (10mm das bordas da chapa)
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
      applyPiecesUpdate(currentPlan.placedPieces);
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
      className="bg-white border-2 border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm mb-6 flex flex-col relative"
    >
      {/* Cabeçalho da Chapa */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${
              currentPlan.isCoilCut
                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 shadow-sm'
                : currentPlan.isScrap
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}
          >
            {currentPlan.isCoilCut
              ? `🌀 ROLO / BOBINA • DESENROLAR ${(currentPlan.length / 1000).toFixed(2)}m`
              : currentPlan.isScrap
              ? '♻️ RETALHO REUTILIZADO'
              : '▦ CHAPA PRINCIPAL'}
          </span>
          <div>
            <h4 className="text-slate-900 font-black text-sm sm:text-base flex items-center gap-2">
              <span>{currentPlan.sheetName}</span>
              <span className="text-xs font-mono text-slate-500 font-normal">
                ({currentPlan.width} × {currentPlan.length} mm)
              </span>
            </h4>
            <div className="text-xs text-slate-500 font-medium">
              Material: <strong className="text-slate-700">{currentPlan.material} ({currentPlan.thickness})</strong> • Peças: <strong className="text-slate-900">{currentPlan.placedPieces.length}</strong>
              {currentPlan.isCoilCut && (
                <span className="ml-2 text-indigo-700 font-bold">
                  (Corte sob medida do rolo de 30-40m)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Métricas de Rendimento & Controles de Zoom */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Aproveitamento</div>
            <div className="text-xl font-black text-emerald-600 font-mono">
              {currentPlan.yieldPercentage}%
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Desperdício</div>
            <div className="text-sm font-bold text-slate-700 font-mono">
              {GeometryService.formatAreaM2(currentPlan.wasteAreaMm2)}
            </div>
          </div>

          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
              className="p-1 hover:bg-white text-slate-600 rounded transition-colors"
              title="Reduzir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-1.5 py-0.5 text-[11px] font-mono text-slate-600 hover:text-slate-900"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
              className="p-1 hover:bg-white text-slate-600 rounded transition-colors"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* BARRA DE FERRAMENTAS INTERATIVAS: MODO EDIÇÃO MANUAL & ROTAÇÃO DA CHAPA */}
      <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-3 mb-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Toggle de Ajuste Manual */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsManualEditMode(!isManualEditMode)}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              isManualEditMode
                ? 'bg-blue-600 text-white border border-blue-700 shadow-blue-500/30'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>{isManualEditMode ? '✓ Modo Ajuste Manual Ativo' : 'Ativar Ajuste Manual (Arrastar e Soltar)'}</span>
          </button>

          {isManualEditMode && (
            <button
              type="button"
              onClick={resetToOriginal}
              className="px-2.5 py-1.5 bg-white text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1 transition-colors"
              title="Restaurar posições originais do algoritmo de corte"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Restaurar Original</span>
            </button>
          )}
        </div>

        {/* ROTAÇÃO DA CHAPA / DIAGRAMA (0º, 45º, 90º, 180º) */}
        <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-300">
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
            <Compass className="w-3.5 h-3.5 text-blue-600" />
            <span>Virar Chapa:</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSheetRotation(0)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                sheetRotation === 0 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              0º (Horizontal)
            </button>
            <button
              type="button"
              onClick={() => setSheetRotation(45)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                sheetRotation === 45 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              45º (Diagonal)
            </button>
            <button
              type="button"
              onClick={() => setSheetRotation(90)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                sheetRotation === 90 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              90º (Vertical)
            </button>
            <button
              type="button"
              onClick={() => setSheetRotation(180)}
              className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                sheetRotation === 180 ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              180º
            </button>
          </div>
        </div>
      </div>

      {/* PAINEL DE CONTROLE DA PEÇA SELECIONADA (ROTAÇÃO 45º/90º, FLIP, MICRO-AJUSTE) */}
      {selectedPiece && (
        <div className="mb-3 p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <div>
              <span className="font-bold text-slate-900">
                Peça Selecionada: #{selectedPiece.cutIndex} {selectedPiece.pieceName}
              </span>
              <span className="ml-2 font-mono text-[11px] text-indigo-700 font-semibold">
                Posição: X={selectedPiece.x}mm, Y={selectedPiece.y}mm • Medida: {selectedPiece.length}×{selectedPiece.devStart}mm
                {selectedPiece.rotation ? ` (Giro: ${selectedPiece.rotation}º)` : ''}
                {selectedPiece.isFlipped ? ' [Invertida]' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botões de Rotação da Peça (45º e 90º) */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-indigo-200">
              <button
                type="button"
                onClick={rotatePiece90}
                className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded font-bold text-[11px] flex items-center gap-1"
                title="Girar peça em 90 graus"
              >
                <RotateCw className="w-3 h-3" />
                <span>Girar 90º</span>
              </button>

              <button
                type="button"
                onClick={rotatePiece45}
                className="px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 rounded font-bold text-[11px] flex items-center gap-1"
                title="Girar peça em 45 graus para corte em ângulo"
              >
                <RotateCw className="w-3 h-3" />
                <span>Girar 45º</span>
              </button>

              {selectedPiece.isTrapezoid && (
                <button
                  type="button"
                  onClick={flipTrapezoidPiece}
                  className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded font-bold text-[11px] flex items-center gap-1"
                  title="Inverter lados do trapézio"
                >
                  <span>⇄ Inverter (180º)</span>
                </button>
              )}
            </div>

            {/* Alinhamentos Rápidos */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-indigo-200">
              <button
                type="button"
                onClick={() => alignPiece('top')}
                className="px-1.5 py-1 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-bold"
                title="Alinhar ao topo (Y=0)"
              >
                Topo
              </button>
              <button
                type="button"
                onClick={() => alignPiece('bottom')}
                className="px-1.5 py-1 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-bold"
                title="Alinhar à base"
              >
                Base
              </button>
              <button
                type="button"
                onClick={() => alignPiece('left')}
                className="px-1.5 py-1 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-bold"
                title="Alinhar à esquerda (X=0)"
              >
                Esq.
              </button>
              <button
                type="button"
                onClick={() => alignPiece('right')}
                className="px-1.5 py-1 hover:bg-slate-100 text-slate-700 rounded text-[11px] font-bold"
                title="Alinhar à direita"
              >
                Dir.
              </button>
            </div>

            {/* Micro-Ajuste com Setas */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-indigo-200">
              <select
                value={stepSizeMm}
                onChange={(e) => setStepSizeMm(Number(e.target.value))}
                className="text-[10px] font-bold bg-slate-50 border border-slate-200 rounded px-1 py-0.5"
                title="Tamanho do passo de ajuste"
              >
                <option value={1}>±1mm</option>
                <option value={5}>±5mm</option>
                <option value={10}>±10mm</option>
                <option value={50}>±50mm</option>
              </select>

              <button
                type="button"
                onClick={() => moveSelectedPiece(-stepSizeMm, 0)}
                className="p-1 hover:bg-slate-100 rounded text-slate-700"
                title={`Mover para Esquerda (-${stepSizeMm}mm)`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveSelectedPiece(stepSizeMm, 0)}
                className="p-1 hover:bg-slate-100 rounded text-slate-700"
                title={`Mover para Direita (+${stepSizeMm}mm)`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveSelectedPiece(0, -stepSizeMm)}
                className="p-1 hover:bg-slate-100 rounded text-slate-700"
                title={`Mover para Cima (-${stepSizeMm}mm)`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => moveSelectedPiece(0, stepSizeMm)}
                className="p-1 hover:bg-slate-100 rounded text-slate-700"
                title={`Mover para Baixo (+${stepSizeMm}mm)`}
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blueprint Canvas com Suporte a Rotação de Chapa & Drag and Drop */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto select-none">
        <div
          className="transition-transform duration-200 origin-center mx-auto"
          style={{
            width: `${svgWidth * zoom}px`,
            transform: `rotate(${sheetRotation}deg)`,
            transformOrigin: 'center center',
          }}
        >
          {/* Eixos Dimensionais */}
          <div className="flex justify-between text-[11px] font-mono text-slate-400 font-bold uppercase pb-1.5 px-1">
            <span>0 mm</span>
            <span className="text-slate-600">
              {isManualEditMode ? '✋ MODO ARRASTAR E SOLTAR ATIVO — Clique e arraste as peças' : `Eixo Longitudinal (Comprimento Total): ${currentPlan.length} mm ➔`}
            </span>
            <span>{currentPlan.length} mm</span>
          </div>

          <div
            className={`relative border-2 rounded-lg shadow-sm overflow-hidden bg-white ${
              isManualEditMode ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-300'
            }`}
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${currentPlan.length} ${currentPlan.width}`}
              className="w-full h-auto block"
              style={{ maxHeight: '450px', minHeight: '150px', cursor: isManualEditMode ? 'crosshair' : 'default' }}
              onPointerMove={handlePointerMoveCanvas}
              onPointerUp={handlePointerUpCanvas}
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
                      className={`transition-opacity ${isManualEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                        isDragging ? 'opacity-70' : 'hover:opacity-90'
                      }`}
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
                        className="font-sans select-none drop-shadow-sm uppercase"
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
                    className={`transition-opacity ${isManualEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${
                      isDragging ? 'opacity-70' : 'hover:opacity-90'
                    }`}
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
                      className="font-sans select-none drop-shadow-sm uppercase"
                    >
                      #{p.cutIndex} {p.pieceName} ({p.length} × {p.devStart} mm)
                      {p.rotation ? ` [${p.rotation}º]` : ''}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between text-[11px] font-mono text-slate-400 font-bold uppercase pt-1.5 px-1">
            <span>0 mm</span>
            <span className="text-slate-600">Desenvolvimento (Largura da Chapa): {currentPlan.width} mm</span>
            <span>{currentPlan.width} mm</span>
          </div>
        </div>
      </div>

      {/* Roteiro e Sequência Técnica de Corte */}
      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Peças cortadas */}
          <div>
            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Peças nesta Chapa ({currentPlan.placedPieces.length})
            </h5>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {currentPlan.placedPieces.map((p, pIdx) => {
                const color = PIECE_COLORS[(p.colorIndex || pIdx) % PIECE_COLORS.length];
                const isSelected = selectedPieceId === p.pieceId;

                return (
                  <div
                    key={`list-p-${p.pieceId}-${pIdx}`}
                    onClick={() => setSelectedPieceId(isSelected ? null : p.pieceId)}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs cursor-pointer border transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-blue-400 text-blue-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color.stroke }}
                      ></span>
                      <span className="font-bold">#{p.cutIndex} {p.pieceName}</span>
                      {p.isTrapezoid && (
                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                          {p.isFlipped ? '📐 Trapézio Invertido' : '📐 Trapézio'}
                        </span>
                      )}
                      {p.rotation ? (
                        <span className="px-1 py-0.2 bg-indigo-100 text-indigo-700 rounded text-[10px] font-mono">
                          {p.rotation}º
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-slate-500 font-semibold text-right">
                      <div>{p.isTrapezoid ? `${p.devStart}→${p.devEnd} mm` : `${p.devStart} mm`} × {p.length} mm</div>
                      <div className="text-[10px] text-slate-400">X: {p.x}mm, Y: {p.y}mm</div>
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
