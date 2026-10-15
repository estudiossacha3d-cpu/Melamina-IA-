import React from 'react';
import { 
  Undo2, Redo2, Magnet, Copy, Trash2, 
  Move, RotateCcw, RotateCw, Expand, Settings,
  Group, Ungroup, ListPlus, Ruler, Maximize2,
  Info, X, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, ArrowDownToLine,
  Rows3, Layers, CopyPlus, Pencil, Check, Palette,
  Image as ImageIcon, Sliders, Zap, ChevronDown, ChevronUp,
  Eye, EyeOff, FolderOpen, Sparkles, Shuffle,
  BoxSelect, CheckSquare, SquareDashed, MousePointerSquareDashed, Focus,
  Scissors, Compass
} from 'lucide-react';
import { Piece, EdgeConfig, EdgeThicknessConfig, PieceFaceKey, FaceTextureOptions, Group3D } from '../types';
import { calculatePieceCutDimensions, DEFAULT_EDGE_THICKNESS_CONFIG, CutDimensionResult } from '../lib/edgeCalculations';
import { MATERIAL_MAP, getMaterialEmoji, getGroupedMaterials, getMaterialDefinition } from '../lib/materials';
import { RanuraConfigCard } from './RanuraConfigCard';

interface ThreeViewerOverlayProps {
  pieces: Piece[];
  selectedPieceId: string | null;
  selectedPieceIds?: string[];
  groups?: Group3D[];
  editingGroupId?: string | null;
  onEnterGroup?: (groupId: string) => void;
  onExitGroup?: () => void;
  isBoxSelectActive?: boolean;
  onToggleBoxSelect?: () => void;
  isBoxSelectAdditive?: boolean;
  onToggleBoxSelectAdditive?: () => void;
  onSelectAllPieces?: () => void;
  onClearSelection?: () => void;
  onInvertSelection?: () => void;
  activeDisplacement?: {
    dx: number;
    dy: number;
    dz: number;
    dist: number;
    isDragging?: boolean;
    isFloorSnapped?: boolean;
    pieceId?: string;
  } | null;
  onApplyDisplacementOffset?: (dx: number, dy: number, dz: number) => void;
  onSnapToFloor?: () => void;
  onSelectPiece: (id: string | null) => void;
  onSelectPieceIds?: (ids: string[]) => void;
  onAddPiece: () => void;
  onUpdatePiece: (id: string, updates: Partial<Piece>) => void;
  onBatchUpdatePieces?: (updates: { id: string; name: string }[]) => void;
  onDeletePiece: (id: string) => void;
  onDuplicatePiece: (id: string) => void;
  onGroupPieces?: () => void;
  onUngroupPieces?: () => void;
  onUpdateGroup?: (groupId: string, name: string) => void;
  snapActive: boolean;
  floorSnapActive?: boolean;
  pieceSnapActive?: boolean;
  onToggleSnap: () => void;
  onToggleFloorSnap?: () => void;
  onTogglePieceSnap?: () => void;
  multiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  transformMode: 'translate' | 'rotate' | 'scale' | 'texture' | 'stretch';
  onChangeTransformMode: (mode: 'translate' | 'rotate' | 'scale' | 'texture' | 'stretch') => void;
  isTextureModalOpen?: boolean;
  onOpenTextureEditor?: () => void;
  dimensionSide?: 'pos' | 'neg';
  onChangeDimensionSide?: (side: 'pos' | 'neg') => void;
  anchorMode?: 'single' | 'center';
  onChangeAnchorMode?: (mode: 'single' | 'center') => void;
  onOpenDimensionEditor?: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenProperties: () => void;
  edgeThicknessConfig?: EdgeThicknessConfig;
  arrayMode?: 'between' | 'offset';
  onChangeArrayMode?: (mode: 'between' | 'offset') => void;
  arrayCount?: number;
  onChangeArrayCount?: (count: number) => void;
  arrayDistanceMm?: number;
  onChangeArrayDistanceMm?: (mm: number) => void;
  arraySpacingType?: 'mm' | 'touching' | 'multiplier';
  onChangeArraySpacingType?: (type: 'mm' | 'touching' | 'multiplier') => void;
  arrayDirection?: 1 | -1;
  onChangeArrayDirection?: (dir: 1 | -1) => void;
  arrayAxis?: 'X' | 'Y' | 'Z';
  onChangeArrayAxis?: (axis: 'X' | 'Y' | 'Z') => void;
  arrayOffset?: number;
  onChangeArrayOffset?: (offset: number) => void;
  onExecuteDistribution?: () => void;
  doorsOpenAngle?: number;
  onToggleDoors?: () => void;
  onSetDoorsAngle?: (angle: number) => void;
  onOpenDynamicDoors?: () => void;
}

// Helper para formatear cantos (distinguiendo Delgado en Cyan y Grueso en Rojo)
interface CantoItem {
  side: 'L1' | 'L2' | 'A1' | 'A2';
  type: 'D' | 'G';
  isGrueso: boolean;
  fullName: string;
}

function getCantoItems(cantos?: EdgeConfig): { items: CantoItem[]; tooltip: string } {
  if (!cantos) return { items: [], tooltip: '' };

  const checkEdge = (side: 'L1' | 'L2' | 'A1' | 'A2', val?: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno'): CantoItem | null => {
    if (!val || val === 'Ninguno') return null;
    const isGrueso = val === 'Canto Grueso';
    return {
      side,
      type: isGrueso ? 'G' : 'D',
      isGrueso,
      fullName: val
    };
  };

  const items: CantoItem[] = [];
  const l1 = checkEdge('L1', cantos.largo1);
  const l2 = checkEdge('L2', cantos.largo2);
  const a1 = checkEdge('A1', cantos.ancho1);
  const a2 = checkEdge('A2', cantos.ancho2);

  if (l1) items.push(l1);
  if (l2) items.push(l2);
  if (a1) items.push(a1);
  if (a2) items.push(a2);

  const tooltipParts = [
    `L1: ${cantos.largo1 || 'Ninguno'}`,
    `L2: ${cantos.largo2 || 'Ninguno'}`,
    `A1: ${cantos.ancho1 || 'Ninguno'}`,
    `A2: ${cantos.ancho2 || 'Ninguno'}`
  ];

  return {
    items,
    tooltip: `Tapacantos: ${tooltipParts.join(', ')} (D = Delgado, G = Grueso)`
  };
}

function getCompactRanuraInfo(piece: Piece) {
  if (!piece.ranurado) return null;
  const cfg = piece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8, cara: 'superior' };
  const caraTag = cfg.cara === 'inferior' ? 'Inf' : 'Sup';
  return {
    text: `${cfg.lado}·${caraTag}·F${cfg.esp}mm`,
    tooltip: `Ranura CNC: Lado ${cfg.lado} (${cfg.cara === 'inferior' ? 'Cara Inferior/Interna' : 'Cara Superior/Externa'}) a ${cfg.dist}mm | Prof: ${cfg.prof}mm | Fondo: ${cfg.esp}mm`
  };
}

