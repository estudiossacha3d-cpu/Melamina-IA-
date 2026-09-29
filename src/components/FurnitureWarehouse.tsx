import React, { useState, useMemo, useRef } from 'react';
import { 
  Package, Plus, Search, Trash2, Edit3, Copy, 
  Download, Upload, Layers, Box,
  PanelLeftClose, PanelLeftOpen, X, ArrowRight, Sparkles, CheckCircle2,
  Maximize2, Eye, LayoutGrid, List, Weight,
  ChevronLeft, ChevronRight, Filter,
  GripHorizontal, PanelRight, ChevronDown, ChevronUp, RotateCcw, FolderPlus, Check
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DynamicFurnitureItem, Piece, Group3D } from '../types';
import { DEFAULT_FURNITURE_CATEGORIES, DEFAULT_FURNITURE_CATALOG } from '../data/defaultFurniture';
import Warehouse3DPreview from './Warehouse3DPreview';
import { getFurnitureEffectivePieces, calculateFurnitureMetrics } from '../lib/furnitureHelpers';
import { useDraggableWindow } from '../hooks/useDraggableWindow';

interface FurnitureWarehouseProps {
  currentPieces: Piece[];
  groups?: Group3D[];
  selectedPieceIds?: string[];
  onLoadFurnitureTo3D: (furniture: DynamicFurnitureItem, mode?: 'replace' | 'insert') => void;
  onSaveCurrent3DAsFurniture?: (furnitureData: Partial<DynamicFurnitureItem>) => void;
  onClose?: () => void;
}

const STORAGE_KEY = 'ia_mueble_almacen_dinamico_v1';

