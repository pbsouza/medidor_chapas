import {
  CutPiece,
  SheetItem,
  ScrapItem,
  MachineSettings,
  OptimizationSolution,
  SheetCutPlan,
  PlacedPiece,
  CutStep,
  RemnantArea,
  PriorityMode,
  ScrapShapeType,
  StockCategory,
  PieceType,
} from '../types';
import { GeometryService } from './GeometryService';

export const STANDARD_COMMERCIAL_WIDTHS = [
  300, 400, 500, 600, 700, 800, 900, 1000, 1200,
];

export interface ExpandedPiece {
  instanceId: string;
  pieceId: string;
  name: string;
  type: string;
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

export interface StockCandidate {
  id: string;
  code: string;
  name: string;
  isScrap: boolean;
  width: number;
  widthEnd?: number;
  isTrapezoid?: boolean;
  length: number;
  material: string;
  thickness: string;
  availableQty: number;
  isCoil?: boolean;
  coilRemainingLength?: number;
  isStandardCommercial?: boolean;
  isFromUserStock?: boolean;
  stockCategory?: StockCategory;
}

export class CutOptimizationService {
  /**
   * Alias de compatibilidade para optimize
   */
  public static generateSolutions(
    pieces: CutPiece[],
    sheets: SheetItem[],
    scraps: ScrapItem[],
    settings: MachineSettings
  ): OptimizationSolution[] {
    return this.optimize(pieces, sheets, scraps, settings);
  }

