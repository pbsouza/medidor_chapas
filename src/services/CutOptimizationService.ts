import {
  CutPiece,
  CutStep,
  MachineSettings,
  OptimizationSolution,
  PlacedPiece,
  PriorityMode,
  RemnantArea,
  ScrapItem,
  SheetCutPlan,
  SheetItem,
} from '../types';
import { GeometryService } from './GeometryService';

interface StockCandidate {
  id: string;
  code: string;
  name: string;
  isScrap: boolean;
  width: number;
  length: number;
  material: string;
  thickness: string;
  availableQty: number;
  isCoil?: boolean;
  coilRemainingLength?: number;
  isStandardCommercial?: boolean;
}

interface ExpandedPiece {
  instanceId: string;
  pieceId: string;
  name: string;
  type: any;
  devStart: number;
  devEnd: number;
  length: number;
  material: string;
  thickness: string;
  isTrapezoid: boolean;
  areaMm2: number;
  maxWidth: number;
  minWidth: number;
}

// Larguras comerciais padrão de bobinas e chapas de funilaria/calhas no Brasil
// (30cm, 40cm, 50cm, 60cm, 70cm, 80cm, 90cm, 1.00m e 1.20m)
const STANDARD_COMMERCIAL_WIDTHS = [300, 400, 500, 600, 700, 800, 900, 1000, 1200];

export class CutOptimizationService {
  /**
   * Alias de compatibilidade
   */
  static generateSolutions(
    pieces: CutPiece[],
    sheets: SheetItem[],
    scraps: ScrapItem[],
    settings: MachineSettings
  ): OptimizationSolution[] {
    return this.optimize(pieces, sheets, scraps, settings);
  }