export default function ThreeViewerOverlay({
  selectedPieceId,
  selectedPieceIds = [],
  pieces,
  groups,
  onSelectPiece,
  onSelectPieceIds,
  onAddPiece,
  onUpdatePiece,
  onBatchUpdatePieces,
  onDeletePiece,
  onDuplicatePiece,
  onGroupPieces,
  onUngroupPieces,
  onUpdateGroup,
  snapActive,
  floorSnapActive = true,
  pieceSnapActive = true,
  onToggleSnap,
  onToggleFloorSnap,
  onTogglePieceSnap,
  multiSelectMode,
  onToggleMultiSelect,
  transformMode,
  onChangeTransformMode,
  isTextureModalOpen,
  onOpenTextureEditor,
  dimensionSide = 'pos',
  onChangeDimensionSide,
  anchorMode = 'single',
  onChangeAnchorMode,
  onOpenDimensionEditor,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenProperties,
  edgeThicknessConfig = DEFAULT_EDGE_THICKNESS_CONFIG,
  activeDisplacement,
  onApplyDisplacementOffset,
  onSnapToFloor,
  arrayMode = 'between',
  onChangeArrayMode,
  arrayCount = 3,
  onChangeArrayCount,
  arrayDistanceMm = 250,
  onChangeArrayDistanceMm,
  arraySpacingType = 'mm',
  onChangeArraySpacingType,
  arrayDirection = 1,
  onChangeArrayDirection,
  arrayAxis = 'Y',
  onChangeArrayAxis,
  arrayOffset = 1.0,
  onChangeArrayOffset,
  onExecuteDistribution,
  editingGroupId,
  onEnterGroup,
  onExitGroup,
  isBoxSelectActive = false,
  onToggleBoxSelect,
  isBoxSelectAdditive = false,
  onToggleBoxSelectAdditive,
  onSelectAllPieces,
  onClearSelection,
  onInvertSelection,
  doorsOpenAngle = 0,
  onToggleDoors,
  onSetDoorsAngle,
  onOpenDynamicDoors
}: ThreeViewerOverlayProps) {
  
  const selectedPiece = pieces.find(p => p.id === selectedPieceId) || (selectedPieceIds.length > 0 ? pieces.find(p => p.id === selectedPieceIds[0]) : undefined);

  const selectedPieces = React.useMemo(() => {
    const list = pieces.filter(p => selectedPieceIds.includes(p.id));
    if (list.length > 0) return list;
    return selectedPiece ? [selectedPiece] : [];
  }, [pieces, selectedPieceIds, selectedPiece]);

  const isMultiPiece = selectedPieces.length > 1;

  const [isEditingName, setIsEditingName] = React.useState(false);
  const [nameInputValue, setNameInputValue] = React.useState('');
  const [showMagnetMenu, setShowMagnetMenu] = React.useState(false);

  // Sincronizar input de nombre cuando cambia la selección
  React.useEffect(() => {
    if (selectedPiece) {
      const grp = selectedPiece.groupId ? groups?.find(g => g.id === selectedPiece.groupId) : null;
      if (grp && !editingGroupId) {
        setNameInputValue(grp.name);
      } else {
        setNameInputValue(selectedPiece.name || 'PIEZA');
      }
    }
  }, [selectedPiece?.id, selectedPiece?.name, selectedPiece?.groupId, groups, editingGroupId]);

  const handleCommitName = (rawName: string) => {
    const trimmed = rawName.trim();
    if (!trimmed || !selectedPiece) {
      setIsEditingName(false);
      return;
    }
    const grp = selectedPiece.groupId ? groups?.find(g => g.id === selectedPiece.groupId) : null;
    if (grp && !editingGroupId) {
      onUpdateGroup?.(grp.id, trimmed);
    } else {
      onUpdatePiece(selectedPiece.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  const [liveScaleDims, setLiveScaleDims] = React.useState<{ largo: number; ancho: number; espesor: number; isSnapped?: boolean; snapLabel?: string } | null>(null);
  const [is3DBarVisible, setIs3DBarVisible] = React.useState(true);

  // Detección reactiva de puertas en melamina en la escena 3D
  const doorPieces = React.useMemo(() => {
    return pieces.filter(p => p.isDoor || p.doorRole || p.name.toLowerCase().includes('puerta'));
  }, [pieces]);
  const hasDoors = doorPieces.length > 0;
  const currentDoorAngle = doorsOpenAngle ?? 0;
  const isDoorsOpen = currentDoorAngle > 10;

  React.useEffect(() => {
    const handleScaling = (e: any) => {
      setLiveScaleDims(e.detail);
    };
    window.addEventListener('piece-scaling-update', handleScaling);
    return () => window.removeEventListener('piece-scaling-update', handleScaling);
  }, []);

  const activePiece = selectedPiece || (pieces.length > 0 ? pieces[0] : null);

  const handleRotate90 = (axisIndex: 0 | 1 | 2) => {
    if (!activePiece) return;
    if (!selectedPiece) {
      onSelectPiece(activePiece.id);
    }
    const currentRot = activePiece.rotation3D || [0, 0, 0];
    const newRot: [number, number, number] = [currentRot[0], currentRot[1], currentRot[2]];
    newRot[axisIndex] += Math.PI / 2;
    onUpdatePiece(activePiece.id, { rotation3D: newRot });
  };

  const handleDuplicate = () => {
    if (selectedPieceIds.length > 1) {
      onDuplicatePiece(selectedPieceIds[0]);
      return;
    }
    if (!activePiece) return;
    onDuplicatePiece(activePiece.id);
  };

  const handleDelete = () => {
    if (selectedPieceIds.length > 1) {
      onDeletePiece('');
      return;
    }
    if (!activePiece) return;
    onDeletePiece(activePiece.id);
  };

  const handleToggleHide = () => {
    if (selectedPieces.length > 1) {
      const anyVisible = selectedPieces.some(p => !p.hidden);
      selectedPieces.forEach(p => {
        onUpdatePiece(p.id, { hidden: anyVisible });
      });
      if (anyVisible) {
        onSelectPiece(null);
      }
      return;
    }
    const target = selectedPiece || activePiece;
    if (!target) return;
    onUpdatePiece(target.id, { hidden: !target.hidden });
    if (!target.hidden) {
      onSelectPiece(null);
    }
  };

  const hasSelection = Boolean(selectedPiece || selectedPieceIds.length > 0);
  const isSelectionHidden = selectedPieces.length > 0 
    ? selectedPieces.every(p => p.hidden) 
    : Boolean(selectedPiece?.hidden);

  const hiddenCount = pieces.filter(p => p.hidden).length;

  const handleUnhideAll = () => {
    pieces.forEach(p => {
      if (p.hidden) {
        onUpdatePiece(p.id, { hidden: false });
      }
    });
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none">
      
      {/* Top Floating Mini-Toolbar */}
      <div className="absolute top-2 left-2 sm:left-4 flex items-center gap-1 sm:gap-1.5 pointer-events-auto flex-wrap max-w-[calc(100vw-55px)] z-20">
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
          <ViewportIconButton icon={<Undo2 />} onClick={onUndo} disabled={!canUndo} hoverText="Deshacer" />
          <ViewportIconButton icon={<Redo2 />} onClick={onRedo} disabled={!canRedo} hoverText="Rehacer" />
        </div>
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a] items-center">
          <div className="relative flex items-center">
            <ViewportIconButton 
              icon={<Magnet />} 
              onClick={onToggleSnap} 
              active={snapActive} 
              hoverText={`Magnetismo: ${pieceSnapActive ? 'Piezas [ON]' : 'Piezas [OFF]'} · ${floorSnapActive ? 'Suelo [ON]' : 'Suelo [OFF]'}`} 
            />
            <button
              type="button"
              onClick={() => setShowMagnetMenu(prev => !prev)}
              title="Opciones de magnetismo (Piezas y Suelo)"
              className={`px-0.5 py-1.5 rounded transition-colors text-[9px] hover:bg-[#4d4d4d] cursor-pointer ${
                showMagnetMenu ? 'text-[#f0a144]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {showMagnetMenu && (
              <div 
                className="absolute top-full left-0 mt-1.5 bg-[#1e1e1e] border border-[#333333] rounded-lg shadow-2xl p-2 z-50 min-w-[210px] text-xs flex flex-col gap-1.5 backdrop-blur-md"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-1 pb-1 border-b border-[#2e2e2e] flex items-center justify-between">
                  <span>Opciones Magnetismo</span>
                  <button 
                    type="button"
                    onClick={() => setShowMagnetMenu(false)}
                    className="text-gray-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Piece Snap Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    onTogglePieceSnap?.();
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    pieceSnapActive ? 'bg-[#f0a144]/15 text-[#f0a144]' : 'text-gray-300 hover:bg-[#2a2a2a]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <div className="text-left">
                      <div className="font-semibold text-[11px]">Imán de Piezas</div>
                      <div className="text-[9px] text-gray-400">Pega caras y cantos entre piezas</div>
                    </div>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                    pieceSnapActive ? 'bg-[#f0a144] border-[#f0a144] text-black font-bold' : 'border-gray-600 text-transparent'
                  }`}>
                    ✓
                  </div>
                </button>

                {/* Floor Snap Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleFloorSnap?.();
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    floorSnapActive ? 'bg-[#f0a144]/15 text-[#f0a144]' : 'text-gray-300 hover:bg-[#2a2a2a]'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <ArrowDownToLine className="w-3.5 h-3.5" />
                    <div className="text-left">
                      <div className="font-semibold text-[11px]">Imán de Suelo (0 mm)</div>
                      <div className="text-[9px] text-gray-400">Bloquea apoyo al nivel de piso</div>
                    </div>
                  </div>
                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                    floorSnapActive ? 'bg-[#f0a144] border-[#f0a144] text-black font-bold' : 'border-gray-600 text-transparent'
                  }`}>
                    ✓
                  </div>
                </button>

                {/* Quick Info text */}
                <div className="text-[9px] text-gray-400 px-1 pt-1 border-t border-[#2e2e2e] leading-snug">
                  Arrastra sobre los ejes X o Z para pegar parantes a la base sin despegarlos del suelo.
                </div>
              </div>
            )}
          </div>
          <ViewportIconButton icon={<ListPlus />} onClick={onToggleMultiSelect} active={multiSelectMode} hoverText="Selección múltiple" />
        </div>

        {/* Pestaña Única de Selección por Recuadro: Cuadrito con puntitos y flechita como puntero */}
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
          <ViewportIconButton 
            icon={<MousePointerSquareDashed className={isBoxSelectActive ? "text-[#f0a144]" : ""} />} 
            onClick={() => {
              if (navigator.vibrate) {
                try { navigator.vibrate(20); } catch {}
              }
              onToggleBoxSelect?.();
            }} 
            active={isBoxSelectActive} 
            hoverText={isBoxSelectActive ? "Desactivar recuadro de selección" : "Activar selección por recuadro (arrastrar en pantalla)"} 
          />
        </div>

        {/* Pestaña / Botón de Puertas en Melamina (Efecto de apertura super interactivo - Lugar óptimo en barra superior) */}
        {hasDoors ? (
          <div className="flex items-center bg-[#1d1d1d]/90 backdrop-blur-md rounded p-0.5 border border-[#2a2a2a] gap-1 shadow-md">
            <button
              type="button"
              onClick={() => onToggleDoors?.()}
              className={`px-2 py-1 rounded flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer select-none active:scale-95 ${
                isDoorsOpen
                  ? 'bg-[#f0a144] text-black font-black shadow-xs'
                  : 'bg-[#282828] text-white hover:bg-[#333333]'
              }`}
              title={isDoorsOpen ? "Cerrar puertas en 3D (0°)" : "Abrir puertas en 3D (95°)"}
            >
              <span className="text-xs">🚪</span>
              <span>{isDoorsOpen ? 'Cerrar Puertas' : 'Abrir Puertas'}</span>
              <span className={`text-[8.5px] px-1 py-0.2 rounded font-mono font-bold ${
                isDoorsOpen ? 'bg-black/25 text-black' : 'bg-white/10 text-gray-300'
              }`}>
                {currentDoorAngle}°
              </span>
            </button>

            <div className="flex items-center gap-0.5 border-l border-[#333] pl-1 pr-0.5">
              <button
                type="button"
                onClick={() => onSetDoorsAngle?.(0)}
                className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold cursor-pointer transition-all ${
                  currentDoorAngle === 0 ? 'bg-[#f0a144]/25 text-[#f0a144]' : 'text-gray-400 hover:text-white'
                }`}
                title="Cerrar puertas (0°)"
              >
                0°
              </button>
              <button
                type="button"
                onClick={() => onSetDoorsAngle?.(45)}
                className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold cursor-pointer transition-all ${
                  currentDoorAngle > 20 && currentDoorAngle < 70 ? 'bg-[#f0a144]/25 text-[#f0a144]' : 'text-gray-400 hover:text-white'
                }`}
                title="Semi-abrir puertas (45°)"
              >
                45°
              </button>
              <button
                type="button"
                onClick={() => onSetDoorsAngle?.(95)}
                className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold cursor-pointer transition-all ${
                  currentDoorAngle >= 70 ? 'bg-[#f0a144]/25 text-[#f0a144]' : 'text-gray-400 hover:text-white'
                }`}
                title="Abrir puertas (95°)"
              >
                95°
              </button>
            </div>
          </div>
        ) : (
          onOpenDynamicDoors && (
            <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
              <ViewportIconButton
                icon={<span className="text-xs">🚪</span>}
                onClick={onOpenDynamicDoors}
                hoverText="Añadir puertas en melamina (Compartida en 2, en 4, solo 2 arriba o abajo)"
              />
            </div>
          )
        )}
        
        {/* Botones de apoyo (Desagrupar y Mostrar ocultas si existen) */}
        {(Boolean(selectedPieceIds.length > 0 && selectedPiece?.groupId) || hiddenCount > 0) && (
          <div className="flex items-center bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a] gap-0.5">
            {selectedPieceIds.length > 0 && selectedPiece?.groupId && (
              <ViewportIconButton icon={<Ungroup />} onClick={onUngroupPieces} hoverText="Desagrupar piezas" />
            )}
            {hiddenCount > 0 && (
              <ViewportIconButton 
                icon={<Eye className="text-amber-400" />} 
                onClick={handleUnhideAll} 
                hoverText={`Mostrar todas las piezas ocultas (${hiddenCount})`} 
              />
            )}
          </div>
        )}
      </div>

      {/* Barra Superior Compacta de la Pieza (Chip elegante, no estorba la vista 3D) */}
      {selectedPiece && (() => {
        const { items: cantoItems } = getCantoItems(selectedPiece.cantos);
        const ranuraBadgeInfo = getCompactRanuraInfo(selectedPiece);
        const matKey = selectedPiece.material || 'Blanco';
        const matInfo = MATERIAL_MAP[matKey];
        const matDisplayName = matInfo ? matInfo.name : matKey;
        const matColor = selectedPiece.customColor || matInfo?.color || '#f8fafc';
        const sampleTextureUrl = selectedPiece.faceTextures 
          ? (selectedPiece.faceTextures.top || selectedPiece.faceTextures.front || selectedPiece.faceTextures.bottom || selectedPiece.faceTextures.back || selectedPiece.faceTextures.left || selectedPiece.faceTextures.right)
          : null;
        const currentGroup = selectedPiece.groupId ? groups?.find(g => g.id === selectedPiece.groupId) : null;
        const groupPiecesCount = currentGroup ? pieces.filter(p => p.groupId === currentGroup.id).length : 0;

        return (
          <div className="absolute top-12 left-3 sm:left-4 pointer-events-auto z-20 flex flex-col items-start gap-1 max-w-[calc(100vw-80px)] select-none">
            {/* Párrafo 1: Nombre de la Pieza o Grupo + Botón Entrar/Salir */}
            <div className="inline-flex items-center gap-1.5 bg-[#141414]/90 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-lg text-[9px] flex-nowrap whitespace-nowrap">
              <span 
                className="w-2 h-2 rounded-full shrink-0 border border-white/30 shadow-xs"
                style={{ backgroundColor: matColor }}
                title={`Material: ${matDisplayName}`}
              />

              {currentGroup ? (
                /* Cuando es un grupo: mostrar el nombre del grupo directamente (sin 'NUEVA PIEZA') */
                editingGroupId ? (
                  /* Modo dentro del grupo: editando piezas del grupo */
                  <div className="inline-flex items-center gap-1 flex-nowrap shrink-0">
                    <div className="flex items-center gap-1 bg-cyan-950/80 px-1.5 py-0.5 rounded-full border border-cyan-500/50 text-cyan-300 shrink-0">
                      <FolderOpen className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                      <span className="font-black uppercase text-[8px] sm:text-[9px] truncate max-w-[70px] sm:max-w-[120px]">
                        {currentGroup.name}
                      </span>
                    </div>

                    {isEditingName ? (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          autoFocus
                          value={nameInputValue}
                          onChange={(e) => setNameInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleCommitName(nameInputValue);
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                          className="bg-[#0a0a0a] border border-[#f0a144] text-[#f0a144] font-bold text-[9px] uppercase px-1 py-0.2 rounded outline-none max-w-[80px]"
                        />
                        <button 
                          type="button" 
                          onClick={() => handleCommitName(nameInputValue)} 
                          className="p-0.5 rounded bg-[#f0a144] text-black"
                        >
                          <Check className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center gap-1 cursor-pointer group shrink-0"
                        onClick={() => {
                          setNameInputValue(selectedPiece.name || 'PIEZA');
                          setIsEditingName(true);
                        }}
                        title="Clic para renombrar pieza dentro del grupo"
                      >
                        <span className="font-black uppercase text-[#f0a144] truncate max-w-[70px] sm:max-w-[110px]">
                          {selectedPiece.name || 'PIEZA'}
                        </span>
                        <Pencil className="w-2 h-2 text-gray-400 group-hover:text-[#f0a144] shrink-0" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={onExitGroup}
                      className="flex items-center gap-0.5 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[7.5px] px-1.5 py-0.5 rounded-full transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title="Salir del modo edición de grupo (Esc)"
                    >
                      <Check className="w-2 h-2 shrink-0" />
                      <span>Salir</span>
                    </button>
                  </div>
                ) : (
                  /* Grupo seleccionado completo: opción para renombrar o entrar al grupo */
                  <div className="inline-flex items-center gap-1 flex-nowrap shrink-0">
                    {isEditingName ? (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          autoFocus
                          value={nameInputValue}
                          onChange={(e) => setNameInputValue(e.target.value)}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleCommitName(nameInputValue);
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                          className="bg-[#0a0a0a] border border-cyan-400 text-cyan-300 font-bold text-[9px] uppercase px-1.5 py-0.5 rounded outline-none max-w-[110px]"
                        />
                        <button 
                          type="button" 
                          onClick={() => handleCommitName(nameInputValue)} 
                          className="p-0.5 rounded bg-cyan-500 text-black hover:bg-cyan-400 transition-colors"
                          title="Guardar nombre del grupo"
                        >
                          <Check className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center gap-0.5 cursor-pointer group/grp shrink-0"
                        onClick={() => {
                          setNameInputValue(currentGroup.name);
                          setIsEditingName(true);
                        }}
                        title="Clic para renombrar grupo"
                      >
                        <Group className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                        <span className="font-black uppercase text-cyan-300 truncate max-w-[80px] sm:max-w-[130px]">
                          {currentGroup.name}
                        </span>
                        <span className="text-[7.5px] font-mono text-cyan-400/80 shrink-0">({groupPiecesCount}pz)</span>
                        <Pencil className="w-2 h-2 text-cyan-500/60 group-hover/grp:text-cyan-300 shrink-0 ml-0.5" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => onEnterGroup?.(currentGroup.id)}
                      className="flex items-center gap-0.5 bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black font-bold text-[7.5px] px-1.5 py-0.5 rounded-full border border-cyan-400/40 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                      title="Entrar al grupo para editar piezas individuales dentro de él (o doble clic)"
                    >
                      <FolderOpen className="w-2.5 h-2.5 shrink-0" />
                      <span>Entrar</span>
                    </button>
                  </div>
                )
              ) : (
                /* Cuando es una pieza individual: mostrar nombre de pieza */
                isEditingName ? (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      autoFocus
                      value={nameInputValue}
                      onChange={(e) => setNameInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleCommitName(nameInputValue);
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                      className="bg-[#0a0a0a] border border-[#f0a144] text-[#f0a144] font-bold text-[9px] uppercase px-1 py-0.2 rounded outline-none max-w-[120px]"
                    />
                    <button 
                      type="button" 
                      onClick={() => handleCommitName(nameInputValue)} 
                      className="p-0.5 rounded bg-[#f0a144] text-black"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <div 
                    className="flex items-center gap-1 cursor-pointer group shrink-0"
                    onClick={() => {
                      setNameInputValue(selectedPiece.name || 'PIEZA');
                      setIsEditingName(true);
                    }}
                    title="Clic para renombrar pieza"
                  >
                    <span className="font-black uppercase text-[#f0a144] truncate max-w-[100px] sm:max-w-[150px]">
                      {selectedPiece.name || 'PIEZA'}
                    </span>
                    <Pencil className="w-2 h-2 text-gray-400 group-hover:text-[#f0a144] shrink-0" />
                  </div>
                )
              )}
            </div>

            {/* Párrafo 2: Color de la pieza / Material */}
            <div 
              onClick={onOpenTextureEditor}
              className={`inline-flex items-center gap-1.5 bg-[#121316]/95 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 shadow-md text-[8px] transition-all whitespace-nowrap ${
                onOpenTextureEditor ? 'cursor-pointer hover:border-[#f0a144]/60 hover:bg-[#1c1d24]' : ''
              }`}
              title="Material y color de la pieza (Clic para abrir catálogo)"
            >
              <span 
                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/40 shadow-xs"
                style={{ 
                  backgroundColor: matColor,
                  backgroundImage: sampleTextureUrl ? `url(${sampleTextureUrl})` : undefined,
                  backgroundSize: 'cover'
                }}
              />
              <span className="font-semibold text-gray-200 truncate max-w-[140px] sm:max-w-[220px]">
                {matDisplayName}
              </span>
              {selectedPiece.veta && (
                <span className="text-[7px] font-mono text-[#f0a144] bg-[#f0a144]/15 px-1 py-0.2 rounded border border-[#f0a144]/30 font-bold">
                  VETA
                </span>
              )}
              {onOpenTextureEditor && (
                <Palette className="w-2.5 h-2.5 text-gray-400 hover:text-[#f0a144] ml-0.5 shrink-0" />
              )}
            </div>

            {/* Párrafo 3: Medidas de la pieza + Cantos + Ranura + Controles (Ocultar / Deseleccionar) */}
            <div className="inline-flex items-center gap-1.5 bg-[#141414]/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/10 shadow-lg text-[8.5px] whitespace-nowrap flex-nowrap">
              <Ruler className="w-2.5 h-2.5 text-[#f0a144] shrink-0" />
              <span className="text-gray-200 font-mono font-bold text-[8.5px] whitespace-nowrap">
                {liveScaleDims ? liveScaleDims.largo : Math.round(selectedPiece.largo)}×
                {liveScaleDims ? liveScaleDims.ancho : Math.round(selectedPiece.ancho)}×
                {liveScaleDims ? liveScaleDims.espesor : Math.round(selectedPiece.espesor)}
                <span className="text-[7px] text-gray-400 ml-0.5">mm</span>
              </span>

              {liveScaleDims?.isSnapped && (
                <span className="inline-flex items-center gap-0.5 text-[7px] font-bold text-[#fbbf24] bg-amber-950/80 px-1 py-0.2 rounded border border-amber-500/50 shrink-0 animate-pulse">
                  <span>🧲</span>
                  <span>{liveScaleDims.snapLabel ? liveScaleDims.snapLabel.toUpperCase() : 'IMÁN'}</span>
                </span>
              )}

              {cantoItems.length > 0 && (
                <span className="inline-flex text-[7px] font-mono text-cyan-300 bg-cyan-950/60 px-1 py-0.2 rounded border border-cyan-800/50 shrink-0">
                  C:{cantoItems.map(c => c.side).join(',')}
                </span>
              )}

              {ranuraBadgeInfo && (
                <span className="inline-flex text-[7px] font-mono text-amber-300 bg-amber-950/60 px-1 py-0.2 rounded border border-amber-800/50 shrink-0">
                  R:{ranuraBadgeInfo.text}
                </span>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent('focus-selected-piece'));
                }}
                className="inline-flex items-center gap-1 text-[7.5px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/35 px-1.5 py-0.5 rounded-full border border-amber-500/40 cursor-pointer transition-colors"
                title="Acercar la cámara a detalle de la pieza (Tecla F / Doble clic)"
              >
                <Focus className="w-2.5 h-2.5" />
                <span>Detalle [F]</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Barra Inferior Modular de Opciones (Dock Móvil y Práctico) */}
      {!isTextureModalOpen && (
        <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-auto z-20 w-full max-w-[98vw] px-2">
          {/* Barra Activa Desplegable (Ultra compacta, directamente sobre las pestañas) */}
          {activeOptionTab && selectedPiece && (() => {
            const currentCantos = selectedPiece?.cantos || {
              largo1: 'Ninguno',
              largo2: 'Ninguno',
              ancho1: 'Ninguno',
              ancho2: 'Ninguno'
            };

            const cycleEdge = (val: EdgeConfig['largo1'], reverse = false): EdgeConfig['largo1'] => {
              const order: EdgeConfig['largo1'][] = ['Ninguno', 'Canto Delgado', 'Canto Grueso'];
              const idx = order.indexOf(val);
              if (reverse) {
                return order[(idx - 1 + order.length) % order.length];
              }
              return order[(idx + 1) % order.length];
            };

            const handleCycleEdge = (edge: keyof EdgeConfig, reverse = false) => {
              if (!selectedPiece) return;
              const cur = currentCantos[edge] || 'Ninguno';
              const next = cycleEdge(cur, reverse);
              const newCantos = { ...currentCantos, [edge]: next };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, { cantos: newCantos }));
              } else {
                onUpdatePiece(selectedPiece.id, { cantos: newCantos });
              }
            };

            const allVals = [currentCantos.largo1, currentCantos.largo2, currentCantos.ancho1, currentCantos.ancho2];
            const allDelgado = allVals.every(v => v === 'Canto Delgado');
            const allGrueso = allVals.every(v => v === 'Canto Grueso');
            const allNone = allVals.every(v => v === 'Ninguno');

            const handleCycleAll = () => {
              if (!selectedPiece) return;
              let next: EdgeConfig['largo1'] = 'Canto Delgado';
              if (allDelgado) next = 'Canto Grueso';
              else if (allGrueso) next = 'Ninguno';
              else next = 'Canto Delgado';

              const newCantos = { largo1: next, largo2: next, ancho1: next, ancho2: next };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, { cantos: newCantos }));
              } else {
                onUpdatePiece(selectedPiece.id, { cantos: newCantos });
              }
            };

            const handleSetAllEdges = (type: EdgeConfig['largo1']) => {
              if (!selectedPiece) return;
              const newCantos = { largo1: type, largo2: type, ancho1: type, ancho2: type };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, { cantos: newCantos }));
              } else {
                onUpdatePiece(selectedPiece.id, { cantos: newCantos });
              }
            };

            const allBadgeText = allDelgado ? 'TODOS: DEL' : allGrueso ? 'TODOS: GRU' : allNone ? 'TODOS: NO' : 'CANTOS';
            const cutInfo: CutDimensionResult = selectedPiece 
              ? calculatePieceCutDimensions(selectedPiece, edgeThicknessConfig) 
              : {
                  largoFinal: 0,
                  anchoFinal: 0,
                  largoCorte: 0,
                  anchoCorte: 0,
                  descuentoA1: 0,
                  descuentoA2: 0,
                  descuentoL1: 0,
                  descuentoL2: 0,
                  descuentoLargoTotal: 0,
                  descuentoAnchoTotal: 0,
                  tieneDescuento: false
                };

            const matInfo = selectedPiece ? getMaterialDefinition(selectedPiece.material) : null;
            const matDisplayName = matInfo ? matInfo.name : (selectedPiece?.material || 'Melamina');
            const actualColor = selectedPiece?.customColor || matInfo?.color || '#ffffff';
            const texturedFacesCount = selectedPiece?.faceTextures 
              ? Object.values(selectedPiece.faceTextures).filter(Boolean).length 
              : 0;
            const sampleTextureUrl = selectedPiece?.faceTextures 
              ? (selectedPiece.faceTextures.top || Object.values(selectedPiece.faceTextures).find(Boolean))
              : null;
            const displayTexture = sampleTextureUrl;

            const currentVetaRot = selectedPiece ? (selectedPiece.vetaRotation ?? (selectedPiece.vetaOrientacion === 'transversal' ? 90 : 0)) : 0;
            const isTransversal = selectedPiece ? (selectedPiece.vetaOrientacion === 'transversal' || currentVetaRot === 90 || currentVetaRot === 270) : false;

            const handleRotateVetaAndTexture = () => {
              const nextRot = (currentVetaRot + 90) % 360;
              const nextOrientacion = (nextRot === 90 || nextRot === 270) ? 'transversal' : 'longitudinal';
              const updatedConfigs = { ...(selectedPiece.faceTextureConfigs || {}) };
              const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
              allFaces.forEach(f => {
                updatedConfigs[f] = {
                  repeatX: updatedConfigs[f]?.repeatX || 1,
                  repeatY: updatedConfigs[f]?.repeatY || 1,
                  rotation: nextRot
                };
              });
              const updates: Partial<Piece> = {
                veta: true,
                vetaRotation: nextRot,
                vetaOrientacion: nextOrientacion,
                faceTextureConfigs: updatedConfigs
              };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
              } else {
                onUpdatePiece(selectedPiece.id, updates);
              }
            };

            const handleSetOrientation = (orient: 'longitudinal' | 'transversal') => {
              const nextRot = orient === 'transversal' ? 90 : 0;
              const updatedConfigs = { ...(selectedPiece.faceTextureConfigs || {}) };
              const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
              allFaces.forEach(f => {
                updatedConfigs[f] = {
                  repeatX: updatedConfigs[f]?.repeatX || 1,
                  repeatY: updatedConfigs[f]?.repeatY || 1,
                  rotation: nextRot
                };
              });
              const updates: Partial<Piece> = {
                veta: true,
                vetaRotation: nextRot,
                vetaOrientacion: orient,
                faceTextureConfigs: updatedConfigs
              };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
              } else {
                onUpdatePiece(selectedPiece.id, updates);
              }
            };

            const handleToggleVeta = () => {
              const nextVeta = !selectedPiece.veta;
              const updates: Partial<Piece> = {
                veta: nextVeta,
                ...(nextVeta ? {
                  vetaOrientacion: (currentVetaRot === 90 || currentVetaRot === 270) ? 'transversal' : 'longitudinal',
                  vetaRotation: currentVetaRot
                } : {})
              };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
              } else {
                onUpdatePiece(selectedPiece.id, updates);
              }
            };

            const currentUvScale = selectedPiece.faceTextureConfigs?.top?.repeatX ?? 1;

            const handleSetUvScale = (newScale: number) => {
              const scale = Math.max(0.25, Math.min(6.0, Number(newScale.toFixed(2))));
              const updatedConfigs = { ...(selectedPiece.faceTextureConfigs || {}) };
              const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
              allFaces.forEach(f => {
                updatedConfigs[f] = {
                  ...(updatedConfigs[f] || {}),
                  repeatX: scale,
                  repeatY: scale,
                  rotation: updatedConfigs[f]?.rotation ?? currentVetaRot
                };
              });
              const updates: Partial<Piece> = { faceTextureConfigs: updatedConfigs };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
              } else {
                onUpdatePiece(selectedPiece.id, updates);
              }
            };

            const handleRandomizeVetaOffset = () => {
              const updatedConfigs = { ...(selectedPiece.faceTextureConfigs || {}) };
              const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
              const randX = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100;
              const randY = Math.round((Math.random() * 0.8 + 0.1) * 100) / 100;
              allFaces.forEach(f => {
                updatedConfigs[f] = {
                  ...(updatedConfigs[f] || {}),
                  offsetX: randX,
                  offsetY: randY,
                  rotation: updatedConfigs[f]?.rotation ?? currentVetaRot
                };
              });
              const updates: Partial<Piece> = { faceTextureConfigs: updatedConfigs };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
              } else {
                onUpdatePiece(selectedPiece.id, updates);
              }
            };

            const handleResetUvConfigs = () => {
              const defaultConfigs: Record<PieceFaceKey, FaceTextureOptions> = {
                top: { repeatX: 1, repeatY: 1, rotation: 0, offsetX: 0, offsetY: 0 },
                bottom: { repeatX: 1, repeatY: 1, rotation: 0, offsetX: 0, offsetY: 0 },
                front: { repeatX: 1, repeatY: 1, rotation: 0, offsetX: 0, offsetY: 0 },
                back: { repeatX: 1, repeatY: 1, rotation: 0, offsetX: 0, offsetY: 0 },
                left: { repeatX: 1, repeatY: 1, rotation: 0, offsetX: 0, offsetY: 0 },
                right: { repeatX: 1, repeatY: 1, rotation: 0, offsetX: 0, offsetY: 0 }
              };
              const updates: Partial<Piece> = {
                faceTextureConfigs: defaultConfigs,
                vetaRotation: 0,
                vetaOrientacion: 'longitudinal'
              };
              if (isMultiPiece) {
                selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
              } else {
                onUpdatePiece(selectedPiece.id, updates);
              }
            };

            return (
              <div className="bg-[#181818]/95 backdrop-blur-md rounded-2xl border border-[#333333] shadow-2xl p-2 sm:p-2.5 flex flex-col gap-1.5 w-full max-w-[360px] max-h-[50vh] overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                {/* Header del panel activo */}
                <div className="flex items-center justify-between gap-4 pb-1 border-b border-white/5">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-[#f0a144] flex items-center gap-1.5">
                    {activeOptionTab === 'medidas' && <><Ruler className="w-3 h-3 text-[#f0a144]" /> Medidas <span className="text-[7px] text-gray-400 font-normal lowercase tracking-normal">(toca ✓ para confirmar)</span></>}
                    {activeOptionTab === 'material' && <><Palette className="w-3 h-3 text-[#f0a144]" /> Materiales & Texturas</>}
                    {activeOptionTab === 'cantos' && <><Layers className="w-3 h-3 text-[#f0a144]" /> Cantos (Tapacantos)</>}
                    {activeOptionTab === 'ranura' && <><Scissors className="w-3 h-3 text-amber-400" /> Ranurado para Fondo o Respaldo</>}
                    {activeOptionTab === 'veta' && <><Sliders className="w-3 h-3 text-[#f0a144]" /> Veta y Mapeo UV <span className="text-[7px] text-gray-400 font-normal lowercase">(textura y corte 2D)</span></>}
                    {activeOptionTab === 'acciones' && <><Zap className="w-3 h-3 text-[#f0a144]" /> Acciones & Distribución</>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveOptionTab(null)}
                    className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                    title="Cerrar panel"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 1. Medidas: Reorganizado en 3 columnas 100% responsive para móvil */}
                {activeOptionTab === 'medidas' && (
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    <EntityCompactDimField
                      label="Largo"
                      axis="X"
                      axisColor="text-red-400"
                      borderFocus="focus-within:border-red-500/70"
                      value={liveScaleDims ? liveScaleDims.largo : Math.round(selectedPiece.largo)}
                      min={10}
                      onCommit={(val) => {
                        if (isMultiPiece) {
                          selectedPieces.forEach(p => onUpdatePiece(p.id, { largo: val }));
                        } else {
                          onUpdatePiece(selectedPiece.id, { largo: val });
                        }
                      }}
                    />
                    <EntityCompactDimField
                      label="Espesor"
                      axis="Y"
                      axisColor="text-emerald-400"
                      borderFocus="focus-within:border-emerald-500/70"
                      value={liveScaleDims ? liveScaleDims.espesor : Math.round(selectedPiece.espesor)}
                      min={1}
                      max={100}
                      onCommit={(val) => {
                        if (isMultiPiece) {
                          selectedPieces.forEach(p => onUpdatePiece(p.id, { espesor: val }));
                        } else {
                          onUpdatePiece(selectedPiece.id, { espesor: val });
                        }
                      }}
                    />
                    <EntityCompactDimField
                      label="Ancho"
                      axis="Z"
                      axisColor="text-blue-400"
                      borderFocus="focus-within:border-blue-500/70"
                      value={liveScaleDims ? liveScaleDims.ancho : Math.round(selectedPiece.ancho)}
                      min={10}
                      onCommit={(val) => {
                        if (isMultiPiece) {
                          selectedPieces.forEach(p => onUpdatePiece(p.id, { ancho: val }));
                        } else {
                          onUpdatePiece(selectedPiece.id, { ancho: val });
                        }
                      }}
                    />
                  </div>
                )}

                {/* 2. Material: Optimizada con vista previa y botón directo */}
                {activeOptionTab === 'material' && (
                  <div className="flex flex-col gap-1.5 w-full py-0.5">
                    <div className="flex items-center justify-between gap-2 bg-[#101010] p-1.5 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span 
                          className="w-4 h-4 rounded-full shrink-0 border border-white/30 shadow-xs"
                          style={{ 
                            backgroundColor: actualColor,
                            backgroundImage: sampleTextureUrl ? `url(${sampleTextureUrl})` : undefined,
                            backgroundSize: 'cover'
                          }}
                        />
                        <span className="text-[8.5px] font-bold text-gray-200 truncate">{matDisplayName}</span>
                      </div>
                      {sampleTextureUrl && (
                        <span className="text-[7px] font-mono text-[#f0a144] bg-[#f0a144]/15 px-1 py-0.5 rounded border border-[#f0a144]/30 font-bold shrink-0">
                          TEXTURA 3D
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onOpenTextureEditor && (
                        <button
                          type="button"
                          onClick={onOpenTextureEditor}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-[#f0a144] hover:bg-[#ffba66] text-black font-black text-[8.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                          title="Abrir Catálogo de Materiales"
                        >
                          <Palette className="w-3.5 h-3.5 text-black" />
                          <span>Catálogo de Materiales</span>
                        </button>
                      )}

                      {sampleTextureUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            const defaultWhite = MATERIAL_MAP['Blanco'];
                            const updates: Partial<Piece> = { 
                              material: 'Blanco',
                              customColor: defaultWhite.color,
                              customRoughness: defaultWhite.roughness,
                              customMetalness: defaultWhite.metalness,
                              customOpacity: 1.0,
                              isGlass: false,
                              isMirror: false,
                              cantoColor: undefined,
                              faceTextures: undefined, 
                              faceTextureConfigs: undefined, 
                              veta: false,
                              vetaRotation: 0,
                              vetaOrientacion: 'longitudinal'
                            };
                            if (isMultiPiece) {
                              selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
                            } else {
                              onUpdatePiece(selectedPiece.id, updates);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 text-[8px] font-bold px-2 py-1.5 rounded-lg bg-red-950/40 border border-red-800/40 transition-colors cursor-pointer shrink-0"
                          title="Quitar textura y aplicar melamina blanco mate por defecto"
                        >
                          Quitar textura
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Cantos: Barra ultra compacta en 1 sola fila con esquemático 2D y presets rápidos */}
                {activeOptionTab === 'cantos' && (
                  <div className="flex flex-col gap-1.5 w-full">
                    {/* Fila única de 4 bordes: L1, L2, A1, A2 */}
                    <div className="grid grid-cols-4 gap-1 w-full">
                      <EntityCantoField
                        label="L1"
                        sub="Frente"
                        edgeKey="largo1"
                        value={currentCantos.largo1}
                        gruesoMm={edgeThicknessConfig.grueso}
                        delgadoMm={edgeThicknessConfig.delgado}
                        onCycle={(rev) => handleCycleEdge('largo1', rev)}
                      />
                      <EntityCantoField
                        label="L2"
                        sub="Atrás"
                        edgeKey="largo2"
                        value={currentCantos.largo2}
                        gruesoMm={edgeThicknessConfig.grueso}
                        delgadoMm={edgeThicknessConfig.delgado}
                        onCycle={(rev) => handleCycleEdge('largo2', rev)}
                      />
                      <EntityCantoField
                        label="A1"
                        sub="Der"
                        edgeKey="ancho1"
                        value={currentCantos.ancho1}
                        gruesoMm={edgeThicknessConfig.grueso}
                        delgadoMm={edgeThicknessConfig.delgado}
                        onCycle={(rev) => handleCycleEdge('ancho1', rev)}
                      />
                      <EntityCantoField
                        label="A2"
                        sub="Izq"
                        edgeKey="ancho2"
                        value={currentCantos.ancho2}
                        gruesoMm={edgeThicknessConfig.grueso}
                        delgadoMm={edgeThicknessConfig.delgado}
                        onCycle={(rev) => handleCycleEdge('ancho2', rev)}
                      />
                    </div>

                    {/* Presets rápidos de 1 toque + Medida neta de corte */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5 text-[7.5px]">
                      {/* Presets de 1 toque */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSetAllEdges('Canto Delgado')}
                          className="font-mono font-bold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                          title="Aplicar Canto Delgado a los 4 bordes"
                        >
                          4 DEL
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllEdges('Canto Grueso')}
                          className="font-mono font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                          title="Aplicar Canto Grueso a los 4 bordes"
                        >
                          4 GRU
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetAllEdges('Ninguno')}
                          className="font-mono font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-1.5 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                          title="Quitar todos los tapacantos"
                        >
                          Sin Cantos
                        </button>
                      </div>

                      {/* Info de corte con descuento */}
                      <span className="font-mono text-gray-300 text-right truncate">
                        Corte: <span className="text-[#f0a144] font-bold">{cutInfo.largoCorte}×{cutInfo.anchoCorte}</span>
                        {cutInfo.tieneDescuento ? (
                          <span className="text-red-400 ml-1 font-bold">(-{(cutInfo.descuentoLargoTotal + cutInfo.descuentoAnchoTotal).toFixed(1)}mm)</span>
                        ) : (
                          <span className="text-gray-500 ml-1 font-normal">(bruto)</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* Ranura: Mecanizado y grosor de fondo/respaldo */}
                {activeOptionTab === 'ranura' && (
                  <div className="w-full">
                    <RanuraConfigCard 
                      piece={selectedPiece} 
                      onUpdate={(patch) => onUpdatePiece(selectedPiece.id, patch)} 
                      compact={false}
                      selectedPieces={selectedPieces}
                      onUpdateMultiple={(updates) => {
                        updates.forEach(u => onUpdatePiece(u.id, u.patch));
                      }}
                    />
                  </div>
                )}

                {/* 4. Veta y Mapeo UV: Interactivo, compacto y con lógica de plancha 2D */}
                {activeOptionTab === 'veta' && (
                  <div className="flex flex-col gap-1.5 w-full">
                    {/* Fila 1: Control principal de Veta y Dirección */}
                    <div className="flex items-center gap-1 w-full justify-between">
                      <button
                        type="button"
                        onClick={handleToggleVeta}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-[8px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          selectedPiece.veta ? 'bg-[#f0a144]/20 border-[#f0a144] text-white' : 'bg-[#141414] border-[#333] text-gray-400'
                        }`}
                        title="Activar o desactivar sentido de veta para madera"
                      >
                        <span>VETA:</span>
                        <span className={`px-1 py-0.2 rounded font-mono ${selectedPiece.veta ? 'bg-[#f0a144] text-black font-black' : 'bg-[#222]'}`}>
                          {selectedPiece.veta ? 'SÍ' : 'NO'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetOrientation('longitudinal')}
                        className={`py-1.5 px-2 rounded-lg text-[8px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          !isTransversal ? 'bg-[#f0a144] text-black font-black shadow-xs' : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#333]'
                        }`}
                        title="Veta longitudinal (0° - Corre a lo largo de la pieza, corte estándar)"
                      >
                        <span>═</span>
                        <span>0° Long</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetOrientation('transversal')}
                        className={`py-1.5 px-2 rounded-lg text-[8px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isTransversal ? 'bg-amber-500 text-black font-black shadow-xs' : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#333]'
                        }`}
                        title="Veta transversal (90° - Corre a lo ancho. Separa esta pieza de las demás en el plano de corte 2D)"
                      >
                        <span>║</span>
                        <span>90° Trans</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRotateVetaAndTexture}
                        className="py-1.5 px-2 rounded-lg bg-[#222] hover:bg-[#333] border border-[#444] text-[#f0a144] text-[8px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Girar veta 90° continuo (0°, 90°, 180°, 270°)"
                      >
                        <RotateCw className="w-2.5 h-2.5" />
                        <span>{currentVetaRot}°</span>
                      </button>
                    </div>

                    {/* Fila 2: Indicador de impacto en plano de corte 2D */}
                    <div className={`px-2 py-1 rounded-lg border text-[7.5px] font-mono flex items-center justify-between transition-colors ${
                      !selectedPiece.veta
                        ? 'bg-white/5 border-white/10 text-gray-400'
                        : isTransversal
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    }`}>
                      <span className="font-bold flex items-center gap-1">
                        {!selectedPiece.veta ? (
                          <><span>⚪ Sin veta:</span> <span className="font-normal text-gray-300">Rotación libre en plancha</span></>
                        ) : isTransversal ? (
                          <><Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" /> <span>Veta transversal 90°:</span> <span className="font-normal text-amber-200/90">Pieza separada en plano 2D</span></>
                        ) : (
                          <><Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" /> <span>Veta 0° estándar:</span> <span className="font-normal text-emerald-200/90">Alineada al largo</span></>
                        )}
                      </span>
                      <span className="text-[7px] text-gray-400 uppercase font-bold">
                        {isTransversal ? 'Corte Ancho×Largo' : 'Corte Largo×Ancho'}
                      </span>
                    </div>

                    {/* Fila 3: Mapeo UV y Textura 3D interactivo */}
                    <div className="flex flex-col gap-1 pt-1 border-t border-white/5">
                      <div className="flex items-center justify-between text-[7.5px] text-gray-400 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1">
                          <Sliders className="w-2.5 h-2.5 text-[#f0a144]" />
                          <span>Escala & Repetición UV:</span>
                        </span>
                        <span className="font-mono text-[#f0a144] font-bold">
                          {currentUvScale.toFixed(2)}x
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        {/* Stepper fino - / + */}
                        <div className="flex items-center bg-[#141414] rounded-lg border border-[#333] p-0.5">
                          <button
                            type="button"
                            onClick={() => handleSetUvScale(Math.max(0.25, currentUvScale - 0.25))}
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                            title="Reducir escala UV (-0.25x)"
                          >
                            −
                          </button>
                          <span className="px-1.5 text-[7.5px] font-mono font-bold text-white">
                            {currentUvScale.toFixed(2)}x
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSetUvScale(Math.min(5.0, currentUvScale + 0.25))}
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                            title="Aumentar escala UV (+0.25x)"
                          >
                            +
                          </button>
                        </div>

                        {/* Presets rápidos */}
                        <div className="flex items-center gap-0.5 bg-[#141414] px-1 py-0.5 rounded-lg border border-[#333]">
                          {[0.5, 1, 1.5, 2].map(s => {
                            const isCur = Math.abs(currentUvScale - s) < 0.05;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => handleSetUvScale(s)}
                                className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono transition-all cursor-pointer ${
                                  isCur ? 'bg-[#f0a144] text-black font-bold shadow-xs' : 'text-gray-300 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {s}x
                              </button>
                            );
                          })}
                        </div>

                        {/* Botón Variar veta (Offset aleatorio) */}
                        <button
                          type="button"
                          onClick={handleRandomizeVetaOffset}
                          className="py-1 px-1.5 rounded-lg bg-[#202020] hover:bg-[#2a2a2a] border border-[#3a3a3a] text-amber-300 hover:text-white text-[7.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                          title="Desplazar dibujo de la veta (offset) para evitar nudos clonados en piezas repetidas"
                        >
                          <Shuffle className="w-2.5 h-2.5 text-amber-400" />
                          <span>Variar</span>
                        </button>

                        {/* Botón Reset */}
                        <button
                          type="button"
                          onClick={handleResetUvConfigs}
                          className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer text-[7.5px]"
                          title="Restablecer textura a escala estándar 1x y rotación 0°"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Fila 4: Mecanizado de Ranura y Grosor de Fondo */}
                    <div className="pt-1 border-t border-white/5">
                      <RanuraConfigCard 
                        piece={selectedPiece} 
                        onUpdate={(patch) => onUpdatePiece(selectedPiece.id, patch)} 
                        compact={true} 
                      />
                    </div>
                  </div>
                )}

                {/* 5. Acciones: Entrada/Salida a grupos + Duplicar + Distribuir */}
                {activeOptionTab === 'acciones' && (() => {
                  let clearanceInfo: {
                    name1: string;
                    name2: string;
                    luzLibre: number;
                    espacioPorHueco: number;
                    huecos: number;
                  } | null = null;

                  if (selectedPieceIds.length >= 2) {
                    const p1 = pieces.find(p => p.id === selectedPieceIds[0]);
                    const p2 = pieces.find(p => p.id === selectedPieceIds[1]);
                    if (p1 && p2) {
                      const dy = Math.abs(p2.position3D[1] - p1.position3D[1]);
                      const dx = Math.abs(p2.position3D[0] - p1.position3D[0]);
                      const dz = Math.abs(p2.position3D[2] - p1.position3D[2]);
                      const isVertical = dy >= dx && dy >= dz;
                      const distCenter = isVertical ? dy : (dx >= dz ? dx : dz);
                      const t1 = isVertical ? p1.espesor : (dx >= dz ? p1.largo : p1.ancho);
                      const t2 = isVertical ? p2.espesor : (dx >= dz ? p2.largo : p2.ancho);
                      const shelfThick = isVertical ? p1.espesor : (dx >= dz ? p1.largo : p1.ancho);
                      const luzLibre = Math.max(0, Math.round(distCenter - (t1 / 2) - (t2 / 2)));
                      const huecos = (arrayCount || 3) + 1;
                      const espacioPorHueco = Math.max(0, Math.round((luzLibre - ((arrayCount || 3) * shelfThick)) / huecos));
                      clearanceInfo = {
                        name1: p1.name || 'Pieza 1',
                        name2: p2.name || 'Pieza 2',
                        luzLibre,
                        espacioPorHueco,
                        huecos
                      };
                    }
                  }

                  return (
                    <div className="flex flex-col gap-1.5 w-full text-white">
                      {/* Control contextual de GRUPO si la pieza pertenece a un grupo */}
                      {selectedPiece.groupId && (() => {
                        const grp = groups?.find(g => g.id === selectedPiece.groupId);
                        const grpName = grp?.name || 'Grupo';
                        return (
                          <div className="flex items-center justify-between gap-1.5 bg-cyan-950/40 border border-cyan-500/30 rounded-lg p-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Group className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <div className="flex flex-col min-w-0 leading-tight">
                                <span className="text-[8px] text-cyan-300 font-bold truncate max-w-[140px]">{grpName}</span>
                                <span className="text-[7px] text-cyan-400/70 font-mono">
                                  {editingGroupId ? 'Editando piezas dentro' : 'Grupo completo'}
                                </span>
                              </div>
                            </div>
                            {!editingGroupId ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onEnterGroup?.(selectedPiece.groupId!)}
                                  className="py-1 px-2.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[8px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm"
                                  title="Entrar al grupo para editar piezas individuales"
                                >
                                  <FolderOpen className="w-3 h-3" />
                                  <span>Entrar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleDelete}
                                  className="p-1 px-1.5 rounded-md bg-red-500/20 hover:bg-red-500/35 text-red-300 border border-red-500/30 text-[8px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                  title="Eliminar todo el grupo de piezas de un solo clic"
                                >
                                  <Trash2 className="w-3 h-3 text-red-400" />
                                  <span className="hidden min-[360px]:inline">Borrar</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={onExitGroup}
                                className="py-1 px-2.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[8px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
                              >
                                <Check className="w-3 h-3" />
                                <span>Salir del grupo</span>
                              </button>
                            )}
                          </div>
                        );
                      })()}

                      {/* Botón directo para Agrupar las piezas seleccionadas y Borrar selección */}
                      {selectedPieceIds.length > 1 && !selectedPiece.groupId && (
                        <div className="flex items-center gap-1.5 w-full">
                          <button
                            type="button"
                            onClick={onGroupPieces}
                            className="flex-1 py-1.5 px-3 rounded-lg bg-[#f0a144] hover:bg-[#ffba66] text-black font-black text-[8.5px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow transition-all"
                            title="Agrupar piezas seleccionadas"
                          >
                            <Group className="w-3.5 h-3.5" />
                            <span>Agrupar ({selectedPieceIds.length})</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            className="py-1.5 px-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-[8.5px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-all"
                            title={`Eliminar las ${selectedPieceIds.length} piezas seleccionadas de un solo clic`}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Borrar ({selectedPieceIds.length})</span>
                          </button>
                        </div>
                      )}
                      {selectedPieceIds.length === 1 && !selectedPiece.groupId && (
                        <button
                          type="button"
                          onClick={onToggleMultiSelect}
                          className={`w-full py-1.5 px-3 rounded-lg border text-[8.5px] uppercase font-bold tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                            multiSelectMode
                              ? 'bg-amber-500/20 border-[#f0a144] text-[#f0a144]'
                              : 'bg-[#141414] hover:bg-[#202020] border-[#333] text-gray-300'
                          }`}
                          title="Activar selección múltiple para agrupar"
                        >
                          <Group className="w-3.5 h-3.5 text-[#f0a144]" />
                          <span>{multiSelectMode ? 'Modo grupo activo: Toca más piezas para unir' : 'Agrupar con otra pieza'}</span>
                        </button>
                      )}

                      {/* Fila Selector Minimalista de Modo */}
                      <div className="flex items-center justify-between gap-1 bg-[#101010] p-0.5 rounded-lg border border-white/5">
                        <div className="flex items-center gap-0.5 flex-1">
                          <button
                            type="button"
                            onClick={() => onChangeArrayMode?.('between')}
                            className={`flex-1 py-1 px-1.5 rounded-md text-[8px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              arrayMode === 'between'
                                ? 'bg-[#f0a144] text-black font-black shadow-sm'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <Rows3 className="w-2.5 h-2.5" />
                            <span>Entre 2</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onChangeArrayMode?.('offset')}
                            className={`flex-1 py-1 px-1.5 rounded-md text-[8px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              arrayMode === 'offset'
                                ? 'bg-[#3b82f6] text-white font-black shadow-sm'
                                : 'text-gray-400 hover:text-white'
                            }`}
                          >
                            <CopyPlus className="w-2.5 h-2.5" />
                            <span>En Serie</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-0.5 border-l border-white/10 pl-1 shrink-0">
                          <button
                            type="button"
                            onClick={handleDuplicate}
                            className="p-1 rounded text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer"
                            title={selectedPieceIds.length > 1 ? `Duplicar las ${selectedPieceIds.length} piezas seleccionadas` : "Duplicar pieza"}
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={handleDelete}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40 cursor-pointer"
                            title={selectedPieceIds.length > 1 ? `Eliminar las ${selectedPieceIds.length} piezas seleccionadas de un solo clic` : (selectedPiece.groupId && !editingGroupId ? "Eliminar grupo completo de un solo clic" : "Eliminar pieza")}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Controles para 'Entre 2 Piezas' */}
                      {arrayMode === 'between' && (
                        <div className="flex flex-col gap-1.5">
                          {selectedPieceIds.length < 2 ? (
                            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1 text-amber-300 text-[8px]">
                              <span className="font-bold flex items-center gap-1">
                                <span>⚠️ Selecciona 2 límites</span>
                              </span>
                              <span className="text-gray-400 text-[7px]">(Shift + clic en la 2ª)</span>
                            </div>
                          ) : clearanceInfo ? (
                            <div className="flex items-center justify-between bg-black/40 border border-white/5 rounded-lg px-2 py-0.5 text-[7.5px] font-mono">
                              <span className="text-gray-400">Luz: <strong className="text-[#f0a144]">{clearanceInfo.luzLibre}mm</strong></span>
                              <span className="text-emerald-400 font-bold">~{clearanceInfo.espacioPorHueco}mm / hueco</span>
                            </div>
                          ) : null}

                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1 bg-[#101010] px-1.5 py-0.5 rounded-lg border border-white/5">
                              <span className="text-[7.5px] text-gray-400 font-bold uppercase">Repisas:</span>
                              <button
                                type="button"
                                onClick={() => onChangeArrayCount?.(Math.max(1, (arrayCount || 3) - 1))}
                                className="w-5 h-5 rounded bg-[#222] hover:bg-[#333] text-white font-bold flex items-center justify-center text-[10px] cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono font-bold text-[#f0a144] text-[9.5px] w-3 text-center">{arrayCount || 3}</span>
                              <button
                                type="button"
                                onClick={() => onChangeArrayCount?.(Math.min(20, (arrayCount || 3) + 1))}
                                className="w-5 h-5 rounded bg-[#222] hover:bg-[#333] text-white font-bold flex items-center justify-center text-[10px] cursor-pointer"
                              >
                                +
                              </button>
                              <div className="h-3 w-px bg-white/10 mx-0.5" />
                              {[1, 2, 3, 4].map(n => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => onChangeArrayCount?.(n)}
                                  className={`w-3.5 h-3.5 rounded text-[7px] font-mono font-bold flex items-center justify-center cursor-pointer transition-all ${
                                    (arrayCount || 3) === n ? 'bg-[#f0a144] text-black font-black' : 'text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={onExecuteDistribution}
                              disabled={selectedPieceIds.length < 2}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-[#f0a144] hover:bg-[#ffba66] disabled:opacity-30 disabled:hover:bg-[#f0a144] text-black text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-md cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              <Rows3 className="w-3 h-3 text-black" />
                              <span>Distribuir</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Controles para 'En Serie' */}
                      {arrayMode === 'offset' && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-0.5 bg-[#101010] p-0.5 rounded-lg border border-white/5">
                              {(['X', 'Y', 'Z'] as const).map(axis => (
                                <button
                                  key={axis}
                                  type="button"
                                  onClick={() => onChangeArrayAxis?.(axis)}
                                  className={`w-4.5 h-4.5 rounded text-[7.5px] font-mono font-black flex items-center justify-center cursor-pointer transition-all ${
                                    arrayAxis === axis ? 'bg-[#3b82f6] text-white font-black' : 'text-gray-400 hover:text-white'
                                  }`}
                                >
                                  {axis}
                                </button>
                              ))}
                            </div>

                            <div className="flex items-center gap-1 bg-[#101010] px-1.5 py-0.5 rounded-lg border border-white/5">
                              <span className="text-[7.5px] text-gray-400 font-bold uppercase">Copias:</span>
                              <button
                                type="button"
                                onClick={() => onChangeArrayCount?.(Math.max(1, (arrayCount || 3) - 1))}
                                className="w-5 h-5 rounded bg-[#222] hover:bg-[#333] text-white font-bold flex items-center justify-center text-[10px] cursor-pointer"
                              >
                                -
                              </button>
                              <span className="font-mono font-bold text-[#3b82f6] text-[9.5px] w-3 text-center">{arrayCount || 3}</span>
                              <button
                                type="button"
                                onClick={() => onChangeArrayCount?.(Math.min(20, (arrayCount || 3) + 1))}
                                className="w-5 h-5 rounded bg-[#222] hover:bg-[#333] text-white font-bold flex items-center justify-center text-[10px] cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <div className="flex items-center gap-1 bg-[#101010] px-1.5 py-0.5 rounded-lg border border-white/5">
                              <span className="text-[7.5px] text-gray-400 font-bold uppercase">Dist:</span>
                              <input
                                type="number"
                                value={arrayDistanceMm ?? 250}
                                onChange={(e) => onChangeArrayDistanceMm?.(Number(e.target.value) || 0)}
                                className="w-9 bg-transparent text-[8px] font-mono font-bold text-white text-right outline-none"
                              />
                              <span className="text-[7px] text-gray-400 font-mono">mm</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={onExecuteDistribution}
                            className="w-full py-1.5 px-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-[0.98] shadow-md cursor-pointer"
                          >
                            <CopyPlus className="w-3 h-3 text-white" />
                            <span>Multiplicar en Serie</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Dock Pill con Pestañas de Opciones Segmentadas: 100% Adaptada a Móvil */}
          {selectedPiece && (() => {
            const hasAnyCantos = selectedPiece.cantos && (
              selectedPiece.cantos.largo1 !== 'Ninguno' ||
              selectedPiece.cantos.largo2 !== 'Ninguno' ||
              selectedPiece.cantos.ancho1 !== 'Ninguno' ||
              selectedPiece.cantos.ancho2 !== 'Ninguno'
            );

            return (
              <div className="flex items-center justify-between bg-[#141414]/95 backdrop-blur-md rounded-full p-1 border border-[#2a2a2a] shadow-2xl w-full max-w-[420px] sm:max-w-md gap-0.5 sm:gap-1">
                <button
                  type="button"
                  onClick={() => setActiveOptionTab(activeOptionTab === 'medidas' ? null : 'medidas')}
                  className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-1.5 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8px] sm:text-[8.5px] font-bold uppercase transition-all shrink cursor-pointer ${
                    activeOptionTab === 'medidas' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title="Medidas de la pieza (Largo, Espesor, Ancho)"
                >
                  <Ruler className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                  <span className="truncate">Medidas</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (onOpenTextureEditor) {
                      onOpenTextureEditor();
                    } else {
                      setActiveOptionTab(activeOptionTab === 'material' ? null : 'material');
                    }
                  }}
                  className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-1.5 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8px] sm:text-[8.5px] font-bold uppercase transition-all shrink cursor-pointer ${
                    isTextureModalOpen || activeOptionTab === 'material' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title="Material y texturas"
                >
                  <Palette className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                  <span className="truncate">Material</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOptionTab(activeOptionTab === 'cantos' ? null : 'cantos')}
                  className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-1.5 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8px] sm:text-[8.5px] font-bold uppercase transition-all shrink cursor-pointer ${
                    activeOptionTab === 'cantos' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title="Tapacantos (L1, L2, A1, A2)"
                >
                  <Layers className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                  <span className="truncate">Cantos</span>
                  {hasAnyCantos && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeOptionTab === 'cantos' ? 'bg-black' : 'bg-cyan-400'}`} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOptionTab(activeOptionTab === 'ranura' ? null : 'ranura')}
                  className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-1.5 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8px] sm:text-[8.5px] font-bold uppercase transition-all shrink cursor-pointer ${
                    activeOptionTab === 'ranura' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title="Mecanizado de ranura y grosor de fondo/respaldo (3mm, 4mm, 5.5mm, 6mm...)"
                >
                  <Scissors className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                  <span className="truncate">Ranura</span>
                  {selectedPiece.ranurado && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeOptionTab === 'ranura' ? 'bg-black' : 'bg-amber-400 animate-pulse'}`} />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOptionTab(activeOptionTab === 'veta' ? null : 'veta')}
                  className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-1.5 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8px] sm:text-[8.5px] font-bold uppercase transition-all shrink cursor-pointer ${
                    activeOptionTab === 'veta' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title="Dirección de veta y mapeo de textura (UV)"
                >
                  <Sliders className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                  <span className="truncate">Veta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOptionTab(activeOptionTab === 'acciones' ? null : 'acciones')}
                  className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-1.5 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8px] sm:text-[8.5px] font-bold uppercase transition-all shrink cursor-pointer ${
                    activeOptionTab === 'acciones' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                  title="Acciones (Duplicar, Distribuir, Eliminar)"
                >
                  <Zap className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                  <span className="truncate">Acciones</span>
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Barra Derecha: Barra de Rotación/Acciones (Arriba y siempre activa) y Barra 3D (Debajo) */}
      <div className="absolute top-2 sm:top-3.5 right-2 sm:right-3 flex flex-col items-center gap-1.5 pointer-events-auto z-20">
        {/* 1. Barra Permanente y Siempre Activa: Rotación 90° (X, Y, Z) + Acceso a Propiedades, Duplicar, Eliminar */}
        <div className="flex flex-col items-center bg-[#141414]/90 backdrop-blur-md rounded-2xl p-1 border border-[#2e2e2e] shadow-2xl">
          <span className="text-[7px] font-black text-[#888888] text-center mb-0.5 uppercase tracking-tighter">Rot 90°</span>
          <div className="flex flex-col gap-1">
            <RotationButton 
              label="X" 
              onClick={() => handleRotate90(0)} 
              color="text-[#da3c3c]"
            />
            <RotationButton 
              label="Y" 
              onClick={() => handleRotate90(1)} 
              color="text-[#3cda3c]"
            />
            <RotationButton 
              label="Z" 
              onClick={() => handleRotate90(2)} 
              color="text-[#3c3cda]"
            />
          </div>
          <div className="h-px w-6 bg-[#333333] my-1" />
          <ViewportIconButton 
            icon={<Settings className="w-3.5 h-3.5" />} 
            onClick={onOpenProperties} 
            active={true} 
            hoverText="Propiedades" 
          />
          <ViewportIconButton 
            icon={<Copy className="w-3.5 h-3.5" />} 
            onClick={handleDuplicate} 
            disabled={!hasSelection}
            hoverText={selectedPieceIds.length > 1 ? `Duplicar (${selectedPieceIds.length})` : "Duplicar"} 
          />
          <ViewportIconButton 
            icon={isSelectionHidden ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5" />} 
            onClick={handleToggleHide} 
            disabled={!hasSelection}
            hoverText={isSelectionHidden ? "Mostrar entidad(es)" : "Ocultar entidad(es)"} 
          />
          <ViewportIconButton 
            icon={<Trash2 className="w-3.5 h-3.5" />} 
            onClick={handleDelete} 
            danger 
            disabled={!hasSelection}
            hoverText={selectedPieceIds.length > 1 ? `Eliminar (${selectedPieceIds.length} seleccionadas)` : (selectedPiece?.groupId && !editingGroupId ? "Eliminar grupo" : "Eliminar")} 
          />
        </div>

        {/* 2. Barra 3D (Debajo de la barra de rotación): Mover, Rotar, Dimensionar, Textura */}
        {selectedPiece && (
          <div className="flex flex-col items-center bg-[#141414]/90 backdrop-blur-md rounded-2xl p-1 border border-[#2e2e2e] shadow-2xl animate-in fade-in slide-in-from-right-2 duration-150">
            <button
              type="button"
              onClick={() => setIs3DBarVisible(!is3DBarVisible)}
              className="w-full flex items-center justify-center gap-0.5 px-1 py-0.5 mb-0.5 rounded hover:bg-white/10 transition-colors text-gray-400 hover:text-white cursor-pointer"
              title={is3DBarVisible ? "Ocultar herramientas 3D" : "Mostrar herramientas 3D"}
            >
              <span className="text-[7px] font-black uppercase text-[#888888] tracking-wider">3D</span>
              {is3DBarVisible ? <ChevronUp className="w-2.5 h-2.5 text-gray-400" /> : <ChevronDown className="w-2.5 h-2.5 text-[#f0a144]" />}
            </button>
            {is3DBarVisible && (
              <div className="flex flex-col items-center">
                <RightToolButton
                  icon={<Move className="w-4 h-4" />}
                  active={transformMode === 'translate'}
                  onClick={() => onChangeTransformMode('translate')}
                  title="Mover pieza en el espacio 3D"
                  label="Mover"
                />
                <RightToolButton
                  icon={<RotateCcw className="w-4 h-4" />}
                  active={transformMode === 'rotate'}
                  onClick={() => onChangeTransformMode('rotate')}
                  title="Rotar libremente con gizmo esférico"
                  label="Rotar"
                />
                <RightToolButton
                  icon={<Expand className="w-4 h-4" />}
                  active={transformMode === 'scale'}
                  onClick={() => onChangeTransformMode('scale')}
                  title="Dimensionar medidas con gizmo"
                  label="Dimens."
                />
                <RightToolButton
                  icon={<Maximize2 className="w-4 h-4" />}
                  active={transformMode === 'stretch'}
                  onClick={() => onChangeTransformMode('stretch')}
                  title="Estirado Inteligente: estirar grupo sin deformar espesores [E]"
                  label="Estirar"
                />
                <RightToolButton
                  icon={<Focus className="w-4 h-4 text-amber-400" />}
                  active={false}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('focus-selected-piece'));
                  }}
                  title="Acercar y enfocar a detalle de la pieza [Tecla F o Doble clic]"
                  label="Enfocar"
                />
                <RightToolButton
                  icon={<Compass className="w-4 h-4 text-cyan-400" />}
                  active={false}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('reset-camera'));
                  }}
                  title="Centrar y reajustar todo el modelo en pantalla"
                  label="Centrar"
                />
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// Sub-components for UI consistency
function ViewportIconButton({ icon, onClick, active, disabled, danger, hoverText, badge }: any) {
  return (
    <button 
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={hoverText}
      className={`w-7 h-7 sm:w-8 sm:h-8 my-0.5 rounded-lg flex items-center justify-center relative transition-all active:scale-95 ${
        disabled 
          ? 'opacity-25 cursor-not-allowed pointer-events-none' 
          : danger 
            ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20 cursor-pointer' 
            : 'text-[#cccccc] hover:text-white hover:bg-white/10 cursor-pointer'
      } ${active ? 'bg-[#f0a144]/20 text-[#f0a144]' : ''}`}
    >
      {React.cloneElement(icon, { className: 'w-3.5 h-3.5 shrink-0' })}
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 bg-[#f0a144] text-black text-[6.5px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-md">
          {badge}
        </span>
      )}
    </button>
  );
}