  /**
   * Ponto de entrada principal da otimização de corte.
   * Respeita rigorosamente o estoque cadastrado pelo usuário.
   */
  public static optimize(
    pieces: CutPiece[],
    sheets: SheetItem[],
    scraps: ScrapItem[],
    settings: MachineSettings
  ): OptimizationSolution[] {
    const machineAlerts: string[] = [];

    // Validações de limites de máquina
    const processedPieces: CutPiece[] = [];
    for (const p of pieces) {
      if (p.quantity <= 0) continue;

      if (p.length > settings.maxCutLength) {
        if (settings.autoSplitLongPieces) {
          const splitParts = Math.ceil(p.length / settings.maxCutLength);
          const partLength = Math.round(p.length / splitParts);
          const isTrap = GeometryService.isTrapezoid(p);
          const totalDelta = isTrap ? (p.devEnd || p.devStart) - p.devStart : 0;

          machineAlerts.push(
            `ℹ️ Peça "${p.name}" (${(p.length / 1000).toFixed(2)}m) dividida automaticamente em ${splitParts} partes de ${(partLength / 1000).toFixed(2)}m (limite da guilhotina: ${(settings.maxCutLength / 1000).toFixed(2)}m).`
          );

          for (let sp = 0; sp < splitParts; sp++) {
            const segStartRatio = sp / splitParts;
            const segEndRatio = (sp + 1) / splitParts;
            const devS = Math.round(p.devStart + totalDelta * segStartRatio);
            const devE = Math.round(p.devStart + totalDelta * segEndRatio);

            processedPieces.push({
              ...p,
              id: `${p.id}_split_${sp + 1}`,
              name: `${p.name} (Parte ${sp + 1}/${splitParts})`,
              length: partLength,
              devStart: devS,
              devEnd: isTrap ? devE : undefined,
              quantity: p.quantity,
            });
          }
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
    const maxPieceWidth = Math.max(...expandedPieces.map((p) => p.maxWidth));

    // 1. Estoque de retalhos disponíveis cadastrados pelo usuário
    const userScraps: StockCandidate[] = scraps
      .filter((s) => s.status === 'disponivel' && s.quantity > 0)
      .map((s) => ({
        id: s.id,
        code: s.code || `RET-${s.id.slice(0, 4)}`,
        name: s.name || `Retalho ${s.code || ''} (${GeometryService.formatScrapDimensions(s)})`,
        isScrap: true,
        width: s.width,
        widthEnd: s.widthEnd,
        isTrapezoid: s.isTrapezoid || (s.widthEnd !== undefined && s.widthEnd !== s.width),
        length: s.length,
        material: s.material,
        thickness: s.thickness,
        availableQty: s.quantity,
        isFromUserStock: true,
        stockCategory: 'retalho',
      }));

    // 2. Estoque de Bobinas / Rolos cadastradas pelo usuário
    const userCoils: StockCandidate[] = sheets
      .filter((sh) => (sh.isCoil || sh.length >= 20000) && sh.quantity > 0)
      .map((sh) => ({
        id: sh.id,
        code: `ROLO-${sh.width}`,
        name: sh.name || `Rolo Bobina ${sh.width} mm (${sh.width / 10} cm)`,
        isScrap: false,
        width: sh.width,
        length: sh.length || 50000,
        material: sh.material,
        thickness: sh.thickness,
        availableQty: sh.quantity,
        isCoil: true,
        coilRemainingLength: sh.coilRemainingLength || sh.length || 50000,
        isFromUserStock: true,
        stockCategory: 'rolo',
      }));

    // 3. Estoque de Chapas Planas Inteiras cadastradas pelo usuário
    const userFlatSheets: StockCandidate[] = sheets
      .filter((sh) => !sh.isCoil && sh.length < 20000 && sh.quantity > 0)
      .map((sh) => ({
        id: sh.id,
        code: sh.name || `CHAPA-${sh.width}x${sh.length}`,
        name: sh.name || `Chapa Plana ${sh.width} × ${sh.length} mm`,
        isScrap: false,
        width: sh.width,
        length: sh.length,
        material: sh.material,
        thickness: sh.thickness,
        availableQty: sh.quantity,
        isCoil: false,
        isFromUserStock: true,
        stockCategory: 'chapa',
      }));

    const hasUserInventory =
      userCoils.length > 0 || userFlatSheets.length > 0 || userScraps.length > 0;

    const testedWidthsComparison: NonNullable<OptimizationSolution['allTestedWidthsComparison']> = [];
    const candidateSolutions: OptimizationSolution[] = [];

    // =========================================================================
    // CENÁRIO A: USUÁRIO POSSUI ESTOQUE CADASTRADO
    // Sugere EXCLUSIVAMENTE os materiais que o usuário tem na oficina!
    // =========================================================================
    if (hasUserInventory) {
      // 1. Simulação para cada Bobina/Rolo cadastrada no estoque do usuário
      if (userCoils.length > 0) {
        // Agrupa por largura única para testar cada opção de rolo disponível
        const uniqueCoilWidths = Array.from(new Set(userCoils.map((c) => c.width)));

        for (const widthMm of uniqueCoilWidths) {
          const matchingCoil = userCoils.find((c) => c.width === widthMm)!;
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
              description: `Rolo do estoque insuficiente (maior peça requer ${maxPieceWidth / 10} cm).`,
              isFromStock: true,
            });
            continue;
          }

          const solution = this.runSingleCoilStrategy(
            expandedPieces,
            matchingCoil,
            settings,
            machineAlerts
          );

          if (solution && solution.unplacedPieces.length === 0) {
            const totalMeters = solution.plans.reduce((acc, p) => acc + p.length, 0) / 1000;
            let maxLateralWasteMm = 0;
            if (solution.plans.length > 0) {
              const wastes = solution.plans.map((p) => {
                const sideRemnant = p.remnants.find((r) => r.width > 0 && r.y > 0);
                return sideRemnant ? sideRemnant.width : 0;
              });
              maxLateralWasteMm = Math.max(...wastes);
            }

            testedWidthsComparison.push({
              widthMm,
              widthCm,
              feasible: true,
              yieldPercentage: solution.yieldPercentage,
              metersToUnroll: Math.round(totalMeters * 100) / 100,
              sheetsCount: solution.plans.length,
              lateralWasteCm: Math.round((maxLateralWasteMm / 10) * 10) / 10,
              piecesPlaced: solution.totalPiecesPlaced,
              description: `Rolo de Estoque • Desenrolar ${totalMeters.toFixed(2)}m • Sobra lateral: ${(maxLateralWasteMm / 10).toFixed(1)} cm • Rendimento: ${solution.yieldPercentage}%`,
              isFromStock: true,
            });

            solution.primaryWidthMm = widthMm;
            solution.totalLengthCutMeters = Math.round(totalMeters * 100) / 100;
            solution.lateralWasteMm = maxLateralWasteMm;
            solution.stockCategory = 'rolo';
            solution.isFromUserStock = true;
            solution.summaryTag = `🌀 Rolo do Estoque (${matchingCoil.name}) • ${(maxLateralWasteMm / 10).toFixed(1)}cm sobra`;
            solution.score += 20000; // Bonificação por ser rolo real do estoque
            candidateSolutions.push(solution);
          }
        }
      }

      // 2. Simulação com Retalhos Cadastrados (se houver)
      if (userScraps.length > 0) {
        // Usa retalhos e, se faltar material, completa com os rolos ou chapas do usuário
        const fallbackStock = userCoils.length > 0 ? userCoils : userFlatSheets;
        const scrapsPool = [...userScraps, ...fallbackStock];

        const scrapSol = this.runStrategy(
          expandedPieces,
          scrapsPool,
          settings,
          'use_scraps_first',
          'Reaproveitamento de Retalhos da Oficina',
          1,
          machineAlerts
        );

        if (scrapSol && scrapSol.totalScrapsUsed > 0 && scrapSol.unplacedPieces.length === 0) {
          scrapSol.stockCategory = 'retalho';
          scrapSol.isFromUserStock = true;
          scrapSol.summaryTag = `♻️ ${scrapSol.totalScrapsUsed} retalho(s) da oficina reaproveitado(s)`;
          scrapSol.score += 50000; // Prioridade máxima quando há retalhos reutilizáveis
          candidateSolutions.push(scrapSol);
        } else if (settings.defaultPriority === 'use_scraps_first' || scraps.length > 0) {
          const minReqLength = Math.min(...expandedPieces.map((p) => p.length));
          const maxScrapL = Math.max(...userScraps.map((s) => s.length));
          if (minReqLength > maxScrapL) {
            machineAlerts.push(
              `ℹ️ Retalhos em Estoque: Os retalhos cadastrados (máx: ${maxScrapL} mm) são menores do que a menor peça solicitada (${minReqLength} mm). O sistema utilizou bobina contínua para garantir a peça inteiriça.`
            );
          }
        }
      }

      // 3. Simulação com Chapas Planas Inteiras (se houver)
      if (userFlatSheets.length > 0) {
        const sheetsPool = [...userFlatSheets, ...userScraps];
        const sheetSol = this.runStrategy(
          expandedPieces,
          sheetsPool,
          settings,
          'fewest_sheets',
          'Uso de Chapas Planas do Estoque',
          1,
          machineAlerts
        );

        if (sheetSol && sheetSol.unplacedPieces.length === 0) {
          sheetSol.stockCategory = 'chapa';
          sheetSol.isFromUserStock = true;
          sheetSol.summaryTag = `📋 ${sheetSol.totalSheetsUsed} chapa(s) plana(s) do estoque`;
          candidateSolutions.push(sheetSol);
        }
      }

      // Alerta se nenhuma chapa/rolo cadastrado for larga o suficiente
      const maxUserStockWidth = Math.max(
        ...userCoils.map((c) => c.width),
        ...userFlatSheets.map((s) => s.width),
        ...userScraps.map((s) => s.width),
        0
      );

      if (maxUserStockWidth < maxPieceWidth) {
        machineAlerts.push(
          `⚠️ Bobina/Chapa Insuficiente no Estoque: A maior peça requer largura de ${(maxPieceWidth / 10).toFixed(1)} cm, mas o material mais largo cadastrado no seu estoque possui ${(maxUserStockWidth / 10).toFixed(1)} cm. Cadastre uma bobina de largura compatível no 'Estoque de Chapas'.`
        );

        // Gera sugestão de compra comercial para que o usuário não fique sem plano de corte
        for (const widthMm of STANDARD_COMMERCIAL_WIDTHS) {
          if (widthMm >= maxPieceWidth) {
            const widthCm = widthMm / 10;
            const singleCoilCandidate: StockCandidate = {
              id: `coil_buy_${widthMm}`,
              code: `BOBINA-${widthMm}`,
              name: `Bobina Comercial ${widthMm} mm (${widthCm} cm)`,
              isScrap: false,
              width: widthMm,
              length: 50000,
              material: primaryMaterial,
              thickness: primaryThickness,
              availableQty: 999,
              isCoil: true,
              coilRemainingLength: 50000,
              isStandardCommercial: true,
              isFromUserStock: false,
              stockCategory: 'sugestao_compra',
            };

            const solution = this.runSingleCoilStrategy(
              expandedPieces,
              singleCoilCandidate,
              settings,
              machineAlerts
            );

            if (solution && solution.unplacedPieces.length === 0) {
              const totalMeters = solution.plans.reduce((acc, p) => acc + p.length, 0) / 1000;
              solution.primaryWidthMm = widthMm;
              solution.totalLengthCutMeters = Math.round(totalMeters * 100) / 100;
              solution.stockCategory = 'sugestao_compra';
              solution.isFromUserStock = false;
              solution.summaryTag = `💡 Sugestão de Compra • Bobina ${widthCm} cm`;
              candidateSolutions.push(solution);
            }
          }
        }
      }
    } else {
      // =========================================================================
      // CENÁRIO B: ESTOQUE VAZIO (NENHUMA BOBINA OU CHAPA CADASTRADA)
      // Sugere bobinas comerciais padrão do mercado identificando como compra
      // =========================================================================
      machineAlerts.push(
        `ℹ️ Estoque sem itens cadastrados: O sistema sugeriu opções comerciais padrão para compra (de 30cm a 1,20m). Para restringir apenas às bobinas e retalhos da sua oficina, cadastre-os na aba 'Estoque de Chapas'.`
      );

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
            isFromStock: false,
          });
          continue;
        }