  /**
   * Executa a otimização de corte testando sistematicamente todas as larguras comerciais
   * de bobina (30cm, 40cm, 50cm, 60cm, 70cm, 80cm, 90cm, 1m, 1.20m) e o estoque de chapas/retalhos,
   * entregando pelo menos 3 opções distintas e viáveis com comparativo completo.
   */
  static optimize(
    pieces: CutPiece[],
    sheets: SheetItem[],
    scraps: ScrapItem[],
    settings: MachineSettings
  ): OptimizationSolution[] {
    const machineAlerts: string[] = [];

    // Pré-processa peças aplicando divisão simétrica para peças longas (> limite da máquina)
    const processedPieces: CutPiece[] = [];
    for (const p of pieces) {
      if (p.quantity <= 0 || p.length <= 0 || p.devStart <= 0) continue;

      if (p.length > settings.maxCutLength) {
        if (settings.autoSplitLongPieces) {
          const splitResult = GeometryService.calculateSpliceDetails(
            p.length,
            settings.maxCutLength,
            settings.spliceOverlapLength || 100
          );
          const segments = GeometryService.suggestSegmentSplit(
            p,
            settings.maxCutLength,
            settings.spliceOverlapLength || 100
          );
          machineAlerts.push(
            `📐 Peça "${p.name}" (${(p.length / 1000).toFixed(2)}m) dividida simetricamente em ${splitResult.segmentsCount} partes de ${(splitResult.segmentLengthMm / 1000).toFixed(2)}m com ${((settings.spliceOverlapLength || 100) / 10).toFixed(0)}cm de transpasse na emenda.`
          );
          processedPieces.push(...segments);
        } else {
          machineAlerts.push(
            `⚠️ A peça "${p.name}" (${(p.length / 1000).toFixed(2)}m) ultrapassa o limite contínuo (${(settings.maxCutLength / 1000).toFixed(2)}m). Ative a divisão simétrica ou reduza o comprimento.`
          );
          processedPieces.push(p);
        }
      } else {
        processedPieces.push(p);
      }
    }

    // Expande peças por quantidade
    const expandedPieces: ExpandedPiece[] = [];
    let instanceCounter = 1;

    for (const p of processedPieces) {
      for (let q = 0; q < p.quantity; q++) {
        expandedPieces.push({
          instanceId: `${p.id}_${instanceCounter++}`,
          pieceId: p.id,
          name: p.name,
          type: p.type,
          devStart: p.devStart,
          devEnd: p.devEnd || p.devStart,
          length: p.length,
          material: p.material,
          thickness: p.thickness,
          isTrapezoid: GeometryService.isTrapezoid(p),
          areaMm2: GeometryService.calculatePieceAreaMm2(p),
          maxWidth: GeometryService.getMaxWidth(p),
          minWidth: GeometryService.getMinWidth(p),
        });
      }
    }

    if (expandedPieces.length === 0) {
      return [];
    }

    const primaryMaterial = expandedPieces[0]?.material || 'Galvanizado';
    const primaryThickness = expandedPieces[0]?.thickness || '0.50mm';

    // Estoque de retalhos disponíveis cadastrados pelo usuário
    const userScraps: StockCandidate[] = scraps
      .filter((s) => s.status === 'disponivel' && s.quantity > 0)
      .map((s) => ({
        id: s.id,
        code: s.code || `RET-${s.id.slice(0, 4)}`,
        name: `Retalho ${s.code || ''} (${s.width} × ${s.length} mm)`,
        isScrap: true,
        width: s.width,
        length: s.length,
        material: s.material,
        thickness: s.thickness,
        availableQty: s.quantity,
      }));

    // Estoque de chapas físicas cadastradas pelo usuário
    const userSheets: StockCandidate[] = sheets
      .filter((sh) => sh.quantity > 0)
      .map((sh) => ({
        id: sh.id,
        code: sh.isCoil ? `ROLO-${sh.width}` : (sh.name || `CHAPA-${sh.width}x${sh.length}`),
        name: sh.name || (sh.isCoil ? `Rolo Bobina ${sh.width}mm` : `Chapa ${sh.width} × ${sh.length} mm`),
        isScrap: false,
        width: sh.width,
        length: sh.length,
        material: sh.material,
        thickness: sh.thickness,
        availableQty: sh.quantity,
        isCoil: sh.isCoil,
        coilRemainingLength: sh.coilRemainingLength || sh.length,
      }));

    const maxPieceWidth = Math.max(...expandedPieces.map((p) => p.maxWidth));
    const testedWidthsComparison: NonNullable<OptimizationSolution['allTestedWidthsComparison']> = [];
    const candidateSolutions: OptimizationSolution[] = [];

    // 1. Simulação para cada largura comercial de bobina
    for (const widthMm of STANDARD_COMMERCIAL_WIDTHS) {
      const widthCm = widthMm / 10;
      const isFeasible = widthMm >= maxPieceWidth;

      if (!isFeasible) {
        testedWidthsComparison.push({
          widthMm,
          widthCm,
          feasible: false,
          yieldPercentage: 0,
          metersToUnroll: 0,
          sheetsCount: 0,
          lateralWasteCm: 0,
          piecesPlaced: 0,
          description: `Largura insuficiente (maior peça requer ${maxPieceWidth / 10} cm).`,
        });
        continue;
      }

      const singleCoilCandidate: StockCandidate = {
        id: `coil_${widthMm}`,
        code: `BOBINA-${widthMm}`,
        name: `Bobina ${widthMm} mm (${widthCm} cm)`,
        isScrap: false,
        width: widthMm,
        length: 50000,
        material: primaryMaterial,
        thickness: primaryThickness,
        availableQty: 999,
        isCoil: true,
        coilRemainingLength: 50000,
        isStandardCommercial: true,
      };

      const solution = this.runSingleCoilStrategy(
        expandedPieces,
        singleCoilCandidate,
        settings,
        machineAlerts
      );

      if (solution && solution.unplacedPieces.length === 0) {
        const totalMeters = solution.plans.reduce((acc, p) => acc + p.length, 0) / 1000;
        
        // Calcula a maior sobra lateral de largura entre os planos gerados
        let avgLateralWasteMm = 0;
        if (solution.plans.length > 0) {
          const wastes = solution.plans.map((p) => {
            const sideRemnant = p.remnants.find((r) => r.width > 0 && r.y > 0);
            return sideRemnant ? sideRemnant.width : 0;
          });
          avgLateralWasteMm = Math.max(...wastes);
        }

        testedWidthsComparison.push({
          widthMm,
          widthCm,
          feasible: true,
          yieldPercentage: solution.yieldPercentage,
          metersToUnroll: Math.round(totalMeters * 100) / 100,
          sheetsCount: solution.plans.length,
          lateralWasteCm: Math.round((avgLateralWasteMm / 10) * 10) / 10,
          piecesPlaced: solution.totalPiecesPlaced,
          description: `Desenrolar ${totalMeters.toFixed(2)}m • Sobra lateral: ${(avgLateralWasteMm / 10).toFixed(1)} cm • Rendimento: ${solution.yieldPercentage}%`,
        });

        solution.primaryWidthMm = widthMm;
        solution.totalLengthCutMeters = Math.round(totalMeters * 100) / 100;
        solution.lateralWasteMm = avgLateralWasteMm;
        solution.summaryTag = `Bobina ${widthCm} cm • ${(avgLateralWasteMm / 10).toFixed(1)}cm sobra`;
        candidateSolutions.push(solution);
      }
    }

    // 2. Simulação com Retalhos Cadastrados (se houver)
    if (userScraps.length > 0) {
      const scrapsPool = [...userScraps, ...STANDARD_COMMERCIAL_WIDTHS.map((w) => ({
        id: `coil_fallback_${w}`,
        code: `BOBINA-${w}`,
        name: `Bobina ${w} mm (${w / 10} cm)`,
        isScrap: false,
        width: w,
        length: 50000,
        material: primaryMaterial,
        thickness: primaryThickness,
        availableQty: 999,
        isCoil: true,
        coilRemainingLength: 50000,
        isStandardCommercial: true,
      }))];

      const scrapSol = this.runStrategy(
        expandedPieces,
        scrapsPool,
        settings,
        'use_scraps_first',
        'Reaproveitamento de Retalhos Cadastrados',
        1,
        machineAlerts
      );

      if (scrapSol && scrapSol.totalScrapsUsed > 0 && scrapSol.unplacedPieces.length === 0) {
        scrapSol.summaryTag = `${scrapSol.totalScrapsUsed} retalho(s) da oficina reaproveitado(s)`;
        candidateSolutions.push(scrapSol);
      }
    }

    // 3. Simulação com Chapas Físicas Cadastradas (se houver)
    if (userSheets.length > 0) {
      const sheetsPool = [...userSheets, ...userScraps];
      const sheetSol = this.runStrategy(
        expandedPieces,
        sheetsPool,
        settings,
        'fewest_sheets',
        'Uso de Chapas Cadastradas em Estoque',
        1,
        machineAlerts
      );

      if (sheetSol && sheetSol.unplacedPieces.length === 0) {
        sheetSol.summaryTag = `${sheetSol.totalSheetsUsed} chapa(s) do estoque`;
        candidateSolutions.push(sheetSol);
      }
    }

    // Ordena as candidatas por Score e Rendimento decrescente
    candidateSolutions.sort((a, b) => b.score - a.score || b.yieldPercentage - a.yieldPercentage);

    // Filtra soluções duplicadas
    const uniqueSolutions: OptimizationSolution[] = [];
    const seenSignatures = new Set<string>();

    for (const sol of candidateSolutions) {
      const sig = sol.plans.map((p) => `${p.width}x${p.length}`).join('|');
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        uniqueSolutions.push(sol);
      }
    }

