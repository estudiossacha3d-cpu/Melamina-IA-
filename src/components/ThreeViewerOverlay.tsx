import React from 'react';
import { 
  Undo2, Redo2, Magnet, Copy, Trash2, 
  Move, RotateCcw, RotateCw, Expand, Settings,
  Group, Ungroup, ListPlus, Ruler, Maximize2,
  Info, X, ArrowUp, ArrowDown, ArrowRight, ArrowLeft,
  Rows3, Layers, CopyPlus, Pencil, Check, Palette,
  Image as ImageIcon, Sliders, Zap, ChevronDown, ChevronUp,
  Eye, EyeOff, FolderOpen
} from 'lucide-react';
import { Piece, EdgeConfig, EdgeThicknessConfig, PieceFaceKey, FaceTextureOptions, Group3D } from '../types';
import { calculatePieceCutDimensions, DEFAULT_EDGE_THICKNESS_CONFIG } from '../lib/edgeCalculations';
import { MATERIAL_MAP, getMaterialEmoji, getGroupedMaterials, getMaterialDefinition } from '../lib/materials';

interface ThreeViewerOverlayProps {
  pieces: Piece[];
  selectedPieceId: string | null;
  selectedPieceIds?: string[];
  groups?: Group3D[];
  editingGroupId?: string | null;
  onEnterGroup?: (groupId: string) => void;
  onExitGroup?: () => void;
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
  onToggleSnap: () => void;
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

// Helper para formatear ranurado de forma ultra-compacta (solo visible si tiene ranurado)
function getCompactRanuraInfo(piece: Piece) {
  if (!piece.ranurado) return null;
  const cfg = piece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8 };
  return {
    text: `${cfg.lado} (${cfg.dist}mm)`,
    tooltip: `Ranurado: Lado ${cfg.lado} a ${cfg.dist}mm (Esp: ${cfg.esp}mm, Prof: ${cfg.prof}mm)`
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
  onToggleSnap,
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
  onExitGroup
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

  const [liveScaleDims, setLiveScaleDims] = React.useState<{ largo: number; ancho: number; espesor: number } | null>(null);
  type OptionTab = 'medidas' | 'material' | 'cantos' | 'veta' | 'acciones' | null;
  const [activeOptionTab, setActiveOptionTab] = React.useState<OptionTab>(null);
  const [is3DBarVisible, setIs3DBarVisible] = React.useState(true);

  React.useEffect(() => {
    if (!selectedPiece) {
      setActiveOptionTab(null);
    }
  }, [selectedPiece?.id]);

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
    if (!activePiece) return;
    onDuplicatePiece(activePiece.id);
  };

  const handleDelete = () => {
    if (!activePiece) return;
    onDeletePiece(activePiece.id);
  };

  const handleToggleHide = () => {
    if (!activePiece) return;
    onUpdatePiece(activePiece.id, { hidden: !activePiece.hidden });
    if (!activePiece.hidden) {
      onSelectPiece(null);
    }
  };

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
      <div className="absolute top-2 left-4 flex items-center gap-1 pointer-events-auto">
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
          <ViewportIconButton icon={<Undo2 />} onClick={onUndo} disabled={!canUndo} hoverText="Deshacer" />
          <ViewportIconButton icon={<Redo2 />} onClick={onRedo} disabled={!canRedo} hoverText="Rehacer" />
        </div>
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
          <ViewportIconButton icon={<Magnet />} onClick={onToggleSnap} active={snapActive} hoverText="Magnetismo (Piezas y Suelo 0mm)" />
          <ViewportIconButton icon={<ListPlus />} onClick={onToggleMultiSelect} active={multiSelectMode} hoverText="Selección múltiple" />
        </div>
        
        {/* Group / Ungroup Buttons */}
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
          {selectedPieceIds.length > 1 && (
             <ViewportIconButton icon={<Group />} onClick={onGroupPieces} hoverText="Agrupar piezas seleccionadas" />
          )}
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

