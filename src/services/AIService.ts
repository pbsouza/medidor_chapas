import { AIAnalysisResponse, CutOrder, CutPiece, MachineSettings, ScrapItem, SheetItem } from '../types';

export class AIService {
  /**
   * Converte arquivo (imagem ou PDF) em base64 e envia para análise com Gemini
   */
  static async analyzeDocument(
    file: File,
    hints: string = ''
  ): Promise<AIAnalysisResponse> {
    const base64Data = await this.fileToBase64(file);
    const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    let lastErrorMessage = '';

    // Até 2 tentativas automáticas no cliente
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch('/api/ai/analyze-media', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            base64Data: base64Data.split(',')[1] || base64Data,
            mimeType,
            documentType: file.type.includes('pdf') ? 'pdf' : 'image',
            hints,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.error || `Erro HTTP ${response.status}`;
          lastErrorMessage = errMsg;

          if (attempt === 1 && (response.status === 503 || response.status === 500 || response.status === 429)) {
            // Aguarda 1.5s antes da segunda tentativa
            await new Promise((resolve) => setTimeout(resolve, 1500));
            continue;
          }

          throw new Error(errMsg);
        }

        const data = await response.json();
        return data;
      } catch (error: any) {
        lastErrorMessage = error?.message || 'Falha ao conectar com o serviço de IA.';
        if (attempt === 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    }

    console.error('Falha na requisição da IA após tentativas:', lastErrorMessage);
    return {
      success: false,
      documentSummary: 'Não foi possível concluir a leitura do arquivo.',
      warnings: [
        lastErrorMessage.includes('503') || lastErrorMessage.includes('demanda')
          ? 'Os servidores do Google Gemini estão com alta demanda temporária. Por favor, clique novamente em "Processar Medidas" em alguns instantes.'
          : lastErrorMessage,
      ],
      extractedPieces: [],
      rawError: lastErrorMessage,
    };
  }

  /**
   * Consulta o Assistente de Corte IA com o estado atual do estoque e peças
   */
  static async askAssistant(
    message: string,
    context: {
      inventory: SheetItem[];
      scraps: ScrapItem[];
      currentOrder?: CutPiece[];
      machineLimits: MachineSettings;
    }
  ): Promise<string> {
    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          inventory: context.inventory.map((s) => ({
            id: s.id,
            nome: s.name,
            desenvolvimento_mm: s.width,
            comprimento_mm: s.length,
            quantidade: s.quantity,
            material: s.material,
          })),
          scraps: context.scraps
            .filter((s) => s.status === 'disponivel')
            .map((s) => ({
              codigo: s.code,
              desenvolvimento_mm: s.width,
              comprimento_mm: s.length,
              quantidade: s.quantity,
              material: s.material,
            })),
          currentOrder: context.currentOrder?.map((p) => ({
            nome: p.name,
            tipo: p.type,
            desenvolvimento_inicial_mm: p.devStart,
            desenvolvimento_final_mm: p.devEnd,
            comprimento_mm: p.length,
            quantidade: p.quantity,
          })),
          machineLimits: {
            comprimento_maximo_mm: context.machineLimits.maxCutLength,
            perda_corte_mm: context.machineLimits.kerf,
          },
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.text || 'Sem resposta do assistente.';
    } catch (error: any) {
      console.error('Falha no assistente IA:', error);
      return `⚠️ O assistente está temporariamente ocupado devido à alta demanda dos servidores: ${error.message}. Por favor, tente enviar sua pergunta novamente.`;
    }
  }

  private static fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }
}

