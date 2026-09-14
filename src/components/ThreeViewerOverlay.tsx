import React from 'react';
import {
  Undo2,
  Redo2,
  Magnet,
  Copy,
  Trash2,
  Move,
  RotateCcw,
  Expand,
  Settings,
  Combine,
  Ungroup,
  ListPlus,
  Plus,
  X,
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
}

export default function ThreeViewerOverlay({
  selectedPieceId,
  selectedPieceIds = [],
  pieces,
  onSelectPiece,
  onAddPiece,
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
}: ThreeViewerOverlayProps) {
  const selectedPiece = pieces.find(piece => piece.id === selectedPieceId);

  return (
    <div className="absolute inset-0 pointer-events-none z-20 select-none">
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2 pointer-events-none">
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto max-w-[calc(100%-88px)]">
          <button type="button" className="viewport-primary-action" onClick={onAddPiece} title="Crear una pieza nueva (N)">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva pieza</span>
          </button>

          <div className="viewport-tool-group">
            <ViewportIconButton icon={<Undo2 />} label="Deshacer" onClick={onUndo} disabled={!canUndo} />
            <ViewportIconButton icon={<Redo2 />} label="Rehacer" onClick={onRedo} disabled={!canRedo} />
          </div>

          <div className="viewport-tool-group">
            <ViewportIconButton icon={<Magnet />} label={snapActive ? 'Ajuste magnético activo' : 'Activar ajuste magnético'} onClick={onToggleSnap} active={snapActive} />
            <ViewportIconButton icon={<ListPlus />} label="Selección múltiple" onClick={onToggleMultiSelect} active={multiSelectMode} />
          </div>

          {(selectedPieceIds.length > 1 || selectedPiece?.groupId) && (
            <div className="viewport-tool-group">
              {selectedPieceIds.length > 1 && <ViewportIconButton icon={<Combine />} label="Agrupar piezas" onClick={onGroupPieces} />}
              {selectedPiece?.groupId && <ViewportIconButton icon={<Ungroup />} label="Desagrupar" onClick={onUngroupPieces} />}
            </div>
          )}


        </div>

        {selectedPiece && (
          <div className="viewport-tool-group pointer-events-auto shrink-0">
            <ViewportIconButton icon={<Settings />} label="Abrir propiedades" onClick={onOpenProperties} active />
            <ViewportIconButton icon={<Copy />} label="Duplicar pieza" onClick={() => onDuplicatePiece(selectedPiece.id)} />
            <ViewportIconButton icon={<Trash2 />} label="Eliminar pieza" onClick={() => onDeletePiece(selectedPiece.id)} danger />
          </div>
        )}
      </div>

      {selectedPiece && (
        <section className="viewport-selection-card hidden sm:flex pointer-events-auto" aria-label="Pieza seleccionada">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold text-[#f0a144] uppercase tracking-[0.12em]">Pieza seleccionada</div>
              <h2 className="text-sm font-bold text-white truncate mt-0.5">{selectedPiece.name || 'Sin nombre'}</h2>
            </div>
            <button type="button" className="p-1 text-[#87929f] hover:text-white rounded" onClick={() => onSelectPiece(null)} aria-label="Quitar selección">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="font-mono text-base font-extrabold text-white mt-2">
            {Math.round(selectedPiece.largo)} <span>×</span> {Math.round(selectedPiece.ancho)} <span>×</span> {Math.round(selectedPiece.espesor)} <small>mm</small>
          </div>
          <div className="text-xs text-[#9ba6b2] mt-1 truncate">{selectedPiece.material || 'Blanco'}{selectedPieceIds.length > 1 ? ` · ${selectedPieceIds.length} seleccionadas` : ''}</div>

          <div className="flex flex-wrap gap-1.5 mt-3">
            {selectedPiece.veta && <span className="viewport-chip">Veta fija</span>}
            {selectedPiece.ranurado && <span className="viewport-chip">Ranura</span>}
            {Object.values(selectedPiece.cantos).some(value => value !== 'Ninguno') && <span className="viewport-chip is-blue">Con cantos</span>}
          </div>

          <div className="border-t border-[#36404b] mt-3 pt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-[#8e99a6]">Girar 90°</span>
            <div className="flex gap-1">
              <RotationButton label="X" color="text-red-400" onClick={() => onUpdatePiece(selectedPiece.id, { rotation3D: [selectedPiece.rotation3D[0] + Math.PI / 2, selectedPiece.rotation3D[1], selectedPiece.rotation3D[2]] })} />
              <RotationButton label="Y" color="text-green-400" onClick={() => onUpdatePiece(selectedPiece.id, { rotation3D: [selectedPiece.rotation3D[0], selectedPiece.rotation3D[1] + Math.PI / 2, selectedPiece.rotation3D[2]] })} />
              <RotationButton label="Z" color="text-blue-400" onClick={() => onUpdatePiece(selectedPiece.id, { rotation3D: [selectedPiece.rotation3D[0], selectedPiece.rotation3D[1], selectedPiece.rotation3D[2] + Math.PI / 2] })} />
            </div>
          </div>
        </section>
      )}

      <div className="viewport-mode-switcher pointer-events-auto">
        <GizmoButton icon={<Move />} active={transformMode === 'translate'} onClick={() => onChangeTransformMode('translate')} label="Mover" />
        <GizmoButton icon={<RotateCcw />} active={transformMode === 'rotate'} onClick={() => onChangeTransformMode('rotate')} label="Girar" />
        <GizmoButton icon={<Expand />} active={transformMode === 'scale'} onClick={() => onChangeTransformMode('scale')} label="Medir" />
      </div>
    </div>
  );
}

function ViewportIconButton({ icon, label, onClick, active, disabled, danger }: { icon: React.ReactElement<{ className?: string }>; label: string; onClick?: () => void; active?: boolean; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`viewport-icon-button ${active ? 'is-active' : ''} ${danger ? 'is-danger' : ''}`}
    >
      {React.cloneElement(icon, { className: 'w-4 h-4' })}
    </button>
  );
}

function RotationButton({ label, onClick, color }: { label: string; onClick: () => void; color: string }) {
  return (
    <button type="button" onClick={onClick} className="rotation-axis-button" title={`Girar 90° en ${label}`}>
      <span className={color}>{label}</span>
    </button>
  );
}

function GizmoButton({ icon, active, onClick, label, color }: { icon: React.ReactElement<{ className?: string }>; active?: boolean; onClick?: () => void; label: string; color?: string }) {
  return (
    <button type="button" onClick={onClick} className={`viewport-mode-button ${active ? 'is-active' : ''}`} title={label}>
      {React.cloneElement(icon, { className: `w-4 h-4 ${color || ''}` })}
      <span className="hidden xs:inline">{label}</span>
    </button>
  );
}
