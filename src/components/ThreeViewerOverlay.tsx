import React from 'react';
import { 
  Undo2, Redo2, Magnet, Copy, Trash2, 
  Move, RotateCcw, Expand, Settings,
  Combine, Ungroup, ListPlus, Pointer, Play
} from 'lucide-react';
import { Piece } from '../types';

interface ThreeViewerOverlayProps {
  pieces: Piece[];
  selectedPieceId: string | null;
  selectedPieceIds?: string[];
  onSelectPiece: (id: string | null) => void;
  onAddPiece: () => void;
  onUpdatePiece: (id: string, updates: Partial<Piece>) => void;
  onDeletePiece: (id: string) => void;
  onDuplicatePiece: (id: string) => void;
  onGroupPieces?: () => void;
  onUngroupPieces?: () => void;
  snapActive: boolean;
  onToggleSnap: () => void;
  multiSelectMode: boolean;
  onToggleMultiSelect: () => void;
  transformMode: 'translate' | 'rotate' | 'scale';
  onChangeTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onOpenProperties: () => void;
  interactMode?: boolean;
  onToggleInteractMode?: () => void;
  onToggleAllDynamicPieces?: (open?: boolean) => void;
}

export default function ThreeViewerOverlay({
  selectedPieceId,
  selectedPieceIds = [],
  pieces,
  onUpdatePiece,
  onDeletePiece,
  onDuplicatePiece,
  onGroupPieces,
  onUngroupPieces,
  snapActive,
  onToggleSnap,
  multiSelectMode,
  onToggleMultiSelect,
  transformMode,
  onChangeTransformMode,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onOpenProperties,
  interactMode = false,
  onToggleInteractMode,
  onToggleAllDynamicPieces
}: ThreeViewerOverlayProps) {
  
  const selectedPiece = pieces.find(p => p.id === selectedPieceId);

  return (
    <div className="absolute inset-0 pointer-events-none z-10 select-none">
      
      {/* Top Floating Mini-Toolbar */}
      <div className="absolute top-2 left-4 flex items-center gap-1.5 pointer-events-auto">
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
          <ViewportIconButton icon={<Undo2 />} onClick={onUndo} disabled={!canUndo} />
          <ViewportIconButton icon={<Redo2 />} onClick={onRedo} disabled={!canRedo} />
        </div>
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
          <ViewportIconButton icon={<Magnet />} onClick={onToggleSnap} active={snapActive} />
          <ViewportIconButton icon={<ListPlus />} onClick={onToggleMultiSelect} active={multiSelectMode} hoverText="Selección múltiple" />
        </div>
        
        {/* Group / Ungroup Buttons */}
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a]">
          {selectedPieceIds.length > 1 && (
             <ViewportIconButton icon={<Combine />} onClick={onGroupPieces} hoverText="Agrupar items" />
          )}
          {selectedPieceIds.length > 0 && selectedPiece?.groupId && (
             <ViewportIconButton icon={<Ungroup />} onClick={onUngroupPieces} hoverText="Desagrupar" />
          )}
        </div>

        {/* Dynamic Component SketchUp Controls */}
        <div className="flex bg-[#1d1d1d]/80 rounded p-0.5 border border-[#1a1a1a] items-center gap-1">
          <ViewportIconButton 
            icon={<Pointer />} 
            onClick={onToggleInteractMode} 
            active={interactMode} 
            hoverText="Herramienta Interactuar (Modo SketchUp - Click para abrir/cerrar puertas y cajones)" 
          />
          {onToggleAllDynamicPieces && (
            <button
              type="button"
              onClick={() => onToggleAllDynamicPieces()}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-900/70 hover:bg-purple-800 text-purple-200 border border-purple-500/50 text-[9px] font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              title="Abrir o Cerrar todas las puertas y cajones del mueble"
            >
              <Play className="w-3 h-3 fill-purple-300 text-purple-300" />
              <span>Probar Mueble</span>
            </button>
          )}
        </div>
      </div>

      {/* Right Side: Quick Rotation Panel & Piece Info */}
      {selectedPiece && (
        <>
          {/* Top Info Overlay */}
          <div className="absolute top-16 left-4 flex flex-col gap-1 pointer-events-auto bg-[#1a1a1a]/70 backdrop-blur-md p-3 rounded-lg border border-[#444444]/50 shadow-[0_4px_30px_rgba(0,0,0,0.5)] max-w-[200px]">
            <span className="text-[10px] font-black text-[#f0a144] uppercase tracking-widest break-words mb-1">
              {selectedPiece.name || 'PIEZA'}
            </span>
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-mono font-bold text-white leading-none">
                {Math.round(selectedPiece.largo)}<span className="text-[10px] text-[#888]">x</span>{Math.round(selectedPiece.ancho)}<span className="text-[10px] text-[#888]">x</span>{Math.round(selectedPiece.espesor)}<span className="text-[9px] text-[#888]">mm</span>
              </span>
              <span className="text-[8px] font-bold text-gray-400 mt-1 uppercase tracking-wide flex items-center gap-1">
                🎨 Mat: {selectedPiece.material || 'Blanco'}
                {selectedPiece.customColor && (
                  <span className="w-2 h-2 rounded-full border border-white/20 inline-block shadow" style={{ backgroundColor: selectedPiece.customColor }} />
                )}
              </span>
            </div>
            
            <div className="w-full h-px bg-[#ffffff1a] my-1.5" />
            
            <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[9px] font-medium">
               {/* Cantos */}
               <div className="flex flex-col text-[#aaaaaa]">
                 <span>L1: <span className={selectedPiece.cantos.largo1 === 'Canto Grueso' ? 'text-red-400 font-bold' : selectedPiece.cantos.largo1 === 'Canto Delgado' ? 'text-blue-400 font-bold' : 'text-[#666]'}>{selectedPiece.cantos.largo1 === 'Ninguno' ? '--' : selectedPiece.cantos.largo1.slice(0,3).toUpperCase()}</span></span>
                 <span>L2: <span className={selectedPiece.cantos.largo2 === 'Canto Grueso' ? 'text-red-400 font-bold' : selectedPiece.cantos.largo2 === 'Canto Delgado' ? 'text-blue-400 font-bold' : 'text-[#666]'}>{selectedPiece.cantos.largo2 === 'Ninguno' ? '--' : selectedPiece.cantos.largo2.slice(0,3).toUpperCase()}</span></span>
               </div>
               <div className="flex flex-col text-[#aaaaaa]">
                 <span>A1: <span className={selectedPiece.cantos.ancho1 === 'Canto Grueso' ? 'text-red-400 font-bold' : selectedPiece.cantos.ancho1 === 'Canto Delgado' ? 'text-blue-400 font-bold' : 'text-[#666]'}>{selectedPiece.cantos.ancho1 === 'Ninguno' ? '--' : selectedPiece.cantos.ancho1.slice(0,3).toUpperCase()}</span></span>
                 <span>A2: <span className={selectedPiece.cantos.ancho2 === 'Canto Grueso' ? 'text-red-400 font-bold' : selectedPiece.cantos.ancho2 === 'Canto Delgado' ? 'text-blue-400 font-bold' : 'text-[#666]'}>{selectedPiece.cantos.ancho2 === 'Ninguno' ? '--' : selectedPiece.cantos.ancho2.slice(0,3).toUpperCase()}</span></span>
               </div>
               {/* Processes */}
               {selectedPiece.veta && <span className="text-emerald-400 col-span-2 mt-0.5">• Veta</span>}
               {selectedPiece.ranurado && (
                 <span className="text-emerald-400 col-span-2 font-mono text-[8px] leading-tight mt-0.5">
                   • Ranura: {selectedPiece.ranuraConfig?.lado || 'L2'} (d:{selectedPiece.ranuraConfig?.dist ?? 18} e:{selectedPiece.ranuraConfig?.esp ?? 4} p:{selectedPiece.ranuraConfig?.prof ?? 8})
                 </span>
               )}
               {selectedPiece.abisagrado && <span className="text-emerald-400 col-span-2">• Abisagrado</span>}
               {selectedPiece.dynamic && (
                 <span className="text-purple-400 col-span-2 font-bold text-[8.5px] mt-0.5 flex items-center gap-1 bg-purple-950/50 px-1 py-0.5 rounded border border-purple-500/30">
                   ⚡ Dinámico: {selectedPiece.dynamic.type === 'door' ? `Puerta (${selectedPiece.dynamic.doorType || 'batiente'})` : `Cajón (${selectedPiece.dynamic.slideAxis || 'Z'})`}
                 </span>
               )}
            </div>
          </div>

          <div className="absolute top-2 right-4 flex flex-col gap-1 pointer-events-auto bg-[#1d1d1d]/60 p-1 rounded border border-[#1a1a1a]">
          <span className="text-[8px] font-bold text-[#666666] text-center mb-1 uppercase tracking-tighter">Rotation 90°</span>
          <div className="flex flex-col gap-1">
            <RotationButton 
              label="X" 
              onClick={() => onUpdatePiece(selectedPiece.id, { rotation3D: [selectedPiece.rotation3D[0] + Math.PI/2, selectedPiece.rotation3D[1], selectedPiece.rotation3D[2]] })} 
              color="text-[#da3c3c]"
            />
            <RotationButton 
              label="Y" 
              onClick={() => onUpdatePiece(selectedPiece.id, { rotation3D: [selectedPiece.rotation3D[0], selectedPiece.rotation3D[1] + Math.PI/2, selectedPiece.rotation3D[2]] })} 
              color="text-[#3cda3c]"
            />
            <RotationButton 
              label="Z" 
              onClick={() => onUpdatePiece(selectedPiece.id, { rotation3D: [selectedPiece.rotation3D[0], selectedPiece.rotation3D[1], selectedPiece.rotation3D[2] + Math.PI/2] })} 
              color="text-[#3c3cda]"
            />
          </div>
          <div className="h-px bg-[#333333] my-1" />
          <ViewportIconButton icon={<Settings className="w-3.5 h-3.5" />} onClick={onOpenProperties} active />
          <ViewportIconButton icon={<Copy className="w-3.5 h-3.5" />} onClick={() => onDuplicatePiece(selectedPiece.id)} />
          <ViewportIconButton icon={<Trash2 className="w-3.5 h-3.5" />} onClick={() => onDeletePiece(selectedPiece.id)} danger />
        </div>
        </>
      )}

      {/* Bottom Center: Gizmo Selectors */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex bg-[#1d1d1d]/90 rounded-full p-1 border border-[#1a1a1a] pointer-events-auto shadow-2xl items-center gap-0.5">
        <GizmoButton icon={<Move />} active={!interactMode && transformMode === 'translate'} onClick={() => { if (interactMode && onToggleInteractMode) onToggleInteractMode(); onChangeTransformMode('translate'); }} label="Mover" />
        <GizmoButton icon={<RotateCcw />} active={!interactMode && transformMode === 'rotate'} onClick={() => { if (interactMode && onToggleInteractMode) onToggleInteractMode(); onChangeTransformMode('rotate'); }} label="Rotar" />
        <GizmoButton icon={<Expand />} active={!interactMode && transformMode === 'scale'} onClick={() => { if (interactMode && onToggleInteractMode) onToggleInteractMode(); onChangeTransformMode('scale'); }} label="Dimensionar" />
        <div className="w-px h-5 bg-[#333333] mx-1" />
        <GizmoButton icon={<Pointer />} active={interactMode} onClick={onToggleInteractMode} label="Interactuar 👆" color="text-purple-400" />
      </div>

    </div>
  );
}

// Sub-components for UI consistency
function ViewportIconButton({ icon, onClick, active, disabled, danger, hoverText }: any) {
  return (
    <button 
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hoverText}
      className={`p-1.5 rounded transition-colors ${disabled ? 'opacity-20' : 'hover:bg-[#4d4d4d]'} ${active ? 'bg-[#f0a144]/20 text-[#f0a144]' : danger ? 'text-red-400' : 'text-[#cccccc]'}`}
    >
      {React.cloneElement(icon, { className: 'w-3.5 h-3.5' })}
    </button>
  );
}

function RotationButton({ label, onClick, color }: { label: string, onClick: () => void, color: string }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={`w-8 h-8 flex items-center justify-center bg-[#2b2b2b] hover:bg-[#3d3d3d] rounded border border-[#1a1a1a] transition-all active:scale-95 group`}
    >
      <span className={`text-[10px] font-black ${color} group-hover:scale-110 transition-transform`}>{label}</span>
    </button>
  );
}

function GizmoButton({ icon, active, onClick, label, color }: any) {
  return (
    <button 
      type="button"
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${active ? 'bg-[#565656] text-white shadow-inner font-black' : 'text-[#888888] hover:text-[#cccccc]'}`}
    >
      {React.cloneElement(icon, { className: `w-4 h-4 ${color || ''}` })}
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
