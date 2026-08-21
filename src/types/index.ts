export type MaterialType =
  | 'Galvanizado'
  | 'Galvalume'
  | 'Inox'
  | 'Alumínio'
  | 'Cobre'
  | 'Pintura Eletrostática'
  | 'Outro';

export type PieceType =
  | 'calha'
  | 'calha_platibanda'
  | 'calha_beiral'
  | 'calha_moldura'
  | 'rufo'
  | 'rufo_externo'
  | 'rufo_encoste'
  | 'pingadeira'
  | 'colarinho'
  | 'contra_rufo'
  | 'perfil'
  | 'outro';

export type PriorityMode =
  | 'balanced' // Equilibrado (padrão)
  | 'max_yield' // Máximo aproveitamento
  | 'fewest_sheets' // Menor número de chapas
  | 'use_scraps_first' // Usar primeiro os retalhos
  | 'preserve_large_scraps' // Preservar retalhos grandes
  | 'most_stock_first' // Priorizar chapa com mais estoque / maior quantidade
  | 'preferred_width'; // Priorizar determinada largura de chapa (ex: 1200mm, 1000mm)

export type UnitType = 'mm' | 'cm' | 'm';

export interface SheetItem {
  id: string;
  name: string;
  width: number; // Desenvolvimento em mm (largura da chapa/bobina)
  length: number; // Comprimento em mm (para chapas planas ou comprimento total do rolo ex: 30000-40000mm)
  quantity: number;
  material: MaterialType | string;
  thickness: string; // Ex: "0.50mm", "0.43mm", "0.65mm"
  isCoil?: boolean; // Se é Rolo/Bobina contínua de 30 a 40m
  coilRemainingLength?: number; // Metragem restante na bobina em mm
  color?: string;
  notes?: string;
  createdAt: string;
}

export type ScrapShapeType = 'retangular' | 'trapezio' | 'triangulo';

export interface ScrapItem {
  id: string;
  code: string; // Ex: R001, R002
  name?: string;
  width: number; // Desenvolvimento inicial / maior em mm
  widthEnd?: number; // Desenvolvimento final em mm (igual a width se retangular, menor que width se trapezoidal, 0 se triangular)
  isTrapezoid?: boolean;
  shapeType?: ScrapShapeType;
  length: number; // Comprimento em mm
  quantity: number;
  material: MaterialType | string;
  thickness: string;
  color?: string;
  notes?: string;
  sourceOrderId?: string;
  sourceSheetName?: string;
  location?: string;
  status: 'disponivel' | 'reservado' | 'utilizado';
  createdAt: string;
}

export interface SpliceInfo {
  isSpliceSegment: boolean;
  totalSegments: number;
  segmentIndex: number;
  originalLength: number;
  overlapMm: number;
}

export interface CutPiece {
  id: string;
  name: string;
  type: PieceType;
  quantity: number;
  devStart: number; // Desenvolvimento inicial em mm
  devEnd: number; // Desenvolvimento final em mm (igual devStart se retangular)
  length: number; // Comprimento em mm
  material: MaterialType | string;
  thickness: string;
  notes?: string;
  originalPieceId?: string; // se foi dividida devido ao limite da máquina
  isSegment?: boolean;
  spliceInfo?: SpliceInfo;
}

export interface MachineSettings {
  maxCutLength: number; // Comprimento máximo contínuo da peça / guilhotina em mm (padrão: 7000 mm = 7,00 m)
  spliceOverlapLength: number; // Tamanho do transpasse / emenda em mm (padrão: 100 mm = 10 cm)
  autoSplitLongPieces: boolean; // Se deve dividir peças > maxCutLength simetricamente ao meio
  allowCoilCustomCut: boolean; // Se calcula o tamanho exato da folha a ser desenrolada do rolo de 30 a 40m
  supportCoilRolls?: boolean;
  kerf: number; // Perda do corte / serra em mm (ex: 2)
  safetyMargin: number; // Margem de segurança de borda em mm (ex: 5)
  minSpacing: number; // Espaçamento entre peças em mm (ex: 3)
  scrapMinLength: number; // Comprimento mínimo para considerar retalho reaproveitável (ex: 400mm)
  scrapMinWidth: number; // Largura mínima para considerar retalho reaproveitável (ex: 150mm)
  defaultPriority: PriorityMode;
  defaultUnit: UnitType;
  preferredWidth?: number; // Largura de chapa preferida em mm (ex: 1200, 1000 ou 0 para qualquer)
  prioritizeMostInStock?: boolean; // Se prioriza a chapa com maior quantidade no estoque
}

