import {
  CutOrder,
  MachineSettings,
  OptimizationSolution,
  ScrapItem,
  SheetItem,
} from '../types';

const STORAGE_KEYS = {
  SHEETS: 'cortefacil_sheets_v2_clean',
  SCRAPS: 'cortefacil_scraps_v2_clean',
  ORDERS: 'cortefacil_orders_v2_clean',
  SETTINGS: 'cortefacil_settings_v2_clean',
  INITIALIZED: 'cortefacil_initialized_v2_clean',
};

export const DEFAULT_SETTINGS: MachineSettings = {
  maxCutLength: 7000, // 7000 mm (7 metros por lance contínuo)
  spliceOverlapLength: 100, // 100 mm (10 cm de emenda / transpasse a cada divisão ao meio)
  autoSplitLongPieces: true, // Divisão simétrica automática ao meio para peças > 7 metros
  allowCoilCustomCut: true, // Otimização para rolo contínuo de 30 a 40 metros
  kerf: 2, // 2 mm perda de serra/corte
  safetyMargin: 5, // 5 mm margem de borda
  minSpacing: 3, // 3 mm espaçamento
  scrapMinLength: 400, // 400 mm
  scrapMinWidth: 150, // 150 mm
  defaultPriority: 'balanced',
  defaultUnit: 'mm',
};

// Sem dados de exemplo fictícios
export const DEFAULT_SHEETS: SheetItem[] = [];
export const DEFAULT_SCRAPS: ScrapItem[] = [];

export class StorageService {
  static initDefaultsIfEmpty(): void {
    if (typeof window === 'undefined') return;

    // Limpa chaves legadas de teste se existirem
    const legacyKeys = [
      'cortefacil_sheets_v1',
      'cortefacil_scraps_v1',
      'cortefacil_orders_v1',
      'cortefacil_settings_v1',
      'cortefacil_initialized_v1',
    ];
    legacyKeys.forEach((k) => localStorage.removeItem(k));

    if (!localStorage.getItem(STORAGE_KEYS.INITIALIZED)) {
      localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SCRAPS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  }

  // --- CHAPAS ---
  static getSheets(): SheetItem[] {
    this.initDefaultsIfEmpty();
    const data = localStorage.getItem(STORAGE_KEYS.SHEETS);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data) as SheetItem[];
      // Filtra qualquer item de teste antigo caso ainda resida
      return parsed.filter((s) => !s.id.startsWith('sh_coil_') && !s.id.startsWith('sh_0'));
    } catch {
      return [];
    }
  }

  static saveSheets(sheets: SheetItem[]): void {
    localStorage.setItem(STORAGE_KEYS.SHEETS, JSON.stringify(sheets));
  }

  static addSheet(sheet: Omit<SheetItem, 'id' | 'createdAt'>): SheetItem {
    const sheets = this.getSheets();
    const newSheet: SheetItem = {
      ...sheet,
      id: `sh_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    sheets.unshift(newSheet);
    this.saveSheets(sheets);
    return newSheet;
  }

  static updateSheet(sheet: SheetItem): void {
    const sheets = this.getSheets().map((s) => (s.id === sheet.id ? sheet : s));
    this.saveSheets(sheets);
  }

  static deleteSheet(id: string): void {
    const sheets = this.getSheets().filter((s) => s.id !== id);
    this.saveSheets(sheets);
  }

  // --- RETALHOS / SOBRAS ---
  static getScraps(): ScrapItem[] {
    this.initDefaultsIfEmpty();
    const data = localStorage.getItem(STORAGE_KEYS.SCRAPS);
    if (!data) return [];
    try {
      const parsed = JSON.parse(data) as ScrapItem[];
      // Filtra qualquer item de teste antigo
      return parsed.filter((s) => !s.id.startsWith('scr_0'));
    } catch {
      return [];
    }
  }

  static saveScraps(scraps: ScrapItem[]): void {
    localStorage.setItem(STORAGE_KEYS.SCRAPS, JSON.stringify(scraps));
  }

  static getNextScrapCode(): string {
    const scraps = this.getScraps();
    const codes = scraps
      .map((s) => {
        const match = s.code?.match(/R(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const max = codes.length > 0 ? Math.max(...codes) : 0;
    return `R${String(max + 1).padStart(3, '0')}`;
  }

  static addScrap(scrap: Omit<ScrapItem, 'id' | 'createdAt'>): ScrapItem {
    const scraps = this.getScraps();
    const code = scrap.code || this.getNextScrapCode();
    const newScrap: ScrapItem = {
      ...scrap,
      code,
      name: scrap.name || `Retalho ${code}`,
      id: `scr_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    scraps.unshift(newScrap);
    this.saveScraps(scraps);
    return newScrap;
  }

  static updateScrap(scrap: ScrapItem): void {
    const scraps = this.getScraps().map((s) => (s.id === scrap.id ? scrap : s));
    this.saveScraps(scraps);
  }

  static deleteScrap(id: string): void {
    const scraps = this.getScraps().filter((s) => s.id !== id);
    this.saveScraps(scraps);
  }

  // --- COMPATIBILIDADE ---
  static saveSheet(sheet: Omit<SheetItem, 'id' | 'createdAt'>): SheetItem {
    return this.addSheet(sheet);
  }

  static saveScrap(scrap: Omit<ScrapItem, 'id' | 'createdAt'>): ScrapItem {
    return this.addScrap(scrap);
  }

  static saveOrder(order: CutOrder | Omit<CutOrder, 'id' | 'createdAt'>): CutOrder {
    if ('id' in order && order.id) {
      const orders = this.getOrders();
      const existingIdx = orders.findIndex((o) => o.id === order.id);
      if (existingIdx !== -1) {
        orders[existingIdx] = order as CutOrder;
      } else {
        orders.unshift(order as CutOrder);
      }
      this.saveOrders(orders);
      return order as CutOrder;
    }
    return this.addOrder(order);
  }

  // --- CONFIGURAÇÕES ---
  static getSettings(): MachineSettings {
    this.initDefaultsIfEmpty();
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
  }

  static saveSettings(settings: MachineSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // --- ORDENS DE CORTE & HISTÓRICO ---
  static getOrders(): CutOrder[] {
    this.initDefaultsIfEmpty();
    const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return data ? JSON.parse(data) : [];
  }

  static saveOrders(orders: CutOrder[]): void {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }

  static addOrder(order: Omit<CutOrder, 'id' | 'createdAt'>): CutOrder {
    const orders = this.getOrders();
    const newOrder: CutOrder = {
      ...order,
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      createdAt: new Date().toISOString(),
    };
    orders.unshift(newOrder);
    this.saveOrders(orders);
    return newOrder;
  }

  static updateOrder(order: CutOrder): void {
    const orders = this.getOrders().map((o) => (o.id === order.id ? order : o));
    this.saveOrders(orders);
  }

  static deleteOrder(id: string): void {
    const orders = this.getOrders().filter((o) => o.id !== id);
    this.saveOrders(orders);
  }

  // --- BACKUP & RESTAURAÇÃO ---
  static exportBackup(): void {
    const backupData = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      sheets: this.getSheets(),
      scraps: this.getScraps(),
      orders: this.getOrders(),
      settings: this.getSettings(),
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `cortefacil_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  static importBackup(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data && typeof data === 'object') {
        if (Array.isArray(data.sheets)) this.saveSheets(data.sheets);
        if (Array.isArray(data.scraps)) this.saveScraps(data.scraps);
        if (Array.isArray(data.orders)) this.saveOrders(data.orders);
        if (data.settings && typeof data.settings === 'object') this.saveSettings(data.settings);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}
