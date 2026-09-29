import React from 'react';
import { BoardGroup } from './CutPlanViewer';
import { 
  X, Layers, Scissors, CheckCircle, Package, TrendingUp, 
  Printer, Copy, Sparkles, AlertCircle 
} from 'lucide-react';

export interface MaterialSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardGroups: BoardGroup[];
  totalStats: {
    efficiency: number;
    areaUsed: number;
    totalArea: number;
    boardsCount: number;
  };
}

export const MaterialSummaryModal: React.FC<MaterialSummaryModalProps> = ({
  isOpen,
  onClose,
  boardGroups,
  totalStats
}) => {
  if (!isOpen) return null;

  // Calculate overall edgebanding
  let totalEdgeThin = 0;
  let totalEdgeThick = 0;
  let totalPieces = 0;

  boardGroups.forEach(bg => {
    totalEdgeThin += bg.edgeThin;
    totalEdgeThick += bg.edgeThick;
    totalPieces += bg.piecesCount;
  });

  const handleCopySummary = () => {
    const lines = [
      '📋 RESUMEN DE MATERIALES - IA MUEBLE',
      '====================================',
      `Tableros Totales: ${totalStats.boardsCount}`,
      `Piezas de Corte: ${totalPieces}`,
      `Aprovechamiento Global: ${totalStats.efficiency.toFixed(1)}%`,
      `Área Útil: ${(totalStats.areaUsed / 1e6).toFixed(2)} m²`,
      `Área Total: ${(totalStats.totalArea / 1e6).toFixed(2)} m²`,
      '',
      '--- DESGLOSE POR MATERIAL ---'
    ];

    boardGroups.forEach(bg => {
      lines.push(
        `• ${bg.displayName}: ${bg.stats.boardsCount} tablero(s) (${bg.piecesCount} piezas) - Eficiencia: ${bg.stats.efficiency.toFixed(1)}%`
      );
      if (bg.edgeThin > 0) lines.push(`   - Canto Delgado: ${bg.edgeThin.toFixed(2)} m`);
      if (bg.edgeThick > 0) lines.push(`   - Canto Grueso: ${bg.edgeThick.toFixed(2)} m`);
    });

    lines.push('');
    lines.push('--- TOTAL TAPACANTOS ---');
    lines.push(`• Tapacanto Delgado: ${totalEdgeThin.toFixed(2)} m (+10% merma recomendada: ${(totalEdgeThin * 1.1).toFixed(2)} m)`);
    lines.push(`• Tapacanto Grueso: ${totalEdgeThick.toFixed(2)} m (+10% merma recomendada: ${(totalEdgeThick * 1.1).toFixed(2)} m)`);

    navigator.clipboard.writeText(lines.join('\n'));
    alert('¡Resumen copiado al portapapeles!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-[#18191f] border border-[#2b2d38] w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2b2d38] bg-[#14151a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Consolidado de Materiales
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-[#262833] text-gray-300">
                  {boardGroups.length} {boardGroups.length === 1 ? 'material' : 'materiales'}
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Cálculo de tableros enteros, tapacantos y metros cuadrados del proyecto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#20222a] border border-[#2d303d] flex flex-col">
              <span className="text-xs text-gray-400">Tableros Necesarios</span>
              <span className="text-2xl font-bold text-white mt-1">
                {totalStats.boardsCount}
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5">Placas completas</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#20222a] border border-[#2d303d] flex flex-col">
              <span className="text-xs text-gray-400">Piezas Cortadas</span>
              <span className="text-2xl font-bold text-sky-400 mt-1">
                {totalPieces}
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5">En todos los tableros</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#20222a] border border-[#2d303d] flex flex-col">
              <span className="text-xs text-gray-400">Aprovechamiento</span>
              <span className="text-2xl font-bold text-emerald-400 mt-1">
                {totalStats.efficiency.toFixed(1)}%
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5">Rendimiento global</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#20222a] border border-[#2d303d] flex flex-col">
              <span className="text-xs text-gray-400">Área Útil Cortada</span>
              <span className="text-2xl font-bold text-amber-400 mt-1">
                {(totalStats.areaUsed / 1e6).toFixed(2)} m²
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5">De {(totalStats.totalArea / 1e6).toFixed(2)} m² comprados</span>
            </div>
          </div>

          {/* Tableros por Material */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              Tableros por Tipo de Material
            </h3>
            <div className="space-y-2.5">
              {boardGroups.map((bg, idx) => (
                <div 
                  key={bg.groupKey || idx}
                  className="p-3.5 rounded-xl bg-[#1e2027] border border-[#2d303b] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-lg border border-white/20 shadow-inner flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: bg.materialColor }}
                    >
                      {bg.code}
                    </div>
                    <div>
                      <div className="font-semibold text-white text-sm">
                        {bg.displayName}
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                        <span>{bg.piecesCount} piezas</span>
                        <span>•</span>
                        <span>Dimensión placa: {bg.config.width} × {bg.config.height} mm</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Eficiencia</div>
                      <div className="text-sm font-semibold text-emerald-400">
                        {bg.stats.efficiency.toFixed(1)}%
                      </div>
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold text-sm">
                      {bg.stats.boardsCount} {bg.stats.boardsCount === 1 ? 'Tablero' : 'Tableros'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consolidado de Tapacantos */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-sky-400" />
              Consolidado de Tapacantos (Metros Lineales)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-[#1e2027] border border-[#2d303b]">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-300">Tapacanto Delgado (0.45mm)</span>
                  <span className="text-sm font-bold text-sky-400">{totalEdgeThin.toFixed(2)} m</span>
                </div>
                <div className="mt-2 text-[11px] text-gray-400 flex justify-between">
                  <span>Con 10% merma recomendada:</span>
                  <span className="text-gray-200 font-medium">{(totalEdgeThin * 1.1).toFixed(2)} m</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#1e2027] border border-[#2d303b]">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-gray-300">Tapacanto Grueso (3.0mm)</span>
                  <span className="text-sm font-bold text-amber-400">{totalEdgeThick.toFixed(2)} m</span>
                </div>
                <div className="mt-2 text-[11px] text-gray-400 flex justify-between">
                  <span>Con 10% merma recomendada:</span>
                  <span className="text-gray-200 font-medium">{(totalEdgeThick * 1.1).toFixed(2)} m</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#2b2d38] bg-[#14151a]">
          <button
            onClick={handleCopySummary}
            className="px-3.5 py-2 rounded-xl bg-[#242731] hover:bg-[#2e3240] text-gray-200 text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Copy className="w-4 h-4 text-gray-400" />
            Copiar Resumen
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
export default MaterialSummaryModal;
