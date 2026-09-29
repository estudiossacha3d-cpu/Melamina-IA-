import React from 'react';
import { SheetConfig } from '../types';
import { Check } from 'lucide-react';

export interface StockSheetsTableProps {
  sheetConfig: SheetConfig;
  onUpdateSheetConfig: (config: SheetConfig) => void;
  boardGroups: {
    thickness: number;
    boards: any[];
    stats: any;
    config: SheetConfig;
  }[];
  totalStats: {
    efficiency: number;
    areaUsed: number;
    totalArea: number;
    boardsCount: number;
  };
}

const COMMON_SHEET_PRESETS = [
  { name: 'Estándar 2440×2140', w: 2440, h: 2140, desc: 'Arauco / Pelikano' },
  { name: 'Formato 2440×1830', w: 2440, h: 1830, desc: 'Masisa / Faplac' },
  { name: 'Largo 2600×1830', w: 2600, h: 1830, desc: 'Puertas / Paneles' },
  { name: 'Extra 2750×1830', w: 2750, h: 1830, desc: 'Formato Europeo' },
  { name: 'Medio 2140×1220', w: 2140, h: 1220, desc: 'Media Plancha' },
];

export const StockSheetsTable: React.FC<StockSheetsTableProps> = ({
  sheetConfig,
  onUpdateSheetConfig,
  boardGroups,
  totalStats,
}) => {
  return (
    <div className="w-full select-none" data-no-canvas-zoom="true">
      {/* Quick Format Badges - Micro Typography */}
      <div className="px-1.5 py-0.5 bg-[#141414] border-b border-[#252525] flex items-center gap-1 overflow-x-auto no-scrollbar">
        <span className="text-[7.5px] font-mono text-[#666] uppercase tracking-wider shrink-0">FORMATOS:</span>
        {COMMON_SHEET_PRESETS.map((preset) => {
          const isActive = sheetConfig.width === preset.w && sheetConfig.height === preset.h;
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => onUpdateSheetConfig({ ...sheetConfig, width: preset.w, height: preset.h })}
              className={`px-1 py-0.2 rounded text-[7.5px] font-mono transition-colors shrink-0 flex items-center gap-0.5 ${
                isActive
                  ? 'bg-[#f0a144] text-black font-bold shadow-xs'
                  : 'bg-[#1e1e1e] hover:bg-[#262626] text-[#888] hover:text-white border border-[#2f2f2f]'
              }`}
              title={`${preset.name} (${preset.desc})`}
            >
              {isActive && <Check className="w-1.5 h-1.5 stroke-[3]" />}
              <span>{preset.w}×{preset.h}</span>
            </button>
          );
        })}
      </div>

      {/* Warehouse Sheets Table - Micro Compact */}
      <div className="w-full overflow-x-hidden">
        <table className="w-full text-left border-collapse font-sans text-[8.5px]">
          <thead className="bg-[#121212] text-[#777] font-mono text-[7.5px] uppercase tracking-wider sticky top-0 z-10 border-b border-[#292929]">
            <tr>
              <th className="py-0.5 px-1.5 text-left text-white">Material / Espesor</th>
              <th className="py-0.5 px-0.5 text-center w-10 text-white">Largo</th>
              <th className="py-0.5 px-0.5 text-center w-10 text-white">Ancho</th>
              <th className="py-0.5 px-0.5 text-center w-8 text-emerald-400" title="Planchas necesarias">Plzs</th>
              <th className="py-0.5 px-0.5 text-center w-8 text-blue-300" title="Refilado mm">Refile</th>
              <th className="py-0.5 px-0.5 text-center w-8 text-orange-300" title="Grosor corte sierra (Kerf)">Disco</th>
              <th className="py-0.5 px-1 text-center min-w-[65px] text-white">Aprovechamiento</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[#1e1e1e]">
            {boardGroups.map((bg, idx) => {
              const isMainGroup = idx === 0;
              const curConfig = isMainGroup ? sheetConfig : bg.config;
              const efficiency = bg.stats?.efficiency || 0;
              const code = (bg as any).code || (bg.thickness === 3 ? 'DUP03' : `MEL${bg.thickness}`);
              const displayName = (bg as any).displayName || (bg.thickness === 3 ? 'MDF 3mm' : `Melamina ${bg.thickness}mm`);
              const matColor = (bg as any).materialColor;

              return (
                <tr key={(bg as any).groupKey || `${bg.thickness}-${idx}`} className="bg-[#161616] hover:bg-[#1d1d1d] transition-colors">
                  {/* Material / Espesor */}
                  <td className="py-0.5 px-1.5">
                    <div className="flex items-center gap-1.5">
                      {matColor && (
                        <div 
                          className="w-2.5 h-2.5 rounded-full border border-black/50 shrink-0 shadow-xs" 
                          style={{ backgroundColor: matColor }}
                          title={displayName}
                        />
                      )}
                      <span className="font-mono text-[#f0a144] font-bold text-[8px]">
                        {code}
                      </span>
                      <span className="text-white font-medium text-[8px] uppercase truncate max-w-[130px]">
                        {displayName}
                      </span>
                    </div>
                  </td>

                  {/* Largo */}
                  <td className="py-0.5 px-0.5 text-center">
                    {isMainGroup ? (
                      <input
                        type="number"
                        value={sheetConfig.width}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 2440;
                          onUpdateSheetConfig({ ...sheetConfig, width: val });
                        }}
                        className="w-10 h-4.5 text-center bg-[#202020] hover:bg-[#262626] focus:bg-[#0e0e0e] focus:ring-1 focus:ring-[#f0a144] px-0.5 rounded text-white font-mono font-bold text-[8.5px] outline-none border border-[#2f2f2f]"
                        title="Longitud de plancha mm"
                      />
                    ) : (
                      <span className="font-mono text-[#aaa] text-[8.5px]">{curConfig.width}</span>
                    )}
                  </td>

                  {/* Ancho */}
                  <td className="py-0.5 px-0.5 text-center">
                    {isMainGroup ? (
                      <input
                        type="number"
                        value={sheetConfig.height}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 2140;
                          onUpdateSheetConfig({ ...sheetConfig, height: val });
                        }}
                        className="w-10 h-4.5 text-center bg-[#202020] hover:bg-[#262626] focus:bg-[#0e0e0e] focus:ring-1 focus:ring-[#f0a144] px-0.5 rounded text-white font-mono font-bold text-[8.5px] outline-none border border-[#2f2f2f]"
                        title="Ancho de plancha mm"
                      />
                    ) : (
                      <span className="font-mono text-[#aaa] text-[8.5px]">{curConfig.height}</span>
                    )}
                  </td>

                  {/* Planchas necesarias */}
                  <td className="py-0.5 px-0.5 text-center">
                    <span className="font-mono font-bold text-emerald-400 text-[9px]">
                      {bg.boards.length}
                    </span>
                  </td>

                  {/* Refilado */}
                  <td className="py-0.5 px-0.5 text-center">
                    {isMainGroup ? (
                      <input
                        type="number"
                        value={sheetConfig.margin}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          onUpdateSheetConfig({ ...sheetConfig, margin: val });
                        }}
                        className="w-7 h-4.5 text-center bg-[#202020] hover:bg-[#262626] focus:bg-[#0e0e0e] focus:ring-1 focus:ring-[#f0a144] px-0.5 rounded text-blue-300 font-mono font-bold text-[8.5px] outline-none border border-[#2f2f2f]"
                        title="Refilado perimetral mm"
                      />
                    ) : (
                      <span className="font-mono text-blue-300 text-[8.5px]">{curConfig.margin}</span>
                    )}
                  </td>

                  {/* Kerf */}
                  <td className="py-0.5 px-0.5 text-center">
                    {isMainGroup ? (
                      <input
                        type="number"
                        step="0.5"
                        value={sheetConfig.kerf}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          onUpdateSheetConfig({ ...sheetConfig, kerf: val });
                        }}
                        className="w-7 h-4.5 text-center bg-[#202020] hover:bg-[#262626] focus:bg-[#0e0e0e] focus:ring-1 focus:ring-[#f0a144] px-0.5 rounded text-orange-300 font-mono font-bold text-[8.5px] outline-none border border-[#2f2f2f]"
                        title="Grosor de corte de disco (Kerf) mm"
                      />
                    ) : (
                      <span className="font-mono text-orange-300 text-[8.5px]">{curConfig.kerf}</span>
                    )}
                  </td>

                  {/* Aprovechamiento */}
                  <td className="py-0.5 px-1 text-center font-mono">
                    <div className="flex items-center gap-1 justify-center">
                      <div className="w-8 bg-[#222] rounded-full h-1 overflow-hidden border border-[#303030]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            efficiency > 85 ? 'bg-emerald-500' : efficiency > 70 ? 'bg-[#f0a144]' : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, efficiency))}%` }}
                        />
                      </div>
                      <span
                        className={`text-[8px] font-bold ${
                          efficiency > 85 ? 'text-emerald-400' : efficiency > 70 ? 'text-[#f0a144]' : 'text-rose-400'
                        }`}
                      >
                        {efficiency.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
