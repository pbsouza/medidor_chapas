import React from 'react';
import { ScrapItem } from '../types';
import { GeometryService } from '../services/GeometryService';
import { QrCode, Printer, X, Tag } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scrap: ScrapItem | null;
}

export const QrCodeModal: React.FC<Props> = ({ isOpen, onClose, scrap }) => {
  if (!isOpen || !scrap) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho Geometric Balance */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-bold text-slate-900 uppercase">
              Etiqueta de Identificação de Retalho
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pré-visualização da Etiqueta para Impressão */}
        <div className="mt-4 p-5 bg-white text-slate-950 rounded-xl border-2 border-slate-900 shadow-md font-sans" id="printable-scrap-label">
          {/* Topo da Etiqueta */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2 mb-3">
            <div>
              <span className="text-[9px] font-black tracking-widest uppercase text-slate-600 block">
                CORTEFÁCIL — SISTEMA DE CORTE
              </span>
              <span className="text-2xl font-black font-mono tracking-tight text-slate-950">
                RETALHO {scrap.code}
              </span>
            </div>
            <div className="px-2 py-0.5 bg-slate-900 text-white font-bold text-[11px] rounded uppercase font-mono">
              OFICINA
            </div>
          </div>

          {/* Medidas e QR Code */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  {scrap.widthEnd !== undefined && scrap.widthEnd !== scrap.width
                    ? scrap.widthEnd === 0
                      ? 'Dimensões (Triangular / Cunha):'
                      : 'Dimensões (Trapezoidal):'
                    : 'Dimensões Exatas:'}
                </span>
                <span className="text-lg font-black font-mono text-slate-950">
                  {GeometryService.formatScrapDimensions(scrap, 'mm')}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Material / Espessura:
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {scrap.material} ({scrap.thickness})
                </span>
              </div>

              {scrap.location && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Localização no Galpão:
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    📍 {scrap.location}
                  </span>
                </div>
              )}
            </div>

            {/* QR Code Simulado com SVG Pattern Industrial */}
            <div className="w-24 h-24 bg-slate-50 border border-slate-400 p-1.5 rounded flex flex-col items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <rect x="0" y="0" width="30" height="30" fill="#000" />
                <rect x="5" y="5" width="20" height="20" fill="#fff" />
                <rect x="9" y="9" width="12" height="12" fill="#000" />

                <rect x="70" y="0" width="30" height="30" fill="#000" />
                <rect x="75" y="5" width="20" height="20" fill="#fff" />
                <rect x="79" y="9" width="12" height="12" fill="#000" />

                <rect x="0" y="70" width="30" height="30" fill="#000" />
                <rect x="5" y="75" width="20" height="20" fill="#fff" />
                <rect x="9" y="79" width="12" height="12" fill="#000" />

                <rect x="40" y="10" width="10" height="20" fill="#000" />
                <rect x="55" y="25" width="10" height="15" fill="#000" />
                <rect x="35" y="45" width="30" height="10" fill="#000" />
                <rect x="45" y="65" width="15" height="20" fill="#000" />
                <rect x="75" y="55" width="15" height="15" fill="#000" />
                <rect x="75" y="80" width="20" height="10" fill="#000" />
              </svg>
              <span className="text-[8px] font-mono text-slate-600 mt-0.5 font-bold">{scrap.code}</span>
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-300 text-[9px] text-slate-500 text-center font-mono">
            Cadastrado em: {new Date(scrap.createdAt).toLocaleDateString('pt-BR')} • {GeometryService.formatAreaM2(GeometryService.calculateScrapAreaMm2(scrap))}
          </div>
        </div>

        {/* Botão de Imprimir */}
        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Etiqueta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
