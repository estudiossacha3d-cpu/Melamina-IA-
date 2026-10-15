import React from 'react';
import { 
  CheckSquare, 
  Square, 
  Wrench, 
  Hammer, 
  Ruler, 
  Compass, 
  Info, 
  Layers, 
  Box, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { Piece } from '../types';
import { AssemblyStep, AssemblyProjectAnalysis } from '../lib/assemblyPlanner';

interface AssemblySidebarProps {
  currentStep: AssemblyStep | null;
  allSteps: AssemblyStep[];
  stepIndex: number;
  onSelectStep: (index: number) => void;
  pieces: Piece[];
  analysis: AssemblyProjectAnalysis;
  assembledPieceIds: Set<string>;
  onTogglePieceAssembled: (pieceId: string) => void;
  activeTab: 'steps' | 'hardware' | 'tools';
  onTabChange: (tab: 'steps' | 'hardware' | 'tools') => void;
  highlightedPieceId: string | null;
  onHighlightPiece: (pieceId: string | null) => void;
}

export const AssemblySidebar: React.FC<AssemblySidebarProps> = ({
  currentStep,
  allSteps,
  stepIndex,
  onSelectStep,
  pieces,
  analysis,
  assembledPieceIds,
  onTogglePieceAssembled,
  activeTab,
  onTabChange,
  highlightedPieceId,
  onHighlightPiece
}) => {
  // Map of pieces for quick access
  const piecesMap = React.useMemo(() => {
    const map = new Map<string, Piece>();
    pieces.forEach(p => map.set(p.id, p));
    return map;
  }, [pieces]);

  // Total progress
  const totalPieces = pieces.length;
  const assembledCount = pieces.filter(p => assembledPieceIds.has(p.id)).length;
  const progressPercent = totalPieces > 0 ? Math.round((assembledCount / totalPieces) * 100) : 0;

  // Pieces belonging to current step
  const currentStepPieces = React.useMemo(() => {
    if (!currentStep) return [];
    return currentStep.pieceIds.map(id => piecesMap.get(id)).filter(Boolean) as Piece[];
  }, [currentStep, piecesMap]);

  return (
    <div className="flex flex-col h-full bg-[#181818] border-l border-[#2e2e2e] text-[#eee] select-none">
      {/* Top Header & Assembly Progress */}
      <div className="p-3.5 border-b border-[#2e2e2e] bg-[#1e1e1e]/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-white">Progreso de Armado</span>
            <span className="text-[11px] font-mono font-bold text-emerald-400">
              {progressPercent}%
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono">
            {assembledCount}/{totalPieces} piezas
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-[#2a2a2a] h-2 rounded-full overflow-hidden border border-[#333]">
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center mt-3 bg-[#141414] p-0.5 rounded-lg border border-[#2e2e2e]">
          <button
            type="button"
            onClick={() => onTabChange('steps')}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'steps' 
                ? 'bg-[#2a2a2a] text-white shadow-sm font-semibold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pasos ({allSteps.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('tools')}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'tools' 
                ? 'bg-[#2a2a2a] text-white shadow-sm font-semibold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>Herramientas</span>
          </button>
          <button
            type="button"
            onClick={() => onTabChange('hardware')}
            className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'hardware' 
                ? 'bg-[#2a2a2a] text-white shadow-sm font-semibold' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>Herrajes</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
        {/* TAB 1: STEPS & PIECES CHECKLIST */}
        {activeTab === 'steps' && currentStep && (
          <div className="space-y-4">
            {/* Current Step Overview Card */}
            <div className="bg-[#202020] border border-[#333] rounded-xl p-3.5 shadow-md">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40 text-[10px] font-mono font-bold">
                  ETAPA {stepIndex + 1}/{allSteps.length}
                </span>
                <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                  {currentStep.category}
                </span>
              </div>
              <h3 className="font-bold text-sm text-white leading-tight mb-2">
                {currentStep.title}
              </h3>
              <p className="text-xs text-gray-300 leading-relaxed mb-3">
                {currentStep.description}
              </p>

              {/* Step Dimensions / Cotas clave */}
              {currentStep.dimensionNotes.length > 0 && (
                <div className="bg-[#181818] rounded-lg p-2.5 border border-[#2a2a2a] mb-3">
                  <div className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> Cotas y Verificación del Paso:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {currentStep.dimensionNotes.map((d, i) => (
                      <div key={i} className="flex flex-col bg-[#222] p-1.5 rounded border border-[#2d2d2d]">
                        <span className="text-[9.5px] text-gray-400">{d.label}</span>
                        <span className="font-mono font-bold text-amber-300">{d.valueMm} mm</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro Tips / Recomendaciones */}
              {currentStep.tips.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-200/90 space-y-1">
                  <div className="font-bold text-[10.5px] flex items-center gap-1.5 text-amber-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Recomendación de taller:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-gray-300">
                    {currentStep.tips.map((tip, idx) => (
                      <li key={idx} className="leading-tight">{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Step Pieces Checklist */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                  Piezas de esta etapa ({currentStepPieces.length})
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  Marca al fijar
                </span>
              </div>

              <div className="space-y-1.5">
                {currentStepPieces.map((piece) => {
                  const isChecked = assembledPieceIds.has(piece.id);
                  const isHighlighted = highlightedPieceId === piece.id;

                  return (
                    <div
                      key={piece.id}
                      onMouseEnter={() => onHighlightPiece(piece.id)}
                      onMouseLeave={() => onHighlightPiece(null)}
                      onClick={() => onTogglePieceAssembled(piece.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isChecked 
                          ? 'bg-[#1b261d]/80 border-emerald-500/40 text-gray-300' 
                          : isHighlighted
                            ? 'bg-[#292212] border-amber-500 text-white shadow-lg'
                            : 'bg-[#222222] border-[#333] hover:border-gray-500 text-white'
                      }`}
                    >
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-emerald-400 focus:outline-none"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-500 hover:text-white" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs font-semibold truncate ${isChecked ? 'line-through text-gray-400' : 'text-white'}`}>
                            {piece.name || 'Pieza'}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#181818] border border-[#333] text-amber-300">
                            {piece.largo} × {piece.ancho} mm
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-2 mt-0.5">
                          <span>Esp: {piece.espesor || 18}mm</span>
                          {piece.material && <span>• {piece.material}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Step Navigation Matrix */}
            <div className="pt-2 border-t border-[#2e2e2e]">
              <div className="text-[10px] font-mono text-gray-400 uppercase tracking-wider mb-2">
                Navegar Todas las Etapas:
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {allSteps.map((step, idx) => {
                  const isCurrent = idx === stepIndex;
                  const stepPieces = step.pieceIds;
                  const allDone = stepPieces.length > 0 && stepPieces.every(id => assembledPieceIds.has(id));

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => onSelectStep(idx)}
                      className={`p-2 rounded-lg text-center transition-all border flex flex-col items-center justify-center gap-0.5 ${
                        isCurrent
                          ? 'bg-amber-950 border-amber-500 text-amber-200 ring-1 ring-amber-500'
                          : allDone
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                            : 'bg-[#222] border-[#333] hover:bg-[#2b2b2b] text-gray-300'
                      }`}
                    >
                      <span className="text-[11px] font-bold">Paso {idx + 1}</span>
                      <span className="text-[9px] font-mono opacity-70">
                        {allDone ? '✓ Listo' : `${step.pieceIds.length} pzas`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TOOLS REQUIRED */}
        {activeTab === 'tools' && (
          <div className="space-y-3">
            <div className="bg-[#202020] border border-[#333] p-3 rounded-xl">
              <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                <Hammer className="w-4 h-4 text-amber-400" />
                Herramientas del Taller y Montaje
              </h4>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Tener estas herramientas preparadas antes de ensamblar garantiza un acabado profesional sin desportilladuras ni descuadres.
              </p>
            </div>

            <div className="space-y-2">
              {analysis.allTools.map((tool) => (
                <div 
                  key={tool.id}
                  className="bg-[#222] border border-[#333] p-2.5 rounded-lg flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#2a2a2a] border border-[#3d3d3d] flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-white truncate">
                        {tool.name}
                      </span>
                      {tool.required ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-500/30 font-mono">
                          Imprescindible
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 font-mono">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-300 mt-0.5 leading-snug">
                      {tool.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: HARDWARE & SCREWS ESTIMATION */}
        {activeTab === 'hardware' && (
          <div className="space-y-3">
            <div className="bg-[#202020] border border-[#333] p-3 rounded-xl">
              <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-400" />
                Cálculo de Herrajes y Tornillería
              </h4>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Cuantificación calculada por análisis de contacto entre tableros de este proyecto.
              </p>
            </div>

            <div className="space-y-2">
              {analysis.allHardware.map((hw) => (
                <div 
                  key={hw.id}
                  className="bg-[#222] border border-[#333] p-2.5 rounded-lg flex items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {hw.name}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                      {hw.spec}
                    </div>
                    <div className="text-[10.5px] text-gray-400 mt-0.5 leading-snug">
                      {hw.purpose}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="px-2 py-1 rounded bg-[#181818] border border-[#383838] font-mono font-bold text-emerald-400 text-xs">
                      {hw.count} un.
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dimensions summary */}
            <div className="bg-[#191919] border border-[#2f2f2f] p-3 rounded-xl space-y-1.5 text-xs">
              <span className="font-bold text-gray-300 block mb-1">Cotas Finales del Mueble</span>
              <div className="flex justify-between text-gray-400 font-mono text-[11px]">
                <span>Ancho frontal (X):</span>
                <span className="text-white font-bold">{analysis.overallDimensions.width} mm</span>
              </div>
              <div className="flex justify-between text-gray-400 font-mono text-[11px]">
                <span>Altura total (Y):</span>
                <span className="text-white font-bold">{analysis.overallDimensions.height} mm</span>
              </div>
              <div className="flex justify-between text-gray-400 font-mono text-[11px]">
                <span>Profundidad (Z):</span>
                <span className="text-white font-bold">{analysis.overallDimensions.depth} mm</span>
              </div>
              <div className="flex justify-between text-gray-400 font-mono text-[11px] pt-1 border-t border-[#2a2a2a]">
                <span>Tiempo est. de armado:</span>
                <span className="text-amber-400 font-bold">~{analysis.estimatedAssemblyMinutes} minutos</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
