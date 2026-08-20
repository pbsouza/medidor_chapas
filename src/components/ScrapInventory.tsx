import React, { useState } from 'react';
import { ScrapItem, UnitType } from '../types';
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
  CheckCircle2,
  X,
  AlertOctagon,
  Minus,
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
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScrapId, setEditingScrapId] = useState<string | null>(null);
  const [scrapToDelete, setScrapToDelete] = useState<ScrapItem | null>(null);

  // Formulário
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [width, setWidth] = useState<string | number>(600);
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
    const matchesSearch =
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.location && s.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'todos' || s.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setCode('');
    setName('');
    setWidth(600);
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
    setEditingScrapId(scrap.id);
    setCode(scrap.code);
    setName(scrap.name);
    setWidth(scrap.width);
    setLength(scrap.length);
    setQuantity(scrap.quantity);
    setMaterial(scrap.material);
    setThickness(scrap.thickness);
    setLocation(scrap.location || '');
    setNotes(scrap.notes || '');
    setIsFormOpen(true);
  };

  const confirmDelete = () => {
    if (scrapToDelete) {
      onDeleteScrap(scrapToDelete.id);
      setScrapToDelete(null);
    }
  };

  const handleQuickQuantity = (scrap: ScrapItem, delta: number) => {
    const newQty = Math.max(0, (scrap.quantity || 0) + delta);
    onUpdateScrap({
      ...scrap,
      quantity: newQty,
      status: newQty > 0 ? 'disponivel' : 'utilizado',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const widthVal = parseNumInput(width, 0);
    const lengthVal = parseNumInput(length, 0);
    const quantityVal = Math.max(0, parseNumInput(quantity, 0));

    const widthMm = GeometryService.convertToMm(widthVal, inputUnit);
    const lengthMm = GeometryService.convertToMm(lengthVal, inputUnit);
    const scrapCode = code || StorageService.getNextScrapCode();

    if (widthMm <= 0 || lengthMm <= 0) {
      alert('Informe desenvolvimento e comprimento válidos maiores que zero.');
      return;
    }

    if (editingScrapId) {
      const existing = scraps.find((s) => s.id === editingScrapId);
      if (existing) {
        onUpdateScrap({
          ...existing,
          code: scrapCode,
          name: name || `Retalho ${scrapCode}`,
          width: widthMm,
          length: lengthMm,
          quantity: quantityVal,
          material,
          thickness,
          location,
          notes,
        });
      }
    } else {
      onAddScrap({
        code: scrapCode,
        name: name || `Retalho ${scrapCode}`,
        width: widthMm,
        length: lengthMm,
        quantity: Math.max(1, quantityVal),
        material,
        thickness,
        status: 'disponivel',
        location,
        notes,
      });
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
            Sobras identificadas (R001, R002...) com reaproveitamento prioritário nas ordens de corte
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
          <span>{isFormOpen && !editingScrapId ? 'Fechar Cadastro' : '+ Cadastrar Retalho'}</span>
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
                Dimensões: <strong>{scrapToDelete.width} × {scrapToDelete.length} mm</strong> | Qtd: <strong>{scrapToDelete.quantity} un</strong>
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

      {/* Formulário de Cadastro / Edição */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border-2 border-amber-400 rounded-xl p-5 sm:p-6 shadow-lg space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Recycle className="w-4 h-4 text-amber-600" />
              {editingScrapId ? 'Editar Retalho' : 'Cadastrar Nova Sobra de Chapa'}
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
                placeholder="Ex: Sobra Calha Platibanda"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">
                Desenvolvimento ({inputUnit}):
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="0"
                value={width}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setWidth(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono font-bold px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 focus:bg-white"
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
              {editingScrapId ? 'Salvar Alterações' : 'Salvar Retalho'}
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
            placeholder="Buscar por código, nome ou prateleira..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
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

      {/* Grid de Retalhos Cadastrados */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredScraps.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-white border border-dashed border-slate-300 rounded-xl p-8">
            <Recycle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">Nenhum retalho encontrado</h4>
            <p className="text-xs text-slate-400 mt-1">
              Cadastre sobras reaproveitáveis ou gere sobras automáticas ao cortar ordens.
            </p>
          </div>
        ) : (
          filteredScraps.map((scrap) => {
            const areaM2 = (scrap.width * scrap.length) / 1_000_000;
            const isAvailable = scrap.status === 'disponivel' && scrap.quantity > 0;

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
                    <span className="text-xs font-black font-mono px-2 py-0.5 bg-amber-500 text-white rounded shadow-xs">
                      {scrap.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        isAvailable
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isAvailable ? `${scrap.quantity} disponível` : 'Utilizado'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{scrap.name}</h3>

                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between font-mono text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Dimensões
                      </span>
                      <span className="text-slate-900 font-bold">
                        {scrap.width} × {scrap.length} mm
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Área Unit.
                      </span>
                      <span className="text-slate-700 font-semibold">{areaM2.toFixed(2)} m²</span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500 space-y-1">
                    <div>
                      Material:{' '}
                      <strong className="text-slate-700">
                        {scrap.material} ({scrap.thickness})
                      </strong>
                    </div>
                    {scrap.location && (
                      <div className="flex items-center gap-1 text-slate-600 font-medium">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{scrap.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => onOpenQrModal(scrap)}
                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-amber-600" />
                    <span>Etiqueta QR</span>
                  </button>

                  <div className="flex items-center gap-1">
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
