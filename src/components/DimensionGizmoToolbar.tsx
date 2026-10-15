import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Ruler, Check, X, Anchor, ArrowLeftRight } from 'lucide-react';
import { Piece } from '../types';

export interface DimensionGizmoToolbarProps {
  piece: Piece;
  selectedPiecesCount?: number;
  axis: 'largo' | 'ancho' | 'espesor';
  onChangeAxis: (axis: 'largo' | 'ancho' | 'espesor') => void;
  dimensionSide: 'pos' | 'neg';
  onChangeDimensionSide: (side: 'pos' | 'neg') => void;
  anchorMode: 'single' | 'center';
  onChangeAnchorMode: (mode: 'single' | 'center') => void;
  onApplyDimension: (val: number, isAbsolute: boolean) => void;
  onClose?: () => void;
}

export const DimensionGizmoToolbar: React.FC<DimensionGizmoToolbarProps> = ({
  piece,
  selectedPiecesCount = 1,
  axis,
  onChangeAxis,
  dimensionSide,
  onChangeDimensionSide,
  anchorMode,
  onChangeAnchorMode,
  onApplyDimension,
  onClose
}) => {
  const currentDimMm = axis === 'largo' ? piece.largo : axis === 'ancho' ? piece.ancho : piece.espesor;
  const [inputValue, setInputValue] = useState<string>(Math.round(currentDimMm).toString());
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input when dimension or axis changes, unless user is actively editing
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

  // Initialize position once mounted (centered near bottom, comfortably above bottom status bar)
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

  // Pointer drag events
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

    const width = toolbarRef.current?.offsetWidth || 280;
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
    const minVal = axis === 'espesor' ? 1 : 10;
    if (raw.startsWith('+') || raw.startsWith('-')) {
      const delta = parseFloat(raw);
      if (!isNaN(delta)) {
        onApplyDimension(delta, false);
      }
    } else {
      const target = parseFloat(raw);
      if (!isNaN(target)) {
        onApplyDimension(Math.max(minVal, target), true);
      }
    }
    inputRef.current?.blur();
  };

  const handleQuickStep = (step: number) => {
    onApplyDimension(step, false);
  };

  const axisColor = axis === 'largo' ? '#ef4444' : axis === 'espesor' ? '#10b981' : '#3b82f6';
  const axisLabel = axis === 'largo' ? 'Largo (X)' : axis === 'espesor' ? 'Espesor (Y)' : 'Ancho (Z)';

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
      className="bg-[#121212]/95 backdrop-blur-md text-white border border-[#f0a144]/70 rounded-xl shadow-[0_8px_25px_rgba(0,0,0,0.85)] select-none p-1.5 flex flex-col gap-1.5 transition-shadow hover:shadow-[#f0a144]/20 animate-in fade-in duration-100 cursor-grab active:cursor-grabbing w-fit max-w-[94vw]"
      title="Arrastra para mover la barra (Doble clic para centrar)"
    >
      {/* Fila 1: Manija + Selector Eje + Anclaje + Cerrar */}
      <div className="flex items-center justify-between gap-1.5 w-full">
        {/* Manija de arrastre */}
        <span
          className="text-gray-400 hover:text-[#f0a144] font-mono text-[12px] px-0.5 select-none shrink-0"
          title="Arrastrar barra"
        >
          ⠿
        </span>

        {/* Eje (Largo X, Espesor Y, Ancho Z) */}
        <div className="flex items-center bg-[#1c1c1c] p-0.5 rounded border border-gray-800 shrink-0">
          {([
            { key: 'largo', label: 'X', title: 'Largo (X)', col: 'bg-red-600' },
            { key: 'espesor', label: 'Y', title: 'Espesor (Y)', col: 'bg-emerald-600' },
            { key: 'ancho', label: 'Z', title: 'Ancho (Z)', col: 'bg-blue-600' }
          ] as const).map(({ key, label, title, col }) => {
            const isSelected = axis === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChangeAxis(key)}
                className={`px-1.5 h-5 rounded text-[9.5px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                  isSelected
                    ? `${col} text-white font-black shadow-xs`
                    : 'text-gray-400 hover:text-white'
                }`}
                title={title}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Separador */}
        <div className="w-[1px] h-3.5 bg-gray-700/80 shrink-0" />

        {/* Selector de Anclaje: Anclar (-), Centro, Anclar (+) */}
        <div className="flex items-center bg-[#1c1c1c] p-0.5 rounded border border-gray-800 shrink-0" title="Selecciona qué extremo queda fijo al cambiar la medida">
          {/* Anclar lado negativo: crece hacia + */}
          <button
            type="button"
            onClick={() => {
              onChangeAnchorMode('single');
              onChangeDimensionSide('pos');
            }}
            className={`px-1.5 h-5 rounded text-[8.5px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
              anchorMode === 'single' && dimensionSide === 'pos'
                ? 'bg-[#f0a144] text-black font-black'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Anclar Extremo (-) : El lado opuesto queda fijo, la pieza crece/encoge hacia adelante (+)"
          >
            <Anchor className="w-2.5 h-2.5" />
            <span>Fijo (-)</span>
          </button>

          {/* Crecimiento simétrico desde el centro */}
          <button
            type="button"
            onClick={() => onChangeAnchorMode('center')}
            className={`px-1.5 h-5 rounded text-[8.5px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
              anchorMode === 'center'
                ? 'bg-cyan-400 text-black font-black'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Crecimiento Simétrico : El centro de la pieza queda fijo y crece hacia ambos lados"
          >
            <ArrowLeftRight className="w-2.5 h-2.5" />
            <span>Centro</span>
          </button>

          {/* Anclar lado positivo: crece hacia - */}
          <button
            type="button"
            onClick={() => {
              onChangeAnchorMode('single');
              onChangeDimensionSide('neg');
            }}
            className={`px-1.5 h-5 rounded text-[8.5px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
              anchorMode === 'single' && dimensionSide === 'neg'
                ? 'bg-[#f0a144] text-black font-black'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Anclar Extremo (+) : El lado frontal queda fijo, la pieza crece/encoge hacia atrás (-)"
          >
            <Anchor className="w-2.5 h-2.5" />
            <span>Fijo (+)</span>
          </button>
        </div>

        {/* Botón Cerrar */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ml-0.5"
            title="Cerrar barra de dimensionar"
          >
            ✕
          </button>
        )}
      </div>

      {/* Fila 2: Input numérico con teclado intuitivo + Pasos rápidos + Aplicar */}
      <div className="flex items-center justify-between gap-1.5 bg-[#181818] px-2 py-1 rounded-lg border border-gray-800 w-full">
        <div className="flex items-center gap-1.5">
          <span className="text-[9.5px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1" style={{ color: axisColor }}>
            <Ruler className="w-3 h-3" />
            <span className="hidden sm:inline">{axisLabel}:</span>
            <span className="sm:hidden">{axis.slice(0, 1).toUpperCase()}:</span>
          </span>
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={inputValue}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  handleCommitInput();
                } else if (e.key === 'Escape') {
                  setInputValue(Math.round(currentDimMm).toString());
                  inputRef.current?.blur();
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const delta = e.shiftKey ? 10 : 1;
                  const cur = parseFloat(inputValue) || currentDimMm;
                  const nextVal = Math.round(cur + delta);
                  setInputValue(String(nextVal));
                  onApplyDimension(nextVal, true);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const delta = e.shiftKey ? 10 : 1;
                  const cur = parseFloat(inputValue) || currentDimMm;
                  const nextVal = Math.max(axis === 'espesor' ? 1 : 10, Math.round(cur - delta));
                  setInputValue(String(nextVal));
                  onApplyDimension(nextVal, true);
                }
              }}
              className="w-16 sm:w-20 h-6 bg-black border border-gray-700 focus:border-[#f0a144] text-white text-center font-mono font-bold text-xs rounded outline-none transition-colors select-text cursor-text"
              placeholder={Math.round(currentDimMm).toString()}
              title="Escribe la medida final (ej: 800) o variación (ej: +50, -20) y presiona Enter"
            />
            <span className="text-[9px] text-gray-400 font-mono font-bold select-none">mm</span>
          </div>
        </div>

        {/* Micro-botones de pasos rápidos */}
        <div className="hidden sm:flex items-center gap-0.5">
          {[-50, -10, 10, 50].map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => handleQuickStep(step)}
              className="px-1.5 py-0.5 bg-[#222222] hover:bg-[#333333] text-gray-300 hover:text-white rounded text-[8px] font-mono font-bold cursor-pointer transition-colors border border-gray-700/50"
              title={`${step > 0 ? `Aumentar +${step}` : `Reducir ${step}`} mm`}
            >
              {step > 0 ? `+${step}` : step}
            </button>
          ))}
        </div>

        {/* Botón Aplicar */}
        <button
          type="button"
          onClick={handleCommitInput}
          className="px-2 sm:px-2.5 h-6 bg-[#f0a144] hover:bg-[#ffba66] text-black font-black text-[9.5px] rounded flex items-center gap-1 cursor-pointer active:scale-95 transition-transform shrink-0 shadow"
          title="Aplicar medida (Enter)"
        >
          <Check className="w-3 h-3 text-black stroke-[3]" />
          <span>Aplicar</span>
        </button>
      </div>
    </div>
  );
};

export default DimensionGizmoToolbar;
