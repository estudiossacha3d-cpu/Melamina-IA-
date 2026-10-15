import React, { useState, useMemo } from 'react';
import { 
  X, Sliders, Box, Layers, Palette, RefreshCw, Check,
  ArrowRight, Download, Star, Sparkles, LayoutGrid, SplitSquareVertical,
  Maximize2, Minimize2, Eye, ShieldCheck, ChevronRight, ChevronUp, ChevronDown, 
  Info, MoreHorizontal, Plus, Scissors, ZoomIn, ZoomOut, RotateCw, ExternalLink,
  BarChart3, FileSpreadsheet
} from 'lucide-react';
import { Piece, DynamicFurnitureItem, SheetConfig } from '../types';
import { 
  DynamicShelfConfig, 
  DEFAULT_SHELF_CONFIG, 
  DivisionStyle,
  generateDynamicShelfPieces, 
  calculateShelfMetrics,
  createDynamicShelfItem 
} from '../lib/dynamicShelfGenerator';
import Warehouse3DPreview from './Warehouse3DPreview';
import { CutPiecesTable } from './CutPiecesTable';
import CutPlanViewer from './CutPlanViewer';
import { DEFAULT_EDGE_THICKNESS_CONFIG, getPieceEdgeLengths } from '../lib/edgeCalculations';
import { professionalPack, PackedBoardResult } from '../lib/cutOptimizer';
import { getPieceMaterialProfile } from '../lib/materialCalculations';

interface DynamicShelfModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTo3D: (pieces: Piece[], mode: 'replace' | 'insert') => void;
  onOpen2DCutPlan?: (pieces: Piece[]) => void;
  onSaveToWarehouse?: (item: DynamicFurnitureItem) => void;
  onSaveAsAppDefault?: (item: DynamicFurnitureItem) => Promise<boolean>;
  initialConfig?: Partial<DynamicShelfConfig>;
  initialItemName?: string;
  sheetConfig?: SheetConfig;
  existingPiecesCount?: number;
}

const MATERIAL_OPTIONS = [
  { name: 'Blanco', color: '#ecebe6', border: '#d1d5db' },
  { name: 'Blanco Humo', color: '#f3f4f6', border: '#e5e7eb' },
  { name: 'Roble Natural', color: '#c8a882', border: '#a5825d' },
  { name: 'Coñac', color: '#8d5b36', border: '#6c4323' },
  { name: 'Macadamia', color: '#d5bca2', border: '#b59a7d' },
  { name: 'Rovere', color: '#bfa58a', border: '#9e8469' },
  { name: 'Nogal', color: '#5a3d28', border: '#3e2717' },
  { name: 'Gris Grafito', color: '#374151', border: '#1f2937' },
  { name: 'Negro', color: '#1f2937', border: '#111827' },
];

