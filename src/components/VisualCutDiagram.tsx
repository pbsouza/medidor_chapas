import React, { useState } from 'react';
import { SheetCutPlan } from '../types';
import { GeometryService } from '../services/GeometryService';
import { Scissors, Layers, ZoomIn, ZoomOut, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  plan: SheetCutPlan;
  index: number;
}

// Cores técnicas de alta visibilidade e contraste para cada peça (Geometric Balance Theme)
const PIECE_COLORS = [
  { fill: 'rgba(59, 130, 246, 0.22)', stroke: '#2563eb', text: '#1e3a8a', name: 'Azul' },
  { fill: 'rgba(16, 185, 129, 0.22)', stroke: '#059669', text: '#064e3b', name: 'Verde' },
  { fill: 'rgba(245, 158, 11, 0.22)', stroke: '#d97706', text: '#78350f', name: 'Âmbar' },
  { fill: 'rgba(139, 92, 246, 0.22)', stroke: '#7c3aed', text: '#4c1d95', name: 'Roxo' },
  { fill: 'rgba(236, 72, 153, 0.22)', stroke: '#db2777', text: '#831843', name: 'Rosa' },
  { fill: 'rgba(6, 182, 212, 0.22)', stroke: '#0891b2', text: '#164e63', name: 'Ciano' },
];

