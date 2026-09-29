import React, { useState, useEffect, useRef } from 'react';
import { 
  Move, 
  ArrowRight, 
  CornerDownLeft, 
  SlidersHorizontal, 
  ArrowDownToLine, 
  Check,
  Compass,
  X
} from 'lucide-react';
import { Piece } from '../types';

export interface MoveDistanceBarProps {
  pieces: Piece[];
  selectedPieceIds: string[];
  activeDisplacement: {
    dx: number;
    dy: number;
    dz: number;
    dist: number;
    isDragging?: boolean;
    isFloorSnapped?: boolean;
    pieceId?: string;
    initialPos?: [number, number, number];
  } | null;
  onApplyOffset: (dx: number, dy: number, dz: number) => void;
  onSnapToFloor: () => void;
  onClose?: () => void;
}

export const MoveDistanceBar: React.FC<MoveDistanceBarProps> = ({
  pieces,
  selectedPieceIds,
  activeDisplacement,
  onApplyOffset,
  onSnapToFloor,
  onClose
}) => {
  const [distanceValue, setDistanceValue] = useState<string>('50');
  const [selectedAxis, setSelectedAxis] = useState<'X' | 'Y' | 'Z' | 'vector'>('X');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [showDetailedCoords, setShowDetailedCoords] = useState<boolean>(false);
  const [customDelta, setCustomDelta] = useState<{ dx: string; dy: string; dz: string }>({
    dx: '0',
    dy: '0',
    dz: '0'
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with real-time displacement from 3D drag
  useEffect(() => {
    if (!activeDisplacement) return;

    // While dragging or right after drag, populate the values
    if (activeDisplacement.dist > 0) {
      setDistanceValue(String(activeDisplacement.dist));
      
      // Auto-detect the dominant axis or use vector if diagonal
      const absX = Math.abs(activeDisplacement.dx);
      const absY = Math.abs(activeDisplacement.dy);
      const absZ = Math.abs(activeDisplacement.dz);

      if (absX >= absY && absX >= absZ && absY === 0 && absZ === 0) {
        setSelectedAxis('X');
        setDirection(activeDisplacement.dx >= 0 ? 1 : -1);
      } else if (absY >= absX && absY >= absZ && absX === 0 && absZ === 0) {
        setSelectedAxis('Y');
        setDirection(activeDisplacement.dy >= 0 ? 1 : -1);
      } else if (absZ >= absX && absZ >= absY && absX === 0 && absY === 0) {
        setSelectedAxis('Z');
        setDirection(activeDisplacement.dz >= 0 ? 1 : -1);
      } else {
        setSelectedAxis('vector');
      }

      setCustomDelta({
        dx: String(activeDisplacement.dx),
        dy: String(activeDisplacement.dy),
        dz: String(activeDisplacement.dz)
      });
    }
  }, [activeDisplacement]);

  // Handle direct move execution
  const handleApplyDistance = () => {
    // 1. Check if user typed coordinates like "100, 50, 0" or "100 50 0"
    const trimmed = distanceValue.trim();
    if (trimmed.includes(',') || trimmed.split(/\s+/).length === 3) {
      const parts = trimmed.includes(',') ? trimmed.split(',') : trimmed.split(/\s+/);
      const parsedX = parseFloat(parts[0]) || 0;
      const parsedY = parseFloat(parts[1]) || 0;
      const parsedZ = parseFloat(parts[2]) || 0;
      onApplyOffset(parsedX, parsedY, parsedZ);
      return;
    }

    const dist = parseFloat(distanceValue);
    if (isNaN(dist) || dist === 0) return;

    // Check if we are adjusting the LAST drag in vector mode
    if (selectedAxis === 'vector' && activeDisplacement && activeDisplacement.dist > 0) {
      const currentDist = activeDisplacement.dist;
      const targetDist = dist * direction;
      // Calculate delta adjustment from where piece currently sits
      const scaleFactor = targetDist / currentDist;
      const targetDx = Math.round(activeDisplacement.dx * scaleFactor);
      const targetDy = Math.round(activeDisplacement.dy * scaleFactor);
      const targetDz = Math.round(activeDisplacement.dz * scaleFactor);
      
      const deltaX = targetDx - activeDisplacement.dx;
      const deltaY = targetDy - activeDisplacement.dy;
      const deltaZ = targetDz - activeDisplacement.dz;

      onApplyOffset(deltaX, deltaY, deltaZ);
      return;
    }

    // Otherwise standard axis offset
    const effectiveDist = Math.abs(dist) * direction * (dist < 0 ? -1 : 1);
    let dx = 0;
    let dy = 0;
    let dz = 0;

    if (selectedAxis === 'X') dx = effectiveDist;
    else if (selectedAxis === 'Y') dy = effectiveDist;
    else if (selectedAxis === 'Z') dz = effectiveDist;
    else {
      // Fallback to X if vector without active drag
      dx = effectiveDist;
    }

    onApplyOffset(dx, dy, dz);
  };

  const handleApplyDetailedCoords = () => {
    const dx = parseFloat(customDelta.dx) || 0;
    const dy = parseFloat(customDelta.dy) || 0;
    const dz = parseFloat(customDelta.dz) || 0;
    if (dx === 0 && dy === 0 && dz === 0) return;
    onApplyOffset(dx, dy, dz);
  };

  const handleNudge = (amount: number) => {
    let dx = 0;
    let dy = 0;
    let dz = 0;

    if (selectedAxis === 'X' || selectedAxis === 'vector') dx = amount;
    else if (selectedAxis === 'Y') dy = amount;
    else if (selectedAxis === 'Z') dz = amount;

    onApplyOffset(dx, dy, dz);
    setDistanceValue(String(Math.abs(amount)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApplyDistance();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.shiftKey ? 50 : e.altKey ? 1 : 10;
      const current = parseFloat(distanceValue) || 0;
      setDistanceValue(String(current + step));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const step = e.shiftKey ? 50 : e.altKey ? 1 : 10;
      const current = parseFloat(distanceValue) || 0;
      setDistanceValue(String(Math.max(1, current - step)));
    }
  };

  const isDraggingLive = activeDisplacement?.isDragging;

  return (
    <div 
      id="move-distance-bar"
      className="flex flex-col items-center gap-1.5 pointer-events-auto select-none transition-all duration-200"
    >
      {/* Detailed relative coordinates drawer (expandable) */}
      {showDetailedCoords && (
        <div className="flex items-center gap-2 bg-[#181818]/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#333333] shadow-xl text-[9px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="font-bold text-[#888888] uppercase tracking-wider text-[8px] flex items-center gap-1">
            <Compass className="w-2.5 h-2.5 text-[#f0a144]" /> Desplazamiento Vectorial:
          </span>
          <div className="flex items-center gap-1">
            <span className="font-bold text-red-400">ΔX:</span>
            <input 
              type="number"
              value={customDelta.dx}
              onChange={(e) => setCustomDelta(prev => ({ ...prev, dx: e.target.value }))}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleApplyDetailedCoords(); }}
              className="w-12 bg-[#0c0c0c] border border-[#333333] text-white px-1.5 py-0.5 rounded text-center font-mono font-bold outline-none focus:border-red-400"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-green-400">ΔY:</span>
            <input 
              type="number"
              value={customDelta.dy}
              onChange={(e) => setCustomDelta(prev => ({ ...prev, dy: e.target.value }))}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleApplyDetailedCoords(); }}
              className="w-12 bg-[#0c0c0c] border border-[#333333] text-white px-1.5 py-0.5 rounded text-center font-mono font-bold outline-none focus:border-green-400"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="font-bold text-blue-400">ΔZ:</span>
            <input 
              type="number"
              value={customDelta.dz}
              onChange={(e) => setCustomDelta(prev => ({ ...prev, dz: e.target.value }))}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') handleApplyDetailedCoords(); }}
              className="w-12 bg-[#0c0c0c] border border-[#333333] text-white px-1.5 py-0.5 rounded text-center font-mono font-bold outline-none focus:border-blue-400"
            />
          </div>
          <button
            type="button"
            onClick={handleApplyDetailedCoords}
            className="bg-[#2a2a2a] hover:bg-[#f0a144] hover:text-black text-white px-2 py-0.5 rounded font-bold transition-colors cursor-pointer border border-[#3a3a3a]"
          >
            Aplicar ΔXYZ
          </button>
        </div>
      )}

      {/* Main Distance Bar */}
      <div className={`flex items-center gap-1.5 sm:gap-2 bg-[#181818]/95 backdrop-blur-md px-2.5 sm:px-3.5 py-1 rounded-full border shadow-2xl transition-all ${
        isDraggingLive 
          ? 'border-[#f0a144] shadow-[#f0a144]/20' 
          : 'border-[#333333] hover:border-[#444444]'
      }`}>
        {/* Mode Icon & Label */}
        <div className="flex items-center gap-1 text-[#f0a144] pr-1 border-r border-[#2d2d2d]">
          <Move className={`w-3.5 h-3.5 ${isDraggingLive ? 'animate-pulse' : ''}`} />
          <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-[#cccccc] hidden sm:inline">
            Distancia:
          </span>
        </div>

        {/* Axis Selector Pills */}
        <div className="flex items-center bg-[#111111] p-0.5 rounded-full border border-[#2d2d2d]">
          <button
            type="button"
            onClick={() => setSelectedAxis('X')}
            title="Mover a lo largo del Eje X (Largo / Rojo)"
            className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-mono font-bold transition-all cursor-pointer ${
              selectedAxis === 'X'
                ? 'bg-red-500 text-white shadow-sm'
                : 'text-red-400/80 hover:text-red-300 hover:bg-[#222222]'
            }`}
          >
            X
          </button>
          <button
            type="button"
            onClick={() => setSelectedAxis('Y')}
            title="Mover a lo largo del Eje Y (Altura / Verde)"
            className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-mono font-bold transition-all cursor-pointer ${
              selectedAxis === 'Y'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-green-400/80 hover:text-green-300 hover:bg-[#222222]'
            }`}
          >
            Y
          </button>
          <button
            type="button"
            onClick={() => setSelectedAxis('Z')}
            title="Mover a lo largo del Eje Z (Fondo / Azul)"
            className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-mono font-bold transition-all cursor-pointer ${
              selectedAxis === 'Z'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-blue-400/80 hover:text-blue-300 hover:bg-[#222222]'
            }`}
          >
            Z
          </button>
          {activeDisplacement && activeDisplacement.dist > 0 && (
            <button
              type="button"
              onClick={() => setSelectedAxis('vector')}
              title="Mover en la dirección del último arrastre"
              className={`px-1.5 py-0.5 rounded-full text-[7.5px] sm:text-[8px] font-bold transition-all cursor-pointer ${
                selectedAxis === 'vector'
                  ? 'bg-[#f0a144] text-black shadow-sm'
                  : 'text-[#f0a144]/80 hover:text-[#f0a144] hover:bg-[#222222]'
              }`}
            >
              Dir.
            </button>
          )}
        </div>

        {/* Direction Sign (+ / -) Toggle */}
        <button
          type="button"
          onClick={() => setDirection(prev => (prev === 1 ? -1 : 1))}
          title={`Dirección: ${direction === 1 ? 'Positiva (+)' : 'Negativa (-)'}`}
          className={`w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-mono font-bold transition-all cursor-pointer border ${
            direction === 1 
              ? 'bg-[#262626] text-white border-[#3a3a3a] hover:bg-[#333333]' 
              : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
          }`}
        >
          {direction === 1 ? '+' : '−'}
        </button>

        {/* Distance Editable Input */}
        <div className="flex items-center bg-[#0c0c0c] px-1.5 sm:px-2 py-0.5 rounded-md border border-[#333333] focus-within:border-[#f0a144] focus-within:ring-1 focus-within:ring-[#f0a144]/30">
          <input
            ref={inputRef}
            type="text"
            value={distanceValue}
            onChange={(e) => setDistanceValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            title="Escribe la distancia en mm y pulsa Enter para mover (o '100, 50, 0' para ΔX, ΔY, ΔZ)"
            className="w-14 sm:w-16 bg-transparent text-white font-mono font-black text-[10px] sm:text-[11px] text-center outline-none select-text"
          />
          <span className="text-[8px] font-bold text-[#888888] ml-0.5 select-none font-mono">mm</span>
        </div>

        {/* Apply Button */}
        <button
          type="button"
          onClick={handleApplyDistance}
          title="Aplicar desplazamiento (Enter)"
          className="flex items-center gap-1 bg-[#f0a144] hover:bg-[#ffb766] active:scale-95 text-black px-2 sm:px-2.5 py-0.5 rounded-full text-[8.5px] sm:text-[9.5px] font-bold shadow transition-all cursor-pointer"
        >
          <span>Mover</span>
          <CornerDownLeft className="w-2.5 h-2.5 opacity-75" />
        </button>

        {/* Quick Nudge Steps */}
        <div className="hidden md:flex items-center gap-0.5 border-l border-[#2d2d2d] pl-1.5">
          <button
            type="button"
            onClick={() => handleNudge(-100)}
            title="Retroceder 100 mm"
            className="px-1 py-0.5 rounded text-[7.5px] font-mono text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            -100
          </button>
          <button
            type="button"
            onClick={() => handleNudge(-10)}
            title="Retroceder 10 mm"
            className="px-1 py-0.5 rounded text-[7.5px] font-mono text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            -10
          </button>
          <button
            type="button"
            onClick={() => handleNudge(10)}
            title="Avanzar 10 mm"
            className="px-1 py-0.5 rounded text-[7.5px] font-mono text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            +10
          </button>
          <button
            type="button"
            onClick={() => handleNudge(100)}
            title="Avanzar 100 mm"
            className="px-1 py-0.5 rounded text-[7.5px] font-mono text-gray-400 hover:text-white hover:bg-[#282828] transition-colors cursor-pointer"
          >
            +100
          </button>
        </div>

        {/* Snap to Floor Quick Button */}
        <button
          type="button"
          onClick={onSnapToFloor}
          title="Apoyar pieza en el suelo (Cota Y = 0 mm)"
          className="flex items-center gap-1 bg-[#242424] hover:bg-[#333333] active:scale-95 text-gray-300 hover:text-white px-2 py-0.5 rounded-full text-[8px] font-bold border border-[#333333] transition-all cursor-pointer ml-0.5"
        >
          <ArrowDownToLine className="w-2.5 h-2.5 text-[#f0a144]" />
          <span className="hidden sm:inline">A Suelo</span>
        </button>

        {/* Toggle Detailed Coords */}
        <button
          type="button"
          onClick={() => setShowDetailedCoords(prev => !prev)}
          title="Alternar panel de coordenadas vectoriales ΔX, ΔY, ΔZ"
          className={`p-1 rounded-full text-[8px] font-bold transition-all cursor-pointer border ${
            showDetailedCoords 
              ? 'bg-[#f0a144]/20 text-[#f0a144] border-[#f0a144]/40' 
              : 'text-gray-400 hover:text-white hover:bg-[#242424] border-transparent'
          }`}
        >
          <SlidersHorizontal className="w-3 h-3" />
        </button>

        {/* Close or minimize button if provided */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-0.5 rounded-full hover:bg-[#242424] transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MoveDistanceBar;