function RightToolButton({ 
  icon, 
  active, 
  onClick, 
  title, 
  label 
}: { 
  icon: React.ReactNode; 
  active: boolean; 
  onClick: () => void; 
  title: string; 
  label: string; 
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-8 h-8 sm:w-8.5 sm:h-8.5 flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer my-0.5 ${
        active
          ? 'bg-[#f0a144] text-black shadow-lg shadow-[#f0a144]/25 font-black'
          : 'text-gray-300 hover:text-white hover:bg-white/10'
      }`}
    >
      <div className="flex items-center justify-center">
        {icon}
      </div>
      <span className={`text-[6.5px] sm:text-[7px] uppercase font-bold tracking-tight leading-none mt-0.5 ${active ? 'text-black font-black' : 'text-gray-400'}`}>
        {label}
      </span>
    </button>
  );
}

function RotationButton({ label, onClick, color, disabled }: { label: string, onClick?: () => void, color: string, disabled?: boolean }) {
  return (
    <button 
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-7.5 h-7.5 sm:w-8 sm:h-8 flex items-center justify-center bg-[#2b2b2b] ${
        disabled 
          ? 'opacity-25 cursor-not-allowed' 
          : 'hover:bg-[#3d3d3d] cursor-pointer active:scale-95'
      } rounded border border-[#1a1a1a] transition-all group`}
    >
      <span className={`text-[9.5px] font-black ${color} ${disabled ? '' : 'group-hover:scale-110'} transition-transform`}>{label}</span>
    </button>
  );
}

