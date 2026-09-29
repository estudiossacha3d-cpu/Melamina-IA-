import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Piece, SheetConfig, EdgeConfig, EdgeThicknessConfig } from '../types';
import { calculatePieceCutDimensions, DEFAULT_EDGE_THICKNESS_CONFIG } from '../lib/edgeCalculations';
import { getPieceMaterialProfile, SubstrateType } from '../lib/materialCalculations';
import { v4 as uuidv4 } from 'uuid';
import { CutPiecesTable } from './CutPiecesTable';
import { StockSheetsTable } from './StockSheetsTable';
import { PdfExportModal } from './PdfExportModal';
import { MaterialSummaryModal } from './MaterialSummaryModal';
import { useDraggableWindow } from '../hooks/useDraggableWindow';
import { 
  Settings, BarChart3, Scissors, Layers, RotateCw, ZoomIn, ZoomOut, 
  Maximize2, Minimize2, LayoutList, Table, Rows, Grid, Search, ChevronUp, ChevronDown, 
  Check, Layers3, Sun, Moon, FlipHorizontal, Printer, Download, Eye, EyeOff, Hash, GripHorizontal,
  Box, Trash2, Move, Plus, Minus, PanelLeftClose, PanelLeftOpen, Warehouse, ClipboardList,
  ChevronsRight, GripVertical, ChevronsLeft, X, FileText, Type, Sliders, RotateCcw, Sparkles
} from 'lucide-react';

export interface CadTextCalibration {
  nameScale: number; // 0.5 to 2.2
  dimScale: number; // 0.5 to 2.2
  fontFamily: 'sans' | 'mono' | 'condensed';
  fontWeight: 'normal' | 'bold' | 'extrabold' | 'black';
  letterCase: 'uppercase' | 'original';
  showBadgeBg: boolean;
  dimStyle: 'default' | 'contrast' | 'amber' | 'blue' | 'red';
}

export const DEFAULT_CAD_TEXT_CALIBRATION: CadTextCalibration = {
  nameScale: 1.0,
  dimScale: 1.0,
  fontFamily: 'sans',
  fontWeight: 'extrabold',
  letterCase: 'uppercase',
  showBadgeBg: false,
  dimStyle: 'default'
};

interface CutPlanViewerProps {
  pieces: Piece[];
  sheetConfig: SheetConfig;
  onUpdateSheetConfig: (config: SheetConfig) => void;
  selectedPieceIds: string[];
  toggleSelection: (id: string, multiSelect: boolean) => void;
  updatePiece: (id: string, updates: Partial<Piece>) => void;
  onConsolidatePieces?: () => void;
  setPieces?: React.Dispatch<React.SetStateAction<Piece[]>>;
  edgeThicknessConfig?: EdgeThicknessConfig;
  onUpdateEdgeThicknessConfig?: (config: EdgeThicknessConfig) => void;
  onSwitchTo3D?: () => void;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  id: string;
  name: string;
  rotated: boolean;
  cutIndex: number;
  cantos: EdgeConfig;
  material?: string;
  espesor?: number;
  finalW?: number;
  finalH?: number;
  descuentoLargo?: number;
  descuentoAncho?: number;
  // Material connection attributes
  customColor?: string;
  color?: string;
  textColor?: string;
  isDark?: boolean;
  substrate?: SubstrateType;
  substrateLabel?: string;
  materialName?: string;
  isWood?: boolean;
  isGlass?: boolean;
  isMirror?: boolean;
  hasGrain?: boolean;
  veta?: boolean;
  textureUrl?: string | null;
}

export interface WasteRect {
  x: number;
  y: number;
  w: number;
  h: number;
  isMargin?: boolean;
}

export interface PackedBoard {
  boardIndex: number;
  rects: Rect[];
  wasteRects: WasteRect[];
  stats: {
    efficiency: number;
    areaUsed: number;
    totalArea: number;
  };
}

export interface BoardGroup {
  groupKey: string;
  substrate: SubstrateType;
  substrateLabel: string;
  materialName: string;
  materialColor: string;
  displayName: string;
  code: string;
  thickness: number;
  isWood: boolean;
  isGlass: boolean;
  textureUrl?: string | null;
  boards: PackedBoard[];
  stats: {
    efficiency: number;
    areaUsed: number;
    totalArea: number;
    boardsCount: number;
  };
  config: SheetConfig;
  piecesCount: number;
  edgeThin: number;
  edgeThick: number;
}

