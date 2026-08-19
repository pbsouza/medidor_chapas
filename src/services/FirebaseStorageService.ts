import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  query,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { CutOrder, MachineSettings, ScrapItem, SheetItem } from '../types';
import { DEFAULT_SETTINGS, StorageService } from './StorageService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return errInfo;
}

const COLLECTIONS = {
  SHEETS: 'sheets',
  SCRAPS: 'scraps',
  ORDERS: 'cutOrders',
  SETTINGS: 'settings',
};

const SETTINGS_DOC_ID = 'global_config';

export class FirebaseStorageService {
  /**
   * Inicializa as configurações da máquina caso não existam no Firestore
   */
  static async seedFirestoreIfEmpty(): Promise<void> {
    try {
      const settingsRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
      const localSettings = StorageService.getSettings();
      await setDoc(settingsRef, localSettings, { merge: true });

      // Limpeza de documentos de exemplo legados do Firestore caso existam
      const legacyIds = [
        'sh_coil_01',
        'sh_coil_02',
        'sh_01',
        'sh_02',
        'sh_03',
        'scr_01',
        'scr_02',
        'scr_03',
        'scr_04',
      ];
      for (const legId of legacyIds) {
        if (legId.startsWith('sh_')) {
          deleteDoc(doc(db, COLLECTIONS.SHEETS, legId)).catch(() => {});
        } else {
          deleteDoc(doc(db, COLLECTIONS.SCRAPS, legId)).catch(() => {});
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTIONS.SETTINGS);
    }
  }

  // --- CHAPAS (ESTOQUE) ---
  static subscribeToSheets(onUpdate: (sheets: SheetItem[]) => void): () => void {
    const q = query(collection(db, COLLECTIONS.SHEETS));
    return onSnapshot(
      q,
      (snapshot) => {
        const sheets: SheetItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as SheetItem;
          if (!docSnap.id.startsWith('sh_coil_') && !docSnap.id.startsWith('sh_0')) {
            sheets.push({ ...data, id: docSnap.id });
          }
        });
        sheets.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        StorageService.saveSheets(sheets);
        onUpdate(sheets);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.SHEETS);
        onUpdate(StorageService.getSheets());
      }
    );
  }

  static async saveSheet(sheet: SheetItem | Omit<SheetItem, 'id' | 'createdAt'>): Promise<SheetItem> {
    const id = 'id' in sheet && sheet.id ? sheet.id : `sh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const createdAt = 'createdAt' in sheet && sheet.createdAt ? sheet.createdAt : new Date().toISOString();
    
    const newSheet: SheetItem = {
      ...sheet,
      id,
      createdAt,
    };

    // Atualiza localmente com o mesmo ID
    const currentSheets = StorageService.getSheets().filter((s) => s.id !== id);
    StorageService.saveSheets([newSheet, ...currentSheets]);

    try {
      await setDoc(doc(db, COLLECTIONS.SHEETS, id), newSheet);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${COLLECTIONS.SHEETS}/${id}`);
    }

    return newSheet;
  }

  static async updateSheet(sheet: SheetItem): Promise<void> {
    StorageService.updateSheet(sheet);
    try {
      await setDoc(doc(db, COLLECTIONS.SHEETS, sheet.id), sheet, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${COLLECTIONS.SHEETS}/${sheet.id}`);
    }
  }

  static async deleteSheet(id: string): Promise<void> {
    StorageService.deleteSheet(id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.SHEETS, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${COLLECTIONS.SHEETS}/${id}`);
    }
  }

  // --- RETALHOS / SOBRAS ---
  static subscribeToScraps(onUpdate: (scraps: ScrapItem[]) => void): () => void {
    const q = query(collection(db, COLLECTIONS.SCRAPS));
    return onSnapshot(
      q,
      (snapshot) => {
        const scraps: ScrapItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as ScrapItem;
          if (!docSnap.id.startsWith('scr_0')) {
            scraps.push({ ...data, id: docSnap.id });
          }
        });
        scraps.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        StorageService.saveScraps(scraps);
        onUpdate(scraps);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.SCRAPS);
        onUpdate(StorageService.getScraps());
      }
    );
  }

  static async saveScrap(scrap: ScrapItem | Omit<ScrapItem, 'id' | 'createdAt'>): Promise<ScrapItem> {
    const id = 'id' in scrap && scrap.id ? scrap.id : `scr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const code = scrap.code || StorageService.getNextScrapCode();
    const createdAt = 'createdAt' in scrap && scrap.createdAt ? scrap.createdAt : new Date().toISOString();
    
    const newScrap: ScrapItem = {
      ...scrap,
      id,
      code,
      name: scrap.name || `Retalho ${code}`,
      createdAt,
    };

    const currentScraps = StorageService.getScraps().filter((s) => s.id !== id);
    StorageService.saveScraps([newScrap, ...currentScraps]);

    try {
      await setDoc(doc(db, COLLECTIONS.SCRAPS, id), newScrap);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `${COLLECTIONS.SCRAPS}/${id}`);
    }

    return newScrap;
  }

  static async updateScrap(scrap: ScrapItem): Promise<void> {
    StorageService.updateScrap(scrap);
    try {
      await setDoc(doc(db, COLLECTIONS.SCRAPS, scrap.id), scrap, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `${COLLECTIONS.SCRAPS}/${scrap.id}`);
    }
  }

  static async deleteScrap(id: string): Promise<void> {
    StorageService.deleteScrap(id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.SCRAPS, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${COLLECTIONS.SCRAPS}/${id}`);
    }
  }

  // --- CONFIGURAÇÕES ---
  static subscribeToSettings(onUpdate: (settings: MachineSettings) => void): () => void {
    const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as MachineSettings;
          const merged = { ...DEFAULT_SETTINGS, ...data };
          StorageService.saveSettings(merged);
          onUpdate(merged);
        } else {
          onUpdate(StorageService.getSettings());
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `${COLLECTIONS.SETTINGS}/${SETTINGS_DOC_ID}`);
        onUpdate(StorageService.getSettings());
      }
    );
  }

  static async saveSettings(settings: MachineSettings): Promise<void> {
    StorageService.saveSettings(settings);
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
      await setDoc(docRef, settings, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${COLLECTIONS.SETTINGS}/${SETTINGS_DOC_ID}`);
    }
  }

  // --- ORDENS DE CORTE & HISTÓRICO ---
  static subscribeToOrders(onUpdate: (orders: CutOrder[]) => void): () => void {
    const q = query(collection(db, COLLECTIONS.ORDERS));
    return onSnapshot(
      q,
      (snapshot) => {
        const orders: CutOrder[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as CutOrder;
          orders.push({ ...data, id: docSnap.id });
        });
        orders.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        StorageService.saveOrders(orders);
        onUpdate(orders);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, COLLECTIONS.ORDERS);
        onUpdate(StorageService.getOrders());
      }
    );
  }

  static async saveOrder(order: CutOrder | Omit<CutOrder, 'id' | 'createdAt'>): Promise<CutOrder> {
    const id = 'id' in order && order.id ? order.id : `ord_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const createdAt = 'createdAt' in order && order.createdAt ? order.createdAt : new Date().toISOString();

    const newOrder: CutOrder = {
      ...order,
      id,
      createdAt,
    } as CutOrder;

    StorageService.saveOrder(newOrder);

    try {
      await setDoc(doc(db, COLLECTIONS.ORDERS, id), newOrder);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `${COLLECTIONS.ORDERS}/${id}`);
    }

    return newOrder;
  }

  static async deleteOrder(id: string): Promise<void> {
    StorageService.deleteOrder(id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.ORDERS, id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `${COLLECTIONS.ORDERS}/${id}`);
    }
  }

  /**
   * Executa a gravação da ordem de corte, atualização do estoque de chapas e cadastro dos novos retalhos
   */
  static async executeCutOrderTransaction(
    order: CutOrder,
    updatedSheets: SheetItem[],
    newScraps: ScrapItem[]
  ): Promise<void> {
    // 1. Atualiza cache local instantaneamente
    StorageService.saveOrder(order);
    StorageService.saveSheets(updatedSheets);
    for (const scrap of newScraps) {
      StorageService.addScrap(scrap);
    }

    // 2. Grava no Firebase Firestore
    try {
      const batch = writeBatch(db);

      // Salva a ordem de corte
      const orderRef = doc(db, COLLECTIONS.ORDERS, order.id);
      batch.set(orderRef, order);

      // Atualiza as chapas no Firestore
      for (const sheet of updatedSheets) {
        const sheetRef = doc(db, COLLECTIONS.SHEETS, sheet.id);
        batch.set(sheetRef, sheet, { merge: true });
      }

      // Adiciona novos retalhos no Firestore
      for (const scrap of newScraps) {
        const scrapRef = doc(db, COLLECTIONS.SCRAPS, scrap.id);
        batch.set(scrapRef, scrap);
      }

      await batch.commit();
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'batch/executeCutOrder');
    }
  }
}