function GizmoButton({ icon, active, onClick, label, activeClass }: any) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-full flex items-center gap-1 sm:gap-1.5 transition-all ${
        active 
          ? (activeClass || 'bg-[#565656] text-white shadow-inner') 
          : 'text-[#888888] hover:text-[#cccccc]'
      }`}
    >
      {React.cloneElement(icon, { className: 'w-3 h-3 sm:w-3.5 sm:h-3.5' })}
      <span className="text-[7.5px] sm:text-[9.5px] font-bold uppercase tracking-wider whitespace-nowrap">{label}</span>
    </button>
  );
}


interface EntityCompactDimFieldProps {
  label: string;
  axis: string;
  axisColor: string;
  borderFocus: string;
  value: number;
  min: number;
  max?: number;
  onCommit: (val: number) => void;
}

function EntityCompactDimField({
  label,
  axis,
  axisColor,
  borderFocus,
  value,
  min,
  max = 5000,
  onCommit
}: EntityCompactDimFieldProps) {
  const [text, setText] = React.useState<string>(String(Math.round(value) || 0));
  const [isFocused, setIsFocused] = React.useState(false);
  const [justSaved, setJustSaved] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setText(String(Math.round(value) || 0));
    }
  }, [value, isFocused]);

  const parsedText = parseFloat(text.trim());
  const isModified = !isNaN(parsedText) && Math.round(parsedText) !== Math.round(value);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setText(String(Math.round(value) || min));
      return;
    }
    const parsed = parseFloat(trimmed);
    if (isNaN(parsed)) {
      setText(String(Math.round(value) || min));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(parsed)));
    setText(String(clamped));
    if (clamped !== Math.round(value)) {
      onCommit(clamped);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
    } else {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 800);
    }
  };

  return (
    <div
      className={`bg-[#0e0e0e] border ${
        justSaved
          ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
          : isModified
          ? 'border-[#f0a144] shadow-[0_0_10px_rgba(240,161,68,0.3)]'
          : 'border-[#282828] hover:border-[#444]'
      } rounded-xl p-1.5 flex flex-col gap-1 transition-all group select-none ${borderFocus}`}
    >
      {/* Cabecera del campo: Nombre de la medida + Distintivo de Eje */}
      <div className="flex items-center justify-between">
        <span className="text-[8px] sm:text-[8.5px] font-bold text-gray-200 uppercase tracking-tight group-hover:text-white transition-colors">
          {label}
        </span>
        <span className={`text-[7px] font-mono font-black px-1 py-0.2 rounded bg-black/60 border border-white/10 ${axisColor}`}>
          ({axis})
        </span>
      </div>

      {/* Controles: Input de medida + mm + Botón Check para confirmar */}
      <div className="flex items-center gap-1 w-full">
        <div className="flex-1 min-w-0 flex items-center bg-[#141414] focus-within:bg-[#1a1a1a] border border-[#2a2a2a] focus-within:border-[#f0a144] rounded px-1 py-0.5 transition-colors">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={text}
            onFocus={(e) => {
              setIsFocused(true);
              e.target.select();
            }}
            onBlur={(e) => {
              setIsFocused(false);
              commit(e.target.value);
            }}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                commit(text);
                (e.target as HTMLElement).blur();
              } else if (e.key === 'Escape') {
                setText(String(Math.round(value) || min));
                (e.target as HTMLElement).blur();
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const cur = parseFloat(text) || value;
                const delta = e.shiftKey ? 10 : 1;
                const nextVal = Math.max(min, Math.min(max, Math.round(cur + delta)));
                setText(String(nextVal));
                onCommit(nextVal);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const cur = parseFloat(text) || value;
                const delta = e.shiftKey ? 10 : 1;
                const nextVal = Math.max(min, Math.min(max, Math.round(cur - delta)));
                setText(String(nextVal));
                onCommit(nextVal);
              }
            }}
            className="w-full bg-transparent text-right text-[10.5px] font-mono font-black text-white outline-none select-text cursor-text"
          />
          <span className="text-[6.5px] text-gray-500 font-mono select-none ml-0.5">mm</span>
        </div>

        {/* Botón Check de confirmación de medida optimizado para móvil */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            commit(text);
            setIsFocused(false);
          }}
          className={`w-5.5 h-5.5 rounded flex items-center justify-center text-[10px] font-black cursor-pointer transition-all active:scale-90 shrink-0 shadow-xs ${
            justSaved
              ? 'bg-emerald-500 text-black shadow-emerald-500/40'
              : isModified
              ? 'bg-[#f0a144] hover:bg-[#ffba66] text-black shadow-[#f0a144]/40 animate-pulse'
              : 'bg-[#222] hover:bg-[#333] text-gray-400 hover:text-white'
          }`}
          title="Confirmar medida (Enter o clic)"
        >
          ✓
        </button>
      </div>
    </div>
  );
}

interface EntityDimensionFieldProps {
  label: string;
  axis: string;
  axisColorBorder: string;
  value: number;
  min: number;
  max?: number;
  onCommit: (val: number) => void;
  unit?: string;
}

function EntityDimensionField({
  label,
  axis,
  axisColorBorder,
  value,
  min,
  max = 5000,
  onCommit,
  unit = 'mm'
}: EntityDimensionFieldProps) {
  const [text, setText] = React.useState<string>(String(Math.round(value) || 0));
  const [isFocused, setIsFocused] = React.useState(false);

  // Sync external changes (e.g. 3D gizmo, selection) ONLY when user is not actively typing
  React.useEffect(() => {
    if (!isFocused) {
      setText(String(Math.round(value) || 0));
    }
  }, [value, isFocused]);

  const commitValue = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setText(String(Math.round(value) || min));
      return;
    }
    const parsed = parseFloat(trimmed);
    if (isNaN(parsed)) {
      setText(String(Math.round(value) || min));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(parsed)));
    setText(String(clamped));
    if (clamped !== Math.round(value)) {
      onCommit(clamped);
    }
  };

  return (
    <div className={`bg-[#0e0e0e] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 flex items-center justify-between transition-colors ${axisColorBorder}`}>
      <div className="flex flex-col select-none">
        <span className="text-[8.5px] font-bold text-gray-300 uppercase tracking-tight">{label}</span>
        <span className="text-[7px] text-gray-500 font-mono leading-none">({axis})</span>
      </div>
      <div className="flex items-baseline gap-1">
        <input 
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={text}
          onFocus={(e) => {
            setIsFocused(true);
            e.target.select();
          }}
          onBlur={(e) => {
            setIsFocused(false);
            commitValue(e.target.value);
          }}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              commitValue(text);
              (e.target as HTMLElement).blur();
            } else if (e.key === 'Escape') {
              setText(String(Math.round(value) || min));
              (e.target as HTMLElement).blur();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              const cur = parseFloat(text) || value;
              const delta = e.shiftKey ? 10 : 1;
              const nextVal = Math.max(min, Math.min(max, Math.round(cur + delta)));
              setText(String(nextVal));
              onCommit(nextVal);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              const cur = parseFloat(text) || value;
              const delta = e.shiftKey ? 10 : 1;
              const nextVal = Math.max(min, Math.min(max, Math.round(cur - delta)));
              setText(String(nextVal));
              onCommit(nextVal);
            }
          }}
          className="bg-transparent text-[13px] font-mono font-black text-white text-right outline-none w-16 select-text cursor-text"
        />
        <span className="text-[7.5px] text-gray-400 font-mono select-none">{unit}</span>
      </div>
    </div>
  );
}

