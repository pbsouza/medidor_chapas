import { CutPiece, MachineSettings, SheetItem, ScrapItem } from '../types';

export interface AiOptimizationResult {
  success: boolean;
  bestCoilWidthCm: number;
  unrollLengthMeters: number;
  lateralWasteCm: number;
  estimatedYieldPercentage: number;
  expertDiagnosis: string;
  stripStackingExplanation: string;
  guillotineStepByStep: string[];
  alternativeOptions?: Array<{
    coilWidthCm: number;
    unrollMeters: number;
    lateralWasteCm: number;
    yieldPercentage: number;
    comment?: string;
  }>;
  error?: string;
}

export class AiCuttingService {
  /**
   * Envia as peças e estoque para o Gemini analisar e otimizar o plano de corte
   */
  static async requestAiOptimization(
    pieces: CutPiece[],
    inventory: SheetItem[],
    scraps: ScrapItem[],
    machineLimits: MachineSettings
  ): Promise<AiOptimizationResult> {
    try {
      const response = await fetch('/api/ai/optimize-cut', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pieces,
          inventory,
          scraps,
          machineLimits,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${response.status} na API`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('Erro ao chamar IA Gemini para otimização de corte:', error);
      return {
        success: false,
        bestCoilWidthCm: 0,
        unrollLengthMeters: 0,
        lateralWasteCm: 0,
        estimatedYieldPercentage: 0,
        expertDiagnosis: '',
        stripStackingExplanation: '',
        guillotineStepByStep: [],
        error: error?.message || 'Não foi possível conectar ao serviço de IA Gemini no momento.',
      };
    }
  }
}
