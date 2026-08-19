import React, { useState, useRef } from 'react';
import { AIService } from '../services/AIService';
import { CutPiece } from '../types';
import {
  FileText,
  Upload,
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportPieces: (pieces: CutPiece[]) => void;
}

export const PdfImportModal: React.FC<Props> = ({ isOpen, onClose, onImportPieces }) => {
  const [file, setFile] = useState<File | null>(null);
  const [hints, setHints] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedPieces, setExtractedPieces] = useState<CutPiece[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
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
        alert(result.documentSummary || 'Não foi possível analisar o arquivo PDF.');
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
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 uppercase">
                Importar PDF com IA Vision
              </h3>
              <p className="text-xs text-slate-500">
                Leitura técnica de pranchas arquitetônicas, memoriais ou orçamentos em PDF
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {!file ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50 rounded-xl p-8 text-center cursor-pointer transition-colors space-y-2"
            >
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-800 uppercase">
                Clique para selecionar um documento PDF
              </div>
              <p className="text-[11px] text-slate-500">
                Projetos estruturais, detalhes de rufos, calhas e tabelas de corte
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-amber-600" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">{file.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setExtractedPieces([]);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Instruções específicas para a IA (Opcional):
                </label>
                <input
                  type="text"
                  placeholder="Ex: Focar na página de detalhes de rufos e pingadeiras"
                  value={hints}
                  onChange={(e) => setHints(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                disabled={isLoading}
                onClick={handleAnalyze}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-md shadow-amber-900/30 flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Lendo PDF com IA...' : 'PROCESSAR PROJETO PDF'}</span>
              </button>
            </div>
          )}

          {summary && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Resumo da Análise Técnica:</span>
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
