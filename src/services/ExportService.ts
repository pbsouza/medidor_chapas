import { jsPDF } from 'jspdf';
import { CutOrder, OptimizationSolution, ScrapItem, SheetCutPlan } from '../types';
import { GeometryService } from './GeometryService';

// Cores RGB de alto contraste idênticas à visualização do aplicativo
const PDF_COLORS = [
  { fill: [219, 234, 254], stroke: [37, 99, 235], text: [30, 58, 138] }, // Azul (#dbeafe / #2563eb / #1e3a8a)
  { fill: [209, 250, 229], stroke: [5, 150, 105], text: [6, 78, 59] }, // Verde (#d1fae5 / #059669 / #064e3b)
  { fill: [254, 243, 199], stroke: [217, 119, 6], text: [120, 53, 15] }, // Âmbar (#fef3c7 / #d97706 / #78350f)
  { fill: [237, 233, 254], stroke: [124, 58, 237], text: [76, 29, 149] }, // Roxo (#ede9fe / #7c3aed / #4c1d95)
  { fill: [252, 231, 243], stroke: [219, 39, 119], text: [131, 24, 67] }, // Rosa (#fce7f3 / #db2777 / #831843)
  { fill: [207, 250, 254], stroke: [8, 145, 178], text: [22, 78, 99] }, // Ciano (#cffafe / #0891b2 / #164e63)
];

export class ExportService {
  /**
   * Exporta Plano de Corte completo em PDF formatado profissionalmente com diagramas gráficos 2D de alta fidelidade
   */
  static exportOrderPdf(order: CutOrder, solution: OptimizationSolution): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 14;