    const finalSolutions = uniqueSolutions.slice(0, 4);

    finalSolutions.forEach((sol, idx) => {
      const rank = (idx + 1) as 1 | 2 | 3 | 4 | 5;
      sol.rank = rank;
      sol.allTestedWidthsComparison = testedWidthsComparison;

      const pWidthCm = sol.primaryWidthMm ? `${sol.primaryWidthMm / 10} cm` : `${sol.plans[0]?.width / 10} cm`;
      const meters = sol.totalLengthCutMeters || Math.round((sol.plans.reduce((acc, p) => acc + p.length, 0) / 1000) * 100) / 100;
      const wasteCm = sol.lateralWasteMm !== undefined ? `${(sol.lateralWasteMm / 10).toFixed(1)} cm` : 'mínima';

      if (idx === 0) {
        sol.title = `🥇 Opção 1: Bobina de ${pWidthCm} (Recomendada • Mínima Sobra de ${wasteCm} • Desenrolar ${meters.toFixed(2)}m)`;
      } else if (idx === 1) {
        sol.title = `🥈 Opção 2: Bobina de ${pWidthCm} (Alternativa • Desenrolar ${meters.toFixed(2)}m • Sobra ${wasteCm})`;
      } else if (idx === 2) {
        sol.title = `🥉 Opção 3: Bobina de ${pWidthCm} (Alternativa • Desenrolar ${meters.toFixed(2)}m • Rendimento ${sol.yieldPercentage}%)`;
      } else {
        sol.title = `Opção ${idx + 1}: Bobina de ${pWidthCm} (Desenrolar ${meters.toFixed(2)}m • Rendimento ${sol.yieldPercentage}%)`;
      }
    });

