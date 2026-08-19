import React, { useState, useRef } from 'react';
import { SheetItem, UnitType } from '../types';
import { GeometryService } from '../services/GeometryService';
import {
  Layers,
  Plus,
  Trash2,
  Edit2,
  Package,
  Check,
  X,
  Search,
  Filter,
  Minus,
  Copy,
  AlertTriangle,
  RefreshCw,
  AlertOctagon,
} from 'lucide-react';

interface Props {
  sheets: SheetItem[];
  onAddSheet: (sheet: Omit<SheetItem, 'id' | 'createdAt'>) => void;
  onUpdateSheet: (sheet: SheetItem) => void;
  onDeleteSheet: (id: string) => void;
}

const COMMON_SHEET_PRESETS = [
  { name: '🌀 Bobina Rolo 1200mm × 40m', width: 1200, length: 40000, isCoil: true },
  { name: '🌀 Bobina Rolo 1000mm × 30m', width: 1000, length: 30000, isCoil: true },
  { name: '1000 × 3000 mm', width: 1000, length: 3000, isCoil: false },
  { name: '800 × 3000 mm', width: 800, length: 3000, isCoil: false },
  { name: '600 × 5000 mm', width: 600, length: 5000, isCoil: false },
  { name: '1200 × 3000 mm', width: 1200, length: 3000, isCoil: false },
];