    // Helper para verificar quebra de página
    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > pageHeight - 14) {
        doc.addPage();
        currentY = 14;
        return true;
      }
      return false;
    };

    // 1. Cabeçalho Principal
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(10, currentY, pageWidth - 20, 20, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CORTEFACIL - PLANO DE CORTE OTIMIZADO', 14, currentY + 7.5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    const orderTitle = order.orderNumber || order.title || 'Ordem de Corte';
    const clientTitle = order.customerName ? `Cliente: ${order.customerName}` : 'Cliente: Oficina';
    const dateStr = new Date().toLocaleDateString('pt-BR');
    doc.text(`Ordem: ${orderTitle}  |  ${clientTitle}  |  Data: ${dateStr}`, 14, currentY + 14.5);

    currentY += 24;

    // 2. Resumo Executivo
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.text('1. RESUMO EXECUTIVO DO CORTE', 10, currentY);
    currentY += 4.5;

    doc.setFillColor(248, 250, 252);
    doc.rect(10, currentY, pageWidth - 20, 16, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(10, currentY, pageWidth - 20, 16, 'S');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Aproveitamento Global: ${solution.yieldPercentage}%`, 14, currentY + 5.5);
    doc.text(`Chapas Utilizadas: ${solution.totalSheetsUsed}`, 75, currentY + 5.5);
    doc.text(`Retalhos Reaproveitados: ${solution.totalScrapsUsed}`, 135, currentY + 5.5);

    doc.text(`Peças Cortadas: ${solution.totalPiecesPlaced} de ${solution.totalPiecesRequested}`, 14, currentY + 11.5);
    doc.text(`Área de Desperdício: ${GeometryService.formatAreaM2(solution.totalWasteAreaMm2)}`, 75, currentY + 11.5);
    doc.text(`Novas Sobras Geradas: ${solution.usableScrapsGenerated}`, 135, currentY + 11.5);

    currentY += 20;

    // 3. Relação de Peças Solicitadas
    if (order.pieces && order.pieces.length > 0) {
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.text('2. RELAÇÃO DE PEÇAS SOLICITADAS', 10, currentY);
      currentY += 4.5;

      // Cabeçalho da Tabela
      doc.setFillColor(51, 65, 85);
      doc.rect(10, currentY, pageWidth - 20, 6.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Item / Peça', 13, currentY + 4.5);
      doc.text('Tipo', 70, currentY + 4.5);
      doc.text('Qtd', 105, currentY + 4.5);
      doc.text('Desenvolvimento (mm)', 122, currentY + 4.5);
      doc.text('Comprimento (mm)', 165, currentY + 4.5);

      currentY += 6.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);

      order.pieces.forEach((p, idx) => {
        checkPageBreak(6);

        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(10, currentY, pageWidth - 20, 5.5, 'F');
        }

        const devText = p.devStart === p.devEnd ? `${p.devStart} mm` : `${p.devStart} → ${p.devEnd} mm (Trapézio)`;
        doc.text(p.name, 13, currentY + 3.8);
        doc.text(p.type.replace(/_/g, ' ').toUpperCase(), 70, currentY + 3.8);
        doc.text(String(p.quantity), 105, currentY + 3.8);
        doc.text(devText, 122, currentY + 3.8);
        doc.text(`${p.length} mm`, 165, currentY + 3.8);

        currentY += 5.5;
      });

      currentY += 6;
    }

    // 4. Detalhamento Gráfico e Técnico das Chapas (Blueprints 2D)
    checkPageBreak(25);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('3. MAPAS GRÁFICOS E BLUEPRINTS 2D DE CORTE', 10, currentY);
    currentY += 6;

    solution.plans.forEach((plan) => {
      // 1. Cálculo da escala isotrópica (scaleX === scaleY)
      const graphAvailableWidth = pageWidth - 24; // 186 mm
      const rawScale = graphAvailableWidth / plan.length;
      
      // Limite máximo de altura para não quebrar a página
      const maxAllowedHeight = 65;
      const scale = Math.min(rawScale, maxAllowedHeight / plan.width);
      
      const drawnWidth = plan.length * scale;
      const drawnHeight = plan.width * scale;
      const originX = 12 + (graphAvailableWidth - drawnWidth) / 2; // Centraliza a chapa
      
      const totalBlockHeight = 12 + drawnHeight + 12 + (plan.placedPieces.length * 4) + 10;
      checkPageBreak(Math.min(totalBlockHeight, 100));

      // Cabeçalho da Chapa
      doc.setFillColor(241, 245, 249);
      doc.rect(10, currentY, pageWidth - 20, 8, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(10, currentY, pageWidth - 20, 8, 'S');

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      const tag = plan.isCoilCut
        ? `[ROLO BOBINA - DESENROLAR ${(plan.length / 1000).toFixed(2)}m]`
        : plan.isScrap
        ? '[RETALHO REAPROVEITADO]'
        : '[CHAPA PRINCIPAL]';

      doc.text(
        `${tag} ${plan.sheetName} (${plan.width} × ${plan.length} mm) — Rendimento: ${plan.yieldPercentage}%`,
        13,
        currentY + 5.5
      );

      currentY += 10.5;

      // ========================================================
      // DESENHO GRÁFICO 2D DA CHAPA (EXATAMENTE COMO NO APP)
      // ========================================================
      const originY = currentY + 3.5;

      // Régua Superior de Comprimento
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('0 mm', originX, currentY + 1.2);
      doc.text(`Eixo Longitudinal (Comprimento Total): ${plan.length} mm ➔`, originX + drawnWidth / 2 - 25, currentY + 1.2);
      doc.text(`${plan.length} mm`, originX + drawnWidth - 8, currentY + 1.2);

      // Fundo e Contorno Geral da Chapa
      doc.setFillColor(255, 255, 255);
      doc.rect(originX, originY, drawnWidth, drawnHeight, 'F');
      doc.setDrawColor(148, 163, 184); // Slate 400
      doc.setLineWidth(0.4);
      doc.rect(originX, originY, drawnWidth, drawnHeight, 'S');

      // Desenha Sobras e Retalhos Identificados
      plan.remnants.forEach((r) => {
        const rx = originX + r.x * scale;
        const ry = originY + r.y * scale;
        const rw = r.length * scale;
        const rh = r.width * scale;

        if (rw > 0.4 && rh > 0.4) {
          if (r.isUsable) {
            doc.setFillColor(254, 243, 199); // Âmbar suave
            doc.setDrawColor(217, 119, 6);
          } else {
            doc.setFillColor(254, 226, 226); // Vermelho apara
            doc.setDrawColor(239, 68, 68);
          }
          doc.setLineWidth(0.25);
          doc.rect(rx, ry, rw, rh, 'FD');

          if (rw > 14 && rh > 4) {
            doc.setFontSize(5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(r.isUsable ? 180 : 220, r.isUsable ? 83 : 38, r.isUsable ? 9 : 38);
            const label = r.isUsable ? `SOBRA ${r.width}×${r.length}` : `APARA ${r.width}×${r.length}`;
            doc.text(label, rx + rw / 2 - (label.length * 0.7), ry + rh / 2 + 1.2);
          }
        }
      });

      // Desenha Peças Posicionadas
      plan.placedPieces.forEach((p, pIdx) => {
        const color = PDF_COLORS[(p.colorIndex || pIdx) % PDF_COLORS.length];
        doc.setFillColor(color.fill[0], color.fill[1], color.fill[2]);
        doc.setDrawColor(color.stroke[0], color.stroke[1], color.stroke[2]);
        doc.setLineWidth(0.35);

        if (p.isTrapezoid && p.polygonPoints) {
          // Processa vértices exatos do polígono calculados geometricamente
          const rawCoords = p.polygonPoints.trim().split(/\s+/);
          const pts = rawCoords.map((coordStr) => {
            const [xVal, yVal] = coordStr.split(',').map(Number);
            return {
              x: originX + xVal * scale,
              y: originY + yVal * scale,
            };
          });

          if (pts.length >= 3) {
            const startX = pts[0].x;
            const startY = pts[0].y;
            const lineVectors: [number, number][] = [];
            for (let i = 1; i < pts.length; i++) {
              lineVectors.push([pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y]);
            }
            lineVectors.push([pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y]);

            doc.lines(lineVectors, startX, startY, [1, 1], 'FD', true);

            // Rótulo da Peça Centralizado no Polígono
            const midX = originX + (p.x + p.length / 2) * scale;
            const avgH = ((p.devStart + p.devEnd) / 2) * scale;
            const midY = originY + (p.y + avgH / 2) * scale + 1.2;

            doc.setFontSize(Math.max(5, Math.min(7, avgH * 0.35)));
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(color.text[0], color.text[1], color.text[2]);
            const trapLabel = `#${p.cutIndex} ${p.pieceName} (${p.length}mm | ${p.devStart}→${p.devEnd}mm)${p.isFlipped ? ' [INV]' : ''}`;
            
            // Trunca texto se for maior que o comprimento da peça
            const maxChars = Math.floor((p.length * scale) / 1.3);
            const displayLabel = trapLabel.length > maxChars ? trapLabel.substring(0, maxChars) + '..' : trapLabel;
            doc.text(displayLabel, Math.max(originX + p.x * scale + 1.5, midX - (displayLabel.length * 0.8)), midY);
          }
        } else {
          // Peça Retangular Perfeita
          const px = originX + p.x * scale;
          const py = originY + p.y * scale;
          const pw = p.length * scale;
          const ph = p.devStart * scale;

          doc.rect(px, py, pw, ph, 'FD');

          // Rótulo da Peça
          if (pw > 10 && ph > 3) {
            doc.setFontSize(Math.max(5, Math.min(7, ph * 0.35)));
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(color.text[0], color.text[1], color.text[2]);
            const rectLabel = `#${p.cutIndex} ${p.pieceName} (${p.length} × ${p.devStart} mm)`;
            const maxChars = Math.floor(pw / 1.3);
            const displayLabel = rectLabel.length > maxChars ? rectLabel.substring(0, maxChars) + '..' : rectLabel;
            doc.text(displayLabel, Math.max(px + 1.5, px + pw / 2 - (displayLabel.length * 0.8)), py + ph / 2 + 1.2);
          }
        }
      });

      currentY = originY + drawnHeight + 2.5;

      // Régua Inferior de Desenvolvimento (Largura da Chapa)
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(`Desenvolvimento Total da Chapa: ${plan.width} mm`, originX, currentY + 1.2);

      currentY += 5;

      // Sequência e Descrição dos Cortes
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text(`Peças Posicionadas nesta Chapa (${plan.placedPieces.length}):`, 12, currentY);
      currentY += 3.5;

      doc.setFont('helvetica', 'normal');
      plan.placedPieces.forEach((pl, pIdx) => {
        checkPageBreak(4.5);
        const trapInfo = pl.isTrapezoid
          ? ` [Trapézio: ${pl.devStart}→${pl.devEnd} mm${pl.isFlipped ? ' (Invertido)' : ''}${pl.trapezoidPairName ? ' | Par: ' + pl.trapezoidPairName : ''}]`
          : ` [Desenv: ${pl.devStart} mm]`;

        doc.text(
          `• #${pl.cutIndex || pIdx + 1}: ${pl.pieceName} (${pl.length} mm)${trapInfo} — Posição: X=${pl.x}mm, Y=${pl.y}mm`,
          14,
          currentY
        );
        currentY += 3.5;
      });

      // Sobras geradas
      const usableRemnants = plan.remnants.filter((r) => r.isUsable);
      if (usableRemnants.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9);
        usableRemnants.forEach((r) => {
          checkPageBreak(4.5);
          doc.text(`➔ NOVA SOBRA REAPROVEITÁVEL GERADA: ${r.width} × ${r.length} mm (${r.code})`, 14, currentY);
          currentY += 3.5;
        });
      }

      currentY += 5;
    });

    // Rodapé
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(
        'CorteFácil — Sistema Profissional de Otimização de Chapas Metálicas e Funilaria',
        10,
        pageHeight - 5
      );
      doc.text(`Página ${i} de ${totalPages}`, pageWidth - 26, pageHeight - 5);
    }

    doc.save(`Plano_Corte_${order.orderNumber || 'Ordem'}.pdf`);
  }

  /**
   * Atalho para exportar PDF a partir do número da ordem e solução
   */
  static exportToPdf(orderNumber: string, customerName: string | undefined, solution: OptimizationSolution): void {
    const dummyOrder: CutOrder = {
      id: `ord_${Date.now()}`,
      orderNumber,
      title: `Ordem ${orderNumber}`,
      customerName,
      status: 'confirmada',
      pieces: solution.plans.flatMap((pl) =>
        pl.placedPieces.map((p) => ({
          id: p.pieceId,
          name: p.pieceName,
          type: p.pieceType,
          quantity: 1,
          devStart: p.devStart,
          devEnd: p.devEnd,
          length: p.length,
          material: pl.material,
          thickness: pl.thickness,
        }))
      ),
      selectedSolution: solution,
      machineSettings: {
        maxCutLength: 7000,
        spliceOverlapLength: 100,
        autoSplitLongPieces: true,
        allowCoilCustomCut: true,
        kerf: 2,
        safetyMargin: 5,
        minSpacing: 3,
        scrapMinLength: 400,
        scrapMinWidth: 150,
        defaultPriority: solution.priorityMode,
        defaultUnit: 'mm',
      },
      createdAt: new Date().toISOString(),
    };

    this.exportOrderPdf(dummyOrder, solution);
  }

  /**
   * Exporta Resumo de Corte para CSV compatível com Excel
   */
  static exportToCsv(orderName: string, solution: OptimizationSolution): void {
    const rows = [
      ['Ordem de Corte', orderName],
      ['Data', new Date().toLocaleDateString('pt-BR')],
      ['Aproveitamento Global (%)', solution.yieldPercentage],
      ['Total de Chapas Utilizadas', solution.totalSheetsUsed],
      ['Total de Retalhos Reaproveitados', solution.totalScrapsUsed],
      ['Área de Desperdício (m²)', (solution.totalWasteAreaMm2 / 1_000_000).toFixed(3)],
      [''],
      ['Chapa / Rolo', 'Tipo', 'Largura (mm)', 'Comprimento (mm)', 'Aproveitamento (%)'],
      ...solution.plans.map((p) => [
        p.sheetName,
        p.isCoilCut ? 'Bobina Desenrolar' : p.isScrap ? 'Retalho' : 'Chapa Inteira',
        p.width,
        p.length,
        p.yieldPercentage,
      ]),
      [''],
      ['Item', 'Peça', 'Desenvolvimento Inicial (mm)', 'Desenvolvimento Final (mm)', 'Comprimento (mm)', 'Chapa Alocada', 'Posição X (mm)', 'Posição Y (mm)'],
      ...solution.plans.flatMap((plan) =>
        plan.placedPieces.map((p) => [
          p.cutIndex,
          p.pieceName,
          p.devStart,
          p.devEnd,
          p.length,
          plan.sheetName,
          p.x,
          p.y,
        ])
      ),
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      rows.map((e) => e.map((val) => `"${val}"`).join(';')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CorteFacil_${orderName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
