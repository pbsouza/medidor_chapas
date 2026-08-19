import React, { useState, useRef } from 'react';
import { AIService } from '../services/AIService';
import { CutPiece } from '../types';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Image as ImageIcon,
  FolderOpen,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportPieces: (pieces: CutPiece[]) => void;
}

export const PhotoImportModal: React.FC<Props> = ({ isOpen, onClose, onImportPieces }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hints, setHints] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedPieces, setExtractedPieces] = useState<CutPiece[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setExtractedPieces([]);
      setSummary(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;

    setIsLoading(true);
    try {
      const result = await AIService.analyzeDocument(file, hints);
      if (result.success) {
        setExtractedPieces(result.extractedPieces);
        setSummary(result.documentSummary);
        setWarnings(result.warnings || []);
      } else {
        alert(result.documentSummary || 'Não foi possível analisar a imagem.');
      }
    } catch (err: any) {
      alert(`Falha no processamento: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (extractedPieces.length === 0) return;
    onImportPieces(extractedPieces);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header Geometric Balance */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 uppercase">
                Importar Foto com IA Vision
              </h3>
              <p className="text-xs text-slate-500">
                Selecione da galeria ou fotografe anotações de prancheta, croquis e medidas
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {/* Inputs Ocultos: Galeria / Arquivos (sem capture) e Câmera Direta (com capture) */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Área de Seleção / Preview */}
          {!previewUrl ? (
            <div className="space-y-3">
              {/* Botões de Ação Rápida: Galeria vs Câmera */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="p-4 bg-blue-50/80 hover:bg-blue-100/80 border-2 border-blue-200 hover:border-blue-400 rounded-xl flex items-center gap-3 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block group-hover:text-blue-700">
                      Abrir da Galeria
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Escolher foto salva ou arquivo no celular / PC
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="p-4 bg-emerald-50/80 hover:bg-emerald-100/80 border-2 border-emerald-200 hover:border-emerald-400 rounded-xl flex items-center gap-3 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block group-hover:text-emerald-700">
                      Tirar Foto com a Câmera
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Fotografar papel ou prancheta agora
                    </span>
                  </div>
                </button>
              </div>

              {/* Área Drag-and-Drop */}
              <div
                onClick={() => galleryInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-1.5"
              >
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-slate-700 uppercase">
                  Ou arraste uma foto aqui
                </div>
                <p className="text-[11px] text-slate-500">
                  Formatos aceitos: JPG, PNG, WEBP, HEIC (fotos de celular)
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 max-h-56 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-56 w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm"
                    title="Trocar por foto da galeria"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span className="text-[10px] hidden sm:inline">Galeria</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-lg text-xs font-medium flex items-center gap-1 shadow-sm"
                    title="Tirar outra foto"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span className="text-[10px] hidden sm:inline">Câmera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setPreviewUrl(null);
                      setExtractedPieces([]);
                    }}
                    className="p-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-sm"
                    title="Remover"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Dicas opcionais */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Observações / Dicas para a IA (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Todas as calhas são em chapa galvanizada 0.50mm"
                  value={hints}
                  onChange={(e) => setHints(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                disabled={isLoading}
                onClick={handleAnalyze}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Analisando Imagem com Gemini...' : 'PROCESSAR MEDIDAS COM IA'}</span>
              </button>
            </div>
          )}

          {/* Resultados Extraídos */}
          {summary && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Resumo da Leitura Técnica:</span>
              </div>
              <p className="text-xs text-slate-600">{summary}</p>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              {warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {extractedPieces.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Peças Identificadas ({extractedPieces.length}):
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {extractedPieces.map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{p.name}</span>
                      <div className="font-mono text-[11px] text-slate-500">
                        {p.devStart !== p.devEnd ? `${p.devStart}→${p.devEnd} mm` : `${p.devStart} mm`} × {p.length} mm
                      </div>
                    </div>
                    <span className="font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px]">
                      {p.quantity} unid.
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
          >
            Fechar
          </button>
          {extractedPieces.length > 0 && (
            <button
              onClick={handleConfirmImport}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm"
            >
              <span>Importar para o Otimizador</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