export default function FurnitureWarehouse({
  currentPieces,
  groups = [],
  selectedPieceIds = [],
  onLoadFurnitureTo3D,
  onClose
}: FurnitureWarehouseProps) {
  // Interactive Floating Category Tray state
  const [isCategoryTrayOpen, setIsCategoryTrayOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1200;
    }
    return false;
  });
  const [isCategoryTrayCollapsed, setIsCategoryTrayCollapsed] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [categoryFilterQuery, setCategoryFilterQuery] = useState('');

  // Floating draggable category tray window
  const {
    position: trayPos,
    size: traySize,
    dragProps: trayDragProps,
    resetWindow: resetTrayWindow
  } = useDraggableWindow({
    storageKey: 'iamueble_category_tray_pos_v2',
    defaultPosition: () => ({
      x: typeof window !== 'undefined' ? (window.innerWidth < 640 ? 12 : Math.max(16, window.innerWidth - 310)) : 20,
      y: typeof window !== 'undefined' && window.innerWidth < 640 ? 115 : 120
    }),
    defaultSize: () => ({
      width: typeof window !== 'undefined' && window.innerWidth < 640 ? Math.min(window.innerWidth - 24, 290) : 280,
      height: 380
    }),
    minWidth: 220,
    minHeight: 180,
    maxWidth: 420,
    maxHeight: 620
  });

  // View Mode: 'grid' vs 'list'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Load furniture items from localStorage or fallback to default catalog
  const [catalog, setCatalog] = useState<DynamicFurnitureItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error loading furniture warehouse from storage:', e);
    }
    return DEFAULT_FURNITURE_CATALOG;
  });

  // Custom categories
  const [categories, setCategories] = useState<string[]>(() => {
    const defaultCats = [...DEFAULT_FURNITURE_CATEGORIES];
    catalog.forEach(item => {
      if (item.category && !defaultCats.includes(item.category)) {
        defaultCats.push(item.category);
      }
    });
    return defaultCats;
  });

  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'vol_desc' | 'vol_asc'>('recent');

  // Mobile & Category navigation
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const handleScrollCategories = (direction: 'left' | 'right') => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({
        left: direction === 'left' ? -180 : 180,
        behavior: 'smooth'
      });
    }
  };

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat);
    setIsCategoryModalOpen(false);
  };

  const handleAddNewCategory = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    if (!categories.includes(clean)) {
      setCategories(prev => [...prev, clean]);
      setSelectedCategory(clean);
      showToast(`Categoría "${clean}" creada y seleccionada`);
    } else {
      setSelectedCategory(clean);
      showToast(`Categoría "${clean}" seleccionada`);
    }
  };

  const handleDeleteCategory = (catName: string) => {
    if (DEFAULT_FURNITURE_CATEGORIES.includes(catName)) {
      showToast(`No se pueden eliminar las categorías base`);
      return;
    }
    const count = categoryCounts[catName] || 0;
    if (count > 0) {
      showToast(`Esta categoría contiene ${count} mueble(s)`);
      return;
    }
    setCategories(prev => prev.filter(c => c !== catName));
    if (selectedCategory === catName) {
      setSelectedCategory('Todas');
    }
    showToast(`Categoría "${catName}" eliminada`);
  };

  const filteredCategoryList = useMemo(() => {
    if (!categoryFilterQuery.trim()) return categories;
    const q = categoryFilterQuery.toLowerCase().trim();
    return categories.filter(c => c.toLowerCase().includes(q));
  }, [categories, categoryFilterQuery]);

  // Interactive 3D Inspector Modal
  const [inspectingFurniture, setInspectingFurniture] = useState<DynamicFurnitureItem | null>(null);
  const [inspectExplode, setInspectExplode] = useState<number>(0);
  const [inspectHighlightedPieceId, setInspectHighlightedPieceId] = useState<string | null>(null);

  // Creation / Editing Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DynamicFurnitureItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Save source selector: 'all' | 'group' | 'selected'
  const [saveSourceType, setSaveSourceType] = useState<'all' | 'group' | 'selected'>('all');
  const [selectedGroupIdForSave, setSelectedGroupIdForSave] = useState<string>(groups[0]?.id || '');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'Cocina',
    newCustomCategory: '',
    subcategory: '',
    description: '',
    width: 800,
    height: 750,
    depth: 550,
    thickness: 18,
    tags: '',
    notes: '',
    attachCurrent3D: true
  });

  const saveCatalog = (newCatalog: DynamicFurnitureItem[]) => {
    setCatalog(newCatalog);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newCatalog));
    } catch (err) {
      console.error('Error saving warehouse catalog to localStorage:', err);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3200);
  };

  const getPiecesToSaveFrom3D = () => {
    if (!formData.attachCurrent3D || currentPieces.length === 0) return [];
    if (saveSourceType === 'selected' && selectedPieceIds.length > 0) {
      return currentPieces.filter(p => selectedPieceIds.includes(p.id));
    }
    if (saveSourceType === 'group' && selectedGroupIdForSave) {
      return currentPieces.filter(p => p.groupId === selectedGroupIdForSave);
    }
    return currentPieces;
  };

  const handleOpenCreateModal = (fromCurrent3D = false) => {
    let estWidth = 800;
    let estHeight = 750;
    let estDepth = 550;
    let estThickness = 18;

    const sourcePieces = fromCurrent3D ? currentPieces : [];
    if (fromCurrent3D && sourcePieces.length > 0) {
      const maxLargo = Math.max(...sourcePieces.map(p => p.largo || 0));
      const maxAncho = Math.max(...sourcePieces.map(p => p.ancho || 0));
      estWidth = maxLargo || 800;
      estDepth = maxAncho || 550;
      estThickness = sourcePieces[0]?.espesor || 18;
    }

    setSaveSourceType(groups.length > 0 ? 'group' : selectedPieceIds.length > 0 ? 'selected' : 'all');
    if (groups.length > 0) setSelectedGroupIdForSave(groups[0].id);

    setFormData({
      name: fromCurrent3D ? (groups[0]?.name || 'Nuevo Mueble Modular') : '',
      category: selectedCategory !== 'Todas' ? selectedCategory : 'Cocina',
      newCustomCategory: '',
      subcategory: '',
      description: fromCurrent3D 
        ? `Mueble creado con ${sourcePieces.length} piezas diseñadas en el 3D Viewport.` 
        : '',
      width: estWidth,
      height: estHeight,
      depth: estDepth,
      thickness: estThickness,
      tags: fromCurrent3D ? 'diseño 3d, modular' : 'modular, melamina',
      notes: fromCurrent3D ? `Contiene ${sourcePieces.length} piezas exportadas del viewport.` : '',
      attachCurrent3D: fromCurrent3D
    });
    setEditingItem(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (item: DynamicFurnitureItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      newCustomCategory: '',
      subcategory: item.subcategory || '',
      description: item.description,
      width: item.dimensions.width,
      height: item.dimensions.height,
      depth: item.dimensions.depth,
      thickness: item.thickness || 18,
      tags: item.tags.join(', '),
      notes: item.notes || '',
      attachCurrent3D: false
    });
    setIsCreateModalOpen(true);
  };

  const handleSaveFurniture = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const finalCategory = formData.category === '__NEW__' 
      ? formData.newCustomCategory.trim() || 'General' 
      : formData.category;

    if (finalCategory && !categories.includes(finalCategory)) {
      setCategories(prev => [...prev, finalCategory]);
    }

    const tagsArray = formData.tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    if (editingItem) {
      const updatedList = catalog.map(item => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            name: formData.name.trim(),
            category: finalCategory,
            subcategory: formData.subcategory.trim() || undefined,
            description: formData.description.trim(),
            dimensions: {
              width: Number(formData.width) || 800,
              height: Number(formData.height) || 750,
              depth: Number(formData.depth) || 550
            },
            thickness: Number(formData.thickness) || 18,
            tags: tagsArray,
            notes: formData.notes.trim() || undefined,
            updatedAt: new Date().toISOString()
          };
        }
        return item;
      });
      saveCatalog(updatedList);
      showToast(`Mueble "${formData.name}" actualizado.`);
    } else {
      const piecesToSave: Piece[] = JSON.parse(JSON.stringify(getPiecesToSaveFrom3D()));

      const newItem: DynamicFurnitureItem = {
        id: `furn-${uuidv4().substring(0, 8)}`,
        name: formData.name.trim(),
        category: finalCategory,
        subcategory: formData.subcategory.trim() || undefined,
        description: formData.description.trim() || 'Mueble modular para carpintería.',
        dimensions: {
          width: Number(formData.width) || 800,
          height: Number(formData.height) || 750,
          depth: Number(formData.depth) || 550
        },
        thickness: Number(formData.thickness) || 18,
        tags: tagsArray.length > 0 ? tagsArray : ['melamina', 'mueble'],
        pieces: piecesToSave,
        status: piecesToSave.length > 0 ? 'has_3d' : 'ready_for_3d',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        notes: formData.notes.trim() || undefined,
        dynamicParameters: [
          { id: 'p_w', name: 'ancho', label: 'Ancho Total', type: 'dimension', defaultValue: Number(formData.width) || 800, unit: 'mm' },
          { id: 'p_h', name: 'alto', label: 'Alto Total', type: 'dimension', defaultValue: Number(formData.height) || 750, unit: 'mm' },
          { id: 'p_d', name: 'profundidad', label: 'Profundidad', type: 'dimension', defaultValue: Number(formData.depth) || 550, unit: 'mm' }
        ]
      };

      saveCatalog([newItem, ...catalog]);
      showToast(`Mueble "${newItem.name}" agregado al almacén.`);
    }

    setIsCreateModalOpen(false);
    setEditingItem(null);
  };

  const handleDeleteFurniture = (id: string) => {
    const updated = catalog.filter(f => f.id !== id);
    saveCatalog(updated);
    setDeleteConfirmId(null);
    if (inspectingFurniture?.id === id) {
      setInspectingFurniture(null);
    }
    showToast('Mueble eliminado del almacén.');
  };

  const handleDuplicate = (item: DynamicFurnitureItem) => {
    const duplicated: DynamicFurnitureItem = {
      ...item,
      id: `furn-${uuidv4().substring(0, 8)}`,
      name: `${item.name} (Copia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveCatalog([duplicated, ...catalog]);
    showToast(`Copia creada: "${duplicated.name}".`);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(catalog, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `almacen_muebles_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Almacén exportado en JSON.');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          saveCatalog(parsed);
          const newCats = [...DEFAULT_FURNITURE_CATEGORIES];
          parsed.forEach((item: DynamicFurnitureItem) => {
            if (item.category && !newCats.includes(item.category)) {
              newCats.push(item.category);
            }
          });
          setCategories(newCats);
          showToast(`¡${parsed.length} muebles importados!`);
        } else {
          showToast('El archivo no contiene un catálogo válido.');
        }
      } catch (err) {
        showToast('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filter & Sort
  const filteredItems = useMemo(() => {
    const list = catalog.filter(item => {
      const matchCat = selectedCategory === 'Todas' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;
      const matchSearch = 
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        (item.subcategory && item.subcategory.toLowerCase().includes(q)) ||
        item.tags.some(t => t.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });

    return list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'vol_desc') {
        const volA = a.dimensions.width * a.dimensions.height * a.dimensions.depth;
        const volB = b.dimensions.width * b.dimensions.height * b.dimensions.depth;
        return volB - volA;
      }
      if (sortBy === 'vol_asc') {
        const volA = a.dimensions.width * a.dimensions.height * a.dimensions.depth;
        const volB = b.dimensions.width * b.dimensions.height * b.dimensions.depth;
        return volA - volB;
      }
      return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
    });
  }, [catalog, selectedCategory, searchQuery, sortBy]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'Todas': catalog.length };
    catalog.forEach(item => {
      counts[item.category] = (counts[item.category] || 0) + 1;
    });
    return counts;
  }, [catalog]);

  return (
    <div className="flex-1 flex flex-col h-full w-full max-w-full bg-[#101116] text-gray-200 select-none overflow-hidden relative font-sans">
      {/* Toast Notification */}
      {notification && (
        <div className="absolute top-2 right-2 sm:right-6 z-50 bg-[#161822]/95 border border-[#f0a144]/70 text-white px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md text-xs font-bold flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#f0a144]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="h-11 sm:h-12 bg-[#151722] border-b border-[#232636] px-1.5 sm:px-4 flex items-center justify-between shrink-0 gap-1.5 sm:gap-2 w-full max-w-full min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#f0a144]/20 border border-[#f0a144]/40 flex items-center justify-center text-[#f0a144] shrink-0">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1 min-w-0 truncate">
            <h1 className="text-xs sm:text-sm font-black text-white tracking-wide truncate">
              ALMACÉN
            </h1>
            <span className="text-[9.5px] text-gray-400 font-mono shrink-0">
              ({catalog.length})
            </span>
          </div>
        </div>

        {/* Action Controls - Guaranteed to never clip on any phone */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Save Current 3D Button */}
          {currentPieces.length > 0 && (
            <button
              type="button"
              onClick={() => handleOpenCreateModal(true)}
              className="flex items-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1.5 bg-[#f0a144] hover:bg-[#ffba66] text-black rounded-lg text-[10px] sm:text-xs font-black shadow-xs transition-all cursor-pointer shrink-0"
              title="Guardar piezas o grupos 3D actuales en el almacén"
            >
              <Sparkles className="w-3 h-3 text-black shrink-0" />
              <span>+ 3D</span>
            </button>
          )}

          {/* Add New Furniture Button */}
          <button
            type="button"
            onClick={() => handleOpenCreateModal(false)}
            className="flex items-center gap-1 px-1.5 py-1 sm:px-2.5 sm:py-1.5 bg-[#222533] hover:bg-[#2c3042] text-white border border-[#35394e] rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer shrink-0"
            title="Crear nuevo mueble"
          >
            <Plus className="w-3 h-3 text-[#f0a144] shrink-0" />
            <span className="hidden sm:inline">Nuevo</span>
          </button>

          {/* Tools */}
          <div className="flex items-center gap-0.5 bg-[#1b1c26] p-0.5 rounded-lg border border-[#2b2e3d] shrink-0">
            <label 
              className="p-1 hover:bg-[#292c3b] text-gray-400 hover:text-white rounded cursor-pointer transition-colors flex items-center justify-center"
              title="Importar catálogo JSON"
            >
              <Upload className="w-3 h-3" />
              <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
            </label>
            <button
              type="button"
              onClick={handleExportJSON}
              className="p-1 hover:bg-[#292c3b] text-gray-400 hover:text-white rounded cursor-pointer transition-colors flex items-center justify-center"
              title="Exportar catálogo JSON"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 sm:p-1.5 bg-[#222533] hover:bg-[#2c3042] text-gray-300 hover:text-white rounded-lg border border-[#35394e] transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Cerrar almacén y volver al 3D"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-200" />
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 flex flex-col overflow-hidden relative w-full max-w-full min-w-0 bg-[#0d0e12]">
        
        {/* Top Controls: Search, Sort, View Mode & Quick Bandeja Toggle */}
        <div className="p-1.5 sm:p-2 border-b border-[#1f2230] flex items-center justify-between gap-1.5 sm:gap-2 bg-[#14161f] shrink-0 w-full max-w-full min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
            {/* Quick Bandeja Toggle Button */}
            <button
              type="button"
              onClick={() => {
                setIsCategoryTrayOpen(prev => !prev);
                setIsCategoryTrayCollapsed(false);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-black border transition-all cursor-pointer shrink-0 shadow-xs ${
                isCategoryTrayOpen
                  ? 'bg-[#f0a144] text-black border-[#f0a144] shadow-md shadow-[#f0a144]/20'
                  : 'bg-[#1b1c26] text-gray-300 hover:text-white hover:bg-[#252838] border-[#2f3346]'
              }`}
              title={isCategoryTrayOpen ? 'Ocultar bandeja flotante de categorías' : 'Abrir bandeja flotante interactiva de categorías'}
            >
              <PanelRight className={`w-3.5 h-3.5 ${isCategoryTrayOpen ? 'text-black' : 'text-[#f0a144]'}`} />
              <span>Bandeja</span>
              <span className={`text-[8.5px] px-1 rounded-full font-mono font-bold ${
                isCategoryTrayOpen ? 'bg-black/20 text-black' : 'bg-[#f0a144]/20 text-[#f0a144]'
              }`}>
                {categories.length}
              </span>
            </button>

            {/* Search Input */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar en ${selectedCategory}...`}
                className="w-full bg-[#0d0e12] border border-[#272a38] rounded-lg pl-7 pr-6 py-1 text-[11px] sm:text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#f0a144]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Sorter and View Mode */}
          <div className="flex items-center gap-1 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#1b1c26] border border-[#2b2e3d] text-gray-300 rounded-lg px-1 sm:px-1.5 py-1 text-[9.5px] sm:text-[10.5px] font-bold outline-none cursor-pointer"
            >
              <option value="recent">Recientes</option>
              <option value="name">A-Z</option>
              <option value="vol_desc">Mayor</option>
              <option value="vol_asc">Menor</option>
            </select>

            <div className="flex items-center bg-[#0d0e12] border border-[#252838] p-0.5 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#f0a144] text-black font-black' : 'text-gray-400 hover:text-white'
                }`}
                title="Cuadrícula 3D"
              >
                <LayoutGrid className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-[#f0a144] text-black font-black' : 'text-gray-400 hover:text-white'
                }`}
                title="Lista técnica"
              >
                <List className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Floating Category Bar */}
        <div className="bg-[#14161f]/95 border-b border-[#212433] px-1.5 sm:px-2 py-1 shrink-0 w-full max-w-full flex items-center gap-1 shadow-sm">
          {/* Quick Filter Modal Button */}
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg bg-[#1f2231] hover:bg-[#282c3f] text-[#f0a144] border border-[#2c3146] text-[10px] sm:text-[10.5px] font-black shrink-0 cursor-pointer shadow-xs transition-colors"
            title="Abrir resumen de categorías"
          >
            <Filter className="w-3 h-3 text-[#f0a144]" />
            <span className="hidden xs:inline">Todas</span>
            <span className="text-[9px] bg-[#f0a144]/20 text-[#f0a144] px-1 rounded-full font-mono">
              {categories.length}
            </span>
          </button>

          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={() => handleScrollCategories('left')}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#20222f] rounded-lg shrink-0 cursor-pointer flex items-center justify-center transition-colors"
            title="Desplazar categorías a la izquierda"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Scrollable Categories Strip */}
          <div 
            ref={categoryScrollRef}
            className="flex items-center gap-1 px-0.5 overflow-x-auto touch-pan-x scroll-smooth no-scrollbar flex-1 w-full min-w-0"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] || 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleSelectCategory(cat)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] sm:text-[10.5px] font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-[#f0a144] text-black font-black shadow-xs scale-102'
                      : 'bg-[#1b1c26] text-gray-300 hover:bg-[#242735] hover:text-white border border-[#262837]'
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[8.5px] font-mono px-1 rounded ${
                    isSelected ? 'bg-black/20 text-black font-black' : 'text-gray-400 bg-[#111219]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={() => handleScrollCategories('right')}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#20222f] rounded-lg shrink-0 cursor-pointer flex items-center justify-center transition-colors"
            title="Desplazar categorías a la derecha"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Add Category Quick Trigger */}
          <button
            type="button"
            onClick={() => {
              setIsCategoryTrayOpen(true);
              setIsCategoryTrayCollapsed(false);
            }}
            className="flex items-center gap-1 px-1.5 py-1 bg-[#1e212f] hover:bg-[#272c3d] text-[#f0a144] border border-[#2c3246] rounded-lg text-[10px] font-bold shrink-0 cursor-pointer transition-colors"
            title="Añadir nueva categoría en la bandeja"
          >
            <Plus className="w-3 h-3 text-[#f0a144]" />
            <span className="hidden sm:inline">Nueva</span>
          </button>
        </div>

        {/* Floating Interactive Draggable Category Tray */}
        {isCategoryTrayOpen && (
          <div
            className="fixed z-40 pointer-events-auto select-none"
            style={{ left: `${trayPos.x}px`, top: `${trayPos.y}px` }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="bg-[#141620]/95 backdrop-blur-md border border-[#2e3347] rounded-xl sm:rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-gray-200 relative group animate-in fade-in zoom-in-95 duration-150"
              style={{
                width: `${traySize.width}px`,
                height: isCategoryTrayCollapsed ? 'auto' : `${traySize.height}px`,
                maxWidth: 'calc(100vw - 16px)'
              }}
            >
              {/* Tray Header (Draggable handle) */}
              <div
                className="h-8 bg-[#101117] border-b border-[#222535] flex items-center justify-between px-2 sm:px-2.5 shrink-0 select-none cursor-grab active:cursor-grabbing"
                {...trayDragProps}
                title="Arrastrar bandeja de categorías"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <GripHorizontal className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                  <Layers className="w-3.5 h-3.5 text-[#f0a144] shrink-0" />
                  <span className="text-[10px] sm:text-[10.5px] font-black uppercase text-white tracking-wider truncate">
                    Bandeja Categorías
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[7.5px] text-[#10b981] font-bold bg-[#10b981]/15 px-1 py-0.2 rounded border border-[#10b981]/30">
                    {categories.length} CATS
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCategoryTrayCollapsed(prev => !prev)}
                    className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                    title={isCategoryTrayCollapsed ? 'Expandir bandeja' : 'Minimizar bandeja'}
                  >
                    {isCategoryTrayCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={resetTrayWindow}
                    className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer hidden sm:block"
                    title="Restablecer posición de la bandeja"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCategoryTrayOpen(false)}
                    className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                    title="Cerrar bandeja"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tray Body */}
              {!isCategoryTrayCollapsed && (
                <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0f15]">
                  {/* Quick Inline Add Category Form */}
                  <div className="p-2 border-b border-[#202434] bg-[#12141c] shrink-0 space-y-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newCategoryInput}
                        onChange={e => setNewCategoryInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleAddNewCategory(newCategoryInput);
                            setNewCategoryInput('');
                          }
                        }}
                        placeholder="Nueva categoría..."
                        className="flex-1 min-w-0 bg-[#0c0d12] border border-[#272b3c] rounded-lg px-2 py-1 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-[#f0a144]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          handleAddNewCategory(newCategoryInput);
                          setNewCategoryInput('');
                        }}
                        disabled={!newCategoryInput.trim()}
                        className="flex items-center gap-0.5 px-2 py-1 bg-[#f0a144] hover:bg-[#ffba66] disabled:opacity-40 text-black text-[10.5px] font-black rounded-lg cursor-pointer transition-all shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Crear</span>
                      </button>
                    </div>

                    {/* Filter categories input if more than 5 */}
                    {categories.length > 5 && (
                      <div className="relative">
                        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                          type="text"
                          value={categoryFilterQuery}
                          onChange={e => setCategoryFilterQuery(e.target.value)}
                          placeholder="Filtrar categorías..."
                          className="w-full bg-[#0a0b0f] border border-[#202330] rounded-lg pl-6 pr-5 py-0.5 text-[10px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#f0a144]/60"
                        />
                        {categoryFilterQuery && (
                          <button
                            type="button"
                            onClick={() => setCategoryFilterQuery('')}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Categories List */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1 [scrollbar-width:thin]">
                    {filteredCategoryList.map((cat) => {
                      const isSelected = selectedCategory === cat;
                      const count = categoryCounts[cat] || 0;
                      const isBase = DEFAULT_FURNITURE_CATEGORIES.includes(cat);
                      return (
                        <div
                          key={cat}
                          onClick={() => handleSelectCategory(cat)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer group ${
                            isSelected
                              ? 'bg-[#f0a144]/20 text-[#f0a144] border border-[#f0a144]/50 shadow-xs'
                              : 'text-gray-300 hover:bg-[#181a24] hover:text-white border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-[#f0a144]' : 'bg-gray-600'}`} />
                            <span className="truncate text-[11px] sm:text-xs">{cat}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                              isSelected ? 'bg-[#f0a144]/20 text-[#f0a144]' : 'bg-[#13141b] text-gray-500'
                            }`}>
                              {count}
                            </span>
                            {!isBase && count === 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCategory(cat);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-opacity"
                                title={`Eliminar categoría vacía "${cat}"`}
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tray Footer */}
                  <div className="h-7 bg-[#101218] border-t border-[#1f2230] px-2.5 flex items-center justify-between text-[9px] text-gray-400 shrink-0">
                    <span className="font-mono">
                      {filteredCategoryList.length} de {categories.length} categorías
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectCategory('Todas')}
                      className={`font-bold transition-colors cursor-pointer ${
                        selectedCategory === 'Todas' ? 'text-[#f0a144]' : 'hover:text-white'
                      }`}
                    >
                      Ver Todas ({catalog.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

          {/* Showcase Area: Fully Responsive Cards Grid or Technical List */}
          <div className="flex-1 p-2 sm:p-3 overflow-y-auto w-full max-w-full overflow-x-hidden">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="w-12 h-12 rounded-xl bg-[#1b1c26] border border-[#2b2e3d] flex items-center justify-center text-gray-500 mb-2">
                  <Package className="w-6 h-6 opacity-40 text-[#f0a144]" />
                </div>
                <h3 className="text-xs font-bold text-gray-300 mb-1">No se encontraron muebles</h3>
                <p className="text-[11px] text-gray-500 max-w-xs mb-3">
                  No hay modelos para "{searchQuery}" en {selectedCategory}.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenCreateModal(false)}
                  className="px-3.5 py-1.5 bg-[#f0a144] hover:bg-[#ffba66] text-black font-black rounded-lg text-xs cursor-pointer"
                >
                  + Crear Mueble
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* RESPONSIVE CARDS (Clean vertical orientation so width fits 100% of any phone) */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3.5 w-full max-w-full">
                {filteredItems.map((item) => {
                  const effectivePieces = getFurnitureEffectivePieces(item);
                  const metrics = calculateFurnitureMetrics(effectivePieces);

                  return (
                    <div
                      key={item.id}
                      className="bg-[#151722] border border-[#242738] hover:border-[#f0a144]/60 rounded-xl sm:rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-black/60 group relative w-full max-w-full"
                    >
                      {/* 3D Mini Viewport (Full width of card, perfectly centered 3D model) */}
                      <div 
                        className="w-full h-36 sm:h-40 relative shrink-0 cursor-pointer bg-[#0c0d12] border-b border-[#202331] group/preview"
                        onClick={() => setInspectingFurniture(item)}
                      >
                        <Warehouse3DPreview
                          pieces={effectivePieces}
                          dimensions={item.dimensions}
                          height="100%"
                          autoRotate={false}
                          interactive={false}
                        />

                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center gap-1 backdrop-blur-[1px]">
                          <span className="bg-[#14151a]/95 text-white border border-[#f0a144]/60 text-[9.5px] font-bold px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1.5">
                            <Maximize2 className="w-3.5 h-3.5 text-[#f0a144]" /> Inspeccionar 3D
                          </span>
                        </div>

                        {/* Top-Right Quick Icons (Desktop) */}
                        <div className="hidden sm:flex absolute top-2 right-2 items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity z-10">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(item);
                            }}
                            className="p-1 bg-[#14151a]/85 text-gray-300 hover:text-white rounded hover:bg-black border border-[#2b2e3d] cursor-pointer"
                            title="Editar"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicate(item);
                            }}
                            className="p-1 bg-[#14151a]/85 text-gray-300 hover:text-white rounded hover:bg-black border border-[#2b2e3d] cursor-pointer"
                            title="Duplicar"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(item.id);
                            }}
                            className="p-1 bg-[#14151a]/85 text-gray-300 hover:text-rose-400 rounded hover:bg-black border border-[#2b2e3d] cursor-pointer"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Card Content & Actions */}
                      <div className="p-3 flex-1 flex flex-col justify-between w-full max-w-full min-w-0">
                        <div>
                          {/* Metadata */}
                          <div className="flex items-center gap-1 text-[9.5px] text-gray-400 mb-1 truncate">
                            <span className="font-bold text-[#f0a144] shrink-0">{item.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono truncate">{item.dimensions.width}×{item.dimensions.height}×{item.dimensions.depth}mm</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono shrink-0">e:{item.thickness || 18}</span>
                          </div>

                          <h3 
                            className="text-xs font-bold text-white mb-1 group-hover:text-[#f0a144] transition-colors truncate cursor-pointer"
                            onClick={() => setInspectingFurniture(item)}
                          >
                            {item.name}
                          </h3>

                          {/* Quick Carpentry Metrics */}
                          <div className="flex items-center justify-between text-[9.5px] bg-[#1a1c26] px-2 py-1 rounded-lg border border-[#272a38] text-gray-300 mb-2.5">
                            <span className="flex items-center gap-1">
                              <Box className="w-3 h-3 text-[#f0a144]" />
                              <strong>{effectivePieces.length}</strong> piezas 3D
                            </span>
                            <span className="font-mono text-gray-400">
                              ~{metrics.estWeightKg} kg
                            </span>
                          </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-[#222533] w-full max-w-full">
                          <button
                            type="button"
                            onClick={() => onLoadFurnitureTo3D(item, 'replace')}
                            className="flex-1 py-1.5 px-2 bg-[#f0a144] hover:bg-[#ffba66] text-black font-black rounded-lg text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs truncate"
                            title="Cargar este mueble en el 3D Viewport"
                          >
                            <span>Cargar 3D</span>
                            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onLoadFurnitureTo3D(item, 'insert')}
                            className="py-1.5 px-2.5 bg-[#222533] hover:bg-[#2c3042] text-gray-300 hover:text-white border border-[#323648] rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                            title="Añadir como nuevo grupo al lado del mueble actual"
                          >
                            + Grupo
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectingFurniture(item)}
                            className="p-1.5 bg-[#222533] text-gray-300 hover:text-white rounded-lg border border-[#323648] cursor-pointer shrink-0"
                            title="Inspeccionar despiece 3D"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Delete Confirmation Overlay */}
                      {deleteConfirmId === item.id && (
                        <div className="absolute inset-0 bg-[#12131a]/95 backdrop-blur-sm p-3 flex flex-col items-center justify-center text-center z-20">
                          <Trash2 className="w-5 h-5 text-rose-400 mb-1" />
                          <p className="text-[11px] font-bold text-white mb-2">¿Eliminar "{item.name}"?</p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2.5 py-1 bg-[#252838] text-gray-300 text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFurniture(item.id)}
                              className="px-2.5 py-1 bg-rose-600 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* LIST VIEW */
              <div className="bg-[#151722] border border-[#242738] rounded-xl overflow-hidden shadow-lg w-full max-w-full">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#181a26] text-gray-400 border-b border-[#252838] font-bold text-[10px]">
                    <tr>
                      <th className="py-2 px-2.5">Modelo</th>
                      <th className="py-2 px-2 hidden sm:table-cell">Categoría</th>
                      <th className="py-2 px-2">Dimensiones</th>
                      <th className="py-2 px-2 hidden md:table-cell">Piezas</th>
                      <th className="py-2 px-2.5 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f2231]">
                    {filteredItems.map((item) => {
                      const effectivePieces = getFurnitureEffectivePieces(item);
                      return (
                        <tr 
                          key={item.id} 
                          className="hover:bg-[#1a1c29] transition-colors cursor-pointer"
                          onClick={() => setInspectingFurniture(item)}
                        >
                          <td className="py-2 px-2.5 font-bold text-white truncate max-w-[120px]">
                            {item.name}
                          </td>
                          <td className="py-2 px-2 text-gray-400 font-medium hidden sm:table-cell">
                            {item.category}
                          </td>
                          <td className="py-2 px-2 font-mono text-gray-300 text-[10.5px]">
                            {item.dimensions.width}×{item.dimensions.height}×{item.dimensions.depth}
                          </td>
                          <td className="py-2 px-2 font-bold text-gray-300 hidden md:table-cell">
                            {effectivePieces.length}p
                          </td>
                          <td className="py-2 px-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => onLoadFurnitureTo3D(item, 'insert')}
                                className="px-2 py-0.5 bg-[#252838] hover:bg-[#32364a] text-gray-200 border border-[#35394d] rounded text-[10px] font-bold cursor-pointer"
                              >
                                + Grupo
                              </button>
                              <button
                                type="button"
                                onClick={() => onLoadFurnitureTo3D(item, 'replace')}
                                className="px-2.5 py-0.5 bg-[#f0a144] hover:bg-[#ffba66] text-black font-black rounded text-[10px] cursor-pointer"
                              >
                                Cargar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE 3D INSPECTOR MODAL (FULLY RESPONSIVE)                         */}
      {/* ========================================================================= */}
      {inspectingFurniture && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-150">
          <div className="bg-[#151722] border border-[#2b2e40] rounded-xl sm:rounded-2xl w-full max-w-5xl h-[94vh] sm:h-[88vh] shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-3 sm:px-5 py-2 sm:py-3 bg-[#191b28] border-b border-[#252838] flex items-center justify-between shrink-0">
              <div className="min-w-0 pr-2">
                <h2 className="text-xs sm:text-sm font-black text-white truncate flex items-center gap-1.5">
                  {inspectingFurniture.name}
                  <span className="text-[10px] text-[#f0a144] font-bold shrink-0">
                    · {inspectingFurniture.category}
                  </span>
                </h2>
                <div className="text-[9.5px] sm:text-[10px] text-gray-400 font-mono">
                  {inspectingFurniture.dimensions.width}×{inspectingFurniture.dimensions.height}×{inspectingFurniture.dimensions.depth}mm · e:{inspectingFurniture.thickness || 18}mm
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onLoadFurnitureTo3D(inspectingFurniture, 'insert');
                    setInspectingFurniture(null);
                  }}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#252838] hover:bg-[#32364a] text-gray-200 border border-[#35394d] rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs font-bold transition-all cursor-pointer"
                >
                  + Grupo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLoadFurnitureTo3D(inspectingFurniture, 'replace');
                    setInspectingFurniture(null);
                  }}
                  className="px-3 sm:px-3.5 py-1 sm:py-1.5 bg-[#f0a144] hover:bg-[#ffba66] text-black font-black rounded-lg sm:rounded-xl text-[10.5px] sm:text-xs transition-all shadow-xs cursor-pointer"
                >
                  Cargar 3D
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingFurniture(null)}
                  className="p-1 sm:p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#252838] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              {/* 3D Canvas with Real-time Explode Slider */}
              <div className="h-[46%] md:h-full flex-1 relative bg-[#0c0d12] p-2 flex flex-col">
                <div className="flex-1 relative rounded-xl overflow-hidden">
                  <Warehouse3DPreview
                    pieces={getFurnitureEffectivePieces(inspectingFurniture)}
                    dimensions={inspectingFurniture.dimensions}
                    explodeRatio={inspectExplode}
                    highlightedPieceId={inspectHighlightedPieceId}
                    onSelectPiece={(id) => setInspectHighlightedPieceId(id)}
                    showControls={true}
                    height="100%"
                  />
                </div>
              </div>

              {/* Technical Pieces List */}
              <div className="h-[54%] md:h-full w-full md:w-80 bg-[#13151f] border-t md:border-t-0 md:border-l border-[#242738] flex flex-col overflow-hidden">
                <div className="p-2 sm:p-3 border-b border-[#232635] flex items-center justify-between shrink-0">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3 h-3 text-[#f0a144]" /> Despiece de Placas
                  </h4>
                  <span className="text-[10px] font-mono text-gray-400">
                    {getFurnitureEffectivePieces(inspectingFurniture).length} placas
                  </span>
                </div>

                <div className="flex-1 p-2 sm:p-2.5 overflow-y-auto space-y-1.5">
                  {getFurnitureEffectivePieces(inspectingFurniture).map((p, idx) => {
                    const isSelected = inspectHighlightedPieceId === p.id;
                    return (
                      <div
                        key={p.id || idx}
                        onClick={() => setInspectHighlightedPieceId(isSelected ? null : p.id)}
                        className={`p-2 rounded-lg sm:rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#f0a144]/15 border-[#f0a144] shadow-xs'
                            : 'bg-[#181a26] border-[#252838] hover:border-[#383d54]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-[#f0a144]' : 'text-white'}`}>
                            {p.name}
                          </span>
                          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-black/40 text-gray-300">
                            x{p.cantidad || 1}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[9.5px] text-gray-400 font-mono">
                          <span>{p.largo}×{p.ancho}×{p.espesor}mm</span>
                          <span className="text-[#f0a144]">{p.material || 'Melamina'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const pieces = getFurnitureEffectivePieces(inspectingFurniture);
                  const m = calculateFurnitureMetrics(pieces);
                  return (
                    <div className="p-2 sm:p-2.5 bg-[#181a26] border-t border-[#232635] text-[9.5px] sm:text-[10px] space-y-0.5 shrink-0">
                      <div className="flex items-center justify-between text-gray-400">
                        <span>Área total de placa:</span>
                        <strong className="text-white font-mono">{m.totalAreaM2} m²</strong>
                      </div>
                      <div className="flex items-center justify-between text-gray-400">
                        <span>Peso estimado:</span>
                        <strong className="text-[#f0a144] font-mono">~{m.estWeightKg} kg</strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GUARDAR 3D / GRUPO / NUEVO MUEBLE                                */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#151722] border border-[#2e3245] rounded-xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in duration-150">
            <div className="px-4 py-3 bg-[#191b28] border-b border-[#252838] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-[#f0a144]" />
                <h3 className="text-xs sm:text-sm font-bold text-white">
                  {editingItem ? 'Editar Mueble' : 'Guardar Mueble o Grupo en Almacén'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#252838] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFurniture} className="p-3.5 sm:p-4 overflow-y-auto space-y-3">
              {formData.attachCurrent3D && currentPieces.length > 0 && (
                <div className="bg-[#1a1c29] p-2.5 rounded-xl border border-[#2b2f42] space-y-1.5">
                  <span className="text-[10px] font-bold text-[#f0a144] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> ¿Qué deseas guardar del 3D?
                  </span>
                  
                  <div className="grid grid-cols-3 gap-1 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setSaveSourceType('all')}
                      className={`p-1.5 rounded-lg border text-center cursor-pointer ${
                        saveSourceType === 'all'
                          ? 'bg-[#f0a144] text-black border-[#f0a144] font-black'
                          : 'bg-[#151722] text-gray-300 border-[#2a2d3e]'
                      }`}
                    >
                      Todo ({currentPieces.length}p)
                    </button>
                    <button
                      type="button"
                      disabled={groups.length === 0}
                      onClick={() => setSaveSourceType('group')}
                      className={`p-1.5 rounded-lg border text-center cursor-pointer ${
                        groups.length === 0
                          ? 'opacity-40 cursor-not-allowed bg-[#151722] border-[#2a2d3e] text-gray-500'
                          : saveSourceType === 'group'
                          ? 'bg-[#f0a144] text-black border-[#f0a144] font-black'
                          : 'bg-[#151722] text-gray-300 border-[#2a2d3e]'
                      }`}
                    >
                      Grupo ({groups.length})
                    </button>
                    <button
                      type="button"
                      disabled={selectedPieceIds.length === 0}
                      onClick={() => setSaveSourceType('selected')}
                      className={`p-1.5 rounded-lg border text-center cursor-pointer ${
                        selectedPieceIds.length === 0
                          ? 'opacity-40 cursor-not-allowed bg-[#151722] border-[#2a2d3e] text-gray-500'
                          : saveSourceType === 'selected'
                          ? 'bg-[#f0a144] text-black border-[#f0a144] font-black'
                          : 'bg-[#151722] text-gray-300 border-[#2a2d3e]'
                      }`}
                    >
                      Selección ({selectedPieceIds.length}p)
                    </button>
                  </div>

                  {saveSourceType === 'group' && groups.length > 0 && (
                    <div className="pt-1">
                      <select
                        value={selectedGroupIdForSave}
                        onChange={(e) => setSelectedGroupIdForSave(e.target.value)}
                        className="w-full bg-[#12131b] border border-[#2b2f42] rounded-lg px-2 py-1 text-xs text-white outline-none"
                      >
                        {groups.map(g => (
                          <option key={g.id} value={g.id}>
                            {g.name} ({currentPieces.filter(p => p.groupId === g.id).length} piezas)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">Nombre del Mueble *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Módulo Alto Cocina"
                  className="w-full bg-[#111219] border border-[#282b3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#f0a144]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-gray-300 block mb-1">Categoría</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#111219] border border-[#282b3a] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                  >
                    {categories.filter(c => c !== 'Todas').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__NEW__">+ Nueva Categoría...</option>
                  </select>
                </div>

                {formData.category === '__NEW__' ? (
                  <div>
                    <label className="text-[11px] font-bold text-[#f0a144] block mb-1">Nombre Categoría</label>
                    <input
                      type="text"
                      required
                      value={formData.newCustomCategory}
                      onChange={(e) => setFormData({ ...formData, newCustomCategory: e.target.value })}
                      placeholder="Ej: Estanterías"
                      className="w-full bg-[#111219] border border-[#f0a144] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-gray-300 block mb-1">Subcategoría (opcional)</label>
                    <input
                      type="text"
                      value={formData.subcategory}
                      onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                      placeholder="Ej: Módulos Bajos"
                      className="w-full bg-[#111219] border border-[#282b3a] rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">Medidas (mm)</label>
                <div className="grid grid-cols-4 gap-1.5">
                  <div>
                    <span className="text-[9px] text-gray-500">Ancho</span>
                    <input
                      type="number"
                      value={formData.width}
                      onChange={(e) => setFormData({ ...formData, width: Number(e.target.value) })}
                      className="w-full bg-[#111219] border border-[#282b3a] rounded-lg px-1.5 py-1 text-xs text-white text-center font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500">Alto</span>
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: Number(e.target.value) })}
                      className="w-full bg-[#111219] border border-[#282b3a] rounded-lg px-1.5 py-1 text-xs text-white text-center font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500">Prof.</span>
                    <input
                      type="number"
                      value={formData.depth}
                      onChange={(e) => setFormData({ ...formData, depth: Number(e.target.value) })}
                      className="w-full bg-[#111219] border border-[#282b3a] rounded-lg px-1.5 py-1 text-xs text-white text-center font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-500">Espesor</span>
                    <input
                      type="number"
                      value={formData.thickness}
                      onChange={(e) => setFormData({ ...formData, thickness: Number(e.target.value) })}
                      className="w-full bg-[#111219] border border-[#282b3a] rounded-lg px-1.5 py-1 text-xs text-white text-center font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalles sobre estructura o componentes..."
                  className="w-full bg-[#111219] border border-[#282b3a] rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>

              <div className="pt-2 border-t border-[#232635] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-1.5 bg-[#212330] text-gray-300 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#f0a144] text-black rounded-lg text-xs font-black cursor-pointer"
                >
                  {editingItem ? 'Guardar Cambios' : 'Guardar en Almacén'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Category Selector Modal for Mobile & Instant Overview */}
      {isCategoryModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => setIsCategoryModalOpen(false)}
        >
          <div 
            className="bg-[#141620] border border-[#2b2f42] rounded-2xl max-w-sm w-full p-4 shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#232738] mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#f0a144]/20 border border-[#f0a144]/40 flex items-center justify-center text-[#f0a144]">
                  <Filter className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white">Categorías de Muebles</h3>
                  <p className="text-[10px] text-gray-400">{categories.length} categorías disponibles</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#222533] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Category Grid / List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {categories.map((cat) => {
                const count = categoryCounts[cat] || 0;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelectCategory(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-[#f0a144] text-black font-black shadow-md'
                        : 'bg-[#191b26] text-gray-300 hover:bg-[#222536] hover:text-white border border-[#25283a]'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      isSelected ? 'bg-black/20 text-black font-black' : 'bg-[#101118] text-gray-400'
                    }`}>
                      {count} {count === 1 ? 'mueble' : 'muebles'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Add New Category Button */}
            <div className="pt-3 border-t border-[#232738] mt-3">
              <button
                type="button"
                onClick={() => {
                  const cat = prompt('Nombre de la nueva categoría:');
                  if (cat && cat.trim()) {
                    const clean = cat.trim();
                    if (!categories.includes(clean)) {
                      setCategories(prev => [...prev, clean]);
                      setSelectedCategory(clean);
                      setIsCategoryModalOpen(false);
                      showToast(`Categoría "${clean}" creada.`);
                    }
                  }
                }}
                className="w-full py-2 bg-[#202332] hover:bg-[#2c3044] text-[#f0a144] hover:text-white border border-[#353950] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#f0a144]" />
                <span>+ Crear Nueva Categoría</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
