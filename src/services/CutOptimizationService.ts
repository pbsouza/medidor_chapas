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

export class CutOptimizationService {
  /**
   * Executa a otimização de corte gerando 3 soluções comparativas
   */
  static optimize(
    pieces: CutPiece[],
    sheets: SheetItem[],
    scraps: ScrapItem[],
    settings: MachineSettings
  ): OptimizationSolution[] {
    const machineAlerts: string[] = [];

    // Pre-processa peças aplicando divisão simétrica para peças que ultrapassam o limite da máquina
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
            `📐 Peça "${p.name}" (${(p.length / 1000).toFixed(2)}m) dividida simetricamente ao meio em ${splitResult.segmentsCount} partes de ${(splitResult.segmentLengthMm / 1000).toFixed(2)}m com ${((settings.spliceOverlapLength || 100) / 10).toFixed(0)}cm de transpasse na emenda.`
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

    // Prepara estoque disponível (Retalhos, Chapas e Rolos/Bobinas de 30-40m)
    const stockPool: StockCandidate[] = [
      ...scraps
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
        })),
      ...sheets
        .filter((sh) => sh.quantity > 0)
        .map((sh) => ({
          id: sh.id,
          code: sh.isCoil ? `ROLO-${sh.id.slice(0, 4)}` : (sh.name || `CHAPA-${sh.id.slice(0, 4)}`),
          name: sh.name || (sh.isCoil ? `Rolo Bobina ${sh.width}mm (${(sh.length / 1000).toFixed(0)}m)` : `Chapa ${sh.width} × ${sh.length} mm`),
          isScrap: false,
          width: sh.width,
          length: sh.length,
          material: sh.material,
          thickness: sh.thickness,
          availableQty: sh.quantity,
          isCoil: sh.isCoil,
          coilRemainingLength: sh.coilRemainingLength || sh.length,
        })),
    ];

    // Gera soluções com diferentes estratégias
    const primaryMode = settings.defaultPriority || 'balanced';

    // Lista de estratégias a avaliar
    const strategiesToTry: { mode: PriorityMode; title: string; rank: 1 | 2 | 3 }[] = [
      {
        mode: primaryMode,
        title: `🥇 Prioridade: ${this.getPriorityLabel(primaryMode, settings.preferredWidth)}`,
        rank: 1,
      },
      {
        mode: primaryMode === 'use_scraps_first' ? 'most_stock_first' : 'use_scraps_first',
        title:
          primaryMode === 'use_scraps_first'
            ? '🥈 Segunda Solução (Mais Estoque Primeiro)'
            : '🥈 Segunda Solução (Foco em Retalhos)',
        rank: 2,
      },
      {
        mode: primaryMode === 'max_yield' ? 'fewest_sheets' : 'max_yield',
        title:
          primaryMode === 'max_yield'
            ? '🥉 Terceira Solução (Menor Número de Chapas)'
            : '🥉 Terceira Solução (Máximo Rendimento %)',
        rank: 3,
      },
    ];

    const solutions = strategiesToTry.map((strat) =>
      this.runStrategy(
        expandedPieces,
        stockPool,
        settings,
        strat.mode,
        strat.title,
        strat.rank,
        machineAlerts
      )
    );

    // Ordena soluções por score decrescente mantendo a preferida em evidência
    solutions.sort((a, b) => b.score - a.score);

    // Ajusta rankings e títulos
    solutions.forEach((s, idx) => {
      s.rank = (idx + 1) as 1 | 2 | 3;
      const label = this.getPriorityLabel(s.priorityMode, settings.preferredWidth);
      if (idx === 0) s.title = `🥇 Solução Recomendada (${label})`;
      else if (idx === 1) s.title = `🥈 Segunda Solução (${label})`;
      else s.title = `🥉 Terceira Solução (${label})`;
    });

    return solutions;
  }

  /**
   * Alias compatível para chamada de otimização
   */
  static generateSolutions(
    pieces: CutPiece[],
    sheets: SheetItem[],
    scraps: ScrapItem[],
    settings: MachineSettings
  ): OptimizationSolution[] {
    return this.optimize(pieces, sheets, scraps, settings);
  }

  private static getPriorityLabel(mode: PriorityMode, preferredWidth?: number): string {
    switch (mode) {
      case 'most_stock_first':
        return 'Chapa com Mais Estoque';
      case 'preferred_width':
        return preferredWidth ? `Largura ${preferredWidth} mm` : 'Largura Específica';
      case 'balanced':
        return 'Equilibrada';
      case 'use_scraps_first':
        return 'Priorizar Retalhos';
      case 'max_yield':
        return 'Maior Rendimento';
      case 'fewest_sheets':
        return 'Menos Chapas';
      case 'preserve_large_scraps':
        return 'Preservar Sobras Grandes';
      default:
        return 'Otimizado';
    }
  }

  /**
   * Executa uma estratégia específica de corte 2D
   */
  private static runStrategy(
    allPieces: ExpandedPiece[],
    allStock: StockCandidate[],
    settings: MachineSettings,
    mode: PriorityMode,
    title: string,
    rank: 1 | 2 | 3,
    baseAlerts: string[]
  ): OptimizationSolution {
    // Clona estoque disponível
    const stockAvailable = allStock.map((s) => ({ ...s }));
    const remainingPieces = [...allPieces];

    // Agrupa peças por material e espessura
    const materialGroups = new Map<string, ExpandedPiece[]>();
    for (const p of remainingPieces) {
      const key = `${p.material || 'Padrão'}_${p.thickness || '0.50'}`;
      if (!materialGroups.has(key)) materialGroups.set(key, []);
      materialGroups.get(key)!.push(p);
    }

    const plans: SheetCutPlan[] = [];
    const unplacedPieces: CutPiece[] = [];

    for (const [matKey, groupPieces] of materialGroups.entries()) {
      const [matName, matThick] = matKey.split('_');

      // Filtra estoque compatível
      let compatibleStock = stockAvailable.filter((s) => {
        const matchMat = !s.material || !matName || s.material.toLowerCase() === matName.toLowerCase() || matName === 'Padrão';
        return matchMat && s.availableQty > 0;
      });

      // Se não houver estoque compatível do mesmo material, inclui as chapas disponíveis gerais
      if (compatibleStock.length === 0) {
        compatibleStock = stockAvailable.filter((s) => s.availableQty > 0);
      }

      // Ordena peças
      // 1. Trapézios agrupados aos pares
      // 2. Peças maiores primeiro (First Fit Decreasing por Comprimento e Largura)
      const sortedPieces = this.sortPiecesForPacking(groupPieces, mode);

      // Ordena estoque conforme a estratégia e configurações
      let sortedStock = this.sortStockForStrategy(compatibleStock, mode, settings);

      // Loop de empacotamento
      while (sortedPieces.length > 0) {
        let placedAny = false;

        for (const stock of sortedStock) {
          if (stock.availableQty <= 0) continue;

          // Tenta criar plano de corte nesta chapa/retalho
          const plan = this.packSheet(stock, sortedPieces, settings, mode);

          if (plan && plan.placedPieces.length > 0) {
            plans.push(plan);
            stock.availableQty -= 1;
            placedAny = true;
            break; // Volta para tentar o melhor estoque para as peças restantes
          }
        }

        if (!placedAny && sortedPieces.length > 0) {
          // Quando as peças excedem as chapas fixas existentes ou o estoque cadastrado acaba:
          // Gera automaticamente uma Bobina Contínua / Chapa Sob Medida Industrial para a oficina!
          const maxPieceLen = Math.max(...sortedPieces.map((p) => p.length));
          const maxPieceW = Math.max(...sortedPieces.map((p) => p.maxWidth));
          
          let targetWidth = 1200;
          if (settings.preferredWidth && settings.preferredWidth >= maxPieceW) {
            targetWidth = settings.preferredWidth;
          } else {
            targetWidth = maxPieceW > 1000 ? 1200 : (maxPieceW > 600 ? 1000 : 1200);
          }

          // Estima o comprimento da bobina/rolo necessário para acomodar as peças restantes
          const totalRemainingArea = sortedPieces.reduce((acc, p) => acc + p.areaMm2, 0);
          const estimatedRollLength = Math.max(
            maxPieceLen + 100,
            Math.ceil((totalRemainingArea / targetWidth) * 1.35) + 200,
            30000
          );

          const virtualCoil: StockCandidate = {
            id: `coil_auto_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            code: `ROLO-${targetWidth}`,
            name: `Rolo Bobina ${targetWidth}mm (${matName})`,
            isScrap: false,
            width: targetWidth,
            length: estimatedRollLength,
            material: matName || 'Galvalume',
            thickness: matThick || '0.50mm',
            availableQty: 99,
            isCoil: true,
            coilRemainingLength: estimatedRollLength,
          };

          // Tenta empacotar na Bobina Contínua Sob Medida
          const autoPlan = this.packSheet(virtualCoil, sortedPieces, settings, mode);
          if (autoPlan && autoPlan.placedPieces.length > 0) {
            plans.push(autoPlan);
            placedAny = true;
            continue;
          }

          // Se ainda assim alguma peça não couber, registra em unplacedPieces
          for (const up of sortedPieces) {
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
              notes: 'Peça requer dimensões especiais de corte.',
            });
          }
          break;
        }
      }
    }

    // Calcula estatísticas globais da solução
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

    // Fórmula de pontuação ponderada
    // Prioriza alto aproveitamento, penaliza desperdício, premia uso de retalhos se configurado
    let score = yieldPercentage * 10;
    score -= (totalWasteArea / 1_000_000) * 15; // penalidade por m² de lixo
    if (mode === 'use_scraps_first') {
      score += totalScrapsUsed * 25;
    }
    if (mode === 'fewest_sheets') {
      score -= totalSheetsUsed * 20;
    }
    if (unplacedPieces.length > 0) {
      score -= unplacedPieces.length * 1000;
    }

    const alerts = [...baseAlerts];
    if (unplacedPieces.length > 0) {
      alerts.push(
        `Atenção: ${unplacedPieces.length} peça(s) não puderam ser cortadas por falta de chapas/retalhos compatíveis no estoque.`
      );
    }

    // Coleta sugestões de corte de bobina para exibição rápida
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

  /**
   * Ordena peças priorizando pares trapezoidais e First Fit Decreasing
   */
  private static sortPiecesForPacking(pieces: ExpandedPiece[], _mode: PriorityMode): ExpandedPiece[] {
    const list = [...pieces];

    // Separa trapézios e retangulares
    const trapezoids = list.filter((p) => p.isTrapezoid);
    const rectangulars = list.filter((p) => !p.isTrapezoid);

    // Ordena retangulares por comprimento decrescente, depois por largura
    rectangulars.sort((a, b) => {
      if (b.length !== a.length) return b.length - a.length;
      return b.maxWidth - a.maxWidth;
    });

    // Ordena trapézios por comprimento decrescente
    trapezoids.sort((a, b) => b.length - a.length);

    // Retorna trapézios primeiro para tentar encaixes complementares contíguos
    return [...trapezoids, ...rectangulars];
  }

  /**
   * Ordena estoque dependendo do modo de priorização e configurações
   */
  private static sortStockForStrategy(
    stock: StockCandidate[],
    mode: PriorityMode,
    settings: MachineSettings
  ): StockCandidate[] {
    const list = [...stock];
    const targetWidth = settings.preferredWidth;

    switch (mode) {
      case 'most_stock_first':
        // Prioriza as chapas/bobinas que possuem MAIOR QUANTIDADE em estoque
        return list.sort((a, b) => {
          // Se uma tiver largura preferida, desempata a favor dela
          if (targetWidth && a.width === targetWidth && b.width !== targetWidth) return -1;
          if (targetWidth && b.width === targetWidth && a.width !== targetWidth) return 1;
          // Maior quantidade de estoque primeiro
          if (b.availableQty !== a.availableQty) return b.availableQty - a.availableQty;
          // Retalhos primeiro para consumo
          if (a.isScrap && !b.isScrap) return -1;
          if (!a.isScrap && b.isScrap) return 1;
          return b.width * b.length - a.width * a.length;
        });

      case 'preferred_width':
        // Prioriza chapas com a largura específica solicitada
        return list.sort((a, b) => {
          const matchA = targetWidth && a.width === targetWidth ? 1 : 0;
          const matchB = targetWidth && b.width === targetWidth ? 1 : 0;
          if (matchA !== matchB) return matchB - matchA;
          // Se ambas empatarem, desempata pela que tiver mais em estoque
          if (b.availableQty !== a.availableQty) return b.availableQty - a.availableQty;
          return a.width * a.length - b.width * b.length;
        });

      case 'use_scraps_first':
        // Retalhos primeiro, ordenados por menor área (Best Fit)
        return list.sort((a, b) => {
          if (a.isScrap && !b.isScrap) return -1;
          if (!a.isScrap && b.isScrap) return 1;
          // Se ambos forem chapas inteiras e houver largura preferida:
          if (targetWidth && a.width === targetWidth && b.width !== targetWidth) return -1;
          if (targetWidth && b.width === targetWidth && a.width !== targetWidth) return 1;
          // Desempate por quantidade se configurado
          if (settings.prioritizeMostInStock && b.availableQty !== a.availableQty) {
            return b.availableQty - a.availableQty;
          }
          return a.width * a.length - b.width * b.length;
        });

      case 'max_yield':
        // Ordena por dimensões que melhor casam com as larguras
        return list.sort((a, b) => {
          if (targetWidth && a.width === targetWidth && b.width !== targetWidth) return -1;
          if (targetWidth && b.width === targetWidth && a.width !== targetWidth) return 1;
          if (a.isScrap && !b.isScrap) return -1;
          if (!a.isScrap && b.isScrap) return 1;
          return b.width * b.length - a.width * a.length;
        });

      case 'fewest_sheets':
        // Chapas maiores primeiro
        return list.sort((a, b) => {
          if (targetWidth && a.width === targetWidth && b.width !== targetWidth) return -1;
          if (targetWidth && b.width === targetWidth && a.width !== targetWidth) return 1;
          return b.width * b.length - a.width * a.length;
        });

      case 'preserve_large_scraps':
      case 'balanced':
      default:
        // Equilibrado: retalhos primeiro se couberem, depois chapas inteiras (considerando largura preferida e estoque)
        return list.sort((a, b) => {
          if (a.isScrap && !b.isScrap) return -1;
          if (!a.isScrap && b.isScrap) return 1;
          if (targetWidth && a.width === targetWidth && b.width !== targetWidth) return -1;
          if (targetWidth && b.width === targetWidth && a.width !== targetWidth) return 1;
          if (settings.prioritizeMostInStock && b.availableQty !== a.availableQty) {
            return b.availableQty - a.availableQty;
          }
          return a.width * a.length - b.width * b.length;
        });
    }
  }

  /**
   * Empacotamento 2D em uma chapa/retalho com suporte a trapézios e guilhotina
   */
  private static packSheet(
    stock: StockCandidate,
    availablePieces: ExpandedPiece[],
    settings: MachineSettings,
    _mode: PriorityMode
  ): SheetCutPlan | null {
    const sheetW = stock.width;
    const sheetL = stock.length;
    const kerf = settings.kerf;
    const margin = settings.safetyMargin;
    const spacing = settings.minSpacing;

    const placed: PlacedPiece[] = [];
    const usedPieceIndices = new Set<number>();
    let cutStepCounter = 1;
    const cutSteps: CutStep[] = [];

    // Espaço útil disponível dentro da chapa (descontando margens de segurança)
    const effectiveW = sheetW - 2 * margin;
    const effectiveL = sheetL - 2 * margin;

    if (effectiveW <= 0 || effectiveL <= 0) return null;

    // Estratégia de Guilhotina por Tiras Longitudinais e Transversais:
    // Em funilaria, o corte padrão é slitting longitudinal (cortar a chapa no comprimento em tiras de largura W)
    // Para trapézios, pareamos a ponta maior com a ponta menor formando uma tira retangular perfeita (Largura = D_maior + D_menor).

    // Vamos rastrear faixas ocupadas (Strip Packing)
    let currentY = margin;

    while (currentY < sheetW - margin) {
      // Procura peças que caibam na largura restante
      const remainingHeight = sheetW - margin - currentY;
      if (remainingHeight <= 5) break;

      // 1. Tenta emparelhar trapézios complementares (Ponta Maior com Ponta Menor)
      let pairedTrapezoidFound = false;

      // Procura o primeiro trapézio disponível
      let firstTrapIdx = -1;
      for (let i = 0; i < availablePieces.length; i++) {
        if (!usedPieceIndices.has(i) && availablePieces[i].isTrapezoid && availablePieces[i].length <= effectiveL) {
          firstTrapIdx = i;
          break;
        }
      }

      if (firstTrapIdx !== -1) {
        const p1 = availablePieces[firstTrapIdx];
        const trapLength = p1.length;

        // Procura um par para p1 com comprimento compatível
        let secondTrapIdx = -1;
        for (let j = 0; j < availablePieces.length; j++) {
          if (j !== firstTrapIdx && !usedPieceIndices.has(j) && availablePieces[j].isTrapezoid && Math.abs(availablePieces[j].length - trapLength) <= 10) {
            secondTrapIdx = j;
            break;
          }
        }

        if (secondTrapIdx !== -1) {
          const p2 = availablePieces[secondTrapIdx];

          // Pareamento inteligente: Ponta Maior com Ponta Menor
          // Determinamos as cotas de p1
          const p1Start = p1.devStart;
          const p1End = p1.devEnd;

          // Se p1 tem p1Start > p1End, a ponta maior de p1 está no início.
          // Para que a ponta maior de p2 case com a ponta menor de p1 (no fim):
          // p2 deve ter sua ponta menor no início e sua ponta maior no fim.
          // A largura da tira combinada:
          const p2InvertedStart = Math.min(p2.devStart, p2.devEnd);
          const p2InvertedEnd = Math.max(p2.devStart, p2.devEnd);

          const stripWidth = Math.max(p1Start + p2InvertedStart, p1End + p2InvertedEnd);

          if (stripWidth <= remainingHeight) {
            // Cabe na largura restante! Preenchemos a tira ao longo do comprimento X com pares
            let currentX = margin;

            while (currentX < sheetL - margin) {
              const remainingLength = sheetL - margin - currentX;
              if (remainingLength < trapLength) break;

              // Encontra 2 trapézios para colocar nesta posição X
              let t1Idx = -1;
              let t2Idx = -1;

              for (let i = 0; i < availablePieces.length; i++) {
                if (!usedPieceIndices.has(i) && availablePieces[i].isTrapezoid && Math.abs(availablePieces[i].length - trapLength) <= 10) {
                  if (t1Idx === -1) {
                    t1Idx = i;
                  } else if (t2Idx === -1) {
                    t2Idx = i;
                    break;
                  }
                }
              }

              if (t1Idx !== -1 && t2Idx !== -1) {
                const trapA = availablePieces[t1Idx];
                const trapB = availablePieces[t2Idx];
                usedPieceIndices.add(t1Idx);
                usedPieceIndices.add(t2Idx);

                const d1Start = trapA.devStart;
                const d1End = trapA.devEnd;
                const d2Start = trapB.devStart;
                const d2End = trapB.devEnd;

                // Pareamento exato:
                // Peça A (Topo da tira):
                // Vértices: (X, Y) -> (X + L, Y) -> (X + L, Y + d1End) -> (X, Y + d1Start)
                const polyA = `${currentX},${currentY} ${currentX + trapLength},${currentY} ${currentX + trapLength},${currentY + d1End} ${currentX},${currentY + d1Start}`;

                // Peça B (Invertida - Base da tira):
                // A linha divisória diagonal entre A e B vai de (X, Y + d1Start) até (X + L, Y + d1End)
                // A base inferior de B é reta horizontal em Y + stripWidth
                // Vértices de B: (X, Y + d1Start) -> (X + L, Y + d1End) -> (X + L, Y + stripWidth) -> (X, Y + stripWidth)
                const polyB = `${currentX},${currentY + d1Start} ${currentX + trapLength},${currentY + d1End} ${currentX + trapLength},${currentY + stripWidth} ${currentX},${currentY + stripWidth}`;

                placed.push({
                  pieceId: trapA.instanceId,
                  pieceName: trapA.name,
                  pieceType: trapA.type,
                  x: currentX,
                  y: currentY,
                  length: trapLength,
                  devStart: d1Start,
                  devEnd: d1End,
                  isTrapezoid: true,
                  isFlipped: false,
                  cutIndex: placed.length + 1,
                  colorIndex: (placed.length % 6) + 1,
                  polygonPoints: polyA,
                  trapezoidPairName: trapB.name,
                  trapezoidDiagonalGuide: `Ponta Maior (${Math.max(d1Start, d1End)}mm) no ${d1Start >= d1End ? 'início' : 'fim'} / Ponta Menor (${Math.min(d1Start, d1End)}mm) no ${d1Start >= d1End ? 'fim' : 'início'}`,
                });

                placed.push({
                  pieceId: trapB.instanceId,
                  pieceName: trapB.name,
                  pieceType: trapB.type,
                  x: currentX,
                  y: currentY + d1Start,
                  length: trapLength,
                  devStart: d2Start,
                  devEnd: d2End,
                  isTrapezoid: true,
                  isFlipped: true,
                  cutIndex: placed.length + 2,
                  colorIndex: (placed.length % 6) + 2,
                  polygonPoints: polyB,
                  trapezoidPairName: trapA.name,
                  trapezoidDiagonalGuide: `Invertida (Ponta Maior pareada com Ponta Menor de ${trapA.name})`,
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
                  description: `✂️ CORTE DIAGONAL DE ENCAIXE: Marcar ${d1Start} mm na extremidade esquerda e ${d1End} mm na extremidade direita da tira de ${stripWidth} mm. Cortar na diagonal para obter ${trapA.name} e ${trapB.name} com 100% de aproveitamento (Ponta Maior com Menor).`,
                  positionMm: currentY,
                  dimensionMm: trapLength,
                });

                currentX += trapLength + kerf;
                pairedTrapezoidFound = true;
              } else {
                break;
              }
            }

            if (pairedTrapezoidFound) {
              currentY += stripWidth + kerf;
              continue;
            }
          }
        }
      }

      // 2. Se não casou trapézios, cria uma faixa longitudinal com a peça de maior largura que caiba
      let bestPieceIdx = -1;
      let maxPieceWidth = 0;

      for (let i = 0; i < availablePieces.length; i++) {
        if (usedPieceIndices.has(i)) continue;
        const p = availablePieces[i];

        if (p.maxWidth <= remainingHeight && p.length <= effectiveL) {
          if (p.maxWidth > maxPieceWidth) {
            maxPieceWidth = p.maxWidth;
            bestPieceIdx = i;
          }
        }
      }

      if (bestPieceIdx === -1) {
        // Nenhuma peça cabe na largura restante
        break;
      }

      // Faixa longitudinal de largura maxPieceWidth
      const stripWidth = maxPieceWidth;
      let currentX = margin;

      // Preenche a faixa ao longo do comprimento (X)
      while (currentX < sheetL - margin) {
        const remainingLength = sheetL - margin - currentX;
        if (remainingLength <= 10) break;

        // Encontra a melhor peça que caiba nesta faixa (largura <= stripWidth e comprimento <= remainingLength)
        let bestSubIdx = -1;
        let longestLength = 0;

        for (let i = 0; i < availablePieces.length; i++) {
          if (usedPieceIndices.has(i)) continue;
          const p = availablePieces[i];

          if (p.maxWidth <= stripWidth && p.length <= remainingLength) {
            // Prioriza peças com comprimento próximo ao restante (Best Fit)
            if (p.length > longestLength) {
              longestLength = p.length;
              bestSubIdx = i;
            }
          }
        }

        if (bestSubIdx === -1) break;

        const p = availablePieces[bestSubIdx];
        usedPieceIndices.add(bestSubIdx);

        const polyPoints = p.isTrapezoid
          ? `${currentX},${currentY} ${currentX + p.length},${currentY} ${currentX + p.length},${currentY + p.devEnd} ${currentX},${currentY + p.devStart}`
          : undefined;

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
          polygonPoints: polyPoints,
        });

        cutSteps.push({
          step: cutStepCounter++,
          type: 'guilhotina_transversal',
          description: `Corte transversal de ${p.name} em ${currentX + p.length} mm (Largura: ${p.maxWidth} mm)`,
          positionMm: currentX + p.length,
          dimensionMm: p.length,
        });

        currentX += p.length + kerf;
      }

      cutSteps.push({
        step: cutStepCounter++,
        type: 'guilhotina_longitudinal',
        description: `Corte longitudinal da tira na largura ${stripWidth} mm`,
        positionMm: currentY + stripWidth,
        dimensionMm: stripWidth,
      });

      currentY += stripWidth + kerf;
    }

    if (placed.length === 0) return null;

    // Remove as peças utilizadas da lista geral
    const sortedIndices = Array.from(usedPieceIndices).sort((a, b) => b - a);
    for (const idx of sortedIndices) {
      availablePieces.splice(idx, 1);
    }

    // Identifica se é corte a partir de Bobina/Rolo Contínuo
    const isCoil = !!stock.isCoil || stock.length >= 20000;

    // Encontra o maior X utilizado pelas peças
    let maxX = 0;
    for (const p of placed) {
      maxX = Math.max(maxX, p.x + p.length);
    }

    // Se for bobina/rolo, a folha a ser desenrolada tem exatamente o comprimento das peças + margem
    const effectivePlanLength = isCoil ? Math.max(100, maxX + margin) : sheetL;
    const effectivePlanName = isCoil
      ? `Rolo Bobina ${sheetW}mm (Desenrolar ${(effectivePlanLength / 1000).toFixed(2)}m)`
      : stock.name;

    // Adiciona instrução de desenrolar do rolo na sequência de corte se for bobina
    const finalCutSteps: CutStep[] = [];
    if (isCoil) {
      finalCutSteps.push({
        step: 1,
        type: 'corte_bobina_desenrolar',
        description: `Desenrolar e cortar folha de ${(effectivePlanLength / 1000).toFixed(2)} m (largura: ${sheetW} mm) da bobina contínua.`,
        positionMm: effectivePlanLength,
        dimensionMm: effectivePlanLength,
      });
      cutSteps.forEach((s) => {
        finalCutSteps.push({
          ...s,
          step: s.step + 1,
        });
      });
    } else {
      finalCutSteps.push(...cutSteps);
    }

    // Calcula áreas de peças, sobras e desperdício com base na folha real gerada
    let usedAreaMm2 = 0;
    for (const pl of placed) {
      usedAreaMm2 += GeometryService.calculatePieceAreaMm2(pl);
    }

    const totalAreaMm2 = sheetW * effectivePlanLength;

    // Calcula sobras (Remnants)
    const remnants: RemnantArea[] = [];
    let remnantCounter = 1;

    // 1. Sobra na largura (faixa superior não utilizada)
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

    // 2. Sobra no comprimento nas faixas ocupadas (se for chapa fixa pré-cortada)
    if (!isCoil) {
      const unusedX = sheetL - maxX;
      if (unusedX > 0 && currentY > 0) {
        const isUsable = unusedX >= settings.scrapMinLength && currentY >= settings.scrapMinWidth;
        if (isUsable) {
          remnants.push({
            id: `rem_${stock.id}_l_${remnantCounter++}`,
            code: `SOBRA-C${unusedX}`,
            x: maxX,
            y: 0,
            length: unusedX,
            width: currentY,
            isUsable: true,
            areaMm2: unusedX * currentY,
          });
        }
      }
    }

    let usableScrapAreaMm2 = 0;
    for (const r of remnants) {
      if (r.isUsable) usableScrapAreaMm2 += r.areaMm2;
    }

    const wasteAreaMm2 = Math.max(0, totalAreaMm2 - usedAreaMm2 - usableScrapAreaMm2);
    const yieldPercentage =
      totalAreaMm2 > 0 ? Math.round((usedAreaMm2 / totalAreaMm2) * 1000) / 10 : 0;

    const instructions: string[] = [];
    if (isCoil) {
      instructions.push(
        `1. Puxar do rolo e guilhotinar uma chapa de ${(effectivePlanLength / 1000).toFixed(2)} metros na largura de ${sheetW} mm.`
      );
      instructions.push(
        `2. Efetuar os cortes longitudinais nas larguras programadas no diagrama.`
      );
    }

    return {
      sheetId: stock.id,
      sheetCode: stock.code,
      sheetName: effectivePlanName,
      isScrap: stock.isScrap,
      isCoilCut: isCoil,
      coilCutLengthMm: isCoil ? effectivePlanLength : undefined,
      coilSourceId: isCoil ? stock.id : undefined,
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
}
