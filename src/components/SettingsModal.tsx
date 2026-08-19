import React, { useState } from 'react';
import { MachineSettings, PriorityMode, UnitType } from '../types';
import { StorageService } from '../services/StorageService';
import {
  Settings,
  X,
  Sliders,
  ShieldCheck,
  Save,
  Download,
  Upload,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: MachineSettings;
  onSaveSettings: (settings: MachineSettings) => void;
  onDataResetOrRestored: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onDataResetOrRestored,
}) => {
  const [maxCutLength, setMaxCutLength] = useState(settings.maxCutLength || 7000);
  const [spliceOverlapLength, setSpliceOverlapLength] = useState(settings.spliceOverlapLength || 100);
  const [autoSplitLongPieces, setAutoSplitLongPieces] = useState(settings.autoSplitLongPieces !== false);
  const [supportCoilRolls, setSupportCoilRolls] = useState(settings.supportCoilRolls !== false);
  const [kerf, setKerf] = useState(settings.kerf);
  const [safetyMargin, setSafetyMargin] = useState(settings.safetyMargin);
  const [defaultUnit, setDefaultUnit] = useState<UnitType>(settings.defaultUnit);
  const [defaultPriority, setDefaultPriority] = useState<PriorityMode>(settings.defaultPriority);
  const [preferredWidth, setPreferredWidth] = useState<number>(settings.preferredWidth || 0);
  const [prioritizeMostInStock, setPrioritizeMostInStock] = useState<boolean>(settings.prioritizeMostInStock || false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      ...settings,
      maxCutLength,
      spliceOverlapLength,
      autoSplitLongPieces,
      supportCoilRolls,
      kerf,
      safetyMargin,
      defaultUnit,
      defaultPriority,
      preferredWidth: preferredWidth > 0 ? preferredWidth : undefined,
      prioritizeMostInStock,
    });
    onClose();
  };

  const handleExportBackup = () => {
    StorageService.exportBackup();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const success = StorageService.importBackup(jsonStr);
        if (success) {
          alert('Backup restaurado com sucesso!');
          onDataResetOrRestored();
          onClose();
        } else {
          alert('Arquivo de backup inválido.');
        }
      } catch (err) {
        alert('Erro ao processar arquivo de backup.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho Geometric Balance */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 uppercase">
                Parâmetros da Guilhotina & Sistema
              </h3>
              <p className="text-xs text-slate-500">
                Limites físicos de corte, espessura da lâmina e preferências
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 mt-4">
          {/* Guilhotina */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              1. Limites Físicos da Guilhotina
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Comprimento Máx. Guilhotina (mm):
                </label>
                <input
                  type="number"
                  min="1000"
                  max="12000"
                  step="100"
                  value={maxCutLength}
                  onChange={(e) => setMaxCutLength(parseFloat(e.target.value) || 7000)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Transpasse de Emenda (mm):
                </label>
                <input
                  type="number"
                  min="20"
                  max="500"
                  step="10"
                  value={spliceOverlapLength}
                  onChange={(e) => setSpliceOverlapLength(parseFloat(e.target.value) || 100)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Peças maiores que {maxCutLength/1000}m são divididas ao meio com {spliceOverlapLength/10}cm de sobreposição para emenda (ex: peça de 7,10m = 2 lances simétricos de 3,60m).
            </span>

            {/* Toggles de Bobina e Divisão Automática */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="flex items-center justify-between text-xs text-slate-800 font-semibold cursor-pointer">
                <span>✂️ Divisão Simétrica Automática ao Meio (&gt; {maxCutLength/1000}m)</span>
                <input
                  type="checkbox"
                  checked={autoSplitLongPieces}
                  onChange={(e) => setAutoSplitLongPieces(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-800 font-semibold cursor-pointer">
                <span>🌀 Otimizar Corte Contínuo de Bobinas (30 a 40m)</span>
                <input
                  type="checkbox"
                  checked={supportCoilRolls}
                  onChange={(e) => setSupportCoilRolls(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Espessura da Lâmina / Kerf (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.5"
                  value={kerf}
                  onChange={(e) => setKerf(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Margem de Segurança (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={safetyMargin}
                  onChange={(e) => setSafetyMargin(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Preferências Padrão */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              2. Preferências Padrão
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Unidade Padrão:
                </label>
                <select
                  value={defaultUnit}
                  onChange={(e) => setDefaultUnit(e.target.value as UnitType)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none"
                >
                  <option value="mm">Milímetros (mm)</option>
                  <option value="cm">Centímetros (cm)</option>
                  <option value="m">Metros (m)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Algoritmo Prioritário:
                </label>
                <select
                  value={defaultPriority}
                  onChange={(e) => setDefaultPriority(e.target.value as PriorityMode)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none"
                >
                  <option value="most_stock_first">📦 Chapa com Mais Estoque (Maior Quantidade)</option>
                  <option value="preferred_width">📏 Largura de Chapa Preferida</option>
                  <option value="use_scraps_first">♻️ Usar Primeiro Retalhos</option>
                  <option value="max_yield">🎯 Máximo Rendimento (%)</option>
                  <option value="fewest_sheets">▦ Menor Número de Chapas</option>
                  <option value="balanced">⚖️ Equilibrado</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-700 font-bold block mb-1">
                  Largura de Chapa Preferida (mm):
                </label>
                <input
                  type="number"
                  min="0"
                  max="3000"
                  step="50"
                  placeholder="Ex: 1200 ou 1000 (0 = Qualquer)"
                  value={preferredWidth || ''}
                  onChange={(e) => setPreferredWidth(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg font-mono font-bold focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="col-span-2 flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-800">
                  <strong className="block">Priorizar Chapa com Maior Quantidade:</strong>
                  <span className="text-[10px] text-slate-500">
                    Consome primeiro as chapas em abundância no estoque
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={prioritizeMostInStock}
                  onChange={(e) => setPrioritizeMostInStock(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* Backup e Restauração de Dados */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              3. Backup & Restauração
            </h4>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>Exportar Backup JSON</span>
              </button>

              <label className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-amber-600" />
                <span>Restaurar Backup</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm"
            >
              Salvar Parâmetros
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