interface EntityCantoFieldProps {
  label: string;
  sub: string;
  edgeKey: 'largo1' | 'largo2' | 'ancho1' | 'ancho2';
  value: EdgeConfig['largo1'];
  gruesoMm?: number;
  delgadoMm?: number;
  onCycle: (reverse?: boolean) => void;
}

function EntityCantoField({ label, sub, edgeKey, value, gruesoMm = 3, delgadoMm = 0.45, onCycle }: EntityCantoFieldProps) {
  const isDelgado = value === 'Canto Delgado';
  const isGrueso = value === 'Canto Grueso';

  const badgeText = isDelgado ? `DEL ${delgadoMm}` : isGrueso ? `GRU ${gruesoMm}` : 'NO';

  const borderClass = isDelgado 
    ? 'border-[#3b82f6] bg-[#0c192c] shadow-[0_0_8px_rgba(59,130,246,0.25)]' 
    : isGrueso 
    ? 'border-[#ef4444] bg-[#271010] shadow-[0_0_8px_rgba(239,68,68,0.25)]' 
    : 'border-[#2d2d2d] hover:border-[#444444] bg-[#121212]';

  const badgeColor = isDelgado 
    ? 'text-[#60a5fa] bg-blue-500/20 border-blue-400/40' 
    : isGrueso 
    ? 'text-[#f87171] bg-red-500/20 border-red-400/40' 
    : 'text-[#666666] bg-[#181818] border-[#2c2c2c]';

  const edgeLineColor = isDelgado ? '#38bdf8' : isGrueso ? '#ef4444' : '#555555';

  return (
    <button
      type="button"
      onClick={() => onCycle(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        onCycle(true);
      }}
      title={`${label} (${sub}): Toca para alternar (NO → DEL ${delgadoMm}mm → GRU ${gruesoMm}mm con descuento)`}
      className={`border rounded-lg p-1.5 flex flex-col items-center justify-between gap-0.5 transition-all cursor-pointer select-none text-center active:scale-95 w-full min-h-[50px] ${borderClass}`}
    >
      {/* Top: Mini Piece Schematic + Label */}
      <div className="flex items-center gap-1">
        <div className="w-3.5 h-2.5 rounded-[1.5px] border border-white/25 relative bg-black/50 shrink-0">
          {edgeKey === 'largo1' && (
            <div className="absolute top-0 left-0 right-0 h-[1.5px] rounded-t-[1px]" style={{ backgroundColor: edgeLineColor }} />
          )}
          {edgeKey === 'largo2' && (
            <div className="absolute bottom-0 left-0 right-0 h-[1.5px] rounded-b-[1px]" style={{ backgroundColor: edgeLineColor }} />
          )}
          {edgeKey === 'ancho1' && (
            <div className="absolute top-0 bottom-0 right-0 w-[1.5px] rounded-r-[1px]" style={{ backgroundColor: edgeLineColor }} />
          )}
          {edgeKey === 'ancho2' && (
            <div className="absolute top-0 bottom-0 left-0 w-[1.5px] rounded-l-[1px]" style={{ backgroundColor: edgeLineColor }} />
          )}
        </div>
        <span className="text-[9px] font-black text-white leading-none">{label}</span>
      </div>

      {/* Subtitle / Direction */}
      <span className="text-[6.5px] text-gray-400 uppercase font-mono leading-none tracking-tight">{sub}</span>

      {/* Value Pill Badge */}
      <span className={`text-[7px] font-mono font-black px-1 py-0.2 rounded border leading-tight ${badgeColor}`}>
        {badgeText}
      </span>
    </button>
  );
}

