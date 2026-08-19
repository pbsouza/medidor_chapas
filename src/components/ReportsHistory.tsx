import React, { useState } from 'react';
import { CutOrder } from '../types';
import { ExportService } from '../services/ExportService';
import { GeometryService } from '../services/GeometryService';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Layers,
  Scissors,
  CheckCircle2,
  Search,
  ExternalLink,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  orders: CutOrder[];
  onSelectOrder: (order: CutOrder) => void;
  onDeleteOrder?: (id: string) => void;
}

export const ReportsHistory: React.FC<Props> = ({ orders, onSelectOrder, onDeleteOrder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<CutOrder | null>(null);

  const filteredOrders = orders.filter((o) => {
    return (
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.customerName && o.customerName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const confirmDelete = () => {
    if (orderToDelete && onDeleteOrder) {
      onDeleteOrder(orderToDelete.id);
      setOrderToDelete(null);
    }
  };

  return (
    <div className="space-y-6" id="reports-history-view">
      {/* Header Geometric Balance */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
            Relatórios & Histórico de Cortes
          </h1>
          <p className="text-slate-500 text-sm">
            Rastreamento de ordens executadas, economia de chapas e exportações técnicas
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar ordem..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-40 bg-transparent text-xs text-slate-900 focus:outline-none"
            />
          </div>
        </div>
      </header>

      {/* Lista de Ordens Salvas */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-700 uppercase">
            Nenhuma ordem concluída no histórico
          </h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Quando você calcular e confirmar uma ordem de corte, ela ficará arquivada aqui com acesso a relatórios em PDF e planilhas CSV.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const dateStr = new Date(order.createdAt).toLocaleDateString('pt-BR');
            const timeStr = new Date(order.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={order.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-blue-400 transition-all flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {order.orderNumber}
                    </span>
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded uppercase">
                      ✓ Cortada & Baixada
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 flex items-center gap-3">
                    {order.customerName && (
                      <span>Cliente: <strong className="text-slate-800">{order.customerName}</strong></span>
                    )}
                    <span>• {dateStr} às {timeStr}</span>
                    <span>• {order.pieces.reduce((acc, p) => acc + p.quantity, 0)} peças</span>
                  </div>
                </div>

                {/* Métricas e Exportações */}
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Rendimento</div>
                    <div className="text-lg font-mono font-bold text-emerald-600">
                      {order.yieldPercentage || order.selectedSolution?.yieldPercentage || 98}%
                    </div>
                  </div>

                  <div className="h-8 w-px bg-slate-200"></div>

                  <div className="flex items-center gap-2">
                    {order.selectedSolution && (
                      <>
                        <button
                          onClick={() =>
                            ExportService.exportToPdf(
                              order.orderNumber,
                              order.customerName,
                              order.selectedSolution!
                            )
                          }
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Exportar PDF Técnico"
                        >
                          <Download className="w-3.5 h-3.5 text-blue-600" />
                          <span>PDF</span>
                        </button>

                        <button
                          onClick={() =>
                            ExportService.exportToCsv(order.orderNumber, order.selectedSolution!)
                          }
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                          title="Exportar Planilha CSV"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>CSV</span>
                        </button>
                      </>
                    )}

                    {onDeleteOrder && (
                      <button
                        onClick={() => setOrderToDelete(order)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                        title="Excluir ordem do histórico"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2.5 bg-red-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Excluir Ordem de Corte?</h3>
                <p className="text-xs text-slate-500">{orderToDelete.orderNumber}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Esta ação removerá permanentemente o registro desta ordem do histórico em nuvem.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shadow-md shadow-red-600/30"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
