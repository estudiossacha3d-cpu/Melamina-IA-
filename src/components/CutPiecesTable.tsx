import React, { useState, useMemo } from 'react';
import { Piece, EdgeThicknessConfig } from '../types';
import { calculatePieceCutDimensions } from '../lib/edgeCalculations';
import { getPieceMaterialProfile } from '../lib/materialCalculations';
import { RotateCw, Trash2, Scissors, Check } from 'lucide-react';

export interface CutPiecesTableProps {
  pieces: Piece[];
  groupedPieces: {
    key: string;
    ids: string[];
    totalQuantity: number;
    representative: Piece;
  }[];
  selectedPieceIds: string[];
  toggleSelection: (id: string, multiSelect: boolean) => void;
  updatePiece: (id: string, updates: Partial<Piece>) => void;
  setPieces?: React.Dispatch<React.SetStateAction<Piece[]>>;
  edgeThicknessConfig: EdgeThicknessConfig;
  hoveredPieceId?: string | null;
  setHoveredPieceId?: (id: string | null) => void;
  onSwitchTo3D?: () => void;
}

export const CutPiecesTable: React.FC<CutPiecesTableProps> = ({
  pieces,
  groupedPieces,
  selectedPieceIds,
  toggleSelection,
  updatePiece,
  setPieces,
  edgeThicknessConfig,
  hoveredPieceId,
  setHoveredPieceId,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Group pieces by material and thickness (e.g. RO18 - Melamina Rovere)
  const materialSections = useMemo(() => {
    const map: Record<string, {
      id: string;
      code: string;
      name: string;
      displayName: string;
      color: string;
      substrate: string;
      thickness: number;
      groups: typeof groupedPieces;
      totalPieces: number;
    }> = {};

    groupedPieces.forEach(group => {
      const p = group.representative;
      const profile = getPieceMaterialProfile(p);
      const sectionKey = profile.groupKey;

      if (!map[sectionKey]) {
        map[sectionKey] = {
          id: sectionKey,
          code: profile.code,
          name: profile.materialName,
          displayName: profile.displayName,
          color: profile.color,
          substrate: profile.substrate,
          thickness: profile.thickness,
          groups: [],
          totalPieces: 0,
        };
      }
      map[sectionKey].groups.push(group);
      map[sectionKey].totalPieces += group.totalQuantity;
    });

    return Object.values(map);
  }, [groupedPieces]);

  const handleQuantityUpdate = (group: typeof groupedPieces[0], newQty: number) => {
    const val = Math.max(1, newQty);
    if (setPieces) {
      setPieces(prev => {
        const updated = prev.map(p => {
          if (p.id === group.ids[0]) {
            return { ...p, cantidad: val };
          }
          return p;
        });
        return updated;
      });
    } else {
      updatePiece(group.ids[0], { cantidad: val });
    }
  };

  const handleRotateGroup = (group: typeof groupedPieces[0]) => {
    const oldLargo = group.representative.largo;
    const oldAncho = group.representative.ancho;
    const oldCantos = group.representative.cantos || {
      largo1: 'Ninguno',
      largo2: 'Ninguno',
      ancho1: 'Ninguno',
      ancho2: 'Ninguno',
    };

    const newCantos = {
      largo1: oldCantos.ancho1,
      largo2: oldCantos.ancho2,
      ancho1: oldCantos.largo1,
      ancho2: oldCantos.largo2,
    };

    group.ids.forEach(id => {
      updatePiece(id, {
        largo: oldAncho,
        ancho: oldLargo,
        cantos: newCantos,
      });
    });
  };

  // Helper para verificar si una pieza permite rotación 90° en el plano de corte
  // Físicamente: no debe tener veta y rotacion debe ser explícitamente true (desactivado por defecto)
  const isPieceRotatable = (p: Piece) => {
    return !p.veta && p.rotacion === true;
  };

  const allRotated = pieces.length > 0 && pieces.every(p => isPieceRotatable(p));
  const someRotated = pieces.some(p => isPieceRotatable(p));

  // Alternar rotación masiva para todas las piezas
  const handleToggleAllRotation = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextVal = !allRotated;
    if (setPieces) {
      setPieces(prev => prev.map(p => ({
        ...p,
        rotacion: nextVal,
        ...(nextVal ? { veta: false } : {}),
      })));
    } else {
      pieces.forEach(p => {
        updatePiece(p.id, {
          rotacion: nextVal,
          ...(nextVal ? { veta: false } : {}),
        });
      });
    }
  };

  if (groupedPieces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center text-[#666]">
        <Scissors className="w-5 h-5 text-[#555] mb-1" />
        <p className="text-[10px] font-mono">No hay piezas para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="w-full select-none overflow-x-hidden" data-no-canvas-zoom="true">
      <table className="w-full text-left border-collapse font-sans text-[8.5px]">
        {/* Compact Table Header: Everything fits in 1 glance without horizontal scrolling */}
        <thead className="bg-[#121212] text-[#777] font-mono text-[7.5px] uppercase tracking-wider sticky top-0 z-20 border-b border-[#292929]">
          <tr>
            <th className="py-1 px-1.5 text-left text-white">Descripción</th>
            <th className="py-1 px-0.5 text-center w-7 text-white">Cant</th>
            <th className="py-1 px-0.5 text-center w-[84px] text-white" title="Largo × Ancho (mm)">Medidas</th>
            {/* Columna Rotación con Checkbox Maestro */}
            <th 
              className="py-1 px-0.5 text-center w-8 select-none" 
              title="Permitir Rotación (Girar piezas 90° en la optimización de corte)"
            >
              <div 
                onClick={handleToggleAllRotation}
                className="flex flex-col items-center justify-center gap-0.5 cursor-pointer group"
                title={allRotated ? "Desactivar rotación para todas las piezas" : "Permitir rotación para todas las piezas"}
              >
                <span className="text-[6.5px] text-[#bbb] group-hover:text-[#f0a144] font-bold transition-colors">Rotac.</span>
                <div
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-all ${
                    allRotated
                      ? 'bg-blue-600 border border-blue-400 text-white shadow-sm'
                      : someRotated
                        ? 'bg-blue-950 border border-blue-500 text-blue-300'
                        : 'bg-[#1e1e1e] border border-[#444] text-transparent hover:border-[#777]'
                  }`}
                >
                  {allRotated ? (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  ) : someRotated ? (
                    <span className="w-1.5 h-0.5 bg-blue-300 rounded-sm" />
                  ) : null}
                </div>
              </div>
            </th>
            <th className="py-1 px-0.5 text-center w-5 text-emerald-400" title="Veta (S = Sí / − = No)">Vet</th>
            <th className="py-1 px-0.5 text-center w-[52px]" title="Cantos: L1, L2 (Largos) | A1, A2 (Anchos). Clic para alternar: − (Ninguno), D (Delgado), G (Grueso)">
              <div className="flex flex-col items-center leading-none">
                <span className="text-blue-400 font-bold">Cantos</span>
                <span className="text-[6px] text-[#666] font-mono tracking-tighter">L1·L2|A1·A2</span>
              </div>
            </th>
            <th className="py-1 px-0.5 text-center w-5 text-purple-300" title="Ranurado (R = Activo / − = Sin ranura)">Ran</th>
            <th className="py-1 px-0.5 text-center w-7 text-white">Acc</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-[#202020]">
          {materialSections.map((section) => {
            const isCollapsed = !!collapsedSections[section.id];

            return (
              <React.Fragment key={section.id}>
                {/* Material Section Group Banner */}
                <tr 
                  onClick={() => toggleSection(section.id)}
                  className="bg-[#191919] hover:bg-[#202020] text-white font-mono text-[8px] font-bold border-y border-[#303030] cursor-pointer select-none sticky top-[25px] z-10"
                >
                  <td colSpan={8} className="py-0.5 px-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleSection(section.id); }}
                          className="w-3 h-3 rounded border border-[#444] bg-[#222] text-[#f0a144] flex items-center justify-center text-[8px] font-mono font-bold leading-none"
                          title={isCollapsed ? "Expandir" : "Colapsar"}
                        >
                          {isCollapsed ? '+' : '−'}
                        </button>
                        <div 
                          className="w-2.5 h-2.5 rounded-full border border-black/50 shrink-0 shadow-xs" 
                          style={{ backgroundColor: section.color }}
                          title={section.displayName}
                        />
                        <span className="text-[#f0a144] font-black">{section.code}</span>
                        <span className="text-white font-medium">- {section.displayName}</span>
                        <span className="text-[#666] text-[7.5px] font-normal">
                          ({section.totalPieces} pzs)
                        </span>
                      </div>
                      
                      <span className="bg-[#242424] px-1 rounded border border-[#333] text-[#aaa] text-[7.5px]">
                        {section.thickness}mm
                      </span>
                    </div>
                  </td>
                </tr>

                {/* Section Piece Rows - 100% visible at one glance, 0 horizontal scroll */}
                {!isCollapsed && section.groups.map((group) => {
                  const { representative: piece, totalQuantity, ids, key } = group;
                  const isSelected = ids.some(id => selectedPieceIds.includes(id));
                  const isHovered = ids.some(id => hoveredPieceId === id);
                  const cutInfo = calculatePieceCutDimensions(piece, edgeThicknessConfig);

                  const handleUpdate = (updates: Partial<Piece>) => {
                    ids.forEach(id => updatePiece(id, updates));
                  };

                  return (
                    <tr
                      key={key}
                      data-group-key={key}
                      onClick={(e) => {
                        if (e.shiftKey) {
                          ids.forEach(id => toggleSelection(id, true));
                        } else {
                          toggleSelection(ids[0], false);
                        }
                      }}
                      onMouseEnter={() => setHoveredPieceId?.(ids[0])}
                      onMouseLeave={() => setHoveredPieceId?.(null)}
                      className={`cursor-pointer transition-colors border-b border-[#1e1e1e] ${
                        isSelected 
                          ? 'bg-[#f0a144]/15 border-l-2 border-l-[#f0a144]' 
                          : isHovered
                            ? 'bg-[#222222] border-l-2 border-l-blue-500'
                            : 'hover:bg-[#1c1c1c] bg-[#161616]'
                      }`}
                    >
                      {/* Descripción */}
                      <td className="py-0.5 px-1">
                        <div className="flex items-center gap-1">
                          <div 
                            className="w-2 h-2 rounded-full border border-black/40 shrink-0" 
                            style={{ backgroundColor: section.color }}
                            title={section.displayName}
                          />
                          <input
                            type="text"
                            value={piece.name}
                            onChange={(e) => handleUpdate({ name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-transparent hover:bg-[#202020] focus:bg-[#0e0e0e] focus:ring-1 focus:ring-[#f0a144] px-1 py-0 h-4.5 rounded text-white font-medium text-[8.5px] uppercase outline-none truncate transition-colors"
                            placeholder="Pieza"
                            title={piece.name}
                          />
                        </div>
                      </td>

                      {/* Cantidad - Totalmente legible, sin spinner que recorte números */}
                      <td className="py-0.5 px-0.5 text-center">
                        <input
                          type="number"
                          min="1"
                          value={totalQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            handleQuantityUpdate(group, val);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-7 h-4.5 text-center bg-[#202020] hover:bg-[#282828] focus:bg-[#0e0e0e] focus:ring-1 focus:ring-[#f0a144] px-0.5 rounded text-white font-mono font-bold text-[8.5px] outline-none border border-[#333333] no-spin-buttons [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="Cantidad de piezas"
                        />
                      </td>

                      {/* Medidas (Largo × Ancho) - Espacio suficiente para números de 4 cifras (ej. 2440, 1386) sin cortes */}
                      <td className="py-0.5 px-0.5 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex items-center justify-center gap-0.5 font-mono">
                            <input
                              type="number"
                              value={piece.largo === 0 ? '' : Math.round(piece.largo)}
                              onChange={(e) => handleUpdate({ largo: parseFloat(e.target.value) || 0 })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-10 h-4.5 text-center bg-[#1c1c1c] hover:bg-[#242424] focus:bg-[#0e0e0e] focus:ring-1 focus:ring-[#f0a144] px-0.5 rounded text-white font-mono font-bold text-[8.5px] outline-none border border-[#2c2c2c] focus:border-[#f0a144] transition-colors no-spin-buttons [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title="Largo mm"
                            />
                            <span className="text-[#666] text-[7.5px] select-none font-sans">×</span>
                            <input
                              type="number"
                              value={piece.ancho === 0 ? '' : Math.round(piece.ancho)}
                              onChange={(e) => handleUpdate({ ancho: parseFloat(e.target.value) || 0 })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-10 h-4.5 text-center bg-[#1c1c1c] hover:bg-[#242424] focus:bg-[#0e0e0e] focus:ring-1 focus:ring-[#f0a144] px-0.5 rounded text-white font-mono font-bold text-[8.5px] outline-none border border-[#2c2c2c] focus:border-[#f0a144] transition-colors no-spin-buttons [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              title="Ancho mm"
                            />
                          </div>

                          {/* Si hay cantos con descuento de sierra, se muestra directo debajo sin ocupar columnas extra */}
                          {cutInfo.tieneDescuento && (
                            <div 
                              className="flex items-center justify-center gap-0.5 font-mono text-[7px] text-[#f0a144] font-bold leading-none mt-0.5"
                              title={`Corte neto con cantos descontados: ${cutInfo.largoCorte}×${cutInfo.anchoCorte} mm`}
                            >
                              <span>Neto:{cutInfo.largoCorte}×{cutInfo.anchoCorte}</span>
                              <span className="text-red-400 font-normal">(-{(cutInfo.descuentoLargoTotal + cutInfo.descuentoAnchoTotal).toFixed(0)})</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Rotación - Checkbox estilo Cutting Optimization Pro */}
                      <td className="py-0.5 px-0.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const canRot = isPieceRotatable(piece);
                            const nextRot = !canRot;
                            handleUpdate({ 
                              rotacion: nextRot,
                              ...(nextRot ? { veta: false } : {}),
                            });
                          }}
                          className={`w-3.5 h-3.5 mx-auto rounded flex items-center justify-center transition-all ${
                            isPieceRotatable(piece)
                              ? 'bg-blue-600 border border-blue-400 text-white shadow-sm hover:bg-blue-500'
                              : 'bg-[#1c1c1c] border border-[#3e3e3e] text-transparent hover:border-[#666]'
                          }`}
                          title={
                            isPieceRotatable(piece) 
                              ? "Rotación: PERMITIDA (90°) [✓]" 
                              : piece.veta 
                                ? "Rotación: BLOQUEADA (Pieza con veta de madera activa) [ ]" 
                                : "Rotación: BLOQUEADA (fija) [ ]"
                          }
                        >
                          {isPieceRotatable(piece) && (
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          )}
                        </button>
                      </td>

                      {/* Veta - Compacto */}
                      <td className="py-0.5 px-0.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextVeta = !piece.veta;
                            handleUpdate({ 
                              veta: nextVeta,
                              ...(nextVeta ? { rotacion: false } : {}),
                            });
                          }}
                          className={`w-3.5 h-3.5 flex items-center justify-center rounded transition-colors mx-auto ${
                            piece.veta 
                              ? 'bg-emerald-950 border border-emerald-500 text-emerald-300 font-bold' 
                              : 'text-[#555] hover:text-white hover:bg-[#222] border border-transparent'
                          }`}
                          title={`Veta: ${piece.veta ? 'Sí (Bloquea rotación de 90°)' : 'No (Sin dirección de veta)'}`}
                        >
                          <span className="font-mono text-[7px] font-bold">
                            {piece.veta ? 'S' : '−'}
                          </span>
                        </button>
                      </td>

                      {/* Cantos: L1, L2 | A1, A2 compactados en 1 sola celda de 4 micro-botones */}
                      <td className="py-0.5 px-0.5 text-center">
                        <div className="flex items-center justify-center gap-[1px]">
                          {/* L1 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cur = piece.cantos?.largo1 || 'Ninguno';
                              const next = cur === 'Ninguno' ? 'Canto Delgado' : cur === 'Canto Delgado' ? 'Canto Grueso' : 'Ninguno';
                              handleUpdate({ cantos: { ...piece.cantos, largo1: next } });
                            }}
                            className={`w-3 h-3.5 rounded text-[6.5px] font-mono font-bold flex items-center justify-center transition-colors ${
                              piece.cantos?.largo1 === 'Canto Grueso'
                                ? 'bg-rose-950 border border-rose-500 text-rose-300'
                                : piece.cantos?.largo1 === 'Canto Delgado'
                                  ? 'bg-blue-950 border border-blue-500 text-blue-300'
                                  : 'bg-[#202020] text-[#555] hover:text-white border border-[#2d2d2d]'
                            }`}
                            title={`Largo 1: ${piece.cantos?.largo1 || 'Ninguno'}`}
                          >
                            {piece.cantos?.largo1 === 'Canto Grueso' ? 'G' : piece.cantos?.largo1 === 'Canto Delgado' ? 'D' : '−'}
                          </button>

                          {/* L2 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cur = piece.cantos?.largo2 || 'Ninguno';
                              const next = cur === 'Ninguno' ? 'Canto Delgado' : cur === 'Canto Delgado' ? 'Canto Grueso' : 'Ninguno';
                              handleUpdate({ cantos: { ...piece.cantos, largo2: next } });
                            }}
                            className={`w-3 h-3.5 rounded text-[6.5px] font-mono font-bold flex items-center justify-center transition-colors ${
                              piece.cantos?.largo2 === 'Canto Grueso'
                                ? 'bg-rose-950 border border-rose-500 text-rose-300'
                                : piece.cantos?.largo2 === 'Canto Delgado'
                                  ? 'bg-blue-950 border border-blue-500 text-blue-300'
                                  : 'bg-[#202020] text-[#555] hover:text-white border border-[#2d2d2d]'
                            }`}
                            title={`Largo 2: ${piece.cantos?.largo2 || 'Ninguno'}`}
                          >
                            {piece.cantos?.largo2 === 'Canto Grueso' ? 'G' : piece.cantos?.largo2 === 'Canto Delgado' ? 'D' : '−'}
                          </button>

                          <span className="text-[#444] text-[6.5px] font-mono font-bold mx-[0.5px]">|</span>

                          {/* A1 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cur = piece.cantos?.ancho1 || 'Ninguno';
                              const next = cur === 'Ninguno' ? 'Canto Delgado' : cur === 'Canto Delgado' ? 'Canto Grueso' : 'Ninguno';
                              handleUpdate({ cantos: { ...piece.cantos, ancho1: next } });
                            }}
                            className={`w-3 h-3.5 rounded text-[6.5px] font-mono font-bold flex items-center justify-center transition-colors ${
                              piece.cantos?.ancho1 === 'Canto Grueso'
                                ? 'bg-rose-950 border border-rose-500 text-rose-300'
                                : piece.cantos?.ancho1 === 'Canto Delgado'
                                  ? 'bg-blue-950 border border-blue-500 text-blue-300'
                                  : 'bg-[#202020] text-[#555] hover:text-white border border-[#2d2d2d]'
                            }`}
                            title={`Ancho 1: ${piece.cantos?.ancho1 || 'Ninguno'}`}
                          >
                            {piece.cantos?.ancho1 === 'Canto Grueso' ? 'G' : piece.cantos?.ancho1 === 'Canto Delgado' ? 'D' : '−'}
                          </button>

                          {/* A2 */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cur = piece.cantos?.ancho2 || 'Ninguno';
                              const next = cur === 'Ninguno' ? 'Canto Delgado' : cur === 'Canto Delgado' ? 'Canto Grueso' : 'Ninguno';
                              handleUpdate({ cantos: { ...piece.cantos, ancho2: next } });
                            }}
                            className={`w-3 h-3.5 rounded text-[6.5px] font-mono font-bold flex items-center justify-center transition-colors ${
                              piece.cantos?.ancho2 === 'Canto Grueso'
                                ? 'bg-rose-950 border border-rose-500 text-rose-300'
                                : piece.cantos?.ancho2 === 'Canto Delgado'
                                  ? 'bg-blue-950 border border-blue-500 text-blue-300'
                                  : 'bg-[#202020] text-[#555] hover:text-white border border-[#2d2d2d]'
                            }`}
                            title={`Ancho 2: ${piece.cantos?.ancho2 || 'Ninguno'}`}
                          >
                            {piece.cantos?.ancho2 === 'Canto Grueso' ? 'G' : piece.cantos?.ancho2 === 'Canto Delgado' ? 'D' : '−'}
                          </button>
                        </div>
                      </td>

                      {/* Ranurado */}
                      <td className="py-0.5 px-0.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (piece.ranurado) {
                              handleUpdate({ ranurado: false });
                            } else {
                              handleUpdate({
                                ranurado: true,
                                ranuraConfig: { lado: 'L1', dist: 18, esp: 4, prof: 8 }
                              });
                            }
                          }}
                          className={`w-3.5 h-3.5 rounded text-[7px] font-mono transition-colors mx-auto flex items-center justify-center ${
                            piece.ranurado 
                              ? 'bg-purple-950 text-purple-300 border border-purple-500 font-bold' 
                              : 'text-[#555] hover:text-white hover:bg-[#222]'
                          }`}
                          title={piece.ranurado ? "Ranurado activo" : "Sin ranurado"}
                        >
                          {piece.ranurado ? 'R' : '−'}
                        </button>
                      </td>

                      {/* Acciones (Rotar y Eliminar) */}
                      <td className="py-0.5 px-0.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          {/* Rotar 90° */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRotateGroup(group);
                            }}
                            className="p-0.5 rounded bg-[#202020] hover:bg-[#f0a144] hover:text-black text-[#888] transition-colors"
                            title="Rotar 90°"
                          >
                            <RotateCw className="w-2.5 h-2.5" />
                          </button>

                          {/* Eliminar */}
                          {setPieces && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPieces(prev => prev.filter(p => !ids.includes(p.id)));
                              }}
                              className="p-0.5 rounded bg-[#202020] hover:bg-red-600 hover:text-white text-[#666] transition-colors"
                              title="Eliminar pieza"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
