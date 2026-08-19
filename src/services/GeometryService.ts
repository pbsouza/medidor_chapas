import { CutPiece, UnitType } from '../types';

export class GeometryService {
  /**
   * Converte valor numérico em uma unidade dada para milímetros (mm)
   */
  static convertToMm(value: number, unit: UnitType = 'mm'): number {
    if (isNaN(value) || value < 0) return 0;
    if (unit === 'cm') return Math.round(value * 10);
    if (unit === 'm') return Math.round(value * 1000);
    return Math.round(value);
  }

  /**
   * Converte valor com unidade para milímetros (mm)
   */
  static parseToMm(value: string | number, defaultUnit: UnitType = 'mm'): number {
    if (typeof value === 'number') {
      return this.convertToMm(value, defaultUnit);
    }

    if (!value || typeof value !== 'string') return 0;
    const clean = value.trim().toLowerCase().replace(',', '.');

    if (clean.endsWith('mm')) {
      const num = parseFloat(clean.replace('mm', '').trim());
      return isNaN(num) ? 0 : Math.round(num);
    }
    if (clean.endsWith('cm')) {
      const num = parseFloat(clean.replace('cm', '').trim());
      return isNaN(num) ? 0 : Math.round(num * 10);
    }
    if (clean.endsWith('m')) {
      const num = parseFloat(clean.replace('m', '').trim());
      return isNaN(num) ? 0 : Math.round(num * 1000);
    }

    const num = parseFloat(clean);
    if (isNaN(num)) return 0;

    return this.convertToMm(num, defaultUnit);
  }

  /**
   * Formata milímetros para exibição amigável
   */
  static formatMm(mm: number, unit: UnitType = 'mm'): string {
    if (isNaN(mm) || mm === undefined) return '0 mm';
    if (unit === 'cm') {
      return `${(mm / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm`;
    }
    if (unit === 'm') {
      return `${(mm / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`;
    }
    return `${Math.round(mm).toLocaleString('pt-BR')} mm`;
  }

  /**
   * Formata área em mm² para m²
   */
  static formatAreaM2(areaMm2: number): string {
    const m2 = areaMm2 / 1_000_000;
    return `${m2.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
  }

  /**
   * Calcula área geométrica exata de uma peça (retangular ou trapezoidal)
   */
  static calculatePieceAreaMm2(piece: { devStart: number; devEnd: number; length: number }): number {
    const avgWidth = (piece.devStart + piece.devEnd) / 2;
    return avgWidth * piece.length;
  }

  /**
   * Verifica se a peça é trapezoidal
   */
  static isTrapezoid(piece: { devStart: number; devEnd: number }): boolean {
    return Math.abs(piece.devStart - piece.devEnd) > 1; // tolerância de 1mm
  }

  /**
   * Bounding box largura máxima
   */
  static getMaxWidth(piece: { devStart: number; devEnd: number }): number {
    return Math.max(piece.devStart, piece.devEnd);
  }

  /**
   * Bounding box largura mínima
   */
  static getMinWidth(piece: { devStart: number; devEnd: number }): number {
    return Math.min(piece.devStart, piece.devEnd);
  }

  /**
   * Calcula os detalhes de divisão simétrica e emendas de uma peça
   * Regra da Oficina: Peças > 7m são divididas ao meio com +10cm (100mm) de transpasse por emenda
   */
  static calculateSpliceDetails(
    lengthMm: number,
    maxContinuousLength: number = 7000,
    overlapMm: number = 100
  ): {
    needsSplit: boolean;
    segmentsCount: number;
    splicesCount: number;
    overlapTotalMm: number;
    totalLengthWithSpliceMm: number;
    segmentLengthMm: number;
    explanation: string;
  } {
    if (lengthMm <= maxContinuousLength) {
      return {
        needsSplit: false,
        segmentsCount: 1,
        splicesCount: 0,
        overlapTotalMm: 0,
        totalLengthWithSpliceMm: lengthMm,
        segmentLengthMm: lengthMm,
        explanation: `Peça de ${(lengthMm / 1000).toFixed(2)}m produzida em 1 lance inteiro (sem emenda).`,
      };
    }

    // Quantidade de partes divididas igualmente
    const segmentsCount = Math.ceil(lengthMm / maxContinuousLength);
    const splicesCount = segmentsCount - 1; // Ex: 2 partes = 1 emenda
    const overlapTotalMm = splicesCount * overlapMm; // 100mm (10cm) a cada emenda
    const totalLengthWithSpliceMm = lengthMm + overlapTotalMm;
    const segmentLengthMm = Math.round((totalLengthWithSpliceMm / segmentsCount) * 10) / 10;

    const explanation = `Peça de ${(lengthMm / 1000).toFixed(2)}m dividida ao meio em ${segmentsCount} partes iguais de ${(segmentLengthMm / 1000).toFixed(2)}m (com ${(overlapMm / 10).toFixed(0)}cm de transpasse na emenda).`;

    return {
      needsSplit: true,
      segmentsCount,
      splicesCount,
      overlapTotalMm,
      totalLengthWithSpliceMm,
      segmentLengthMm,
      explanation,
    };
  }

  /**
   * Divide uma peça longa simetricamente ao meio adicionando o transpasse de emenda
   */
  static suggestSegmentSplit(piece: CutPiece, maxMachineLength: number = 7000, overlapMm: number = 100): CutPiece[] {
    if (piece.length <= maxMachineLength) return [piece];

    const splice = this.calculateSpliceDetails(piece.length, maxMachineLength, overlapMm);
    const count = splice.segmentsCount;
    const segLength = splice.segmentLengthMm;

    const segments: CutPiece[] = [];
    const isTrap = this.isTrapezoid(piece);

    for (let i = 0; i < count; i++) {
      let segDevStart = piece.devStart;
      let segDevEnd = piece.devEnd;

      if (isTrap) {
        // Interpolação linear da largura trapezoidal
        const tStart = i / count;
        const tEnd = (i + 1) / count;
        segDevStart = Math.round(piece.devStart + (piece.devEnd - piece.devStart) * tStart);
        segDevEnd = Math.round(piece.devStart + (piece.devEnd - piece.devStart) * tEnd);
      }

      segments.push({
        ...piece,
        id: `${piece.id}_seg_${i + 1}`,
        name: `${piece.name} (Lance ${i + 1}/${count})`,
        quantity: piece.quantity, // Mantém a quantidade de calhas requerida
        length: segLength,
        devStart: segDevStart,
        devEnd: segDevEnd,
        isSegment: true,
        originalPieceId: piece.id,
        spliceInfo: {
          isSpliceSegment: true,
          totalSegments: count,
          segmentIndex: i + 1,
          originalLength: piece.length,
          overlapMm: overlapMm,
        },
        notes: `Divisão simétrica: ${count}x ${(segLength / 1000).toFixed(2)}m (+${overlapMm}mm de transpasse). Peça total: ${(piece.length / 1000).toFixed(2)}m`,
      });
    }

    return segments;
  }

  /**
   * Alias para divisão de peças longas
   */
  static splitLongPiece(piece: CutPiece, maxMachineLength: number = 7000, overlapMm: number = 100): CutPiece[] {
    return this.suggestSegmentSplit(piece, maxMachineLength, overlapMm);
  }
}
