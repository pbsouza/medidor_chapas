import React, { useState } from 'react';
import { ScrapItem, ScrapShapeType, UnitType } from '../types';
import { GeometryService } from '../services/GeometryService';
import { StorageService } from '../services/StorageService';
import {
  Recycle,
  Plus,
  Trash2,
  Edit2,
  QrCode,
  MapPin,
  Search,
  X,
  AlertOctagon,
  Square,
  Triangle,
  Layers,
  HelpCircle,
} from 'lucide-react';

interface Props {
  scraps: ScrapItem[];
  onAddScrap: (scrap: Omit<ScrapItem, 'id' | 'createdAt'>) => void;
  onUpdateScrap: (scrap: ScrapItem) => void;
  onDeleteScrap: (id: string) => void;
  onOpenQrModal: (scrap: ScrapItem) => void;
}

export const ScrapInventory: React.FC<Props> = ({
  scraps,
  onAddScrap,
  onUpdateScrap,
  onDeleteScrap,
  onOpenQrModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'disponivel' | 'utilizado'>('disponivel');
  const [filterShape, setFilterShape] = useState<'todos' | 'retangular' | 'trapezio' | 'triangulo'>('todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScrapId, setEditingScrapId] = useState<string | null>(null);
  const [scrapToDelete, setScrapToDelete] = useState<ScrapItem | null>(null);

  // Formulário
  const [shapeType, setShapeType] = useState<ScrapShapeType>('retangular');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [width, setWidth] = useState<string | number>(600);
  const [widthEnd, setWidthEnd] = useState<string | number>(600);
  const [length, setLength] = useState<string | number>(1200);
  const [quantity, setQuantity] = useState<string | number>(1);
  const [material, setMaterial] = useState('Galvanizado');
  const [thickness, setThickness] = useState('0.50mm');
  const [location, setLocation] = useState('Prateleira A1');
  const [notes, setNotes] = useState('');
  const [inputUnit, setInputUnit] = useState<UnitType>('mm');

  const parseNumInput = (val: string | number, fallback = 0): number => {
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    if (!val || typeof val !== 'string' || val.trim() === '') return fallback;
    const clean = val.replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? fallback : parsed;
  };

  const filteredScraps = scraps.filter((s) => {
    const sShape = s.shapeType || GeometryService.getScrapShapeType(s);
    const matchesSearch =
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.location && s.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
      s.material.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'todos' || s.status === filterStatus;
    const matchesShape = filterShape === 'todos' || sShape === filterShape;
    return matchesSearch && matchesStatus && matchesShape;
  });

  const resetForm = () => {
    setShapeType('retangular');
    setCode('');
    setName('');
    setWidth(600);
    setWidthEnd(600);
    setLength(1200);
    setQuantity(1);
    setMaterial('Galvanizado');
    setThickness('0.50mm');
    setLocation('Prateleira A1');
    setNotes('');
    setEditingScrapId(null);
    setIsFormOpen(false);
  };

  const handleOpenEdit = (scrap: ScrapItem) => {
    const shape = scrap.shapeType || GeometryService.getScrapShapeType(scrap);
    setEditingScrapId(scrap.id);
    setShapeType(shape);
    setCode(scrap.code);
    setName(scrap.name || '');
    setWidth(scrap.width);
    setWidthEnd(scrap.widthEnd !== undefined ? scrap.widthEnd : scrap.width);
    setLength(scrap.length);
    setQuantity(scrap.quantity);
    setMaterial(scrap.material);
    setThickness(scrap.thickness);
    setLocation(scrap.location || '');
    setNotes(scrap.notes || '');
    setIsFormOpen(true);
  };

  const handleSelectShape = (newShape: ScrapShapeType) => {
    setShapeType(newShape);
    const currentW = parseNumInput(width, 600);
    if (newShape === 'retangular') {
      setWidthEnd(currentW);
    } else if (newShape === 'triangulo') {
      setWidthEnd(0);
    } else if (newShape === 'trapezio') {
      const curEnd = parseNumInput(widthEnd, 0);
      if (curEnd === 0 || curEnd === currentW) {
        setWidthEnd(Math.round(currentW * 0.5) || 200);
      }
    }
  };

  const confirmDelete = () => {
    if (scrapToDelete) {
      onDeleteScrap(scrapToDelete.id);
      setScrapToDelete(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const widthVal = parseNumInput(width, 0);
    const lengthVal = parseNumInput(length, 0);
    const quantityVal = Math.max(0, parseNumInput(quantity, 0));

    const widthMm = GeometryService.convertToMm(widthVal, inputUnit);
    const lengthMm = GeometryService.convertToMm(lengthVal, inputUnit);
    let widthEndMm = widthMm;

    if (shapeType === 'triangulo') {
      widthEndMm = 0;
    } else if (shapeType === 'trapezio') {
      const widthEndVal = parseNumInput(widthEnd, 0);
      widthEndMm = GeometryService.convertToMm(widthEndVal, inputUnit);
    }

    const scrapCode = code || StorageService.getNextScrapCode();

    if (widthMm <= 0 || lengthMm <= 0) {
      alert('Informe desenvolvimento e comprimento válidos maiores que zero.');
      return;
    }

    if (shapeType === 'trapezio' && widthEndMm === widthMm) {
      alert('Para retalhos trapezoidais, o desenvolvimento final (L2) deve ser diferente do inicial (L1). Se forem iguais, selecione o formato Retangular.');
      return;
    }

    const isTrapezoid = shapeType !== 'retangular';

    let defaultName = `Retalho ${scrapCode}`;
    if (shapeType === 'triangulo') {
      defaultName = `Sobra Triangular ${scrapCode}`;
    } else if (shapeType === 'trapezio') {
      defaultName = `Sobra Trapezoidal ${scrapCode}`;
    }

    const scrapData: Omit<ScrapItem, 'id' | 'createdAt'> = {
      code: scrapCode,
      name: name || defaultName,
      width: widthMm,
      widthEnd: widthEndMm,
      isTrapezoid,
      shapeType,
      length: lengthMm,
      quantity: Math.max(1, quantityVal),
      material,
      thickness,
      status: 'disponivel',
      location,
      notes,
    };

    if (editingScrapId) {
      const existing = scraps.find((s) => s.id === editingScrapId);
      if (existing) {
        onUpdateScrap({
          ...existing,
          ...scrapData,
          id: existing.id,
          createdAt: existing.createdAt,
        });
      }
    } else {
      onAddScrap(scrapData);
    }

    resetForm();
  };

  return (
    <div className="space-y-6" id="scrap-inventory-view">
      {/* Header Geometric Balance */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
            Retalhos & Sobras de Chapa
          </h1>
          <p className="text-slate-500 text-sm">
            Cadastre sobras retangulares, trapezoidais e triangulares (cunha / termina em zero) para reaproveitamento prioritário
          </p>
        </div>

        <button
          onClick={() => {
            if (isFormOpen && !editingScrapId) {
              setIsFormOpen(false);
            } else {
              resetForm();
              setCode(StorageService.getNextScrapCode());
              setIsFormOpen(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-md shadow-amber-900/30 transition-all active:scale-95 cursor-pointer"
        >
          {isFormOpen && !editingScrapId ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{isFormOpen && !editingScrapId ? 'Fechar Cadastro' : '+ Cadastrar Retalho / Sobra'}</span>
        </button>
      </header>

      {/* Modal Customizado de Confirmação de Exclusão */}
      {scrapToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Excluir Retalho do Estoque</h3>
                <p className="text-xs text-slate-500">Esta ação removerá a sobra permanentemente.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="font-bold text-slate-800">
                {scrapToDelete.code} - {scrapToDelete.name}
              </div>
              <div className="text-slate-600">
                Dimensões: <strong>{GeometryService.formatScrapDimensions(scrapToDelete, 'mm')}</strong> | Qtd: <strong>{scrapToDelete.quantity} un</strong>
              </div>
              <div className="text-slate-500">Material: {scrapToDelete.material} ({scrapToDelete.thickness})</div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setScrapToDelete(null)}
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
                <span>Sim, Excluir Retalho</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de Cadastro / Edição com Formatos Geométricos */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border-2 border-amber-400 rounded-xl p-5 sm:p-6 shadow-lg space-y-5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Recycle className="w-4 h-4 text-amber-600" />
              {editingScrapId ? 'Editar Retalho / Sobra' : 'Cadastrar Nova Sobra de Chapa'}
            </h3>
            <div className="flex items-center gap-1">
              {(['mm', 'cm', 'm'] as UnitType[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setInputUnit(u)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono cursor-pointer ${
                    inputUnit === u
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {/* Seleção do Formato do Retalho: Retangular, Trapezoidal ou Triangular */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2">
              Formato Geométrico da Sobra:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectShape('retangular')}
                className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  shapeType === 'retangular'
                    ? 'border-amber-500 bg-amber-50/50 text-slate-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50/50'
                }`}
              >
                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-700">
                  <Square className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Retangular</div>
                  <div className="text-[10px] text-slate-400">Largura uniforme constante</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectShape('trapezio')}
                className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  shapeType === 'trapezio'
                    ? 'border-amber-500 bg-amber-50/50 text-slate-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50/50'
                }`}
              >
                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 text-amber-700">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Trapezoidal</div>
                  <div className="text-[10px] text-slate-400">Medida inicial ≠ final (L1 ≠ L2)</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectShape('triangulo')}
                className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  shapeType === 'triangulo'
                    ? 'border-amber-500 bg-amber-50/50 text-slate-900 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-slate-50/50'
                }`}
              >
                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 text-amber-700">
                  <Triangle className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold">Triangular (Cunha)</div>
                  <div className="text-[10px] text-slate-400">Começa com medida e termina em 0</div>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Código Identificador:</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="sm:col-span-1 lg:col-span-3">
              <label className="text-xs font-bold text-slate-600 block mb-1">Identificação / Nome:</label>
              <input
                type="text"
                placeholder={
                  shapeType === 'triangulo'
                    ? 'Ex: Sobra Triangular Cunha Calha'
                    : shapeType === 'trapezio'
                    ? 'Ex: Sobra Trapezoidal Rufo Inclinado'
                    : 'Ex: Sobra Calha Platibanda'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Medida Inicial L1 */}
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                {shapeType === 'retangular'
                  ? `Desenvolvimento / Largura (${inputUnit}):`
                  : `Desenvolvimento Inicial L1 (${inputUnit}):`}
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0"
                value={width}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setWidth(val);
                  if (shapeType === 'retangular') {
                    setWidthEnd(val);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            {/* Medida Final L2 (quando Trapezoidal ou Triangular) */}
            {shapeType !== 'retangular' && (
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1 flex items-center justify-between">
                  <span>Desenvolvimento Final L2 ({inputUnit}):</span>
                  {shapeType === 'triangulo' && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      Cunha (0 {inputUnit})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={shapeType === 'triangulo' ? 0 : widthEnd}
                  disabled={shapeType === 'triangulo'}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setWidthEnd(e.target.value)}
                  className={`w-full border text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none ${
                    shapeType === 'triangulo'
                      ? 'bg-amber-50/60 border-amber-200 text-amber-900 cursor-not-allowed'
                      : 'bg-slate-50 border-slate-200 focus:border-amber-500 focus:bg-white'
                  }`}
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                Comprimento ({inputUnit}):
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0"
                value={length}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setLength(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Quantidade:</label>
              <input
                type="number"
                min="0"
                required
                placeholder="0"
                value={quantity}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Material:</label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none"
              >
                <option value="Galvanizado">Galvanizado</option>
                <option value="Galvalume">Galvalume</option>
                <option value="Alumínio">Alumínio</option>
                <option value="Inox">Inox</option>
                <option value="Cobre">Cobre</option>
                <option value="Pintura Eletrostática">Pintura Eletrostática</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Espessura:</label>
              <select
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none"
              >
                <option value="0.43mm">0.43mm (Chapa 28)</option>
                <option value="0.50mm">0.50mm (Chapa 26 - Padrão)</option>
                <option value="0.65mm">0.65mm (Chapa 24)</option>
                <option value="0.80mm">0.80mm (Chapa 22)</option>
                <option value="1.00mm">1.00mm (Chapa 20)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">Localização no Galpão:</label>
              <input
                type="text"
                placeholder="Ex: Prateleira B2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none"
              />
            </div>
          </div>

          {/* Dica geométrica explicativa */}
          {shapeType === 'triangulo' && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Sobra Triangular (Cunha):</strong> Começa na largura L1 (ex: {width || 500} {inputUnit}) e afunila continuamente até 0 {inputUnit} na ponta ao longo do comprimento de {length || 1200} {inputUnit}. A área é calculada como <em>(L1 × Comprimento) / 2</em>.
              </div>
            </div>
          )}

          {shapeType === 'trapezio' && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-900 flex items-start gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong>Sobra Trapezoidal:</strong> Possui corte diagonal com larguras desiguais (L1 = {width || 600} {inputUnit} e L2 = {widthEnd || 200} {inputUnit}). O sistema calcula o encaixe geométrico ideal para calhas e rufos inclinados.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
            >
              {editingScrapId ? 'Salvar Alterações' : 'Salvar Retalho / Sobra'}
            </button>
          </div>
        </form>
      )}

      {/* Barra de Filtro, Formato e Pesquisa */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por código, nome, material ou prateleira..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Filtro por Formato */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Formato:</span>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setFilterShape('todos')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  filterShape === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterShape('retangular')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  filterShape === 'retangular' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Retangulares
              </button>
              <button
                onClick={() => setFilterShape('trapezio')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  filterShape === 'trapezio' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Trapézios
              </button>
              <button
                onClick={() => setFilterShape('triangulo')}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  filterShape === 'triangulo' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Triangulares
              </button>
            </div>
          </div>

          {/* Filtro por Status */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Status:</span>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(['todos', 'disponivel', 'utilizado'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 text-xs font-bold rounded-md capitalize transition-colors cursor-pointer ${
                    filterStatus === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {st === 'disponivel' ? 'Disponíveis' : st === 'utilizado' ? 'Utilizados' : 'Todos'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Retalhos Cadastrados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScraps.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white border border-dashed border-slate-300 rounded-xl p-8">
            <Recycle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Nenhum retalho encontrado</h4>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre sobras retangulares, trapezoidais ou triangulares para reaproveitamento nas ordens de corte.
            </p>
          </div>
        ) : (
          filteredScraps.map((scrap) => {
            const areaMm2 = GeometryService.calculateScrapAreaMm2(scrap);
            const areaM2 = areaMm2 / 1_000_000;
            const isAvailable = scrap.status === 'disponivel' && scrap.quantity > 0;
            const shape = scrap.shapeType || GeometryService.getScrapShapeType(scrap);
            const w1 = scrap.width;
            const w2 = scrap.widthEnd !== undefined ? scrap.widthEnd : scrap.width;

            return (
              <div
                key={scrap.id}
                className={`bg-white border rounded-xl p-5 shadow-sm transition-all flex flex-col justify-between ${
                  isAvailable
                    ? 'border-amber-200 hover:border-amber-400'
                    : 'border-slate-200 opacity-60 bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black font-mono px-2 py-0.5 bg-amber-500 text-white rounded shadow-xs whitespace-nowrap">
                        {scrap.code}
                      </span>
                      {shape === 'triangulo' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded border border-orange-200 flex items-center gap-1 whitespace-nowrap">
                          <Triangle className="w-2.5 h-2.5 shrink-0" />
                          <span>Triangular</span>
                        </span>
                      )}
                      {shape === 'trapezio' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded border border-blue-200 flex items-center gap-1 whitespace-nowrap">
                          <Layers className="w-2.5 h-2.5 shrink-0" />
                          <span>Trapezoidal</span>
                        </span>
                      )}
                      {shape === 'retangular' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 flex items-center gap-1 whitespace-nowrap">
                          <Square className="w-2.5 h-2.5 shrink-0" />
                          <span>Retangular</span>
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap shrink-0 ${
                        isAvailable
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isAvailable ? `${scrap.quantity} disponível` : 'Utilizado'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 truncate" title={scrap.name}>{scrap.name}</h3>

                  {/* Card Visual com Miniatura do Formato e Dimensões */}
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-xs gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block whitespace-nowrap">
                        {shape === 'triangulo'
                          ? 'Cunha (L1 → 0 × L)'
                          : shape === 'trapezio'
                          ? 'Trapézio (L1 → L2 × L)'
                          : 'Dimensões (L × C)'}
                      </span>
                      <span className="text-slate-900 font-bold block whitespace-nowrap truncate">
                        {GeometryService.formatScrapDimensions(scrap, 'mm')}
                      </span>
                    </div>

                    {/* Miniatura Gráfica SVG do Formato do Retalho */}
                    <div className="w-14 h-10 bg-white border border-slate-200 rounded p-1 flex items-center justify-center shrink-0">
                      <svg viewBox="0 0 50 30" className="w-full h-full">
                        {shape === 'triangulo' ? (
                          <polygon points="5,5 45,15 5,25" fill="#fed7aa" stroke="#f97316" strokeWidth="1.5" />
                        ) : shape === 'trapezio' ? (
                          <polygon points="5,3 45,9 45,21 5,27" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5" />
                        ) : (
                          <rect x="5" y="5" width="40" height="20" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
                        )}
                      </svg>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block whitespace-nowrap">
                        Área Real
                      </span>
                      <span className="text-slate-700 font-semibold whitespace-nowrap">{areaM2.toFixed(2)} m²</span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 space-y-1">
                    <div className="truncate">
                      Material:{' '}
                      <strong className="text-slate-700">
                        {scrap.material} ({scrap.thickness})
                      </strong>
                    </div>
                    {scrap.location && (
                      <div className="flex items-center gap-1 text-slate-600 font-medium truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{scrap.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenQrModal(scrap)}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Etiqueta QR</span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleOpenEdit(scrap)}
                      className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                      title="Editar retalho"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setScrapToDelete(scrap)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Excluir retalho do estoque"
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