    return finalSolutions;
  }

  /**
   * Executa a simulação focada em uma única largura de bobina comercial.
   * Empilha peças na largura (colocando uma embaixo da outra) para minimizar a metragem desenrolada.
   */
  private static runSingleCoilStrategy(
    allPieces: ExpandedPiece[],
    coilStock: StockCandidate,
    settings: MachineSettings,
    baseAlerts: string[]
  ): OptimizationSolution | null {
    let pendingPieces = [...allPieces];
    // Ordena peças por comprimento decrescente
    pendingPieces = this.sortPiecesForPacking(pendingPieces, 'max_yield');

    const plans: SheetCutPlan[] = [];
    const unplacedPieces: CutPiece[] = [];

    // Empacota em folhas sucessivas de bobina
    while (pendingPieces.length > 0) {
      const plan = this.packSingleCoilSheet(coilStock, pendingPieces, settings);
      if (!plan || plan.placedPieces.length === 0) {
        for (const up of pendingPieces) {
          unplacedPieces.push({
            id: up.pieceId,
            name: up.name,
            type: up.type,
            quantity: 1,
            devStart: up.devStart,
            devEnd: up.devEnd,
            length: up.length,
            material: up.material as any,
            thickness: up.thickness,
            notes: `Peça não cabe na bobina de ${coilStock.width / 10} cm`,
          });
        }
        break;
      }

      plans.push(plan);
      const placedIds = new Set(plan.placedPieces.map((p) => p.pieceId));
      pendingPieces = pendingPieces.filter((p) => !placedIds.has(p.instanceId));
    }

    if (unplacedPieces.length > 0) return null;

    let totalPiecesPlaced = 0;
    let totalUsedArea = 0;
    let totalSheetArea = 0;
    let totalWasteArea = 0;
    let usableScrapArea = 0;

    for (const plan of plans) {
      totalPiecesPlaced += plan.placedPieces.length;
      totalUsedArea += plan.usedAreaMm2;
      totalSheetArea += plan.totalAreaMm2;
      totalWasteArea += plan.wasteAreaMm2;
      usableScrapArea += plan.usableScrapAreaMm2;
    }

    const yieldPercentage =
      totalSheetArea > 0 ? Math.round((totalUsedArea / totalSheetArea) * 1000) / 10 : 0;

    let score = yieldPercentage * 100;
    score -= (totalWasteArea / 1_000_000) * 150;
    const totalMeters = plans.reduce((acc, p) => acc + p.length, 0) / 1000;
    score -= totalMeters * 20;

    const coilCutSuggestions = plans
      .filter((p) => p.isCoilCut && p.coilCutLengthMm)
      .map((p) => ({
        coilId: p.sheetId,
        coilName: p.sheetName,
        width: p.width,
        cutLengthMm: p.coilCutLengthMm || p.length,
        piecesSummary: p.placedPieces.map((pl) => `${pl.pieceName} (${(pl.length / 1000).toFixed(2)}m)`).join(', '),
      }));

    return {
      id: `sol_coil_${coilStock.width}_${Date.now()}`,
      title: `Bobina de ${coilStock.width / 10} cm`,
      rank: 1,
      priorityMode: 'max_yield',
      score: Math.round(score),
      yieldPercentage,
      totalWasteAreaMm2: totalWasteArea,
      totalSheetsUsed: plans.length,
      totalScrapsUsed: 0,
      usableScrapsGenerated: plans.reduce((acc, p) => acc + p.remnants.filter((r) => r.isUsable).length, 0),
      totalPiecesPlaced,
      totalPiecesRequested: allPieces.length,
      plans,
      unplacedPieces,
      machineAlerts: [...baseAlerts],
      coilCutSuggestions,
    };
  }

  /**
   * Empacota UMA folha de bobina contínua.
   * Define o comprimento da folha pelo maior comprimento das peças candidatas
   * e empilha o máximo de tiras na LARGURA (eixo Y), colocando uma embaixo da outra!
   */
  private static packSingleCoilSheet(
    stock: StockCandidate,
    availablePieces: ExpandedPiece[],
    settings: MachineSettings
  ): SheetCutPlan | null {
    const sheetW = stock.width;
    const kerf = Math.max(0, settings.kerf || 0);
    const margin = Math.max(0, settings.safetyMargin || 0);
    const effectiveW = sheetW - 2 * margin;

    if (effectiveW <= 0 || availablePieces.length === 0) return null;

    // 1. O comprimento desta folha de bobina é determinado pelo comprimento da maior peça pendente
    const sheetTargetLength = Math.max(...availablePieces.map((p) => p.length));
    const effectiveL = sheetTargetLength;

    const placed: PlacedPiece[] = [];
    const usedPieceIndices = new Set<number>();
    let cutStepCounter = 1;
    const cutSteps: CutStep[] = [];

    let currentY = margin;

    // Loop de faixas verticais ao longo da largura (Y)
    while (currentY < sheetW - margin + 0.01) {
      const remainingHeight = sheetW - margin - currentY;
      if (remainingHeight < 0.5) break;

      // 1. TENTA ENCAIXAR TRAPÉZIOS PAREADOS (Ponta maior com ponta menor)
      let pairedTrapezoidFound = false;
      let t1Idx = -1;

      for (let i = 0; i < availablePieces.length; i++) {
        if (!usedPieceIndices.has(i) && availablePieces[i].isTrapezoid) {
          t1Idx = i;
          break;
        }
      }

      if (t1Idx !== -1) {
        const p1 = availablePieces[t1Idx];
        let t2Idx = -1;

        for (let j = 0; j < availablePieces.length; j++) {
          if (
            j !== t1Idx &&
            !usedPieceIndices.has(j) &&
            availablePieces[j].isTrapezoid &&
            Math.abs(availablePieces[j].length - p1.length) <= 10
          ) {
            t2Idx = j;
            break;
          }
        }

        if (t2Idx !== -1) {
          const p2 = availablePieces[t2Idx];
          const stripWidth = Math.max(
            p1.devStart + Math.min(p2.devStart, p2.devEnd),
            p1.devEnd + Math.max(p2.devStart, p2.devEnd)
          );

          if (stripWidth <= remainingHeight + 0.01) {
            usedPieceIndices.add(t1Idx);
            usedPieceIndices.add(t2Idx);

            const trapLength = p1.length;
            const currentX = margin;

            const polyA = `${currentX},${currentY} ${currentX + trapLength},${currentY} ${currentX + trapLength},${currentY + p1.devEnd} ${currentX},${currentY + p1.devStart}`;
            const polyB = `${currentX},${currentY + p1.devStart} ${currentX + trapLength},${currentY + p1.devEnd} ${currentX + trapLength},${currentY + stripWidth} ${currentX},${currentY + stripWidth}`;

            placed.push({
              pieceId: p1.instanceId,
              pieceName: p1.name,
              pieceType: p1.type,
              x: currentX,
              y: currentY,
              length: trapLength,
              devStart: p1.devStart,
              devEnd: p1.devEnd,
              isTrapezoid: true,
              isFlipped: false,
              cutIndex: placed.length + 1,
              colorIndex: (placed.length % 6) + 1,
              polygonPoints: polyA,
              trapezoidPairName: p2.name,
              trapezoidDiagonalGuide: `Pareada com ${p2.name} na tira de ${stripWidth}mm`,
            });

            placed.push({
              pieceId: p2.instanceId,
              pieceName: p2.name,
              pieceType: p2.type,
              x: currentX,
              y: currentY + p1.devStart,
              length: trapLength,
              devStart: p2.devStart,
              devEnd: p2.devEnd,
              isTrapezoid: true,
              isFlipped: true,
              cutIndex: placed.length + 2,
              colorIndex: (placed.length % 6) + 2,
              polygonPoints: polyB,
              trapezoidPairName: p1.name,
              trapezoidDiagonalGuide: `Invertida para encaixe 100% sem perda`,
            });

            cutSteps.push({
              step: cutStepCounter++,
              type: 'guilhotina_longitudinal',
              description: `Corte longitudinal de tira: Largura ${stripWidth} mm no comprimento ${trapLength} mm`,
              positionMm: currentY + stripWidth,
              dimensionMm: stripWidth,
            });

            cutSteps.push({
              step: cutStepCounter++,
              type: 'corte_diagonal_trapezio',
              description: `✂️ CORTE DIAGONAL: Marcar ${p1.devStart}mm na esquerda e ${p1.devEnd}mm na direita da tira de ${stripWidth}mm. Cortar na diagonal para separar ${p1.name} e ${p2.name}.`,
              positionMm: currentY,
              dimensionMm: trapLength,
            });

            currentY += stripWidth + kerf;
            pairedTrapezoidFound = true;
          }
        }
      }

      if (pairedTrapezoidFound) continue;

      // 2. ENCAIXA TIRA RETANGULAR (Usa a melhor peça disponível que caiba na largura restante)
      let bestPieceIdx = -1;
      for (let i = 0; i < availablePieces.length; i++) {
        if (usedPieceIndices.has(i)) continue;
        const p = availablePieces[i];

        if (p.maxWidth <= remainingHeight + 0.01 && p.length <= effectiveL) {
          bestPieceIdx = i;
          break;
        }
      }

      if (bestPieceIdx === -1) break;

      const p = availablePieces[bestPieceIdx];
      usedPieceIndices.add(bestPieceIdx);
      const stripWidth = p.maxWidth;

      // Coloca a peça na tira na posição X inicial
      let currentX = margin;

      placed.push({
        pieceId: p.instanceId,
        pieceName: p.name,
        pieceType: p.type,
        x: currentX,
        y: currentY,
        length: p.length,
        devStart: p.devStart,
        devEnd: p.devEnd,
        isTrapezoid: p.isTrapezoid,
        isFlipped: false,
        cutIndex: placed.length + 1,
        colorIndex: (placed.length % 6) + 1,
      });

      cutSteps.push({
        step: cutStepCounter++,
        type: 'guilhotina_transversal',
        description: `Corte transversal de ${p.name} em ${currentX + p.length} mm (Desenvolvimento: ${p.maxWidth} mm)`,
        positionMm: currentX + p.length,
        dimensionMm: p.length,
      });

      currentX += p.length + kerf;

      // Se ainda sobrar espaço no comprimento desta mesma tira e houver outras peças compatíveis
      while (currentX < effectiveL - margin + 0.01) {
        const remainingLength = effectiveL - margin - currentX;
        if (remainingLength < 0.5) break;

        let subIdx = -1;
        for (let i = 0; i < availablePieces.length; i++) {
          if (usedPieceIndices.has(i)) continue;
          const subP = availablePieces[i];
          if (subP.maxWidth <= stripWidth && subP.length <= remainingLength + 0.01) {
            subIdx = i;
            break;
          }
        }

        if (subIdx === -1) break;

        const subP = availablePieces[subIdx];
        usedPieceIndices.add(subIdx);

        placed.push({
          pieceId: subP.instanceId,
          pieceName: subP.name,
          pieceType: subP.type,
          x: currentX,
          y: currentY,
          length: subP.length,
          devStart: subP.devStart,
          devEnd: subP.devEnd,
          isTrapezoid: subP.isTrapezoid,
          isFlipped: false,
          cutIndex: placed.length + 1,
          colorIndex: (placed.length % 6) + 1,
        });

        cutSteps.push({
          step: cutStepCounter++,
          type: 'guilhotina_transversal',
          description: `Corte transversal de ${subP.name} em ${currentX + subP.length} mm`,
          positionMm: currentX + subP.length,
          dimensionMm: subP.length,
        });

        currentX += subP.length + kerf;
      }

      cutSteps.push({
        step: cutStepCounter++,
        type: 'guilhotina_longitudinal',
        description: `Corte longitudinal da tira na largura ${stripWidth} mm`,
        positionMm: currentY + stripWidth,
        dimensionMm: stripWidth,
      });

      // Avança no eixo Y: A PRÓXIMA PEÇA VAI EMBAIXO DESTA NA LARGURA DA CHAPA!
      currentY += stripWidth + kerf;
    }

    if (placed.length === 0) return null;

    let maxX = 0;
    for (const p of placed) {
      maxX = Math.max(maxX, p.x + p.length);
    }

    const effectivePlanLength = Math.max(100, maxX + margin);
    const effectivePlanName = `Bobina ${sheetW}mm (${sheetW / 10}cm) • Desenrolar ${(effectivePlanLength / 1000).toFixed(2)}m`;

    const finalCutSteps: CutStep[] = [
      {
        step: 1,
        type: 'corte_bobina_desenrolar',
        description: `Desenrolar e guilhotinar uma folha de ${(effectivePlanLength / 1000).toFixed(2)} metros da bobina de ${sheetW} mm (${sheetW / 10} cm).`,
        positionMm: effectivePlanLength,
        dimensionMm: effectivePlanLength,
      },
      ...cutSteps.map((s, idx) => ({ ...s, step: idx + 2 })),
    ];

    let usedAreaMm2 = 0;
    for (const pl of placed) {
      usedAreaMm2 += GeometryService.calculatePieceAreaMm2(pl);
    }

    const totalAreaMm2 = sheetW * effectivePlanLength;

    const remnants: RemnantArea[] = [];
    let remnantCounter = 1;

    // Sobra lateral na largura
    const unusedY = sheetW - currentY;
    if (unusedY > 0) {
      const isUsable = unusedY >= settings.scrapMinWidth && effectivePlanLength >= settings.scrapMinLength;
      remnants.push({
        id: `rem_${stock.id}_w_${remnantCounter++}`,
        code: isUsable ? `SOBRA-L${unusedY}` : `APARA-L${unusedY}`,
        x: 0,
        y: currentY,
        length: effectivePlanLength,
        width: unusedY,
        isUsable,
        areaMm2: unusedY * effectivePlanLength,
      });
    }

    let usableScrapAreaMm2 = 0;
    for (const r of remnants) {
      if (r.isUsable) usableScrapAreaMm2 += r.areaMm2;
    }

    const wasteAreaMm2 = Math.max(0, totalAreaMm2 - usedAreaMm2 - usableScrapAreaMm2);
    const yieldPercentage =
      totalAreaMm2 > 0 ? Math.round((usedAreaMm2 / totalAreaMm2) * 1000) / 10 : 0;

    const instructions: string[] = [
      `1. Puxar do rolo e guilhotinar uma chapa de ${(effectivePlanLength / 1000).toFixed(2)} metros na largura de ${sheetW} mm (${sheetW / 10} cm).`,
      `2. Efetuar os ${placed.length} cortes longitudinais nas larguras de tira programadas no diagrama (Aproveitamento: ${yieldPercentage}%).`,
    ];

    return {
      sheetId: stock.id,
      sheetCode: stock.code,
      sheetName: effectivePlanName,
      isScrap: false,
      isCoilCut: true,
      coilCutLengthMm: effectivePlanLength,
      coilSourceId: stock.id,
      width: sheetW,
      length: effectivePlanLength,
      material: stock.material as any,
      thickness: stock.thickness,
      placedPieces: placed,
      remnants,
      usedAreaMm2: Math.round(usedAreaMm2),
      totalAreaMm2: Math.round(totalAreaMm2),
      yieldPercentage,
      wasteAreaMm2: Math.round(wasteAreaMm2),
      usableScrapAreaMm2: Math.round(usableScrapAreaMm2),
      cutSequence: finalCutSteps,
      cuttingInstructions: instructions,
    };
  }

  /**
   * Executa a otimização com simulação comparativa multi-estoque
   */
  private static runStrategy(
    allPieces: ExpandedPiece[],
    allStock: StockCandidate[],
    settings: MachineSettings,
    mode: PriorityMode,
    title: string,
    rank: 1 | 2 | 3 | 4 | 5,
    baseAlerts: string[]
  ): OptimizationSolution {
    const stockAvailable = allStock.map((s) => ({ ...s }));
    let pendingPieces = [...allPieces];

    const plans: SheetCutPlan[] = [];
    const unplacedPieces: CutPiece[] = [];

    pendingPieces = this.sortPiecesForPacking(pendingPieces, mode);

    while (pendingPieces.length > 0) {
      let bestPlan: SheetCutPlan | null = null;
      let bestStockCandidate: StockCandidate | null = null;
      let bestScore = -Infinity;

      let eligibleStock = stockAvailable.filter((s) => s.availableQty > 0);

      if (mode === 'use_scraps_first') {
        const scrapsOnly = eligibleStock.filter((s) => s.isScrap);
        let scrapHasViablePieces = false;

        for (const scrap of scrapsOnly) {
          const testPlan = this.packSingleCoilSheet(scrap, [...pendingPieces], settings);
          if (testPlan && testPlan.placedPieces.length > 0) {
            scrapHasViablePieces = true;
            break;
          }
        }

        if (scrapHasViablePieces) {
          eligibleStock = scrapsOnly;
        }
      }

      for (const stock of eligibleStock) {
        const testPieces = [...pendingPieces];
        const candidatePlan = this.packSingleCoilSheet(stock, testPieces, settings);

        if (!candidatePlan || candidatePlan.placedPieces.length === 0) {
          continue;
        }

        const score = this.calculateCandidateScore(
          candidatePlan,
          stock,
          pendingPieces,
          settings,
          mode
        );

        if (score > bestScore) {
          bestScore = score;
          bestPlan = candidatePlan;
          bestStockCandidate = stock;
        }
      }

      if (bestPlan && bestStockCandidate) {
        plans.push(bestPlan);

        if (!bestStockCandidate.isStandardCommercial) {
          bestStockCandidate.availableQty -= 1;
        }

        const placedIds = new Set(bestPlan.placedPieces.map((p) => p.pieceId));
        pendingPieces = pendingPieces.filter((p) => !placedIds.has(p.instanceId));
      } else {
        for (const up of pendingPieces) {
          unplacedPieces.push({
            id: up.pieceId,
            name: up.name,
            type: up.type,
            quantity: 1,
            devStart: up.devStart,
            devEnd: up.devEnd,
            length: up.length,
            material: up.material as any,
            thickness: up.thickness,
            notes: 'Dimensões incompatíveis com o estoque disponível.',
          });
        }
        break;
      }
    }

    let totalPiecesPlaced = 0;
    let totalUsedArea = 0;
    let totalSheetArea = 0;
    let totalWasteArea = 0;
    let usableScrapArea = 0;
    let totalSheetsUsed = 0;
    let totalScrapsUsed = 0;
    let usableScrapsGenerated = 0;

    for (const plan of plans) {
      totalPiecesPlaced += plan.placedPieces.length;
      totalUsedArea += plan.usedAreaMm2;
      totalSheetArea += plan.totalAreaMm2;
      totalWasteArea += plan.wasteAreaMm2;
      usableScrapArea += plan.usableScrapAreaMm2;

      if (plan.isScrap) totalScrapsUsed++;
      else totalSheetsUsed++;

      usableScrapsGenerated += plan.remnants.filter((r) => r.isUsable).length;
    }

    const yieldPercentage =
      totalSheetArea > 0 ? Math.round((totalUsedArea / totalSheetArea) * 1000) / 10 : 0;

    let score = yieldPercentage * 100;
    score -= (totalWasteArea / 1_000_000) * 150;
    if (mode === 'use_scraps_first') score += totalScrapsUsed * 200;
    if (unplacedPieces.length > 0) score -= unplacedPieces.length * 5000;

    const alerts = [...baseAlerts];
    if (unplacedPieces.length > 0) {
      alerts.push(
        `Atenção: ${unplacedPieces.length} peça(s) não puderam ser cortadas nas dimensões especificadas.`
      );
    }

    const coilCutSuggestions = plans
      .filter((p) => p.isCoilCut && p.coilCutLengthMm)
      .map((p) => ({
        coilId: p.sheetId,
        coilName: p.sheetName,
        width: p.width,
        cutLengthMm: p.coilCutLengthMm || p.length,
        piecesSummary: p.placedPieces.map((pl) => `${pl.pieceName} (${(pl.length / 1000).toFixed(2)}m)`).join(', '),
      }));

    return {
      id: `sol_${mode}_${rank}_${Date.now()}`,
      title,
      rank,
      priorityMode: mode,
      score: Math.round(score),
      yieldPercentage,
      totalWasteAreaMm2: totalWasteArea,
      totalSheetsUsed,
      totalScrapsUsed,
      usableScrapsGenerated,
      totalPiecesPlaced,
      totalPiecesRequested: allPieces.length,
      plans,
      unplacedPieces,
      machineAlerts: alerts,
      coilCutSuggestions,
    };
  }

  private static calculateCandidateScore(
    plan: SheetCutPlan,
    stock: StockCandidate,
    _totalPendingPieces: ExpandedPiece[],
    settings: MachineSettings,
    mode: PriorityMode
  ): number {
    const yieldPct = plan.yieldPercentage;
    const wasteM2 = plan.wasteAreaMm2 / 1_000_000;
    const piecesCount = plan.placedPieces.length;

    let score = yieldPct * 100;
    score -= wasteM2 * 200;
    score += piecesCount * 40;

    let maxY = 0;
    for (const p of plan.placedPieces) {
      maxY = Math.max(maxY, p.y + (p.devStart || p.length));
    }
    const widthUsage = stock.width > 0 ? maxY / stock.width : 0;

    if (widthUsage >= 0.9) {
      score += 300;
    } else if (widthUsage >= 0.8) {
      score += 150;
    } else if (widthUsage < 0.6) {
      score -= (1 - widthUsage) * 250;
    }

    if (stock.isScrap) {
      score += mode === 'use_scraps_first' ? 500 : 100;
    }

    if (!stock.isStandardCommercial && !stock.isScrap) {
      score += 50;
    }

    if (settings.preferredWidth && stock.width === settings.preferredWidth) {
      score += 80;
    }

    return score;
  }

  private static sortPiecesForPacking(
    pieces: ExpandedPiece[],
    _mode: PriorityMode
  ): ExpandedPiece[] {
    const list = [...pieces];

    const trapezoids = list.filter((p) => p.isTrapezoid);
    const rectangulars = list.filter((p) => !p.isTrapezoid);

    // Ordena por comprimento decrescente, depois por largura
    rectangulars.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return b.maxWidth - a.maxWidth;
    });

    trapezoids.sort((a, b) => b.length - a.length);

    return [...trapezoids, ...rectangulars];
  }
}
