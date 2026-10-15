import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Download, 
  Layers, 
  Wrench, 
  Ruler, 
  CheckCircle2, 
  Maximize2, 
  RotateCcw,
  Sparkles,
  FileText
} from 'lucide-react';
import { Piece } from '../types';
import { generateAssemblyPlan, AssemblyProjectAnalysis, AssemblyStep } from '../lib/assemblyPlanner';
import { Assembly3DCanvas } from './Assembly3DCanvas';
import { AssemblySidebar } from './AssemblySidebar';

interface AssemblyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  pieces: Piece[];
  projectName?: string;
}

export const AssemblyGuideModal: React.FC<AssemblyGuideModalProps> = ({
  isOpen,
  onClose,
  pieces,
  projectName = 'Mueble a Medida'
}) => {
  // Generate steps and hardware analysis
  const analysis: AssemblyProjectAnalysis = useMemo(() => {
    return generateAssemblyPlan(pieces);
  }, [pieces]);

  const [stepIndex, setStepIndex] = useState<number>(0);
  const [explodeRatio, setExplodeRatio] = useState<number>(0);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'steps' | 'hardware' | 'tools'>('steps');
  const [assembledPieceIds, setAssembledPieceIds] = useState<Set<string>>(new Set());

  // Current active step
  const currentStep: AssemblyStep | null = useMemo(() => {
    if (!analysis.steps || analysis.steps.length === 0) return null;
    return analysis.steps[Math.min(stepIndex, analysis.steps.length - 1)];
  }, [analysis.steps, stepIndex]);

  // When step changes, automatically mark previously completed steps' pieces as assembled
  useEffect(() => {
    if (analysis.steps.length === 0) return;
    const preassembled = new Set<string>();
    for (let i = 0; i <= stepIndex; i++) {
      analysis.steps[i]?.pieceIds.forEach(id => preassembled.add(id));
    }
    setAssembledPieceIds(preassembled);
  }, [stepIndex, analysis.steps]);

  // Toggle individual piece checkbox
  const handleTogglePieceAssembled = (pieceId: string) => {
    setAssembledPieceIds(prev => {
      const next = new Set(prev);
      if (next.has(pieceId)) {
        next.delete(pieceId);
      } else {
        next.add(pieceId);
      }
      return next;
    });
  };

  const handleNextStep = () => {
    if (stepIndex < analysis.steps.length - 1) {
      setStepIndex(stepIndex + 1);
    }
  };

  const handlePrevStep = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNextStep();
      } else if (e.key === 'ArrowLeft') {
        handlePrevStep();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stepIndex, analysis.steps.length]);

  // Print technical manual
  const handlePrintGuide = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-7xl h-[94vh] bg-[#1a1a1a] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border-b border-[#2d2d2d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Guía de Armado Técnico con Cotas 3D
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  {pieces.length} piezas
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                {projectName} • Medidas: {analysis.overallDimensions.width} × {analysis.overallDimensions.height} × {analysis.overallDimensions.depth} mm
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintGuide}
              className="px-3 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333] text-gray-200 text-xs font-medium border border-[#3a3a3a] transition-colors flex items-center gap-1.5 shadow-sm"
              title="Imprimir guía de armado para taller"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2a2a2a] transition-colors border border-transparent hover:border-[#383838]"
              title="Cerrar ventana de armado"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split 3D Viewport & Control Sidebar */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left Column: 3D Assembly Interactive Canvas */}
          <div className="flex-1 relative h-1/2 lg:h-full min-h-[300px]">
            <Assembly3DCanvas
              pieces={pieces}
              currentStep={currentStep}
              allSteps={analysis.steps}
              stepIndex={stepIndex}
              explodeRatio={explodeRatio}
              onExplodeChange={setExplodeRatio}
              showDimensions={showDimensions}
              onToggleDimensions={() => setShowDimensions(!showDimensions)}
              highlightedPieceId={highlightedPieceId}
              onSelectPiece={(id) => setHighlightedPieceId(id === highlightedPieceId ? null : id)}
              assembledPieceIds={assembledPieceIds}
            />
          </div>

          {/* Right Column: Steps, Checklist, Hardware, Tools Sidebar */}
          <div className="w-full lg:w-96 xl:w-[420px] h-1/2 lg:h-full min-h-0 shrink-0">
            <AssemblySidebar
              currentStep={currentStep}
              allSteps={analysis.steps}
              stepIndex={stepIndex}
              onSelectStep={setStepIndex}
              pieces={pieces}
              analysis={analysis}
              assembledPieceIds={assembledPieceIds}
              onTogglePieceAssembled={handleTogglePieceAssembled}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              highlightedPieceId={highlightedPieceId}
              onHighlightPiece={setHighlightedPieceId}
            />
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1e1e] border-t border-[#2d2d2d] shrink-0 text-xs">
          {/* Step Back button */}
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={handlePrevStep}
            className="px-3 py-1.5 rounded-lg bg-[#282828] hover:bg-[#333] disabled:opacity-40 disabled:hover:bg-[#282828] text-gray-200 border border-[#383838] transition-colors flex items-center gap-1.5 font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Paso Anterior</span>
          </button>

          {/* Center step slider & indicator */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono font-bold text-gray-300">
              Paso {stepIndex + 1} / {Math.max(1, analysis.steps.length)}
            </span>
            <div className="hidden sm:flex items-center gap-1.5">
              {analysis.steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStepIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === stepIndex 
                      ? 'bg-amber-400 scale-125' 
                      : i < stepIndex 
                        ? 'bg-emerald-500' 
                        : 'bg-[#3d3d3d] hover:bg-[#555]'
                  }`}
                  title={`Ir al Paso ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Step Next button */}
          <button
            type="button"
            disabled={stepIndex >= analysis.steps.length - 1}
            onClick={handleNextStep}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-amber-950/40"
          >
            <span>Siguiente Paso</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PRINT-ONLY TECHNICAL MANUAL TEMPLATE (hidden on screen, visible on print) */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 z-[9999] overflow-visible">
        <div className="border-b-2 border-black pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">Manual Técnico de Armado</h1>
              <p className="text-sm font-semibold text-gray-700">{projectName}</p>
            </div>
            <div className="text-right text-xs font-mono">
              <p>Dimensiones: {analysis.overallDimensions.width} × {analysis.overallDimensions.height} × {analysis.overallDimensions.depth} mm</p>
              <p>Total piezas: {pieces.length} | Tiempo est: ~{analysis.estimatedAssemblyMinutes} min</p>
            </div>
          </div>
        </div>

        {/* Tools and Hardware summary */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-gray-400 p-3 rounded">
            <h2 className="text-sm font-bold uppercase mb-2">Herramientas Requeridas</h2>
            <ul className="text-xs list-disc list-inside space-y-1">
              {analysis.allTools.map(t => (
                <li key={t.id}><strong>{t.name}</strong> - {t.description}</li>
              ))}
            </ul>
          </div>
          <div className="border border-gray-400 p-3 rounded">
            <h2 className="text-sm font-bold uppercase mb-2">Herrajes y Tornillería</h2>
            <ul className="text-xs space-y-1 font-mono">
              {analysis.allHardware.map(h => (
                <li key={h.id} className="flex justify-between">
                  <span>{h.name} ({h.spec}):</span>
                  <strong>{h.count} un.</strong>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sequenced steps list */}
        <div className="space-y-4">
          <h2 className="text-base font-black uppercase border-b border-gray-400 pb-1">Secuencia Paso a Paso</h2>
          {analysis.steps.map((st, i) => (
            <div key={st.id} className="border border-gray-300 p-3 rounded text-xs break-inside-avoid">
              <div className="flex justify-between font-bold mb-1">
                <span className="text-sm">{st.title}</span>
                <span className="font-mono text-gray-600">Paso {i + 1} de {analysis.steps.length}</span>
              </div>
              <p className="text-gray-800 mb-2">{st.description}</p>
              {st.dimensionNotes.length > 0 && (
                <div className="font-mono text-gray-700 text-[11px] mb-1">
                  Cotas clave: {st.dimensionNotes.map(d => `${d.label}: ${d.valueMm}mm`).join(' | ')}
                </div>
              )}
              <div className="text-[11px] text-gray-600 italic">
                Tips: {st.tips.join(' • ')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
