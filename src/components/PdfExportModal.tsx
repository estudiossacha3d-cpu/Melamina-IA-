import React, { useState, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { 
  X, 
  Download, 
  Printer, 
  FileText, 
  Maximize2, 
  CheckSquare, 
  Scissors, 
  Layers, 
  ZoomIn, 
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  Check,
  RotateCw,
  FileCheck,
  Sliders,
  Eye,
  LayoutTemplate
} from 'lucide-react';
import { Piece, SheetConfig, EdgeThicknessConfig } from '../types';
import { PackedBoard, Rect, WasteRect } from './CutPlanViewer';

export interface GroupedPiece {
  name: string;
  w: number;
  h: number;
  rotated: boolean;
  cantos?: Rect['cantos'];
  cutIndices: number[];
  indicesStr: string;
  count: number;
  originalRect: Rect;
}

/** Formats array of numbers into compact ranges e.g. [4,5,6,7,8,9,10,11,12,13] -> "4–13" */
export function formatIndexRanges(indices: number[]): string {
  if (!indices || indices.length === 0) return '';
  const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
    } else {
      ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
      start = cur;
      prev = cur;
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
  return ranges.join(', ');
}

/** Groups identical pieces on a board (same name, dimensions, rotation, and edgebanding) */
export function groupPiecesForTable(rects: Rect[], shouldUnify: boolean): GroupedPiece[] {
  const sorted = [...rects].sort((a, b) => (a.cutIndex || 0) - (b.cutIndex || 0));
  if (!shouldUnify) {
    return sorted.map(r => ({
      name: r.name,
      w: r.w,
      h: r.h,
      rotated: !!r.rotated,
      cantos: r.cantos,
      cutIndices: [r.cutIndex || 0],
      indicesStr: `${r.cutIndex || 0}`,
      count: 1,
      originalRect: r
    }));
  }

  const map = new Map<string, GroupedPiece>();
  sorted.forEach(r => {
    const roundW = Math.round(r.w);
    const roundH = Math.round(r.h);
    const topC = !r.rotated ? (r.cantos?.largo1 || '') : (r.cantos?.ancho1 || '');
    const botC = !r.rotated ? (r.cantos?.largo2 || '') : (r.cantos?.ancho2 || '');
    const lftC = !r.rotated ? (r.cantos?.ancho1 || '') : (r.cantos?.largo1 || '');
    const rgtC = !r.rotated ? (r.cantos?.ancho2 || '') : (r.cantos?.largo2 || '');
    const rot = r.rotated ? '1' : '0';
    const key = `${r.name.trim().toLowerCase()}_${roundW}_${roundH}_${rot}_${topC}_${botC}_${lftC}_${rgtC}`;

    if (!map.has(key)) {
      map.set(key, {
        name: r.name,
        w: r.w,
        h: r.h,
        rotated: !!r.rotated,
        cantos: r.cantos,
        cutIndices: [r.cutIndex || 0],
        indicesStr: '',
        count: 1,
        originalRect: r
      });
    } else {
      const existing = map.get(key)!;
      existing.cutIndices.push(r.cutIndex || 0);
      existing.count += 1;
    }
  });

  const result = Array.from(map.values());
  result.forEach(g => {
    g.indicesStr = formatIndexRanges(g.cutIndices);
  });
  return result;
}

interface PdfExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardGroups: { 
    thickness: number; 
    boards: PackedBoard[]; 
    stats: any; 
    config: SheetConfig 
  }[];
  pieces: Piece[];
  sheetConfig: SheetConfig;
  edgeThicknessConfig: EdgeThicknessConfig;
  projectName?: string;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  onClose,
  boardGroups,
  pieces,
  sheetConfig,
  edgeThicknessConfig,
  projectName = 'Proyecto de Carpintería'
}) => {
  // Export Settings
  const [layoutMode, setLayoutMode] = useState<'single_sheet' | 'full_map' | 'separate'>('single_sheet');
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [paperSize, setPaperSize] = useState<'a4' | 'letter' | 'a3' | 'legal'>('a4');
  const [sheetOccupancy, setSheetOccupancy] = useState<'maximized' | 'standard'>('maximized');
  const [fontSizeScale, setFontSizeScale] = useState<'large' | 'extralarge' | 'standard'>('large');
  
  // Didactic Carpenter Options
  const [unifyIdenticalPieces, setUnifyIdenticalPieces] = useState(true);
  const [showPieceNames, setShowPieceNames] = useState(true);
  const [showPieceDims, setShowPieceDims] = useState(true);
  const [showCutIndex, setShowCutIndex] = useState(true);
  const [showEdgebanding, setShowEdgebanding] = useState(true);
  const [showWasteDims, setShowWasteDims] = useState(true);
  const [showPieceChecklist, setShowPieceChecklist] = useState(false);
  const [showProjectSummary, setShowProjectSummary] = useState(true);
  const [highContrastMode, setHighContrastMode] = useState(false);
  const [selectedBoardScope, setSelectedBoardScope] = useState<'all' | number>('all');
  const [mobileTab, setMobileTab] = useState<'config' | 'preview'>('config');
  
  // Preview Pagination
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Flatten boards for export
  const allBoards = useMemo(() => {
    const list: {
      groupThickness: number;
      displayName?: string;
      code?: string;
      materialColor?: string;
      substrate?: string;
      board: PackedBoard;
      config: SheetConfig;
      globalIndex: number;
      totalBoards: number;
    }[] = [];
    
    let total = 0;
    boardGroups.forEach(g => total += g.boards.length);
    
    let currentIdx = 1;
    boardGroups.forEach(g => {
      g.boards.forEach(b => {
        list.push({
          groupThickness: g.thickness,
          displayName: (g as any).displayName,
          code: (g as any).code,
          materialColor: (g as any).materialColor,
          substrate: (g as any).substrate,
          board: b,
          config: g.config,
          globalIndex: currentIdx++,
          totalBoards: total
        });
      });
    });
    return list;
  }, [boardGroups]);

  // Boards to export
  const exportBoards = useMemo(() => {
    if (selectedBoardScope === 'all') return allBoards;
    return allBoards.filter(b => b.globalIndex === selectedBoardScope);
  }, [allBoards, selectedBoardScope]);

  // Current preview board
  const currentPreview = exportBoards[Math.min(previewPageIndex, exportBoards.length - 1)] || exportBoards[0];

  // Edgebanding summary for the current preview board
  const currentBoardEdges = useMemo(() => {
    if (!currentPreview) return { thin: 0, thick: 0, maxWaste: 'Ninguno' };
    let thin = 0;
    let thick = 0;
    currentPreview.board.rects.forEach(r => {
      if (!r.cantos) return;
      const l = !r.rotated ? r.w : r.h;
      const a = !r.rotated ? r.h : r.w;
      const addE = (type?: string, len = 0) => {
        if (type === 'Canto Delgado') thin += len / 1000;
        else if (type === 'Canto Grueso') thick += len / 1000;
      };
      addE(r.cantos.largo1, l);
      addE(r.cantos.largo2, l);
      addE(r.cantos.ancho1, a);
      addE(r.cantos.ancho2, a);
    });

    let maxWaste = 'Ninguno';
    if (currentPreview.board.wasteRects.length > 0) {
      const sortedW = [...currentPreview.board.wasteRects].sort((a, b) => (b.w * b.h) - (a.w * a.h));
      if (sortedW[0].w > 100 && sortedW[0].h > 80) {
        maxWaste = `${Math.round(sortedW[0].w)}×${Math.round(sortedW[0].h)} mm`;
      }
    }

    return { thin, thick, maxWaste };
  }, [currentPreview]);

  // Grouped rects and columns for current preview board (dynamic sizing)
  const previewGroupedItems = useMemo(() => {
    if (!currentPreview) return [];
    return groupPiecesForTable(currentPreview.board.rects, unifyIdenticalPieces);
  }, [currentPreview, unifyIdenticalPieces]);

  const previewCols = useMemo(() => {
    const c = previewGroupedItems.length;
    if (orientation === 'landscape') {
      if (c <= 6) return 1;
      if (c <= 16) return 2;
      if (c <= 33) return 3;
      return 4;
    } else {
      if (c <= 6) return 1;
      if (c <= 18) return 2;
      return 3;
    }
  }, [previewGroupedItems.length, orientation]);

  // Totals for summary
  const totals = useMemo(() => {
    let thinMeters = 0;
    let thickMeters = 0;
    let totalPiecesCount = 0;

    pieces.forEach(p => {
      totalPiecesCount += p.cantidad;
      if (!p.cantos) return;
      const { largo, ancho, cantos, cantidad } = p;
      const edges = [
        { type: cantos.largo1, len: largo },
        { type: cantos.largo2, len: largo },
        { type: cantos.ancho1, len: ancho },
        { type: cantos.ancho2, len: ancho }
      ];
      edges.forEach(e => {
        if (e.type === 'Canto Delgado') thinMeters += (e.len * cantidad) / 1000;
        if (e.type === 'Canto Grueso') thickMeters += (e.len * cantidad) / 1000;
      });
    });

    let totalArea = 0;
    let usedArea = 0;
    boardGroups.forEach(g => {
      totalArea += g.stats?.totalArea || 0;
      usedArea += g.stats?.areaUsed || 0;
    });
    const avgEfficiency = totalArea > 0 ? (usedArea / totalArea) * 100 : 0;

    return {
      totalPiecesCount,
      thinMeters: thinMeters.toFixed(2),
      thickMeters: thickMeters.toFixed(2),
      totalBoards: allBoards.length,
      efficiency: avgEfficiency.toFixed(1)
    };
  }, [pieces, boardGroups, allBoards]);

  if (!isOpen) return null;

  // Paper Dimensions in mm
  const getPaperDimensions = () => {
    let w = 297;
    let h = 210;
    if (paperSize === 'letter') { w = 279.4; h = 215.9; }
    else if (paperSize === 'a3') { w = 420; h = 297; }
    else if (paperSize === 'legal') { w = 355.6; h = 215.9; }

    return orientation === 'landscape' ? { w, h } : { w: h, h: w };
  };

  // Generate Native PDF using jsPDF Vector Engine
  const handleDownloadPdf = async () => {
    setIsGenerating(true);
    try {
      const { w: pageWidth, h: pageHeight } = getPaperDimensions();
      const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format: paperSize === 'letter' ? 'letter' : paperSize === 'a3' ? 'a3' : paperSize === 'legal' ? 'legal' : 'a4'
      });

      // Margins & Area allocation
      const margin = sheetOccupancy === 'maximized' ? 4 : 8;
      const headerH = 11;
      const footerH = 6;

      const printableW = pageWidth - (margin * 2);
      const totalContentH = pageHeight - (margin * 2) - headerH - footerH;
      const isSingleSheet = layoutMode === 'single_sheet';

      exportBoards.forEach((boardItem, bIdx) => {
        if (bIdx > 0) doc.addPage();

        const { board, config, groupThickness, globalIndex, totalBoards } = boardItem;
        const bWidth = config.width;
        const bHeight = config.height;
        const tableItems = groupPiecesForTable(board.rects, unifyIdenticalPieces);
        const itemCount = tableItems.length;

        // DYNAMIC TABLE SIZING:
        // Prioritize maximizing the 2D cutting board graphic!
        // If the table has few pieces/groups, it will take minimal height.
        // If the table has many pieces/groups, it organizes into 2, 3, or 4 columns so it remains compact.
        let numCols = 1;
        let rowCount = itemCount;
        let rowH = 3.6;
        let tableActualH = 0;
        const titleH = 4.5;
        const colHeaderH = 3.6;

        if (isSingleSheet) {
          if (orientation === 'landscape') {
            if (itemCount <= 6) {
              numCols = 1;
              rowCount = itemCount;
              rowH = 3.9;
            } else if (itemCount <= 16) {
              numCols = 2;
              rowCount = Math.ceil(itemCount / 2);
              rowH = itemCount <= 10 ? 3.8 : 3.4;
            } else if (itemCount <= 33) {
              numCols = 3;
              rowCount = Math.ceil(itemCount / 3);
              rowH = 3.2;
            } else {
              numCols = 4;
              rowCount = Math.ceil(itemCount / 4);
              rowH = 2.9;
            }
          } else {
            // Portrait
            if (itemCount <= 6) {
              numCols = 1;
              rowCount = itemCount;
              rowH = 3.9;
            } else if (itemCount <= 18) {
              numCols = 2;
              rowCount = Math.ceil(itemCount / 2);
              rowH = 3.4;
            } else {
              numCols = 3;
              rowCount = Math.ceil(itemCount / 3);
              rowH = 3.0;
            }
          }

          tableActualH = titleH + colHeaderH + (rowCount * rowH);
        }

        // Available height for the 2D cutting diagram
        const tableGap = isSingleSheet ? 2.5 : 0;
        const availableDiagramH = isSingleSheet 
          ? Math.max(70, totalContentH - tableActualH - tableGap) 
          : totalContentH;

        // Scale board to MAXIMIZE its footprint on the sheet
        const scale = Math.min(printableW / bWidth, availableDiagramH / bHeight);
        const boardDrawW = bWidth * scale;
        const boardDrawH = bHeight * scale;

        // Center board in its expanded upper diagram zone
        const boardDrawX = margin + (printableW - boardDrawW) / 2;
        const boardDrawY = margin + headerH + (availableDiagramH - boardDrawH) / 2;

        // Pinned Table Start Y: positioned right above the footer bar
        const tableStartY = pageHeight - margin - footerH - tableActualH;

        // 1. Header Bar (Clean, technical, high readability)
        doc.setFillColor(245, 245, 247);
        doc.rect(margin, margin, printableW, headerH, 'F');
        doc.setDrawColor(180, 180, 180);
        doc.rect(margin, margin, printableW, headerH, 'S');

        // Badge: PLANCHA X de Y
        doc.setFillColor(240, 161, 68); // Amber carpenter badge
        doc.rect(margin + 2, margin + 2, 28, headerH - 4, 'F');
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`PLANCHA ${globalIndex}/${totalBoards}`, margin + 16, margin + (headerH / 2) + 1, { align: 'center' });

        // Material & Sheet Dimensions
        doc.setFontSize(9.5);
        doc.setTextColor(20, 20, 20);
        const matName = boardItem.displayName || (groupThickness === 3 ? 'MDF 3mm' : `Melamina ${groupThickness}mm`);
        doc.text(`${matName.toUpperCase()} — Formato: ${bWidth} × ${bHeight} mm`, margin + 34, margin + (headerH / 2) - 0.5);

        // Technical specs (Refile, Kerf, Pieces, Efficiency)
        doc.setFontSize(7.5);
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Refile: ${config.margin}mm | Sierra: ${config.kerf}mm | Piezas: ${board.rects.length} | Aprov: ${board.stats.efficiency.toFixed(1)}% | Desecho: ${(100 - board.stats.efficiency).toFixed(1)}%`,
          margin + 34, 
          margin + (headerH / 2) + 3.2
        );

        // Date & Project on right
        doc.setFontSize(7.5);
        doc.text(projectName, pageWidth - margin - 3, margin + (headerH / 2) - 0.5, { align: 'right' });
        doc.text(new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }), pageWidth - margin - 3, margin + (headerH / 2) + 3.2, { align: 'right' });

        // 2. Main Cutting Board Outline
        doc.setFillColor(255, 255, 255);
        doc.rect(boardDrawX, boardDrawY, boardDrawW, boardDrawH, 'F');
        doc.setDrawColor(40, 40, 40);
        doc.setLineWidth(0.4);
        doc.rect(boardDrawX, boardDrawY, boardDrawW, boardDrawH, 'S');

        // Draw Sheet Dimension arrows on top and left
        doc.setFontSize(6.5);
        doc.setTextColor(100, 100, 100);
        doc.text(`0 mm`, boardDrawX, boardDrawY - 1);
        doc.text(`← Longitud Plancha: ${bWidth} mm →`, boardDrawX + boardDrawW / 2, boardDrawY - 1, { align: 'center' });
        doc.text(`${bWidth} mm`, boardDrawX + boardDrawW, boardDrawY - 1, { align: 'right' });

        // 3. Draw Waste Rectangles (Sobrantes / Retazos aprovechables)
        board.wasteRects.forEach(w => {
          const wx = boardDrawX + (w.x * scale);
          const wy = boardDrawY + (w.y * scale);
          const ww = w.w * scale;
          const wh = w.h * scale;

          if (ww < 1 || wh < 1) return;

          // Soft tint for waste
          doc.setFillColor(254, 242, 242); // Soft rose
          doc.rect(wx, wy, ww, wh, 'F');
          doc.setDrawColor(248, 113, 113); // Rose border
          doc.setLineWidth(0.15);
          doc.rect(wx, wy, ww, wh, 'S');

          // Label waste if large enough
          if (showWasteDims && ww > 14 && wh > 6) {
            doc.setTextColor(220, 38, 38);
            doc.setFontSize(Math.max(5.5, Math.min(8, ww * 0.18)));
            doc.setFont('helvetica', 'bold');
            doc.text(`${Math.round(w.w)}×${Math.round(w.h)}`, wx + ww / 2, wy + wh / 2 + 1, { align: 'center' });
          }
        });

        // 4. Draw Pieces (Piezas de Corte)
        board.rects.forEach(r => {
          const rx = boardDrawX + (r.x * scale);
          const ry = boardDrawY + (r.y * scale);
          const rw = r.w * scale;
          const rh = r.h * scale;

          // Piece Background
          doc.setFillColor(255, 255, 255);
          doc.rect(rx, ry, rw, rh, 'F');
          
          // Piece Perimeter Border (Clean black)
          doc.setDrawColor(20, 20, 20);
          doc.setLineWidth(0.25);
          doc.rect(rx, ry, rw, rh, 'S');

          // Draw Edgebanding Lines (Bandas de Cantos con código de color didáctico)
          if (showEdgebanding && r.cantos) {
            const topC = !r.rotated ? r.cantos.largo1 : r.cantos.ancho1;
            const botC = !r.rotated ? r.cantos.largo2 : r.cantos.ancho2;
            const lftC = !r.rotated ? r.cantos.ancho1 : r.cantos.largo1;
            const rgtC = !r.rotated ? r.cantos.ancho2 : r.cantos.largo2;

            const drawEdge = (x1: number, y1: number, x2: number, y2: number, type: string) => {
              if (type === 'Ninguno') return;
              const isThick = type === 'Canto Grueso';
              doc.setDrawColor(isThick ? 220 : 37, isThick ? 38 : 99, isThick ? 38 : 235); // Red / Blue
              doc.setLineWidth(isThick ? 0.9 : 0.55);
              doc.line(x1, y1, x2, y2);
            };

            drawEdge(rx, ry, rx + rw, ry, topC);
            drawEdge(rx, ry + rh, rx + rw, ry + rh, botC);
            drawEdge(rx, ry, rx, ry + rh, lftC);
            drawEdge(rx + rw, ry, rx + rw, ry + rh, rgtC);
          }

          // Cut Sequence Badge (Índice de Corte ①, ②, ③)
          if (showCutIndex && rw > 8 && rh > 8) {
            const badgeRadius = Math.min(3.2, rw * 0.15, rh * 0.15);
            const bx = rx + badgeRadius + 1.2;
            const by = ry + badgeRadius + 1.2;

            doc.setFillColor(240, 161, 68); // Amber
            doc.circle(bx, by, badgeRadius, 'F');
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.15);
            doc.circle(bx, by, badgeRadius, 'S');

            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(badgeRadius * 2.8);
            doc.text(`${r.cutIndex}`, bx, by + (badgeRadius * 0.35), { align: 'center' });
          }

          // Piece Name & Dimensions (Large, Didactic & Centered)
          const cx = rx + rw / 2;
          const cy = ry + rh / 2;

          const sizeMultiplier = fontSizeScale === 'extralarge' ? 1.3 : fontSizeScale === 'large' ? 1.1 : 0.9;
          const maxNameSize = Math.max(6, Math.min(13 * sizeMultiplier, rw * 0.18, rh * 0.28));
          const maxDimSize = Math.max(5.5, Math.min(10.5 * sizeMultiplier, rw * 0.14, rh * 0.22));

          // Draw Piece Name
          if (showPieceNames && rw > 10 && rh > 8) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(maxNameSize);
            doc.setTextColor(15, 15, 15);
            const labelY = showPieceDims ? cy - (maxDimSize * 0.35) : cy + 1;
            doc.text(r.name.toUpperCase(), cx, labelY, { align: 'center', maxWidth: rw - 3 });
          }

          // Draw Dimensions (Largo × Ancho mm)
          if (showPieceDims && rw > 12 && rh > 10) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(maxDimSize);
            doc.setTextColor(30, 30, 30);
            const dimText = `${Math.round(r.w)} × ${Math.round(r.h)}`;
            const dimY = showPieceNames ? cy + (maxDimSize * 0.7) : cy + 1;
            doc.text(dimText, cx, dimY, { align: 'center' });
          }
        });

        // 5. IF SINGLE SHEET: DRAW INTEGRATED PIECES TABLE FOR THIS PLANCHA
        if (isSingleSheet) {
          // Compute edgebanding meters for this board
          let bThin = 0;
          let bThick = 0;
          board.rects.forEach(r => {
            if (!r.cantos) return;
            const l = !r.rotated ? r.w : r.h;
            const a = !r.rotated ? r.h : r.w;
            const addE = (type?: string, len = 0) => {
              if (type === 'Canto Delgado') bThin += len / 1000;
              else if (type === 'Canto Grueso') bThick += len / 1000;
            };
            addE(r.cantos.largo1, l);
            addE(r.cantos.largo2, l);
            addE(r.cantos.ancho1, a);
            addE(r.cantos.ancho2, a);
          });

          // Largest waste
          let maxWasteStr = 'Ninguno';
          if (board.wasteRects.length > 0) {
            const sortedW = [...board.wasteRects].sort((a, b) => (b.w * b.h) - (a.w * a.h));
            if (sortedW[0].w > 100 && sortedW[0].h > 80) {
              maxWasteStr = `${Math.round(sortedW[0].w)}×${Math.round(sortedW[0].h)} mm`;
            }
          }

          // Table Title Bar (height 4.5mm)
          doc.setFillColor(242, 244, 248);
          doc.rect(margin, tableStartY, printableW, titleH, 'F');
          doc.setDrawColor(180, 185, 195);
          doc.setLineWidth(0.25);
          doc.rect(margin, tableStartY, printableW, titleH, 'S');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(30, 40, 60);
          const piecesSubtitle = unifyIdenticalPieces && tableItems.length < board.rects.length
            ? `(${tableItems.length} tipos de pieza • ${board.rects.length} piezas totales)`
            : `(${board.rects.length} piezas)`;

          doc.text(`TABLA DE CORTE Y VERIFICACIÓN [ ✓ ] — PLANCHA ${globalIndex} ${piecesSubtitle}`, margin + 3, tableStartY + 3.2);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.8);
          doc.setTextColor(70, 70, 70);
          doc.text(
            `Tapacanto: Delgado ${bThin.toFixed(2)} m | Grueso ${bThick.toFixed(2)} m | Retazo mayor: ${maxWasteStr}`, 
            pageWidth - margin - 3, 
            tableStartY + 3.2, 
            { align: 'right' }
          );

          const getC = (v?: string) => v === 'Canto Grueso' ? 'G' : v === 'Canto Delgado' ? 'D' : '−';

          // Multi-column or single-column layout
          const colGap = numCols > 1 ? 3 : 0;
          const subTableW = (printableW - (colGap * (numCols - 1))) / numCols;
          const itemsPerCol = Math.ceil(tableItems.length / numCols);

          for (let colIdx = 0; colIdx < numCols; colIdx++) {
            const startIdx = colIdx * itemsPerCol;
            const subList = tableItems.slice(startIdx, startIdx + itemsPerCol);
            if (subList.length === 0) continue;

            const startX = margin + colIdx * (subTableW + colGap);
            let curY = tableStartY + titleH;

            // Column width breakdown based on numCols - always including CANT column for clarity
            let subCols: { label: string; w: number; align?: 'left' | 'center' }[] = [];
            if (numCols === 1) {
              subCols = [
                { label: '[✓]', w: 8, align: 'center' },
                { label: 'Nº', w: 16, align: 'center' },
                { label: 'PIEZA / DESCRIPCIÓN', w: 62 },
                { label: 'CANT', w: 13, align: 'center' },
                { label: 'MEDIDAS (mm)', w: 34 },
                { label: 'CANTOS (L1·L2 | A1·A2)', w: 52 },
                { label: 'VETA', w: 18 },
                { label: 'NOTAS / VERIFICACIÓN', w: subTableW - (8 + 16 + 62 + 13 + 34 + 52 + 18) }
              ];
            } else if (numCols === 2) {
              subCols = [
                { label: '[✓]', w: 7, align: 'center' },
                { label: 'Nº', w: 14, align: 'center' },
                { label: 'PIEZA', w: 36 },
                { label: 'CANT', w: 11, align: 'center' },
                { label: 'MEDIDAS', w: 27 },
                { label: 'CANTOS', w: 33 },
                { label: 'VETA', w: subTableW - (7 + 14 + 36 + 11 + 27 + 33) }
              ];
            } else if (numCols === 3) {
              subCols = [
                { label: '[✓]', w: 6, align: 'center' },
                { label: 'Nº', w: 12, align: 'center' },
                { label: 'PIEZA', w: 25 },
                { label: 'CANT', w: 9, align: 'center' },
                { label: 'MEDIDAS', w: 19 },
                { label: 'CANTOS', w: 13 },
                { label: 'V', w: subTableW - (6 + 12 + 25 + 9 + 19 + 13) }
              ];
            } else {
              subCols = [
                { label: '[✓]', w: 5, align: 'center' },
                { label: 'Nº', w: 11, align: 'center' },
                { label: 'PIEZA', w: 18 },
                { label: 'CANT', w: 8, align: 'center' },
                { label: 'MEDIDAS', w: 15 },
                { label: 'CANTOS', w: subTableW - (5 + 11 + 18 + 8 + 15) }
              ];
            }

            // Draw Column Header
            doc.setFillColor(232, 235, 240);
            doc.rect(startX, curY, subTableW, colHeaderH, 'F');
            doc.setDrawColor(200, 205, 215);
            doc.rect(startX, curY, subTableW, colHeaderH, 'S');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(numCols >= 3 ? 5.8 : 6.2);
            doc.setTextColor(50, 50, 50);

            let headerX = startX;
            subCols.forEach(sc => {
              if (sc.align === 'center') {
                doc.text(sc.label, headerX + sc.w / 2, curY + (colHeaderH / 2) + 0.9, { align: 'center' });
              } else {
                doc.text(sc.label, headerX + 1.5, curY + (colHeaderH / 2) + 0.9);
              }
              headerX += sc.w;
            });

            curY += colHeaderH;

            // Draw Rows
            subList.forEach((item, idx) => {
              doc.setFillColor(idx % 2 === 0 ? 255 : 249, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
              doc.rect(startX, curY, subTableW, rowH, 'F');
              doc.setDrawColor(225, 228, 235);
              doc.rect(startX, curY, subTableW, rowH, 'S');

              // Checkbox
              const chkW = Math.min(2.8, rowH - 0.8);
              doc.setDrawColor(90, 90, 90);
              doc.setLineWidth(0.2);
              doc.rect(startX + (subCols[0].w - chkW) / 2, curY + (rowH - chkW) / 2, chkW, chkW, 'S');

              let cellX = startX + subCols[0].w;

              // Nº badge/pill (shows ranges like 4–13 cleanly)
              const numStr = item.indicesStr;
              const badgeW = Math.max(4.5, Math.min(subCols[1].w - 1.5, numStr.length * 2.1 + 2));
              const badgeH = Math.min(rowH - 0.8, 3.2);
              doc.setFillColor(240, 161, 68);
              doc.roundedRect(cellX + (subCols[1].w - badgeW) / 2, curY + (rowH - badgeH) / 2, badgeW, badgeH, 0.8, 0.8, 'F');
              doc.setTextColor(0, 0, 0);
              doc.setFont('helvetica', 'bold');
              const numFontSize = numStr.length > 5 ? 4.3 : numStr.length > 3 ? 4.9 : 5.8;
              doc.setFontSize(numFontSize);
              doc.text(numStr, cellX + subCols[1].w / 2, curY + rowH / 2 + 0.6, { align: 'center' });
              cellX += subCols[1].w;

              // Piece Name
              doc.setTextColor(20, 20, 20);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(numCols >= 3 ? 5.5 : 6.2);
              doc.text(item.name.toUpperCase(), cellX + 1.5, curY + rowH / 2 + 0.6, { maxWidth: subCols[2].w - 2 });
              cellX += subCols[2].w;

              // Cantidad (CANT)
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(numCols >= 3 ? 5.8 : 6.4);
              if (item.count > 1) {
                doc.setTextColor(195, 80, 0);
              } else {
                doc.setTextColor(40, 40, 40);
              }
              doc.text(`${item.count}`, cellX + subCols[3].w / 2, curY + rowH / 2 + 0.6, { align: 'center' });
              cellX += subCols[3].w;

              // Medidas
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(numCols >= 3 ? 5.5 : 6.2);
              doc.setTextColor(20, 20, 20);
              doc.text(`${Math.round(item.w)}×${Math.round(item.h)}`, cellX + 1.5, curY + rowH / 2 + 0.6);
              cellX += subCols[4].w;

              // Cantos
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(numCols >= 3 ? 5.2 : 5.8);
              const topC = !item.rotated ? item.cantos?.largo1 : item.cantos?.ancho1;
              const botC = !item.rotated ? item.cantos?.largo2 : item.cantos?.ancho2;
              const lftC = !item.rotated ? item.cantos?.ancho1 : item.cantos?.largo1;
              const rgtC = !item.rotated ? item.cantos?.ancho2 : item.cantos?.largo2;
              const hasC = [topC, botC, lftC, rgtC].some(c => c && c !== 'Ninguno');
              
              let cDesc = '—';
              if (hasC) {
                if (numCols <= 2) {
                  cDesc = `L:${getC(topC)}${getC(botC)} A:${getC(lftC)}${getC(rgtC)}`;
                } else {
                  cDesc = `${getC(topC)}${getC(botC)}/${getC(lftC)}${getC(rgtC)}`;
                }
              }
              doc.text(cDesc, cellX + 1.2, curY + rowH / 2 + 0.6);
              cellX += subCols[5].w;

              // Veta (for 1, 2, 3 cols)
              if (numCols <= 3) {
                const vetaText = numCols <= 2 ? (item.rotated ? 'Rot' : 'Norm') : (item.rotated ? 'R' : 'N');
                doc.text(vetaText, cellX + 1.2, curY + rowH / 2 + 0.6);
                cellX += subCols[6].w;
              }

              // Notes line for 1 col
              if (numCols === 1) {
                doc.setDrawColor(210, 210, 210);
                doc.line(cellX + 2, curY + rowH / 2 + 1, startX + subTableW - 3, curY + rowH / 2 + 1);
              }

              curY += rowH;
            });
          }
        }

        // 6. Footer Bar (Edgebanding Legend & Workshop Specs)
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, pageHeight - margin - footerH, printableW, footerH, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, pageHeight - margin - footerH, printableW, footerH, 'S');

        // Edgebanding Legend
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        
        // Blue Box
        doc.setFillColor(37, 99, 235);
        doc.rect(margin + 3, pageHeight - margin - footerH + 1.8, 3.5, 2.5, 'F');
        doc.setTextColor(37, 99, 235);
        doc.text('Canto Delgado (0.45mm / 1mm)', margin + 8, pageHeight - margin - footerH + 3.8);

        // Red Box
        doc.setFillColor(220, 38, 38);
        doc.rect(margin + 56, pageHeight - margin - footerH + 1.8, 3.5, 2.5, 'F');
        doc.setTextColor(220, 38, 38);
        doc.text('Canto Grueso (2mm / 3mm)', margin + 61, pageHeight - margin - footerH + 3.8);

        // Right side info
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90, 90, 90);
        doc.text(
          `Plano de taller • Plancha ${globalIndex} de ${totalBoards} • ${board.rects.length} piezas`,
          pageWidth - margin - 3,
          pageHeight - margin - footerH + 3.8,
          { align: 'right' }
        );
      });

      // 7. Optional Separate Workshop Checklist Sheet (ONLY when layoutMode === 'separate' AND showPieceChecklist)
      if (layoutMode === 'separate' && showPieceChecklist) {
        doc.addPage();
        
        // Checklist Page Header
        doc.setFillColor(35, 35, 35);
        doc.rect(margin, margin, printableW, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`LISTA DE CORTE Y VERIFICACIÓN EN TALLER — CHECKLIST`, margin + 4, margin + 9);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`${projectName} • Total Piezas: ${totals.totalPiecesCount}`, pageWidth - margin - 4, margin + 9, { align: 'right' });

        // Table Header
        let tableY = margin + 18;
        const colWidths = [12, 14, 60, 20, 30, 45, 20, 20];
        // [Check, Nº, Descripción, Cant, Medidas (L×A), Cantos (L1/L2/A1/A2), Veta, Estado]
        
        doc.setFillColor(240, 240, 242);
        doc.rect(margin, tableY, printableW, 7, 'F');
        doc.setDrawColor(200, 200, 200);
        doc.rect(margin, tableY, printableW, 7, 'S');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(40, 40, 40);
        
        let curX = margin;
        doc.text('[✓]', curX + 3, tableY + 5); curX += colWidths[0];
        doc.text('ITEM', curX + 2, tableY + 5); curX += colWidths[1];
        doc.text('PIEZA / DESCRIPCIÓN', curX + 2, tableY + 5); curX += colWidths[2];
        doc.text('CANT', curX + 2, tableY + 5); curX += colWidths[3];
        doc.text('MEDIDAS (mm)', curX + 2, tableY + 5); curX += colWidths[4];
        doc.text('CANTOS (L1·L2 | A1·A2)', curX + 2, tableY + 5); curX += colWidths[5];
        doc.text('VETA', curX + 2, tableY + 5); curX += colWidths[6];
        doc.text('PLANCHA', curX + 2, tableY + 5);

        tableY += 7;

        // Group pieces for checklist (unifying if option is active)
        let itemNum = 1;
        exportBoards.forEach(bItem => {
          const boardChecklistItems = groupPiecesForTable(bItem.board.rects, unifyIdenticalPieces);
          boardChecklistItems.forEach(item => {
            if (tableY > pageHeight - margin - 15) {
              doc.addPage();
              tableY = margin + 10;
            }

            const rowH = 6;
            doc.setFillColor(itemNum % 2 === 0 ? 250 : 255, itemNum % 2 === 0 ? 250 : 255, itemNum % 2 === 0 ? 250 : 255);
            doc.rect(margin, tableY, printableW, rowH, 'F');
            doc.setDrawColor(230, 230, 230);
            doc.rect(margin, tableY, printableW, rowH, 'S');

            // Square checkbox for carpenter pencil
            doc.setDrawColor(100, 100, 100);
            doc.setLineWidth(0.2);
            doc.rect(margin + 3, tableY + 1.2, 3.5, 3.5, 'S');

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(30, 30, 30);

            let rowX = margin + colWidths[0];
            doc.text(`${itemNum}`, rowX + 2, tableY + 4.2); rowX += colWidths[1];
            doc.setFont('helvetica', 'bold');
            doc.text(item.name.toUpperCase(), rowX + 2, tableY + 4.2); rowX += colWidths[2];
            
            // Cantidad
            doc.setFont('helvetica', 'bold');
            if (item.count > 1) {
              doc.setTextColor(195, 80, 0);
            } else {
              doc.setTextColor(30, 30, 30);
            }
            doc.text(`${item.count}`, rowX + 4, tableY + 4.2); rowX += colWidths[3];
            
            doc.setTextColor(30, 30, 30);
            doc.setFont('helvetica', 'bold');
            doc.text(`${Math.round(item.w)} × ${Math.round(item.h)}`, rowX + 2, tableY + 4.2); rowX += colWidths[4];

            // Cantos code
            doc.setFont('helvetica', 'normal');
            const formatC = (c?: string) => c === 'Canto Grueso' ? 'G' : c === 'Canto Delgado' ? 'D' : '−';
            const topC = !item.rotated ? item.cantos?.largo1 : item.cantos?.ancho1;
            const botC = !item.rotated ? item.cantos?.largo2 : item.cantos?.ancho2;
            const lftC = !item.rotated ? item.cantos?.ancho1 : item.cantos?.largo1;
            const rgtC = !item.rotated ? item.cantos?.ancho2 : item.cantos?.largo2;
            const cStr = `L:${formatC(topC)}${formatC(botC)} A:${formatC(lftC)}${formatC(rgtC)}`;
            doc.text(cStr, rowX + 2, tableY + 4.2); rowX += colWidths[5];
            
            doc.text(item.rotated ? 'Rotada' : 'Normal', rowX + 2, tableY + 4.2); rowX += colWidths[6];
            const pInfo = item.count > 1 ? `Pl. ${bItem.globalIndex} (Nº ${item.indicesStr})` : `Plancha ${bItem.globalIndex} (Nº ${item.indicesStr})`;
            doc.text(pInfo, rowX + 2, tableY + 4.2);

            tableY += rowH;
            itemNum++;
          });
        });

        // Summary box at bottom of checklist
        if (tableY < pageHeight - margin - 25) {
          tableY += 5;
          doc.setFillColor(245, 247, 250);
          doc.rect(margin, tableY, printableW, 18, 'F');
          doc.setDrawColor(210, 215, 225);
          doc.rect(margin, tableY, printableW, 18, 'S');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 40, 60);
          doc.text('RESUMEN DE CONSUMO EN TALLER:', margin + 4, tableY + 5);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(60, 60, 60);
          doc.text(`• Total Planchas Requeridas: ${totals.totalBoards}`, margin + 4, tableY + 10);
          doc.text(`• Consumo Tapacanto Delgado: ${totals.thinMeters} m`, margin + 65, tableY + 10);
          doc.text(`• Consumo Tapacanto Grueso: ${totals.thickMeters} m`, margin + 130, tableY + 10);
          doc.text(`• Aprovechamiento Promedio: ${totals.efficiency}%`, margin + 4, tableY + 15);
          doc.text(`• Firma de Verificación Taller: _________________________`, margin + 110, tableY + 15);
        }
      }

      // Save PDF file
      const safeProject = projectName.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Plano_Corte_${safeProject}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Browser Native Print
  const handleNativePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error('Error printing:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-1 sm:p-3 overflow-hidden">
      <div className="bg-[#181818] border border-[#333333] rounded-xl sm:rounded-2xl w-full max-w-6xl h-full max-h-[calc(100dvh-12px)] sm:max-h-[calc(100dvh-20px)] flex flex-col shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Modal - Sleek & Compact with Direct Action & Mobile Tabs */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 border-b border-[#2d2d2d] bg-[#141414] shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#f0a144]/15 border border-[#f0a144]/30 flex items-center justify-center text-[#f0a144] shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0 truncate">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h2 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider truncate">
                  Imprimir / Exportar PDF de Taller
                </h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] sm:text-[8.5px] px-1.5 py-0.2 rounded font-bold shrink-0">
                  Vectorial HD
                </span>
              </div>
              <p className="text-[9.5px] text-[#888] hidden md:block truncate">
                Plancha maximizada, cotas legibles a distancia, cantos en color y orden de corte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Mobile Tab Switcher (Visible on compact / tablet screens) */}
            <div className="flex lg:hidden bg-[#1f1f1f] border border-[#333] rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setMobileTab('config')}
                className={`px-2 py-1 text-[9.5px] font-bold rounded flex items-center gap-1 transition-colors ${
                  mobileTab === 'config' 
                    ? 'bg-[#f0a144] text-black font-black' 
                    : 'text-[#888] hover:text-white'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span>Opciones</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab('preview')}
                className={`px-2 py-1 text-[9.5px] font-bold rounded flex items-center gap-1 transition-colors ${
                  mobileTab === 'preview' 
                    ? 'bg-[#f0a144] text-black font-black' 
                    : 'text-[#888] hover:text-white'
                }`}
              >
                <Eye className="w-3 h-3" />
                <span>Vista Previa</span>
              </button>
            </div>

            {/* Quick Instant Download Button in Header */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="bg-[#f0a144] hover:bg-[#ffb055] text-black font-black px-2.5 sm:px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="Descargar archivo PDF directamente"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isGenerating ? 'Generando...' : 'Descargar PDF'}</span>
              <span className="sm:hidden">{isGenerating ? '...' : 'PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-[#252525] rounded-lg text-[#aaa] hover:text-white transition-colors"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Left Options + Right Live Sheet Preview */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          
          {/* Left Controls Panel: Scrollable Content + Sticky Print Footer */}
          <div className={`w-full lg:w-[350px] border-b lg:border-b-0 lg:border-r border-[#2d2d2d] bg-[#1a1a1a] flex flex-col min-h-0 ${
            mobileTab === 'config' ? 'flex-1' : 'hidden lg:flex'
          }`}>
            
            {/* Scrollable Configuration Area */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-3.5 space-y-3">
              
              {/* Scope Selector (Planchas) */}
              <div>
                <span className="text-[9.5px] font-mono text-[#aaa] uppercase font-bold block mb-1">
                  Planchas a Exportar
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setSelectedBoardScope('all'); setPreviewPageIndex(0); }}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${selectedBoardScope === 'all' ? 'bg-[#f0a144] text-black border-[#f0a144]' : 'bg-[#222] text-[#ccc] border-[#333] hover:text-white'}`}
                  >
                    Todas ({allBoards.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedBoardScope(currentPreview.globalIndex); }}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${selectedBoardScope !== 'all' ? 'bg-[#f0a144] text-black border-[#f0a144]' : 'bg-[#222] text-[#ccc] border-[#333] hover:text-white'}`}
                  >
                    Solo Plancha {currentPreview.globalIndex}
                  </button>
                </div>
              </div>

              {/* Layout Mode Selector (1 Sola Hoja vs Separado) */}
              <div className="bg-[#202020] p-2.5 rounded-xl border border-[#303030] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white flex items-center gap-1.5">
                    <LayoutTemplate className="w-3.5 h-3.5 text-[#f0a144]" />
                    Distribución en Hoja
                  </span>
                  <span className="text-[8px] font-mono text-[#f0a144] font-bold bg-[#f0a144]/15 px-1.5 py-0.5 rounded">
                    Recomendado
                  </span>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setLayoutMode('single_sheet')}
                    className={`w-full p-2 rounded-lg border text-left transition-all flex items-start gap-2 ${
                      layoutMode === 'single_sheet' 
                        ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-sm' 
                        : 'bg-[#181818] border-[#2f2f2f] text-[#888] hover:text-white'
                    }`}
                  >
                    <CheckSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${layoutMode === 'single_sheet' ? 'text-[#f0a144]' : 'text-[#666]'}`} />
                    <div>
                      <div className={`text-[10.5px] font-bold ${layoutMode === 'single_sheet' ? 'text-[#f0a144]' : 'text-white'}`}>
                        Todo en 1 Sola Hoja (Plano 2D + Tabla)
                      </div>
                      <div className="text-[8.5px] text-[#aaa] leading-tight mt-0.5">
                        Toda la información de la plancha en 1 sola hoja: plano arriba y tabla con casillas [✓] abajo.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLayoutMode('full_map')}
                    className={`w-full p-2 rounded-lg border text-left transition-all flex items-start gap-2 ${
                      layoutMode === 'full_map' 
                        ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-sm' 
                        : 'bg-[#181818] border-[#2f2f2f] text-[#888] hover:text-white'
                    }`}
                  >
                    <Maximize2 className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${layoutMode === 'full_map' ? 'text-[#f0a144]' : 'text-[#666]'}`} />
                    <div>
                      <div className={`text-[10.5px] font-bold ${layoutMode === 'full_map' ? 'text-[#f0a144]' : 'text-white'}`}>
                        Solo Plano 2D (100% de la Hoja)
                      </div>
                      <div className="text-[8.5px] text-[#aaa] leading-tight mt-0.5">
                        El plano de corte maximizado al 100% sin tabla de piezas inferior.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setLayoutMode('separate');
                      setShowPieceChecklist(true);
                    }}
                    className={`w-full p-2 rounded-lg border text-left transition-all flex items-start gap-2 ${
                      layoutMode === 'separate' 
                        ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-sm' 
                        : 'bg-[#181818] border-[#2f2f2f] text-[#888] hover:text-white'
                    }`}
                  >
                    <Layers className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${layoutMode === 'separate' ? 'text-[#f0a144]' : 'text-[#666]'}`} />
                    <div>
                      <div className={`text-[10.5px] font-bold ${layoutMode === 'separate' ? 'text-[#f0a144]' : 'text-white'}`}>
                        Plano + Hoja Separada de Checklist
                      </div>
                      <div className="text-[8.5px] text-[#aaa] leading-tight mt-0.5">
                        1 hoja para el plano y 1 hoja adicional separada para el checklist.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Paper Orientation & Size */}
              <div className="space-y-1.5">
                <span className="text-[9.5px] font-mono text-[#aaa] uppercase font-bold block">
                  Papel y Orientación
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[10.5px] font-bold transition-colors ${orientation === 'landscape' ? 'bg-[#f0a144]/15 border-[#f0a144] text-[#f0a144]' : 'bg-[#222] border-[#333] text-[#aaa] hover:text-white'}`}
                  >
                    <div className="w-3.5 h-2.5 border border-current rounded-xs" />
                    Horizontal
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[10.5px] font-bold transition-colors ${orientation === 'portrait' ? 'bg-[#f0a144]/15 border-[#f0a144] text-[#f0a144]' : 'bg-[#222] border-[#333] text-[#aaa] hover:text-white'}`}
                  >
                    <div className="w-2.5 h-3.5 border border-current rounded-xs" />
                    Vertical
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  {(['a4', 'letter', 'a3', 'legal'] as const).map(size => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPaperSize(size)}
                      className={`py-1 rounded text-[10px] font-mono font-bold uppercase border transition-colors ${paperSize === size ? 'bg-[#f0a144] text-black border-[#f0a144]' : 'bg-[#242424] text-[#888] border-[#333] hover:text-white'}`}
                    >
                      {size === 'letter' ? 'Carta' : size === 'legal' ? 'Oficio' : size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Occupancy on Sheet - Minimalist */}
              <div className="bg-[#202020] p-2.5 rounded-xl border border-[#303030] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white flex items-center gap-1">
                    <Maximize2 className="w-3 h-3 text-[#f0a144]" />
                    Aprovechamiento Hoja
                  </span>
                  <span className="text-[8.5px] font-mono text-[#f0a144] font-bold bg-[#f0a144]/15 px-1.5 py-0.5 rounded">
                    Recomendado
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSheetOccupancy('maximized')}
                    className={`p-1.5 rounded-lg border text-left transition-all ${sheetOccupancy === 'maximized' ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-sm' : 'bg-[#181818] border-[#2f2f2f] text-[#888] hover:text-white'}`}
                  >
                    <div className="text-[10.5px] font-bold text-[#f0a144] flex items-center gap-1">
                      <Check className="w-3 h-3" /> Maximizar 95%
                    </div>
                    <div className="text-[8.5px] text-[#aaa] leading-tight mt-0.5">
                      Llena la hoja. Cotas grandes legibles de lejos.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetOccupancy('standard')}
                    className={`p-1.5 rounded-lg border text-left transition-all ${sheetOccupancy === 'standard' ? 'bg-[#f0a144]/15 border-[#f0a144] text-white' : 'bg-[#181818] border-[#2f2f2f] text-[#888] hover:text-white'}`}
                  >
                    <div className="text-[10.5px] font-bold">Estándar</div>
                    <div className="text-[8.5px] text-[#aaa] leading-tight mt-0.5">
                      Márgenes para anillar o encuadernar.
                    </div>
                  </button>
                </div>
              </div>

              {/* Didactic Elements - Compact & Clean */}
              <div className="space-y-1">
                <span className="text-[9.5px] font-mono text-[#aaa] uppercase font-bold block">
                  Elementos Didácticos en el Plano
                </span>

                <div className="space-y-1 bg-[#141414] p-2 rounded-xl border border-[#262626] text-xs">
                  {/* Unify Identical Pieces */}
                  <label className="flex items-center justify-between cursor-pointer py-1 px-1 hover:bg-[#202020] rounded border border-neutral-800/60 bg-[#1a1a1a]/40">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={unifyIdenticalPieces}
                        onChange={(e) => setUnifyIdenticalPieces(e.target.checked)}
                        className="rounded text-[#f0a144] focus:ring-0 w-3.5 h-3.5 bg-[#2a2a2a] border-[#444]"
                      />
                      <div>
                        <span className="text-white text-[10.5px] font-bold block">Unificar piezas iguales</span>
                        <span className="text-[#888] text-[8px] block">Agrupa piezas idénticas con cantidad (x Cant)</span>
                      </div>
                    </div>
                    <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                      unifyIdenticalPieces 
                        ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/25' 
                        : 'text-neutral-400 bg-neutral-800 border-neutral-700'
                    }`}>
                      {unifyIdenticalPieces ? 'UNIFICADAS' : 'INDIVIDUAL'}
                    </span>
                  </label>

                  {/* Piece Dimensions */}
                  <label className="flex items-center justify-between cursor-pointer py-0.5 px-1 hover:bg-[#202020] rounded">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showPieceDims}
                        onChange={(e) => setShowPieceDims(e.target.checked)}
                        className="rounded text-[#f0a144] focus:ring-0 w-3.5 h-3.5 bg-[#2a2a2a] border-[#444]"
                      />
                      <span className="text-white text-[10.5px]">Medidas piezas (Largo × Ancho)</span>
                    </div>
                    <span className="text-[#f0a144] font-mono text-[9px] font-bold">979×784</span>
                  </label>

                  {/* Piece Names */}
                  <label className="flex items-center justify-between cursor-pointer py-0.5 px-1 hover:bg-[#202020] rounded">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showPieceNames}
                        onChange={(e) => setShowPieceNames(e.target.checked)}
                        className="rounded text-[#f0a144] focus:ring-0 w-3.5 h-3.5 bg-[#2a2a2a] border-[#444]"
                      />
                      <span className="text-white text-[10.5px]">Nombres / Etiquetas de piezas</span>
                    </div>
                    <span className="text-[#aaa] font-mono text-[9px]">LATERAL</span>
                  </label>

                  {/* Cut Index Sequence */}
                  <label className="flex items-center justify-between cursor-pointer py-0.5 px-1 hover:bg-[#202020] rounded">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showCutIndex}
                        onChange={(e) => setShowCutIndex(e.target.checked)}
                        className="rounded text-[#f0a144] focus:ring-0 w-3.5 h-3.5 bg-[#2a2a2a] border-[#444]"
                      />
                      <span className="text-white text-[10.5px]">Secuencia de corte ①, ②, ③</span>
                    </div>
                    <span className="text-amber-400 font-bold text-[10px]">①</span>
                  </label>

                  {/* Edgebanding Colors */}
                  <label className="flex items-center justify-between cursor-pointer py-0.5 px-1 hover:bg-[#202020] rounded">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showEdgebanding}
                        onChange={(e) => setShowEdgebanding(e.target.checked)}
                        className="rounded text-[#f0a144] focus:ring-0 w-3.5 h-3.5 bg-[#2a2a2a] border-[#444]"
                      />
                      <span className="text-white text-[10.5px]">Bandas de Cantos en Color</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono text-[8px] font-bold">
                      <span className="text-blue-400">Azul</span>
                      <span className="text-red-400">Rojo</span>
                    </div>
                  </label>

                  {/* Waste Dimensions */}
                  <label className="flex items-center justify-between cursor-pointer py-0.5 px-1 hover:bg-[#202020] rounded">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showWasteDims}
                        onChange={(e) => setShowWasteDims(e.target.checked)}
                        className="rounded text-[#f0a144] focus:ring-0 w-3.5 h-3.5 bg-[#2a2a2a] border-[#444]"
                      />
                      <span className="text-white text-[10.5px]">Medidas en sobrantes / retazos</span>
                    </div>
                    <span className="text-rose-400 font-mono text-[9px]">Sobrante</span>
                  </label>

                  {/* Checklist Sheet */}
                  <label className="flex items-center justify-between cursor-pointer py-0.5 px-1 hover:bg-[#202020] rounded">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showPieceChecklist}
                        onChange={(e) => setShowPieceChecklist(e.target.checked)}
                        className="rounded text-[#f0a144] focus:ring-0 w-3.5 h-3.5 bg-[#2a2a2a] border-[#444]"
                      />
                      <span className="text-white text-[10.5px]">Hoja adicional Checklist [ ✓ ]</span>
                    </div>
                    <span className="text-emerald-400 font-mono text-[9px] font-bold">Taller</span>
                  </label>
                </div>
              </div>

              {/* Typography Size Scale */}
              <div>
                <span className="text-[9.5px] font-mono text-[#aaa] uppercase font-bold block mb-1">
                  Tamaño de Letras y Medidas
                </span>
                <div className="grid grid-cols-3 gap-1">
                  {(['standard', 'large', 'extralarge'] as const).map(scale => (
                    <button
                      key={scale}
                      type="button"
                      onClick={() => setFontSizeScale(scale)}
                      className={`py-1 rounded text-[9.5px] font-mono font-bold uppercase border transition-colors ${fontSizeScale === scale ? 'bg-[#f0a144] text-black border-[#f0a144]' : 'bg-[#242424] text-[#888] border-[#333] hover:text-white'}`}
                    >
                      {scale === 'standard' ? 'Normal' : scale === 'large' ? 'Grande' : 'Gigante'}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            {/* STICKY ACTION FOOTER - ALWAYS VISIBLE, NEVER CUT OFF, ZERO SCROLLING NEEDED */}
            <div className="p-3 bg-[#131313] border-t border-[#2e2e2e] shrink-0 space-y-2 shadow-2xl z-20">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGenerating}
                className="w-full bg-[#f0a144] hover:bg-[#ffb055] text-black font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition-all shadow-xl hover:shadow-[#f0a144]/20 active:scale-[0.98]"
              >
                <Download className="w-4 h-4" />
                {isGenerating ? 'Generando PDF...' : 'Descargar Archivo PDF (.pdf)'}
              </button>

              <button
                type="button"
                onClick={handleNativePrint}
                className="w-full bg-[#222222] hover:bg-[#2a2a2a] text-white border border-[#3a3a3a] font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-[11px] transition-colors"
              >
                <Printer className="w-3.5 h-3.5 text-[#aaa]" />
                Imprimir / Guardar en Navegador (Ctrl+P)
              </button>
            </div>
          </div>

          {/* Right Live Preview: Virtual Paper Sheet */}
          <div className={`flex-1 bg-[#0f0f0f] flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-auto relative min-h-0 ${
            mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
          }`}>
            
            {/* Top Bar for Preview */}
            <div className="w-full max-w-3xl flex items-center justify-between pb-3 text-xs text-[#aaa]">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[#f0a144] font-bold text-[11px]">
                  VISTA PREVIA DE HOJA {previewPageIndex + 1} DE {exportBoards.length}
                </span>
                <span className="text-[#555]">•</span>
                <span className="text-[10.5px]">
                  {orientation === 'landscape' ? 'Horizontal (Apaisado)' : 'Vertical'} • {paperSize.toUpperCase()}
                </span>
              </div>

              {exportBoards.length > 1 && (
                <div className="flex items-center gap-1 bg-[#1c1c1c] border border-[#333] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setPreviewPageIndex(p => Math.max(0, p - 1))}
                    disabled={previewPageIndex === 0}
                    className="p-1 hover:bg-[#282828] disabled:opacity-30 rounded text-white"
                    title="Plancha anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-mono text-[10px] px-2 text-white font-bold">
                    {previewPageIndex + 1} / {exportBoards.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewPageIndex(p => Math.min(exportBoards.length - 1, p + 1))}
                    disabled={previewPageIndex === exportBoards.length - 1}
                    className="p-1 hover:bg-[#282828] disabled:opacity-30 rounded text-white"
                    title="Plancha siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Virtual Paper Container */}
            <div 
              className={`bg-white text-black shadow-2xl rounded-sm border border-neutral-400 transition-all flex flex-col justify-between overflow-hidden relative select-none ${
                orientation === 'landscape' ? 'w-full max-w-3xl aspect-[297/210]' : 'w-full max-w-lg aspect-[210/297]'
              } ${sheetOccupancy === 'maximized' ? 'p-2 sm:p-3' : 'p-4 sm:p-6'}`}
            >
              {currentPreview ? (
                <>
                  {/* Sheet Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-black/20 text-[9px] sm:text-[10px] font-mono leading-tight shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#f0a144] text-black font-black px-1.5 py-0.5 rounded text-[9px]">
                        PLANCHA {currentPreview.globalIndex} / {currentPreview.totalBoards}
                      </span>
                      <span className="font-bold text-black uppercase">
                        {currentPreview.displayName || (currentPreview.groupThickness === 3 ? 'MDF 3mm' : `Melamina ${currentPreview.groupThickness}mm`)}
                      </span>
                      <span className="text-[#555]">
                        ({currentPreview.config.width} × {currentPreview.config.height} mm)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[9px] text-[#444] shrink-0 font-medium">
                      <span>Piezas: <strong>{currentPreview.board.rects.length}</strong></span>
                      <span>|</span>
                      <span>Aprov: <strong className="text-emerald-600">{currentPreview.board.stats.efficiency.toFixed(1)}%</strong></span>
                      <span>|</span>
                      <span>Desecho: <strong className="text-rose-600">{(100 - currentPreview.board.stats.efficiency).toFixed(1)}%</strong></span>
                    </div>
                  </div>

                  {/* Main Board Graphic SVG - Dynamically fills all remaining space */}
                  <div className="w-full flex-1 min-h-0 flex items-center justify-center relative overflow-hidden py-0.5">
                    <svg
                      viewBox={`0 0 ${currentPreview.config.width} ${currentPreview.config.height}`}
                      className="w-full h-full max-h-full border border-black bg-white shadow-xs"
                      style={{ transformOrigin: 'center center' }}
                    >
                      {/* Perimeter Sheet Outline */}
                      <rect
                        x={0}
                        y={0}
                        width={currentPreview.config.width}
                        height={currentPreview.config.height}
                        fill="none"
                        stroke="#000000"
                        strokeWidth={4}
                      />

                      {/* Waste Rectangles */}
                      {currentPreview.board.wasteRects.map((w, wIdx) => (
                        <g key={wIdx}>
                          <rect
                            x={w.x}
                            y={w.y}
                            width={w.w}
                            height={w.h}
                            fill="#fee2e2"
                            stroke="#f87171"
                            strokeWidth={2}
                          />
                          {showWasteDims && w.w > 120 && w.h > 80 && (
                            <text
                              x={w.x + w.w / 2}
                              y={w.y + w.h / 2}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="#dc2626"
                              fontSize={Math.max(26, Math.min(50, w.w * 0.12))}
                              fontWeight="bold"
                              fontFamily="monospace"
                            >
                              {Math.round(w.w)}×{Math.round(w.h)}
                            </text>
                          )}
                        </g>
                      ))}

                      {/* Placed Pieces */}
                      {currentPreview.board.rects.map((r, rIdx) => {
                        const topC = !r.rotated ? r.cantos?.largo1 : r.cantos?.ancho1;
                        const botC = !r.rotated ? r.cantos?.largo2 : r.cantos?.ancho2;
                        const lftC = !r.rotated ? r.cantos?.ancho1 : r.cantos?.largo1;
                        const rgtC = !r.rotated ? r.cantos?.ancho2 : r.cantos?.largo2;

                        const fontMultiplier = fontSizeScale === 'extralarge' ? 1.35 : fontSizeScale === 'large' ? 1.15 : 0.95;
                        const nameSize = Math.max(34, Math.min(74, r.w * 0.13, r.h * 0.22)) * fontMultiplier;
                        const dimSize = Math.max(28, Math.min(54, r.w * 0.09, r.h * 0.16)) * fontMultiplier;

                        return (
                          <g key={rIdx}>
                            {/* Piece Rect */}
                            <rect
                              x={r.x}
                              y={r.y}
                              width={r.w}
                              height={r.h}
                              fill="#ffffff"
                              stroke="#000000"
                              strokeWidth={3}
                            />

                            {/* Colored Edgebanding Lines */}
                            {showEdgebanding && (
                              <g>
                                {topC && topC !== 'Ninguno' && (
                                  <line x1={r.x} y1={r.y} x2={r.x + r.w} y2={r.y} stroke={topC === 'Canto Grueso' ? '#dc2626' : '#2563eb'} strokeWidth={topC === 'Canto Grueso' ? 10 : 6} />
                                )}
                                {botC && botC !== 'Ninguno' && (
                                  <line x1={r.x} y1={r.y + r.h} x2={r.x + r.w} y2={r.y + r.h} stroke={botC === 'Canto Grueso' ? '#dc2626' : '#2563eb'} strokeWidth={botC === 'Canto Grueso' ? 10 : 6} />
                                )}
                                {lftC && lftC !== 'Ninguno' && (
                                  <line x1={r.x} y1={r.y} x2={r.x} y2={r.y + r.h} stroke={lftC === 'Canto Grueso' ? '#dc2626' : '#2563eb'} strokeWidth={lftC === 'Canto Grueso' ? 10 : 6} />
                                )}
                                {rgtC && rgtC !== 'Ninguno' && (
                                  <line x1={r.x + r.w} y1={r.y} x2={r.x + r.w} y2={r.y + r.h} stroke={rgtC === 'Canto Grueso' ? '#dc2626' : '#2563eb'} strokeWidth={rgtC === 'Canto Grueso' ? 10 : 6} />
                                )}
                              </g>
                            )}

                            {/* Cut Index */}
                            {showCutIndex && (
                              <g>
                                <circle
                                  cx={r.x + Math.max(26, dimSize * 0.8)}
                                  cy={r.y + Math.max(26, dimSize * 0.8)}
                                  r={Math.max(18, dimSize * 0.55)}
                                  fill="#f0a144"
                                  stroke="#000"
                                  strokeWidth={2}
                                />
                                <text
                                  x={r.x + Math.max(26, dimSize * 0.8)}
                                  y={r.y + Math.max(26, dimSize * 0.8) + (dimSize * 0.2)}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fill="#000"
                                  fontSize={Math.max(16, dimSize * 0.55)}
                                  fontWeight="bold"
                                  fontFamily="monospace"
                                >
                                  {r.cutIndex}
                                </text>
                              </g>
                            )}

                            {/* Piece Name */}
                            {showPieceNames && r.w > 70 && r.h > 45 && (
                              <text
                                x={r.x + r.w / 2}
                                y={showPieceDims ? (r.y + r.h / 2) - (dimSize * 0.35) : r.y + r.h / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#000000"
                                fontSize={nameSize}
                                fontWeight="900"
                                fontFamily="sans-serif"
                              >
                                {r.name}
                              </text>
                            )}

                            {/* Piece Dimensions */}
                            {showPieceDims && r.w > 80 && r.h > 50 && (
                              <text
                                x={r.x + r.w / 2}
                                y={showPieceNames ? (r.y + r.h / 2) + (dimSize * 0.75) : r.y + r.h / 2}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#111111"
                                fontSize={dimSize}
                                fontWeight="bold"
                                fontFamily="monospace"
                              >
                                {Math.round(r.w)} × {Math.round(r.h)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Integrated Pieces Table (when layoutMode === 'single_sheet') */}
                  {layoutMode === 'single_sheet' && (
                    <div className="shrink-0 w-full max-h-[42%] border border-neutral-300 rounded-xs bg-white flex flex-col overflow-hidden text-[7px] sm:text-[7.5px] mt-1 shadow-2xs">
                      {/* Table Title Bar */}
                      <div className="bg-neutral-100 px-2 py-0.5 border-b border-neutral-200 flex items-center justify-between font-bold text-neutral-800 shrink-0">
                        <span className="flex items-center gap-1 truncate">
                          <CheckSquare className="w-2.5 h-2.5 text-[#f0a144] shrink-0" />
                          TABLA DE CORTE Y VERIFICACIÓN [ ✓ ] — PLANCHA {currentPreview.globalIndex} {
                            unifyIdenticalPieces && previewGroupedItems.length < currentPreview.board.rects.length
                              ? `(${previewGroupedItems.length} tipos de pieza • ${currentPreview.board.rects.length} piezas totales)`
                              : `(${currentPreview.board.rects.length} piezas)`
                          }
                        </span>
                        <span className="font-mono text-[6.5px] sm:text-[7px] text-neutral-600 font-normal shrink-0 ml-2">
                          Tapacanto: D {currentBoardEdges.thin.toFixed(2)}m | G {currentBoardEdges.thick.toFixed(2)}m | Retazo mayor: {currentBoardEdges.maxWaste}
                        </span>
                      </div>

                      {/* Multi-column Table Content */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar flex gap-1 p-0.5">
                        {Array.from({ length: previewCols }).map((_, colIdx) => {
                          const itemsPerCol = Math.ceil(previewGroupedItems.length / previewCols);
                          const subList = previewGroupedItems.slice(colIdx * itemsPerCol, (colIdx + 1) * itemsPerCol);
                          if (subList.length === 0) return null;

                          return (
                            <div key={colIdx} className="flex-1 min-w-0 border border-neutral-200 rounded-2xs overflow-hidden">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="bg-neutral-100 text-neutral-600 border-b border-neutral-200 text-left font-bold text-[6.5px]">
                                    <th className="py-0.5 px-0.5 w-3 text-center">[✓]</th>
                                    <th className="py-0.5 px-0.5 w-5 text-center">Nº</th>
                                    <th className="py-0.5 px-1">Pieza</th>
                                    <th className="py-0.5 px-0.5 text-center w-4">Cant</th>
                                    <th className="py-0.5 px-1">Medidas</th>
                                    <th className="py-0.5 px-1">Cantos</th>
                                    <th className="py-0.5 px-0.5 text-center w-4">Veta</th>
                                    {previewCols === 1 && <th className="py-0.5 px-1 text-neutral-400">Verificación</th>}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200 font-mono">
                                  {subList.map((item, rIdx) => {
                                    const topC = !item.rotated ? item.cantos?.largo1 : item.cantos?.ancho1;
                                    const botC = !item.rotated ? item.cantos?.largo2 : item.cantos?.ancho2;
                                    const lftC = !item.rotated ? item.cantos?.ancho1 : item.cantos?.largo1;
                                    const rgtC = !item.rotated ? item.cantos?.ancho2 : item.cantos?.largo2;
                                    const getAbbr = (v?: string) => v === 'Canto Grueso' ? 'G' : v === 'Canto Delgado' ? 'D' : '—';
                                    const hasEdges = [topC, botC, lftC, rgtC].some(c => c && c !== 'Ninguno');

                                    return (
                                      <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/70'}>
                                        <td className="py-0.5 px-0.5 text-center">
                                          <span className="w-2 h-2 border border-neutral-400 inline-block rounded-2xs" />
                                        </td>
                                        <td className="py-0.5 px-0.5 text-center font-bold text-neutral-800 whitespace-nowrap">
                                          <span className="inline-flex items-center justify-center px-1 py-0.2 rounded-full bg-[#f0a144]/25 text-neutral-900 text-[6px] font-black min-w-[14px]">
                                            {item.indicesStr}
                                          </span>
                                        </td>
                                        <td className="py-0.5 px-1 font-sans font-bold text-neutral-900 truncate max-w-[80px]" title={item.name}>
                                          {item.name}
                                        </td>
                                        <td className="py-0.5 px-0.5 text-center font-bold whitespace-nowrap">
                                          {item.count > 1 ? (
                                            <span className="text-amber-800 bg-amber-100/90 px-1 py-0.2 rounded font-black text-[6.5px]">
                                              x{item.count}
                                            </span>
                                          ) : (
                                            <span className="text-neutral-600 text-[6.5px]">1</span>
                                          )}
                                        </td>
                                        <td className="py-0.5 px-1 font-bold text-neutral-800 whitespace-nowrap">
                                          {Math.round(item.w)}×{Math.round(item.h)}
                                        </td>
                                        <td className="py-0.5 px-1 text-[6px] whitespace-nowrap">
                                          {hasEdges ? (
                                            previewCols <= 2 ? (
                                              <span>L:{getAbbr(topC)}{getAbbr(botC)} A:{getAbbr(lftC)}{getAbbr(rgtC)}</span>
                                            ) : (
                                              <span>{getAbbr(topC)}{getAbbr(botC)}/{getAbbr(lftC)}{getAbbr(rgtC)}</span>
                                            )
                                          ) : (
                                            <span className="text-neutral-400">—</span>
                                          )}
                                        </td>
                                        <td className="py-0.5 px-0.5 text-center text-neutral-500 text-[6px]">
                                          {previewCols <= 2 ? (item.rotated ? 'Rot' : 'Norm') : (item.rotated ? 'R' : 'N')}
                                        </td>
                                        {previewCols === 1 && (
                                          <td className="py-0.5 px-1 text-neutral-300">
                                            _____________
                                          </td>
                                        )}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sheet Footer */}
                  <div className="pt-1.5 border-t border-black/20 flex items-center justify-between text-[8px] sm:text-[9px] font-mono text-[#555] shrink-0">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 bg-blue-600 inline-block rounded-xs" />
                        Canto Delgado (0.45/1mm)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 bg-red-600 inline-block rounded-xs" />
                        Canto Grueso (2/3mm)
                      </span>
                    </div>

                    <div className="font-bold text-black">
                      Aprovechamiento: {sheetOccupancy === 'maximized' ? '95% MAXIMIZADO' : 'Estándar'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-xs text-[#888]">
                  No hay planchas seleccionadas
                </div>
              )}
            </div>

            {/* Hint for Carpenters below virtual paper */}
            <div className="mt-3 flex items-center gap-2 text-[10px] text-[#777] font-mono">
              <Sparkles className="w-3.5 h-3.5 text-[#f0a144]" />
              <span>La plancha ocupa el 95% de la hoja impresa para máxima visibilidad en la máquina escuadradora.</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