export const VisualCutDiagram: React.FC<Props> = ({ plan, index }) => {
  const [zoom, setZoom] = useState(1);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);

  const svgWidth = 900;
  const scale = svgWidth / plan.length;
  const svgHeight = Math.max(160, plan.width * scale);

  return (
    <div
      id={`sheet-plan-card-${plan.sheetId}-${index}`}
      className="bg-white border-2 border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm mb-6 flex flex-col relative"
    >
      {/* Cabeçalho da Chapa com Visual Técnico Geometric Balance */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${
              plan.isCoilCut
                ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 shadow-sm'
                : plan.isScrap
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-blue-100 text-blue-700 border border-blue-200'
            }`}
          >
            {plan.isCoilCut
              ? `🌀 ROLO / BOBINA • DESENROLAR ${(plan.length / 1000).toFixed(2)}m`
              : plan.isScrap
              ? '♻️ RETALHO REUTILIZADO'
              : '▦ CHAPA PRINCIPAL'}
          </span>
          <div>
            <h4 className="text-slate-900 font-black text-sm sm:text-base flex items-center gap-2">
              <span>{plan.sheetName}</span>
              <span className="text-xs font-mono text-slate-500 font-normal">
                ({plan.width} × {plan.length} mm)
              </span>
            </h4>
            <div className="text-xs text-slate-500 font-medium">
              Material: <strong className="text-slate-700">{plan.material} ({plan.thickness})</strong> • Peças: <strong className="text-slate-900">{plan.placedPieces.length}</strong>
              {plan.isCoilCut && (
                <span className="ml-2 text-indigo-700 font-bold">
                  (Corte sob medida do rolo de 30-40m)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Métricas de Rendimento & Controles de Zoom */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Aproveitamento</div>
            <div className="text-xl font-black text-emerald-600 font-mono">
              {plan.yieldPercentage}%
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200"></div>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Desperdício</div>
            <div className="text-sm font-bold text-slate-700 font-mono">
              {GeometryService.formatAreaM2(plan.wasteAreaMm2)}
            </div>
          </div>

          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 ml-2">
            <button
              onClick={() => setZoom((z) => Math.max(0.7, z - 0.15))}
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
              onClick={() => setZoom((z) => Math.min(1.8, z + 0.15))}
              className="p-1 hover:bg-white text-slate-600 rounded transition-colors"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Blueprint Canvas com Padrão Radial Dot Matrix */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 overflow-x-auto">
        <div
          className="transition-transform duration-150 origin-top-left mx-auto"
          style={{ width: `${svgWidth * zoom}px` }}
        >
          {/* Eixos Dimensionais */}
          <div className="flex justify-between text-[11px] font-mono text-slate-400 font-bold uppercase pb-1.5 px-1">
            <span>0 mm</span>
            <span className="text-slate-600">Eixo Longitudinal (Comprimento Total): {plan.length} mm ➔</span>
            <span>{plan.length} mm</span>
          </div>

          <div
            className="relative border-2 border-slate-300 rounded-lg shadow-sm overflow-hidden bg-white"
            style={{
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            <svg
              viewBox={`0 0 ${plan.length} ${plan.width}`}
              className="w-full h-auto block"
              style={{ maxHeight: '420px', minHeight: '140px' }}
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
                width={plan.length}
                height={plan.width}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
              />

              {/* Sobras e Retalhos Identificados */}
              {plan.remnants.map((r, rIdx) => (
                <g key={`rem-${r.id}-${rIdx}`}>
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
                  {r.length > 300 && r.width > 80 && (
                    <text
                      x={r.x + r.length / 2}
                      y={r.y + r.width / 2 + 5}
                      fill={r.isUsable ? '#b45309' : '#dc2626'}
                      fontSize={Math.max(14, Math.min(22, r.width / 4))}
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono select-none uppercase tracking-wider"
                    >
                      {r.isUsable ? `♻️ SOBRA: ${r.width}×${r.length}mm (${r.code})` : `APARA: ${r.width}×${r.length}mm`}
                    </text>
                  )}
                </g>
              ))}

              {/* Peças Posicionadas */}
              {plan.placedPieces.map((p, pIdx) => {
                const color = PIECE_COLORS[(p.colorIndex || pIdx) % PIECE_COLORS.length];
                const isSelected = selectedPieceId === p.pieceId;

                if (p.isTrapezoid) {
                  const points = p.polygonPoints || `${p.x},${p.y} ${p.x + p.length},${p.y} ${p.x + p.length},${p.y + p.devEnd} ${p.x},${p.y + p.devStart}`;
                  const avgHeight = (p.devStart + p.devEnd) / 2;
                  const textY = p.isFlipped ? p.y + avgHeight * 0.75 + 5 : p.y + avgHeight * 0.45 + 5;

                  return (
                    <g
                      key={`piece-${p.pieceId}-${pIdx}`}
                      onClick={() => setSelectedPieceId(isSelected ? null : p.pieceId)}
                      className="cursor-pointer transition-opacity hover:opacity-90"
                    >
                      <polygon
                        points={points}
                        fill={color.fill}
                        stroke={isSelected ? '#1e293b' : color.stroke}
                        strokeWidth={isSelected ? 3.5 : 2}
                      />

                      {/* Texto de Identificação da Peça */}
                      <text
                        x={p.x + p.length / 2}
                        y={textY}
                        fill={color.text}
                        fontSize={Math.max(12, Math.min(20, avgHeight / 3.5))}
                        fontWeight="bold"
                        textAnchor="middle"
                        className="font-sans select-none drop-shadow-sm uppercase"
                      >
                        #{p.cutIndex} {p.pieceName} ({p.length}mm | {p.devStart}→{p.devEnd}mm)
                        {p.isFlipped ? ' [INVERTIDA]' : ''}
                      </text>

                      {/* Cotas nas extremidades do trapézio se o zoom/tamanho permitir */}
                      {p.length > 400 && (
                        <>
                          <text
                            x={p.x + 20}
                            y={p.isFlipped ? p.y + p.devStart - 6 : p.y + p.devStart - 6}
                            fill={color.text}
                            fontSize={11}
                            fontWeight="bold"
                            className="font-mono select-none opacity-80"
                          >
                            ◄ {p.devStart}mm
                          </text>
                          <text
                            x={p.x + p.length - 60}
                            y={p.isFlipped ? p.y + p.devEnd - 6 : p.y + p.devEnd - 6}
                            fill={color.text}
                            fontSize={11}
                            fontWeight="bold"
                            className="font-mono select-none opacity-80"
                          >
                            {p.devEnd}mm ►
                          </text>
                        </>
                      )}
                    </g>
                  );
                }

                return (
                  <g
                    key={`piece-${p.pieceId}-${pIdx}`}
                    onClick={() => setSelectedPieceId(isSelected ? null : p.pieceId)}
                    className="cursor-pointer transition-opacity hover:opacity-90"
                  >
                    <rect
                      x={p.x}
                      y={p.y}
                      width={p.length}
                      height={p.devStart}
                      fill={color.fill}
                      stroke={isSelected ? '#1e293b' : color.stroke}
                      strokeWidth={isSelected ? 3.5 : 2}
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
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between text-[11px] font-mono text-slate-400 font-bold uppercase pt-1.5 px-1">
            <span>0 mm</span>
            <span className="text-slate-600">Desenvolvimento (Largura da Chapa): {plan.width} mm</span>
            <span>{plan.width} mm</span>
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
              Peças nesta Chapa ({plan.placedPieces.length})
            </h5>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {plan.placedPieces.map((p, pIdx) => {
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
                      {p.trapezoidPairName && (
                        <span className="hidden sm:inline-block text-[10px] text-purple-600 font-medium">
                          (Par: {p.trapezoidPairName})
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-slate-500 font-semibold text-right">
                      <div>{p.isTrapezoid ? `${p.devStart}→${p.devEnd} mm` : `${p.devStart} mm`} × {p.length} mm</div>
                      {p.trapezoidDiagonalGuide && (
                        <div className="text-[10px] text-slate-400 font-sans">{p.trapezoidDiagonalGuide}</div>
                      )}
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
              {plan.cutSequence.map((step, sIdx) => (
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
        {plan.remnants.some((r) => r.isUsable) && (
          <div className="mt-3.5 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="text-xs text-amber-900">
              <strong>Sobra Reaproveitável Detectada:</strong> Este corte gerará{' '}
              {plan.remnants.filter((r) => r.isUsable).map((r) => `${r.width} × ${r.length} mm (${r.code})`).join(', ')}.
              Ao confirmar a ordem, esses retalhos serão automaticamente integrados ao estoque!
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