export interface PlacedPiece {
  pieceId: string;
  pieceName: string;
  pieceType: PieceType;
  x: number; // Posição ao longo do comprimento (mm)
  y: number; // Posição ao longo da largura/desenvolvimento (mm)
  length: number;
  devStart: number;
  devEnd: number;
  isTrapezoid: boolean;
  isFlipped: boolean; // se o trapézio foi invertido para encaixe complementar
  isRotated?: boolean;
  rotation?: number; // Ângulo de rotação da peça em graus (0, 45, 90, 135, 180, 270)
  cutIndex: number;
  colorIndex: number;
  spliceInfo?: SpliceInfo;
  polygonPoints?: string; // Vértices SVG calculados com precisão
  trapezoidPairName?: string; // Nome da peça complementar pareada
  trapezoidDiagonalGuide?: string; // Instrução de marcação diagonal (ex: "Marcar 400mm no início e 300mm no final")
}

export interface RemnantArea {
  id: string;
  code: string;
  x: number;
  y: number;
  length: number;
  width: number;
  widthEnd?: number;
  isTrapezoid?: boolean;
  shapeType?: ScrapShapeType;
  polygonPoints?: string;
  isUsable: boolean; // Se dimensões >= scrapMinLength e scrapMinWidth
  areaMm2: number;
}

export interface CutStep {
  step: number;
  type: 'guilhotina_longitudinal' | 'guilhotina_transversal' | 'corte_diagonal_trapezio' | 'aparagem' | 'corte_bobina_desenrolar';
  description: string;
  positionMm: number;
  dimensionMm: number;
}

export type StockCategory = 'rolo' | 'chapa' | 'retalho' | 'sugestao_compra';

export interface SheetCutPlan {
  sheetId: string;
  sheetCode: string;
  sheetName: string;
  isScrap: boolean;
  isTrapezoidScrap?: boolean;
  scrapWidthEnd?: number;
  isCoilCut?: boolean; // Se foi cortada sob medida de uma bobina/rolo
  coilCutLengthMm?: number; // Metragem exata a ser desenrolada e cortada da bobina
  coilSourceId?: string;
  stockCategory?: StockCategory;
  isFromUserStock?: boolean;
  width: number;
  length: number;
  material: MaterialType | string;
  thickness: string;
  placedPieces: PlacedPiece[];
  remnants: RemnantArea[];
  usedAreaMm2: number;
  totalAreaMm2: number;
  yieldPercentage: number;
  wasteAreaMm2: number;
  usableScrapAreaMm2: number;
  cutSequence: CutStep[];
  cuttingInstructions?: string[]; // Instruções passo a passo para a oficina
}

export interface CoilCutSuggestion {
  coilId: string;
  coilName: string;
  width: number;
  cutLengthMm: number;
  piecesSummary: string;
}

export interface OptimizationSolution {
  id: string;
  title: string;
  rank: 1 | 2 | 3 | 4 | 5;
  priorityMode: PriorityMode;
  score: number;
  yieldPercentage: number;
  totalWasteAreaMm2: number;
  totalSheetsUsed: number;
  totalScrapsUsed: number;
  usableScrapsGenerated: number;
  totalPiecesPlaced: number;
  totalPiecesRequested: number;
  plans: SheetCutPlan[];
  unplacedPieces: CutPiece[];
  machineAlerts: string[];
  coilCutSuggestions?: CoilCutSuggestion[];
  primaryWidthMm?: number;
  totalLengthCutMeters?: number;
  lateralWasteMm?: number;
  summaryTag?: string;
  stockCategory?: StockCategory;
  isFromUserStock?: boolean;
  allTestedWidthsComparison?: {
    widthMm: number;
    widthCm: number;
    feasible: boolean;
    yieldPercentage: number;
    metersToUnroll: number;
    sheetsCount: number;
    lateralWasteCm: number;
    piecesPlaced: number;
    description: string;
    isFromStock?: boolean;
  }[];
}

export interface CutOrder {
  id: string;
  orderNumber: string; // Ex: OC-2026-001
  title: string;
  customerName?: string;
  status: 'planejamento' | 'confirmada' | 'cortada' | 'cancelada';
  pieces: CutPiece[];
  selectedSolution?: OptimizationSolution;
  machineSettings: MachineSettings;
  createdAt: string;
  executedAt?: string;
  notes?: string;
  priority?: PriorityMode;
  yieldPercentage?: number;
}

export interface AIExtractedItem {
  pieceName: string;
  type: PieceType;
  quantity: number;
  devStart: number;
  devEnd: number;
  length: number;
  material?: string;
  thickness?: string;
  confidence: number;
  notes?: string;
  warnings?: string[];
}

export interface AIAnalysisResponse {
  success: boolean;
  documentSummary: string;
  warnings: string[];
  extractedPieces: AIExtractedItem[];
  rawError?: string;
}
