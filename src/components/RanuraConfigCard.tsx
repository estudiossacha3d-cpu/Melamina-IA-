import React, { useState } from 'react';
import { Scissors, Check, Trash2, CheckCircle2 } from 'lucide-react';
import { Piece } from '../types';

interface RanuraConfigCardProps {
  piece: Piece;
  onUpdate: (updates: Partial<Piece>) => void;
  compact?: boolean;
  onToast?: (msg: string) => void;
  selectedPieces?: Piece[];
  onUpdateMultiple?: (updates: { id: string; patch: Partial<Piece> }[]) => void;
}

const FONDO_THICKNESS_PRESETS = [
  { val: 3, label: '3 mm (Trupan)' },
  { val: 4, label: '4 mm (MDF/Durolac)' },
  { val: 5.5, label: '5.5 mm' },
  { val: 6, label: '6 mm' },
  { val: 9, label: '9 mm' },
  { val: 15, label: '15 mm' },
  { val: 18, label: '18 mm (Melamina)' },
];

const DIST_PRESETS = [10, 15, 18, 20];
const PROF_PRESETS = [6, 8, 10, 12];

export const RanuraConfigCard: React.FC<RanuraConfigCardProps> = ({
  piece,
  onUpdate,
  compact = false,
  onToast,
  selectedPieces = [],
  onUpdateMultiple
}) => {
  const isRanurado = Boolean(piece.ranurado);
  const cfg = piece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8, cara: 'superior' };
  const currentCara = cfg.cara || 'superior';

  const [justApplied, setJustApplied] = useState(false);

  const notify = (msg: string) => {
    if (onToast) {
      onToast(msg);
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: msg }));
    }
  };

  const handleApplyRanura = () => {
    onUpdate({
      ranurado: true,
      ranuraConfig: {
        lado: cfg.lado,
        dist: cfg.dist,
        esp: cfg.esp,
        prof: cfg.prof,
        cara: currentCara
      }
    });

    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2500);

    notify(
      `✓ Ranura aplicada en "${piece.name || 'la pieza'}": Lado ${cfg.lado}, Cara: ${currentCara === 'inferior' ? 'Inferior/Interna (-Y)' : 'Superior/Externa (+Y)'}, Dist: ${cfg.dist}mm, Prof: ${cfg.prof}mm, Fondo: ${cfg.esp}mm`
    );
  };

  const handleApplyToMultiple = () => {
    if (!onUpdateMultiple || selectedPieces.length <= 1) {
      handleApplyRanura();
      return;
    }

    const updates = selectedPieces.map(p => ({
      id: p.id,
      patch: {
        ranurado: true,
        ranuraConfig: {
          lado: cfg.lado,
          dist: cfg.dist,
          esp: cfg.esp,
          prof: cfg.prof,
          cara: currentCara
        }
      }
    }));

    onUpdateMultiple(updates);
    setJustApplied(true);
    setTimeout(() => setJustApplied(false), 2500);

    notify(
      `✓ Ranura aplicada a las ${selectedPieces.length} piezas seleccionadas (Lado ${cfg.lado}, Cara ${currentCara}, Dist: ${cfg.dist}mm, Fondo: ${cfg.esp}mm)`
    );
  };

  const handleRemoveRanura = () => {
    onUpdate({
      ranurado: false
    });
    setJustApplied(false);
    notify(`Ranura eliminada de "${piece.name || 'la pieza'}". Pieza restablecida a sólido.`);
  };

  const updateConfig = (patch: Partial<typeof cfg>) => {
    // Actualizar configuración en tiempo real
    onUpdate({
      ranurado: true,
      ranuraConfig: {
        ...cfg,
        ...patch
      }
    });
  };

  if (compact) {
    return (
      <div className="bg-[#121214] border border-[#2b2b32] rounded p-2 space-y-2 text-white">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[8px] font-bold text-amber-300 uppercase">Ranura CNC</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-0.5">
              <span className="text-[7px] text-gray-400 font-mono">Lado:</span>
              {(['L1', 'L2', 'A1', 'A2'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => updateConfig({ lado: l })}
                  className={`px-1 py-0.5 rounded text-[7px] font-mono font-bold cursor-pointer transition-colors ${
                    cfg.lado === l ? 'bg-amber-500 text-black shadow-xs' : 'bg-[#1e1e1e] text-gray-400 border border-[#333] hover:text-white'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-0.5 border-l border-white/10 pl-1">
              <span className="text-[7px] text-gray-400 font-mono">Cara:</span>
              <button
                type="button"
                onClick={() => updateConfig({ cara: 'superior' })}
                title="Cara Superior / Externa (+Y)"
                className={`px-1 py-0.5 rounded text-[7px] font-mono font-bold cursor-pointer transition-colors ${
                  currentCara === 'superior' ? 'bg-amber-500 text-black shadow-xs' : 'bg-[#1e1e1e] text-gray-400 border border-[#333] hover:text-white'
                }`}
              >
                Sup
              </button>
              <button
                type="button"
                onClick={() => updateConfig({ cara: 'inferior' })}
                title="Cara Inferior / Interna (-Y)"
                className={`px-1 py-0.5 rounded text-[7px] font-mono font-bold cursor-pointer transition-colors ${
                  currentCara === 'inferior' ? 'bg-amber-500 text-black shadow-xs' : 'bg-[#1e1e1e] text-gray-400 border border-[#333] hover:text-white'
                }`}
              >
                Inf
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-[7px]">
          {/* Grosor de fondo o respaldo (esp) */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-gray-400">
              <span>Grosor Fondo / Respaldo (ES):</span>
              <span className="font-mono text-amber-300 font-bold">{cfg.esp} mm</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {FONDO_THICKNESS_PRESETS.map(preset => (
                <button
                  key={preset.val}
                  type="button"
                  onClick={() => updateConfig({ esp: preset.val })}
                  className={`px-1 py-0.5 rounded font-mono font-bold cursor-pointer transition-colors ${
                    cfg.esp === preset.val ? 'bg-amber-500 text-black' : 'bg-[#1c1c22] text-gray-400 hover:text-white border border-[#2d2d38]'
                  }`}
                >
                  {preset.val}mm
                </button>
              ))}
            </div>
          </div>

          {/* Distancia y Profundidad */}
          <div className="grid grid-cols-2 gap-1.5 pt-0.5">
            <div>
              <span className="text-gray-400 block">Distancia (DIST):</span>
              <div className="flex items-center gap-0.5 mt-0.5">
                <input
                  type="number"
                  value={cfg.dist}
                  onChange={(e) => updateConfig({ dist: parseFloat(e.target.value) || 0 })}
                  className="w-12 bg-[#1a1a1f] border border-[#333] rounded px-1 py-0.5 text-white font-mono text-[7.5px]"
                />
                <span className="text-gray-500">mm</span>
              </div>
            </div>
            <div>
              <span className="text-gray-400 block">Profundidad (PROF):</span>
              <div className="flex items-center gap-0.5 mt-0.5">
                <input
                  type="number"
                  value={cfg.prof}
                  onChange={(e) => updateConfig({ prof: parseFloat(e.target.value) || 0 })}
                  className="w-12 bg-[#1a1a1f] border border-[#333] rounded px-1 py-0.5 text-white font-mono text-[7.5px]"
                />
                <span className="text-gray-500">mm</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botón de acción Aplicar Ranura */}
        <div className="pt-1 border-t border-white/5 flex gap-1">
          <button
            type="button"
            onClick={handleApplyRanura}
            className={`flex-1 py-1 px-2 rounded font-bold text-[8px] flex items-center justify-center gap-1 cursor-pointer transition-all ${
              justApplied || isRanurado
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400 shadow-xs'
                : 'bg-amber-500 hover:bg-amber-400 text-black font-black'
            }`}
          >
            {justApplied ? <CheckCircle2 className="w-3 h-3 text-white" /> : <Scissors className="w-3 h-3" />}
            <span>{isRanurado ? 'RANURA FIJA EN PIEZA ✓' : 'APLICAR RANURA'}</span>
          </button>

          {isRanurado && (
            <button
              type="button"
              onClick={handleRemoveRanura}
              className="py-1 px-1.5 rounded bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/40 text-[7.5px] cursor-pointer"
              title="Quitar ranura"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#14151b] border border-[#252836] p-2.5 rounded-lg space-y-2.5 text-white">
      {/* CABECERA */}
      <div className="flex items-center justify-between border-b border-[#232635] pb-2">
        <div className="flex items-center gap-1.5">
          <Scissors className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wide">
            Ranurado para Fondo o Respaldo
          </span>
        </div>
        
        {isRanurado ? (
          <span className="px-2 py-0.5 rounded text-[7.5px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            RANURA ACTIVA (3D)
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[7.5px] font-mono font-bold bg-[#1d1d24] text-gray-400 border border-[#2b2e3e]">
            SIN RANURA
          </span>
        )}
      </div>

      <div className="space-y-2 text-[8px]">
        {/* LADO DE LA RANURA */}
        <div>
          <label className="text-gray-400 font-bold block mb-1 uppercase text-[7.5px]">
            Lado donde corre la ranura
          </label>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'L1', label: 'L1 (Frente)' },
              { id: 'L2', label: 'L2 (Atrás)' },
              { id: 'A1', label: 'A1 (Der)' },
              { id: 'A2', label: 'A2 (Izq)' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => updateConfig({ lado: item.id as any })}
                className={`py-1.5 px-1 rounded text-center font-bold cursor-pointer border transition-colors ${
                  cfg.lado === item.id 
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black' 
                    : 'bg-[#1a1b22] border-[#292c3a] text-gray-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* CARA DE LA RANURA (ORIENTACIÓN INTERNA / EXTERNA) */}
        <div className="bg-[#171821] p-1.5 rounded-md border border-[#252837] space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-gray-300 font-bold uppercase text-[7.5px] flex items-center gap-1">
              <span>Orientación de Cara</span>
              <span className="text-amber-400 font-mono text-[7px]">
                {currentCara === 'inferior' ? '(Interna / Inferior -Y)' : '(Externa / Superior +Y)'}
              </span>
            </label>
            <button
              type="button"
              onClick={() => updateConfig({ cara: currentCara === 'inferior' ? 'superior' : 'inferior' })}
              className="text-[7.5px] text-amber-300 hover:text-amber-200 cursor-pointer flex items-center gap-1 font-bold bg-amber-500/10 hover:bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30 transition-colors"
              title="Voltear cara mecanizada para que mire hacia adentro o hacia afuera"
            >
              <span>🔄 Voltear Ranura</span>
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => updateConfig({ cara: 'superior' })}
              className={`py-1 px-1.5 rounded text-left font-bold cursor-pointer border transition-colors flex items-center justify-between text-[7.5px] ${
                currentCara === 'superior'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black'
                  : 'bg-[#1a1b22] border-[#292c3a] text-gray-400 hover:text-white'
              }`}
            >
              <span>⬆️ Cara Sup. (+Y)</span>
              <span className="text-[6.5px] text-gray-400 font-mono">Piso/Der</span>
            </button>
            <button
              type="button"
              onClick={() => updateConfig({ cara: 'inferior' })}
              className={`py-1 px-1.5 rounded text-left font-bold cursor-pointer border transition-colors flex items-center justify-between text-[7.5px] ${
                currentCara === 'inferior'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-black'
                  : 'bg-[#1a1b22] border-[#292c3a] text-gray-400 hover:text-white'
              }`}
            >
              <span>⬇️ Cara Inf. (-Y)</span>
              <span className="text-[6.5px] text-gray-400 font-mono">Techo/Izq</span>
            </button>
          </div>
          <p className="text-[6.5px] text-gray-400 italic">
            💡 Para mirar hacia adentro: Parante Der. y Base usan (+); Parante Izq. y Techo usan (-).
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-gray-400 font-bold uppercase text-[7.5px]">
              Grosor del Fondo / Respaldo (ES)
            </label>
            <div className="flex items-center gap-1 font-mono text-amber-300 font-bold text-[8.5px]">
              <span>Espesor:</span>
              <input
                type="number"
                step="0.5"
                value={cfg.esp}
                onChange={(e) => updateConfig({ esp: parseFloat(e.target.value) || 0 })}
                className="w-12 bg-[#1b1c24] border border-amber-500/40 rounded px-1 py-0.5 text-center text-white font-mono text-[8px] focus:outline-hidden"
              />
              <span>mm</span>
            </div>
          </div>
          
          {/* Presets rápidos de espesor */}
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
            {FONDO_THICKNESS_PRESETS.map(p => (
              <button
                key={p.val}
                type="button"
                onClick={() => updateConfig({ esp: p.val })}
                className={`py-1 px-1 rounded text-[7.5px] font-mono font-bold cursor-pointer border text-center transition-colors ${
                  cfg.esp === p.val
                    ? 'bg-amber-500 text-black border-amber-400 shadow-xs'
                    : 'bg-[#1b1c24] border-[#292c3a] text-gray-400 hover:text-white'
                }`}
                title={p.label}
              >
                {p.val} mm
              </button>
            ))}
          </div>
        </div>

        {/* DISTANCIA Y PROFUNDIDAD */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#232635]">
          {/* DISTANCIA (DIST) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[7.5px] font-bold uppercase">Distancia (DIST)</span>
              <span className="font-mono text-white text-[8px]">{cfg.dist} mm</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={cfg.dist}
                onChange={(e) => updateConfig({ dist: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#1b1c24] border border-[#2b2e3e] rounded px-1.5 py-0.5 text-white font-mono text-[8px] focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <div className="flex gap-1">
              {DIST_PRESETS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => updateConfig({ dist: d })}
                  className={`flex-1 py-0.5 rounded font-mono text-[7px] cursor-pointer ${
                    cfg.dist === d ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500' : 'bg-[#181920] text-gray-400 border border-[#252836]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* PROFUNDIDAD (PROF) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[7.5px] font-bold uppercase">Profundidad (PROF)</span>
              <span className="font-mono text-white text-[8px]">{cfg.prof} mm</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={cfg.prof}
                onChange={(e) => updateConfig({ prof: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#1b1c24] border border-[#2b2e3e] rounded px-1.5 py-0.5 text-white font-mono text-[8px] focus:outline-hidden focus:border-amber-500"
              />
            </div>
            <div className="flex gap-1">
              {PROF_PRESETS.map(pr => (
                <button
                  key={pr}
                  type="button"
                  onClick={() => updateConfig({ prof: pr })}
                  className={`flex-1 py-0.5 rounded font-mono text-[7px] cursor-pointer ${
                    cfg.prof === pr ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500' : 'bg-[#181920] text-gray-400 border border-[#252836]'
                  }`}
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FICHA TÉCNICA RESUMEN EXACTA DEL DIAGRAMA */}
        <div className="bg-[#0e0f14] border border-amber-500/20 rounded p-1.5 flex items-center justify-between font-mono text-[7.5px]">
          <div className="text-gray-400">
            <span className="text-amber-400 font-bold">LADO:</span> {cfg.lado} |{' '}
            <span className="text-amber-300 font-bold">CARA:</span> {currentCara === 'inferior' ? 'Inf (-Y)' : 'Sup (+Y)'} |{' '}
            <span className="text-amber-400 font-bold">DIST:</span> {cfg.dist}mm |{' '}
            <span className="text-amber-400 font-bold">PROF:</span> {cfg.prof}mm |{' '}
            <span className="text-emerald-400 font-bold">FONDO:</span> {cfg.esp}mm
          </div>
          <span className="text-[7px] text-gray-500 italic">3D Real</span>
        </div>

        {/* BOTÓN PRINCIPAL: APLICAR Y FIJAR RANURA */}
        <div className="pt-2 border-t border-[#232635] space-y-1.5">
          <button
            type="button"
            onClick={handleApplyRanura}
            className={`w-full py-2 px-3 rounded-lg font-bold text-[9px] flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
              justApplied || isRanurado
                ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white border border-emerald-400 shadow-emerald-950/40'
                : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-black border border-amber-400 shadow-amber-950/40'
            }`}
          >
            {justApplied ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            ) : isRanurado ? (
              <Check className="w-3.5 h-3.5 text-emerald-200" />
            ) : (
              <Scissors className="w-3.5 h-3.5" />
            )}
            <span>
              {justApplied
                ? '¡RANURA APLICADA Y FIJADA CON ÉXITO!'
                : isRanurado
                ? '✓ RANURA APLICADA Y FIJA EN LA PIEZA (Guardar Cambios)'
                : 'APLICAR RANURA A ESTA PIEZA'}
            </span>
          </button>

          {selectedPieces.length > 1 && (
            <button
              type="button"
              onClick={handleApplyToMultiple}
              className="w-full py-1.5 px-2 rounded-lg bg-[#1f2230] hover:bg-[#2b2f42] text-amber-300 font-bold text-[8px] flex items-center justify-center gap-1.5 border border-amber-500/30 transition-all cursor-pointer"
            >
              <Scissors className="w-3 h-3" />
              <span>Aplicar esta Ranura a las {selectedPieces.length} piezas seleccionadas</span>
            </button>
          )}

          {isRanurado && (
            <button
              type="button"
              onClick={handleRemoveRanura}
              className="w-full py-1 rounded text-[7.5px] font-bold text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>Quitar ranura de la pieza (Restablecer tablero sólido)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