interface EntityProcessFieldProps {
  label: string;
  sub: string;
  active: boolean;
  onToggle: () => void;
}

function EntityProcessField({ label, sub, active, onToggle }: EntityProcessFieldProps) {
  const borderClass = active 
    ? 'border-[#f0a144]/70 border-b-2 border-b-[#f0a144] shadow-[0_1px_6px_rgba(240,161,68,0.15)]' 
    : 'border-[#2e2e2e] hover:border-[#444444]';

  const badgeColor = active 
    ? 'text-[#f0a144] bg-[#f0a144]/15 border-[#f0a144]/40' 
    : 'text-[#666666] bg-[#141414] border-[#252525]';

  return (
    <button
      type="button"
      onClick={onToggle}
      title={`${label}: Clic para alternar (SÍ / NO)`}
      className={`bg-[#0e0e0e] border rounded-lg px-2.5 py-1.5 flex items-center justify-between transition-all cursor-pointer select-none group text-left active:scale-[0.98] ${borderClass}`}
    >
      <div className="flex flex-col">
        <span className="text-[8.5px] font-bold text-gray-200 uppercase tracking-tight group-hover:text-white transition-colors">{label}</span>
        <span className="text-[6.5px] text-gray-500 font-mono leading-none">{sub}</span>
      </div>
      <div className="flex items-center">
        <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors ${badgeColor}`}>
          {active ? 'SÍ' : 'NO'}
        </span>
      </div>
    </button>
  );
}