              {!currentGroup && isMultiPiece && (
                <span className="inline-flex items-center gap-1 text-[7.5px] font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.2 rounded-full border border-amber-700/60 shrink-0">
                  <ListPlus className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                  <span>{selectedPieces.length} pzs</span>
                </span>
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

              <div className="h-2.5 w-px bg-white/10 mx-0.5 shrink-0" />

              {/* Ocultar entidad */}
              <button
                type="button"
                onClick={handleToggleHide}
                className="p-0.5 text-gray-400 hover:text-amber-400 transition-colors rounded hover:bg-white/10 shrink-0 cursor-pointer"
                title={selectedPiece.hidden ? "Mostrar entidad" : "Ocultar entidad"}
              >
                {selectedPiece.hidden ? <Eye className="w-3 h-3 text-amber-400" /> : <EyeOff className="w-3 h-3" />}
              </button>

              {/* Deseleccionar */}
              <button
                type="button"
                onClick={() => onSelectPiece(null)}
                className="p-0.5 text-gray-400 hover:text-white transition-colors rounded hover:bg-white/10 shrink-0 cursor-pointer"
                title="Deseleccionar pieza"
              >
                <X className="w-3 h-3" />
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
            const currentCantos = selectedPiece.cantos || {
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

            const allBadgeText = allDelgado ? 'TODOS: DEL' : allGrueso ? 'TODOS: GRU' : allNone ? 'TODOS: NO' : 'CANTOS';
            const cutInfo = calculatePieceCutDimensions(selectedPiece, edgeThicknessConfig);

            const matInfo = getMaterialDefinition(selectedPiece.material);
            const matDisplayName = matInfo ? matInfo.name : (selectedPiece.material || 'Melamina');
            const actualColor = selectedPiece.customColor || matInfo?.color || '#ffffff';
            const texturedFacesCount = selectedPiece.faceTextures 
              ? Object.values(selectedPiece.faceTextures).filter(Boolean).length 
              : 0;
            const sampleTextureUrl = selectedPiece.faceTextures 
              ? (selectedPiece.faceTextures.top || Object.values(selectedPiece.faceTextures).find(Boolean))
              : null;
            const displayTexture = sampleTextureUrl;

            const currentVetaRot = selectedPiece.vetaRotation ?? (selectedPiece.vetaOrientacion === 'transversal' ? 90 : 0);
            const isTransversal = selectedPiece.vetaOrientacion === 'transversal' || currentVetaRot === 90 || currentVetaRot === 270;

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

            return (
              <div className="bg-[#181818]/95 backdrop-blur-md rounded-2xl border border-[#333333] shadow-2xl p-2 sm:p-2.5 flex flex-col gap-1.5 w-full max-w-[360px] max-h-[50vh] overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                {/* Header del panel activo */}
                <div className="flex items-center justify-between gap-4 pb-1 border-b border-white/5">
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-[#f0a144] flex items-center gap-1.5">
                    {activeOptionTab === 'medidas' && <><Ruler className="w-3 h-3 text-[#f0a144]" /> Medidas</>}
                    {activeOptionTab === 'material' && <><Palette className="w-3 h-3 text-[#f0a144]" /> Materiales & Texturas</>}
                    {activeOptionTab === 'cantos' && <><Layers className="w-3 h-3 text-[#f0a144]" /> Cantos (Tapacantos)</>}
                    {activeOptionTab === 'veta' && <><Sliders className="w-3 h-3 text-[#f0a144]" /> Veta y Ranura (Mec)</>}
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

                {/* 3. Cantos: Grid 2x2 en móvil para no cortarse jamás */}
                {activeOptionTab === 'cantos' && (
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 w-full">
                      <EntityCantoField
                        label="L1"
                        sub="Frente"
                        value={currentCantos.largo1}
                        gruesoMm={edgeThicknessConfig.grueso}
                        delgadoMm={edgeThicknessConfig.delgado}
                        onCycle={(rev) => handleCycleEdge('largo1', rev)}
                      />
                      <EntityCantoField
                        label="L2"
                        sub="Atrás"
                        value={currentCantos.largo2}
                        gruesoMm={edgeThicknessConfig.grueso}
                        delgadoMm={edgeThicknessConfig.delgado}
                        onCycle={(rev) => handleCycleEdge('largo2', rev)}
                      />
                      <EntityCantoField
                        label="A1"
                        sub="Der"
                        value={currentCantos.ancho1}
                        gruesoMm={edgeThicknessConfig.grueso}
                        delgadoMm={edgeThicknessConfig.delgado}
                        onCycle={(rev) => handleCycleEdge('ancho1', rev)}
                      />
                      <EntityCantoField
                        label="A2"
                        sub="Izq"
                        value={currentCantos.ancho2}
                        gruesoMm={edgeThicknessConfig.grueso}
                        delgadoMm={edgeThicknessConfig.delgado}
                        onCycle={(rev) => handleCycleEdge('ancho2', rev)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-white/5 text-[7.5px]">
                      <button
                        type="button"
                        onClick={handleCycleAll}
                        className="font-mono font-bold text-[#f0a144] hover:text-[#ffba66] bg-[#f0a144]/10 border border-[#f0a144]/30 px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95"
                      >
                        {allBadgeText}
                      </button>
                      <span className="font-mono text-gray-300 text-right">
                        Corte neto: <span className="text-[#f0a144] font-bold">{cutInfo.largoCorte} × {cutInfo.anchoCorte} mm</span>
                        {cutInfo.tieneDescuento && (
                          <span className="text-red-400 ml-1 font-bold">(-{(cutInfo.descuentoLargoTotal + cutInfo.descuentoAnchoTotal).toFixed(1)}mm)</span>
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. Veta y Mecanizados (Ranura): 2 filas compactas que caben en móvil */}
                {activeOptionTab === 'veta' && (
                  <div className="flex flex-col gap-1.5 w-full">
                    {/* Fila 1: Control de Veta y Giro */}
                    <div className="flex items-center gap-1 w-full justify-between">
                      <button
                        type="button"
                        onClick={handleToggleVeta}
                        className={`flex-1 py-1.5 px-2 rounded-lg border text-[8px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-all ${
                          selectedPiece.veta ? 'bg-[#f0a144]/20 border-[#f0a144] text-white' : 'bg-[#141414] border-[#333] text-gray-400'
                        }`}
                      >
                        <span>VETA:</span>
                        <span className={`px-1 py-0.2 rounded font-mono ${selectedPiece.veta ? 'bg-[#f0a144] text-black font-black' : 'bg-[#222]'}`}>
                          {selectedPiece.veta ? 'SÍ' : 'NO'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetOrientation('longitudinal')}
                        className={`py-1.5 px-2 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${
                          !isTransversal ? 'bg-[#f0a144] text-black font-black shadow-xs' : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#333]'
                        }`}
                        title="Veta longitudinal (0° - A lo largo)"
                      >
                        0° Long
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSetOrientation('transversal')}
                        className={`py-1.5 px-2 rounded-lg text-[8px] font-bold transition-all cursor-pointer ${
                          isTransversal ? 'bg-[#f0a144] text-black font-black shadow-xs' : 'bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#333]'
                        }`}
                        title="Veta transversal (90° - A lo ancho)"
                      >
                        90° Trans
                      </button>

                      <button
                        type="button"
                        onClick={handleRotateVetaAndTexture}
                        className="py-1.5 px-2 rounded-lg bg-[#222] hover:bg-[#333] border border-[#444] text-[#f0a144] text-[8px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Girar veta 90° (0°, 90°, 180°, 270°)"
                      >
                        <RotateCw className="w-2.5 h-2.5" />
                        <span>{currentVetaRot}°</span>
                      </button>
                    </div>

                    {/* Fila 2: Ranura y Escala UV */}
                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          const nextRanura = !selectedPiece.ranurado;
                          onUpdatePiece(selectedPiece.id, { ranurado: nextRanura });
                        }}
                        className={`py-1 px-2 rounded-lg border text-[8px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                          selectedPiece.ranurado ? 'bg-amber-500/20 border-amber-500 text-white' : 'bg-[#141414] border-[#333] text-gray-400'
                        }`}
                        title="Activar/desactivar ranura para fondo de cajón o trasera"
                      >
                        <span>RANURA:</span>
                        <span className={`px-1 py-0.2 rounded font-mono ${selectedPiece.ranurado ? 'bg-amber-400 text-black font-black' : 'bg-[#222]'}`}>
                          {selectedPiece.ranurado ? 'SÍ' : 'NO'}
                        </span>
                      </button>

                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-0.5 bg-[#141414] px-1 py-0.5 rounded-lg border border-[#333]">
                          <span className="text-[7.5px] font-mono text-gray-400 font-bold mr-0.5">UV:</span>
                          {[1, 2].map(s => {
                            const cur = selectedPiece.faceTextureConfigs?.top?.repeatX ?? 1;
                            const isCur = cur === s;
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  const updated = { ...(selectedPiece.faceTextureConfigs || {}) };
                                  const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
                                  allFaces.forEach(f => {
                                    updated[f] = { repeatX: s, repeatY: s, rotation: updated[f]?.rotation || 0 };
                                  });
                                  if (isMultiPiece) {
                                    selectedPieces.forEach(p => onUpdatePiece(p.id, { faceTextureConfigs: updated }));
                                  } else {
                                    onUpdatePiece(selectedPiece.id, { faceTextureConfigs: updated });
                                  }
                                }}
                                className={`px-1.5 py-0.5 rounded text-[7.5px] font-mono transition-all cursor-pointer ${
                                  isCur ? 'bg-[#f0a144] text-black font-bold shadow-xs' : 'text-gray-300 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {s}x
                              </button>
                            );
                          })}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const defaultConfigs: Record<PieceFaceKey, FaceTextureOptions> = {
                              top: { repeatX: 1, repeatY: 1, rotation: 0 },
                              bottom: { repeatX: 1, repeatY: 1, rotation: 0 },
                              front: { repeatX: 1, repeatY: 1, rotation: 0 },
                              back: { repeatX: 1, repeatY: 1, rotation: 0 },
                              left: { repeatX: 1, repeatY: 1, rotation: 0 },
                              right: { repeatX: 1, repeatY: 1, rotation: 0 }
                            };
                            if (isMultiPiece) {
                              selectedPieces.forEach(p => onUpdatePiece(p.id, { faceTextureConfigs: defaultConfigs }));
                            } else {
                              onUpdatePiece(selectedPiece.id, { faceTextureConfigs: defaultConfigs });
                            }
                          }}
                          className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer text-[7.5px]"
                          title="Restablecer textura a escala estándar 1x"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                        </button>
                      </div>
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
                              <button
                                type="button"
                                onClick={() => onEnterGroup?.(selectedPiece.groupId!)}
                                className="py-1 px-2.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-black font-black text-[8px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
                              >
                                <FolderOpen className="w-3 h-3" />
                                <span>Entrar al grupo</span>
                              </button>
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
                            onClick={() => onDuplicatePiece(selectedPiece.id)}
                            className="p-1 rounded text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer"
                            title="Duplicar pieza"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeletePiece(selectedPiece.id)}
                            className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/40 cursor-pointer"
                            title="Eliminar pieza"
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
          {selectedPiece ? (
            <div className="flex items-center justify-between bg-[#141414]/95 backdrop-blur-md rounded-full p-1 border border-[#2a2a2a] shadow-2xl w-full max-w-[390px] sm:max-w-md gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={() => setActiveOptionTab(activeOptionTab === 'medidas' ? null : 'medidas')}
                className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-2 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8.5px] sm:text-[9px] font-bold uppercase transition-all shrink cursor-pointer ${
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
                className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-2 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8.5px] sm:text-[9px] font-bold uppercase transition-all shrink cursor-pointer ${
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
                className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-2 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8.5px] sm:text-[9px] font-bold uppercase transition-all shrink cursor-pointer ${
                  activeOptionTab === 'cantos' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title="Tapacantos (L1, L2, A1, A2)"
              >
                <Layers className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                <span className="truncate">Cantos</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveOptionTab(activeOptionTab === 'veta' ? null : 'veta')}
                className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-2 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8.5px] sm:text-[9px] font-bold uppercase transition-all shrink cursor-pointer ${
                  activeOptionTab === 'veta' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title="Veta y Mecanizados (Ranura)"
              >
                <Sliders className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                <span className="truncate">Veta/Mec</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveOptionTab(activeOptionTab === 'acciones' ? null : 'acciones')}
                className={`flex-1 min-w-0 py-1.5 px-0.5 sm:px-2 rounded-full flex items-center justify-center gap-0.5 sm:gap-1 text-[7px] min-[360px]:text-[7.5px] min-[400px]:text-[8.5px] sm:text-[9px] font-bold uppercase transition-all shrink cursor-pointer ${
                  activeOptionTab === 'acciones' ? 'bg-[#f0a144] text-black shadow-md font-black' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
                title="Acciones (Duplicar, Distribuir, Eliminar)"
              >
                <Zap className="w-2.5 h-2.5 min-[360px]:w-3 min-[360px]:h-3 shrink-0" />
                <span className="truncate">Acciones</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-[#141414]/90 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10 shadow-xl text-gray-400 text-[8px] sm:text-[9px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f0a144] animate-pulse" />
              <span>Toca una pieza para editar medidas, cantos y material</span>
            </div>
          )}
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
            hoverText="Duplicar" 
          />
          <ViewportIconButton 
            icon={activePiece?.hidden ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5" />} 
            onClick={handleToggleHide} 
            hoverText={activePiece?.hidden ? "Mostrar entidad" : "Ocultar entidad"} 
          />
          <ViewportIconButton 
            icon={<Trash2 className="w-3.5 h-3.5" />} 
            onClick={handleDelete} 
            danger 
            hoverText="Eliminar" 
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
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}

// Sub-components for UI consistency
function ViewportIconButton({ icon, onClick, active, disabled, danger, hoverText }: any) {
  return (
    <button 
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={hoverText}
      className={`p-1.5 rounded transition-colors ${
        disabled 
          ? 'opacity-25 cursor-not-allowed' 
          : 'hover:bg-[#4d4d4d] cursor-pointer'
      } ${active ? 'bg-[#f0a144]/20 text-[#f0a144]' : danger ? 'text-red-400' : 'text-[#cccccc]'}`}
    >
      {React.cloneElement(icon, { className: 'w-3.5 h-3.5' })}
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

  React.useEffect(() => {
    if (!isFocused) {
      setText(String(Math.round(value) || 0));
    }
  }, [value, isFocused]);

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
    }
  };

  return (
    <div className={`bg-[#0e0e0e] border border-[#2e2e2e] hover:border-[#444] rounded-lg px-2 py-1 flex items-center justify-between gap-1 transition-all group select-none ${borderFocus}`}>
      <div className="flex flex-col shrink-0 leading-tight">
        <span className="text-[8px] font-bold text-gray-200 uppercase tracking-tight group-hover:text-white transition-colors">{label}</span>
        <span className={`text-[6.5px] font-mono font-bold leading-none ${axisColor}`}>({axis})</span>
      </div>
      <div className="flex items-baseline gap-0.5 min-w-0">
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
          className="bg-[#141414] focus:bg-[#1a1a1a] border border-[#262626] focus:border-[#f0a144] rounded px-1 py-0.5 text-[10px] font-mono font-black text-white text-right outline-none w-10 xs:w-12 select-text cursor-text transition-all"
        />
        <span className="text-[6.5px] text-gray-500 font-mono select-none">mm</span>
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
  value: EdgeConfig['largo1'];
  gruesoMm?: number;
  delgadoMm?: number;
  onCycle: (reverse?: boolean) => void;
}

function EntityCantoField({ label, sub, value, gruesoMm = 3, delgadoMm = 0.45, onCycle }: EntityCantoFieldProps) {
  const isDelgado = value === 'Canto Delgado';
  const isGrueso = value === 'Canto Grueso';

  const badgeText = isDelgado ? `DEL ${delgadoMm}` : isGrueso ? `GRU ${gruesoMm}mm` : 'NO';

  const borderClass = isDelgado 
    ? 'border-[#3b82f6]/70 border-b-2 border-b-[#3b82f6] shadow-[0_1px_6px_rgba(59,130,246,0.15)]' 
    : isGrueso 
    ? 'border-[#ef4444]/70 border-b-2 border-b-[#ef4444] shadow-[0_1px_6px_rgba(239,68,68,0.15)]' 
    : 'border-[#2e2e2e] hover:border-[#444444]';

  const badgeColor = isDelgado 
    ? 'text-[#60a5fa] bg-blue-500/15 border-blue-500/40' 
    : isGrueso 
    ? 'text-[#f87171] bg-red-500/15 border-red-500/40' 
    : 'text-[#666666] bg-[#141414] border-[#252525]';

  return (
    <button
      type="button"
      onClick={() => onCycle(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        onCycle(true);
      }}
      title={`${label} (${sub}): Clic para alternar (NO → DEL ${delgadoMm}mm → GRU ${gruesoMm}mm con descuento para corte)`}
      className={`bg-[#0e0e0e] border rounded-lg px-2 py-1.5 flex items-center justify-between transition-all cursor-pointer select-none group text-left active:scale-[0.98] w-full ${borderClass}`}
    >
      <div className="flex flex-col">
        <span className="text-[8.5px] font-bold text-gray-200 uppercase tracking-tight group-hover:text-white transition-colors">{label}</span>
        <span className="text-[6.5px] text-gray-500 font-mono leading-none">{sub}</span>
      </div>
      <div className="flex items-center">
        <span className={`text-[7.5px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors ${badgeColor}`}>
          {badgeText}
        </span>
      </div>
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



