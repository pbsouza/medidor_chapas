import React, { useState } from 'react';
import { CutOrder } from '../types';
import {
  FolderOpen,
  X,
  Play,
  Trash2,
  Copy,
  Calendar,
  Layers,
  TrendingUp,
  Search,
  Plus,
  Clock,
  User,
} from 'lucide-react';
import { GeometryService } from '../services/GeometryService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  orders?: CutOrder[];
  savedOrders?: CutOrder[];
  currentOrderId?: string | null;
  onLoadOrder: (order: CutOrder) => void;
  onDeleteOrder: (orderId: string) => void;
  onDuplicateOrder?: (order: CutOrder) => void;
  onNewOrder?: () => void;
}

export const SavedPlansModal: React.FC<Props> = ({
  isOpen,
  onClose,
  orders,
  savedOrders,
  currentOrderId,
  onLoadOrder,
  onDeleteOrder,
  onDuplicateOrder,
  onNewOrder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'todos' | 'planejamento' | 'cortada'>('todos');

  if (!isOpen) return null;

  const allOrders = savedOrders || orders || [];

  const filteredOrders = allOrders.filter((o) => {
    if (!o) return false;
    const matchesSearch =
      (o.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      filterStatus === 'todos' ? true : o.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border-2 border-slate-200 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Planos de Corte Salvos
              </h3>
              <p className="text-xs text-slate-500">
                Selecione um plano salvo para continuar o trabalho ou revisar medidas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onNewOrder && (
              <button
                onClick={() => {
                  onNewOrder();
                  onClose();
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Plano</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por identificação, cliente ou obra..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setFilterStatus('todos')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                filterStatus === 'todos'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Todos ({allOrders.length})
            </button>
            <button
              onClick={() => setFilterStatus('planejamento')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                filterStatus === 'planejamento'
                  ? 'bg-amber-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Rascunhos / Em Andamento
            </button>
            <button
              onClick={() => setFilterStatus('cortada')}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                filterStatus === 'cortada'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cortadas / Executadas
            </button>
          </div>
        </div>

        {/* Lista de Planos Salvos */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs space-y-2">
              <FolderOpen className="w-10 h-10 mx-auto opacity-40 text-slate-300" />
              <p className="font-semibold text-slate-600">Nenhum plano de corte encontrado</p>
              <p className="text-[11px] text-slate-400">
                Ao montar uma lista de peças, clique no botão "Salvar Plano (Continuar Depois)" para guardar seus rascunhos.
              </p>
            </div>
          ) : (
            filteredOrders.map((order, idx) => {
              const totalPiecesCount = (order.pieces || []).reduce(
                (acc, p) => acc + (p.quantity || 1),
                0
              );
              const totalMeters = (order.pieces || []).reduce(
                (acc, p) => acc + ((p.length || 0) * (p.quantity || 1)) / 1000,
                0
              );
              const isExecuted = order.status === 'cortada';
              const isCurrentlyActive = currentOrderId === order.id;

              return (
                <div
                  key={order.id || `saved-plan-${idx}`}
                  className={`bg-white border-2 rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isCurrentlyActive
                      ? 'border-blue-500 ring-2 ring-blue-400/30 bg-blue-50/30'
                      : 'border-slate-200 hover:border-blue-300'
                  }`}
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-sm text-slate-900">
                        {order.title || order.orderNumber || 'Ordem Sem Nome'}
                      </span>
                      {isCurrentlyActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-600 text-white shadow-sm">
                          ● Aberto na Tela
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          isExecuted
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {isExecuted ? '✓ Cortada' : '⏳ Rascunho / Em Andamento'}
                      </span>
                      {order.yieldPercentage !== undefined && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-mono font-bold px-2 py-0.5 rounded">
                          {order.yieldPercentage}% Rendimento
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                      {order.customerName && (
                        <span className="flex items-center gap-1 text-slate-700 font-semibold">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>{order.customerName}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-400" />
                        <span>
                          {order.pieces?.length || 0} tipos ({totalPiecesCount} peças)
                        </span>
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <TrendingUp className="w-3 h-3 text-slate-400" />
                        <span>{totalMeters.toFixed(2)}m linear</span>
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Data não informada'}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <button
                      onClick={() => {
                        onLoadOrder(order);
                        onClose();
                      }}
                      className="flex-1 sm:flex-none px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Continuar / Carregar</span>
                    </button>

                    {onDuplicateOrder && (
                      <button
                        onClick={() => onDuplicateOrder(order)}
                        className="p-2 text-slate-500 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                        title="Duplicar este plano"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Tem certeza que deseja excluir o plano salvo "${order.title || order.orderNumber}"?`
                          )
                        ) {
                          onDeleteOrder(order.id);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir plano salvo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
