import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FredoStretchAxis, FredoStretchMode } from '../lib/fredoStretch';

export interface SmartStretchToolbarProps {
  axis: FredoStretchAxis;
  onChangeAxis: (axis: FredoStretchAxis) => void;
  mode: FredoStretchMode;
  onChangeMode: (mode: FredoStretchMode) => void;
  currentDimMm: number;
  onApplyDimension: (dimensionMm: number, isAbsolute: boolean) => void;
  onQuickStep?: (deltaMm: number) => void;
  onClose?: () => void;
}

export const SmartStretchToolbar: React.FC<SmartStretchToolbarProps> = ({
  axis,
  onChangeAxis,
  mode,
  onChangeMode,
  currentDimMm,
  onApplyDimension,
  onClose
}) => {
  const [inputValue, setInputValue] = useState<string>(Math.round(currentDimMm).toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize input when currentDimMm changes (unless user actively editing with focus)
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setInputValue(Math.round(currentDimMm).toString());
    }
  }, [currentDimMm, axis]);

  // Position state: allows moving the bar anywhere on screen
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; posX: number; posY: number }>({
    pointerX: 0,
    pointerY: 0,
    posX: 0,
    posY: 0
  });

  // Initialize position once mounted (centered near bottom, comfortably above bottom tab bar)
  useEffect(() => {
    if (!position && toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      const initialX = Math.max(8, Math.round((window.innerWidth - rect.width) / 2));
      const initialY = Math.max(50, Math.round(window.innerHeight - rect.height - 85));
      setPosition({ x: initialX, y: initialY });
    }
  }, [position]);

  // Handle window resize so bar stays in viewport
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

  // Pointer drag events (supports touch and mouse seamlessly)
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'BUTTON') {
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

    const width = toolbarRef.current?.offsetWidth || 260;
    const height = toolbarRef.current?.offsetHeight || 65;
    const clampedX = Math.max(6, Math.min(window.innerWidth - width - 6, newX));
    const clampedY = Math.max(40, Math.min(window.innerHeight - height - 6, newY));

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
    const initialY = Math.max(50, Math.round(window.innerHeight - rect.height - 85));
    setPosition({ x: initialX, y: initialY });
  }, []);

  const handleCommitInput = () => {
    const raw = inputValue.trim();
    if (!raw) return;
    if (raw.startsWith('+') || raw.startsWith('-')) {
      const delta = parseFloat(raw);
      if (!isNaN(delta)) onApplyDimension(delta, false);
    } else {
      const target = parseFloat(raw);
      if (!isNaN(target) && target > 0) onApplyDimension(target, true);
    }
  };

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
        bottom: position ? 'auto' : '85px',
        transform: position ? 'none' : 'translateX(-50%)',
        zIndex: 50,
        touchAction: 'none'
      }}
      className="bg-[#121212]/95 backdrop-blur-md text-white border border-[#a3e635]/70 rounded-xl shadow-[0_8px_25px_rgba(0,0,0,0.85)] select-none p-1.5 flex flex-col gap-1.5 transition-shadow hover:shadow-[#a3e635]/20 animate-in fade-in duration-100 cursor-grab active:cursor-grabbing w-fit max-w-[94vw]"
      title="Arrastra para mover la barra (Doble clic para centrar)"
    >
      {/* Fila 1: Manija + Eje + Anclaje + Cerrar */}
      <div className="flex items-center justify-between gap-1.5 w-full">
        {/* Manija de arrastre */}
        <span
          className="text-gray-400 hover:text-[#a3e635] font-mono text-[12px] px-0.5 select-none shrink-0"
          title="Arrastrar barra"
        >
          ⠿
        </span>

        {/* Eje (X, Y, Z) */}
        <div className="flex items-center bg-[#1c1c1c] p-0.5 rounded border border-gray-800 shrink-0">
          {(['X', 'Y', 'Z'] as const).map(ax => {
            const isSelected = axis === ax;
            return (
              <button
                key={ax}
                type="button"
                onClick={() => onChangeAxis(ax)}
                className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[#a3e635] text-black font-black'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={`Eje ${ax}`}
              >
                {ax}
              </button>
            );
          })}
        </div>

        {/* Separador */}
        <div className="w-[1px] h-3.5 bg-gray-700/80 shrink-0" />

        {/* Anclaje (Base, Centro, Tope) */}
        <div className="flex items-center bg-[#1c1c1c] p-0.5 rounded border border-gray-800 shrink-0">
          <button
            type="button"
            onClick={() => onChangeMode('anchor-neg')}
            className={`px-1.5 h-5 rounded text-[9px] font-bold cursor-pointer transition-colors flex items-center gap-0.5 ${
              mode === 'anchor-neg'
                ? 'bg-[#a3e635] text-black font-black'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Anclar Base (estirar hacia adelante)"
          >
            <span>⚓</span>
            <span>Base</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('center')}
            className={`px-1.5 h-5 rounded text-[9px] font-bold cursor-pointer transition-colors flex items-center gap-0.5 ${
              mode === 'center'
                ? 'bg-cyan-400 text-black font-black'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Estirar desde el Centro"
          >
            <span>↔</span>
            <span>Centro</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('anchor-pos')}
            className={`px-1.5 h-5 rounded text-[9px] font-bold cursor-pointer transition-colors flex items-center gap-0.5 ${
              mode === 'anchor-pos'
                ? 'bg-[#a3e635] text-black font-black'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Anclar Tope (estirar hacia atrás)"
          >
            <span>⚓</span>
            <span>Tope</span>
          </button>
        </div>

        {/* Botón Cerrar */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-1"
            title="Cerrar modo estirar"
          >
            ✕
          </button>
        )}
      </div>

      {/* Fila 2 (Párrafo de medida debajo): Medida + Input + mm + Botón Aplicar */}
      <div className="flex items-center justify-between gap-1.5 bg-[#181818] px-2 py-1 rounded-lg border border-gray-800 w-full">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-300 font-bold uppercase tracking-wider shrink-0">
            Medida:
          </span>
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitInput();
              }}
              className="w-20 h-6 bg-black border border-gray-700 focus:border-[#a3e635] text-white text-center font-mono font-bold text-xs rounded outline-none transition-colors"
              placeholder={Math.round(currentDimMm).toString()}
              title="Medida en mm (presiona Enter o Aplicar)"
            />
            <span className="text-[10px] text-gray-400 font-semibold select-none">mm</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCommitInput}
          className="px-2.5 h-6 bg-[#a3e635] hover:bg-[#bef264] text-black font-black text-[10px] rounded flex items-center gap-1 cursor-pointer active:scale-95 transition-transform shrink-0 shadow"
          title="Aplicar medida (Enter)"
        >
          <span>✓</span>
          <span>Aplicar</span>
        </button>
      </div>
    </div>
  );
};