export const DynamicShelfModal: React.FC<DynamicShelfModalProps> = ({
  isOpen,
  onClose,
  onApplyTo3D,
  onOpen2DCutPlan,
  onSaveToWarehouse,
  onSaveAsAppDefault,
  initialConfig,
  initialItemName,
  sheetConfig = { width: 2440, height: 2140, kerf: 3, margin: 10 },
  existingPiecesCount = 0
}) => {
  const hasExistingPieces = existingPiecesCount > 0;
  const [config, setConfig] = useState<DynamicShelfConfig>(() => ({
    ...DEFAULT_SHELF_CONFIG,
    ...(initialConfig || {})
  }));

  const [furnitureName, setFurnitureName] = useState<string>(
    initialItemName || 'Estante Dinámico Inteligente'
  );

  // Desktop active tab
  const [activeTab, setActiveTab] = useState<'params' | 'pieces'>('params');

  // Viewport tracking for strict single-Canvas mounting (prevents WebGL context exhaustion)
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  React.useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync incoming initialConfig and initialItemName when opened
  React.useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setConfig({
          ...DEFAULT_SHELF_CONFIG,
          ...initialConfig
        });
      } else {
        setConfig({ ...DEFAULT_SHELF_CONFIG });
      }
      if (initialItemName) {
        setFurnitureName(initialItemName);
      }
      setPieceOverrides({});
      setSelectedPieceIds([]);
    }
  }, [isOpen, initialConfig, initialItemName]);

  // Mobile active tab: '3d' (Diseño 3D & Parámetros con ventana dinámica) | 'params' (Parámetros) | 'pieces' (Despiece / Gráficos 2D)
  const [mobileTab, setMobileTab] = useState<'3d' | 'params' | 'pieces'>('3d');
  // Dynamic floating window mode on mobile: 'peek' (media pantalla ~48%) | 'expanded' (pantalla casi completa ~86%) | 'minimized' (píldora flotante compacta)
  const [mobileDynamicWindowMode, setMobileDynamicWindowMode] = useState<'peek' | 'expanded' | 'minimized'>('peek');
  // Sub-tab inside mobile dynamic window: 'medidas' | 'repisas' | 'divisiones' | 'estructura' | 'material' | 'presets'
  const [mobileParamSubTab, setMobileParamSubTab] = useState<'medidas' | 'repisas' | 'divisiones' | 'estructura' | 'material' | 'presets'>('medidas');
  const [showMobileMoreMenu, setShowMobileMoreMenu] = useState(false);

  // Sub-tab inside Despiece: 'diagram' (Gráficos 2D de cortes) | 'table' (Demanda de piezas) | 'split' (Vista dividida)
  const [despieceSubTab, setDespieceSubTab] = useState<'table' | 'diagram' | 'split'>('diagram');
  const [diagramZoom, setDiagramZoom] = useState<number>(0.35);

  // CutPiecesTable interaction state
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [hoveredPieceId, setHoveredPieceId] = useState<string | null>(null);
  const [pieceOverrides, setPieceOverrides] = useState<Record<string, Partial<Piece>>>({});

  const [localSheetConfig, setLocalSheetConfig] = useState<SheetConfig>(
    sheetConfig || { width: 2440, height: 1830, kerf: 4, margin: 15 }
  );

  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Sync incoming sheetConfig if prop updates
  React.useEffect(() => {
    if (sheetConfig) {
      setLocalSheetConfig(sheetConfig);
    }
  }, [sheetConfig]);

  // Re-generate pieces dynamically whenever config changes, applying any manual user overrides
  const pieces = useMemo(() => {
    const base = generateDynamicShelfPieces(config);
    if (Object.keys(pieceOverrides).length === 0) return base;
    return base.map(p => {
      const over = pieceOverrides[p.id];
      return over ? { ...p, ...over } : p;
    });
  }, [config, pieceOverrides]);

  const metrics = useMemo(() => {
    return calculateShelfMetrics(config, pieces);
  }, [config, pieces]);

  const totalEdgeMeters = useMemo(() => {
    let m = 0;
    pieces.forEach(p => {
      const c = p.cantos;
      if (!c) return;
      const qty = p.cantidad || 1;
      const edgeLens = getPieceEdgeLengths(p);
      if (c.largo1 && c.largo1 !== 'Ninguno') m += (edgeLens.largo1 / 1000) * qty;
      if (c.largo2 && c.largo2 !== 'Ninguno') m += (edgeLens.largo2 / 1000) * qty;
      if (c.ancho1 && c.ancho1 !== 'Ninguno') m += (edgeLens.ancho1 / 1000) * qty;
      if (c.ancho2 && c.ancho2 !== 'Ninguno') m += (edgeLens.ancho2 / 1000) * qty;
    });
    return m.toFixed(1);
  }, [pieces]);

  // Group pieces for the exact 2D Demanda Table format
  const groupedPieces = useMemo(() => {
    const groups: {
      key: string;
      ids: string[];
      totalQuantity: number;
      representative: Piece;
    }[] = [];

    pieces.forEach(p => {
      const isTransversal = Boolean(p.veta && (p.vetaOrientacion === 'transversal' || p.vetaRotation === 90 || p.vetaRotation === 270));
      const vetaKey = p.veta ? (isTransversal ? 'veta-trans-90' : 'veta-long-0') : (p.rotacion ? 'rot-free' : 'rot-lock');
      const ranuraKey = p.ranurado ? `ran-${p.ranuraConfig?.lado || 'L1'}` : 'noran';
      const key = `${Math.round(p.largo)}-${Math.round(p.ancho)}-${p.espesor || 18}-${p.cantos?.largo1}-${p.cantos?.largo2}-${p.cantos?.ancho1}-${p.cantos?.ancho2}-${p.material || ''}-${p.customColor || ''}-${vetaKey}-${ranuraKey}`;
      const group = groups.find(g => g.key === key);
      if (group) {
        group.ids.push(p.id);
        group.totalQuantity += (p.cantidad || 1);
      } else {
        groups.push({
          key,
          ids: [p.id],
          totalQuantity: p.cantidad || 1,
          representative: { ...p }
        });
      }
    });

    return groups;
  }, [pieces]);

  // Calculate 2D packed cutting boards for visual 2D cutting graphics
  const packed2DResult = useMemo(() => {
    // Separate pieces by substrate / thickness (melamina 18mm vs fondo 3mm)
    const groupsMap: Record<string, { profile: ReturnType<typeof getPieceMaterialProfile>; pieces: Piece[] }> = {};
    pieces.forEach(p => {
      const profile = getPieceMaterialProfile(p);
      if (!groupsMap[profile.groupKey]) {
        groupsMap[profile.groupKey] = { profile, pieces: [] };
      }
      groupsMap[profile.groupKey].pieces.push(p);
    });

    const boardGroupsList: {
      displayName: string;
      materialColor: string;
      thickness: number;
      config: SheetConfig;
      pack: ReturnType<typeof professionalPack>;
    }[] = [];

    Object.values(groupsMap).forEach(({ profile, pieces: grpPieces }) => {
      let cfg = { ...localSheetConfig };
      if (profile.substrate === 'mdf' && profile.thickness === 3) {
        cfg = { ...localSheetConfig, width: 2440, height: 1850 };
      }
      const packed = professionalPack(grpPieces, cfg);
      boardGroupsList.push({
        displayName: profile.displayName,
        materialColor: profile.color,
        thickness: profile.thickness,
        config: cfg,
        pack: packed
      });
    });

    return boardGroupsList;
  }, [pieces, localSheetConfig]);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => setSaveToast(null), 3500);
  };

  const handleApply = (mode: 'replace' | 'insert') => {
    onApplyTo3D(pieces, mode);
    onClose();
  };

  const handleOpenCutPlan = () => {
    if (onOpen2DCutPlan) {
      onOpen2DCutPlan(pieces);
    } else {
      onApplyTo3D(pieces, 'replace');
    }
    onClose();
  };

  const handleSaveWarehouse = () => {
    if (onSaveToWarehouse) {
      const item = createDynamicShelfItem(config, furnitureName);
      onSaveToWarehouse(item);
      showNotification(`Mueble "${furnitureName}" guardado en tu almacén`);
      setShowMobileMoreMenu(false);
    }
  };

  const handleResetToOriginalReference = () => {
    setConfig({ ...DEFAULT_SHELF_CONFIG });
    setPieceOverrides({});
    setFurnitureName('Nuevo Mueble Modular (Referencia)');
    showNotification('Restablecido a las medidas del modelo de referencia');
  };

  const handleUpdatePiece = (id: string, updates: Partial<Piece>) => {
    setPieceOverrides(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...updates }
    }));
  };

  const handleSetPieces: React.Dispatch<React.SetStateAction<Piece[]>> = (valOrFn) => {
    if (typeof valOrFn === 'function') {
      const updated = (valOrFn as any)(pieces);
      const overrides: Record<string, Partial<Piece>> = {};
      updated.forEach((p: Piece) => {
        overrides[p.id] = p;
      });
      setPieceOverrides(overrides);
    } else {
      const overrides: Record<string, Partial<Piece>> = {};
      valOrFn.forEach((p: Piece) => {
        overrides[p.id] = p;
      });
      setPieceOverrides(overrides);
    }
  };

  const handleToggleSelection = (id: string, multiSelect: boolean) => {
    if (multiSelect) {
      setSelectedPieceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelectedPieceIds([id]);
    }
  };

  // Quick structural presets
  const applyPreset = (presetName: string) => {
    setPieceOverrides({});
    if (presetName === 'ref' || presetName === 'mdf-ranurado') {
      setConfig(prev => ({
        ...prev,
        totalHeight: 2100,
        totalWidth: 636,
        totalDepth: 400,
        thickness: 18,
        shelfCount: 4,
        verticalDivisions: 0,
        divisionStyle: 'continuous_vertical',
        includePlinth: true,
        plinthHeight: 80,
        includeBack: true,
        backThickness: 4,
        backType: 'ranurado',
        backGrooveDist: 18,
        backGrooveDepth: 8
      }));
      setFurnitureName('Estante Modular con MDF Ranurado (636×2100×400)');
      showNotification('Preset: Estante con MDF Ranurado (4mm embutido en piezas)');
    } else if (presetName === 'mdf-sobrepuesto') {
      setConfig(prev => ({
        ...prev,
        totalHeight: 2100,
        totalWidth: 636,
        totalDepth: 400,
        thickness: 18,
        shelfCount: 4,
        verticalDivisions: 0,
        divisionStyle: 'continuous_vertical',
        includePlinth: true,
        plinthHeight: 80,
        includeBack: true,
        backThickness: 4,
        backType: 'sobrepuesto',
        backGrooveDist: 18,
        backGrooveDepth: 8
      }));
      setFurnitureName('Estante Modular Respaldo Clavado / Sobrepuesto (636×2100×400)');
      showNotification('Preset: Estante con Respaldo Clavado / Sobrepuesto');
    } else if (presetName === 'librero-2col') {
      setConfig(prev => ({
        ...prev,
        totalHeight: 1800,
        totalWidth: 1200,
        totalDepth: 350,
        shelfCount: 4,
        verticalDivisions: 1,
        divisionStyle: 'continuous_vertical',
        includePlinth: true,
        plinthHeight: 80,
        includeBack: true,
        backType: 'ranurado'
      }));
      setFurnitureName('Librero 2 Cuerpos (1200×1800)');
      showNotification('Preset: Librero 2 Columnas');
    } else if (presetName === 'aparador-3col') {
      setConfig(prev => ({
        ...prev,
        totalHeight: 900,
        totalWidth: 1500,
        totalDepth: 380,
        shelfCount: 1,
        verticalDivisions: 2,
        divisionStyle: 'continuous_vertical',
        includePlinth: true,
        plinthHeight: 80,
        includeBack: true,
        backType: 'ranurado'
      }));
      setFurnitureName('Aparador Bajo 3 Nichos (1500×900)');
      showNotification('Preset: Aparador Bajo');
    } else if (presetName === 'asimetrico') {
      setConfig(prev => ({
        ...prev,
        totalHeight: 1900,
        totalWidth: 1300,
        totalDepth: 320,
        shelfCount: 4,
        verticalDivisions: 2,
        divisionStyle: 'staggered',
        staggerPattern: 'offset',
        includePlinth: true,
        plinthHeight: 80,
        includeBack: true,
        backType: 'ranurado'
      }));
      setFurnitureName('Librero Asimétrico Moderno (1300×1900)');
      showNotification('Preset: Diseño Asimétrico Especial');
    }
  };

  // Render Form Sections Component
  const renderParametricForm = () => (
    <div className="space-y-3.5 pb-2">
      {/* Presets Rápidos */}
      <div className="bg-[#171926] border border-[#262a3d] p-2.5 rounded-xl flex items-center gap-1.5 overflow-x-auto text-[10px] shrink-0 no-scrollbar">
        <span className="text-gray-400 font-bold px-1 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> Presets:
        </span>
        <button
          type="button"
          onClick={() => applyPreset('mdf-ranurado')}
          className={`px-2.5 py-1 rounded border shrink-0 transition-all font-bold flex items-center gap-1 ${
            (config.backType ?? 'ranurado') === 'ranurado' && config.verticalDivisions === 0 && config.shelfCount === 4
              ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-xs'
              : 'bg-[#222536] hover:bg-[#2e334a] text-gray-300 border-[#33374f]'
          }`}
          title="Estante con fondo MDF 4mm ranurado (ranuras CNC a 18mm del borde)"
        >
          <span>✂️ MDF Ranurado (636×2100)</span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset('mdf-sobrepuesto')}
          className={`px-2.5 py-1 rounded border shrink-0 transition-all font-bold flex items-center gap-1 ${
            config.backType === 'sobrepuesto' && config.verticalDivisions === 0 && config.shelfCount === 4
              ? 'bg-purple-500/25 text-purple-300 border-purple-500/60 shadow-xs'
              : 'bg-[#222536] hover:bg-[#2e334a] text-gray-300 border-[#33374f]'
          }`}
          title="Estante original con fondo MDF sobrepuesto/clavado por detrás"
        >
          <span>🔨 Respaldo Clavado (636×2100)</span>
        </button>
        <button
          type="button"
          onClick={() => applyPreset('librero-2col')}
          className="px-2 py-1 bg-[#222536] hover:bg-[#2e334a] text-gray-300 rounded border border-[#33374f] shrink-0 transition-colors"
        >
          2 Columnas
        </button>
        <button
          type="button"
          onClick={() => applyPreset('aparador-3col')}
          className="px-2 py-1 bg-[#222536] hover:bg-[#2e334a] text-gray-300 rounded border border-[#33374f] shrink-0 transition-colors"
        >
          Aparador Bajo
        </button>
        <button
          type="button"
          onClick={() => applyPreset('asimetrico')}
          className="px-2 py-1 bg-[#222536] hover:bg-[#2e334a] text-amber-300 rounded border border-amber-500/30 shrink-0 transition-colors"
        >
          🎲 Asimétrico
        </button>
      </div>

      {/* SECCIÓN 1: DIMENSIONES GENERALES */}
      <div className="bg-[#1c1e2b] border border-[#2c3044] rounded-xl p-3 sm:p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2a2d40] pb-2">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-[#f0a144]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Dimensiones Exteriores</span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">Espesor: {config.thickness} mm</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Altura */}
          <div className="space-y-1 bg-[#151722] p-2 rounded-lg border border-[#252839]">
            <div className="flex justify-between items-center text-xs">
              <label className="text-gray-300 font-medium">Altura (H)</label>
              <span className="font-mono text-[#f0a144] font-bold text-sm">{config.totalHeight} mm</span>
            </div>
            <input
              type="range"
              min="400"
              max="2800"
              step="10"
              value={config.totalHeight}
              onChange={(e) => setConfig(prev => ({ ...prev, totalHeight: Number(e.target.value) }))}
              className="w-full accent-[#f0a144] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>400</span>
              <span>2100 (ref)</span>
              <span>2800</span>
            </div>
          </div>

          {/* Ancho */}
          <div className="space-y-1 bg-[#151722] p-2 rounded-lg border border-[#252839]">
            <div className="flex justify-between items-center text-xs">
              <label className="text-gray-300 font-medium">Ancho (W)</label>
              <span className="font-mono text-[#f0a144] font-bold text-sm">{config.totalWidth} mm</span>
            </div>
            <input
              type="range"
              min="300"
              max="3000"
              step="10"
              value={config.totalWidth}
              onChange={(e) => setConfig(prev => ({ ...prev, totalWidth: Number(e.target.value) }))}
              className="w-full accent-[#f0a144] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>300</span>
              <span>636 (ref)</span>
              <span>3000</span>
            </div>
          </div>

          {/* Profundidad */}
          <div className="space-y-1 bg-[#151722] p-2 rounded-lg border border-[#252839]">
            <div className="flex justify-between items-center text-xs">
              <label className="text-gray-300 font-medium">Profundidad (D)</label>
              <span className="font-mono text-[#f0a144] font-bold text-sm">{config.totalDepth} mm</span>
            </div>
            <input
              type="range"
              min="180"
              max="800"
              step="10"
              value={config.totalDepth}
              onChange={(e) => setConfig(prev => ({ ...prev, totalDepth: Number(e.target.value) }))}
              className="w-full accent-[#f0a144] cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-gray-500 font-mono">
              <span>180</span>
              <span>400 (ref)</span>
              <span>800</span>
            </div>
          </div>
        </div>

        {/* Espesor Tablero */}
        <div className="flex items-center justify-between pt-1 border-t border-[#252839] text-xs">
          <span className="text-gray-400">Espesor Melamina:</span>
          <div className="flex gap-1.5">
            {[15, 18, 25, 36].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, thickness: t }))}
                className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                  config.thickness === t
                    ? 'bg-[#f0a144] text-black shadow-xs'
                    : 'bg-[#252839] text-gray-400 hover:text-white'
                }`}
              >
                {t} mm
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECCIÓN 2: REPISAS Y DISTRIBUCIÓN HORIZONTAL */}
      <div className="bg-[#1c1e2b] border border-[#2c3044] rounded-xl p-3 sm:p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2a2d40] pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Repisas Horizontales</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <div className="bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
              Luz: ~{metrics.shelfClearHeight} mm
            </div>
            <div className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
              (config.backType ?? 'ranurado') === 'ranurado'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
            }`}>
              Prof: {metrics.shelfDepth} mm {(config.backType ?? 'ranurado') === 'ranurado' ? '(más cortas)' : ''}
            </div>
            {config.verticalDivisions > 0 && config.divisionStyle !== 'continuous_vertical' && (
              <div 
                className="bg-emerald-500/15 text-emerald-300 text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1"
                title={metrics.shelfDepth > metrics.shelfClearHeight 
                  ? "Espacio reducido entre repisas: el canto frontal se reubicó en Ancho 1 (C: A1) y se muestra visible al frente en el modelo 3D." 
                  : "Los divisores verticales tienen su canto frontal expuesto al frente (C: L1)."}
              >
                <span>🪵 Divisores {metrics.shelfDepth > metrics.shelfClearHeight ? '(C: A1 Frente)' : '(C: L1 Frente)'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-200">Cantidad de repisas intermedias</div>
            <div className="text-[10px] text-gray-400">
              Total de niveles útiles: <strong className="text-white">{config.shelfCount + 1} espacios</strong>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#12131b] p-1 rounded-lg border border-[#2a2d3e]">
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, shelfCount: Math.max(0, prev.shelfCount - 1) }))}
              className="w-8 h-8 flex items-center justify-center bg-[#25283a] hover:bg-[#32364e] text-white rounded font-bold transition-colors text-base"
            >
              -
            </button>
            <span className="w-9 text-center font-mono font-bold text-[#f0a144] text-base">
              {config.shelfCount}
            </span>
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, shelfCount: Math.min(12, prev.shelfCount + 1) }))}
              className="w-8 h-8 flex items-center justify-center bg-[#25283a] hover:bg-[#32364e] text-white rounded font-bold transition-colors text-base"
            >
              +
            </button>
          </div>
        </div>

        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={config.shelfCount}
          onChange={(e) => setConfig(prev => ({ ...prev, shelfCount: Number(e.target.value) }))}
          className="w-full accent-emerald-400 cursor-pointer"
        />
      </div>

      {/* SECCIÓN 3: DIVISIONES EN MEDIO (DISEÑOS ESPECIALES) */}
      <div className="bg-[#1c1e2b] border border-[#2c3044] rounded-xl p-3 sm:p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2a2d40] pb-2">
          <div className="flex items-center gap-2">
            <SplitSquareVertical className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              Divisiones en Medio (Diseños Especiales)
            </span>
          </div>
          <div className="bg-sky-500/15 text-sky-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-sky-500/30">
            {config.verticalDivisions === 0
              ? 'Columna Única'
              : config.divisionStyle === 'staggered'
              ? `${config.verticalDivisions + 1} Casilleros Alternos`
              : `${config.verticalDivisions + 1} Cuerpos (~${metrics.bayWidth} mm/cuerpo)`}
          </div>
        </div>

        {/* Selector de número de divisiones */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-200">Parantes divisorios verticales</div>
            <div className="text-[10px] text-gray-400">
              Divide a lo ancho en columnas o casilleros
            </div>
          </div>

          <div className="flex items-center gap-1 bg-[#12131b] p-1 rounded-lg border border-[#2a2d3e]">
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, verticalDivisions: Math.max(0, prev.verticalDivisions - 1) }))}
              className="w-8 h-8 flex items-center justify-center bg-[#25283a] hover:bg-[#32364e] text-white rounded font-bold transition-colors text-base"
            >
              -
            </button>
            <span className="w-9 text-center font-mono font-bold text-sky-400 text-base">
              {config.verticalDivisions}
            </span>
            <button
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, verticalDivisions: Math.min(6, prev.verticalDivisions + 1) }))}
              className="w-8 h-8 flex items-center justify-center bg-[#25283a] hover:bg-[#32364e] text-white rounded font-bold transition-colors text-base"
            >
              +
            </button>
          </div>
        </div>

        {/* Selector rápido de divisiones */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          {[
            { count: 0, label: '0 (1 Col)' },
            { count: 1, label: '1 (2 Col)' },
            { count: 2, label: '2 (3 Col)' },
            { count: 3, label: '3 (4 Col)' },
          ].map(item => (
            <button
              key={item.count}
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, verticalDivisions: item.count }))}
              className={`py-1.5 px-1.5 rounded text-[10px] font-bold text-center transition-all ${
                config.verticalDivisions === item.count
                  ? 'bg-sky-500 text-black shadow-xs font-black'
                  : 'bg-[#222536] hover:bg-[#2c3044] text-gray-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Estilo estructural de división (si tiene al menos 1 división) */}
        {config.verticalDivisions > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-[#272a3b]">
            <label className="text-[11px] font-medium text-gray-300">
              Estilo estructural del diseño:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, divisionStyle: 'continuous_vertical' }))}
                className={`p-2 rounded-lg border text-left transition-all ${
                  config.divisionStyle === 'continuous_vertical'
                    ? 'bg-sky-500/20 border-sky-500 text-white shadow-xs'
                    : 'bg-[#181a26] border-[#292d3f] text-gray-400 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold text-sky-300 mb-0.5">Montantes Continuos</div>
                <div className="text-[9.5px] text-gray-400 leading-tight">
                  Divisiones de piso a techo completas.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, divisionStyle: 'continuous_horizontal' }))}
                className={`p-2 rounded-lg border text-left transition-all ${
                  config.divisionStyle === 'continuous_horizontal'
                    ? 'bg-sky-500/20 border-sky-500 text-white shadow-xs'
                    : 'bg-[#181a26] border-[#292d3f] text-gray-400 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold text-sky-300 mb-0.5">Repisas Continuas</div>
                <div className="text-[9.5px] text-gray-400 leading-tight">
                  Repisas completas con separadores intermedios.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setConfig(prev => ({ ...prev, divisionStyle: 'staggered', staggerPattern: prev.staggerPattern || 'offset' }))}
                className={`p-2 rounded-lg border text-left transition-all ${
                  config.divisionStyle === 'staggered'
                    ? 'bg-amber-500/20 border-amber-500 text-white shadow-xs'
                    : 'bg-[#181a26] border-[#292d3f] text-gray-400 hover:text-white'
                }`}
              >
                <div className="text-[11px] font-bold text-amber-300 mb-0.5">🎲 Casilleros Alternos</div>
                <div className="text-[9.5px] text-gray-400 leading-tight">
                  Diseño asimétrico moderno tipo cubos nórdicos.
                </div>
              </button>
            </div>

            {/* Selector de Patrón de Alternancia para Casilleros Alternos */}
            {config.divisionStyle === 'staggered' && (
              <div className="p-2.5 bg-[#131520] border border-amber-500/35 rounded-xl space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                    Patrón de Alternancia de Casilleros:
                  </span>
                  <span className="text-[9px] text-amber-400 font-mono font-bold bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                    {(config.staggerPattern || 'offset') === 'offset' ? '⚡ Zig-Zag Nórdico' : '🧱 Aparejo Trabado'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, staggerPattern: 'offset' }))}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      (config.staggerPattern || 'offset') === 'offset'
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow-xs'
                        : 'bg-[#1a1c29] border-[#2c3044] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10.5px] font-bold text-amber-300 flex items-center gap-1">
                      ⚡ Zig-Zag Nórdico
                    </div>
                    <div className="text-[9px] text-gray-400 leading-tight mt-0.5">
                      Alterna anchos rítmicamente en cada nivel (ancho/estrecho)
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, staggerPattern: 'brick' }))}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      config.staggerPattern === 'brick'
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow-xs'
                        : 'bg-[#1a1c29] border-[#2c3044] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className="text-[10.5px] font-bold text-amber-300 flex items-center gap-1">
                      🧱 Aparejo Trabado
                    </div>
                    <div className="text-[9px] text-gray-400 leading-tight mt-0.5">
                      Intercala divisores centrados estilo nichos cruzados
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECCIÓN 4: BASE, ZÓCALO Y FONDO */}
      <div className="bg-[#1c1e2b] border border-[#2c3044] rounded-xl p-3 sm:p-3.5 space-y-3">
        <div className="flex items-center gap-2 border-b border-[#2a2d40] pb-2">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">Estructura Base y Refuerzo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Zócalo */}
          <div className="bg-[#161722] p-2.5 rounded-lg border border-[#272b3c] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-200 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includePlinth}
                  onChange={(e) => setConfig(prev => ({ ...prev, includePlinth: e.target.checked }))}
                  className="accent-[#f0a144] rounded w-4 h-4"
                />
                <span className="font-bold">Zócalo Inferior (Base)</span>
              </label>
              {config.includePlinth && (
                <span className="font-mono text-xs text-[#f0a144] font-bold">{config.plinthHeight} mm</span>
              )}
            </div>
            {config.includePlinth && (
              <div className="space-y-1">
                <input
                  type="range"
                  min="40"
                  max="150"
                  step="5"
                  value={config.plinthHeight}
                  onChange={(e) => setConfig(prev => ({ ...prev, plinthHeight: Number(e.target.value) }))}
                  className="w-full accent-[#f0a144] cursor-pointer"
                />
                <div className="text-[9.5px] text-gray-400">
                  Zócalo frontal y posterior retranqueado (fiel al modelo original).
                </div>
              </div>
            )}
          </div>

          {/* Fondo o Respaldo */}
          <div className="bg-[#161722] p-2.5 rounded-lg border border-[#272b3c] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-200 flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeBack}
                  onChange={(e) => setConfig(prev => ({ ...prev, includeBack: e.target.checked }))}
                  className="accent-purple-400 rounded w-4 h-4"
                />
                <span className="font-bold">Fondo / Respaldo Trasero</span>
              </label>
              {config.includeBack && (
                <span className="font-mono text-xs text-purple-400 font-bold">{config.backThickness} mm</span>
              )}
            </div>

            {config.includeBack && (
              <div className="space-y-2 pt-1 border-t border-[#252838]">
                {/* Selector de grosor de fondo */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span>Grosor de fondo o respaldo:</span>
                    <span className="font-mono font-bold text-amber-300">{config.backThickness} mm</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
                    {[3, 4, 5.5, 6, 9, 15, 18].map(th => (
                      <button
                        key={th}
                        type="button"
                        onClick={() => setConfig(prev => ({ ...prev, backThickness: th }))}
                        className={`py-1 px-1 rounded text-center text-[9.5px] font-mono font-bold transition-all cursor-pointer ${
                          config.backThickness === th
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-[#1e202d] text-gray-400 hover:text-white border border-[#2a2d3e]'
                        }`}
                      >
                        {th}mm
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo de montaje: Ranurado vs Sobrepuesto */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 block">Tipo de ensamble de fondo:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, backType: 'ranurado' }))}
                      className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                        (config.backType ?? 'ranurado') === 'ranurado'
                          ? 'bg-amber-500/15 border-amber-500 text-amber-200'
                          : 'bg-[#1a1b26] border-[#292c3c] text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-[10px] flex items-center gap-1">
                        <span>✂️ Ranurado 3D (18mm)</span>
                      </div>
                      <div className="text-[8.5px] text-gray-400 mt-0.5 leading-tight">
                        Fondo embutido en ranura a 18mm. Repisas interiores acortadas a {metrics.shelfDepth}mm (hacen tope exacto).
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setConfig(prev => ({ ...prev, backType: 'sobrepuesto' }))}
                      className={`p-1.5 rounded-lg border text-left cursor-pointer transition-all ${
                        config.backType === 'sobrepuesto'
                          ? 'bg-purple-500/15 border-purple-500 text-purple-200'
                          : 'bg-[#1a1b26] border-[#292c3c] text-gray-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-[10px] flex items-center gap-1">
                        <span>🔨 Sobrepuesto</span>
                      </div>
                      <div className="text-[8.5px] text-gray-400 mt-0.5 leading-tight">
                        Clavado/atornillado exterior. Repisas interiores completas a {metrics.shelfDepth}mm.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="text-[9.5px] text-gray-400">
              {config.includeBack 
                ? `Fondo de ${config.backThickness}mm ${config.backType === 'sobrepuesto' ? 'sobrepuesto' : 'embutido en ranura'} para cuadrar el mueble.`
                : 'Mueble abierto sin fondo (tipo celosía divisoria).'
              }
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN: PUERTAS EN MELAMINA (SUPER INTERACTIVO) */}
      <div className="bg-[#1c1e2b] border border-[#2c3044] rounded-xl p-3 sm:p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2a2d40] pb-2">
          <div className="flex items-center gap-2">
            <span className="text-base">🚪</span>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block">Puertas en Melamina</span>
              <span className="text-[9.5px] text-gray-400">Compartida en 2, en 4, solo 2 arriba o abajo · Super Interactivo</span>
            </div>
          </div>
          {config.doorsConfig?.layout && config.doorsConfig.layout !== 'none' && (
            <button
              type="button"
              onClick={() => {
                const isCurrentlyOpen = (config.doorsConfig?.openAngle ?? 0) > 0;
                setConfig(prev => ({
                  ...prev,
                  doorsConfig: {
                    ...(prev.doorsConfig || { layout: 'full_2' }),
                    isOpen: !isCurrentlyOpen,
                    openAngle: isCurrentlyOpen ? 0 : 95
                  }
                }));
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                (config.doorsConfig?.openAngle ?? 0) > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#25283a] text-gray-300 hover:text-white border border-[#383d56]'
              }`}
            >
              <span>{(config.doorsConfig?.openAngle ?? 0) > 0 ? '🚪 Cerrar Puertas 3D' : '🚪 Abrir Puertas 3D (95°)'}</span>
            </button>
          )}
        </div>

        {/* Selector de Esquema de Puertas */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block">
            Distribución de Puertas:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {/* Opción 1: Sin Puertas */}
            <button
              type="button"
              onClick={() => setConfig(prev => ({
                ...prev,
                doorsConfig: {
                  ...(prev.doorsConfig || { gap: 2, handleType: 'bar_modern' }),
                  layout: 'none'
                }
              }))}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                (!config.doorsConfig || config.doorsConfig.layout === 'none')
                  ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-xs'
                  : 'bg-[#161722] border-[#292d3f] text-gray-400 hover:text-white hover:bg-[#1f2130]'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1">
                <span>🔲 Sin Puertas</span>
              </div>
              <div className="text-[8.5px] text-gray-400 mt-1 leading-tight">
                Mueble 100% abierto con repisas vistas
              </div>
            </button>

            {/* Opción 2: 2 Puertas Completas (Compartida en 2) */}
            <button
              type="button"
              onClick={() => setConfig(prev => ({
                ...prev,
                doorsConfig: {
                  ...(prev.doorsConfig || { gap: 2, handleType: 'bar_modern' }),
                  layout: 'full_2'
                }
              }))}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                config.doorsConfig?.layout === 'full_2'
                  ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-xs'
                  : 'bg-[#161722] border-[#292d3f] text-gray-400 hover:text-white hover:bg-[#1f2130]'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1 text-[#f0a144]">
                <span>🚪 2 Puertas</span>
              </div>
              <div className="text-[8.5px] text-gray-300 mt-1 leading-tight">
                Compartida en 2 (de piso a techo)
              </div>
            </button>

            {/* Opción 3: 4 Puertas (2 arriba + 2 abajo) */}
            <button
              type="button"
              onClick={() => setConfig(prev => ({
                ...prev,
                doorsConfig: {
                  ...(prev.doorsConfig || { gap: 2, handleType: 'bar_modern' }),
                  layout: 'split_4'
                }
              }))}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                config.doorsConfig?.layout === 'split_4'
                  ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-xs'
                  : 'bg-[#161722] border-[#292d3f] text-gray-400 hover:text-white hover:bg-[#1f2130]'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1 text-emerald-400">
                <span>🚪 4 Puertas</span>
              </div>
              <div className="text-[8.5px] text-gray-300 mt-1 leading-tight">
                Compartida en 4 (2 arriba y 2 abajo)
              </div>
            </button>

            {/* Opción 4: Solo 2 Puertas Abajo */}
            <button
              type="button"
              onClick={() => setConfig(prev => ({
                ...prev,
                doorsConfig: {
                  ...(prev.doorsConfig || { gap: 2, handleType: 'bar_modern' }),
                  layout: 'bottom_2'
                }
              }))}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                config.doorsConfig?.layout === 'bottom_2'
                  ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-xs'
                  : 'bg-[#161722] border-[#292d3f] text-gray-400 hover:text-white hover:bg-[#1f2130]'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1 text-sky-400">
                <span>⬇️ 2 Solo Abajo</span>
              </div>
              <div className="text-[8.5px] text-gray-300 mt-1 leading-tight">
                Mueble bajo cerrado, repisas arriba abiertas
              </div>
            </button>

            {/* Opción 5: Solo 2 Puertas Arriba */}
            <button
              type="button"
              onClick={() => setConfig(prev => ({
                ...prev,
                doorsConfig: {
                  ...(prev.doorsConfig || { gap: 2, handleType: 'bar_modern' }),
                  layout: 'top_2'
                }
              }))}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                config.doorsConfig?.layout === 'top_2'
                  ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-xs'
                  : 'bg-[#161722] border-[#292d3f] text-gray-400 hover:text-white hover:bg-[#1f2130]'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1 text-purple-400">
                <span>⬆️ 2 Solo Arriba</span>
              </div>
              <div className="text-[8.5px] text-gray-300 mt-1 leading-tight">
                Alacena cerrada arriba, repisas abajo abiertas
              </div>
            </button>

            {/* Opción 6: 1 Puerta Completa */}
            <button
              type="button"
              onClick={() => setConfig(prev => ({
                ...prev,
                doorsConfig: {
                  ...(prev.doorsConfig || { gap: 2, handleType: 'bar_modern' }),
                  layout: 'single_1'
                }
              }))}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                config.doorsConfig?.layout === 'single_1'
                  ? 'bg-[#f0a144]/15 border-[#f0a144] text-white shadow-xs'
                  : 'bg-[#161722] border-[#292d3f] text-gray-400 hover:text-white hover:bg-[#1f2130]'
              }`}
            >
              <div className="font-bold text-xs flex items-center gap-1 text-amber-300">
                <span>🚪 1 Puerta</span>
              </div>
              <div className="text-[8.5px] text-gray-300 mt-1 leading-tight">
                Una sola hoja completa (columna angosta)
              </div>
            </button>
          </div>
        </div>

        {/* Controles interactivos cuando hay puertas seleccionadas */}
        {config.doorsConfig?.layout && config.doorsConfig.layout !== 'none' && (
          <div className="space-y-3 pt-2 border-t border-[#2a2d40]">
            {/* Slider de Apertura Interactiva 3D */}
            <div className="bg-[#141520] p-2.5 rounded-lg border border-[#272b3c] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-gray-200 flex items-center gap-1.5">
                  <span>🔄</span>
                  <span>Apertura Interactiva en 3D:</span>
                </span>
                <span className="font-mono text-xs font-bold text-[#f0a144]">
                  {config.doorsConfig.openAngle ?? 0}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="105"
                step="5"
                value={config.doorsConfig.openAngle ?? 0}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setConfig(prev => ({
                    ...prev,
                    doorsConfig: {
                      ...(prev.doorsConfig || { layout: 'full_2' }),
                      openAngle: val,
                      isOpen: val > 0
                    }
                  }));
                }}
                className="w-full accent-[#f0a144] cursor-pointer"
              />
              <div className="flex items-center justify-between text-[8.5px] text-gray-400">
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    doorsConfig: { ...(prev.doorsConfig || { layout: 'full_2' }), openAngle: 0, isOpen: false }
                  }))}
                  className="hover:text-white transition-colors"
                >
                  Cerradas (0°)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    doorsConfig: { ...(prev.doorsConfig || { layout: 'full_2' }), openAngle: 45, isOpen: true }
                  }))}
                  className="hover:text-white transition-colors"
                >
                  Semiabiertas (45°)
                </button>
                <button
                  type="button"
                  onClick={() => setConfig(prev => ({
                    ...prev,
                    doorsConfig: { ...(prev.doorsConfig || { layout: 'full_2' }), openAngle: 95, isOpen: true }
                  }))}
                  className="hover:text-white transition-colors"
                >
                  Abiertas (95°)
                </button>
              </div>
            </div>

            {/* Repisa divisoria (para 4 puertas o puertas arriba/abajo) */}
            {(config.doorsConfig.layout === 'split_4' || config.doorsConfig.layout === 'bottom_2' || config.doorsConfig.layout === 'top_2') && config.shelfCount > 0 && (
              <div className="bg-[#141520] p-2.5 rounded-lg border border-[#272b3c] space-y-1.5">
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="font-bold text-gray-200">Repisa de división entre puertas:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    Nivel {(config.doorsConfig.splitShelfIndex ?? Math.floor(config.shelfCount / 2)) + 1}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: config.shelfCount }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setConfig(prev => ({
                        ...prev,
                        doorsConfig: {
                          ...(prev.doorsConfig || { layout: 'split_4' }),
                          splitShelfIndex: idx
                        }
                      }))}
                      className={`px-2 py-1 rounded-md text-[9.5px] font-bold transition-all cursor-pointer ${
                        (config.doorsConfig?.splitShelfIndex ?? Math.floor(config.shelfCount / 2)) === idx
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-[#1e202d] text-gray-400 hover:text-white border border-[#2a2d3e]'
                      }`}
                    >
                      Repisa Nivel {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tiradores y Cantos de Puertas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Estilo de Tirador */}
              <div className="bg-[#141520] p-2.5 rounded-lg border border-[#272b3c] space-y-1">
                <label className="text-[10px] font-bold text-gray-300 block">Tipo de Tirador / Jalador:</label>
                <select
                  value={config.doorsConfig.handleType || 'bar_modern'}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    doorsConfig: {
                      ...(prev.doorsConfig || { layout: 'full_2' }),
                      handleType: e.target.value as any
                    }
                  }))}
                  className="w-full bg-[#1b1c28] border border-[#2d3146] rounded-lg p-1.5 text-xs text-white focus:outline-none focus:border-[#f0a144]"
                >
                  <option value="bar_modern">Tirador Barra Moderno (Negro/Cromo)</option>
                  <option value="profile_gola">Tirador Perfil Gola / J</option>
                  <option value="knob">Tirador Botón Redondo</option>
                  <option value="push_open">Push to Open (Sin Tirador)</option>
                </select>
              </div>

              {/* Canto de Puertas */}
              <div className="bg-[#141520] p-2.5 rounded-lg border border-[#272b3c] space-y-1">
                <label className="text-[10px] font-bold text-gray-300 block">Canto en las 4 Caras de Puerta:</label>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      doorsConfig: {
                        ...(prev.doorsConfig || { layout: 'full_2' }),
                        cantoType: 'Canto Grueso'
                      }
                    }))}
                    className={`p-1.5 rounded-lg text-center text-[9.5px] font-bold transition-all ${
                      (config.doorsConfig.cantoType || 'Canto Grueso') === 'Canto Grueso'
                        ? 'bg-rose-500/20 border border-rose-500 text-rose-300 font-black'
                        : 'bg-[#1b1c28] text-gray-400 border border-[#2d3146] hover:text-white'
                    }`}
                  >
                    Canto Grueso 3mm (Recomendado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(prev => ({
                      ...prev,
                      doorsConfig: {
                        ...(prev.doorsConfig || { layout: 'full_2' }),
                        cantoType: 'Canto Delgado'
                      }
                    }))}
                    className={`p-1.5 rounded-lg text-center text-[9.5px] font-bold transition-all ${
                      config.doorsConfig.cantoType === 'Canto Delgado'
                        ? 'bg-blue-500/20 border border-blue-500 text-blue-300 font-black'
                        : 'bg-[#1b1c28] text-gray-400 border border-[#2d3146] hover:text-white'
                    }`}
                  >
                    Canto Delgado 0.45mm
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 5: MATERIAL Y COLOR */}
      <div className="bg-[#1c1e2b] border border-[#2c3044] rounded-xl p-3 sm:p-3.5 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2a2d40] pb-2">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Material y Acabado</span>
          </div>
          <span className="text-xs text-amber-300 font-bold">{config.material}</span>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {MATERIAL_OPTIONS.map(mat => (
            <button
              key={mat.name}
              type="button"
              onClick={() => setConfig(prev => ({ 
                ...prev, 
                material: mat.name, 
                customColor: mat.color 
              }))}
              className={`p-2 rounded-lg border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                config.material === mat.name
                  ? 'bg-amber-500/20 border-[#f0a144] scale-102 shadow-sm'
                  : 'bg-[#181a26] border-[#292d3f] hover:border-gray-500'
              }`}
            >
              <div 
                className="w-6 h-6 rounded-full border shadow-inner"
                style={{ backgroundColor: mat.color, borderColor: mat.border }}
              />
              <span className="text-[10px] text-gray-300 truncate w-full text-center font-medium">
                {mat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // Render Touch-Friendly Mobile Dynamic Parameter Controls
  const renderMobileDynamicParamControls = () => (
    <div className="flex flex-col h-full space-y-2">
      {/* Touch Sub-Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[#292d3f] shrink-0 [scrollbar-width:none]">
        {[
          { id: 'medidas', label: 'Medidas', icon: <Box className="w-3.5 h-3.5" /> },
          { id: 'repisas', label: 'Repisas', icon: <Layers className="w-3.5 h-3.5" /> },
          { id: 'divisiones', label: 'Divisiones', icon: <SplitSquareVertical className="w-3.5 h-3.5" /> },
          { id: 'estructura', label: 'Estructura', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
          { id: 'material', label: 'Material', icon: <Palette className="w-3.5 h-3.5" /> },
          { id: 'presets', label: 'Modelos', icon: <Sparkles className="w-3.5 h-3.5" /> }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileParamSubTab(tab.id as any)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1.5 transition-all ${
              mobileParamSubTab === tab.id
                ? 'bg-[#f0a144] text-black font-black shadow-xs'
                : 'bg-[#181a26] text-gray-300 hover:text-white border border-[#272b3c]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Medidas */}
      {mobileParamSubTab === 'medidas' && (
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
          {/* Altura */}
          <div className="bg-[#14151e] p-2.5 rounded-xl border border-[#25283a] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-bold flex items-center gap-1">
                <span className="text-red-400 font-black">Alto</span> (H)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalHeight: Math.max(400, p.totalHeight - 10) }))}
                  className="w-6 h-6 bg-[#25283a] text-white rounded font-bold text-xs active:scale-95"
                >-10</button>
                <input
                  type="number"
                  value={config.totalHeight}
                  onChange={(e) => setConfig(p => ({ ...p, totalHeight: Number(e.target.value) || 400 }))}
                  className="w-16 h-6 bg-[#0e0f15] border border-[#31354a] rounded text-center font-mono font-bold text-[#f0a144] text-xs"
                />
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalHeight: Math.min(2800, p.totalHeight + 10) }))}
                  className="w-6 h-6 bg-[#25283a] text-white rounded font-bold text-xs active:scale-95"
                >+10</button>
                <span className="text-gray-400 text-[10px]">mm</span>
              </div>
            </div>
            <input
              type="range"
              min="400"
              max="2800"
              step="10"
              value={config.totalHeight}
              onChange={(e) => setConfig(p => ({ ...p, totalHeight: Number(e.target.value) }))}
              className="w-full accent-[#f0a144] h-2 bg-[#25283a] rounded-lg cursor-pointer"
            />
            <div className="flex items-center gap-1 pt-0.5 overflow-x-auto [scrollbar-width:none]">
              {[900, 1500, 1800, 2100, 2400].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalHeight: h }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 transition-colors ${
                    config.totalHeight === h
                      ? 'bg-[#f0a144] text-black font-bold'
                      : 'bg-[#1e202e] text-gray-400 hover:text-white'
                  }`}
                >
                  {h}mm
                </button>
              ))}
            </div>
          </div>

          {/* Ancho */}
          <div className="bg-[#14151e] p-2.5 rounded-xl border border-[#25283a] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-bold flex items-center gap-1">
                <span className="text-emerald-400 font-black">Ancho</span> (W)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalWidth: Math.max(300, p.totalWidth - 10) }))}
                  className="w-6 h-6 bg-[#25283a] text-white rounded font-bold text-xs active:scale-95"
                >-10</button>
                <input
                  type="number"
                  value={config.totalWidth}
                  onChange={(e) => setConfig(p => ({ ...p, totalWidth: Number(e.target.value) || 300 }))}
                  className="w-16 h-6 bg-[#0e0f15] border border-[#31354a] rounded text-center font-mono font-bold text-[#f0a144] text-xs"
                />
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalWidth: Math.min(3000, p.totalWidth + 10) }))}
                  className="w-6 h-6 bg-[#25283a] text-white rounded font-bold text-xs active:scale-95"
                >+10</button>
                <span className="text-gray-400 text-[10px]">mm</span>
              </div>
            </div>
            <input
              type="range"
              min="300"
              max="3000"
              step="10"
              value={config.totalWidth}
              onChange={(e) => setConfig(p => ({ ...p, totalWidth: Number(e.target.value) }))}
              className="w-full accent-[#f0a144] h-2 bg-[#25283a] rounded-lg cursor-pointer"
            />
            <div className="flex items-center gap-1 pt-0.5 overflow-x-auto [scrollbar-width:none]">
              {[500, 636, 800, 1000, 1200, 1500].map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalWidth: w }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 transition-colors ${
                    config.totalWidth === w
                      ? 'bg-[#f0a144] text-black font-bold'
                      : 'bg-[#1e202e] text-gray-400 hover:text-white'
                  }`}
                >
                  {w}mm
                </button>
              ))}
            </div>
          </div>

          {/* Profundidad */}
          <div className="bg-[#14151e] p-2.5 rounded-xl border border-[#25283a] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 font-bold flex items-center gap-1">
                <span className="text-blue-400 font-black">Fondo</span> (D)
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalDepth: Math.max(180, p.totalDepth - 10) }))}
                  className="w-6 h-6 bg-[#25283a] text-white rounded font-bold text-xs active:scale-95"
                >-10</button>
                <input
                  type="number"
                  value={config.totalDepth}
                  onChange={(e) => setConfig(p => ({ ...p, totalDepth: Number(e.target.value) || 180 }))}
                  className="w-16 h-6 bg-[#0e0f15] border border-[#31354a] rounded text-center font-mono font-bold text-[#f0a144] text-xs"
                />
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalDepth: Math.min(800, p.totalDepth + 10) }))}
                  className="w-6 h-6 bg-[#25283a] text-white rounded font-bold text-xs active:scale-95"
                >+10</button>
                <span className="text-gray-400 text-[10px]">mm</span>
              </div>
            </div>
            <input
              type="range"
              min="180"
              max="800"
              step="10"
              value={config.totalDepth}
              onChange={(e) => setConfig(p => ({ ...p, totalDepth: Number(e.target.value) }))}
              className="w-full accent-[#f0a144] h-2 bg-[#25283a] rounded-lg cursor-pointer"
            />
            <div className="flex items-center gap-1 pt-0.5 overflow-x-auto [scrollbar-width:none]">
              {[250, 300, 350, 400, 500].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, totalDepth: d }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono shrink-0 transition-colors ${
                    config.totalDepth === d
                      ? 'bg-[#f0a144] text-black font-bold'
                      : 'bg-[#1e202e] text-gray-400 hover:text-white'
                  }`}
                >
                  {d}mm
                </button>
              ))}
            </div>
          </div>

          {/* Espesor Melamina */}
          <div className="bg-[#14151e] p-2.5 rounded-xl border border-[#25283a] flex items-center justify-between text-xs">
            <span className="text-gray-300 font-bold">Espesor Placas:</span>
            <div className="flex items-center gap-1">
              {[15, 18, 25, 36].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, thickness: t }))}
                  className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all ${
                    config.thickness === t
                      ? 'bg-[#f0a144] text-black shadow-xs font-black'
                      : 'bg-[#25283a] text-gray-300 hover:text-white'
                  }`}
                >
                  {t}mm
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Repisas */}
      {mobileParamSubTab === 'repisas' && (
        <div className="space-y-3 overflow-y-auto pr-1 flex-1">
          <div className="bg-[#14151e] p-3 rounded-xl border border-[#25283a] space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Repisas Intermedias</span>
                <span className="text-[10px] text-gray-400">
                  {config.shelfCount + 1} espacios útiles en total (~{metrics.shelfClearHeight}mm luz)
                </span>
                {config.verticalDivisions > 0 && config.divisionStyle !== 'continuous_vertical' && (
                  <span className="inline-block mt-0.5 text-[8.5px] font-mono font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                    🪵 Divisores {metrics.shelfDepth > metrics.shelfClearHeight ? '(C: A1 Frente)' : '(C: L1 Frente)'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 bg-[#0e0f15] p-1 rounded-lg border border-[#2b2f42]">
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, shelfCount: Math.max(0, p.shelfCount - 1) }))}
                  className="w-8 h-8 bg-[#25283a] text-white rounded font-bold text-base active:scale-95 flex items-center justify-center"
                >-</button>
                <span className="w-8 text-center font-mono font-bold text-[#f0a144] text-base">
                  {config.shelfCount}
                </span>
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, shelfCount: Math.min(12, p.shelfCount + 1) }))}
                  className="w-8 h-8 bg-[#25283a] text-white rounded font-bold text-base active:scale-95 flex items-center justify-center"
                >+</button>
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={config.shelfCount}
              onChange={(e) => setConfig(p => ({ ...p, shelfCount: Number(e.target.value) }))}
              className="w-full accent-emerald-400 h-2 bg-[#25283a] rounded-lg cursor-pointer"
            />

            <div className="bg-emerald-500/15 border border-emerald-500/30 p-2 rounded-lg flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-300">Luz libre interior:</span>
              <strong className="text-emerald-400 font-bold">~{metrics.shelfClearHeight} mm</strong>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, shelfCount: n }))}
                  className={`flex-1 py-1 rounded text-xs font-bold font-mono transition-colors ${
                    config.shelfCount === n
                      ? 'bg-emerald-500 text-black font-black'
                      : 'bg-[#202334] text-gray-300 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Divisiones */}
      {mobileParamSubTab === 'divisiones' && (
        <div className="space-y-3 overflow-y-auto pr-1 flex-1">
          <div className="bg-[#14151e] p-3 rounded-xl border border-[#25283a] space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Divisiones Verticales</span>
                <span className="text-[10px] text-gray-400">
                  {config.verticalDivisions === 0 ? 'Columna única' : `${config.verticalDivisions + 1} cuerpos/columnas`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#0e0f15] p-1 rounded-lg border border-[#2b2f42]">
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, verticalDivisions: Math.max(0, p.verticalDivisions - 1) }))}
                  className="w-8 h-8 bg-[#25283a] text-white rounded font-bold text-base active:scale-95 flex items-center justify-center"
                >-</button>
                <span className="w-8 text-center font-mono font-bold text-sky-400 text-base">
                  {config.verticalDivisions}
                </span>
                <button
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, verticalDivisions: Math.min(6, p.verticalDivisions + 1) }))}
                  className="w-8 h-8 bg-[#25283a] text-white rounded font-bold text-base active:scale-95 flex items-center justify-center"
                >+</button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { count: 0, label: '0 (1 Col)' },
                { count: 1, label: '1 (2 Col)' },
                { count: 2, label: '2 (3 Col)' },
                { count: 3, label: '3 (4 Col)' },
              ].map(item => (
                <button
                  key={item.count}
                  type="button"
                  onClick={() => setConfig(p => ({ ...p, verticalDivisions: item.count }))}
                  className={`py-1.5 rounded text-xs font-bold transition-all ${
                    config.verticalDivisions === item.count
                      ? 'bg-sky-500 text-black font-black shadow-xs'
                      : 'bg-[#202334] text-gray-300 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="bg-sky-500/15 border border-sky-500/30 p-2 rounded-lg flex items-center justify-between text-xs font-mono">
              <span className="text-sky-300">
                {config.divisionStyle === 'staggered' ? 'Nichos alternos:' : 'Ancho por cuerpo:'}
              </span>
              <strong className="text-sky-400 font-bold">
                {config.divisionStyle === 'staggered'
                  ? `~${Math.round(metrics.bayWidth * 0.72)} / ~${Math.round(metrics.bayWidth * 1.28)} mm`
                  : `~${metrics.bayWidth} mm`}
              </strong>
            </div>

            {config.verticalDivisions > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-[#25283a]">
                <span className="text-[11px] text-gray-300 font-bold">Estilo del diseño:</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'continuous_vertical', name: 'Montantes Continuos', desc: 'Divisiones piso a techo' },
                    { id: 'continuous_horizontal', name: 'Repisas Continuas', desc: 'Repisas largas con separadores' },
                    { id: 'staggered', name: '🎲 Casilleros Alternos', desc: 'Diseño asimétrico nórdico moderno' },
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setConfig(p => ({
                        ...p,
                        divisionStyle: st.id as any,
                        ...(st.id === 'staggered' ? { staggerPattern: p.staggerPattern || 'offset' } : {})
                      }))}
                      className={`p-2 rounded-lg border text-left text-xs transition-all ${
                        config.divisionStyle === st.id
                          ? st.id === 'staggered'
                            ? 'bg-amber-500/20 border-amber-500 text-white font-bold'
                            : 'bg-sky-500/20 border-sky-500 text-white font-bold'
                          : 'bg-[#181a26] border-[#292d3f] text-gray-400'
                      }`}
                    >
                      <div className={st.id === 'staggered' ? 'text-amber-300 font-bold' : 'text-sky-300 font-bold'}>
                        {st.name}
                      </div>
                      <div className="text-[10px] text-gray-400">{st.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Sub-selector de alternancia para móviles */}
                {config.divisionStyle === 'staggered' && (
                  <div className="p-2 bg-[#121420] border border-amber-500/30 rounded-lg space-y-1.5 mt-1.5">
                    <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wide">
                      Patrón de Alternancia:
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfig(p => ({ ...p, staggerPattern: 'offset' }))}
                        className={`p-1.5 rounded border text-left text-[10px] transition-all ${
                          (config.staggerPattern || 'offset') === 'offset'
                            ? 'bg-amber-500/25 border-amber-400 text-white font-bold'
                            : 'bg-[#181a26] border-[#2b2f42] text-gray-400'
                        }`}
                      >
                        <div className="text-amber-300 font-bold">⚡ Zig-Zag</div>
                        <div className="text-[8.5px] text-gray-400">Ancho / Estrecho</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfig(p => ({ ...p, staggerPattern: 'brick' }))}
                        className={`p-1.5 rounded border text-left text-[10px] transition-all ${
                          config.staggerPattern === 'brick'
                            ? 'bg-amber-500/25 border-amber-400 text-white font-bold'
                            : 'bg-[#181a26] border-[#2b2f42] text-gray-400'
                        }`}
                      >
                        <div className="text-amber-300 font-bold">🧱 Trabado</div>
                        <div className="text-[8.5px] text-gray-400">Ladrillo cruzado</div>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Estructura */}
      {mobileParamSubTab === 'estructura' && (
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
          {/* Zócalo */}
          <div className="bg-[#14151e] p-2.5 rounded-xl border border-[#25283a] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includePlinth}
                  onChange={(e) => setConfig(p => ({ ...p, includePlinth: e.target.checked }))}
                  className="accent-[#f0a144] w-4 h-4 rounded"
                />
                <span>Zócalo Inferior (Base)</span>
              </label>
              {config.includePlinth && (
                <span className="text-xs font-mono font-bold text-[#f0a144]">{config.plinthHeight} mm</span>
              )}
            </div>
            {config.includePlinth && (
              <input
                type="range"
                min="50"
                max="150"
                step="5"
                value={config.plinthHeight}
                onChange={(e) => setConfig(p => ({ ...p, plinthHeight: Number(e.target.value) }))}
                className="w-full accent-[#f0a144] h-2 bg-[#25283a] rounded-lg"
              />
            )}
          </div>

          {/* Fondo Trasero */}
          <div className="bg-[#14151e] p-2.5 rounded-xl border border-[#25283a] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.includeBack}
                  onChange={(e) => setConfig(p => ({ ...p, includeBack: e.target.checked }))}
                  className="accent-purple-400 w-4 h-4 rounded"
                />
                <span>Fondo Rigidizador (Espalda)</span>
              </label>
              {config.includeBack && (
                <span className="text-xs font-mono font-bold text-purple-400">{config.backThickness} mm</span>
              )}
            </div>
            {config.includeBack && (
              <div className="space-y-1.5 pt-1 text-xs">
                <div className="grid grid-cols-4 gap-1">
                  {[3, 4, 5.5, 6, 9, 15, 18].map(th => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => setConfig(p => ({ ...p, backThickness: th }))}
                      className={`py-1 rounded text-xs font-mono font-bold ${
                        config.backThickness === th ? 'bg-purple-600 text-white' : 'bg-[#202334] text-gray-400'
                      }`}
                    >
                      {th}mm
                    </button>
                  ))}
                </div>
                <div className="flex gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfig(p => ({ ...p, backType: 'ranurado' }))}
                    className={`flex-1 py-1 rounded text-[10px] font-bold ${
                      (config.backType ?? 'ranurado') === 'ranurado' ? 'bg-amber-500/20 text-amber-300 border border-amber-500' : 'bg-[#202334] text-gray-400'
                    }`}
                  >
                    Ranurado 3D (18mm)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig(p => ({ ...p, backType: 'sobrepuesto' }))}
                    className={`flex-1 py-1 rounded text-[10px] font-bold ${
                      config.backType === 'sobrepuesto' ? 'bg-purple-500/20 text-purple-300 border border-purple-500' : 'bg-[#202334] text-gray-400'
                    }`}
                  >
                    Sobrepuesto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Material */}
      {mobileParamSubTab === 'material' && (
        <div className="space-y-2.5 overflow-y-auto pr-1 flex-1">
          <div className="grid grid-cols-3 gap-2">
            {MATERIAL_OPTIONS.map(mat => (
              <button
                key={mat.name}
                type="button"
                onClick={() => setConfig(p => ({ ...p, material: mat.name, customColor: mat.color }))}
                className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  config.material === mat.name
                    ? 'bg-amber-500/20 border-[#f0a144] scale-102 shadow-xs'
                    : 'bg-[#14151e] border-[#25283a] text-gray-300'
                }`}
              >
                <div
                  className="w-7 h-7 rounded-full border shadow-inner"
                  style={{ backgroundColor: mat.color, borderColor: mat.border }}
                />
                <span className="text-[10px] font-bold truncate w-full text-center">
                  {mat.name}
                </span>
              </button>
            ))}
          </div>
          <div className="bg-[#14151e] border border-cyan-500/30 p-2 rounded-xl text-[10px] text-cyan-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <span>Cantos delgados de 1mm automáticos en frentes de parantes, repisas y zócalo.</span>
          </div>
        </div>
      )}

      {/* Tab 6: Presets */}
      {mobileParamSubTab === 'presets' && (
        <div className="space-y-2 overflow-y-auto pr-1 flex-1">
          {[
            { id: 'mdf-ranurado', name: '✂️ MDF Ranurado (636×2100)', dims: '636×2100×400 · 4 repisas · Fondo ranurado L2 (18mm)' },
            { id: 'mdf-sobrepuesto', name: '🔨 Respaldo Clavado (636×2100)', dims: '636×2100×400 · 4 repisas · Fondo sobrepuesto/clavado' },
            { id: 'librero-2col', name: '📚 Librero 2 Columnas', dims: '1200×1800×350 · 4 repisas · 1 división' },
            { id: 'aparador-3col', name: '🗄️ Aparador Bajo 3 Nichos', dims: '1500×900×380 · 1 repisa · 2 divisiones' },
            { id: 'asimetrico', name: '🎲 Librero Asimétrico', dims: '1300×1900×320 · Casilleros alternos' },
          ].map(pr => (
            <button
              key={pr.id}
              type="button"
              onClick={() => applyPreset(pr.id)}
              className="w-full p-2.5 bg-[#14151e] hover:bg-[#202334] border border-[#25283a] hover:border-[#f0a144]/50 rounded-xl text-left transition-all flex items-center justify-between"
            >
              <div>
                <span className="text-xs font-bold text-white block">{pr.name}</span>
                <span className="text-[10px] text-gray-400 font-mono">{pr.dims}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Render Full Despiece Hub (Table + 2D Cutting Graphics Diagram)
  const renderDespieceHub = () => (
    <div className="space-y-3">
      {/* Sub-Header: Selector entre Tabla Oficial de Demanda y Gráficos 2D */}
      <div className="bg-[#1c1e2b] border border-[#2c3044] rounded-xl p-2.5 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-[#12131b] p-1 rounded-lg border border-[#2a2e41] flex-wrap">
          <button
            type="button"
            onClick={() => setDespieceSubTab('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              despieceSubTab === 'table'
                ? 'bg-[#f0a144] text-black shadow-xs font-black'
                : 'text-gray-300 hover:text-white hover:bg-[#202334]'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Demanda de Piezas</span>
          </button>

          <button
            type="button"
            onClick={() => setDespieceSubTab('diagram')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              despieceSubTab === 'diagram'
                ? 'bg-[#f0a144] text-black shadow-xs font-black'
                : 'text-gray-300 hover:text-white hover:bg-[#202334]'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Gráficos 2D (Planchas)</span>
          </button>

          <button
            type="button"
            onClick={() => setDespieceSubTab('split')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              despieceSubTab === 'split'
                ? 'bg-[#f0a144] text-black shadow-xs font-black'
                : 'text-gray-300 hover:text-white hover:bg-[#202334]'
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>Vista Dividida</span>
          </button>
        </div>

        {/* Action Button: Abrir en Módulo de Cortes 2D */}
        <button
          type="button"
          onClick={handleOpenCutPlan}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
          title="Cargar este estante y abrir directamente el plano oficial de cortes 2D"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Abrir Plano 2D Completo</span>
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-[#14151e] border border-[#272b3c] p-2 rounded-lg flex flex-col">
          <span className="text-[10px] text-gray-400">Total Piezas</span>
          <span className="text-white font-bold font-mono text-sm">{pieces.length} piezas</span>
        </div>
        <div className="bg-[#14151e] border border-[#272b3c] p-2 rounded-lg flex flex-col">
          <span className="text-[10px] text-gray-400">Planchas Estimadas</span>
          <span className="text-[#f0a144] font-bold font-mono text-sm">
            {packed2DResult.reduce((acc, g) => acc + g.pack.boards.length, 0)} planchas
          </span>
        </div>
        <div className="bg-[#14151e] border border-[#272b3c] p-2 rounded-lg flex flex-col">
          <span className="text-[10px] text-gray-400">Tapacantos Requeridos</span>
          <span className="text-cyan-400 font-bold font-mono text-xs">
            ~{totalEdgeMeters}m delgado (1mm)
          </span>
        </div>
        <div className="bg-[#14151e] border border-[#272b3c] p-2 rounded-lg flex flex-col">
          <span className="text-[10px] text-gray-400">Peso y Área Total</span>
          <span className="text-emerald-400 font-bold font-mono text-xs">
            ~{metrics.estWeightKg} kg · {metrics.totalAreaM2} m²
          </span>
        </div>
      </div>

      {/* Content depending on sub-tab */}
      {despieceSubTab === 'table' ? (
        <div className="bg-[#161616] border border-[#2d2d2d] rounded-xl overflow-hidden shadow-inner">
          <CutPiecesTable
            pieces={pieces}
            groupedPieces={groupedPieces}
            selectedPieceIds={selectedPieceIds}
            toggleSelection={handleToggleSelection}
            updatePiece={handleUpdatePiece}
            edgeThicknessConfig={DEFAULT_EDGE_THICKNESS_CONFIG}
            hoveredPieceId={hoveredPieceId}
            setHoveredPieceId={setHoveredPieceId}
            onSwitchTo3D={() => {
              setActiveTab('params');
              setMobileTab('3d');
            }}
          />
        </div>
      ) : despieceSubTab === 'diagram' ? (
        <div className="h-[70vh] min-h-[520px] bg-[#14151e] border border-[#2e3146] rounded-xl overflow-hidden shadow-2xl relative">
          <CutPlanViewer
            pieces={pieces}
            sheetConfig={localSheetConfig}
            onUpdateSheetConfig={setLocalSheetConfig}
            selectedPieceIds={selectedPieceIds}
            toggleSelection={handleToggleSelection}
            updatePiece={handleUpdatePiece}
            setPieces={handleSetPieces}
            edgeThicknessConfig={DEFAULT_EDGE_THICKNESS_CONFIG}
            onSwitchTo3D={() => {
              setActiveTab('params');
              setMobileTab('3d');
            }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          <div className="xl:col-span-5 bg-[#161616] border border-[#2d2d2d] rounded-xl overflow-hidden shadow-inner max-h-[70vh] overflow-y-auto">
            <CutPiecesTable
              pieces={pieces}
              groupedPieces={groupedPieces}
              selectedPieceIds={selectedPieceIds}
              toggleSelection={handleToggleSelection}
              updatePiece={handleUpdatePiece}
              edgeThicknessConfig={DEFAULT_EDGE_THICKNESS_CONFIG}
              hoveredPieceId={hoveredPieceId}
              setHoveredPieceId={setHoveredPieceId}
              onSwitchTo3D={() => {
                setActiveTab('params');
                setMobileTab('3d');
              }}
            />
          </div>
          <div className="xl:col-span-7 h-[70vh] min-h-[500px] bg-[#14151e] border border-[#2e3146] rounded-xl overflow-hidden shadow-2xl relative">
            <CutPlanViewer
              pieces={pieces}
              sheetConfig={localSheetConfig}
              onUpdateSheetConfig={setLocalSheetConfig}
              selectedPieceIds={selectedPieceIds}
              toggleSelection={handleToggleSelection}
              updatePiece={handleUpdatePiece}
              setPieces={handleSetPieces}
              edgeThicknessConfig={DEFAULT_EDGE_THICKNESS_CONFIG}
              onSwitchTo3D={() => {
                setActiveTab('params');
                setMobileTab('3d');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-[#161720] border border-[#2b2f42] rounded-2xl w-full max-w-5xl h-[96dvh] sm:h-[92vh] max-h-[96dvh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-gray-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-3 sm:px-4 py-2.5 bg-[#1d1f2c] border-b border-[#2b2f42] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-[#f0a144] shrink-0">
              <Sliders className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-xs sm:text-base font-bold text-white tracking-wide truncate">
                  Estante Dinámico
                </h2>
                <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-[#f0a144]/15 text-[#f0a144] px-1.5 py-0.2 rounded-full border border-[#f0a144]/30">
                  Paramétrico
                </span>
              </div>
              <p className="text-[10px] text-gray-400 hidden sm:block truncate">
                Transforma dimensiones, repisas y divisiones intermedias en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetToOriginalReference}
              className="flex items-center gap-1 px-2 py-1 text-[10.5px] bg-[#26293b] hover:bg-[#32364e] text-gray-300 rounded-lg border border-[#373c55] transition-colors cursor-pointer"
              title="Restablecer al modelo original guardado (2100×636×400, 4 repisas)"
            >
              <RefreshCw className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">Modelo Original</span>
              <span className="sm:hidden">Reset</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-1.5 text-gray-400 hover:text-white hover:bg-[#282b3d] rounded-lg transition-colors cursor-pointer"
              title="Cerrar diseñador"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile View Switcher (Visible on mobile screens < lg) */}
        <div className="flex lg:hidden bg-[#12131b] border-b border-[#282b3d] p-1 gap-1 shrink-0 overflow-x-auto [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setMobileTab('3d')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
              mobileTab === '3d' 
                ? 'bg-[#f0a144] text-black shadow-sm font-black' 
                : 'text-gray-300 hover:text-white bg-[#1a1c27]'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D & Dinámica</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('params')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
              mobileTab === 'params' 
                ? 'bg-[#f0a144] text-black shadow-sm font-black' 
                : 'text-gray-300 hover:text-white bg-[#1a1c27]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Parámetros</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('pieces')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 ${
              mobileTab === 'pieces' 
                ? 'bg-[#f0a144] text-black shadow-sm font-black' 
                : 'text-gray-300 hover:text-white bg-[#1a1c27]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Despiece / 2D ({pieces.length})</span>
          </button>
        </div>

        {/* Toast Notification */}
        {saveToast && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-3 py-1.5 text-xs text-amber-300 flex items-center justify-between animate-in slide-in-from-top-1 z-30">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-amber-400" />
              <span>{saveToast}</span>
            </div>
            <button type="button" onClick={() => setSaveToast(null)} className="text-amber-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DESKTOP VIEW (>= lg): Split Screen (3D on left, Parameters on right)     */}
        {/* ========================================================================= */}
        {isDesktop ? (
          <div className="grid grid-cols-12 flex-1 min-h-0 overflow-hidden">
          
          {/* LEFT: Live 3D Preview (5 cols) */}
          <div className="lg:col-span-5 h-full bg-[#111219] border-r border-[#26293a] flex flex-col relative select-none">
            
            {/* 3D Top Mini-Bar */}
            <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
              <div className="bg-[#181a26]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2d3146] text-[10px] font-mono text-gray-300 flex items-center gap-1.5 shadow-md pointer-events-auto">
                <Box className="w-3 h-3 text-[#f0a144]" />
                <span>{config.totalWidth} × {config.totalHeight} × {config.totalDepth} mm</span>
                <span className="text-gray-500">|</span>
                <span className="text-[#f0a144] font-bold">{pieces.length} piezas</span>
              </div>

              <div className="bg-[#181a26]/90 backdrop-blur-md px-2 py-1 rounded-lg border border-[#2d3146] text-[10px] text-gray-300 flex items-center gap-1 shadow-md pointer-events-auto">
                <span>~{metrics.estWeightKg} kg</span>
                <span className="text-gray-500">·</span>
                <span>{metrics.totalAreaM2} m²</span>
              </div>
            </div>

            {/* Canvas 3D Preview Component */}
            <div className="flex-1 w-full h-full relative">
              <Warehouse3DPreview
                pieces={pieces}
                dimensions={{ width: config.totalWidth, height: config.totalHeight, depth: config.totalDepth }}
                interactive={true}
                autoRotate={false}
                showControls={true}
              />
            </div>
          </div>

          {/* RIGHT: Parametric Form & Piece Breakdown (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-full min-h-0 bg-[#161720]">
            
            {/* Secondary Navigation Tabs */}
            <div className="px-4 py-2 bg-[#1b1c28] border-b border-[#292d3f] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('params')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    activeTab === 'params' 
                      ? 'bg-[#f0a144] text-black shadow-xs' 
                      : 'text-gray-400 hover:text-white hover:bg-[#25283a]'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configuración Paramétrica</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pieces')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                    activeTab === 'pieces' 
                      ? 'bg-[#f0a144] text-black shadow-xs' 
                      : 'text-gray-400 hover:text-white hover:bg-[#25283a]'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Despiece / 2D ({pieces.length})</span>
                </button>
              </div>

              {/* Name input */}
              <div className="flex items-center gap-1.5 max-w-[200px]">
                <input
                  type="text"
                  value={furnitureName}
                  onChange={(e) => setFurnitureName(e.target.value)}
                  className="bg-[#12131b] border border-[#2a2e41] text-xs text-white rounded px-2 py-1 w-full focus:outline-none focus:border-[#f0a144]"
                  placeholder="Nombre del estante"
                />
              </div>
            </div>

            {/* Scrollable Configuration Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeTab === 'params' ? renderParametricForm() : renderDespieceHub()}
            </div>

            {/* Desktop Actions Footer */}
            <div className="p-3 bg-[#1a1c28] border-t border-[#2a2d3f] flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                {onSaveToWarehouse && (
                  <button
                    type="button"
                    onClick={handleSaveWarehouse}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#26293a] hover:bg-[#32364c] text-gray-200 hover:text-white rounded-xl text-xs font-bold border border-[#373c54] transition-all cursor-pointer shadow-xs"
                    title="Guardar este diseño transformado en el Almacén con etiqueta de componente dinámico"
                  >
                    <Download className="w-3.5 h-3.5 text-[#f0a144]" />
                    <span>Guardar en Almacén</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {hasExistingPieces && (
                  <button
                    type="button"
                    onClick={() => handleApply('replace')}
                    className="px-3 py-2 bg-[#25283a] hover:bg-[#31354d] text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-[#383d57] transition-all cursor-pointer flex items-center gap-1.5"
                    title="Reemplazar todos los muebles actuales de la escena 3D"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
                    <span>Reemplazar Escena</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleApply('insert')}
                  className="px-4 py-2 bg-[#f0a144] hover:bg-[#ffba66] text-black font-black rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-98"
                  title={hasExistingPieces ? "Añadir este componente al lado del actual sin borrarlo" : "Cargar componente en la escena 3D"}
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>{hasExistingPieces ? '+ Añadir a la Escena (+ Módulo)' : 'Cargar en Viewport 3D'}</span>
                  <ArrowRight className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>

          </div>

        </div>
        ) : (

        /* ========================================================================= */
        /* MOBILE VIEW (< lg): Dynamic Views with Floating Bottom Sheet             */
        /* ========================================================================= */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          
          {/* MODE 1: DISEÑO 3D CON VENTANA DINÁMICA DE PARÁMETROS */}
          {mobileTab === '3d' && (
            <div className="flex-1 flex flex-col min-h-0 relative select-none bg-[#111219]">
              
              {/* 3D Top Floating Mini-Bar */}
              <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
                <div className="bg-[#181a26]/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#2d3146] text-[10px] font-mono text-gray-300 flex items-center gap-1.5 shadow-md pointer-events-auto">
                  <Box className="w-3 h-3 text-[#f0a144]" />
                  <span>{config.totalWidth} × {config.totalHeight} × {config.totalDepth}</span>
                  <span className="text-gray-500">|</span>
                  <span className="text-[#f0a144] font-bold">{pieces.length}p</span>
                </div>

                <div className="flex items-center gap-1 pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => setMobileDynamicWindowMode(prev => prev === 'minimized' ? 'peek' : prev === 'peek' ? 'expanded' : 'peek')}
                    className="bg-[#f0a144] hover:bg-[#ffba66] text-black px-2.5 py-1 rounded-lg font-bold text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{mobileDynamicWindowMode === 'minimized' ? 'Parámetros' : mobileDynamicWindowMode === 'peek' ? 'Expandir' : 'Media'}</span>
                  </button>
                </div>
              </div>

              {/* 3D Canvas */}
              <div className="flex-1 w-full h-full relative">
                <Warehouse3DPreview
                  pieces={pieces}
                  dimensions={{ width: config.totalWidth, height: config.totalHeight, depth: config.totalDepth }}
                  interactive={true}
                  autoRotate={false}
                  showControls={true}
                />
              </div>

              {/* VENTANA DINÁMICA FLOTANTE (Interactive Floating Sheet over 3D) */}
              <div 
                className={`absolute left-0 right-0 bottom-0 z-20 bg-[#14151f]/95 backdrop-blur-md border-t border-[#2e3247] shadow-2xl transition-all duration-200 flex flex-col ${
                  mobileDynamicWindowMode === 'expanded'
                    ? 'max-h-[86%] h-[86%]'
                    : mobileDynamicWindowMode === 'peek'
                    ? 'max-h-[48%] h-[48%]'
                    : 'h-11'
                }`}
              >
                {/* Drag / Toggle Handle Bar */}
                <div 
                  className="px-3 py-1.5 bg-[#1a1c28] border-b border-[#292d40] flex items-center justify-between cursor-pointer select-none shrink-0"
                  onClick={() => setMobileDynamicWindowMode(prev => prev === 'minimized' ? 'peek' : 'minimized')}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-1 rounded-full bg-gray-500 mx-auto" />
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-sky-400" />
                      <span>Ventana Dinámica de Parámetros</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setMobileDynamicWindowMode('minimized')}
                      className={`p-1 rounded text-gray-400 hover:text-white transition-colors ${mobileDynamicWindowMode === 'minimized' ? 'text-[#f0a144]' : ''}`}
                      title="Minimizar ventana"
                    >
                      <Minimize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileDynamicWindowMode(prev => prev === 'peek' ? 'expanded' : 'peek')}
                      className={`p-1 rounded text-gray-400 hover:text-white transition-colors ${mobileDynamicWindowMode === 'peek' ? 'text-[#f0a144]' : ''}`}
                      title="Media pantalla"
                    >
                      <ChevronUp className={`w-3.5 h-3.5 transition-transform ${mobileDynamicWindowMode === 'expanded' ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMobileDynamicWindowMode(prev => prev === 'expanded' ? 'peek' : 'expanded')}
                      className={`p-1 rounded text-gray-400 hover:text-white transition-colors ${mobileDynamicWindowMode === 'expanded' ? 'text-[#f0a144]' : ''}`}
                      title="Pantalla completa"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content inside dynamic window */}
                {mobileDynamicWindowMode !== 'minimized' ? (
                  <div className="flex-1 overflow-hidden p-2.5 flex flex-col">
                    {renderMobileDynamicParamControls()}
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-3 h-full">
                    <span className="text-[10px] text-gray-400 font-mono">
                      {config.totalWidth}×{config.totalHeight}×{config.totalDepth}mm · {config.shelfCount} repisas
                    </span>
                    <button
                      type="button"
                      onClick={() => setMobileDynamicWindowMode('peek')}
                      className="text-xs font-bold text-[#f0a144] flex items-center gap-1"
                    >
                      <span>Abrir Parámetros</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MODE 2: DESPIECE EN VIVO Y GRÁFICOS 2D */}
          {mobileTab === 'pieces' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-2 sm:p-3 bg-[#161720]">
              {renderDespieceHub()}
            </div>
          )}

          {/* MODE 3: PARÁMETROS COMPLETOS EN PANTALLA COMPLETA */}
          {mobileTab === 'params' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-3 bg-[#161720] space-y-3">
              <div className="bg-[#1c1e2b] border border-[#2d3144] rounded-xl p-2 flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[#f0a144]" />
                  <span>Parámetros del Estante</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMobileTab('3d')}
                  className="px-2.5 py-1 bg-[#25283a] hover:bg-[#32364c] text-sky-400 font-bold rounded-lg text-xs transition-colors"
                >
                  Ver en 3D →
                </button>
              </div>
              {renderParametricForm()}
            </div>
          )}

          {/* MOBILE SLIM ACTIONS FOOTER (Always clean, never blocking parameters) */}
          <div className="p-2.5 bg-[#181a26] border-t border-[#292d3f] flex items-center justify-between gap-2 shrink-0 z-30">
            {hasExistingPieces && (
              <button
                type="button"
                onClick={() => handleApply('replace')}
                className="py-2 px-2.5 bg-[#25283a] text-gray-300 hover:text-white rounded-xl text-xs font-bold border border-[#383d57] shrink-0 flex items-center gap-1"
                title="Reemplazar escena actual"
              >
                <RefreshCw className="w-3 h-3 text-gray-400" />
                <span>Reemplazar</span>
              </button>
            )}

            {/* Primary Viewport Load Button: Adds to scene when existing pieces exist */}
            <button
              type="button"
              onClick={() => handleApply('insert')}
              className="flex-1 py-2 px-3 bg-[#f0a144] hover:bg-[#ffba66] text-black font-black rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-98 truncate"
              title={hasExistingPieces ? "Añadir a la escena 3D manteniendo los componentes anteriores" : "Cargar en el visor 3D"}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3] shrink-0" />
              <span>{hasExistingPieces ? '+ Añadir a Escena' : 'Cargar en 3D'}</span>
              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
            </button>

            {/* More Menu Dropdown for Warehouse & Default */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowMobileMoreMenu(prev => !prev)}
                className="p-2 bg-[#25283a] text-gray-300 hover:text-white rounded-xl border border-[#383d57] flex items-center justify-center"
                title="Más opciones de guardado"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showMobileMoreMenu && (
                <div className="absolute right-0 bottom-full mb-1.5 w-52 bg-[#1b1c28] border border-[#373c54] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 animate-in fade-in slide-in-from-bottom-2">
                  <button
                    type="button"
                    onClick={handleOpenCutPlan}
                    className="w-full text-left px-2.5 py-2 text-xs font-bold text-emerald-300 hover:bg-[#282c3f] rounded-lg flex items-center gap-2 border-b border-[#292e42] pb-2 mb-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Abrir en Cortes 2D</span>
                  </button>

                  {onSaveToWarehouse && (
                    <button
                      type="button"
                      onClick={handleSaveWarehouse}
                      className="w-full text-left px-2.5 py-2 text-xs font-bold text-gray-200 hover:bg-[#282c3f] rounded-lg flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5 text-[#f0a144]" />
                      <span>Guardar en Almacén</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
        )}

      </div>
    </div>
  );
};

export default DynamicShelfModal;
