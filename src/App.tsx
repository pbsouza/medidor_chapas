/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CutOrder,
  CutPiece,
  MachineSettings,
  OptimizationSolution,
  ScrapItem,
  SheetItem,
} from './types';
import { StorageService } from './services/StorageService';
import { FirebaseStorageService } from './services/FirebaseStorageService';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { SheetInventory } from './components/SheetInventory';
import { ScrapInventory } from './components/ScrapInventory';
import { CutOrderManager } from './components/CutOrderManager';
import { ReportsHistory } from './components/ReportsHistory';
import { SettingsModal } from './components/SettingsModal';
import { PhotoImportModal } from './components/PhotoImportModal';
import { PdfImportModal } from './components/PdfImportModal';
import { AIAssistantModal } from './components/AIAssistantModal';
import { QrCodeModal } from './components/QrCodeModal';
import { CheckCircle2, Sparkles, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // Estados de Dados do Sistema
  const [sheets, setSheets] = useState<SheetItem[]>(() => StorageService.getSheets());
  const [scraps, setScraps] = useState<ScrapItem[]>(() => StorageService.getScraps());
  const [orders, setOrders] = useState<CutOrder[]>(() => StorageService.getOrders());
  const [settings, setSettings] = useState<MachineSettings>(() => StorageService.getSettings());
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // Notificação Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  // Estados de Modais
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [selectedScrapForQr, setSelectedScrapForQr] = useState<ScrapItem | null>(null);

  // Inicialização e Conexão em tempo real com Firebase Firestore
  useEffect(() => {
    // 1. Semear dados iniciais no Firestore se necessário
    FirebaseStorageService.seedFirestoreIfEmpty();

    // 2. Ouvir atualizações em tempo real das chapas no Firestore
    const unsubSheets = FirebaseStorageService.subscribeToSheets((updatedSheets) => {
      setSheets(updatedSheets);
    });

    // 3. Ouvir atualizações em tempo real dos retalhos no Firestore
    const unsubScraps = FirebaseStorageService.subscribeToScraps((updatedScraps) => {
      setScraps(updatedScraps);
    });

    // 4. Ouvir atualizações em tempo real das ordens de corte
    const unsubOrders = FirebaseStorageService.subscribeToOrders((updatedOrders) => {
      setOrders(updatedOrders);
    });

    // 5. Ouvir configurações da máquina no Firestore
    const unsubSettings = FirebaseStorageService.subscribeToSettings((updatedSettings) => {
      setSettings(updatedSettings);
    });

    return () => {
      unsubSheets();
      unsubScraps();
      unsubOrders();
      unsubSettings();
    };
  }, []);

  const refreshData = () => {
    setSheets(StorageService.getSheets());
    setScraps(StorageService.getScraps());
    setOrders(StorageService.getOrders());
    setSettings(StorageService.getSettings());
  };

  // Handlers para Chapas (Salva no Firestore + Local com Optimistic UI imediato)
  const handleAddSheet = async (sheetData: Omit<SheetItem, 'id' | 'createdAt'>) => {
    const localCreated = StorageService.addSheet(sheetData);
    setSheets((prev) => [localCreated, ...prev.filter((s) => s.id !== localCreated.id)]);
    setIsCloudSyncing(true);
    try {
      await FirebaseStorageService.saveSheet(sheetData);
    } catch (e) {
      console.warn('Sincronizando localmente:', e);
    } finally {
      setIsCloudSyncing(false);
    }
    showToast(`Chapa "${sheetData.name}" cadastrada com sucesso!`);
  };

  const handleUpdateSheet = async (sheet: SheetItem) => {
    StorageService.updateSheet(sheet);
    setSheets((prev) => prev.map((s) => (s.id === sheet.id ? sheet : s)));
    setIsCloudSyncing(true);
    try {
      await FirebaseStorageService.updateSheet(sheet);
    } catch (e) {
      console.warn('Sincronizando localmente:', e);
    } finally {
      setIsCloudSyncing(false);
    }
    showToast(`Chapa "${sheet.name}" atualizada com sucesso!`);
  };

  const handleDeleteSheet = async (id: string) => {
    StorageService.deleteSheet(id);
    setSheets((prev) => prev.filter((s) => s.id !== id));
    setIsCloudSyncing(true);
    try {
      await FirebaseStorageService.deleteSheet(id);
    } catch (e) {
      console.warn('Sincronizando localmente:', e);
    } finally {
      setIsCloudSyncing(false);
    }
    showToast('Chapa removida do estoque.');
  };

  // Handlers para Retalhos (Salva no Firestore + Local com Optimistic UI imediato)
  const handleAddScrap = async (scrapData: Omit<ScrapItem, 'id' | 'createdAt'>) => {
    const localCreated = StorageService.addScrap(scrapData);
    setScraps((prev) => [localCreated, ...prev.filter((s) => s.id !== localCreated.id)]);
    setIsCloudSyncing(true);
    try {
      await FirebaseStorageService.saveScrap(scrapData);
    } catch (e) {
      console.warn('Sincronizando localmente:', e);
    } finally {
      setIsCloudSyncing(false);
    }
    showToast(`Retalho ${localCreated.code} adicionado ao estoque!`);
  };

  const handleUpdateScrap = async (scrap: ScrapItem) => {
    StorageService.updateScrap(scrap);
    setScraps((prev) => prev.map((s) => (s.id === scrap.id ? scrap : s)));
    setIsCloudSyncing(true);
    try {
      await FirebaseStorageService.updateScrap(scrap);
    } catch (e) {
      console.warn('Sincronizando localmente:', e);
    } finally {
      setIsCloudSyncing(false);
    }
    showToast(`Retalho ${scrap.code} atualizado.`);
  };

  const handleDeleteScrap = async (id: string) => {
    StorageService.deleteScrap(id);
    setScraps((prev) => prev.filter((s) => s.id !== id));
    setIsCloudSyncing(true);
    try {
      await FirebaseStorageService.deleteScrap(id);
    } catch (e) {
      console.warn('Sincronizando localmente:', e);
    } finally {
      setIsCloudSyncing(false);
    }
    showToast('Retalho removido do estoque.');
  };

  // Handlers de Configurações
  const handleSaveSettings = async (newSettings: MachineSettings) => {
    setIsCloudSyncing(true);
    await FirebaseStorageService.saveSettings(newSettings);
    setSettings(newSettings);
    setIsCloudSyncing(false);
    showToast('Parâmetros da guilhotina salvos na nuvem!');
  };

  // Executar Ordem de Corte (Baixar Chapas e Registrar Sobras com persistência Firestore)
  const handleExecuteOrder = async (order: CutOrder, solution: OptimizationSolution) => {
    setIsCloudSyncing(true);
    // 1. Salva a ordem concluída no Firestore
    await FirebaseStorageService.saveOrder(order);

    // 2. Abate quantidades de chapas e retalhos utilizados
    for (const plan of solution.plans) {
      if (plan.isScrap) {
        const scrap = scraps.find((s) => s.id === plan.sheetId);
        if (scrap) {
          await FirebaseStorageService.updateScrap({
            ...scrap,
            status: 'utilizado',
            quantity: Math.max(0, scrap.quantity - 1),
          });
        }
      } else {
        const sheet = sheets.find((s) => s.id === plan.sheetId);
        if (sheet) {
          await FirebaseStorageService.updateSheet({
            ...sheet,
            quantity: Math.max(0, sheet.quantity - 1),
          });
        }
      }

      // 3. Cadastra novas sobras úteis geradas no corte (retangulares, trapezoidais e triangulares)
      for (const remnant of plan.remnants.filter((r) => r.isUsable)) {
        const isTrap = !!remnant.isTrapezoid || (remnant.widthEnd !== undefined && remnant.widthEnd !== remnant.width);
        const shapeType = remnant.shapeType || (isTrap ? (remnant.widthEnd === 0 ? 'triangulo' : 'trapezio') : 'retangular');
        
        let scrapName = `Sobra ${remnant.width}×${remnant.length}mm (de ${plan.sheetName})`;
        if (shapeType === 'triangulo') {
          scrapName = `Sobra Triangular ${remnant.width}→0×${remnant.length}mm (de ${plan.sheetName})`;
        } else if (shapeType === 'trapezio') {
          scrapName = `Sobra Trapezoidal ${remnant.width}→${remnant.widthEnd || 0}×${remnant.length}mm (de ${plan.sheetName})`;
        }

        await FirebaseStorageService.saveScrap({
          code: remnant.code,
          name: scrapName,
          width: remnant.width,
          widthEnd: remnant.widthEnd !== undefined ? remnant.widthEnd : remnant.width,
          isTrapezoid: isTrap,
          shapeType,
          length: remnant.length,
          quantity: 1,
          material: plan.material,
          thickness: plan.thickness,
          status: 'disponivel',
          location: 'Oficina / Sobras Recentes',
          sourceSheetName: plan.sheetName,
          notes: `Gerada no corte da ${plan.sheetName}`,
        });
      }
    }

    setIsCloudSyncing(false);
    showToast(`Ordem ${order.orderNumber} executada com sucesso! Estoque e sobras atualizados na nuvem.`);
  };

  const handleDeleteOrder = async (id: string) => {
    StorageService.deleteOrder(id);
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setIsCloudSyncing(true);
    try {
      await FirebaseStorageService.deleteOrder(id);
    } catch (e) {
      console.warn('Sincronizando localmente:', e);
    } finally {
      setIsCloudSyncing(false);
    }
    showToast('Ordem removida do histórico.');
  };

  // Ações Rápidas
  const handleQuickAction = (action: string) => {
    if (action === 'photo') {
      setIsPhotoModalOpen(true);
    } else if (action === 'pdf') {
      setIsPdfModalOpen(true);
    } else if (action === 'add-sheet') {
      setActiveTab('sheets');
    } else if (action === 'add-scrap') {
      setActiveTab('scraps');
    }
  };

  // Importar peças vindas da IA para a tela de corte
  const handleImportPiecesFromAI = (importedPieces: CutPiece[]) => {
    setActiveTab('cut-orders');
    showToast(`${importedPieces.length} peça(s) importada(s) com sucesso para o Otimizador de Corte!`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Barra Superior Dark (Geometric Balance) */}
      <Navbar
        activeTab={activeTab}
        isCloudSyncing={isCloudSyncing}
        onToggleSidebar={() => setIsSidebarMobileOpen((prev) => !prev)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onNavigateTab={(tab) => setActiveTab(tab)}
      />

      {/* Toast Notification Flutuante */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white border border-slate-700 shadow-2xl rounded-xl px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Container com Sidebar e Área Principal */}
      <div className="flex flex-1 relative">
        {/* Sidebar Lateral */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          isOpenMobile={isSidebarMobileOpen}
          onCloseMobile={() => setIsSidebarMobileOpen(false)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAssistant={() => setIsAssistantOpen(true)}
          onQuickAction={handleQuickAction}
        />

        {/* Conteúdo Principal */}
        <main className="lg:pl-72 flex-1 p-3 sm:p-5 lg:p-6 xl:p-8 2xl:p-10 w-full min-w-0 max-w-[1920px] mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              sheets={sheets}
              scraps={scraps}
              orders={orders}
              settings={settings}
              onNavigate={(tab) => setActiveTab(tab)}
              onQuickAction={handleQuickAction}
            />
          )}

          {activeTab === 'sheets' && (
            <SheetInventory
              sheets={sheets}
              onAddSheet={handleAddSheet}
              onUpdateSheet={handleUpdateSheet}
              onDeleteSheet={handleDeleteSheet}
            />
          )}

          {activeTab === 'scraps' && (
            <ScrapInventory
              scraps={scraps}
              onAddScrap={handleAddScrap}
              onUpdateScrap={handleUpdateScrap}
              onDeleteScrap={handleDeleteScrap}
              onOpenQrModal={(scrap) => setSelectedScrapForQr(scrap)}
            />
          )}

          {activeTab === 'cut-orders' && (
            <CutOrderManager
              sheets={sheets}
              scraps={scraps}
              settings={settings}
              onExecuteOrder={handleExecuteOrder}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsHistory
              orders={orders}
              onSelectOrder={(order) => {
                setActiveTab('cut-orders');
              }}
              onDeleteOrder={handleDeleteOrder}
            />
          )}
        </main>
      </div>

      {/* Modais Globais */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        onDataResetOrRestored={refreshData}
      />

      <PhotoImportModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onImportPieces={handleImportPiecesFromAI}
      />

      <PdfImportModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onImportPieces={handleImportPiecesFromAI}
      />

      <AIAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        sheets={sheets}
        scraps={scraps}
      />

      <QrCodeModal
        isOpen={!!selectedScrapForQr}
        onClose={() => setSelectedScrapForQr(null)}
        scrap={selectedScrapForQr}
      />
    </div>
  );
}
