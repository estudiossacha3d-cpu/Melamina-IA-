import React, { useState, useRef, useEffect, useCallback } from 'react';

export type DimensionAxis = 'largo' | 'espesor' | 'ancho';

export interface SmartDimensionToolbarProps {
  axis: DimensionAxis;
  onChangeAxis: (axis: DimensionAxis) => void;
  dimensionSide: 'pos' | 'neg';
  onChangeDimensionSide: (side: 'pos' | 'neg') => void;
  anchorMode: 'single' | 'center';
  onChangeAnchorMode: (mode: 'single' | 'center') => void;
  currentDimMm: number;
  liveDeltaMm?: number;
  isSnapped?: boolean;
  snapLabel?: string;
  pieceName?: string;
  isDraggingGizmo?: boolean;
  onApplyDimension: (dimensionMm: number, isAbsolute: boolean) => void;
  onClose?: () => void;
}

export const SmartDimensionToolbar: React.FC<SmartDimensionToolbarProps> = ({
  axis,
  onChangeAxis,
  dimensionSide,
  onChangeDimensionSide,
  anchorMode,
  onChangeAnchorMode,
  currentDimMm,
  liveDeltaMm,
  isSnapped,
  snapLabel,
  pieceName,
  isDraggingGizmo = false,
  onApplyDimension,
  onClose
}) => {
  const [inputValue, setInputValue] = useState<string>(Math.round(currentDimMm).toString());
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar valor numérico cuando cambie currentDimMm (a menos que el usuario esté editando con foco)
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      if (liveDeltaMm !== undefined && liveDeltaMm !== 0) {
        setInputValue(liveDeltaMm > 0 ? `+${liveDeltaMm}` : String(liveDeltaMm));
      } else {
        setInputValue(Math.round(currentDimMm).toString());
      }
    }
  }, [currentDimMm, liveDeltaMm, axis]);

  // Posición flotante arrastrable
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number }>({
    pointerX: 0,
    pointerY: 0,
    posX: 0,
    posY: 0
  });

  // Inicializar centrado y elevado sobre la barra de pestañas en móvil
  useEffect(() => {
    if (!position && toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      const initialX = Math.max(8, Math.round((window.innerWidth - rect.width) / 2));
      const initialY = Math.max(45, Math.round(window.innerHeight - rect.height - 125));
      setPosition({ x: initialX, y: initialY });
    }
  }, [position]);

  // Mantener dentro del viewport en cambios de pantalla
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        if (!prev || !toolbarRef.current) return prev;
        const rect = toolbarRef.current.getBoundingClientRect();
        const maxX = Math.max(0, window.innerWidth - rect.width);
        const maxY = Math.max(0, window.innerHeight - rect.height);
        return {
          x: Math.min(Math.max(0, prev.x), maxX),
          y: Math.min(Math.max(0, prev.y), maxY)
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Control táctil y mouse para arrastrar la barra
  const handlePointerDown = (e: React.PointerEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('button') || el.closest('input')) {
      return;
    }
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    isDraggingRef.current = true;
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      posX: position?.x ?? 0,
      posY: position?.y ?? 0
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;
    const newX = dragStartRef.current.posX + dx;
    const newY = dragStartRef.current.posY + dy;

    const width = toolbarRef.current?.offsetWidth || 220;
    const height = toolbarRef.current?.offsetHeight || 95;
    const clampedX = Math.max(6, Math.min(window.innerWidth - width - 6, newX));
    const clampedY = Math.max(40, Math.min(window.innerHeight - height - 45, newY));

    setPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      e.stopPropagation();
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  const resetPosition = useCallback(() => {
    if (!toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    const initialX = Math.max(8, Math.round((window.innerWidth - rect.width) / 2));
    const initialY = Math.max(45, Math.round(window.innerHeight - rect.height - 125));
    setPosition({ x: initialX, y: initialY });
  }, []);

  const handleCommitInput = () => {
    const raw = inputValue.trim();
    if (!raw) return;
    if (raw.startsWith('+') || raw.startsWith('-')) {
      const delta = parseFloat(raw);
      if (!isNaN(delta) && delta !== 0) {
        onApplyDimension(delta, false);
      }
    } else {
      const target = parseFloat(raw);
      if (!isNaN(target) && target > 0) {
        onApplyDimension(target, true);
      }
    }
  };

  // Modo actual de anclaje
  const currentMode = anchorMode === 'center' 
    ? 'center' 
    : (dimensionSide === 'neg' ? 'anchor-pos' : 'anchor-neg');

  const setAnchorModeType = (mode: 'anchor-neg' | 'center' | 'anchor-pos') => {
    if (mode === 'center') {
      onChangeAnchorMode('center');
    } else if (mode === 'anchor-neg') {
      onChangeAnchorMode('single');
      onChangeDimensionSide('pos');
    } else {
      onChangeAnchorMode('single');
      onChangeDimensionSide('neg');
    }
  };

  const axisDisplay = axis === 'largo' ? 'X (Largo)' : axis === 'espesor' ? 'Y (Espesor)' : 'Z (Ancho)';
  const axisLabel = axis === 'largo' ? 'Largo' : axis === 'espesor' ? 'Espesor' : 'Ancho';

  // =========================================================================
  // MODO ENCOGIDO / REDUCIDO (Auto al arrastrar el gizmo 3D o al minimizar)
  // =========================================================================
  if (isDraggingGizmo || isMinimized) {
    return (
      <div
        ref={toolbarRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={resetPosition}
        style={{
          position: 'fixed',
          left: position ? `${position.x}px` : '50%',
          top: position ? `${position.y}px` : 'auto',
          bottom: position ? 'auto' : '125px',
          transform: position ? 'none' : 'translateX(-50%)',
          zIndex: 50,
          touchAction: 'none'
        }}
        className={`bg-[#121212]/90 backdrop-blur-md text-white border ${
          isSnapped
            ? 'border-[#fbbf24] shadow-[0_0_12px_rgba(251,191,36,0.6)]'
            : 'border-[#f0a144]/80 shadow-[0_8px_20px_rgba(0,0,0,0.85)]'
        } rounded-full select-none px-2.5 py-1 flex items-center gap-2 max-w-[92vw] overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing animate-in fade-in duration-100 hover:border-[#f0a144]`}
        title={isDraggingGizmo ? "Arrastrando gizmo (Barra encogida)" : "Barra encogida (Toca ⤢ para expandir)"}
      >
        <span
          className="text-gray-400 hover:text-white font-mono text-xs select-none shrink-0 cursor-grab"
          title="Arrastrar"
        >
          ⠿
        </span>

        {/* Eje activo */}
        <span
          className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase shrink-0 ${
            axis === 'largo'
              ? 'bg-[#ef4444] text-white'
              : axis === 'espesor'
              ? 'bg-[#10b981] text-black'
              : 'bg-[#3b82f6] text-white'
          }`}
        >
          {axis === 'largo' ? 'X' : axis === 'espesor' ? 'Y' : 'Z'}
        </span>

        {/* Medida en tiempo real */}
        <div className="flex items-center gap-1 font-mono text-[10.5px] font-bold shrink-0">
          <span className="text-gray-300 text-[9px] uppercase font-bold">{axisLabel}:</span>
          <span className="text-[#f0a144] font-black">{Math.round(currentDimMm)} mm</span>
          {liveDeltaMm !== undefined && liveDeltaMm !== 0 && (
            <span className="text-white text-[9px] font-bold">
              ({liveDeltaMm > 0 ? `+${liveDeltaMm}` : liveDeltaMm} mm)
            </span>
          )}
          {isSnapped && (
            <span className="text-[9.5px] font-black text-[#fbbf24] bg-[#fbbf24]/20 border border-[#fbbf24]/50 px-1 py-0.2 rounded flex items-center gap-0.5 animate-pulse">
              <span>🧲</span>
              {snapLabel && <span className="max-w-[120px] truncate uppercase">{snapLabel}</span>}
            </span>
          )}
        </div>

        {/* Botón para expandir si no está arrastrando el gizmo */}
        {!isDraggingGizmo && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setIsMinimized(false)}
            className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 hover:text-white flex items-center justify-center text-[11px] font-bold transition-transform active:scale-90 cursor-pointer shrink-0"
            title="Expandir barra de controles completos"
          >
            ⤢
          </button>
        )}

        {/* Botón Cerrar */}
        {onClose && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="w-5 h-5 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-full flex items-center justify-center text-[10px] font-bold transition-transform active:scale-90 cursor-pointer shrink-0"
            title="Cerrar barra"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODO EXPANDIDO / COMPLETO
  // =========================================================================
  return (
    <div
      ref={toolbarRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDoubleClick={resetPosition}
      style={{
        position: 'fixed',
        left: position ? `${position.x}px` : '50%',
        top: position ? `${position.y}px` : 'auto',
        bottom: position ? 'auto' : '125px',
        transform: position ? 'none' : 'translateX(-50%)',
        zIndex: 50,
        touchAction: 'none'
      }}
      className={`bg-[#121212]/95 backdrop-blur-md text-white border ${
        isSnapped
          ? 'border-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.45)]'
          : 'border-[#f0a144]/80 shadow-[0_10px_25px_rgba(0,0,0,0.85)]'
      } rounded-2xl select-none p-2 flex flex-col gap-1.5 w-[220px] max-w-[92vw] overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing animate-in fade-in duration-100 hover:shadow-[#f0a144]/25`}
      title="Barra de Dimensionar (Arrastra para mover • Toca − para encojer)"
    >
      {/* Fila 1: Manija + Ejes X, Y, Z + Botones Minimizar y Cerrar */}
      <div className="flex items-center justify-between w-full">
        {/* Lado izquierdo: Manija + Ejes X, Y, Z */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-gray-400 hover:text-white font-mono text-[13px] px-0.5 select-none shrink-0 cursor-grab active:cursor-grabbing"
            title="Arrastrar barra (Doble clic para centrar)"
          >
            ⠿
          </span>
          <span className="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
            Eje:
          </span>
          <div className="flex items-center bg-[#1c1c1c] p-0.5 rounded-lg border border-gray-800 gap-0.5">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onChangeAxis('largo')}
              className={`w-5 h-5 rounded text-[9.5px] font-black flex items-center justify-center cursor-pointer transition-colors active:scale-95 ${
                axis === 'largo'
                  ? 'bg-[#ef4444] text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Largo - Eje X (Rojo)"
            >
              X
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onChangeAxis('espesor')}
              className={`w-5 h-5 rounded text-[9.5px] font-black flex items-center justify-center cursor-pointer transition-colors active:scale-95 ${
                axis === 'espesor'
                  ? 'bg-[#10b981] text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Espesor - Eje Y (Verde)"
            >
              Y
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onChangeAxis('ancho')}
              className={`w-5 h-5 rounded text-[9.5px] font-black flex items-center justify-center cursor-pointer transition-colors active:scale-95 ${
                axis === 'ancho'
                  ? 'bg-[#3b82f6] text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Ancho - Eje Z (Azul)"
            >
              Z
            </button>
          </div>
        </div>

        {/* Lado derecho: Botón Minimizar (-) y Botón Cerrar (✕) */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setIsMinimized(true)}
            className="w-5 h-5 text-gray-400 hover:text-amber-400 hover:bg-gray-800/80 active:scale-90 rounded-full flex items-center justify-center transition-all cursor-pointer text-xs font-black shrink-0"
            title="Encojer barra (minimizar)"
          >
            −
          </button>

          {onClose && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              className="w-5 h-5 text-gray-400 hover:text-red-400 hover:bg-gray-800/80 active:scale-90 rounded-full flex items-center justify-center transition-all cursor-pointer text-xs font-bold shrink-0"
              title="Cerrar modo dimensionar"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Fila 2: Anclas 100% integradas dentro de la barra en rejilla de 3 columnas */}
      <div className="grid grid-cols-3 bg-[#181818] p-0.5 rounded-lg border border-gray-800 gap-0.5 w-full">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setAnchorModeType('anchor-neg')}
          className={`h-6 rounded text-[9px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1 active:scale-95 ${
            currentMode === 'anchor-neg'
              ? 'bg-[#f0a144] text-black font-black shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Anclar Base (crecer hacia adelante / tope)"
        >
          <span>⚓</span>
          <span>Base</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setAnchorModeType('center')}
          className={`h-6 rounded text-[9px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1 active:scale-95 ${
            currentMode === 'center'
              ? 'bg-amber-400 text-black font-black shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Dimensionar simétrico desde el Centro"
        >
          <span>↔</span>
          <span>Centro</span>
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setAnchorModeType('anchor-pos')}
          className={`h-6 rounded text-[9px] font-bold cursor-pointer transition-all flex items-center justify-center gap-1 active:scale-95 ${
            currentMode === 'anchor-pos'
              ? 'bg-[#f0a144] text-black font-black shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          title="Anclar Tope (crecer hacia atrás / base)"
        >
          <span>⚓</span>
          <span>Tope</span>
        </button>
      </div>

      {/* Fila 3: Medida actual + Input + mm + Botón Aplicar OK */}
      <div className="flex items-center justify-between gap-1.5 bg-[#181818] px-2 py-1 rounded-lg border border-gray-800 w-full">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[9.5px] text-gray-300 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
            <span>{axisLabel}:</span>
            {isSnapped && (
              <span className="text-[10px] text-[#fbbf24] animate-pulse" title="Alineado magnéticamente">
                🧲
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitInput();
            }}
            className={`w-16 h-6 bg-black border ${
              isSnapped ? 'border-[#fbbf24] text-[#fbbf24]' : 'border-gray-700 text-white'
            } focus:border-[#f0a144] text-center font-mono font-black text-xs rounded outline-none transition-colors`}
            placeholder={Math.round(currentDimMm).toString()}
            title={`Escribe medida final o variación (+/-) en mm (${axisDisplay})`}
          />
          <span className="text-[9.5px] text-gray-400 font-bold select-none">mm</span>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleCommitInput}
            className="px-2 h-6 bg-[#f0a144] hover:bg-[#ffb055] text-black font-black text-[10px] rounded flex items-center gap-0.5 cursor-pointer active:scale-95 transition-transform shrink-0 shadow-md"
            title="Aplicar medida (Enter)"
          >
            <span>✓</span>
            <span className="text-[9px]">OK</span>
          </button>
        </div>
      </div>
    </div>
  );
};
