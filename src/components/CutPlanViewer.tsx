import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Piece, SheetConfig, EdgeConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { 
  Settings, BarChart3, Scissors, Layers, RotateCw, ZoomIn, ZoomOut, 
  Maximize2, Minimize2, LayoutList, Table, Rows, Grid, Search, ChevronUp, ChevronDown, 
  Check, Layers3, Sun, Moon, FlipHorizontal, Printer, Download, Eye, EyeOff, Hash, GripHorizontal
} from 'lucide-react';
import { buildMaterialReport } from '../lib/materialReport';

interface CutPlanViewerProps {
  pieces: Piece[];
  sheetConfig: SheetConfig;
  onUpdateSheetConfig: (config: SheetConfig) => void;
  selectedPieceIds: string[];
  toggleSelection: (id: string, multiSelect: boolean) => void;
  updatePiece: (id: string, updates: Partial<Piece>) => void;
  onConsolidatePieces?: () => void;
  setPieces?: React.Dispatch<React.SetStateAction<Piece[]>>;
}

export default function CutPlanViewer({ 
  pieces, 
  sheetConfig, 
  onUpdateSheetConfig, 
  selectedPieceIds, 
  toggleSelection, 
  updatePiece, 
  onConsolidatePieces,
  setPieces 
}: CutPlanViewerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'grid' | 'horizontal'>('vertical');
  const [selectedBoardFilter, setSelectedBoardFilter] = useState<number | 'all'>('all');
  const [pieceViewMode, setPieceViewMode] = useState<'table' | 'cards'>('cards');
  const [pieceSearch, setPieceSearch] = useState('');
  const [pieceListExpanded, setPieceListExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<'boards' | 'list' | 'both'>('boards');
  const [showMaterialReport, setShowMaterialReport] = useState(() => window.innerWidth >= 768);
  const [showViewOptions, setShowViewOptions] = useState(false);

  // Quantity to rotate map state per piece row
  const [rotateQtyMap, setRotateQtyMap] = useState<Record<string, number>>({});

  // Resizable & Collapsible Split View States (Req #2)
  const [listPanelHeight, setListPanelHeight] = useState<number>(260); // Default 260px
  const [isListCollapsed, setIsListCollapsed] = useState<boolean>(false);
  const [isDraggingList, setIsDraggingList] = useState<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(260);

  const handleListDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDraggingList(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartYRef.current = clientY;
    startHeightRef.current = listPanelHeight;
  };

  useEffect(() => {
    if (!isDraggingList) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaY = dragStartYRef.current - clientY;
      const newHeight = Math.max(44, Math.min(window.innerHeight - 150, startHeightRef.current + deltaY));
      
      if (newHeight <= 55) {
        setIsListCollapsed(true);
      } else {
        setIsListCollapsed(false);
        setListPanelHeight(newHeight);
      }
    };

    const handleEnd = () => {
      setIsDraggingList(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingList]);

  // Display Toggles matching Cutting Optimization Pro
  const [showPieceDims, setShowPieceDims] = useState(true);
  const [showWasteDims, setShowWasteDims] = useState(true);
  const [showPieceNames, setShowPieceNames] = useState(true);
  const [showEdgebandLines, setShowEdgebandLines] = useState(true); // Red/Blue borders
  const [showCutIndex, setShowCutIndex] = useState(false); // Cut order numbers
  const [showSheetRulers, setShowSheetRulers] = useState(true); // Outer sheet dimension lines (2420, 2120)
  const [cadTheme, setCadTheme] = useState<'light' | 'dark'>('light'); // Default light CAD style matching software screenshot
  const [isMirrored, setIsMirrored] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  const materialReport = useMemo(
    () => buildMaterialReport(pieces, sheetConfig),
    [pieces, sheetConfig],
  );
  const boardGroups = materialReport.groups;
  const totalStats = materialReport.totals;
  const unplacedPieces = materialReport.unplacedPieces;
  const edgebandingTotals = {
    thin: totalStats.thinEdgeM.toFixed(2),
    thick: totalStats.thickEdgeM.toFixed(2),
  };

  useEffect(() => {
    if (selectedBoardFilter !== 'all' && selectedBoardFilter >= totalStats.boardsCount) {
      setSelectedBoardFilter('all');
    }
  }, [selectedBoardFilter, totalStats.boardsCount]);

  const [viewScale, setViewScale] = useState(0.18);

  useEffect(() => {
    if (containerRef.current) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const isMobile = window.innerWidth < 640;
        const paddingW = isMobile ? 16 : 80;
        const paddingH = isMobile ? 16 : 80;
        
        const scaleW = (cw - paddingW) / sheetConfig.width;
        const scaleH = (ch - paddingH) / sheetConfig.height;
        
        let scale = layoutMode === 'vertical'
          ? Math.min(scaleW, isMobile ? 0.35 : 0.38)
          : Math.min(scaleW, scaleH);

        if (isMobile) {
          scale = Math.max(scaleW, 0.12);
        }

        setViewScale(scale > 0 ? scale : 0.18);
    }
  }, [sheetConfig.width, sheetConfig.height, layoutMode]);

  const groupedPieces = useMemo(() => {
    const groups: {
      key: string;
      ids: string[];
      totalQuantity: number;
      representative: Piece;
    }[] = [];

    pieces.forEach(p => {
      const key = `${Math.round(p.largo)}-${Math.round(p.ancho)}-${p.espesor || 18}-${p.cantos?.largo1}-${p.cantos?.largo2}-${p.cantos?.ancho1}-${p.cantos?.ancho2}-${p.material || ''}-${p.customColor || ''}`;
      const group = groups.find(g => g.key === key);
      if (group) {
        group.ids.push(p.id);
        group.totalQuantity += p.cantidad;
      } else {
        groups.push({
          key,
          ids: [p.id],
          totalQuantity: p.cantidad,
          representative: { ...p }
        });
      }
    });

    return groups;
  }, [pieces]);

  const filteredGroupedPieces = useMemo(() => {
    if (!pieceSearch.trim()) return groupedPieces;
    const term = pieceSearch.toLowerCase();
    return groupedPieces.filter(g => 
      g.representative.name.toLowerCase().includes(term) ||
      g.representative.largo.toString().includes(term) ||
      g.representative.ancho.toString().includes(term) ||
      (g.representative.material || '').toLowerCase().includes(term)
    );
  }, [groupedPieces, pieceSearch]);

  const currentScale = viewScale * zoom;

  // Handler for updating quantity cleanly across grouped piece records
  const handleQuantityUpdate = (group: { key: string; ids: string[]; totalQuantity: number; representative: Piece }, newQty: number) => {
    const val = Math.max(1, newQty);
    if (setPieces) {
      setPieces(prev => {
        const updated = prev.map(p => {
          if (p.id === group.ids[0]) {
            return { ...p, cantidad: val };
          }
          if (group.ids.slice(1).includes(p.id)) {
            return { ...p, cantidad: 0 };
          }
          return p;
        });
        return updated.filter(p => p.cantidad > 0);
      });
    } else {
      updatePiece(group.ids[0], { cantidad: val });
      group.ids.slice(1).forEach(id => updatePiece(id, { cantidad: 0 }));
    }
  };

  // Handler for rotating a specific count of pieces within a row/group
  const handleRotateGroup = (group: { key: string; ids: string[]; totalQuantity: number; representative: Piece }, qtyToRotate: number) => {
    const total = group.totalQuantity;
    const count = Math.min(Math.max(1, qtyToRotate), total);

    const oldPiece = group.representative;
    const newLargo = oldPiece.ancho;
    const newAncho = oldPiece.largo;
    const newCantos: EdgeConfig = {
      largo1: oldPiece.cantos?.ancho1 || 'Ninguno',
      largo2: oldPiece.cantos?.ancho2 || 'Ninguno',
      ancho1: oldPiece.cantos?.largo1 || 'Ninguno',
      ancho2: oldPiece.cantos?.largo2 || 'Ninguno',
    };

    if (count >= total) {
      // Rotate ALL pieces in this group
      group.ids.forEach(id => {
        updatePiece(id, {
          largo: newLargo,
          ancho: newAncho,
          cantos: newCantos
        });
      });
    } else if (setPieces) {
      setPieces(prev => {
        let remainingToRotate = count;
        const newPiecesList: Piece[] = [];
        const updatedList = prev.map(p => {
          if (!group.ids.includes(p.id) || remainingToRotate <= 0) return p;

          if (p.cantidad <= remainingToRotate) {
            remainingToRotate -= p.cantidad;
            return {
              ...p,
              largo: newLargo,
              ancho: newAncho,
              cantos: newCantos
            };
          } else {
            const countForThis = remainingToRotate;
            remainingToRotate = 0;
            newPiecesList.push({
              ...p,
              id: uuidv4(),
              cantidad: countForThis,
              largo: newLargo,
              ancho: newAncho,
              cantos: newCantos
            });
            return {
              ...p,
              cantidad: p.cantidad - countForThis
            };
          }
        });

        return [...updatedList, ...newPiecesList];
      });
    } else {
      const firstId = group.ids[0];
      const repPiece = pieces.find(p => p.id === firstId);
      if (repPiece) {
        if (repPiece.cantidad <= count) {
          updatePiece(firstId, {
            largo: newLargo,
            ancho: newAncho,
            cantos: newCantos
          });
        } else {
          updatePiece(firstId, { cantidad: repPiece.cantidad - count });
        }
      }
    }
  };

  // Sync scroll to piece in list when selected from graph
  useEffect(() => {
    if (selectedPieceIds.length > 0 && listRef.current) {
      const groupId = groupedPieces.find(g => g.ids.includes(selectedPieceIds[0]))?.key;
      if (groupId) {
        const el = listRef.current.querySelector(`[data-group-key="${groupId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  }, [selectedPieceIds, groupedPieces]);

  if (pieces.length === 0) {
    return (
      <div className="absolute inset-0 bg-[#16191d] flex items-center justify-center px-6">
        <div className="text-center group">
          <Layers className="w-10 h-10 text-[#f0a144]/35 mx-auto mb-4 group-hover:text-[#f0a144]/60 transition-colors" />
          <p className="text-[#eef2f6] font-semibold text-base">Todavía no hay piezas para cortar</p>
          <p className="text-[#89939f] text-sm mt-2">Vuelve a Diseño 3D y crea una pieza o abre la biblioteca de módulos.</p>
        </div>
      </div>
    );
  }

  const isLightCAD = cadTheme === 'light';

  return (
    <div className="absolute inset-0 bg-[#16191d] flex flex-col overflow-hidden w-full max-w-full font-sans">
      {/* Top Header */}
      <div className="h-12 sm:h-14 border-b border-white/10 bg-[#171a1f] flex items-center justify-between px-2 sm:px-4 shrink-0 relative z-20 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar py-1 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Scissors className="w-4 h-4 text-[#f0a144]" />
            <h2 className="text-[12px] sm:text-sm font-semibold text-white tracking-wide hidden sm:block">Corte 2D</h2>
          </div>
          
          {/* Mobile Main Tab Switcher */}
          <div className="flex sm:hidden items-center bg-[#111111] border border-[#f0a144]/40 p-0.5 rounded-lg shrink-0 shadow-inner">
            <button
              onClick={() => setMobileTab('boards')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[12px] font-bold uppercase transition-all ${mobileTab === 'boards' ? 'bg-[#f0a144] text-black shadow' : 'text-[#888888] hover:text-white'}`}
            >
              <Scissors className="w-3 h-3" />
              <span>Planchas</span>
            </button>
            <button
              onClick={() => setMobileTab('list')}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[12px] font-bold uppercase transition-all ${mobileTab === 'list' ? 'bg-[#f0a144] text-black shadow' : 'text-[#888888] hover:text-white'}`}
            >
              <Layers3 className="w-3 h-3" />
              <span>Piezas</span>
            </button>
            <button
              onClick={() => setMobileTab('both')}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[12px] font-bold uppercase transition-all ${mobileTab === 'both' ? 'bg-[#f0a144] text-black shadow' : 'text-[#888888] hover:text-white'}`}
              title="Ver Ambos en Pantalla Dividida"
            >
              <LayoutList className="w-3 h-3" />
            </button>
          </div>

          <div className="hidden sm:block h-4 w-px bg-white/10 mx-1 shrink-0"></div>

          <div className="hidden sm:flex gap-3 lg:gap-5 shrink-0 items-center">
            <div className="flex flex-col">
              <span className="text-[10px] text-[#7f8995] uppercase tracking-wider">Piezas</span>
              <span className="text-xs font-mono font-semibold text-white">{totalStats.piecesCount}</span>
            </div>
            <div className="hidden md:flex flex-col">
              <span className="text-[10px] text-[#7f8995] uppercase tracking-wider">Materiales</span>
              <span className="text-xs font-mono font-semibold text-white">{totalStats.materialGroups}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-[#7f8995] uppercase tracking-wider">Planchas</span>
              <span className="text-xs font-mono font-semibold text-white">{totalStats.boardsCount}</span>
            </div>
            <div className="hidden lg:flex flex-col">
              <span className="text-[10px] text-[#7f8995] uppercase tracking-wider">Rendimiento</span>
              <span className={`text-xs font-mono font-semibold ${totalStats.efficiency >= 80 ? 'text-emerald-400' : totalStats.efficiency >= 65 ? 'text-[#f0a144]' : 'text-rose-400'}`}>
                {totalStats.efficiency.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowMaterialReport(value => !value)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${showMaterialReport ? 'bg-[#f0a144]/15 border border-[#f0a144]/50 text-[#f7b766]' : 'bg-white/[0.03] border border-white/10 text-[#aab2bc] hover:text-white'}`}
            aria-expanded={showMaterialReport}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Materiales</span>
          </button>
          <button 
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors shrink-0 ${showSettings ? 'bg-[#f0a144] text-black' : 'bg-white/[0.03] border border-white/10 text-[#aab2bc] hover:text-white'}`}
          >
            <Settings className={`w-3.5 h-3.5 ${showSettings ? 'animate-spin-slow' : ''}`} />
            <span className="hidden xs:inline">Ajustes</span>
          </button>
        </div>
      </div>

      {unplacedPieces.length > 0 && (
        <div className="shrink-0 px-3 sm:px-4 py-2.5 bg-rose-950/45 border-b border-rose-500/30 text-rose-100 flex items-start gap-2.5 z-20" role="alert">
          <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-300 font-black text-xs shrink-0">!</div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold">{unplacedPieces.length} {unplacedPieces.length === 1 ? 'pieza no cabe' : 'piezas no caben'} en la plancha configurada</div>
            <div className="text-[13px] text-rose-200/75 truncate mt-0.5">{unplacedPieces.join(' · ')}</div>
          </div>
        </div>
      )}

      {showMaterialReport && (
        <section className="shrink-0 max-h-[42vh] overflow-auto bg-[#13161a] border-b border-white/10 px-3 sm:px-4 py-3" aria-label="Cálculo de materiales">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Cálculo de materiales</h3>
              <p className="text-[11px] text-[#7f8995] mt-0.5">Compra estimada según material, color y espesor.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowMaterialReport(false)}
              className="text-[11px] font-medium text-[#89939f] hover:text-white transition-colors"
            >
              Ocultar
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Área de piezas', value: `${totalStats.requiredAreaM2.toFixed(2)} m²` },
              { label: 'Área a comprar', value: `${totalStats.purchaseAreaM2.toFixed(2)} m²` },
              { label: 'Merma estimada', value: `${totalStats.wasteAreaM2.toFixed(2)} m²` },
              { label: 'Cantos', value: `${(totalStats.thinEdgeM + totalStats.thickEdgeM).toFixed(2)} m` },
            ].map(metric => (
              <div key={metric.label} className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-[#727d89]">{metric.label}</div>
                <div className="mt-0.5 text-sm font-mono font-semibold text-[#edf1f5]">{metric.value}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
            <table className="w-full min-w-[880px] text-left text-[11px]">
              <thead className="bg-white/[0.035] text-[#7f8995] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-medium">Material</th>
                  <th className="px-3 py-2 font-medium">Espesor</th>
                  <th className="px-3 py-2 font-medium">Formato</th>
                  <th className="px-3 py-2 font-medium text-right">Piezas</th>
                  <th className="px-3 py-2 font-medium text-right">Planchas</th>
                  <th className="px-3 py-2 font-medium text-right">Área piezas</th>
                  <th className="px-3 py-2 font-medium text-right">Área compra</th>
                  <th className="px-3 py-2 font-medium text-right">Merma</th>
                  <th className="px-3 py-2 font-medium text-right">Rendimiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-[#c9d0d8]">
                {boardGroups.map(group => (
                  <tr key={group.key} className="hover:bg-white/[0.025]">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-sm border border-white/20 shrink-0"
                          style={{ backgroundColor: group.color || '#e7e4dc' }}
                        />
                        <span className="font-medium text-white truncate max-w-[220px]">{group.material}</span>
                        {group.unplaced.length > 0 && (
                          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-300">Revisar</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono">{group.thickness} mm</td>
                    <td className="px-3 py-2.5 font-mono">{group.config.width} × {group.config.height} mm</td>
                    <td className="px-3 py-2.5 text-right font-mono">{group.piecesCount}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">{group.stats.boardsCount}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{group.requiredAreaM2.toFixed(2)} m²</td>
                    <td className="px-3 py-2.5 text-right font-mono">{group.purchaseAreaM2.toFixed(2)} m²</td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-300">{group.wasteAreaM2.toFixed(2)} m²</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold ${group.stats.efficiency >= 80 ? 'text-emerald-400' : group.stats.efficiency >= 65 ? 'text-[#f0a144]' : 'text-rose-400'}`}>
                      {group.stats.efficiency.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#7f8995]">
            <span>Canto delgado <strong className="ml-1 font-mono text-[#76a9ff]">{edgebandingTotals.thin} m</strong></span>
            <span>Canto grueso <strong className="ml-1 font-mono text-[#ff8181]">{edgebandingTotals.thick} m</strong></span>
            <span>Merma incluye cortes de sierra y refilado.</span>
          </div>
        </section>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Settings Overlay Backdrop */}
        {showSettings && (
          <div 
            className="absolute inset-0 bg-black/50 z-20 sm:hidden" 
            onClick={() => setShowSettings(false)}
          />
        )}
        
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#1e1e1e] relative">
          
          {/* BANDEJA SUPERIOR 1: NAVEGACIÓN DE PLANCHAS, DATOS Y ZOOM (REQ #1) */}
          <div className="bg-[#181818] border-b border-[#2a2a2a] px-2 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-md z-20">
            {/* Sheet Selector Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar py-0.5">
              <span className="text-[12px] font-bold text-[#888888] uppercase tracking-wider mr-1 hidden lg:inline">Planchas:</span>
              <button
                onClick={() => setSelectedBoardFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[12px] sm:text-[12px] font-bold uppercase transition-colors shrink-0 ${selectedBoardFilter === 'all' ? 'bg-[#f0a144] text-black shadow font-black' : 'bg-[#222222] text-[#888888] hover:text-white border border-[#333]'}`}
              >
                Todas ({totalStats.boardsCount})
              </button>
              {Array.from({ length: totalStats.boardsCount }).map((_, bIdx) => (
                <button
                  key={bIdx}
                  onClick={() => setSelectedBoardFilter(bIdx)}
                  className={`px-2 py-1 rounded-lg text-[12px] sm:text-[12px] font-mono font-bold uppercase transition-colors shrink-0 ${selectedBoardFilter === bIdx ? 'bg-[#f0a144] text-black shadow' : 'bg-[#222222] text-[#888888] hover:text-white border border-[#333]'}`}
                >
                  Plancha {bIdx + 1 < 10 ? '0' : ''}{bIdx + 1}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowViewOptions(value => !value)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors ${showViewOptions ? 'border-[#f0a144]/50 bg-[#f0a144]/10 text-[#f7b766]' : 'border-white/10 bg-white/[0.03] text-[#9aa4af] hover:text-white'}`}
                aria-expanded={showViewOptions}
              >
                <Eye className="w-3.5 h-3.5" />
                Vista
              </button>

              <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 p-0.5 rounded-lg">
                <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} className="p-1 rounded text-[#c7ced6] hover:bg-white/10 hover:text-white transition-colors" title="Aumentar zoom">
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.4))} className="p-1 rounded text-[#c7ced6] hover:bg-white/10 hover:text-white transition-colors" title="Reducir zoom">
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setZoom(1)} className="p-1 rounded text-[#c7ced6] hover:bg-white/10 hover:text-white transition-colors" title="Restablecer zoom">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {showViewOptions && (
          <div className="bg-[#15181c] border-b border-white/10 px-2 sm:px-4 py-2 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar shrink-0 z-10">
            <div className="flex items-center gap-3 sm:gap-4 shrink-0 text-[12px] font-mono text-[#cccccc] select-none">
              <div className="flex items-center bg-white/[0.03] border border-white/10 p-0.5 rounded-lg shrink-0">
                <button
                  onClick={() => setLayoutMode('vertical')}
                  className={`p-1.5 rounded transition-colors ${layoutMode === 'vertical' ? 'bg-[#f0a144] text-black' : 'text-[#89939f] hover:text-white'}`}
                  title="Planchas en vertical"
                >
                  <Rows className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`p-1.5 rounded transition-colors ${layoutMode === 'grid' ? 'bg-[#f0a144] text-black' : 'text-[#89939f] hover:text-white'}`}
                  title="Planchas en cuadrícula"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setLayoutMode('horizontal')}
                  className={`p-1.5 rounded transition-colors ${layoutMode === 'horizontal' ? 'bg-[#f0a144] text-black' : 'text-[#89939f] hover:text-white'}`}
                  title="Planchas en horizontal"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Checkbox: Show Piece Dimensions */}
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showPieceDims} 
                  onChange={(e) => setShowPieceDims(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[12px] sm:text-[12px] font-sans font-medium">Tamaño Piezas</span>
              </label>

              {/* Checkbox: Show Waste / Offcut Dimensions */}
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showWasteDims} 
                  onChange={(e) => setShowWasteDims(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[12px] sm:text-[12px] font-sans font-medium">Tamaño Desechos</span>
              </label>

              {/* Checkbox: Show Piece Labels/Names */}
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showPieceNames} 
                  onChange={(e) => setShowPieceNames(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[12px] sm:text-[12px] font-sans font-medium">Etiqueta / Nombre</span>
              </label>

              {/* Checkbox: Show Edgeband Lines */}
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showEdgebandLines} 
                  onChange={(e) => setShowEdgebandLines(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="flex items-center gap-1 text-[12px] sm:text-[12px] font-sans font-medium">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  Bandas de Bordes
                </span>
              </label>

              {/* Checkbox: Show Cut Sequence Index */}
              <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showCutIndex} 
                  onChange={(e) => setShowCutIndex(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[12px] sm:text-[12px] font-sans font-medium">Índice Corte</span>
              </label>

              {/* Checkbox: Show Sheet Outer Dimension Lines */}
              <label className="hidden md:flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={showSheetRulers} 
                  onChange={(e) => setShowSheetRulers(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[#f0a144] bg-[#222222] border-[#444444] cursor-pointer"
                />
                <span className="text-[12px] sm:text-[12px] font-sans font-medium">Cotas Plancha</span>
              </label>

            </div>

            {/* Right Action Icons & Theme Switcher */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Espejo (Mirror Layout Button) */}
              <button
                onClick={() => setIsMirrored(!isMirrored)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[12px] font-bold uppercase border transition-colors ${isMirrored ? 'bg-[#f0a144] text-black border-[#f0a144]' : 'bg-[#222222] text-[#aaa] border-[#333] hover:text-white'}`}
                title="Voltear horizontalmente (Modo Espejo)"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Espejo</span>
              </button>

              {/* Theme Toggle (Plano CAD Blanco vs Modo Oscuro) */}
              <button
                onClick={() => setCadTheme(isLightCAD ? 'dark' : 'light')}
                className="flex items-center gap-1 px-2 py-1 rounded text-[12px] font-bold uppercase bg-[#222222] border border-[#333333] text-[#aaaaaa] hover:text-white transition-colors"
                title={isLightCAD ? "Cambiar a Modo Oscuro" : "Cambiar a Plano Blanco CAD (Software Tradicional)"}
              >
                {isLightCAD ? (
                  <>
                    <Moon className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden xs:inline">Fondo Oscuro</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-[#f0a144]" />
                    <span className="hidden xs:inline">Plano Blanco</span>
                  </>
                )}
              </button>
            </div>
          </div>
          )}

          {/* Top Panel: Boards Graph Canvas (100% LIMPIO SIN BANDEJAS FLOTANTES SOBRE EL PLANO) */}
          <div className={`flex-1 overflow-auto p-2 sm:p-6 relative touch-pan-x touch-pan-y ${mobileTab === 'list' ? 'hidden sm:block' : 'block'}`} ref={containerRef}>
            {/* Boards Layout Container */}
            <div className="flex flex-col gap-8 sm:gap-12 w-full pb-12">
              {boardGroups.map((group, gIdx) => {
                let currentGlobalBoardOffset = 0;
                for (let prevG = 0; prevG < gIdx; prevG++) {
                  currentGlobalBoardOffset += boardGroups[prevG].boards.length;
                }

                return (
                  <div key={group.key} className="flex flex-col gap-4 sm:gap-6">
                    <div className="flex items-center justify-between gap-4 bg-[#1a1e23] px-3 sm:px-4 py-2.5 rounded-lg border border-white/[0.08]">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded border border-white/20 shrink-0"
                          style={{ backgroundColor: group.color || '#e7e4dc' }}
                        />
                        <div className="flex flex-col">
                          <span className="text-[12px] font-semibold text-white">
                            {group.material} · {group.thickness} mm
                          </span>
                          <span className="text-[11px] text-[#7f8995] font-mono">
                            {group.config.width} × {group.config.height} mm · {group.boards.length} {group.boards.length === 1 ? 'plancha' : 'planchas'} · {group.stats.efficiency.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="hidden md:flex items-center gap-3 text-[11px] font-mono text-[#89939f]">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
                          Delgado <strong className="text-[#d9e0e7]">{group.thinEdgeM.toFixed(2)} m</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-red-500 rounded-full inline-block"></span>
                          Grueso <strong className="text-[#d9e0e7]">{group.thickEdgeM.toFixed(2)} m</strong>
                        </span>
                      </div>
                    </div>

                    {/* Boards Render Grid/Flex */}
                    <div className={
                      layoutMode === 'vertical'
                        ? "flex flex-col gap-8 sm:gap-12 items-center sm:items-start w-full"
                        : layoutMode === 'grid'
                          ? "grid grid-cols-1 xl:grid-cols-2 gap-8 w-full"
                          : "flex items-start gap-8 w-max overflow-x-auto pb-4"
                    }>
                      {group.boards.map((board, idx) => {
                        const globalIndex = currentGlobalBoardOffset + idx;
                        if (selectedBoardFilter !== 'all' && selectedBoardFilter !== globalIndex) {
                          return null;
                        }

                        const boardWidth = group.config.width;
                        const boardHeight = group.config.height;

                        // Calculate SVG outer margin offset for rulers
                        const rulerOffset = showSheetRulers ? 24 : 0;
                        const svgWidth = (boardWidth * currentScale) + rulerOffset;
                        const svgHeight = (boardHeight * currentScale) + rulerOffset;

                        return (
                          <div 
                            key={idx} 
                            className="flex flex-col gap-2 animate-in fade-in duration-300 w-full max-w-full"
                          >
                            {/* Board Header Bar */}
                            <div className="flex items-center justify-between border-b border-[#333333] pb-1.5 px-1">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-md bg-[#f0a144] text-black font-black text-[12px] sm:text-[12px] uppercase tracking-wider shadow">
                                  Plancha {globalIndex + 1 < 10 ? '0' : ''}{globalIndex + 1}
                                </span>
                                <span className="text-[12px] sm:text-[12px] font-mono font-bold text-white">
                                  {boardWidth} x {boardHeight} mm
                                </span>
                              </div>

                              <div className="flex items-center gap-2 sm:gap-4 text-[11px] sm:text-[12px] font-mono">
                                <span className="text-[#a0a0a0]">
                                  Piezas: <strong className="text-white">{board.rects.length}</strong>
                                </span>
                                <span className="text-[#a0a0a0] border-l border-[#444444] pl-2">
                                  Aprovechamiento: <strong className={board.stats.efficiency > 85 ? 'text-emerald-400' : board.stats.efficiency > 70 ? 'text-[#f0a144]' : 'text-rose-400'}>{board.stats.efficiency.toFixed(1)}%</strong>
                                </span>
                                <span className="text-[#a0a0a0] border-l border-[#444444] pl-2 hidden xs:inline">
                                  Desecho: <strong className="text-rose-300">{(100 - board.stats.efficiency).toFixed(1)}%</strong>
                                </span>
                              </div>
                            </div>
                            
                            {/* Board SVG Container - Styled to match Cutting Optimization Pro */}
                            <div className={`overflow-auto max-w-full border-2 border-[#111111] rounded-lg p-2 sm:p-4 flex flex-col items-center touch-pan-x touch-pan-y shadow-2xl transition-colors ${isLightCAD ? 'bg-[#d8d8d8]' : 'bg-[#181818]'}`}>
                              
                              <div 
                                className={`relative shadow-2xl overflow-hidden shrink-0 border-2 ${isLightCAD ? 'border-black bg-white' : 'border-[#222222] bg-[#262626]'}`}
                                style={{ 
                                  width: svgWidth, 
                                  height: svgHeight,
                                  transform: isMirrored ? 'scaleX(-1)' : 'none'
                                }}
                              >
                                <svg 
                                  width={svgWidth} 
                                  height={svgHeight} 
                                  className="block transform-origin-top-left select-none"
                                >
                                  <defs>
                                    {/* Diagonal Hatch Pattern for Waste Areas (Desechos) */}
                                    <pattern 
                                      id={`diagonalHatch-${globalIndex}`} 
                                      patternUnits="userSpaceOnUse" 
                                      width="12" 
                                      height="12" 
                                      patternTransform="rotate(45)"
                                    >
                                      <line 
                                        x1="0" 
                                        y1="0" 
                                        x2="0" 
                                        y2="12" 
                                        stroke={isLightCAD ? "#888888" : "#555555"} 
                                        strokeWidth="1.5" 
                                        opacity="0.85" 
                                      />
                                    </pattern>
                                  </defs>

                                  {/* RULERS / SHEET COTAS */}
                                  {showSheetRulers && (
                                    <g className="sheet-rulers font-mono font-bold text-[12px]">
                                      {/* Top Dimension (Width) */}
                                      <line 
                                        x1={rulerOffset} 
                                        y1={12} 
                                        x2={rulerOffset + (boardWidth * currentScale)} 
                                        y2={12} 
                                        stroke={isLightCAD ? "#000000" : "#aaaaaa"} 
                                        strokeWidth="1" 
                                      />
                                      <line x1={rulerOffset} y1={6} x2={rulerOffset} y2={18} stroke={isLightCAD ? "#000" : "#aaa"} strokeWidth="1" />
                                      <line x1={rulerOffset + (boardWidth * currentScale)} y1={6} x2={rulerOffset + (boardWidth * currentScale)} y2={18} stroke={isLightCAD ? "#000" : "#aaa"} strokeWidth="1" />
                                      <text 
                                        x={rulerOffset + (boardWidth * currentScale) / 2} 
                                        y={10} 
                                        textAnchor="middle" 
                                        fill={isLightCAD ? "#000000" : "#ffffff"} 
                                        fontSize={10} 
                                        fontWeight="900"
                                      >
                                        {boardWidth}
                                      </text>

                                      {/* Left Dimension (Height) */}
                                      <line 
                                        x1={12} 
                                        y1={rulerOffset} 
                                        x2={12} 
                                        y2={rulerOffset + (boardHeight * currentScale)} 
                                        stroke={isLightCAD ? "#000000" : "#aaaaaa"} 
                                        strokeWidth="1" 
                                      />
                                      <line x1={6} y1={rulerOffset} x2={18} y2={rulerOffset} stroke={isLightCAD ? "#000" : "#aaa"} strokeWidth="1" />
                                      <line x1={6} y1={rulerOffset + (boardHeight * currentScale)} x2={18} y2={rulerOffset + (boardHeight * currentScale)} stroke={isLightCAD ? "#000" : "#aaa"} strokeWidth="1" />
                                      <text 
                                        x={10} 
                                        y={rulerOffset + (boardHeight * currentScale) / 2} 
                                        textAnchor="middle" 
                                        transform={`rotate(-90 10 ${rulerOffset + (boardHeight * currentScale) / 2})`}
                                        fill={isLightCAD ? "#000000" : "#ffffff"} 
                                        fontSize={10} 
                                        fontWeight="900"
                                      >
                                        {boardHeight}
                                      </text>
                                    </g>
                                  )}

                                  {/* Main Board Base Canvas */}
                                  <g transform={`translate(${rulerOffset}, ${rulerOffset})`}>
                                    
                                    {/* Main Sheet Outline */}
                                    <rect
                                      x={0}
                                      y={0}
                                      width={boardWidth * currentScale}
                                      height={boardHeight * currentScale}
                                      fill={isLightCAD ? "#ffffff" : "#222222"}
                                      stroke={isLightCAD ? "#000000" : "#444444"}
                                      strokeWidth={2}
                                    />

                                    {/* 1. RENDER WASTE AREAS (DESECHOS CON TRAMADO DIAGONAL) */}
                                    {board.wasteRects.map((w, wIdx) => {
                                      const wx = w.x * currentScale;
                                      const wy = w.y * currentScale;
                                      const ww = w.w * currentScale;
                                      const wh = w.h * currentScale;

                                      if (ww < 1 || wh < 1) return null;

                                      return (
                                        <g key={`waste-${wIdx}`}>
                                          {/* Hatch Fill */}
                                          <rect
                                            x={wx}
                                            y={wy}
                                            width={ww}
                                            height={wh}
                                            fill={`url(#diagonalHatch-${globalIndex})`}
                                            stroke={isLightCAD ? "#94a3b8" : "#444444"}
                                            strokeWidth={1}
                                            strokeDasharray={w.isMargin ? "3 3" : undefined}
                                          />

                                          {/* Waste Dimensions Label */}
                                          {showWasteDims && ww > 32 && wh > 18 && (
                                            <text
                                              x={wx + ww / 2}
                                              y={wy + wh / 2}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              fill={isLightCAD ? "#334155" : "#a1a1aa"}
                                              fontSize={Math.max(7, Math.min(11, ww * 0.18, wh * 0.3))}
                                              fontWeight="bold"
                                              fontFamily="monospace"
                                              className="pointer-events-none select-none"
                                            >
                                              {Math.round(w.w)}
                                            </text>
                                          )}
                                        </g>
                                      );
                                    })}

                                    {/* 2. RENDER USABLE CUT PIECES */}
                                    {board.rects.map((rect, rIdx) => {
                                      const isSelected = selectedPieceIds.includes(rect.id);
                                      
                                      const rectX = rect.x * currentScale;
                                      const rectY = rect.y * currentScale;
                                      const rectW = rect.w * currentScale;
                                      const rectH = rect.h * currentScale;

                                      const cx = rectX + rectW / 2;
                                      const cy = rectY + rectH / 2;

                                      // Font sizing calculations
                                      const nameFontSize = Math.max(8, Math.min(15, rectW * 0.22, rectH * 0.35));
                                      const dimFontSize = Math.max(7, Math.min(12, rectW * 0.18, rectH * 0.25));

                                      const showName = showPieceNames && rectW > 16 && rectH > 12;
                                      const showDims = showPieceDims && rectW > 28 && rectH > 20;

                                      // Determine cantos for 4 sides considering rotation
                                      // Normal: top=L1, bottom=L2, left=A1, right=A2
                                      // Rotated: top=A1, bottom=A2, left=L1, right=L2
                                      const topCanto = !rect.rotated ? rect.cantos.largo1 : rect.cantos.ancho1;
                                      const bottomCanto = !rect.rotated ? rect.cantos.largo2 : rect.cantos.ancho2;
                                      const leftCanto = !rect.rotated ? rect.cantos.ancho1 : rect.cantos.largo1;
                                      const rightCanto = !rect.rotated ? rect.cantos.ancho2 : rect.cantos.largo2;

                                      return (
                                        <g 
                                          key={`${rect.id}-${rIdx}`} 
                                          onClick={(e) => { e.stopPropagation(); toggleSelection(rect.id, e.shiftKey); }}
                                          className="group/rect transition-all duration-150 pointer-events-auto cursor-pointer"
                                        >
                                          {/* Main Piece Background Rectangle */}
                                          <rect
                                            x={rectX}
                                            y={rectY}
                                            width={rectW}
                                            height={rectH}
                                            fill={
                                              isSelected 
                                                ? (isLightCAD ? '#fff3e0' : '#f0a144') 
                                                : (isLightCAD ? '#ffffff' : '#383838')
                                            }
                                            stroke={
                                              isSelected 
                                                ? '#d97706' 
                                                : (isLightCAD ? '#000000' : '#111111')
                                            }
                                            strokeWidth={isSelected ? 2.5 : 1.5}
                                            className={isSelected ? '' : (isLightCAD ? 'hover:fill-[#fffbeb]' : 'hover:fill-[#4a4a4a]')}
                                          />

                                          {/* BANDAS DE BORDES (CANTOS HIGHLIGHT LINES - RED/BLUE BORDERS LIKE CUTTING OPTIMIZATION PRO) */}
                                          {showEdgebandLines && (
                                            <g className="edgeband-lines pointer-events-none">
                                              {/* Top Edge */}
                                              {topCanto !== 'Ninguno' && (
                                                <line 
                                                  x1={rectX} 
                                                  y1={rectY} 
                                                  x2={rectX + rectW} 
                                                  y2={rectY} 
                                                  stroke={topCanto === 'Canto Grueso' ? '#dc2626' : '#2563eb'} 
                                                  strokeWidth={topCanto === 'Canto Grueso' ? 3.5 : 2.5} 
                                                />
                                              )}
                                              {/* Bottom Edge */}
                                              {bottomCanto !== 'Ninguno' && (
                                                <line 
                                                  x1={rectX} 
                                                  y1={rectY + rectH} 
                                                  x2={rectX + rectW} 
                                                  y2={rectY + rectH} 
                                                  stroke={bottomCanto === 'Canto Grueso' ? '#dc2626' : '#2563eb'} 
                                                  strokeWidth={bottomCanto === 'Canto Grueso' ? 3.5 : 2.5} 
                                                />
                                              )}
                                              {/* Left Edge */}
                                              {leftCanto !== 'Ninguno' && (
                                                <line 
                                                  x1={rectX} 
                                                  y1={rectY} 
                                                  x2={rectX} 
                                                  y2={rectY + rectH} 
                                                  stroke={leftCanto === 'Canto Grueso' ? '#dc2626' : '#2563eb'} 
                                                  strokeWidth={leftCanto === 'Canto Grueso' ? 3.5 : 2.5} 
                                                />
                                              )}
                                              {/* Right Edge */}
                                              {rightCanto !== 'Ninguno' && (
                                                <line 
                                                  x1={rectX + rectW} 
                                                  y1={rectY} 
                                                  x2={rectX + rectW} 
                                                  y2={rectY + rectH} 
                                                  stroke={rightCanto === 'Canto Grueso' ? '#dc2626' : '#2563eb'} 
                                                  strokeWidth={rightCanto === 'Canto Grueso' ? 3.5 : 2.5} 
                                                />
                                              )}
                                            </g>
                                          )}

                                          {/* PIECE EDGE DIMENSIONS (TEXT ALONG EDGES LIKE SOFTWARE SCREENSHOT) */}
                                          {showDims && (
                                            <g className="piece-edge-dimensions pointer-events-none select-none font-mono font-black">
                                              {/* Top Horizontal Dimension */}
                                              <text
                                                x={cx}
                                                y={rectY + Math.min(12, rectH * 0.3)}
                                                textAnchor="middle"
                                                fill={isLightCAD ? '#000000' : '#ffffff'}
                                                fontSize={dimFontSize}
                                              >
                                                {Math.round(rect.w)}
                                              </text>

                                              {/* Left Vertical Dimension */}
                                              {rectH > 30 && (
                                                <text
                                                  x={rectX + Math.min(10, rectW * 0.3)}
                                                  y={cy}
                                                  textAnchor="middle"
                                                  transform={`rotate(-90 ${rectX + Math.min(10, rectW * 0.3)} ${cy})`}
                                                  fill={isLightCAD ? '#000000' : '#ffffff'}
                                                  fontSize={dimFontSize}
                                                >
                                                  {Math.round(rect.h)}
                                                </text>
                                              )}
                                            </g>
                                          )}

                                          {/* PIECE CENTER LABEL / NAME / ETIQUETA */}
                                          {showName && (
                                            <text
                                              x={cx}
                                              y={showDims ? cy + 2 : cy}
                                              textAnchor="middle"
                                              dominantBaseline="middle"
                                              fill={isSelected ? '#000000' : (isLightCAD ? '#000000' : '#ffffff')}
                                              fontSize={nameFontSize}
                                              className="font-black pointer-events-none select-none uppercase tracking-tight"
                                            >
                                              {rect.name}
                                            </text>
                                          )}

                                          {/* CUT SEQUENCE INDEX BADGE */}
                                          {showCutIndex && (
                                            <g className="pointer-events-none">
                                              <rect
                                                x={rectX + 2}
                                                y={rectY + 2}
                                                width={14}
                                                height={14}
                                                rx={3}
                                                fill="#f0a144"
                                              />
                                              <text
                                                x={rectX + 9}
                                                y={rectY + 10}
                                                textAnchor="middle"
                                                dominantBaseline="middle"
                                                fill="#000000"
                                                fontSize={8}
                                                fontWeight="900"
                                                fontFamily="monospace"
                                              >
                                                {rect.cutIndex}
                                              </text>
                                            </g>
                                          )}

                                          {/* ROTATION INDICATOR */}
                                          {rect.rotated && rectW > 18 && (
                                            <RotateCw 
                                              x={rectX + rectW - Math.min(12, rectW * 0.25)} 
                                              y={rectY + 2} 
                                              size={Math.min(10, rectW * 0.2)}
                                              className={`${isSelected ? 'text-black' : (isLightCAD ? 'text-[#444]' : 'text-[#a0a0a0]')} opacity-75 pointer-events-none`} 
                                            />
                                          )}
                                        </g>
                                      );
                                    })}

                                  </g>
                                </svg>
                              </div>

                              {/* Footer Description under 2D Board (Exact match to Cutting Optimization Pro footer) */}
                              <div className="mt-2 text-[12px] font-mono font-bold text-[#444444] dark:text-[#a0a0a0] flex items-center justify-center gap-2 bg-white dark:bg-[#222222] px-3 py-1 rounded border border-[#cccccc] dark:border-[#333333] shadow-sm select-none">
                                <span>Material = <strong className="text-black dark:text-white">{group.material} · {group.thickness} mm</strong></span>
                                <span>;</span>
                                <span>Etiqueta = <strong className="text-black dark:text-white">MELAMINA</strong></span>
                                <span>;</span>
                                <span>Cantidad = <strong className="text-black dark:text-white">1</strong></span>
                                <span>;</span>
                                <span>Aprovechamiento = <strong className="text-emerald-600 dark:text-emerald-400">{board.stats.efficiency.toFixed(1)}%</strong></span>
                              </div>

                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Panel: Resizable & Collapsible List of Pieces (REQ #2) */}
          <div 
            style={{ height: isListCollapsed ? '44px' : `${listPanelHeight}px` }}
            className={`border-t-2 border-[#1a1a1a] bg-[#222222] flex flex-col shrink-0 ${isDraggingList ? '' : 'transition-all duration-200'} shadow-2xl z-20 w-full max-w-full overflow-hidden box-border relative`}
          >
             {/* Barra de Arrastre Vertical (Draggable Split Handle) */}
             <div 
               onMouseDown={handleListDragStart}
               onTouchStart={handleListDragStart}
               className="w-full h-2 bg-[#181818] hover:bg-[#f0a144] active:bg-[#f0a144] cursor-ns-resize flex items-center justify-center transition-colors group shrink-0"
               title="Arrastrar arriba/abajo para ajustar el tamaño de las ventanas"
             >
               <GripHorizontal className="w-6 h-3 text-[#555] group-hover:text-black transition-colors" />
             </div>

             {/* List Header & Controls */}
             <div 
               className="h-10 border-b border-[#333333] bg-[#1a1a1a] flex items-center justify-between px-2 sm:px-4 shrink-0 shadow-sm select-none w-full max-w-full overflow-hidden gap-1 box-border"
             >
               <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 overflow-hidden">
                 <span className="text-[12px] sm:text-[13px] font-black text-white uppercase tracking-widest flex items-center gap-1 truncate">
                   <Layers3 className="w-3.5 h-3.5 text-[#f0a144] shrink-0" />
                   Listado de Piezas
                   <span className="bg-[#333333] text-[#f0a144] px-1.5 py-0.5 rounded text-[11px] sm:text-[12px] font-mono ml-0.5 shrink-0">
                     {groupedPieces.length} únicas ({pieces.reduce((a, b) => a + b.cantidad, 0)} total)
                   </span>
                 </span>

                 {onConsolidatePieces && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); onConsolidatePieces(); }}
                     className="hidden xs:flex items-center gap-1 px-2 py-0.5 bg-[#333333] hover:bg-[#444444] text-white text-[11px] font-bold uppercase rounded border border-[#555555] transition-colors shrink-0"
                     title="Agrupar piezas idénticas automáticamente"
                   >
                     Agrupar
                   </button>
                 )}
               </div>

               <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                 {/* Search Input */}
                 {(!isListCollapsed || mobileTab === 'list') && (
                   <div className="relative flex items-center bg-[#2a2a2a] border border-[#444444] rounded-lg px-1.5 py-0.5 shrink-0">
                     <Search className="w-3 h-3 text-[#888888] mr-1 shrink-0" />
                     <input 
                       type="text"
                       value={pieceSearch}
                       onChange={(e) => setPieceSearch(e.target.value)}
                       placeholder="Buscar..."
                       className="bg-transparent border-none outline-none text-[12px] text-white placeholder-[#777777] w-14 xs:w-20 sm:w-28 py-0.5 min-w-0"
                     />
                   </div>
                 )}

                 {/* View Mode Switcher (Tabla vs Tarjetas) */}
                 {(!isListCollapsed || mobileTab === 'list') && (
                   <div className="flex items-center bg-[#2a2a2a] border border-[#444444] p-0.5 rounded-lg">
                     <button 
                       onClick={() => setPieceViewMode('table')}
                       className={`p-1 rounded text-[12px] font-bold transition-colors ${pieceViewMode === 'table' ? 'bg-[#f0a144] text-black' : 'text-[#888888] hover:text-white'}`}
                       title="Modo Tabla de Datos"
                     >
                       <Table className="w-3.5 h-3.5" />
                     </button>
                     <button 
                       onClick={() => setPieceViewMode('cards')}
                       className={`p-1 rounded text-[12px] font-bold transition-colors ${pieceViewMode === 'cards' ? 'bg-[#f0a144] text-black' : 'text-[#888888] hover:text-white'}`}
                       title="Modo Tarjetas"
                     >
                       <Grid className="w-3.5 h-3.5" />
                     </button>
                   </div>
                 )}

                 {/* CONTROLES DE TAMAÑO / BAJAR VENTANA (REQ #2) */}
                 <div className="flex items-center bg-[#2a2a2a] border border-[#444444] p-0.5 rounded-lg gap-0.5">
                   {/* Botón Bajar / Minimizar Ventana */}
                   <button
                     onClick={() => setIsListCollapsed(!isListCollapsed)}
                     className={`flex items-center gap-1 px-1.5 py-1 rounded text-[12px] font-bold uppercase transition-colors ${isListCollapsed ? 'bg-[#f0a144] text-black shadow font-black' : 'text-[#aaa] hover:text-white hover:bg-[#333]'}`}
                     title={isListCollapsed ? "Ampliar Ventana" : "Bajar Ventana para ver más Plano de Corte"}
                   >
                     <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isListCollapsed ? 'rotate-180' : ''}`} />
                     <span className="hidden md:inline">{isListCollapsed ? 'Subir' : 'Bajar Ventana'}</span>
                   </button>

                   {/* Botón Acomodar (Media 260px) */}
                   <button
                     onClick={() => { setIsListCollapsed(false); setListPanelHeight(260); }}
                     className={`hidden sm:flex items-center gap-1 px-1.5 py-1 rounded text-[12px] font-bold uppercase transition-colors ${!isListCollapsed && listPanelHeight === 260 ? 'bg-[#333333] text-[#f0a144]' : 'text-[#888888] hover:text-white'}`}
                     title="Acomodar a tamaño mediano (260px)"
                   >
                     <Rows className="w-3.5 h-3.5" />
                     <span className="hidden lg:inline">Acomodar</span>
                   </button>

                   {/* Botón Ampliar (Grande 480px) */}
                   <button
                     onClick={() => { setIsListCollapsed(false); setListPanelHeight(480); }}
                     className={`hidden sm:flex items-center gap-1 px-1.5 py-1 rounded text-[12px] font-bold uppercase transition-colors ${!isListCollapsed && listPanelHeight >= 450 ? 'bg-[#333333] text-[#f0a144]' : 'text-[#888888] hover:text-white'}`}
                     title="Ampliar ventana listado de piezas (480px)"
                   >
                     <ChevronUp className="w-3.5 h-3.5" />
                     <span className="hidden lg:inline">Ampliar</span>
                   </button>
                 </div>
               </div>
             </div>
             
             {/* List Content Area */}
             <div className="flex-1 overflow-auto p-2 sm:p-3 bg-[#242424]" ref={listRef}>
               {pieceViewMode === 'table' ? (
                 /* TABLA DE PIEZAS HIGH-DENSITY */
                 <div className="w-full overflow-x-auto">
                   <table className="w-full text-left border-collapse font-sans text-[12px] min-w-[700px]">
                     <thead>
                       <tr className="border-b border-[#383838] bg-[#1a1a1a] text-[#a0a0a0] font-mono text-[12px] uppercase tracking-wider sticky top-0 z-10">
                         <th className="py-2 px-2.5">Cant.</th>
                         <th className="py-2 px-2.5">Nombre</th>
                         <th className="py-2 px-2.5">Largo X (mm)</th>
                         <th className="py-2 px-2.5">Ancho Y (mm)</th>
                         <th className="py-2 px-2.5">Espesor</th>
                         <th className="py-2 px-2.5">Cantos (L1 - L2 - A1 - A2)</th>
                         <th className="py-2 px-2.5 text-center">Rotar (Veta)</th>
                          <th className="py-2 px-2.5">Material</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-[#333333]">
                       {filteredGroupedPieces.map((group, idx) => {
                         const { representative: piece, totalQuantity, ids, key } = group;
                         const isSelected = ids.some(id => selectedPieceIds.includes(id));

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
                             className={`cursor-pointer transition-colors ${isSelected ? 'bg-[#f0a144]/20 border-l-4 border-l-[#f0a144]' : 'hover:bg-[#2d2d2d]'}`}
                           >
                             <td className="py-1.5 px-2.5">
                               <input 
                                 type="number"
                                 min="1"
                                 value={totalQuantity}
                                 onChange={(e) => {
                                   const val = parseInt(e.target.value) || 1;
                                   handleQuantityUpdate(group, val);
                                 }}
                                 onClick={(e) => e.stopPropagation()}
                                 className="w-12 bg-[#1a1a1a] border border-[#444444] rounded text-center text-white font-mono font-bold py-0.5 focus:border-[#f0a144] outline-none"
                                 title="Cantidad total de piezas"
                               />
                             </td>

                             <td className="py-1.5 px-2.5">
                               <input 
                                 type="text"
                                 value={piece.name}
                                 onChange={(e) => handleUpdate({ name: e.target.value })}
                                 onClick={(e) => e.stopPropagation()}
                                 className="bg-transparent border-b border-transparent focus:border-[#f0a144] outline-none text-white font-bold uppercase w-full truncate"
                                 placeholder={`Pieza ${idx + 1}`}
                               />
                             </td>

                             <td className="py-1.5 px-2.5">
                               <input 
                                 type="number"
                                 value={piece.largo === 0 ? '' : Math.round(piece.largo)}
                                 onChange={(e) => handleUpdate({ largo: parseFloat(e.target.value) || 0 })}
                                 onClick={(e) => e.stopPropagation()}
                                 className="w-16 bg-[#1a1a1a] border border-[#444444] rounded px-1.5 py-0.5 text-white font-mono font-bold text-center focus:border-[#f0a144] outline-none"
                               />
                             </td>

                             <td className="py-1.5 px-2.5">
                               <input 
                                 type="number"
                                 value={piece.ancho === 0 ? '' : Math.round(piece.ancho)}
                                 onChange={(e) => handleUpdate({ ancho: parseFloat(e.target.value) || 0 })}
                                 onClick={(e) => e.stopPropagation()}
                                 className="w-16 bg-[#1a1a1a] border border-[#444444] rounded px-1.5 py-0.5 text-white font-mono font-bold text-center focus:border-[#f0a144] outline-none"
                               />
                             </td>

                             <td className="py-1.5 px-2.5">
                               <span className="px-2 py-0.5 rounded bg-[#1a1a1a] border border-[#444444] text-[#f0a144] font-mono font-bold">
                                 {piece.espesor || 18} mm
                               </span>
                             </td>

                             {/* Cantos Breakdown Badges */}
                             <td className="py-1.5 px-2.5">
                               <div className="flex items-center gap-1">
                                 {(['largo1', 'largo2', 'ancho1', 'ancho2'] as const).map((edgeKey) => {
                                   const val = piece.cantos ? piece.cantos[edgeKey] : 'Ninguno';
                                   const isThick = val === 'Canto Grueso';
                                   const isThin = val === 'Canto Delgado';

                                   const toggleCanto = () => {
                                     const nextVal = val === 'Ninguno' ? 'Canto Delgado' : val === 'Canto Delgado' ? 'Canto Grueso' : 'Ninguno';
                                     handleUpdate({
                                       cantos: { ...piece.cantos, [edgeKey]: nextVal }
                                     });
                                   };

                                   return (
                                     <button 
                                       key={edgeKey} 
                                       onClick={(e) => { e.stopPropagation(); toggleCanto(); }}
                                       className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase transition-all ${
                                         isThick ? 'bg-red-950/90 border border-red-500 text-red-300' :
                                         isThin ? 'bg-blue-950/90 border border-blue-500 text-blue-300' :
                                         'bg-[#1a1a1a] border border-[#383838] text-[#777777] hover:text-white'
                                       }`}
                                       title={`${edgeKey.toUpperCase()}: Click para cambiar (${val})`}
                                     >
                                       {edgeKey.charAt(0).toUpperCase()}{edgeKey.slice(-1)}:{isThick ? 'G' : isThin ? 'D' : '-'}
                                     </button>
                                   );
                                 })}
                               </div>
                             </td>

                             {/* Rotate Control for Table Row */}
                             <td className="py-1.5 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                               <div className="flex items-center justify-center gap-1.5">
                                 {totalQuantity > 1 && (
                                   <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#444444] rounded px-1.5 py-0.5">
                                     <span className="text-[11px] text-[#888] font-mono uppercase">Cant:</span>
                                     <input 
                                       type="number"
                                       min="1"
                                       max={totalQuantity}
                                       value={rotateQtyMap[key] ?? totalQuantity}
                                       onChange={(e) => {
                                         const val = Math.min(totalQuantity, Math.max(1, parseInt(e.target.value) || 1));
                                         setRotateQtyMap(prev => ({ ...prev, [key]: val }));
                                       }}
                                       className="w-8 bg-transparent text-center text-white font-mono text-[12px] font-bold outline-none"
                                       title="Cantidad de piezas a rotar"
                                     />
                                     <span className="text-[11px] text-[#666] font-mono">/{totalQuantity}</span>
                                   </div>
                                 )}
                                 <button
                                   onClick={() => handleRotateGroup(group, rotateQtyMap[key] ?? totalQuantity)}
                                   className="px-2 py-0.5 rounded bg-[#333333] hover:bg-[#f0a144] hover:text-black text-white text-[12px] font-bold font-mono uppercase border border-[#555555] transition-colors flex items-center gap-1 shadow-sm shrink-0"
                                   title={`Rotar ${rotateQtyMap[key] && rotateQtyMap[key] < totalQuantity ? `${rotateQtyMap[key]} piezas` : 'todas las piezas'}`}
                                 >
                                   <RotateCw className="w-3 h-3 text-[#f0a144]" />
                                   <span>Rotar</span>
                                 </button>
                               </div>
                             </td>

                             <td className="py-1.5 px-2.5 text-[#aaaaaa] font-mono uppercase truncate max-w-[120px]">
                               {piece.material || 'Melamina'}
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               ) : (
                 /* MODO TARJETAS RESPONSIVE PARA MÓVIL */
                 <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 w-full max-w-full">
                   {filteredGroupedPieces.map((group, idx) => {
                     const { representative: piece, totalQuantity, ids, key } = group;
                     const isSelected = ids.some(id => selectedPieceIds.includes(id));
                     
                     const handleUpdate = (updates: Partial<Piece>) => {
                       ids.forEach(id => updatePiece(id, updates));
                     };

                     return (
                       <div 
                         key={key} 
                         data-group-key={key}
                         onClick={(e) => {
                           if (e.shiftKey) {
                             ids.forEach(id => toggleSelection(id, true));
                           } else {
                             toggleSelection(ids[0], false);
                           }
                         }}
                         className={`bg-[#1a1a1a] border rounded-xl p-2 sm:p-2.5 flex flex-col gap-1.5 sm:gap-2 cursor-pointer transition-all w-full max-w-full overflow-hidden ${isSelected ? 'border-[#f0a144] shadow-[0_0_15px_rgba(240,161,68,0.25)] ring-1 ring-[#f0a144]' : 'border-[#333333] hover:border-[#555555]'}`}
                       >
                         {/* Header: Quantity & Name */}
                         <div className="flex items-center justify-between gap-1 w-full min-w-0">
                             <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <div className="bg-[#333333] px-1.5 py-0.5 rounded text-[12px] font-mono text-[#f0a144] font-black shrink-0">
                                  {totalQuantity}x
                                </div>
                                <input 
                                  type="text"
                                  value={piece.name}
                                  onChange={(e) => handleUpdate({ name: e.target.value })}
                                  onClick={(e) => e.stopPropagation()}
                                  className="bg-transparent border-none outline-none text-[13px] font-black text-white focus:text-[#f0a144] min-w-0 w-full uppercase truncate"
                                  placeholder={`Pieza ${idx+1}`}
                                />
                             </div>
                             <div className="flex items-center gap-1 shrink-0">
                                <div className="bg-[#222222] border border-[#444444] px-1.5 py-0.5 rounded text-[12px] font-bold text-[#aaaaaa] font-mono">
                                  {piece.espesor || 18}mm
                                </div>
                             </div>
                         </div>

                         {/* Dimensions: Largo X and Ancho Y */}
                         <div className="flex gap-1.5 bg-[#222222] p-1.5 rounded-lg border border-[#333333] w-full min-w-0">
                           <div className="flex-1 min-w-0 flex flex-col">
                             <span className="text-[11px] text-[#888888] font-bold uppercase tracking-wider mb-0.5">LARGO (X)</span>
                             <input 
                               type="number"
                               value={piece.largo === 0 ? '' : Math.round(piece.largo)}
                               onChange={(e) => handleUpdate({ largo: parseFloat(e.target.value) || 0 })}
                               onClick={(e) => e.stopPropagation()}
                               className="w-full min-w-0 bg-[#1a1a1a] border border-[#444444] rounded text-[12px] sm:text-[13px] text-white font-mono font-bold px-1 py-1 text-center focus:border-[#f0a144] outline-none"
                             />
                           </div>

                           <div className="flex-1 min-w-0 flex flex-col">
                             <span className="text-[11px] text-[#888888] font-bold uppercase tracking-wider mb-0.5">ANCHO (Y)</span>
                             <input 
                               type="number"
                               value={piece.ancho === 0 ? '' : Math.round(piece.ancho)}
                               onChange={(e) => handleUpdate({ ancho: parseFloat(e.target.value) || 0 })}
                               onClick={(e) => e.stopPropagation()}
                               className="w-full min-w-0 bg-[#1a1a1a] border border-[#444444] rounded text-[12px] sm:text-[13px] text-white font-mono font-bold px-1 py-1 text-center focus:border-[#f0a144] outline-none"
                             />
                           </div>
                         </div>

                         {/* Interactive Cantos Badges */}
                         <div className="grid grid-cols-4 gap-0.5 sm:gap-1 pt-0.5 w-full min-w-0">
                            {(['largo1', 'largo2', 'ancho1', 'ancho2'] as const).map((edgeKey) => {
                              const val = piece.cantos ? piece.cantos[edgeKey] : 'Ninguno';
                              const isThick = val === 'Canto Grueso';
                              const isThin = val === 'Canto Delgado';

                              const toggleCanto = () => {
                                const nextVal = val === 'Ninguno' ? 'Canto Delgado' : val === 'Canto Delgado' ? 'Canto Grueso' : 'Ninguno';
                                handleUpdate({
                                  cantos: { ...piece.cantos, [edgeKey]: nextVal }
                                });
                              };

                              return (
                                <button 
                                  key={edgeKey}
                                  onClick={(e) => { e.stopPropagation(); toggleCanto(); }}
                                  className={`flex flex-col items-center justify-center py-1 px-0.5 rounded border transition-all min-w-0 w-full overflow-hidden ${
                                    isThick ? 'bg-red-950/90 border-red-500/80 text-red-300' :
                                    isThin ? 'bg-blue-950/90 border-blue-500/80 text-blue-300' :
                                    'bg-[#222222] border-[#333333] text-[#777777] hover:text-white'
                                  }`}
                                  title={`${edgeKey === 'largo1' ? 'L1' : edgeKey === 'largo2' ? 'L2' : edgeKey === 'ancho1' ? 'A1' : 'A2'}: Click para cambiar (${val})`}
                                >
                                  <span className="text-[11px] font-mono font-bold uppercase truncate w-full text-center leading-none mb-0.5">
                                    {edgeKey === 'largo1' ? 'L1' : edgeKey === 'largo2' ? 'L2' : edgeKey === 'ancho1' ? 'A1' : 'A2'}
                                  </span>
                                  <span className="text-[11px] font-mono font-semibold truncate w-full text-center leading-none">
                                    {isThick ? 'Grueso' : isThin ? 'Delgado' : 'Sin'}
                                  </span>
                                </button>
                              );
                            })}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* Sidebar Configuration */}
        {showSettings && (
          <div className="w-[280px] sm:w-80 shrink-0 border-l border-[#1a1a1a] bg-[#222222] p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 animate-in slide-in-from-right-full duration-300 absolute right-0 top-0 bottom-0 z-30 shadow-2xl sm:relative sm:shadow-none">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-white uppercase tracking-tighter">Parámetros</h3>
              <button type="button" onClick={() => setShowSettings(false)} className="text-[#aaaaaa] hover:text-white transition-colors">
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Formatos Rápidos</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => onUpdateSheetConfig({ ...sheetConfig, width: 2440, height: 2140 })}
                    className={`text-[11px] font-bold p-2 text-center rounded border transition-colors ${sheetConfig.width === 2440 && sheetConfig.height === 2140 ? 'bg-[#f0a144]/20 border-[#f0a144] text-white' : 'bg-[#1a1a1a] border-[#333333] text-[#aaaaaa] hover:bg-[#333333]'}`}
                  >
                    MELAMINA
                    <br/><span className="text-[#666666] font-mono text-[11px]">2440 x 2140 mm</span>
                  </button>
                  <button 
                    onClick={() => onUpdateSheetConfig({ ...sheetConfig, width: 2440, height: 1850 })}
                    className={`text-[11px] font-bold p-2 text-center rounded border transition-colors ${sheetConfig.width === 2440 && sheetConfig.height === 1850 ? 'bg-[#f0a144]/20 border-[#f0a144] text-white' : 'bg-[#1a1a1a] border-[#333333] text-[#aaaaaa] hover:bg-[#333333]'}`}
                  >
                    MDF / DUPROLAC
                    <br/><span className="text-[#666666] font-mono text-[11px]">2440 x 1850 mm</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Dimensión Plancha</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#1a1a1a] border border-[#333333] p-2 rounded">
                    <span className="text-[11px] text-[#666666] block mb-1">ANCHO (X)</span>
                    <input 
                      type="number" 
                      value={sheetConfig.width === 0 ? '' : sheetConfig.width} 
                      onChange={(e) => onUpdateSheetConfig({ ...sheetConfig, width: parseInt(e.target.value) || 0 })}
                      className="bg-transparent border-none outline-none text-white text-xs font-mono w-full"
                    />
                  </div>
                  <div className="bg-[#1a1a1a] border border-[#333333] p-2 rounded">
                    <span className="text-[11px] text-[#666666] block mb-1">LARGO (Y)</span>
                    <input 
                      type="number" 
                      value={sheetConfig.height === 0 ? '' : sheetConfig.height} 
                      onChange={(e) => onUpdateSheetConfig({ ...sheetConfig, height: parseInt(e.target.value) || 0 })}
                      className="bg-transparent border-none outline-none text-white text-xs font-mono w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Herramienta / Corte</label>
                <div className="bg-[#1a1a1a] border border-[#333333] p-2 rounded">
                  <span className="text-[11px] text-[#666666] block mb-1">ESPESOR SIERRA (MERMA)</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={sheetConfig.kerf === 0 ? '' : sheetConfig.kerf} 
                      step="0.5"
                      onChange={(e) => onUpdateSheetConfig({ ...sheetConfig, kerf: parseFloat(e.target.value) || 0 })}
                      className="bg-transparent border-none outline-none text-[#f0a144] text-xs font-mono w-full"
                    />
                    <span className="text-[12px] text-[#666666] font-mono">MM</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[12px] font-bold text-[#aaaaaa] uppercase tracking-widest block">Márgenes / Refilado</label>
                <div className="bg-[#1a1a1a] border border-[#333333] p-2 rounded">
                  <span className="text-[11px] text-[#666666] block mb-1">RECORTE PERIMETRAL</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={sheetConfig.margin === 0 ? '' : sheetConfig.margin} 
                      onChange={(e) => onUpdateSheetConfig({ ...sheetConfig, margin: parseInt(e.target.value) || 0 })}
                      className="bg-transparent border-none outline-none text-[#da3c3c] text-xs font-mono w-full"
                    />
                    <span className="text-[12px] text-[#666666] font-mono">MM</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-6 border-t border-[#1a1a1a]">
                <div className="bg-[#1a1a1a] border border-[#333333] rounded p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-3 h-3 text-[#f0a144]" />
                    <span className="text-[12px] font-bold text-[#aaaaaa] uppercase tracking-wider">Resumen de compra</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#666666] text-[12px]">PIEZAS TOTALES:</span>
                      <span className="text-white font-mono">{totalStats.piecesCount}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#666666] text-[12px]">MATERIALES:</span>
                      <span className="text-white font-mono">{totalStats.materialGroups}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#666666] text-[12px]">PLANCHAS:</span>
                      <span className="text-white font-mono">{totalStats.boardsCount}</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#666666] text-[12px]">ÁREA PIEZAS:</span>
                      <span className="text-white font-mono">{totalStats.requiredAreaM2.toFixed(2)} m²</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#666666] text-[12px]">ÁREA COMPRA:</span>
                      <span className="text-white font-mono">{totalStats.purchaseAreaM2.toFixed(2)} m²</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#666666] text-[12px]">MERMA:</span>
                      <span className="text-rose-300 font-mono">{totalStats.wasteAreaM2.toFixed(2)} m²</span>
                    </div>
                    <div className="h-px bg-[#333333] my-2" />
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#3b82f6] text-[11px] font-bold">CANTO DELGADO:</span>
                      <span className="text-[#3b82f6] font-mono font-bold">{edgebandingTotals.thin} m</span>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <span className="text-[#ef4444] text-[11px] font-bold">CANTO GRUESO:</span>
                      <span className="text-[#ef4444] font-mono font-bold">{edgebandingTotals.thick} m</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-auto">
              <button 
                type="button"
                onClick={() => window.print()}
                className="w-full bg-[#1a1a1a] hover:bg-[#333333] text-[#aaaaaa] hover:text-white border border-[#333333] py-3 rounded-lg flex items-center justify-center gap-2 text-[12px] font-bold uppercase transition-all shadow-xl"
              >
                Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