// Professional Packing Algorithm: Guillotine with First-Fit Decreasing
function professionalPack(
  pieces: Piece[], 
  config: SheetConfig,
  edgeThicknessConfig: EdgeThicknessConfig = DEFAULT_EDGE_THICKNESS_CONFIG
): { 
  boards: PackedBoard[];
  stats: { efficiency: number; areaUsed: number; totalArea: number; boardsCount: number };
} {
  const { width, height, kerf, margin } = config;
  const usableW = width - (margin * 2);
  const usableH = height - (margin * 2);

  // Flatten pieces based on quantity, applying edge thickness deductions for corte
  const flatPieces: { 
    w: number; 
    h: number; 
    id: string; 
    name: string; 
    veta: boolean; 
    rotacion: boolean;
    cantos: EdgeConfig; 
    material?: string; 
    espesor?: number;
    finalW: number;
    finalH: number;
    descuentoLargo: number;
    descuentoAncho: number;
    customColor?: string;
    color?: string;
    textColor?: string;
    isDark?: boolean;
    substrate?: SubstrateType;
    substrateLabel?: string;
    materialName?: string;
    isWood?: boolean;
    isGlass?: boolean;
    isMirror?: boolean;
    hasGrain?: boolean;
    textureUrl?: string | null;
  }[] = [];

  pieces.forEach(p => {
    const cutDim = calculatePieceCutDimensions(p, edgeThicknessConfig);
    const profile = getPieceMaterialProfile(p);
    // Rotación permitida: solo si NO tiene veta física y rotación está autorizada (desactivada por defecto)
    const canRotate = !p.veta && p.rotacion === true;
    for (let i = 0; i < p.cantidad; i++) {
      flatPieces.push({ 
        w: cutDim.largoCorte, 
        h: cutDim.anchoCorte, 
        id: p.id, 
        name: p.name,
        veta: !!p.veta,
        rotacion: canRotate,
        cantos: p.cantos || { largo1: 'Ninguno', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
        material: p.material || 'MELAMINA',
        espesor: p.espesor || 18,
        finalW: p.largo,
        finalH: p.ancho,
        descuentoLargo: cutDim.descuentoLargoTotal,
        descuentoAncho: cutDim.descuentoAnchoTotal,
        customColor: p.customColor,
        color: profile.color,
        textColor: profile.textColor,
        isDark: profile.isDark,
        substrate: profile.substrate,
        substrateLabel: profile.substrateLabel,
        materialName: profile.materialName,
        isWood: profile.isWood,
        isGlass: profile.isGlass,
        isMirror: profile.isMirror,
        hasGrain: profile.hasGrain,
        textureUrl: profile.textureUrl
      });
    }
  });

  // Sort by area decreasing
  flatPieces.sort((a, b) => (b.w * b.h) - (a.w * a.h));

  const boards: PackedBoard[] = [];
  let areaUsed = 0;

  const currentPieces = [...flatPieces];

  while (currentPieces.length > 0) {
    const boardRects: Rect[] = [];
    const spaces: { x: number; y: number; w: number; h: number }[] = [
      { x: margin, y: margin, w: usableW, h: usableH }
    ];

    for (let i = 0; i < currentPieces.length; i++) {
      const item = currentPieces[i];
      let bestSpaceIdx = -1;
      let bestRotated = false;
      let bestShortSide = Infinity;
      let bestLongSide = Infinity;

      // Best Short Side Fit (BSSF) guillotine search:
      // Evaluates both normal and rotated fit if item.rotacion is true.
      // If item.rotacion is false, strictly locks normal orientation.
      for (let j = 0; j < spaces.length; j++) {
        const s = spaces[j];

        // Normal fit (orientation as listed in table)
        if (item.w <= s.w && item.h <= s.h) {
          const leftoverShort = Math.min(s.w - item.w, s.h - item.h);
          const leftoverLong = Math.max(s.w - item.w, s.h - item.h);
          if (leftoverShort < bestShortSide || (leftoverShort === bestShortSide && leftoverLong < bestLongSide)) {
            bestShortSide = leftoverShort;
            bestLongSide = leftoverLong;
            bestSpaceIdx = j;
            bestRotated = false;
          }
        }

        // Rotated fit (90° rotation - ONLY permitted if item.rotacion is true)
        if (item.rotacion && item.h <= s.w && item.w <= s.h) {
          const leftoverShort = Math.min(s.w - item.h, s.h - item.w);
          const leftoverLong = Math.max(s.w - item.h, s.h - item.w);
          if (leftoverShort < bestShortSide || (leftoverShort === bestShortSide && leftoverLong < bestLongSide)) {
            bestShortSide = leftoverShort;
            bestLongSide = leftoverLong;
            bestSpaceIdx = j;
            bestRotated = true;
          }
        }
      }

      const spaceIdx = bestSpaceIdx;
      const rotated = bestRotated;

      if (spaceIdx !== -1) {
        const space = spaces[spaceIdx];
        const pw = rotated ? item.h : item.w;
        const ph = rotated ? item.w : item.h;

        boardRects.push({
          x: space.x,
          y: space.y,
          w: pw,
          h: ph,
          id: item.id,
          name: item.name,
          rotated,
          cutIndex: boardRects.length + 1,
          cantos: item.cantos,
          material: item.material,
          espesor: item.espesor,
          finalW: rotated ? item.finalH : item.finalW,
          finalH: rotated ? item.finalW : item.finalH,
          descuentoLargo: item.descuentoLargo,
          descuentoAncho: item.descuentoAncho,
          customColor: item.customColor,
          color: item.color,
          textColor: item.textColor,
          isDark: item.isDark,
          substrate: item.substrate,
          substrateLabel: item.substrateLabel,
          materialName: item.materialName,
          isWood: item.isWood,
          isGlass: item.isGlass,
          isMirror: item.isMirror,
          hasGrain: item.hasGrain,
          veta: item.veta,
          textureUrl: item.textureUrl
        });

        areaUsed += pw * ph;

        // Split space (Guillotine cut)
        const remainingW = space.w - pw - kerf;
        const remainingH = space.h - ph - kerf;

        spaces.splice(spaceIdx, 1);

        if (remainingW > 0 && ph > 0) {
          spaces.push({ x: space.x + pw + kerf, y: space.y, w: remainingW, h: ph });
        }
        if (remainingH > 0 && space.w > 0) {
          spaces.push({ x: space.x, y: space.y + ph + kerf, w: space.w, h: remainingH });
        }

        spaces.sort((a, b) => (a.y === b.y) ? a.x - b.x : a.y - b.y);

        currentPieces.splice(i, 1);
        i--;
      }
    }

    if (boardRects.length === 0 && currentPieces.length > 0) {
      currentPieces.shift();
      continue;
    }

    // Collect remaining unallocated spaces as waste (desechos)
    const wasteRects: WasteRect[] = [];
    if (margin > 0) {
      wasteRects.push({ x: 0, y: 0, w: width, h: margin, isMargin: true });
      wasteRects.push({ x: 0, y: height - margin, w: width, h: margin, isMargin: true });
      wasteRects.push({ x: 0, y: margin, w: margin, h: height - (margin * 2), isMargin: true });
      wasteRects.push({ x: width - margin, y: margin, w: margin, h: height - (margin * 2), isMargin: true });
    }

    spaces.forEach(s => {
      if (s.w > 2 && s.h > 2) {
        wasteRects.push({ x: s.x, y: s.y, w: s.w, h: s.h, isMargin: false });
      }
    });

    const boardAreaUsed = boardRects.reduce((acc, r) => acc + (r.w * r.h), 0);
    const boardTotalArea = width * height;
    const boardEfficiency = boardTotalArea > 0 ? (boardAreaUsed / boardTotalArea) * 100 : 0;

    boards.push({
      boardIndex: boards.length + 1,
      rects: boardRects,
      wasteRects,
      stats: {
        efficiency: boardEfficiency,
        areaUsed: boardAreaUsed,
        totalArea: boardTotalArea
      }
    });
  }

  const totalArea = boards.length * width * height;
  const efficiency = totalArea > 0 ? (areaUsed / totalArea) * 100 : 0;

  return { 
    boards, 
    stats: { 
      efficiency, 
      areaUsed, 
      totalArea, 
      boardsCount: boards.length 
    } 
  };
}

export default function CutPlanViewer({ 
  pieces, 
  sheetConfig, 
  onUpdateSheetConfig, 
  selectedPieceIds, 
  toggleSelection, 
  updatePiece, 
  onConsolidatePieces,
  setPieces,
  edgeThicknessConfig = DEFAULT_EDGE_THICKNESS_CONFIG,
  onUpdateEdgeThicknessConfig,
  onSwitchTo3D
}: CutPlanViewerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [wheelMode, setWheelMode] = useState<'scroll' | 'zoom'>('scroll');
  const [showZoomHint, setShowZoomHint] = useState<boolean>(false);
  const zoomHintTimeoutRef = useRef<any>(null);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; originX: number; originY: number }>({ x: 0, y: 0, originX: 0, originY: 0 });
  const [hoveredPieceId, setHoveredPieceId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const [layoutMode, setLayoutMode] = useState<'vertical' | 'grid' | 'horizontal'>('vertical');
  const [selectedBoardFilter, setSelectedBoardFilter] = useState<number | 'all'>('all');
  const [pieceViewMode, setPieceViewMode] = useState<'table' | 'cards'>('table');
  const [pieceSearch, setPieceSearch] = useState('');
  const [pieceListExpanded, setPieceListExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<'demanda' | 'almacen' | 'boards'>('boards');

  // Quantity to rotate map state per piece row
  const [rotateQtyMap, setRotateQtyMap] = useState<Record<string, number>>({});

  // Floating Draggable & Resizable Windows (Demanda & Almacén)
  const [showDemanda, setShowDemanda] = useState<boolean>(false);
  const [showAlmacen, setShowAlmacen] = useState<boolean>(false);

  const {
    position: almacenPos,
    size: almacenSize,
    dragProps: almacenDragProps,
    resizeCornerProps: almacenResizeCornerProps,
    resizeRightProps: almacenResizeRightProps,
    resizeBottomProps: almacenResizeBottomProps
  } = useDraggableWindow({
    storageKey: 'iamueble_cut_almacen_win',
    defaultPosition: () => ({
      x: typeof window !== 'undefined' ? (window.innerWidth < 640 ? 10 : 30) : 20,
      y: 50
    }),
    defaultSize: () => ({
      width: typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 380,
      height: typeof window !== 'undefined' && window.innerWidth < 640 ? 250 : 320
    }),
    minWidth: 240,
    minHeight: 140
  });

  const {
    position: demandaPos,
    size: demandaSize,
    dragProps: demandaDragProps,
    resizeCornerProps: demandaResizeCornerProps,
    resizeRightProps: demandaResizeRightProps,
    resizeBottomProps: demandaResizeBottomProps
  } = useDraggableWindow({
    storageKey: 'iamueble_cut_demanda_win',
    defaultPosition: () => ({
      x: typeof window !== 'undefined' ? (window.innerWidth < 640 ? 10 : 50) : 30,
      y: 65
    }),
    defaultSize: () => ({
      width: typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 420,
      height: typeof window !== 'undefined' && window.innerWidth < 640 ? 280 : 360
    }),
    minWidth: 240,
    minHeight: 150
  });

  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const [showPdfExport, setShowPdfExport] = useState<boolean>(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Display Toggles matching Cutting Optimization Pro
  const [showPieceDims, setShowPieceDims] = useState(true);
  const [showWasteDims, setShowWasteDims] = useState(true);
  const [showPieceNames, setShowPieceNames] = useState(true);
  const [showEdgebandLines, setShowEdgebandLines] = useState(true); // Red/Blue borders
  const [showCutIndex, setShowCutIndex] = useState(false); // Cut order numbers
  const [showSheetRulers, setShowSheetRulers] = useState(true); // Outer sheet dimension lines (2420, 2120)
  const [cadTheme, setCadTheme] = useState<'light' | 'dark'>('light'); // Default light CAD style matching software screenshot
  const [isMirrored, setIsMirrored] = useState(false);
  const [useRealMaterialColors, setUseRealMaterialColors] = useState<boolean>(true);
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string>('all');
  const [showMaterialSummaryModal, setShowMaterialSummaryModal] = useState<boolean>(false);

  // Calibration for 2D graphics letters & numbers
  const [cadTextConfig, setCadTextConfig] = useState<CadTextCalibration>(() => {
    try {
      const saved = localStorage.getItem('carpinteria_cad_text_calibration');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CAD_TEXT_CALIBRATION;
  });

  const updateCadTextConfig = (updates: Partial<CadTextCalibration>) => {
    setCadTextConfig(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem('carpinteria_cad_text_calibration', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [activeSettingsTab, setActiveSettingsTab] = useState<'sheet' | 'typography' | 'stats'>('sheet');

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Wheel Scroll & Zoom Listener on 2D graphics canvas (separates scrolling from zooming)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea, [data-no-canvas-zoom="true"]')) return;

      const isZoomTrigger = wheelMode === 'zoom' || e.ctrlKey || e.metaKey || e.altKey;

      if (isZoomTrigger) {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
        setZoom(prev => Math.max(0.25, Math.min(4.0, Number((prev * zoomFactor).toFixed(2)))));
      } else {
        // Normal scroll: do NOT call e.preventDefault(), allow native container scrolling!
        setShowZoomHint(true);
        if (zoomHintTimeoutRef.current) clearTimeout(zoomHintTimeoutRef.current);
        zoomHintTimeoutRef.current = setTimeout(() => {
          setShowZoomHint(false);
        }, 1800);
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      if (zoomHintTimeoutRef.current) clearTimeout(zoomHintTimeoutRef.current);
    };
  }, [wheelMode]);

  // Touch Pinch-to-zoom (2 fingers) and 1-finger scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialPinchDist: number | null = null;
    let initialPinchZoom = 1;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // 2 fingers detected: pinch-to-zoom
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        initialPinchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        initialPinchZoom = zoom;
      } else {
        initialPinchDist = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDist !== null && initialPinchDist > 0) {
        // Prevent default browser pinch
        e.preventDefault();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const currentDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
        const factor = currentDist / initialPinchDist;
        const newZoom = Math.max(0.25, Math.min(4.0, Number((initialPinchZoom * factor).toFixed(2))));
        setZoom(newZoom);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialPinchDist = null;
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoom]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select, a, [data-piece-rect="true"]')) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: pan.x,
      originY: pan.y
    };
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({
      x: panStartRef.current.originX + dx,
      y: panStartRef.current.originY + dy
    });
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
  };
  
  const { boardGroups, totalStats } = useMemo(() => {
    // Group pieces by material profile (substrate + material + thickness)
    const groupsMap: Record<string, {
      profile: ReturnType<typeof getPieceMaterialProfile>;
      pieces: Piece[];
    }> = {};

    pieces.forEach(p => {
      const profile = getPieceMaterialProfile(p);
      if (!groupsMap[profile.groupKey]) {
        groupsMap[profile.groupKey] = {
          profile,
          pieces: []
        };
      }
      groupsMap[profile.groupKey].pieces.push(p);
    });

    const results: BoardGroup[] = [];
    let combinedAreaUsed = 0;
    let combinedTotalArea = 0;
    let combinedBoardsCount = 0;

    Object.values(groupsMap).forEach(({ profile, pieces: groupPieces }) => {
      let groupConfig = { ...sheetConfig };
      if (profile.substrate === 'mdf' && profile.thickness === 3) {
        groupConfig = { ...sheetConfig, width: 2440, height: 1850 };
      } else if (profile.substrate === 'vidrio') {
        groupConfig = { ...sheetConfig, width: 2500, height: 1800, margin: 10, kerf: 3 };
      }

      const packed = professionalPack(groupPieces, groupConfig, edgeThicknessConfig);

      let edgeThin = 0;
      let edgeThick = 0;
      let piecesCount = 0;

      groupPieces.forEach(p => {
        const qty = p.cantidad;
        piecesCount += qty;
        if (!p.cantos || profile.substrate === 'vidrio') return;
        const edges = [
          { type: p.cantos.largo1, length: p.largo },
          { type: p.cantos.largo2, length: p.largo },
          { type: p.cantos.ancho1, length: p.ancho },
          { type: p.cantos.ancho2, length: p.ancho }
        ];
        edges.forEach(e => {
          if (e.type === 'Canto Delgado') edgeThin += e.length * qty;
          else if (e.type === 'Canto Grueso') edgeThick += e.length * qty;
        });
      });

      results.push({
        groupKey: profile.groupKey,
        substrate: profile.substrate,
        substrateLabel: profile.substrateLabel,
        materialName: profile.materialName,
        materialColor: profile.color,
        displayName: profile.displayName,
        code: profile.code,
        thickness: profile.thickness,
        isWood: profile.isWood,
        isGlass: profile.isGlass,
        textureUrl: profile.textureUrl,
        boards: packed.boards,
        stats: packed.stats,
        config: groupConfig,
        piecesCount,
        edgeThin: edgeThin / 1000,
        edgeThick: edgeThick / 1000
      });

      combinedAreaUsed += packed.stats.areaUsed;
      combinedTotalArea += packed.stats.totalArea;
      combinedBoardsCount += packed.stats.boardsCount;
    });

    const efficiency = combinedTotalArea > 0 ? (combinedAreaUsed / combinedTotalArea) * 100 : 0;

    return { 
      boardGroups: results, 
      totalStats: {
        efficiency,
        areaUsed: combinedAreaUsed,
        totalArea: combinedTotalArea,
        boardsCount: combinedBoardsCount
      }
    };
  }, [pieces, sheetConfig, edgeThicknessConfig]);

  const edgebandingTotals = useMemo(() => {
    let thin = 0;
    let thick = 0;
    
    pieces.forEach(p => {
      const qty = p.cantidad;
      const { largo, ancho, cantos } = p;
      if (!cantos) return;
      
      const edges = [
        { type: cantos.largo1, length: largo },
        { type: cantos.largo2, length: largo },
        { type: cantos.ancho1, length: ancho },
        { type: cantos.ancho2, length: ancho }
      ];

      edges.forEach(e => {
        if (e.type === 'Canto Delgado') thin += e.length * qty;
        else if (e.type === 'Canto Grueso') thick += e.length * qty;
      });
    });

    return {
      thin: (thin / 1000).toFixed(2),
      thick: (thick / 1000).toFixed(2)
    };
  }, [pieces]);

  // Flatten all boards across all material groups into a unified list with global 1-based indexing
  const flatBoardsList = useMemo(() => {
    const list: Array<{
      globalIndex: number; // 0-based: 0, 1, 2...
      boardNumber: number; // 1-based: 1, 2, 3...
      group: BoardGroup;
      board: PackedBoard;
      boardIndexInGroup: number;
    }> = [];

    let count = 0;
    boardGroups.forEach(group => {
      group.boards.forEach((board, bIdxInGroup) => {
        count++;
        list.push({
          globalIndex: count - 1,
          boardNumber: count,
          group,
          board,
          boardIndexInGroup: bIdxInGroup
        });
      });
    });
    return list;
  }, [boardGroups]);

  // Current boards to render in the 2D CAD canvas
  const boardsToRender = useMemo(() => {
    if (selectedBoardFilter === 'all') {
      return flatBoardsList;
    }
    return flatBoardsList.filter(b => b.globalIndex === selectedBoardFilter);
  }, [flatBoardsList, selectedBoardFilter]);

  const activeBoardItem = useMemo(() => {
    if (selectedBoardFilter === 'all') return null;
    return flatBoardsList.find(b => b.globalIndex === selectedBoardFilter) || null;
  }, [flatBoardsList, selectedBoardFilter]);

  // Reset selected board filter if the index exceeds available boards count
  useEffect(() => {
    if (selectedBoardFilter !== 'all' && typeof selectedBoardFilter === 'number' && selectedBoardFilter >= flatBoardsList.length) {
      setSelectedBoardFilter('all');
    }
  }, [flatBoardsList.length, selectedBoardFilter]);

  const [viewScale, setViewScale] = useState(0.40);

  const calculateOptimalScale = () => {
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const isMobile = window.innerWidth < 640;
      const paddingW = isMobile ? 12 : 32;
      const paddingH = isMobile ? 16 : 40;
      
      const targetW = activeBoardItem ? activeBoardItem.group.config.width : sheetConfig.width;
      const targetH = activeBoardItem ? activeBoardItem.group.config.height : sheetConfig.height;

      const scaleW = (cw - paddingW) / targetW;
      const scaleH = (ch - paddingH) / targetH;
      
      let scale = selectedBoardFilter !== 'all'
        ? Math.min(scaleW * 0.95, scaleH * 0.88)
        : Math.min(scaleW * 0.95, isMobile ? 0.50 : 0.85);

      if (isMobile) {
        scale = Math.max(scaleW * 0.96, 0.15);
      }

      return scale > 0 ? scale : 0.40;
    }
    return 0.40;
  };

  useEffect(() => {
    const scale = calculateOptimalScale();
    setViewScale(scale);
  }, [sheetConfig.width, sheetConfig.height, selectedBoardFilter, activeBoardItem]);

  // Fit to Screen centering handler
  const handleFitToScreen = () => {
    if (containerRef.current) {
      const cw = containerRef.current.clientWidth - 28;
      const ch = containerRef.current.clientHeight - 64;
      const targetScale = Math.min(cw / sheetConfig.width, ch / sheetConfig.height);
      if (targetScale > 0 && viewScale > 0) {
        const optimalZoom = targetScale / viewScale;
        setZoom(Math.max(0.4, Math.min(3.0, Number(optimalZoom.toFixed(2)))));
      } else {
        setZoom(1);
      }
      setPan({ x: 0, y: 0 });
    }
  };

  const groupedPieces = useMemo(() => {
    const groups: {
      key: string;
      ids: string[];
      totalQuantity: number;
      representative: Piece;
    }[] = [];

    pieces.forEach(p => {
      const key = `${Math.round(p.largo)}-${Math.round(p.ancho)}-${p.espesor || 18}-${p.cantos?.largo1}-${p.cantos?.largo2}-${p.cantos?.ancho1}-${p.cantos?.ancho2}-${p.material || ''}-${p.customColor || ''}`;
      const group = groups.find(g => g.key === key);
      if (group) {
        group.ids.push(p.id);
        group.totalQuantity += p.cantidad;
      } else {
        groups.push({
          key,
          ids: [p.id],
          totalQuantity: p.cantidad,
          representative: { ...p }
        });
      }
    });

    return groups;
  }, [pieces]);

  const filteredGroupedPieces = useMemo(() => {
    if (!pieceSearch.trim()) return groupedPieces;
    const term = pieceSearch.toLowerCase();
    return groupedPieces.filter(g => 
      g.representative.name.toLowerCase().includes(term) ||
      g.representative.largo.toString().includes(term) ||
      g.representative.ancho.toString().includes(term) ||
      (g.representative.material || '').toLowerCase().includes(term)
    );
  }, [groupedPieces, pieceSearch]);

  const materialSections = useMemo(() => {
    const map: Record<string, {
      id: string;
      code: string;
      name: string;
      thickness: number;
      groups: typeof filteredGroupedPieces;
      totalPieces: number;
    }> = {};

    filteredGroupedPieces.forEach(group => {
      const p = group.representative;
      const thickness = p.espesor || 18;
      const rawMat = (p.material || 'Blanco').trim();
      const upperMat = rawMat.toUpperCase();

      let prefix = 'BL';
      if (upperMat.includes('ROBLE') || upperMat.includes('WOOD') || upperMat.includes('MADERA') || upperMat.includes('CEDRO') || upperMat.includes('NOGAL')) {
        prefix = 'RO';
      } else if (upperMat.includes('NEGRO') || upperMat.includes('BLACK')) {
        prefix = 'NE';
      } else if (upperMat.includes('GRIS') || upperMat.includes('GREY')) {
        prefix = 'GR';
      } else if (upperMat.includes('DUPROLAC') || upperMat.includes('MDF') || thickness === 3) {
        prefix = 'DUP';
      } else {
        prefix = upperMat.slice(0, 2).replace(/[^A-Z]/g, '') || 'BL';
      }

      const code = `${prefix}${thickness}`;
      const sectionKey = `${code}-${upperMat}`;

      if (!map[sectionKey]) {
        map[sectionKey] = {
          id: sectionKey,
          code,
          name: upperMat,
          thickness,
          groups: [],
          totalPieces: 0
        };
      }
      map[sectionKey].groups.push(group);
      map[sectionKey].totalPieces += group.totalQuantity;
    });

    return Object.values(map);
  }, [filteredGroupedPieces]);

  const currentScale = viewScale * zoom;

  // Handler for updating quantity cleanly across grouped piece records
  const handleQuantityUpdate = (group: { key: string; ids: string[]; totalQuantity: number; representative: Piece }, newQty: number) => {
    const val = Math.max(1, newQty);
    if (setPieces) {
      setPieces(prev => {
        const updated = prev.map(p => {
          if (p.id === group.ids[0]) {
            return { ...p, cantidad: val };
          }
          if (group.ids.slice(1).includes(p.id)) {
            return { ...p, cantidad: 0 };
          }
          return p;
        });
        return updated.filter(p => p.cantidad > 0);
      });
    } else {
      updatePiece(group.ids[0], { cantidad: val });
      group.ids.slice(1).forEach(id => updatePiece(id, { cantidad: 0 }));
    }
  };

  // Handler for rotating a specific count of pieces within a row/group
  const handleRotateGroup = (group: { key: string; ids: string[]; totalQuantity: number; representative: Piece }, qtyToRotate: number) => {
    const total = group.totalQuantity;
    const count = Math.min(Math.max(1, qtyToRotate), total);

    const oldPiece = group.representative;
    const newLargo = oldPiece.ancho;
    const newAncho = oldPiece.largo;
    const newCantos: EdgeConfig = {
      largo1: oldPiece.cantos?.ancho1 || 'Ninguno',
      largo2: oldPiece.cantos?.ancho2 || 'Ninguno',
      ancho1: oldPiece.cantos?.largo1 || 'Ninguno',
      ancho2: oldPiece.cantos?.largo2 || 'Ninguno',
    };

    if (count >= total) {
      // Rotate ALL pieces in this group
      group.ids.forEach(id => {
        updatePiece(id, {
          largo: newLargo,
          ancho: newAncho,
          cantos: newCantos
        });
      });
    } else if (setPieces) {
      setPieces(prev => {
        let remainingToRotate = count;
        const newPiecesList: Piece[] = [];
        const updatedList = prev.map(p => {
          if (!group.ids.includes(p.id) || remainingToRotate <= 0) return p;

          if (p.cantidad <= remainingToRotate) {
            remainingToRotate -= p.cantidad;
            return {
              ...p,
              largo: newLargo,
              ancho: newAncho,
              cantos: newCantos
            };
          } else {
            const countForThis = remainingToRotate;
            remainingToRotate = 0;
            newPiecesList.push({
              ...p,
              id: uuidv4(),
              cantidad: countForThis,
              largo: newLargo,
              ancho: newAncho,
              cantos: newCantos
            });
            return {
              ...p,
              cantidad: p.cantidad - countForThis
            };
          }
        });

        return [...updatedList, ...newPiecesList];
      });
    } else {
      const firstId = group.ids[0];
      const repPiece = pieces.find(p => p.id === firstId);
      if (repPiece) {
        if (repPiece.cantidad <= count) {
          updatePiece(firstId, {
            largo: newLargo,
            ancho: newAncho,
            cantos: newCantos
          });
        } else {
          updatePiece(firstId, { cantidad: repPiece.cantidad - count });
        }
      }
    }
  };

  // Sync scroll to piece in list when selected from graph
  useEffect(() => {
    if (selectedPieceIds.length > 0 && listRef.current) {
      const groupId = groupedPieces.find(g => g.ids.includes(selectedPieceIds[0]))?.key;
      if (groupId) {
        const el = listRef.current.querySelector(`[data-group-key="${groupId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [selectedPieceIds, groupedPieces]);

  // Rotación global: verifica si todas las piezas tienen permitida la rotación a 90° (desactivado por defecto)
  const allPiecesRotatable = pieces.length > 0 && pieces.every(p => !p.veta && p.rotacion === true);
  const handleToggleGlobalRotation = () => {
    const nextVal = !allPiecesRotatable;
    setPieces(prev => prev.map(p => ({
      ...p,
      rotacion: nextVal,
      ...(nextVal ? { veta: false } : {}),
    })));
  };

  if (pieces.length === 0) {
    return (
      <div className="absolute inset-0 bg-[#393939] flex items-center justify-center">
        <div className="text-center group">
          <Layers className="w-12 h-12 text-[#222222] mx-auto mb-4 group-hover:text-[#f0a144]/50 transition-colors" />
          <p className="text-[#888888] font-mono text-sm uppercase tracking-widest">Plano de corte vacío</p>
          <p className="text-[#666666] text-[10px] uppercase mt-2">Añade piezas en el panel lateral para optimizar</p>
        </div>
      </div>
    );
  }

  const isLightCAD = cadTheme === 'light';

  return (
    <div className="absolute inset-0 bg-[#282828] flex flex-col overflow-hidden w-full max-w-full font-sans">
      {/* Top Header */}
      <div className="h-12 sm:h-14 border-b border-[#1e1e1e] bg-[#222222] flex items-center justify-between px-2 sm:px-4 shrink-0 shadow-lg relative z-20 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar py-1 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Scissors className="w-4 h-4 text-[#f0a144]" />
            <h2 className="text-[10px] sm:text-[11px] font-bold text-white uppercase tracking-widest hidden sm:block">Plano de Corte 2D</h2>
          </div>
          
          {/* Mobile Main Switcher (Práctico en Celular) */}
          <div className="flex sm:hidden items-center bg-[#141414] border border-[#383838] p-0.5 rounded-lg shrink-0 shadow-inner">
            <button
              type="button"
              onClick={() => {
                setShowDemanda(!showDemanda);
                if (!showDemanda) setShowAlmacen(false);
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded text-[9.5px] font-bold uppercase transition-all ${showDemanda ? 'bg-[#f0a144] text-black font-black shadow' : 'text-[#aaa] hover:text-white'}`}
            >
              <ClipboardList className="w-3 h-3" />
              <span>Demanda</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAlmacen(!showAlmacen);
                if (!showAlmacen) setShowDemanda(false);
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded text-[9.5px] font-bold uppercase transition-all ${showAlmacen ? 'bg-[#f0a144] text-black font-black shadow' : 'text-[#aaa] hover:text-white'}`}
            >
              <Warehouse className="w-3 h-3" />
              <span>Almacén</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowDemanda(false);
                setShowAlmacen(false);
              }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded text-[9.5px] font-bold uppercase transition-all ${!showDemanda && !showAlmacen ? 'bg-[#f0a144] text-black font-black shadow' : 'text-[#aaa] hover:text-white'}`}
            >
              <Scissors className="w-3 h-3" />
              <span>Plano 2D</span>
            </button>
            {onSwitchTo3D && (
              <button
                type="button"
                onClick={onSwitchTo3D}
                className="flex items-center gap-1 px-2 py-1.5 rounded text-[9.5px] font-bold uppercase text-blue-400 hover:text-white hover:bg-blue-600/30 transition-all ml-0.5"
                title="Ver Gráficos 3D en Celular"
              >
                <Box className="w-3 h-3" />
                <span>3D</span>
              </button>
            )}
          </div>

          {/* Desktop Independent Window Toggles (1 Clic para abrir / replegar) */}
          <div className="hidden sm:flex items-center bg-[#161616] border border-[#333333] p-0.5 rounded-lg shrink-0 gap-0.5">
            <button
              type="button"
              onClick={() => setShowDemanda(!showDemanda)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-colors ${showDemanda ? 'bg-[#f0a144] text-black shadow font-black' : 'text-[#999] hover:text-white'}`}
              title="Abrir o replegar ventana de Demanda hacia el lado izquierdo"
            >
              <ClipboardList className="w-3 h-3" />
              <span>1. Demanda</span>
              {showDemanda && <ChevronsLeft className="w-2.5 h-2.5 opacity-70" />}
            </button>
            <button
              type="button"
              onClick={() => setShowAlmacen(!showAlmacen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-colors ${showAlmacen ? 'bg-[#f0a144] text-black shadow font-black' : 'text-[#999] hover:text-white'}`}
              title="Abrir o replegar ventana de Almacén hacia el lado izquierdo"
            >
              <Warehouse className="w-3 h-3" />
              <span>2. Almacén</span>
              {showAlmacen && <ChevronsLeft className="w-2.5 h-2.5 opacity-70" />}
            </button>
            <button
              type="button"
              onClick={() => {
                if (showDemanda || showAlmacen) {
                  setShowDemanda(false);
                  setShowAlmacen(false);
                } else {
                  setShowDemanda(true);
                }
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-bold uppercase transition-colors ${!showDemanda && !showAlmacen ? 'bg-amber-600/25 text-[#f0a144] border border-[#f0a144]/40 font-bold' : 'text-[#777] hover:text-white'}`}
              title="Replegar ambas ventanas para ver solo el plano de corte 2D / 3D al 100%"
            >
              <LayoutList className="w-3 h-3" />
              <span>{!showDemanda && !showAlmacen ? 'Solo Plano (100%)' : 'Solo Plano'}</span>
            </button>
          </div>

          <div className="hidden sm:block h-4 w-px bg-[#444444] mx-1 shrink-0"></div>

          {/* Quick Metrics Bar */}
          <div className="hidden sm:flex gap-2 sm:gap-4 shrink-0 items-center">
            <div className="flex flex-col">
              <span className="text-[7px] sm:text-[8px] text-[#aaaaaa] uppercase tracking-tighter">Efic. Total</span>
              <span className={`text-[10px] sm:text-xs font-mono font-bold ${totalStats.efficiency > 85 ? 'text-emerald-400' : totalStats.efficiency > 70 ? 'text-[#f0a144]' : 'text-rose-400'}`}>
                {totalStats.efficiency.toFixed(1)}%
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[7px] sm:text-[8px] text-[#aaaaaa] uppercase tracking-tighter">Planchas</span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-white">{totalStats.boardsCount}</span>
            </div>
            <div className="flex flex-col hidden xs:flex">
              <span className="text-[7px] sm:text-[8px] text-[#aaaaaa] uppercase tracking-tighter">Área Útil</span>
              <span className="text-[10px] sm:text-xs font-mono font-bold text-[#cccccc]">{(totalStats.areaUsed / 1000000).toFixed(2)}m²</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded text-[9px] sm:text-[10px] font-bold uppercase transition-all shrink-0 ${showSettings ? 'bg-[#f0a144] text-black shadow-lg font-black' : 'bg-[#181818] border border-[#333333] text-[#aaaaaa] hover:bg-[#333333] hover:text-white'}`}
          >
            <Settings className={`w-3.5 h-3.5 ${showSettings ? 'animate-spin-slow' : ''}`} />
            <span className="hidden sm:inline">Ajustes</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Settings Overlay Backdrop */}
        {showSettings && (
          <div 
            className="absolute inset-0 bg-black/50 z-20 sm:hidden" 
            onClick={() => setShowSettings(false)}
          />
        )}
        
        {/* ========================================================================= */}
        {/* 3-WINDOW WORKFLOW (SIDE-BY-SIDE INTERFACE)                                 */}
        {/* Window 1: DEMANDA (Listado de Despiece)                                    */}
        {/* Window 2: ALMACÉN (Inventario de Planchas & Formatos de Stock)              */}
        {/* Window 3: DIAGRAMA DE CORTE 2D (Plano CAD Interactivo)                     */}
        {/* ========================================================================= */}

        {/* ========================================================================= */}
        {/* VENTANAS FLOTANTES Y ARRASTRABLES: DEMANDA Y ALMACÉN                       */}
        {/* Exactamente como Bandeja y Catálogo: flotantes, arrastrables y redimensionables */}
        {/* ========================================================================= */}

        {/* VENTANA FLOTANTE 1: DEMANDA (Listado de Despiece) */}
        {showDemanda && (
          <div
            className="fixed z-40 pointer-events-auto select-none"
            style={{ left: `${demandaPos.x}px`, top: `${demandaPos.y}px` }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="bg-[#14151a]/95 backdrop-blur-md border border-[#2d313d] rounded-xl sm:rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-gray-200 relative group"
              style={{ width: `${demandaSize.width}px`, height: `${demandaSize.height}px` }}
            >
              {/* Header (Draggable handle) */}
              <div
                className="h-7 sm:h-8 bg-[#101115] border-b border-[#22242e] flex items-center justify-between px-2 sm:px-2.5 shrink-0 select-none cursor-grab active:cursor-grabbing"
                {...demandaDragProps}
                title="Arrastrar ventana de Demanda"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <GripHorizontal className="w-3 h-3 text-gray-500 shrink-0" />
                  <ClipboardList className="w-3.5 h-3.5 text-[#f0a144] shrink-0" />
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-[#e5e5e5] tracking-wider truncate">
                    1. Demanda
                  </span>
                  <span className="bg-[#222] text-[#f0a144] px-1 py-0.2 rounded text-[7px] font-mono shrink-0">
                    {pieces.reduce((a, b) => a + b.cantidad, 0)} pzs
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <div className="relative flex items-center bg-[#1c1c1c] border border-[#2e2e2e] rounded px-1.5 py-0.2">
                    <Search className="w-2.5 h-2.5 text-[#666] mr-1 shrink-0" />
                    <input
                      type="text"
                      value={pieceSearch}
                      onChange={(e) => setPieceSearch(e.target.value)}
                      placeholder="Buscar..."
                      className="bg-transparent border-none outline-none text-[8px] text-white placeholder-[#555] w-12 xs:w-16 py-0.2"
                    />
                  </div>

                  {onConsolidatePieces && (
                    <button
                      type="button"
                      onClick={onConsolidatePieces}
                      className="hidden xs:flex items-center gap-0.5 px-1 py-0.5 bg-[#202020] hover:bg-[#333] text-[#bbb] hover:text-white text-[7px] font-bold uppercase rounded border border-[#303030]"
                      title="Agrupar piezas idénticas"
                    >
                      Agrupar
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowDemanda(false)}
                    className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                    title="Cerrar ventana de Demanda"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div 
                className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0d0e12] [scrollbar-width:thin]"
                ref={listRef}
              >
                <CutPiecesTable
                  pieces={pieces}
                  groupedPieces={filteredGroupedPieces}
                  selectedPieceIds={selectedPieceIds}
                  toggleSelection={toggleSelection}
                  updatePiece={updatePiece}
                  setPieces={setPieces}
                  edgeThicknessConfig={edgeThicknessConfig}
                  hoveredPieceId={hoveredPieceId}
                  setHoveredPieceId={setHoveredPieceId}
                  onSwitchTo3D={onSwitchTo3D}
                />
              </div>

              {/* Border and Corner Resize Handles */}
              <div 
                className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-[#f0a144]/30 z-20 transition-colors"
                {...demandaResizeRightProps}
                title="Arrastrar borde para cambiar ancho"
              />
              <div 
                className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-[#f0a144]/30 z-20 transition-colors"
                {...demandaResizeBottomProps}
                title="Arrastrar borde para cambiar alto"
              />
              <div 
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30 flex items-end justify-end p-0.5 text-gray-400 hover:text-[#f0a144] hover:bg-[#f0a144]/20 rounded-br-xl transition-all"
                {...demandaResizeCornerProps}
                title="Reducir o ampliar tamaño de Demanda"
              >
                <svg className="w-2.5 h-2.5 pointer-events-none" viewBox="0 0 6 6" fill="currentColor">
                  <circle cx="5" cy="5" r="0.75" />
                  <circle cx="5" cy="2.5" r="0.75" />
                  <circle cx="2.5" cy="5" r="0.75" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* VENTANA FLOTANTE 2: ALMACÉN (Inventario de Planchas & Formatos) */}
        {showAlmacen && (
          <div
            className="fixed z-40 pointer-events-auto select-none"
            style={{ left: `${almacenPos.x}px`, top: `${almacenPos.y}px` }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="bg-[#14151a]/95 backdrop-blur-md border border-[#2d313d] rounded-xl sm:rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-gray-200 relative group"
              style={{ width: `${almacenSize.width}px`, height: `${almacenSize.height}px` }}
            >
              {/* Header (Draggable handle) */}
              <div
                className="h-7 sm:h-8 bg-[#101115] border-b border-[#22242e] flex items-center justify-between px-2 sm:px-2.5 shrink-0 select-none cursor-grab active:cursor-grabbing"
                {...almacenDragProps}
                title="Arrastrar ventana de Almacén"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <GripHorizontal className="w-3 h-3 text-gray-500 shrink-0" />
                  <Warehouse className="w-3.5 h-3.5 text-[#f0a144] shrink-0" />
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-[#e5e5e5] tracking-wider truncate">
                    2. Almacén
                  </span>
                  <span className="bg-[#222] text-[#f0a144] px-1 py-0.2 rounded text-[7px] font-mono shrink-0">
                    {totalStats.boardsCount} plancha{totalStats.boardsCount > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAlmacen(false)}
                    className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                    title="Cerrar ventana de Almacén"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#0d0e12] [scrollbar-width:thin]">
                <StockSheetsTable
                  sheetConfig={sheetConfig}
                  onUpdateSheetConfig={onUpdateSheetConfig}
                  boardGroups={boardGroups}
                  totalStats={totalStats}
                />
              </div>

              {/* Border and Corner Resize Handles */}
              <div 
                className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-[#f0a144]/30 z-20 transition-colors"
                {...almacenResizeRightProps}
                title="Arrastrar borde para cambiar ancho"
              />
              <div 
                className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-[#f0a144]/30 z-20 transition-colors"
                {...almacenResizeBottomProps}
                title="Arrastrar borde para cambiar alto"
              />
              <div 
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30 flex items-end justify-end p-0.5 text-gray-400 hover:text-[#f0a144] hover:bg-[#f0a144]/20 rounded-br-xl transition-all"
                {...almacenResizeCornerProps}
                title="Reducir o ampliar tamaño de Almacén"
              >
                <svg className="w-2.5 h-2.5 pointer-events-none" viewBox="0 0 6 6" fill="currentColor">
                  <circle cx="5" cy="5" r="0.75" />
                  <circle cx="5" cy="2.5" r="0.75" />
                  <circle cx="2.5" cy="5" r="0.75" />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* RIGHT MAIN AREA: VENTANA 3 (DIAGRAMA DE CORTE 2D / PLANO CAD)            */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#1e1e1e] relative overflow-hidden">
          {/* BANDEJA SUPERIOR 1: NAVEGACIÓN DE PLANCHAS, DATOS Y ZOOM */}
          <div className="bg-[#181818] border-b border-[#2a2a2a] px-2 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-md z-20">
            {/* Sheet Selector Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar py-0.5">
              <div className="flex items-center gap-1 mr-1 text-[9px] font-bold text-[#888888] uppercase tracking-wider hidden lg:flex">
                <Scissors className="w-3.5 h-3.5 text-[#f0a144]" />
                <span>3. DIAGRAMA:</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBoardFilter('all');
                  setPan({ x: 0, y: 0 });
                }}
                className={`px-2.5 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold uppercase transition-colors shrink-0 cursor-pointer ${selectedBoardFilter === 'all' ? 'bg-[#f0a144] text-black shadow font-black' : 'bg-[#222222] text-[#888888] hover:text-white border border-[#333]'}`}
              >
                Todas ({flatBoardsList.length})
              </button>
              {flatBoardsList.map((item) => (
                <button
                  key={item.globalIndex}
                  type="button"
                  onClick={() => {
                    setSelectedBoardFilter(item.globalIndex);
                    setPan({ x: 0, y: 0 });
                  }}
                  className={`px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-mono font-bold uppercase transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${selectedBoardFilter === item.globalIndex ? 'bg-[#f0a144] text-black shadow font-black' : 'bg-[#222222] text-[#888888] hover:text-white border border-[#333]'}`}
                  title={`${item.group.displayName} (${item.group.config.width}×${item.group.config.height} mm)`}
                >
                  <span 
                    className="w-2 h-2 rounded-full border border-black/40 shrink-0 shadow-xs" 
                    style={{ backgroundColor: item.group.materialColor }} 
                  />
                  <span>Plancha {item.boardNumber < 10 ? '0' : ''}{item.boardNumber}</span>
                </button>
              ))}
            </div>

            {/* Material & Edgeband Summary Badges */}
            <div className="hidden xl:flex items-center gap-3 text-[9px] font-mono bg-[#222222] border border-[#333333] px-3 py-1 rounded-lg text-[#aaa]">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-[#f0a144]" />
                <span className="text-white font-bold uppercase">
                  {activeBoardItem ? activeBoardItem.group.displayName : (boardGroups.length === 1 ? boardGroups[0].displayName : `${flatBoardsList.length} PLANCHAS`)}
                </span>
                <span className="text-[#666]">|</span>
                <span>
                  {activeBoardItem ? `${activeBoardItem.group.config.width}×${activeBoardItem.group.config.height}mm` : `${sheetConfig.width}×${sheetConfig.height}mm`}
                </span>
                <span className="text-[#666]">|</span>
                <span>Efic: <strong className="text-emerald-400">
                  {activeBoardItem ? activeBoardItem.board.stats.efficiency.toFixed(1) : totalStats.efficiency.toFixed(1)}%
                </strong></span>
              </div>
              <div className="h-3 w-px bg-[#444]"></div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-600 rounded-sm inline-block"></span>
                  C.Grueso: <strong className="text-white">{edgebandingTotals.thick}m</strong>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-blue-600 rounded-sm inline-block"></span>
                  C.Delgado: <strong className="text-white">{edgebandingTotals.thin}m</strong>
                </span>
              </div>
            </div>

            {/* Zoom Control Buttons */}
            <div className="flex items-center gap-1 bg-[#222222] border border-[#333333] p-0.5 rounded-lg shrink-0 select-none">
              <button 
                type="button"
                onClick={() => setZoom(z => Math.max(z - 0.15, 0.25))} 
                className="p-1 rounded text-[#aaa] hover:text-white hover:bg-[#333333] transition-colors" 
                title="Reducir Zoom (Lupa -)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button"
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} 
                className="px-1.5 py-0.5 rounded text-white font-mono text-[10px] font-bold hover:bg-[#333333] transition-colors" 
                title="Restablecer Zoom (100%)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button 
                type="button"
                onClick={() => setZoom(z => Math.min(z + 0.15, 4.0))} 
                className="p-1 rounded text-[#aaa] hover:text-white hover:bg-[#333333] transition-colors" 
                title="Aumentar Zoom (Lupa +)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button 
                type="button"
                onClick={handleFitToScreen} 
                className="p-1 rounded text-[#f0a144] hover:text-white hover:bg-[#333333] transition-colors" 
                title="Ajustar y maximizar en pantalla"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* BANDEJA SUPERIOR 2: OPCIONES DE CAPAS CAD Y ACCIONES */}
          <div className="bg-[#181818] border-b border-[#2d2d2d] px-2 sm:px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-[10px] font-mono text-[#cccccc] select-none">
              
              {/* Checkbox: Show Piece Dimensions */}
              <label className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showPieceDims} 
                  onChange={(e) => setShowPieceDims(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[9px] sm:text-[10px] font-sans font-medium">Piezas</span>
              </label>

              {/* Checkbox: Show Waste / Offcut Dimensions */}
              <label className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showWasteDims} 
                  onChange={(e) => setShowWasteDims(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[9px] sm:text-[10px] font-sans font-medium">Desechos</span>
              </label>

              {/* Checkbox: Show Piece Labels/Names */}
              <label className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showPieceNames} 
                  onChange={(e) => setShowPieceNames(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[9px] sm:text-[10px] font-sans font-medium">Nombres</span>
              </label>

              {/* Checkbox: Show Edgeband Lines */}
              <label className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showEdgebandLines} 
                  onChange={(e) => setShowEdgebandLines(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-sans font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block"></span>
                  Cantos
                </span>
              </label>

              {/* Checkbox: Show Cut Sequence Index */}
              <label className="flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showCutIndex} 
                  onChange={(e) => setShowCutIndex(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[9px] sm:text-[10px] font-sans font-medium">Índice</span>
              </label>

              {/* Checkbox: Show Sheet Outer Dimension Lines */}
              <label className="hidden md:flex items-center gap-1 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showSheetRulers} 
                  onChange={(e) => setShowSheetRulers(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[9px] sm:text-[10px] font-sans font-medium">Cotas</span>
              </label>

              {/* Button: Calibrar Letras y Números en el plano 2D */}
              <button
                type="button"
                onClick={() => {
                  setShowSettings(true);
                  setActiveSettingsTab('typography');
                }}
                className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded border text-[9px] sm:text-[10px] font-bold uppercase transition-all shrink-0 cursor-pointer ${
                  showSettings && activeSettingsTab === 'typography' 
                    ? 'bg-[#f0a144] text-black border-[#f0a144] shadow-md font-black' 
                    : 'bg-[#222222] hover:bg-[#2e2e2e] text-[#f0a144] border-[#3f3f3f] hover:border-[#f0a144]/60'
                }`}
                title="Ajustes de calibración: tamaño y estilo de letras y números en 2D"
              >
                <Type className="w-3.5 h-3.5 text-current" />
                <span className="hidden xs:inline">Calibrar</span>
                <span className={`text-[8.5px] font-mono px-1 py-0.2 rounded font-bold ${
                  showSettings && activeSettingsTab === 'typography' ? 'bg-black text-[#f0a144]' : 'bg-[#f0a144] text-black'
                }`}>
                  {Math.round(cadTextConfig.nameScale * 100)}%
                </span>
              </button>

              {/* Checkbox / Button: Toggle Color y Textura Real */}
              <button
                type="button"
                onClick={() => setUseRealMaterialColors(v => !v)}
                className={`flex items-center gap-1 px-2 py-1 rounded border text-[9px] sm:text-[10px] font-bold uppercase transition-all shrink-0 cursor-pointer ${
                  useRealMaterialColors 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-xs' 
                    : 'bg-[#222222] hover:bg-[#2e2e2e] text-[#aaa] border-[#3f3f3f]'
                }`}
                title="Mostrar color y textura real de materiales en el plano 2D (Melaminas, MDF, Vidrios)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden xs:inline">Color</span>
                <span className={`text-[8px] font-mono px-1 py-0.2 rounded font-bold ${
                  useRealMaterialColors ? 'bg-[#f0a144] text-black' : 'bg-black/60 text-[#888]'
                }`}>
                  {useRealMaterialColors ? 'ON' : 'CAD'}
                </span>
              </button>

              {/* Button: Consolidado y Cálculo de Materiales */}
              <button
                type="button"
                onClick={() => setShowMaterialSummaryModal(true)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#202020] hover:bg-[#2a2a2a] text-white hover:text-[#f0a144] border border-[#3f3f3f] hover:border-[#f0a144]/60 text-[9px] sm:text-[10px] font-bold uppercase transition-colors shrink-0 cursor-pointer"
                title="Ver consolidado de cálculo de materiales (Planchas de Melamina, MDF, Vidrio y Tapacantos)"
              >
                <Layers className="w-3.5 h-3.5 text-[#f0a144]" />
                <span className="hidden xs:inline">Cálculo</span>
              </button>

            </div>

            {/* Right Action Icons & Theme Switcher */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Espejo (Mirror Layout Button) */}
              <button
                type="button"
                onClick={() => setIsMirrored(!isMirrored)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase border transition-colors cursor-pointer ${isMirrored ? 'bg-[#f0a144] text-black border-[#f0a144]' : 'bg-[#222222] text-[#aaa] border-[#333] hover:text-white'}`}
                title="Voltear horizontalmente (Modo Espejo)"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Espejo</span>
              </button>

              {/* Botón Rotación en Barra CAD */}
              <button
                type="button"
                onClick={handleToggleGlobalRotation}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase border transition-colors cursor-pointer ${
                  allPiecesRotatable
                    ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                    : 'bg-[#222222] text-[#aaa] border-[#333] hover:text-white'
                }`}
                title={allPiecesRotatable ? "Rotación: PERMITIDA (90°). Clic para bloquear" : "Rotación: BLOQUEADA (Fija). Clic para permitir rotación"}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Rotación: {allPiecesRotatable ? 'SÍ' : 'NO'}</span>
              </button>

              {/* Theme Toggle (Plano CAD Blanco vs Modo Oscuro) */}
              <button
                type="button"
                onClick={() => setCadTheme(isLightCAD ? 'dark' : 'light')}
                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold uppercase bg-[#222222] border border-[#333333] text-[#aaaaaa] hover:text-white transition-colors cursor-pointer"
                title={isLightCAD ? "Cambiar a Modo Oscuro" : "Cambiar a Plano Blanco CAD (Software Tradicional)"}
              >
                {isLightCAD ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden xs:inline">Fondo Oscuro</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-[#f0a144]" />
                    <span className="hidden xs:inline">Plano Blanco</span>
                  </>
                )}
              </button>

              {/* Exportar PDF Didáctico para Carpintería */}
              <button
                type="button"
                onClick={() => setShowPdfExport(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[9px] font-extrabold uppercase bg-[#f0a144] hover:bg-[#ffb055] text-black border border-[#f0a144] transition-all shadow-md active:scale-95 cursor-pointer"
                title="Exportar plano de corte en PDF didáctico para taller"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Exportar PDF</span>
              </button>
            </div>
          </div>

          {/* Canvas Area with Wheel Zoom and Pan Drag */}
          <div 
            className={`flex-1 overflow-hidden p-2 sm:p-6 relative select-none touch-none ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`} 
            ref={containerRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            {/* Minimalist Pan & Zoom Indicator */}
            <div className="absolute top-3 left-3 z-20 pointer-events-none bg-[#181818]/90 backdrop-blur border border-[#333333] px-2.5 py-1 rounded-md text-[9px] font-mono text-[#888] hidden sm:flex items-center gap-2 shadow-lg">
              <span className="text-[#f0a144]">Zoom:</span>
              <span className="text-white font-bold">{Math.round(zoom * 100)}%</span>
              <span className="text-[#555]">•</span>
              <span>{wheelMode === 'scroll' ? '🖱️ Rueda: Desplazar (Ctrl+Rueda: Zoom)' : '🔍 Rueda: Zoom directo'}</span>
              <span className="text-[#555]">•</span>
              <span>👆 Táctil: 2 dedos zoom</span>
            </div>

            {/* Dynamic scroll hint toast when scrolling with wheel */}
            {showZoomHint && wheelMode === 'scroll' && (
              <div className="absolute top-11 left-3 z-20 pointer-events-none bg-black/85 backdrop-blur border border-[#444] px-2.5 py-1 rounded-md text-[9px] font-mono text-white animate-in fade-in duration-150 flex items-center gap-1.5 shadow-xl">
                <span className="text-[#f0a144]">💡</span>
                <span>Desplazando plano. Mantén <strong>Ctrl + Rueda</strong> para zoom con lupa</span>
              </div>
            )}

            {/* Floating Zoom & Pan Navigation HUD */}
            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 bg-[#181818]/95 backdrop-blur-md border border-[#383838] p-1.5 rounded-xl shadow-2xl text-white select-none">
              {/* Alejar / Lupa - */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.25, Number((z - 0.15).toFixed(2)))); }}
                className="p-1.5 hover:bg-[#2d2d2d] active:bg-[#383838] rounded-lg text-[#aaa] hover:text-white transition-colors"
                title="Alejar plano (Lupa -)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>

              {/* Porcentaje actual y restablecer al 100% */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="px-2 py-1 hover:bg-[#2d2d2d] rounded-lg text-white font-mono text-[11px] font-bold transition-colors"
                title="Restablecer Zoom al 100% y centrar plano"
              >
                {Math.round(zoom * 100)}%
              </button>

              {/* Acercar / Lupa + */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(4.0, Number((z + 0.15).toFixed(2)))); }}
                className="p-1.5 hover:bg-[#2d2d2d] active:bg-[#383838] rounded-lg text-[#aaa] hover:text-white transition-colors"
                title="Acercar plano (Lupa +)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-[#383838] mx-0.5" />

              {/* Ajustar a la pantalla */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleFitToScreen(); }}
                className="px-2 py-1 hover:bg-[#2d2d2d] rounded-lg text-[#f0a144] hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold"
                title="Ajustar y maximizar plancha en pantalla"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ajustar</span>
              </button>

              <div className="w-px h-4 bg-[#383838] mx-0.5" />

              {/* Selector de modo rueda ratón */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setWheelMode(m => m === 'scroll' ? 'zoom' : 'scroll');
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all ${
                  wheelMode === 'scroll'
                    ? 'bg-[#252525] text-emerald-400 border border-emerald-500/30 hover:bg-[#2d2d2d]'
                    : 'bg-[#f0a144] text-black hover:bg-[#ffb055]'
                }`}
                title={
                  wheelMode === 'scroll'
                    ? 'Modo Rueda: Desplazamiento natural (Usa Ctrl+Rueda o pulsa aquí para Zoom directo)'
                    : 'Modo Rueda: Zoom directo (pulsa aquí para volver a Desplazamiento)'
                }
              >
                <span>{wheelMode === 'scroll' ? '↕ Rueda: Desplazar' : '🔍 Rueda: Zoom'}</span>
              </button>
            </div>

            {/* Boards Layout Container with Pan Transform */}
            <div 
              className="flex flex-col gap-6 sm:gap-8 w-full pb-16 transition-transform duration-75 origin-top-left items-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px)`
              }}
            >
              {boardsToRender.map((item) => {
                const { group, board, boardNumber } = item;
                const bWidth = group.config.width;
                const bHeight = group.config.height;
                const svgW = bWidth * viewScale * zoom;
                const svgH = bHeight * viewScale * zoom;

                return (
                  <div key={`${group.groupKey}-${boardNumber}`} className="flex flex-col items-center max-w-full">
                    {/* Sheet Card Frame */}
                    <div className={`p-2.5 sm:p-3.5 rounded-xl border shadow-2xl transition-all w-fit max-w-full ${isLightCAD ? 'bg-[#f4f4f5] border-[#d4d4d8] text-black' : 'bg-[#181818] border-[#333333] text-white'}`}>
                      
                      {/* Sheet Title Bar (Clean, Non-wrapping, High Legibility) */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-[#383838]/40 mb-2 text-[10.5px] font-mono">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-[#f0a144] text-black px-2 py-0.5 rounded font-black text-[10px]">
                            PLANCHA {boardNumber}
                          </span>
                                  <div 
                                    className="w-3 h-3 rounded-full border border-black/40 shrink-0 shadow-xs" 
                                    style={{ backgroundColor: group.materialColor }}
                                    title={group.displayName}
                                  />
                                  <span className="text-[#f0a144] font-black">{group.code}</span>
                                  <span className={`font-bold uppercase ${isLightCAD ? "text-black" : "text-white"}`}>
                                    {group.displayName}
                                  </span>
                                  <span className="text-[#888] font-semibold">({bWidth}×{bHeight} mm)</span>
                                </div>

                                <div className="flex items-center gap-2 text-[10px] shrink-0">
                                  <span>Piezas: <strong className={`font-bold ${isLightCAD ? "text-black" : "text-white"}`}>{board.rects.length}</strong></span>
                                  <span className="text-[#555]">|</span>
                                  <span>Aprov: <strong className="text-emerald-400 font-bold">{board.stats.efficiency.toFixed(1)}%</strong></span>
                                  <span className="text-[#555]">|</span>
                                  <span>Desecho: <strong className="text-rose-400 font-bold">{(100 - board.stats.efficiency).toFixed(1)}%</strong></span>
                                </div>
                              </div>

                              {/* SVG Canvas Container with CAD Rulers */}
                              <div className="relative flex flex-col items-center">
                                {/* Top Outer Dimension */}
                                {showSheetRulers && (
                                  <div className="w-full flex justify-between items-center px-1 pb-1 font-mono text-[10px] text-[#888]">
                                    <span className="text-[9px]">0</span>
                                    <span className="font-bold text-[#f0a144]">← {bWidth} mm →</span>
                                    <span className="text-[9px]">{bWidth}</span>
                                  </div>
                                )}

                                <div className="relative">
                                  <svg
                                    width={svgW}
                                    height={svgH}
                                    viewBox={`0 0 ${bWidth} ${bHeight}`}
                                    className={`border shadow-inner transition-colors duration-150 ${isLightCAD ? 'bg-[#ffffff] border-[#333333]' : 'bg-[#222222] border-[#444444]'}`}
                                    style={{
                                      transform: isMirrored ? 'scaleX(-1)' : 'none',
                                      transformOrigin: 'center center',
                                    }}
                                  >
                                    <defs>
                                      {/* Procedural Wood Grain Overlay */}
                                      <pattern 
                                        id={`wood-grain-pattern-${boardNumber}`} 
                                        width="120" 
                                        height="600" 
                                        patternUnits="userSpaceOnUse"
                                      >
                                        <line x1="0" y1="0" x2="0" y2="600" stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
                                        <line x1="25" y1="0" x2="25" y2="600" stroke="rgba(0,0,0,0.05)" strokeWidth="0.8" />
                                        <line x1="55" y1="0" x2="55" y2="600" stroke="rgba(255,255,255,0.08)" strokeWidth="1.2" />
                                        <line x1="85" y1="0" x2="85" y2="600" stroke="rgba(0,0,0,0.06)" strokeWidth="0.9" />
                                        <line x1="110" y1="0" x2="110" y2="600" stroke="rgba(255,255,255,0.05)" strokeWidth="0.7" />
                                        <path d="M 15 100 Q 25 220 15 340 T 15 580" fill="none" stroke="rgba(0,0,0,0.04)" strokeWidth="1.5" />
                                      </pattern>

                                      {/* Glass Sheen Gradient */}
                                      <linearGradient id={`glass-sheen-${boardNumber}`} x1="0" y1="0" x2="1" y2="1">
                                        <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.45" />
                                        <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.2" />
                                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
                                      </linearGradient>

                                      {/* MDF Fiber Texture */}
                                      <pattern 
                                        id={`mdf-fiber-${boardNumber}`} 
                                        width="24" 
                                        height="24" 
                                        patternUnits="userSpaceOnUse"
                                      >
                                        <circle cx="4" cy="4" r="0.9" fill="rgba(80,50,20,0.14)" />
                                        <circle cx="16" cy="14" r="1.0" fill="rgba(60,30,10,0.12)" />
                                        <circle cx="8" cy="18" r="0.7" fill="rgba(255,255,255,0.08)" />
                                      </pattern>
                                    </defs>

                                    {/* Perimeter Sheet Outline */}
                                    <rect
                                      x={0}
                                      y={0}
                                      width={bWidth}
                                      height={bHeight}
                                      fill="none"
                                      stroke={isLightCAD ? '#000000' : '#444444'}
                                      strokeWidth={2}
                                    />

                                    {/* Waste Rectangles (Sobrantes / Retazos) */}
                                    {board.wasteRects.map((waste, wIdx) => (
                                      <g key={`waste-${wIdx}`} className="pointer-events-none">
                                        <rect
                                          x={waste.x}
                                          y={waste.y}
                                          width={waste.w}
                                          height={waste.h}
                                          fill={waste.isMargin ? (isLightCAD ? '#e4e4e7' : '#1a1a1a') : (isLightCAD ? '#fee2e2' : '#331a1a')}
                                          stroke={isLightCAD ? '#d4d4d8' : '#333333'}
                                          strokeWidth={1}
                                          strokeDasharray={waste.isMargin ? '2,2' : undefined}
                                        />
                                        {/* Waste Dimensions Label */}
                                        {showWasteDims && !waste.isMargin && waste.w > 30 && waste.h > 20 && (
                                          <text
                                            x={waste.x + waste.w / 2}
                                            y={waste.y + waste.h / 2}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            fill={isLightCAD ? '#dc2626' : '#f87171'}
                                            fontSize={Math.max(24, Math.min(48, waste.w * 0.12, waste.h * 0.18)) * cadTextConfig.dimScale}
                                            className="font-mono font-bold select-none opacity-80"
                                          >
                                            {Math.round(waste.w)}×{Math.round(waste.h)}
                                          </text>
                                        )}
                                      </g>
                                    ))}

                                    {/* Placed Pieces Rectangles */}
                                    {board.rects.map((rect, rIdx) => {
                                      const isSelected = selectedPieceIds.includes(rect.id);
                                      const isHovered = hoveredPieceId === rect.id;
                                      const rectX = rect.x;
                                      const rectY = rect.y;
                                      const rectW = rect.w;
                                      const rectH = rect.h;
                                      const cx = rectX + rectW / 2;
                                      const cy = rectY + rectH / 2;

                                      // Font sizes in SVG mm units - tuned for crisp legibility with calibration
                                      const baseNameFontSize = Math.max(34, Math.min(74, rectW * 0.12, rectH * 0.18));
                                      const baseDimFontSize = Math.max(28, Math.min(52, rectW * 0.09, rectH * 0.14));

                                      const nameFontSize = baseNameFontSize * cadTextConfig.nameScale;
                                      const dimFontSize = baseDimFontSize * cadTextConfig.dimScale;

                                      const showName = showPieceNames && rectW > Math.max(28, 50 / cadTextConfig.nameScale) && rectH > Math.max(22, 36 / cadTextConfig.nameScale);
                                      const showDims = showPieceDims && rectW > Math.max(36, 58 / cadTextConfig.dimScale) && rectH > Math.max(28, 42 / cadTextConfig.dimScale);

                                      const pieceNameText = cadTextConfig.letterCase === 'uppercase' ? rect.name.toUpperCase() : rect.name;

                                      const nameFontFamilyClass = 
                                        cadTextConfig.fontFamily === 'mono' ? 'font-mono' :
                                        cadTextConfig.fontFamily === 'condensed' ? 'font-sans tracking-tighter' :
                                        'font-sans tracking-tight';

                                      const nameFontWeight = 
                                        cadTextConfig.fontWeight === 'normal' ? '500' :
                                        cadTextConfig.fontWeight === 'bold' ? '700' :
                                        '900';

                                      // Material color resolution and contrast-aware text
                                      const isDarkMat = rect.isDark ?? (!isLightCAD);
                                      const defaultCADFill = isLightCAD ? '#ffffff' : '#383838';
                                      const realMatFill = rect.color || defaultCADFill;

                                      const pieceFillColor = isSelected 
                                        ? (isLightCAD ? '#fef3c7' : '#f0a144') 
                                        : isHovered
                                          ? (isLightCAD ? '#dbeafe' : '#1e3a8a')
                                          : (useRealMaterialColors ? realMatFill : defaultCADFill);

                                      const pieceStrokeColor = isSelected 
                                        ? '#d97706' 
                                        : isHovered
                                          ? '#2563eb'
                                          : (rect.isGlass ? '#0284c7' : (isLightCAD ? '#000000' : '#111111'));

                                      const effectiveTextColor = isSelected 
                                        ? '#000000' 
                                        : isHovered 
                                          ? '#ffffff'
                                          : (useRealMaterialColors ? (isDarkMat ? '#ffffff' : '#111111') : (isLightCAD ? '#000000' : '#ffffff'));

                                      const dimColor = 
                                        cadTextConfig.dimStyle === 'amber' ? '#f0a144' :
                                        cadTextConfig.dimStyle === 'blue' ? '#2563eb' :
                                        cadTextConfig.dimStyle === 'red' ? '#dc2626' :
                                        (isSelected ? '#000000' : isHovered ? '#ffffff' : (useRealMaterialColors ? (isDarkMat ? '#ffffff' : '#111111') : (isLightCAD ? '#000000' : '#ffffff')));

                                      const dimFontFamily = cadTextConfig.fontFamily === 'mono' ? 'monospace' : 'sans-serif';
                                      const dimFontWeight = cadTextConfig.fontWeight === 'normal' ? 'normal' : 'bold';

                                      const topCanto = !rect.rotated ? rect.cantos.largo1 : rect.cantos.ancho1;
                                      const bottomCanto = !rect.rotated ? rect.cantos.largo2 : rect.cantos.ancho2;
                                      const leftCanto = !rect.rotated ? rect.cantos.ancho1 : rect.cantos.largo1;
                                      const rightCanto = !rect.rotated ? rect.cantos.ancho2 : rect.cantos.largo2;

                                      return (
                                        <g
                                          key={`${rect.id}-${rIdx}`}
                                          data-piece-rect="true"
                                          onClick={(e) => { e.stopPropagation(); toggleSelection(rect.id, e.shiftKey); }}
                                          onMouseEnter={() => setHoveredPieceId(rect.id)}
                                          onMouseLeave={() => setHoveredPieceId(null)}
                                          className="group/rect transition-all duration-150 pointer-events-auto cursor-pointer"
                                        >
                                          {/* Main Piece Background */}
                                          <rect
                                            x={rectX}
                                            y={rectY}
                                            width={rectW}
                                            height={rectH}
                                            fill={pieceFillColor}
                                            stroke={pieceStrokeColor}
                                            strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                                            className={isSelected ? '' : (isLightCAD ? 'hover:fill-[#fffbeb]' : 'hover:fill-[#4a4a4a]')}
                                          />

                                          {/* Material Texture Overlays (Wood grain / Glass sheen / MDF fiber) */}
                                          {useRealMaterialColors && !isSelected && !isHovered && (
                                            <>
                                              {(rect.isWood || rect.hasGrain) && (
                                                <rect
                                                  x={rectX}
                                                  y={rectY}
                                                  width={rectW}
                                                  height={rectH}
                                                  fill={`url(#wood-grain-pattern-${boardNumber})`}
                                                  pointerEvents="none"
                                                  opacity={0.65}
                                                />
                                              )}
                                              {rect.isGlass && (
                                                <rect
                                                  x={rectX}
                                                  y={rectY}
                                                  width={rectW}
                                                  height={rectH}
                                                  fill={`url(#glass-sheen-${boardNumber})`}
                                                  pointerEvents="none"
                                                  opacity={0.55}
                                                />
                                              )}
                                              {rect.substrate === 'mdf' && (
                                                <rect
                                                  x={rectX}
                                                  y={rectY}
                                                  width={rectW}
                                                  height={rectH}
                                                  fill={`url(#mdf-fiber-${boardNumber})`}
                                                  pointerEvents="none"
                                                  opacity={0.5}
                                                />
                                              )}
                                            </>
                                          )}

                                          {/* Edgeband Lines (Cantos: Red=Thick, Blue=Thin) */}
                                          {showEdgebandLines && (
                                            <g className="edgeband-lines pointer-events-none">
                                              {topCanto !== 'Ninguno' && (
                                                <line 
                                                  x1={rectX} 
                                                  y1={rectY} 
                                                  x2={rectX + rectW} 
                                                  y2={rectY} 
                                                  stroke={topCanto === 'Canto Grueso' ? '#dc2626' : '#2563eb'} 
                                                  strokeWidth={topCanto === 'Canto Grueso' ? 7 : 4.5} 
                                                />
                                              )}
                                              {bottomCanto !== 'Ninguno' && (
                                                <line 
                                                  x1={rectX} 
                                                  y1={rectY + rectH} 
                                                  x2={rectX + rectW} 
                                                  y2={rectY + rectH} 
                                                  stroke={bottomCanto === 'Canto Grueso' ? '#dc2626' : '#2563eb'} 
                                                  strokeWidth={bottomCanto === 'Canto Grueso' ? 7 : 4.5} 
                                                />
                                              )}
                                              {leftCanto !== 'Ninguno' && (
                                                <line 
                                                  x1={rectX} 
                                                  y1={rectY} 
                                                  x2={rectX} 
                                                  y2={rectY + rectH} 
                                                  stroke={leftCanto === 'Canto Grueso' ? '#dc2626' : '#2563eb'} 
                                                  strokeWidth={leftCanto === 'Canto Grueso' ? 7 : 4.5} 
                                                />
                                              )}
                                              {rightCanto !== 'Ninguno' && (
                                                <line 
                                                  x1={rectX + rectW} 
                                                  y1={rectY} 
                                                  x2={rectX + rectW} 
                                                  y2={rectY + rectH} 
                                                  stroke={rightCanto === 'Canto Grueso' ? '#dc2626' : '#2563eb'} 
                                                  strokeWidth={rightCanto === 'Canto Grueso' ? 7 : 4.5} 
                                                />
                                              )}
                                            </g>
                                          )}

                                          {/* Piece Dimensions - Large, Bold & High Contrast with Calibration */}
                                          {showDims && (
                                            <g className="piece-edge-dimensions pointer-events-none select-none">
                                              {/* Top Horizontal Dimension (Largo) */}
                                              {rectW > 50 && (
                                                <g>
                                                  {cadTextConfig.showBadgeBg && (
                                                    <rect
                                                      x={cx - (String(Math.round(rect.w)).length * dimFontSize * 0.36)}
                                                      y={rectY + Math.max(22, dimFontSize * 0.95) - (dimFontSize * 0.78)}
                                                      width={String(Math.round(rect.w)).length * dimFontSize * 0.72}
                                                      height={dimFontSize * 1.05}
                                                      rx={3}
                                                      fill={isLightCAD ? 'rgba(255,255,255,0.9)' : 'rgba(25,25,25,0.9)'}
                                                      stroke={isLightCAD ? '#cccccc' : '#555555'}
                                                      strokeWidth={0.8}
                                                    />
                                                  )}
                                                  <text
                                                    x={cx}
                                                    y={rectY + Math.max(22, dimFontSize * 0.95)}
                                                    textAnchor="middle"
                                                    fill={dimColor}
                                                    fontSize={dimFontSize}
                                                    fontWeight={dimFontWeight}
                                                    fontFamily={dimFontFamily}
                                                  >
                                                    {Math.round(rect.w)}
                                                  </text>
                                                </g>
                                              )}

                                              {/* Left Vertical Dimension (Ancho) - positioned cleanly to avoid colliding with center name */}
                                              {rectH > 50 && rectW > 90 && (
                                                <g>
                                                  {cadTextConfig.showBadgeBg && (
                                                    <rect
                                                      x={rectX + Math.max(14, dimFontSize * 0.55) - (dimFontSize * 0.52)}
                                                      y={cy - (String(Math.round(rect.h)).length * dimFontSize * 0.36)}
                                                      width={dimFontSize * 1.05}
                                                      height={String(Math.round(rect.h)).length * dimFontSize * 0.72}
                                                      rx={3}
                                                      fill={isLightCAD ? 'rgba(255,255,255,0.9)' : 'rgba(25,25,25,0.9)'}
                                                      stroke={isLightCAD ? '#cccccc' : '#555555'}
                                                      strokeWidth={0.8}
                                                    />
                                                  )}
                                                  <text
                                                    x={rectX + Math.max(14, dimFontSize * 0.55)}
                                                    y={cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    transform={`rotate(-90 ${rectX + Math.max(14, dimFontSize * 0.55)} ${cy})`}
                                                    fill={dimColor}
                                                    fontSize={dimFontSize}
                                                    fontWeight={dimFontWeight}
                                                    fontFamily={dimFontFamily}
                                                  >
                                                    {Math.round(rect.h)}
                                                  </text>
                                                </g>
                                              )}
                                            </g>
                                          )}

                                          {/* Piece Name / Label - Large & Prominent with Calibration */}
                                          {showName && (
                                            <g className="piece-name-label pointer-events-none select-none">
                                              {cadTextConfig.showBadgeBg && (
                                                <rect
                                                  x={cx - (pieceNameText.length * nameFontSize * 0.32)}
                                                  y={(showDims ? cy + (dimFontSize * 0.35) : cy) - (nameFontSize * 0.6)}
                                                  width={pieceNameText.length * nameFontSize * 0.64}
                                                  height={nameFontSize * 1.2}
                                                  rx={4}
                                                  fill={isLightCAD ? 'rgba(255,255,255,0.9)' : 'rgba(25,25,25,0.9)'}
                                                  stroke={isLightCAD ? '#cccccc' : '#555555'}
                                                  strokeWidth={1}
                                                />
                                              )}
                                              <text
                                                x={cx}
                                                y={showDims ? cy + (dimFontSize * 0.35) : cy}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fill={effectiveTextColor}
                                                fontSize={nameFontSize}
                                                fontWeight={nameFontWeight}
                                                className={`${nameFontFamilyClass} select-none`}
                                              >
                                                {pieceNameText}
                                              </text>

                                              {/* Substrate / Material Type Tag under piece name when space permits */}
                                              {rectW > 70 && rectH > 52 && (
                                                <text
                                                  x={cx}
                                                  y={(showDims ? cy + (dimFontSize * 0.35) : cy) + (nameFontSize * 0.68)}
                                                  textAnchor="middle"
                                                  dominantBaseline="middle"
                                                  fill={effectiveTextColor}
                                                  fontSize={Math.max(9, Math.min(18, nameFontSize * 0.44))}
                                                  fontWeight="bold"
                                                  className="font-mono opacity-65 uppercase tracking-wider select-none"
                                                >
                                                  {rect.substrateLabel || rect.materialName || 'MELAMINA'}
                                                </text>
                                              )}
                                            </g>
                                          )}

                                          {/* Grain Orientation Arrow indicator for workshop cuts */}
                                          {rect.veta && rectW > 50 && rectH > 35 && (
                                            <g className="pointer-events-none select-none opacity-80">
                                              <text
                                                x={rectX + rectW - Math.max(16, dimFontSize * 0.65)}
                                                y={rectY + Math.max(16, dimFontSize * 0.65)}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fill={dimColor}
                                                fontSize={Math.max(12, dimFontSize * 0.55)}
                                                fontWeight="bold"
                                                className="font-mono"
                                              >
                                                <title>{rect.rotated ? "Veta horizontal (pieza girada 90°)" : "Veta vertical (sentido veta estándar)"}</title>
                                                {rect.rotated ? '↔' : '↕'}
                                              </text>
                                            </g>
                                          )}

                                          {/* Cut Index Badge - Scaled and Clear */}
                                          {showCutIndex && (
                                            <g className="pointer-events-none select-none">
                                              <circle
                                                cx={rectX + Math.max(24, dimFontSize * 0.8)}
                                                cy={rectY + Math.max(24, dimFontSize * 0.8)}
                                                r={Math.max(16, dimFontSize * 0.55)}
                                                fill="#f0a144"
                                                stroke="#000000"
                                                strokeWidth={1.5}
                                              />
                                              <text
                                                x={rectX + Math.max(24, dimFontSize * 0.8)}
                                                y={rectY + Math.max(24, dimFontSize * 0.8) + (dimFontSize * 0.2)}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fill="#000000"
                                                fontSize={Math.max(14, dimFontSize * 0.5)}
                                                fontWeight="bold"
                                                className="font-mono"
                                              >
                                                {rect.cutIndex}
                                              </text>
                                            </g>
                                          )}
                                        </g>
                                      );
                                    })}
                                  </svg>
                                </div>

                                {/* Bottom Outer Dimension Ruler */}
                                {showSheetRulers && (
                                  <div className="w-full flex justify-between items-center px-1 pt-1 font-mono text-[10px] text-[#888]">
                                    <span className="text-[9px]">Alto: {bHeight} mm</span>
                                    <span className="font-bold text-[#888]">Área: {((bWidth * bHeight) / 1000000).toFixed(2)} m²</span>
                                    <span className="text-[9px]">Kerf: {group.config.kerf} mm</span>
                                  </div>
                                )}
                              </div>

                              {/* Bottom Sheet Information Specs */}
                              <div className="mt-2 pt-1.5 border-t border-[#383838]/40 flex flex-wrap items-center justify-between text-[9.5px] font-mono text-[#888] gap-2">
                                <div className="flex items-center gap-3">
                                  <span>Plancha: <strong className={isLightCAD ? 'text-black' : 'text-white'}>{boardNumber} de {flatBoardsList.length}</strong></span>
                                  <span>•</span>
                                  <span>Material: <strong className={isLightCAD ? 'text-black' : 'text-white'}>{group.displayName}</strong></span>
                                  <span>•</span>
                                  <span>Formato: <strong className={isLightCAD ? 'text-black' : 'text-white'}>{bWidth}×{bHeight} mm</strong></span>
                                </div>
                                <div>
                                  Aprovechamiento: <strong className="text-emerald-500 font-bold">{board.stats.efficiency.toFixed(1)}%</strong>
                                </div>
                              </div>

                            </div>
                          </div>
                        );
                      })}
            </div>
          </div>
        </div>

        {/* Sidebar Configuration */}
        {showSettings && (
          <div className="w-[300px] sm:w-88 shrink-0 border-l border-[#1a1a1a] bg-[#202020] flex flex-col animate-in slide-in-from-right-full duration-300 absolute right-0 top-0 bottom-0 z-30 shadow-2xl sm:relative sm:shadow-none overflow-hidden">
            {/* Header with Title and Close Button */}
            <div className="p-3.5 sm:p-4 border-b border-[#2d2d2d] flex items-center justify-between shrink-0 bg-[#242424]">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#f0a144]" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Ajustes & Calibración</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSettings(false)} 
                className="p-1 rounded text-[#aaaaaa] hover:text-white hover:bg-[#333] transition-colors"
                title="Cerrar panel de ajustes"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sub-tabs Selector */}
            <div className="flex border-b border-[#2d2d2d] bg-[#1a1a1a] shrink-0">
              <button
                type="button"
                onClick={() => setActiveSettingsTab('typography')}
                className={`flex-1 py-2 px-1 text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                  activeSettingsTab === 'typography' 
                    ? 'border-[#f0a144] text-[#f0a144] bg-[#242424]' 
                    : 'border-transparent text-[#888] hover:text-white'
                }`}
              >
                <Type className="w-3 h-3 text-current" />
                <span>Letras / Cotas</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab('sheet')}
                className={`flex-1 py-2 px-1 text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                  activeSettingsTab === 'sheet' 
                    ? 'border-[#f0a144] text-[#f0a144] bg-[#242424]' 
                    : 'border-transparent text-[#888] hover:text-white'
                }`}
              >
                <Sliders className="w-3 h-3 text-current" />
                <span>Plancha & Hoja</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsTab('stats')}
                className={`flex-1 py-2 px-1 text-[10px] font-bold uppercase transition-colors flex items-center justify-center gap-1.5 border-b-2 ${
                  activeSettingsTab === 'stats' 
                    ? 'border-[#f0a144] text-[#f0a144] bg-[#242424]' 
                    : 'border-transparent text-[#888] hover:text-white'
                }`}
              >
                <BarChart3 className="w-3 h-3 text-current" />
                <span>Métricas</span>
              </button>
            </div>

            {/* Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-4 space-y-4">
              {/* TAB 1: TYPOGRAPHY & CAD NUMBERS CALIBRATION */}
              {activeSettingsTab === 'typography' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* Presets Rápidos */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold text-[#aaaaaa] uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-[#f0a144]" />
                        Calibración Rápida
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const def = {
                            nameScale: 1.0,
                            dimScale: 1.0,
                            fontFamily: 'sans' as const,
                            fontWeight: 'extrabold' as const,
                            letterCase: 'uppercase' as const,
                            showBadgeBg: false,
                            dimStyle: 'default' as const
                          };
                          setCadTextConfig(def);
                          try {
                            localStorage.setItem('carpinteria_cad_text_calibration', JSON.stringify(def));
                          } catch {}
                        }}
                        className="text-[8px] font-mono text-[#777] hover:text-[#f0a144] flex items-center gap-0.5 transition-colors"
                        title="Restaurar a valores predeterminados"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Reiniciar
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateCadTextConfig({ nameScale: 1.35, dimScale: 1.35, fontWeight: 'extrabold', showBadgeBg: true })}
                        className={`p-1.5 rounded border text-left transition-all ${
                          cadTextConfig.nameScale >= 1.3 
                            ? 'bg-[#f0a144]/15 border-[#f0a144] text-[#f0a144]' 
                            : 'bg-[#181818] border-[#333] text-[#aaa] hover:bg-[#252525]'
                        }`}
                      >
                        <span className="text-[9px] font-black block">Taller / Impresión</span>
                        <span className="text-[7.5px] text-[#777] block font-mono">135% • Máx. contraste</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCadTextConfig({ nameScale: 1.15, dimScale: 1.15, fontWeight: 'bold' })}
                        className={`p-1.5 rounded border text-left transition-all ${
                          cadTextConfig.nameScale >= 1.1 && cadTextConfig.nameScale < 1.3 
                            ? 'bg-[#f0a144]/15 border-[#f0a144] text-[#f0a144]' 
                            : 'bg-[#181818] border-[#333] text-[#aaa] hover:bg-[#252525]'
                        }`}
                      >
                        <span className="text-[9px] font-black block">Grande Legible</span>
                        <span className="text-[7.5px] text-[#777] block font-mono">115% • Equilibrado</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCadTextConfig({ nameScale: 1.0, dimScale: 1.0 })}
                        className={`p-1.5 rounded border text-left transition-all ${
                          cadTextConfig.nameScale >= 0.95 && cadTextConfig.nameScale <= 1.05 
                            ? 'bg-[#f0a144]/15 border-[#f0a144] text-[#f0a144]' 
                            : 'bg-[#181818] border-[#333] text-[#aaa] hover:bg-[#252525]'
                        }`}
                      >
                        <span className="text-[9px] font-black block">Estándar CAD</span>
                        <span className="text-[7.5px] text-[#777] block font-mono">100% • Vista óptima</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateCadTextConfig({ nameScale: 0.85, dimScale: 0.85 })}
                        className={`p-1.5 rounded border text-left transition-all ${
                          cadTextConfig.nameScale <= 0.9 
                            ? 'bg-[#f0a144]/15 border-[#f0a144] text-[#f0a144]' 
                            : 'bg-[#181818] border-[#333] text-[#aaa] hover:bg-[#252525]'
                        }`}
                      >
                        <span className="text-[9px] font-black block">Compacto</span>
                        <span className="text-[7.5px] text-[#777] block font-mono">85% • Muchas piezas</span>
                      </button>
                    </div>
                  </div>

                  {/* Sliders de Calibración Fina */}
                  <div className="bg-[#181818] border border-[#333] p-3 rounded-lg space-y-3">
                    {/* Calibrar Tamaño de Letras (Nombres) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-bold text-white uppercase">Tamaño de Letras (Nombres)</span>
                        <span className="text-[10px] font-mono font-bold text-[#f0a144] bg-black/40 px-1.5 py-0.5 rounded border border-[#333]">
                          {Math.round(cadTextConfig.nameScale * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-[#666]">60%</span>
                        <input
                          type="range"
                          min="0.6"
                          max="1.8"
                          step="0.05"
                          value={cadTextConfig.nameScale}
                          onChange={(e) => updateCadTextConfig({ nameScale: parseFloat(e.target.value) })}
                          className="w-full accent-[#f0a144] cursor-pointer h-1.5 bg-[#2a2a2a] rounded"
                        />
                        <span className="text-[8px] font-mono text-[#666]">180%</span>
                      </div>
                    </div>

                    {/* Calibrar Tamaño de Números (Cotas en mm) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-bold text-white uppercase">Tamaño de Números (Cotas)</span>
                        <span className="text-[10px] font-mono font-bold text-[#f0a144] bg-black/40 px-1.5 py-0.5 rounded border border-[#333]">
                          {Math.round(cadTextConfig.dimScale * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono text-[#666]">60%</span>
                        <input
                          type="range"
                          min="0.6"
                          max="1.8"
                          step="0.05"
                          value={cadTextConfig.dimScale}
                          onChange={(e) => updateCadTextConfig({ dimScale: parseFloat(e.target.value) })}
                          className="w-full accent-[#f0a144] cursor-pointer h-1.5 bg-[#2a2a2a] rounded"
                        />
                        <span className="text-[8px] font-mono text-[#666]">180%</span>
                      </div>
                    </div>
                  </div>

                  {/* Estilo y Tipografía */}
                  <div className="bg-[#181818] border border-[#333] p-3 rounded-lg space-y-2.5">
                    <span className="text-[9px] font-bold text-[#aaaaaa] uppercase tracking-wider block">Estilo Tipográfico</span>
                    
                    {/* Fuente */}
                    <div>
                      <span className="text-[8px] text-[#777] block mb-1">Fuente tipográfica</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(['sans', 'mono', 'condensed'] as const).map((font) => (
                          <button
                            key={font}
                            type="button"
                            onClick={() => updateCadTextConfig({ fontFamily: font })}
                            className={`py-1 text-[8.5px] rounded border uppercase font-medium transition-colors ${
                              cadTextConfig.fontFamily === font 
                                ? 'bg-[#f0a144] text-black border-[#f0a144] font-bold' 
                                : 'bg-[#222] border-[#3a3a3a] text-[#aaa] hover:text-white'
                            }`}
                          >
                            {font === 'sans' ? 'Sans Clean' : font === 'mono' ? 'Mono CAD' : 'Condensada'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Grosor */}
                    <div>
                      <span className="text-[8px] text-[#777] block mb-1">Grosor de trazo</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(['normal', 'bold', 'extrabold'] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => updateCadTextConfig({ fontWeight: w })}
                            className={`py-1 text-[8.5px] rounded border uppercase transition-colors ${
                              cadTextConfig.fontWeight === w 
                                ? 'bg-[#f0a144] text-black border-[#f0a144] font-bold' 
                                : 'bg-[#222] border-[#3a3a3a] text-[#aaa] hover:text-white'
                            }`}
                          >
                            {w === 'normal' ? 'Medio' : w === 'bold' ? 'Negrita' : 'Extra Bold'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color de Números / Cotas */}
                    <div>
                      <span className="text-[8px] text-[#777] block mb-1">Color de números (Cotas)</span>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { id: 'default', label: 'B/N', color: '#888' },
                          { id: 'amber', label: 'Ámbar', color: '#f0a144' },
                          { id: 'blue', label: 'Azul', color: '#3b82f6' },
                          { id: 'red', label: 'Rojo', color: '#ef4444' }
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => updateCadTextConfig({ dimStyle: c.id as any })}
                            className={`py-1 text-[8px] rounded border flex items-center justify-center gap-1 transition-colors ${
                              cadTextConfig.dimStyle === c.id 
                                ? 'bg-[#333] border-[#f0a144] text-white font-bold' 
                                : 'bg-[#222] border-[#333] text-[#888] hover:text-white'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color }} />
                            <span>{c.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Checkbox: Fondo Placa / Badge de Contraste */}
                    <div className="pt-1.5 border-t border-[#2a2a2a] flex items-center justify-between">
                      <div>
                        <span className="text-[8.5px] font-bold text-white block">Fondo de Alto Contraste</span>
                        <span className="text-[7.5px] text-[#777] block">Añade una placa detrás de las cotas y nombres</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={cadTextConfig.showBadgeBg}
                        onChange={(e) => updateCadTextConfig({ showBadgeBg: e.target.checked })}
                        className="w-4 h-4 rounded accent-[#f0a144] bg-[#222] border-[#444] cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SHEET CONFIG & KERF */}
              {activeSettingsTab === 'sheet' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Formatos Rápidos</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => onUpdateSheetConfig({ ...sheetConfig, width: 2440, height: 2140 })}
                        className={`text-[8px] font-bold p-2 text-center rounded border transition-colors ${sheetConfig.width === 2440 && sheetConfig.height === 2140 ? 'bg-[#f0a144]/20 border-[#f0a144] text-white' : 'bg-[#1a1a1a] border-[#333333] text-[#aaaaaa] hover:bg-[#333333]'}`}
                      >
                        MELAMINA
                        <br/><span className="text-[#666666] font-mono text-[7px]">2440 x 2140 mm</span>
                      </button>
                      <button 
                        onClick={() => onUpdateSheetConfig({ ...sheetConfig, width: 2440, height: 1850 })}
                        className={`text-[8px] font-bold p-2 text-center rounded border transition-colors ${sheetConfig.width === 2440 && sheetConfig.height === 1850 ? 'bg-[#f0a144]/20 border-[#f0a144] text-white' : 'bg-[#1a1a1a] border-[#333333] text-[#aaaaaa] hover:bg-[#333333]'}`}
                      >
                        MDF / DUPROLAC
                        <br/><span className="text-[#666666] font-mono text-[7px]">2440 x 1850 mm</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Dimensión Plancha</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#1a1a1a] border border-[#333333] p-2 rounded">
                        <span className="text-[8px] text-[#666666] block mb-1">ANCHO (X)</span>
                        <input 
                          type="number" 
                          value={sheetConfig.width === 0 ? '' : sheetConfig.width} 
                          onChange={(e) => onUpdateSheetConfig({ ...sheetConfig, width: parseInt(e.target.value) || 0 })}
                          className="bg-transparent border-none outline-none text-white text-xs font-mono w-full"
                        />
                      </div>
                      <div className="bg-[#1a1a1a] border border-[#333333] p-2 rounded">
                        <span className="text-[8px] text-[#666666] block mb-1">LARGO (Y)</span>
                        <input 
                          type="number" 
                          value={sheetConfig.height === 0 ? '' : sheetConfig.height} 
                          onChange={(e) => onUpdateSheetConfig({ ...sheetConfig, height: parseInt(e.target.value) || 0 })}
                          className="bg-transparent border-none outline-none text-white text-xs font-mono w-full"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Herramienta / Corte</label>
                    <div className="bg-[#1a1a1a] border border-[#333333] p-2 rounded">
                      <span className="text-[8px] text-[#666666] block mb-1">ESPESOR SIERRA (MERMA)</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={sheetConfig.kerf === 0 ? '' : sheetConfig.kerf} 
                          step="0.5"
                          onChange={(e) => onUpdateSheetConfig({ ...sheetConfig, kerf: parseFloat(e.target.value) || 0 })}
                          className="bg-transparent border-none outline-none text-[#f0a144] text-xs font-mono w-full"
                        />
                        <span className="text-[9px] text-[#666666] font-mono">MM</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Márgenes / Refilado</label>
                    <div className="bg-[#1a1a1a] border border-[#333333] p-2 rounded">
                      <span className="text-[8px] text-[#666666] block mb-1">RECORTE PERIMETRAL</span>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={sheetConfig.margin === 0 ? '' : sheetConfig.margin} 
                          onChange={(e) => onUpdateSheetConfig({ ...sheetConfig, margin: parseInt(e.target.value) || 0 })}
                          className="bg-transparent border-none outline-none text-[#da3c3c] text-xs font-mono w-full"
                        />
                        <span className="text-[9px] text-[#666666] font-mono">MM</span>
                      </div>
                    </div>
                  </div>

                  {onUpdateEdgeThicknessConfig && (
                    <div className="space-y-2">
                      <label className="text-[9px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Grosores de Canto (Descuento)</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-[#1a1a1a] border border-red-950/60 p-2 rounded">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span>
                            <span className="text-[8px] text-[#aaaaaa] font-bold">CANTO GRUESO</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number"
                              step="0.5"
                              min="0"
                              max="10"
                              value={edgeThicknessConfig.grueso}
                              onChange={(e) => onUpdateEdgeThicknessConfig({ ...edgeThicknessConfig, grueso: parseFloat(e.target.value) || 0 })}
                              className="bg-transparent border-none outline-none text-red-400 text-xs font-mono font-bold w-full"
                            />
                            <span className="text-[9px] text-[#666666] font-mono">MM</span>
                          </div>
                        </div>
                        <div className="bg-[#1a1a1a] border border-blue-950/60 p-2 rounded">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                            <span className="text-[8px] text-[#aaaaaa] font-bold">CANTO DELGADO</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number"
                              step="0.1"
                              min="0"
                              max="5"
                              value={edgeThicknessConfig.delgado}
                              onChange={(e) => onUpdateEdgeThicknessConfig({ ...edgeThicknessConfig, delgado: parseFloat(e.target.value) || 0 })}
                              className="bg-transparent border-none outline-none text-blue-400 text-xs font-mono font-bold w-full"
                            />
                            <span className="text-[9px] text-[#666666] font-mono">MM</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[7.5px] text-[#777777] block font-mono leading-tight">
                        * El Canto Grueso descuenta {edgeThicknessConfig.grueso}mm por lado en las medidas de corte.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: STATS */}
              {activeSettingsTab === 'stats' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-[#181818] border border-[#333333] rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-3.5 h-3.5 text-[#f0a144]" />
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Resumen de Métricas</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#888]">PIEZAS TOTALES:</span>
                        <span className="text-white font-mono font-bold bg-[#242424] px-1.5 py-0.5 rounded">{pieces.reduce((acc, p) => acc + p.cantidad, 0)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#888]">ÁREA USADA:</span>
                        <span className="text-white font-mono font-bold">{(totalStats.areaUsed / 1000000).toFixed(3)} m²</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#888]">PIEZAS ÚNICAS:</span>
                        <span className="text-white font-mono font-bold">{pieces.length}</span>
                      </div>
                      <div className="h-px bg-[#2d2d2d] my-1" />
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#3b82f6] font-bold">CANTO DELGADO:</span>
                        <span className="text-[#3b82f6] font-mono font-bold">{edgebandingTotals.thin} m</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="text-[#ef4444] font-bold">CANTO GRUESO:</span>
                        <span className="text-[#ef4444] font-mono font-bold">{edgebandingTotals.thick} m</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Sticky Bottom Footer with PDF Export Button */}
            <div className="p-3 border-t border-[#2d2d2d] bg-[#1a1a1a] shrink-0">
              <button 
                type="button"
                onClick={() => setShowPdfExport(true)}
                className="w-full bg-[#f0a144] hover:bg-[#ffb055] text-black font-extrabold border border-[#f0a144] py-2.5 rounded-lg flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider transition-all shadow-lg active:scale-98"
              >
                <FileText className="w-3.5 h-3.5" />
                Imprimir / Exportar PDF de Taller
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Exportación Didáctica en PDF para Taller de Carpintería */}
      <PdfExportModal
        isOpen={showPdfExport}
        onClose={() => setShowPdfExport(false)}
        boardGroups={boardGroups}
        pieces={pieces}
        sheetConfig={sheetConfig}
        edgeThicknessConfig={edgeThicknessConfig || DEFAULT_EDGE_THICKNESS_CONFIG}
        projectName="Proyecto de Carpintería"
      />

      {/* Modal de Consolidado y Cálculo de Materiales (Melamina, MDF, Vidrio, Tapacantos) */}
      <MaterialSummaryModal
        isOpen={showMaterialSummaryModal}
        onClose={() => setShowMaterialSummaryModal(false)}
        boardGroups={boardGroups}
        totalStats={totalStats}
      />
    </div>
  );
}