        const singleCoilCandidate: StockCandidate = {
          id: `coil_std_${widthMm}`,
          code: `BOBINA-${widthMm}`,
          name: `Bobina Comercial ${widthMm} mm (${widthCm} cm)`,
          isScrap: false,
          width: widthMm,
          length: 50000,
          material: primaryMaterial,
          thickness: primaryThickness,
          availableQty: 999,
          isCoil: true,
          coilRemainingLength: 50000,
          isStandardCommercial: true,
          isFromUserStock: false,
          stockCategory: 'sugestao_compra',
        };

        const solution = this.runSingleCoilStrategy(
          expandedPieces,
          singleCoilCandidate,
          settings,
          machineAlerts
        );

        if (solution && solution.unplacedPieces.length === 0) {
          const totalMeters = solution.plans.reduce((acc, p) => acc + p.length, 0) / 1000;
          let maxLateralWasteMm = 0;
          if (solution.plans.length > 0) {
            const wastes = solution.plans.map((p) => {
              const sideRemnant = p.remnants.find((r) => r.width > 0 && r.y > 0);
              return sideRemnant ? sideRemnant.width : 0;
            });
            maxLateralWasteMm = Math.max(...wastes);
          }

          testedWidthsComparison.push({
            widthMm,
            widthCm,
            feasible: true,
            yieldPercentage: solution.yieldPercentage,
            metersToUnroll: Math.round(totalMeters * 100) / 100,
            sheetsCount: solution.plans.length,
            lateralWasteCm: Math.round((maxLateralWasteMm / 10) * 10) / 10,
            piecesPlaced: solution.totalPiecesPlaced,
            description: `Sugestão de Compra • Desenrolar ${totalMeters.toFixed(2)}m • Sobra lateral: ${(maxLateralWasteMm / 10).toFixed(1)} cm • Rendimento: ${solution.yieldPercentage}%`,
            isFromStock: false,
          });

          solution.primaryWidthMm = widthMm;
          solution.totalLengthCutMeters = Math.round(totalMeters * 100) / 100;
          solution.lateralWasteMm = maxLateralWasteMm;
          solution.stockCategory = 'sugestao_compra';
          solution.isFromUserStock = false;
          solution.summaryTag = `💡 Sugestão para Compra (Estoque Vazio) • Bobina ${widthCm} cm`;
          candidateSolutions.push(solution);
        }
      }
    }

    // Ordena as soluções por Score e Rendimento decrescente
    candidateSolutions.sort((a, b) => b.score - a.score || b.yieldPercentage - a.yieldPercentage);

    // Filtra soluções duplicadas
    const uniqueSolutions: OptimizationSolution[] = [];
    const seenSignatures = new Set<string>();

    for (const sol of candidateSolutions) {
      const sig = sol.plans.map((p) => `${p.stockCategory || (p.isScrap ? 'S' : 'C')}:${p.width}x${p.length}`).join('|');
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

      const medal = idx === 0 ? '🥇 Opção 1' : idx === 1 ? '🥈 Opção 2' : idx === 2 ? '🥉 Opção 3' : `Opção ${idx + 1}`;

      if (sol.stockCategory === 'retalho' || sol.totalScrapsUsed > 0) {
        sol.title = `${medal}: Uso de ${sol.totalScrapsUsed} Retalho(s) (${sol.yieldPercentage}% aproveitamento • ${sol.totalSheetsUsed > 0 ? `+ Rolo ${pWidthCm}` : '100% Retalhos'})`;
      } else if (sol.stockCategory === 'chapa' || (sol.totalSheetsUsed > 0 && !sol.primaryWidthMm)) {
        sol.title = `${medal}: Chapas Planas do Estoque (${sol.totalSheetsUsed} chapa(s) • Rendimento ${sol.yieldPercentage}%)`;
      } else if (sol.isFromUserStock) {
        sol.title = `${medal}: 🌀 Rolo do Estoque (${pWidthCm}) • Desenrolar ${meters.toFixed(2)}m (Sobra lateral: ${wasteCm} • Rendimento ${sol.yieldPercentage}%)`;
      } else {
        sol.title = `${medal}: 💡 Sugestão para Compra (Bobina ${pWidthCm} • Desenrolar ${meters.toFixed(2)}m • Rendimento ${sol.yieldPercentage}%)`;
      }
    });

    return finalSolutions;
  }

  /**
   * Executa a simulação de encaixe e aproveitamento em rolo/bobina contínua.
   * Testa múltiplas estratégias de ordenação de peças para encontrar o maior aproveitamento de área.
   */
  private static runSingleCoilStrategy(
    allPieces: ExpandedPiece[],
    coilStock: StockCandidate,
    settings: MachineSettings,
    _baseAlerts: string[]
  ): OptimizationSolution | null {
    // Testa 3 permutações de empacotamento: por Área desc, por Largura desc, e por Comprimento desc
    const sortingModes: PriorityMode[] = ['max_yield', 'fewest_sheets', 'balanced'];
    let bestPlanGroup: SheetCutPlan[] | null = null;
    let bestYield = -1;

    for (const mode of sortingModes) {
      let pending = [...allPieces];
      pending = this.sortPiecesForPacking(pending, mode);

      const currentPlans: SheetCutPlan[] = [];
      let allFitted = true;

      while (pending.length > 0) {
        const plan = this.packSingleCoilSheet(coilStock, pending, settings);
        if (!plan || plan.placedPieces.length === 0) {
          allFitted = false;
          break;
        }

        currentPlans.push(plan);
        const placedIds = new Set(plan.placedPieces.map((p) => p.pieceId));
        pending = pending.filter((p) => !placedIds.has(p.instanceId));
      }

      if (allFitted && currentPlans.length > 0) {
        const totalUsed = currentPlans.reduce((acc, p) => acc + p.usedAreaMm2, 0);
        const totalArea = currentPlans.reduce((acc, p) => acc + p.totalAreaMm2, 0);
        const yieldPct = totalArea > 0 ? (totalUsed / totalArea) * 100 : 0;

        if (yieldPct > bestYield) {
          bestYield = yieldPct;
          bestPlanGroup = currentPlans;
        }
      }
    }

    if (!bestPlanGroup || bestPlanGroup.length === 0) return null;

    let totalPiecesPlaced = 0;
    let totalUsedArea = 0;
    let totalSheetArea = 0;
    let totalWasteArea = 0;
    let usableScrapArea = 0;

    for (const plan of bestPlanGroup) {
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
    const totalMeters = bestPlanGroup.reduce((acc, p) => acc + p.length, 0) / 1000;
    score -= totalMeters * 15;

    const coilCutSuggestions = bestPlanGroup
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
      title: `Rolo Bobina ${coilStock.width / 10} cm`,
      rank: 1,
      priorityMode: 'max_yield',
      score: Math.round(score),
      yieldPercentage,
      totalWasteAreaMm2: Math.round(totalWasteArea),
      totalSheetsUsed: 1,
      totalScrapsUsed: 0,
      usableScrapsGenerated: bestPlanGroup.reduce((acc, p) => acc + p.remnants.filter((r) => r.isUsable).length, 0),
      totalPiecesPlaced,
      totalPiecesRequested: allPieces.length,
      plans: bestPlanGroup,
      unplacedPieces: [],
      machineAlerts: [],
      coilCutSuggestions,
      stockCategory: coilStock.stockCategory || (coilStock.isFromUserStock ? 'rolo' : 'sugestao_compra'),
      isFromUserStock: coilStock.isFromUserStock,
    };
  }

  /**
   * Empacota peças em uma folha sob medida desenrolada do rolo ou em uma chapa/retalho fixo.
   * Utiliza empilhamento vertical (Y) em tiras e encaixe longitudinal (X) para maximizar o aproveitamento da área.
   */
  private static packSingleCoilSheet(
    stock: StockCandidate,
    availablePieces: ExpandedPiece[],
    settings: MachineSettings
  ): SheetCutPlan | null {
    const margin = settings.safetyMargin || 0;
    const kerf = settings.kerf || 0;
    const sheetW = stock.width;

    const isFixedStock = !stock.isCoil && !stock.isStandardCommercial;
    const maxPiecesLength = Math.max(...availablePieces.map((p) => p.length), 0);

    let effectiveL: number;
    if (isFixedStock) {
      effectiveL = stock.length - margin * 2;
      if (effectiveL <= 0) return null;
    } else {
      effectiveL = Math.max(maxPiecesLength * 2, 60000);
    }

    const placed: PlacedPiece[] = [];
    const usedPieceIndices = new Set<number>();
    let cutStepCounter = 1;
    const cutSteps: CutStep[] = [];
    const remnants: RemnantArea[] = [];
    let remnantCounter = 1;

    let currentY = margin;

    // Loop de faixas verticais ao longo da largura (Y)
    while (currentY < sheetW - margin + 0.01) {
      const remainingHeight = sheetW - margin - currentY;
      if (remainingHeight < 0.5) break;

      // 1. TENTA ENCAIXAR TRAPÉZIOS PAREADOS (Invertidos 180° para formar tira retangular sem desperdício)
      let pairedTrapezoidFound = false;
      let t1Idx = -1;

      for (let i = 0; i < availablePieces.length; i++) {
        if (!usedPieceIndices.has(i) && availablePieces[i].isTrapezoid && availablePieces[i].length <= effectiveL) {
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
            availablePieces[j].length <= effectiveL &&
            Math.abs(availablePieces[j].length - p1.length) <= 15
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
              pieceType: (p1.type as PieceType) || 'outro',
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
              trapezoidDiagonalGuide: `Pareada com ${p2.name} na tira de ${stripWidth}mm (Encaixe 180°)`,
            });

            placed.push({
              pieceId: p2.instanceId,
              pieceName: p2.name,
              pieceType: (p2.type as PieceType) || 'outro',
              x: currentX,
              y: currentY + stripWidth - Math.max(p2.devStart, p2.devEnd),
              length: trapLength,
              devStart: p2.devStart,
              devEnd: p2.devEnd,
              isTrapezoid: true,
              isFlipped: true,
              cutIndex: placed.length + 2,
              colorIndex: (placed.length % 6) + 2,
              polygonPoints: polyB,
              trapezoidPairName: p1.name,
              trapezoidDiagonalGuide: `Invertida 180° para aproveitamento total da tira`,
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

      // 2. ENCAIXA TIRA RETANGULAR (Seleciona a peça mais larga que caiba no espaço disponível)
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

      let currentX = margin;

      const pPoly = p.isTrapezoid
        ? `${currentX},${currentY} ${currentX + p.length},${currentY} ${currentX + p.length},${currentY + p.devEnd} ${currentX},${currentY + p.devStart}`
        : undefined;

      placed.push({
        pieceId: p.instanceId,
        pieceName: p.name,
        pieceType: (p.type as PieceType) || 'outro',
        x: currentX,
        y: currentY,
        length: p.length,
        devStart: p.devStart,
        devEnd: p.devEnd,
        isTrapezoid: p.isTrapezoid,
        isFlipped: false,
        cutIndex: placed.length + 1,
        colorIndex: (placed.length % 6) + 1,
        polygonPoints: pPoly,
      });

      // Se a peça for trapezoidal isolada, gera a sobra trapezoidal/triangular complementar nesta tira
      if (p.isTrapezoid) {
        const remLeft = stripWidth - p.devStart;
        const remRight = stripWidth - p.devEnd;
        const remW1 = Math.max(remLeft, remRight);
        const remW2 = Math.min(remLeft, remRight);
        const remArea = ((remLeft + remRight) / 2) * p.length;
        const isUsable = remW1 >= settings.scrapMinWidth && p.length >= settings.scrapMinLength;
        const remShape: ScrapShapeType = remW2 === 0 ? 'triangulo' : 'trapezio';
        const remPoly = `${currentX},${currentY + p.devStart} ${currentX + p.length},${currentY + p.devEnd} ${currentX + p.length},${currentY + stripWidth} ${currentX},${currentY + stripWidth}`;

        if (remW1 > 0) {
          remnants.push({
            id: `rem_${stock.id}_trap_${remnantCounter++}`,
            code: isUsable
              ? remShape === 'triangulo'
                ? `SOBRA-TRI-${remW1}`
                : `SOBRA-TRAP-${remW1}x${remW2}`
              : remShape === 'triangulo'
              ? `APARA-TRI-${remW1}`
              : `APARA-TRAP-${remW1}x${remW2}`,
            x: currentX,
            y: currentY + Math.min(p.devStart, p.devEnd),
            length: p.length,
            width: remW1,
            widthEnd: remW2,
            isTrapezoid: true,
            shapeType: remShape,
            polygonPoints: remPoly,
            isUsable,
            areaMm2: remArea,
          });

          cutSteps.push({
            step: cutStepCounter++,
            type: 'corte_diagonal_trapezio',
            description: `✂️ CORTE DIAGONAL: Cortar tira de ${stripWidth} mm de ${p.devStart} mm na esquerda para ${p.devEnd} mm na direita. Sobra ${remShape === 'triangulo' ? 'triangular (cunha)' : 'trapezoidal'} de ${remW1}→${remW2} × ${p.length} mm gerada para estoque.`,
            positionMm: currentY,
            dimensionMm: p.length,
          });
        }
      }

      cutSteps.push({
        step: cutStepCounter++,
        type: 'guilhotina_transversal',
        description: `Corte transversal de ${p.name} em ${currentX + p.length} mm (Desenvolvimento: ${p.maxWidth} mm)`,
        positionMm: currentX + p.length,
        dimensionMm: p.length,
      });

      currentX += p.length + kerf;

      // Se ainda couberem outras peças no comprimento desta mesma tira (ao longo de X)
      const maxAvailableX = isFixedStock ? stock.length - margin : effectiveL;
      while (currentX < maxAvailableX + 0.01) {
        const remainingLength = maxAvailableX - currentX;
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

        const subPoly = subP.isTrapezoid
          ? `${currentX},${currentY} ${currentX + subP.length},${currentY} ${currentX + subP.length},${currentY + subP.devEnd} ${currentX},${currentY + subP.devStart}`
          : undefined;

        placed.push({
          pieceId: subP.instanceId,
          pieceName: subP.name,
          pieceType: (subP.type as PieceType) || 'outro',
          x: currentX,
          y: currentY,
          length: subP.length,
          devStart: subP.devStart,
          devEnd: subP.devEnd,
          isTrapezoid: subP.isTrapezoid,
          isFlipped: false,
          cutIndex: placed.length + 1,
          colorIndex: (placed.length % 6) + 1,
          polygonPoints: subPoly,
        });

        if (subP.isTrapezoid) {
          const remLeft = stripWidth - subP.devStart;
          const remRight = stripWidth - subP.devEnd;
          const remW1 = Math.max(remLeft, remRight);
          const remW2 = Math.min(remLeft, remRight);
          const remArea = ((remLeft + remRight) / 2) * subP.length;
          const isUsable = remW1 >= settings.scrapMinWidth && subP.length >= settings.scrapMinLength;
          const remShape: ScrapShapeType = remW2 === 0 ? 'triangulo' : 'trapezio';
          const remPoly = `${currentX},${currentY + subP.devStart} ${currentX + subP.length},${currentY + subP.devEnd} ${currentX + subP.length},${currentY + stripWidth} ${currentX},${currentY + stripWidth}`;

          if (remW1 > 0) {
            remnants.push({
              id: `rem_${stock.id}_trap_${remnantCounter++}`,
              code: isUsable
                ? remShape === 'triangulo'
                  ? `SOBRA-TRI-${remW1}`
                  : `SOBRA-TRAP-${remW1}x${remW2}`
                : remShape === 'triangulo'
                ? `APARA-TRI-${remW1}`
                : `APARA-TRAP-${remW1}x${remW2}`,
              x: currentX,
              y: currentY + Math.min(subP.devStart, subP.devEnd),
              length: subP.length,
              width: remW1,
              widthEnd: remW2,
              isTrapezoid: true,
              shapeType: remShape,
              polygonPoints: remPoly,
              isUsable,
              areaMm2: remArea,
            });
          }
        }

        cutSteps.push({
          step: cutStepCounter++,
          type: 'guilhotina_transversal',
          description: `Corte transversal de ${subP.name} em ${currentX + subP.length} mm`,
          positionMm: currentX + subP.length,
          dimensionMm: subP.length,
        });

        currentX += subP.length + kerf;
      }

      // Sobra no final do comprimento desta tira
      const stripEndLimit = isFixedStock ? stock.length - margin : effectiveL;
      const stripRemainingX = stripEndLimit - currentX;
      if (isFixedStock && stripRemainingX >= 50) {
        const isUsable = stripWidth >= settings.scrapMinWidth && stripRemainingX >= settings.scrapMinLength;
        remnants.push({
          id: `rem_${stock.id}_end_${remnantCounter++}`,
          code: isUsable ? `SOBRA-L${stripWidth}x${Math.round(stripRemainingX)}` : `APARA-L${stripWidth}x${Math.round(stripRemainingX)}`,
          x: currentX,
          y: currentY,
          length: Math.round(stripRemainingX),
          width: stripWidth,
          widthEnd: stripWidth,
          isTrapezoid: false,
          shapeType: 'retangular',
          isUsable,
          areaMm2: stripWidth * stripRemainingX,
        });
      }

      cutSteps.push({
        step: cutStepCounter++,
        type: 'guilhotina_longitudinal',
        description: `Corte longitudinal da tira na largura ${stripWidth} mm`,
        positionMm: currentY + stripWidth,
        dimensionMm: stripWidth,
      });

      // Avança no eixo Y: A PRÓXIMA PEÇA VAI EMBAIXO DESTA NA LARGURA DO ROLO/CHAPA
      currentY += stripWidth + kerf;
    }

    if (placed.length === 0) return null;

    let maxX = 0;
    for (const p of placed) {
      maxX = Math.max(maxX, p.x + p.length);
    }

    // Para retalhos/chapas fixas, o comprimento do plano é o COMPRIMENTO FÍSICO REAL
    // Para rolos/bobinas, é a metragem sob medida desenrolada
    const finalPlanLength = isFixedStock ? stock.length : Math.max(100, maxX + margin);
    const effectivePlanName = isFixedStock
      ? (stock.name || (stock.isScrap ? `Retalho ${stock.code || ''} (${sheetW}×${stock.length}mm)` : `Chapa ${sheetW}×${stock.length}mm`))
      : `${stock.name || `Bobina ${sheetW}mm`} • Desenrolar ${(finalPlanLength / 1000).toFixed(2)}m`;

    const finalCutSteps: CutStep[] = isFixedStock
      ? cutSteps.map((s, idx) => ({ ...s, step: idx + 1 }))
      : [
          {
            step: 1,
            type: 'corte_bobina_desenrolar',
            description: `Desenrolar e guilhotinar uma folha de ${(finalPlanLength / 1000).toFixed(2)} metros da bobina de ${sheetW} mm (${sheetW / 10} cm).`,
            positionMm: finalPlanLength,
            dimensionMm: finalPlanLength,
          },
          ...cutSteps.map((s, idx) => ({ ...s, step: idx + 2 })),
        ];

    let usedAreaMm2 = 0;
    for (const pl of placed) {
      usedAreaMm2 += GeometryService.calculatePieceAreaMm2(pl);
    }

    let totalAreaMm2 = sheetW * finalPlanLength;
    if (stock.isTrapezoid && stock.widthEnd !== undefined) {
      totalAreaMm2 = ((sheetW + stock.widthEnd) / 2) * finalPlanLength;
    }

    // Sobra lateral na largura
    const unusedY = sheetW - currentY;
    if (unusedY > 0) {
      const isUsable = unusedY >= settings.scrapMinWidth && finalPlanLength >= settings.scrapMinLength;
      remnants.push({
        id: `rem_${stock.id}_w_${remnantCounter++}`,
        code: isUsable ? `SOBRA-L${unusedY}` : `APARA-L${unusedY}`,
        x: 0,
        y: currentY,
        length: finalPlanLength,
        width: unusedY,
        widthEnd: unusedY,
        isTrapezoid: false,
        shapeType: 'retangular',
        isUsable,
        areaMm2: unusedY * finalPlanLength,
      });
    }

    let usableScrapAreaMm2 = 0;
    for (const r of remnants) {
      if (r.isUsable) usableScrapAreaMm2 += r.areaMm2;
    }

    const wasteAreaMm2 = Math.max(0, totalAreaMm2 - usedAreaMm2 - usableScrapAreaMm2);
    const yieldPercentage =
      totalAreaMm2 > 0 ? Math.round((usedAreaMm2 / totalAreaMm2) * 1000) / 10 : 0;

    const instructions: string[] = isFixedStock
      ? [
          `1. Pegar do estoque o ${stock.isScrap ? 'retalho' : 'chapa'} "${stock.name || stock.code}" de ${sheetW} × ${finalPlanLength} mm.`,
          `2. Efetuar os ${placed.length} corte(s) nas posições indicadas no diagrama (Aproveitamento: ${yieldPercentage}%).`,
        ]
      : [
          `1. Puxar do rolo "${stock.name || `Bobina ${sheetW}mm`}" e guilhotinar ${(finalPlanLength / 1000).toFixed(2)} metros (${finalPlanLength} mm).`,
          `2. Efetuar os ${placed.length} cortes longitudinais nas larguras programadas no diagrama (Aproveitamento: ${yieldPercentage}%).`,
        ];

    return {
      sheetId: stock.id,
      sheetCode: stock.code,
      sheetName: effectivePlanName,
      isScrap: !!stock.isScrap,
      isTrapezoidScrap: !!stock.isTrapezoid,
      scrapWidthEnd: stock.widthEnd,
      isCoilCut: !isFixedStock,
      coilCutLengthMm: isFixedStock ? undefined : finalPlanLength,
      coilSourceId: isFixedStock ? undefined : stock.id,
      stockCategory: stock.stockCategory || (stock.isScrap ? 'retalho' : stock.isCoil ? 'rolo' : 'chapa'),
      isFromUserStock: stock.isFromUserStock,
      width: sheetW,
      length: finalPlanLength,
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
   * Executa a otimização com simulação multi-estoque para retalhos e chapas
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

        if (!bestStockCandidate.isStandardCommercial && !bestStockCandidate.isCoil) {
          bestStockCandidate.availableQty -= 1;
        }

        const placedIds = new Set(bestPlan.placedPieces.map((p) => p.pieceId));
        pendingPieces = pendingPieces.filter((p) => !placedIds.has(p.instanceId));
      } else {
        for (const up of pendingPieces) {
          unplacedPieces.push({
            id: up.pieceId,
            name: up.name,
            type: (up.type as PieceType) || 'outro',
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
    if (mode === 'use_scraps_first') score += totalScrapsUsed * 300;
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
      stockCategory: totalScrapsUsed > 0 ? 'retalho' : 'chapa',
      isFromUserStock: true,
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