export const SheetInventory: React.FC<Props> = ({
  sheets,
  onAddSheet,
  onUpdateSheet,
  onDeleteSheet,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMaterial, setFilterMaterial] = useState('todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [sheetToDelete, setSheetToDelete] = useState<SheetItem | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  // Campos do Formulário
  const [name, setName] = useState('');
  const [width, setWidth] = useState<number>(1000);
  const [length, setLength] = useState<number>(3000);
  const [quantity, setQuantity] = useState<number>(5);
  const [material, setMaterial] = useState('Galvanizado');
  const [thickness, setThickness] = useState('0.50mm');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [isCoil, setIsCoil] = useState(false);
  const [inputUnit, setInputUnit] = useState<UnitType>('mm');

  const filteredSheets = sheets.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.material.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMaterial = filterMaterial === 'todos' || s.material === filterMaterial;
    return matchesSearch && matchesMaterial;
  });

  const resetForm = () => {
    setName('');
    setWidth(1000);
    setLength(3000);
    setQuantity(5);
    setMaterial('Galvanizado');
    setThickness('0.50mm');
    setColor('');
    setNotes('');
    setIsCoil(false);
    setInputUnit('mm');
    setEditingSheetId(null);
    setIsFormOpen(false);
  };

  const handleOpenEdit = (sheet: SheetItem) => {
    setEditingSheetId(sheet.id);
    setName(sheet.name);
    setWidth(sheet.width);
    setLength(sheet.length);
    setQuantity(sheet.quantity);
    setMaterial(sheet.material);
    setThickness(sheet.thickness);
    setColor(sheet.color || '');
    setNotes(sheet.notes || '');
    setIsCoil(!!sheet.isCoil);
    setInputUnit('mm');
    setIsFormOpen(true);

    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleDuplicate = (sheet: SheetItem) => {
    onAddSheet({
      name: `${sheet.name} (Cópia)`,
      width: sheet.width,
      length: sheet.length,
      isCoil: sheet.isCoil,
      quantity: sheet.quantity || 1,
      material: sheet.material,
      thickness: sheet.thickness,
      color: sheet.color,
      notes: sheet.notes,
    });
  };

  // Ajuste Rápido de Quantidade (+1 ou -1) direto no Card
  const handleQuickQuantityChange = (sheet: SheetItem, delta: number) => {
    const newQty = Math.max(0, (sheet.quantity || 0) + delta);
    onUpdateSheet({
      ...sheet,
      quantity: newQty,
    });
  };

  // Ajuste Direto de Quantidade
  const handleDirectQuantityChange = (sheet: SheetItem, val: number) => {
    const newQty = Math.max(0, val);
    onUpdateSheet({
      ...sheet,
      quantity: newQty,
    });
  };

  // Confirmação de Exclusão (sem window.confirm nativo)
  const confirmDelete = () => {
    if (sheetToDelete) {
      onDeleteSheet(sheetToDelete.id);
      setSheetToDelete(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const widthMm = GeometryService.convertToMm(width, inputUnit);
    const lengthMm = GeometryService.convertToMm(length, inputUnit);

    if (editingSheetId) {
      const existing = sheets.find((s) => s.id === editingSheetId);
      if (existing) {
        onUpdateSheet({
          ...existing,
          name:
            name ||
            (isCoil
              ? `Bobina Rolo ${widthMm}mm (${(lengthMm / 1000).toFixed(0)}m)`
              : `Chapa ${widthMm}×${lengthMm}mm`),
          width: widthMm,
          length: lengthMm,
          isCoil,
          quantity: Math.max(0, quantity),
          material,
          thickness,
          color,
          notes,
        });
      }
    } else {
      onAddSheet({
        name:
          name ||
          (isCoil
            ? `Bobina Rolo ${widthMm}mm (${(lengthMm / 1000).toFixed(0)}m)`
            : `Chapa ${widthMm}×${lengthMm}mm`),
        width: widthMm,
        length: lengthMm,
        isCoil,
        quantity: Math.max(1, quantity),
        material,
        thickness,
        color,
        notes,
      });
    }

    resetForm();
  };

  const handleApplyPreset = (preset: (typeof COMMON_SHEET_PRESETS)[0]) => {
    setWidth(preset.width);
    setLength(preset.length);
    setIsCoil(!!preset.isCoil);
    if (!name || name.startsWith('Chapa') || name.startsWith('🌀 Bobina')) {
      setName(preset.name);
    }
  };

  return (
    <div className="space-y-6" id="sheet-inventory-view">
      {/* Header Geometric Balance */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
            Estoque de Chapas Inteiras
          </h1>
          <p className="text-slate-500 text-sm">
            Bobinas desbobinadas e chapas virgens disponíveis para calhas, rufos e cortes
          </p>
        </div>

        <button
          onClick={() => {
            if (isFormOpen && !editingSheetId) {
              setIsFormOpen(false);
            } else {
              resetForm();
              setIsFormOpen(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md shadow-blue-900/20 transition-all active:scale-95 cursor-pointer"
        >
          {isFormOpen && !editingSheetId ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isFormOpen && !editingSheetId ? 'Fechar Cadastro' : '+ Cadastrar Nova Chapa'}</span>
        </button>
      </header>

      {/* Modal Customizado de Confirmação de Exclusão */}
      {sheetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Chapa do Estoque</h3>
                <p className="text-xs text-slate-500">Esta ação removerá o item permanentemente.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">{sheetToDelete.name}</div>
              <div className="text-slate-600">
                Dimensões: <strong>{sheetToDelete.width} × {sheetToDelete.length} mm</strong> | Qtd: <strong>{sheetToDelete.quantity} un</strong>
              </div>
              <div className="text-slate-500">Material: {sheetToDelete.material} ({sheetToDelete.thickness})</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setSheetToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir Chapa</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de Cadastro / Edição */}
      {isFormOpen && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="bg-white border-2 border-blue-400 rounded-xl p-5 sm:p-6 shadow-lg space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  {editingSheetId ? 'Editar Dados da Chapa' : 'Cadastrar Nova Chapa no Estoque'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {editingSheetId
                    ? 'Altere a quantidade, dimensões ou especificações da chapa selecionada'
                    : 'Preencha as dimensões e o total disponível em estoque'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {(['mm', 'cm', 'm'] as UnitType[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setInputUnit(u)}
                  className={`px-2.5 py-1 text-xs font-bold rounded font-mono transition-colors cursor-pointer ${
                    inputUnit === u
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Medidas Padrão Rápidas */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Tamanhos Padrão de Mercado (Preenchimento Rápido):
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_SHEET_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-md border border-slate-200 transition-colors cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-600 block mb-1">Identificação / Nome:</label>
              <input
                type="text"
                placeholder="Ex: Chapa Galvanizada 1000×3000"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-colors"
              />
            </div>

            {/* Toggle de Bobina Contínua */}
            <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between p-3 bg-indigo-50/80 rounded-lg border border-indigo-200">
              <div>
                <strong className="text-xs text-indigo-900 block">
                  Tipo de Estoque: Rolo / Bobina Contínua (30 a 40 metros)
                </strong>
                <span className="text-[11px] text-indigo-700">
                  Permite ao otimizador calcular o tamanho exato da folha a ser desenrolada sob medida para as peças.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsCoil(!isCoil)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  isCoil
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                {isCoil ? '🌀 Bobina Ativada' : 'Chapa Padrão'}
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                Desenvolvimento / Largura ({inputUnit}):
              </label>
              <input
                type="number"
                step="any"
                required
                value={width}
                onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                Comprimento ({inputUnit}):
              </label>
              <input
                type="number"
                step="any"
                required
                value={length}
                onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                Quantidade em Estoque (Unidades):
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-center bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Material:</label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="Galvanizado">Galvanizado</option>
                <option value="Galvalume">Galvalume</option>
                <option value="Alumínio">Alumínio</option>
                <option value="Inox">Inox</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Espessura:</label>
              <select
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
              >
                <option value="0.43mm">0.43mm (Chapa 28)</option>
                <option value="0.50mm">0.50mm (Chapa 26 - Padrão)</option>
                <option value="0.65mm">0.65mm (Chapa 24)</option>
                <option value="0.80mm">0.80mm (Chapa 22)</option>
                <option value="1.00mm">1.00mm (Chapa 20)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Cor / Acabamento:</label>
              <input
                type="text"
                placeholder="Ex: Pintura Branca, Natural"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md transition-all active:scale-95 cursor-pointer"
            >
              {editingSheetId ? 'Salvar Alterações da Chapa' : 'Salvar no Estoque'}
            </button>
          </div>
        </form>
      )}

      {/* Barra de Filtro e Pesquisa */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou material..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Material:</span>
          <select
            value={filterMaterial}
            onChange={(e) => setFilterMaterial(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-xs text-slate-700 px-2.5 py-1.5 rounded-lg focus:outline-none font-medium"
          >
            <option value="todos">Todos os Materiais</option>
            <option value="Galvanizado">Galvanizado</option>
            <option value="Galvalume">Galvalume</option>
            <option value="Alumínio">Alumínio</option>
            <option value="Inox">Inox</option>
          </select>
        </div>
      </div>

      {/* Grid de Chapas Cadastradas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSheets.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white border border-dashed border-slate-300 rounded-xl p-8">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Nenhuma chapa encontrada</h4>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre novas chapas virgens ou bobinas para utilizar no plano de corte.
            </p>
            <button
              onClick={() => {
                resetForm();
                setIsFormOpen(true);
              }}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              + Cadastrar Chapa
            </button>
          </div>
        ) : (
          filteredSheets.map((sheet) => {
            const areaM2 = (sheet.width * sheet.length) / 1_000_000;
            const isOutOfStock = sheet.quantity <= 0;

            return (
              <div
                key={sheet.id}
                className={`bg-white border rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between ${
                  isOutOfStock
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200 hover:border-blue-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                        {sheet.material} ({sheet.thickness})
                      </span>
                      {(sheet.isCoil || sheet.length >= 20000) && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded border border-indigo-200">
                          🌀 Bobina {(sheet.length / 1000).toFixed(0)}m
                        </span>
                      )}
                    </div>

                    {isOutOfStock ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1 border border-red-200">
                        <AlertTriangle className="w-3 h-3" />
                        Zerado
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {sheet.quantity} {sheet.quantity === 1 ? 'unidade' : 'unidades'}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{sheet.name}</h3>

                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Dimensões
                      </span>
                      <span className="text-slate-900 font-bold">
                        {sheet.width} × {sheet.length} mm
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Área Unit.
                      </span>
                      <span className="text-slate-700 font-semibold">{areaM2.toFixed(2)} m²</span>
                    </div>
                  </div>

                  {sheet.color && (
                    <p className="text-xs text-slate-500 mt-2">
                      Acabamento: <strong className="text-slate-700">{sheet.color}</strong>
                    </p>
                  )}

                  {/* Controle Rápido de Quantidade do Estoque (+ / -) */}
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Alterar Estoque:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleQuickQuantityChange(sheet, -1)}
                        disabled={sheet.quantity <= 0}
                        title="Diminuir 1 unidade"
                        className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-md font-bold text-sm transition-colors cursor-pointer"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        value={sheet.quantity}
                        onChange={(e) =>
                          handleDirectQuantityChange(sheet, parseInt(e.target.value, 10) || 0)
                        }
                        className="w-14 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded-md py-1 text-slate-900 focus:outline-none focus:border-blue-500"
                      />

                      <button
                        type="button"
                        onClick={() => handleQuickQuantityChange(sheet, 1)}
                        title="Aumentar 1 unidade"
                        className="w-7 h-7 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md font-bold text-sm transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickQuantityChange(sheet, 5)}
                        title="Adicionar +5 unidades"
                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[10px] font-bold transition-colors ml-1 cursor-pointer"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleDuplicate(sheet)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-medium transition-colors cursor-pointer"
                    title="Duplicar chapa"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicar</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(sheet)}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                      title="Editar dimensões e dados completos"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={() => setSheetToDelete(sheet)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Excluir chapa do estoque"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
