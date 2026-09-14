import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Save, FolderOpen, Box, Download, Settings, Loader2, Menu, X, Plus, Trash2, Combine, Ungroup, Layers, Search, Filter, Lightbulb, ChevronDown, ChevronRight, Ruler, Play, Pointer, Undo2, Redo2, CheckCircle2, Scissors, PanelRightOpen, FilePlus2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';
import { interpretFurnitureImage, isAiConfigured } from './lib/gemini';
import { Piece, EdgeConfig, Group3D } from './types';
import ThreeViewer, { MATERIAL_MAP } from './components/ThreeViewer';
import CutPlanViewer from './components/CutPlanViewer';
import ThreeViewerOverlay from './components/ThreeViewerOverlay';
import { createStarterProject, isProjectState, serializePiecesCsv } from './lib/project';
import { createShelfModule, type ShelfModuleBack, type ShelfModuleConfig } from './lib/shelfModule';

const PROJECT_STORAGE_KEY = 'iamueble-project-v1';

const getMaterialEmoji = (name: string) => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('blanco') || lowercase.includes('humo') || lowercase.includes('niebla') || lowercase.includes('sahara')) return '⚪';
  if (lowercase.includes('negro') || lowercase.includes('carbón') || lowercase.includes('carbon')) return '⚫';
  if (lowercase.includes('gris') || lowercase.includes('cendra') || lowercase.includes('plomo') || lowercase.includes('antracita') || lowercase.includes('cemento') || lowercase.includes('loft')) return '🔘';
  if (lowercase.includes('roble') || lowercase.includes('nogal') || lowercase.includes('pino') || lowercase.includes('haya') || lowercase.includes('cerezo') || lowercase.includes('wood') || lowercase.includes('macadamia') || lowercase.includes('capuccino') || lowercase.includes('bellota') || lowercase.includes('rovere') || lowercase.includes('coñac') || lowercase.includes('conac') || lowercase.includes('amaretto') || lowercase.includes('caramel') || lowercase.includes('ceniza') || lowercase.includes('siena') || lowercase.includes('almendra')) return '🪵';
  if (lowercase.includes('verde') || lowercase.includes('salvia') || lowercase.includes('ópalo') || lowercase.includes('opalo')) return '🟢';
  if (lowercase.includes('azul')) return '🔵';
  return '🎨';
};

const getGroupedMaterials = () => {
  const groups: Record<string, Array<{ id: string, name: string, color: string, brand: string }>> = {
    'Estándar': [],
    'Pelikano': [],
    'Hispanos': []
  };

  Object.entries(MATERIAL_MAP).forEach(([key, val]) => {
    const b = val.brand || 'Estándar';
    if (!groups[b]) groups[b] = [];
    groups[b].push({ id: key, name: val.name, color: val.color, brand: b });
  });

  return groups;
};

type ViewMode = '3d' | '2d';

interface AppState {
  pieces: Piece[];
  groups: Group3D[];
}

function useAppHistory(initialState: AppState) {
  const [state, setStateInternal] = useState<AppState>(initialState);
  const historyRef = useRef<AppState[]>([initialState]);
  const pointerRef = useRef<number>(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const updateFlags = () => {
     setCanUndo(pointerRef.current > 0);
     setCanRedo(pointerRef.current < historyRef.current.length - 1);
  };

  const setState = useCallback((valueOrFn: React.SetStateAction<AppState>) => {
    setStateInternal(prev => {
      const nextState = typeof valueOrFn === 'function' ? (valueOrFn as any)(prev) : valueOrFn;
      
      const newHistory = historyRef.current.slice(0, pointerRef.current + 1);
      newHistory.push(nextState);
      
      if (newHistory.length > 50) {
        newHistory.shift();
      } else {
        pointerRef.current++;
      }
      historyRef.current = newHistory;
      
      updateFlags();
      return nextState;
    });
  }, []);

  const undo = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (pointerRef.current > 0) {
      pointerRef.current--;
      setStateInternal(historyRef.current[pointerRef.current]);
      updateFlags();
    }
  }, []);

  const redo = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (pointerRef.current < historyRef.current.length - 1) {
      pointerRef.current++;
      setStateInternal(historyRef.current[pointerRef.current]);
      updateFlags();
    }
  }, []);

  return [state, setState, undo, redo, canUndo, canRedo] as const;
}

type DeleteTarget = { type: 'all' } | { type: 'selected' } | { type: 'group', id: string, name: string } | { type: 'piece', id: string, name: string };

type PieceOrientation = 'horizontal' | 'lateral' | 'frente';

interface PieceDraft {
  name: string;
  largo: number;
  ancho: number;
  espesor: number;
  cantidad: number;
  material: string;
  orientation: PieceOrientation;
}

const createPieceDraft = (index: number): PieceDraft => ({
  name: `Pieza ${index}`,
  largo: 600,
  ancho: 400,
  espesor: 18,
  cantidad: 1,
  material: 'Pelikano_Blanco_Absoluto',
  orientation: 'horizontal',
});

type ShelfModuleVariant = 'single' | 'double' | 'triple';

interface ShelfModuleDraft extends ShelfModuleConfig {
  variant: ShelfModuleVariant;
}

const SHELF_MODULE_VARIANTS: Array<{
  id: ShelfModuleVariant;
  label: string;
  help: string;
  values: Omit<ShelfModuleConfig, 'name' | 'material'>;
}> = [
  {
    id: 'single',
    label: '1 columna',
    help: 'Estante angosto',
    values: { width: 600, height: 1846, depth: 313, thickness: 18, plinthHeight: 80, plinthInset: 30, shelves: 4, verticalDividers: 0, back: 'mdf3' },
  },
  {
    id: 'double',
    label: '2 columnas',
    help: 'Estante dividido',
    values: { width: 1200, height: 1846, depth: 350, thickness: 18, plinthHeight: 80, plinthInset: 30, shelves: 4, verticalDividers: 1, back: 'mdf3' },
  },
  {
    id: 'triple',
    label: '3 columnas',
    help: 'Exhibidor amplio',
    values: { width: 1800, height: 1846, depth: 350, thickness: 18, plinthHeight: 80, plinthInset: 30, shelves: 4, verticalDividers: 2, back: 'mdf3' },
  },
];

const createShelfModuleDraft = (variant: ShelfModuleVariant = 'single'): ShelfModuleDraft => {
  const preset = SHELF_MODULE_VARIANTS.find(item => item.id === variant) || SHELF_MODULE_VARIANTS[0];
  return {
    variant,
    name: 'Estante ' + preset.label,
    material: 'Pelikano_Blanco_Absoluto',
    ...preset.values,
  };
};

export default function App() {
  const initialStateRef = useRef<AppState | null>(null);
  if (!initialStateRef.current) {
    try {
      const savedProject = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      const parsedProject = savedProject ? JSON.parse(savedProject) : null;
      initialStateRef.current = isProjectState(parsedProject) ? parsedProject : createStarterProject();
    } catch {
      initialStateRef.current = createStarterProject();
    }
  }
  const [appState, setAppState, undo, redo, canUndo, canRedo] = useAppHistory(initialStateRef.current);
  const { pieces, groups } = appState;

  const [deleteConfirm, setDeleteConfirm] = useState<DeleteTarget | null>(null);

  const executeDelete = () => {
    if (!deleteConfirm) return;
    
    switch (deleteConfirm.type) {
      case 'all':
        setAppState(prev => ({ ...prev, pieces: [], groups: [] }));
        setSelectedPieceIds([]);
        break;
      case 'selected':
        setAppState(prev => {
          const nextPieces = prev.pieces.filter(p => !selectedPieceIds.includes(p.id));
          const usedGroupIds = new Set(nextPieces.map(p => p.groupId).filter(Boolean));
          return {
            ...prev,
            pieces: nextPieces,
            groups: prev.groups.filter(g => usedGroupIds.has(g.id))
          };
        });
        setSelectedPieceIds([]);
        break;
      case 'group':
        setAppState(prev => ({
          ...prev,
          groups: prev.groups.filter(g => g.id !== deleteConfirm.id),
          pieces: prev.pieces.map(p => p.groupId === deleteConfirm.id ? { ...p, groupId: undefined } : p)
        }));
        setSelectedPieceIds(prev => prev.filter(id => pieces.find(p => p.id === id)?.groupId !== deleteConfirm.id));
        break;
      case 'piece':
        setAppState(prev => {
          const nextPieces = prev.pieces.filter(p => p.id !== deleteConfirm.id);
          const usedGroupIds = new Set(nextPieces.map(p => p.groupId).filter(Boolean));
          return {
            ...prev,
            pieces: nextPieces,
            groups: prev.groups.filter(g => usedGroupIds.has(g.id))
          };
        });
        setSelectedPieceIds(prev => prev.filter(id => id !== deleteConfirm.id));
        break;
    }
    setDeleteConfirm(null);
  };


  const setPieces = useCallback((valueOrFn: React.SetStateAction<Piece[]>) => {
    setAppState(prev => ({
      ...prev,
      pieces: typeof valueOrFn === 'function' ? (valueOrFn as any)(prev.pieces) : valueOrFn
    }));
  }, [setAppState]);

  const setGroups = useCallback((valueOrFn: React.SetStateAction<Group3D[]>) => {
    setAppState(prev => ({
      ...prev,
      groups: typeof valueOrFn === 'function' ? (valueOrFn as any)(prev.groups) : valueOrFn
    }));
  }, [setAppState]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([]);
  const [editingDimensionsPieceId, setEditingDimensionsPieceId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [newPieceDialogOpen, setNewPieceDialogOpen] = useState(false);
  const [pieceDraft, setPieceDraft] = useState<PieceDraft>(() => createPieceDraft(1));
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [moduleDraft, setModuleDraft] = useState<ShelfModuleDraft>(() => createShelfModuleDraft());
  const [outlinerSearch, setOutlinerSearch] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [sheetConfig, setSheetConfig] = useState<{ width: number; height: number; kerf: number; margin: number }>({
    width: 2440,
    height: 2140,
    kerf: 3,
    margin: 10
  });
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [snapActive, setSnapActive] = useState(true);
  const [didacticGuideOpen, setDidacticGuideOpen] = useState(false);
  const [activeDisplacement, setActiveDisplacement] = useState<{ dx: number; dy: number; dz: number; dist: number } | null>(null);

  useEffect(() => {
    const handleDisplacement = (e: any) => {
      setActiveDisplacement(e.detail);
    };
    window.addEventListener('piece-displacement-update', handleDisplacement);
    return () => window.removeEventListener('piece-displacement-update', handleDisplacement);
  }, []);
  
  // Blender-style Array and Distribution States
  const [arrayCount, setArrayCount] = useState<number>(3);
  const [arrayOffset, setArrayOffset] = useState<number>(1.0);
  const [arrayAxis, setArrayAxis] = useState<'X' | 'Y' | 'Z'>('Y');
  const [arrayMode, setArrayMode] = useState<'between' | 'offset'>('between');

  // SketchUp Tray Open/Closed States
  const [trayOpen, setTrayOpen] = useState({
    esquema: true,
    entidad: true,
    dinamico: false,
    materiales: false,
    procesos: false,
  });
  
  const [interactMode, setInteractMode] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(appState));
  }, [appState]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(current => current === message ? null : current), 2600);
  }, []);

  const totalPieceCount = pieces.reduce((sum, piece) => sum + Math.max(0, piece.cantidad || 0), 0);
  const activePiece = pieces.find(piece => piece.id === selectedPieceIds[0]);
  const normalizedOutlinerSearch = outlinerSearch.trim().toLowerCase();
  const matchesOutlinerSearch = (piece: Piece) => !normalizedOutlinerSearch || [
    piece.name,
    piece.material || '',
    `${Math.round(piece.largo)}x${Math.round(piece.ancho)}`,
  ].some(value => value.toLowerCase().includes(normalizedOutlinerSearch));

  const toggleTray = (key: keyof typeof trayOpen) => {
    setTrayOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggleDynamicPiece = (id: string) => {
    setPieces(prev => prev.map(p => {
      if (p.id === id && p.dynamic) {
        return {
          ...p,
          dynamic: {
            ...p.dynamic,
            isOpen: !p.dynamic.isOpen
          }
        };
      }
      return p;
    }));
  };

  const handleToggleAllDynamicPieces = (targetState?: boolean) => {
    setPieces(prev => {
      const hasAnyOpen = prev.some(p => p.dynamic?.isOpen);
      const nextOpen = targetState !== undefined ? targetState : !hasAnyOpen;
      return prev.map(p => {
        if (p.dynamic) {
          return {
            ...p,
            dynamic: {
              ...p.dynamic,
              isOpen: nextOpen
            }
          };
        }
        return p;
      });
    });
  };

  const handleAutoTagDynamicPieces = () => {
    setPieces(prev => prev.map(p => {
      if (p.dynamic) return p;
      const name = (p.name || '').toLowerCase();
      if (name.includes('puerta') || name.includes('door') || name.includes('frente p')) {
        const isRight = name.includes('derecha') || name.includes('der') || name.includes('right');
        const isLift = name.includes('elevable') || name.includes('basculante') || name.includes('lift') || name.includes('sup');
        return {
          ...p,
          abisagrado: true,
          dynamic: {
            type: 'door',
            doorType: isLift ? 'lift_up' : isRight ? 'single_right' : 'single_left',
            pivotPoint: isLift ? 'top' : isRight ? 'right' : 'left',
            openAngle: 95,
            isOpen: false
          }
        };
      } else if (name.includes('cajon') || name.includes('cajón') || name.includes('drawer') || name.includes('frente c')) {
        return {
          ...p,
          dynamic: {
            type: 'drawer',
            slideAxis: 'Z',
            slideDistance: Math.max(200, Math.round(p.ancho * 0.85)),
            isOpen: false
          }
        };
      }
      return p;
    }));
  };

  const [tempLargo, setTempLargo] = useState<number>(0);
  const [tempAncho, setTempAncho] = useState<number>(0);
  const [tempEspesor, setTempEspesor] = useState<number>(0);
  const [editingAxis, setEditingAxis] = useState<'largo' | 'ancho' | 'espesor'>('largo');
  const [anchorDirection, setAnchorDirection] = useState<'neg' | 'center' | 'pos'>('neg');

  const handleOpenDimensionEditor = (pieceId: string, axis: 'largo' | 'ancho' | 'espesor' = 'largo') => {
    const p = pieces.find(x => x.id === pieceId);
    if (p) {
      setTempLargo(Math.round(p.largo));
      setTempAncho(Math.round(p.ancho));
      setTempEspesor(Math.round(p.espesor));
    }
    setEditingDimensionsPieceId(pieceId);
    setEditingAxis(axis);
    setAnchorDirection('neg');
  };

  useEffect(() => {
    if (editingDimensionsPieceId) {
      const p = pieces.find(x => x.id === editingDimensionsPieceId);
      if (p) {
        setTempLargo(Math.round(p.largo));
        setTempAncho(Math.round(p.ancho));
        setTempEspesor(Math.round(p.espesor));
      }
    }
  }, [editingDimensionsPieceId, pieces]);

  useEffect(() => {
    const handleRequestTransformMode = (e: CustomEvent) => {
       setTransformMode(e.detail);
    };
    window.addEventListener('request-transform-mode', handleRequestTransformMode as EventListener);
    return () => window.removeEventListener('request-transform-mode', handleRequestTransformMode as EventListener);
  }, []);

  const handleGroupPieces = () => {
    if (selectedPieceIds.length < 2) return;
    const newGroupId = uuidv4();
    const newGroup: Group3D = {
      id: newGroupId,
      name: `Grupo ${groups.length + 1}`,
      position3D: [0, 0, 0],
      rotation3D: [0, 0, 0]
    };
    
    setAppState(prev => ({
      ...prev,
      groups: [...prev.groups, newGroup],
      pieces: prev.pieces.map(p => selectedPieceIds.includes(p.id) ? { ...p, groupId: newGroupId } : p)
    }));
  };

  const handleUngroupPieces = () => {
    if (selectedPieceIds.length === 0) return;
    
    setAppState(prev => {
      const groupsToKeep = new Set<string>();
      const nextPieces = prev.pieces.map(p => {
        if (selectedPieceIds.includes(p.id)) {
           return { ...p, groupId: undefined };
        }
        if (p.groupId) groupsToKeep.add(p.groupId);
        return p;
      });
      
      return {
        ...prev,
        pieces: nextPieces,
        groups: prev.groups.filter(g => groupsToKeep.has(g.id))
      };
    });
  };

  const toggleSelection = (id: string | null, multi: boolean = false) => {
    if (!id) {
       setSelectedPieceIds([]);
       return;
    }
    
    const isMulti = multi || multiSelectMode;

    const piece = pieces.find(p => p.id === id);
    const pieceGroupId = piece?.groupId;
    const idsToSelect = pieceGroupId ? pieces.filter(p => p.groupId === pieceGroupId).map(p => p.id) : [id];

    if (isMulti) {
      setSelectedPieceIds(prev => {
         const allIn = idsToSelect.every(i => prev.includes(i));
         if (allIn) {
            return prev.filter(i => !idsToSelect.includes(i));
         } else {
            return [...new Set([...prev, ...idsToSelect])];
         }
      });
    } else {
      setSelectedPieceIds(idsToSelect);
    }
  };

  const updatePieceTransform = (id: string, position: [number, number, number], rotation: [number, number, number]) => {
    setPieces(prev => {
      const piece = prev.find(p => p.id === id);
      if (!piece) return prev;
      
      const dx = position[0] - piece.position3D[0];
      const dy = position[1] - piece.position3D[1];
      const dz = position[2] - piece.position3D[2];
      
      return prev.map(p => {
        if (selectedPieceIds.includes(p.id)) {
          if (p.id === id) {
             return { ...p, position3D: position, rotation3D: rotation };
          } else {
             return {
                ...p,
                position3D: [p.position3D[0] + dx, p.position3D[1] + dy, p.position3D[2] + dz]
             };
          }
        }
        return p;
      });
    });
  };

  const updatePieceDimensions = (id: string, dx: number, dy: number, dz: number, ox: number, oy: number, oz: number) => {
    setPieces(prev => prev.map(p => {
       if (p.id === id) {
          // Convert the local origin offset (which is in meters) to world coordinates using the piece's rotation
          const euler = new THREE.Euler(p.rotation3D[0], p.rotation3D[1], p.rotation3D[2], 'XYZ');
          const vec = new THREE.Vector3(ox, oy, oz);
          vec.applyEuler(euler);
          
          return {
             ...p,
             largo: Math.max(10, Math.round(p.largo + dx)),
             espesor: Math.max(1, Math.round(p.espesor + dy)),
             ancho: Math.max(10, Math.round(p.ancho + dz)),
             position3D: [
                p.position3D[0] + vec.x * 1000,
                p.position3D[1] + vec.y * 1000,
                p.position3D[2] + vec.z * 1000
             ]
          };
       }
       return p;
    }));
  };

  const addPiece = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setPieceDraft(createPieceDraft(totalPieceCount + 1));
    setNewPieceDialogOpen(true);
  };

  const createPieceFromDraft = () => {
    const largo = Math.max(10, Math.round(Number(pieceDraft.largo) || 0));
    const ancho = Math.max(10, Math.round(Number(pieceDraft.ancho) || 0));
    const espesor = Math.max(1, Math.round(Number(pieceDraft.espesor) || 0));
    const cantidad = Math.max(1, Math.round(Number(pieceDraft.cantidad) || 1));
    const orientation = pieceDraft.orientation;
    const rotation3D: [number, number, number] = orientation === 'lateral'
      ? [0, 0, Math.PI / 2]
      : orientation === 'frente'
        ? [Math.PI / 2, 0, 0]
        : [0, 0, 0];
    const height = orientation === 'lateral' ? largo : orientation === 'frente' ? ancho : espesor;
    const newPiece: Piece = {
      id: uuidv4(),
      name: pieceDraft.name.trim() || `Pieza ${totalPieceCount + 1}`,
      largo,
      ancho,
      espesor,
      cantidad,
      cantos: { largo1: 'Ninguno', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [0, height / 2, 0],
      rotation3D,
      veta: false,
      ranurado: false,
      abisagrado: false,
      material: pieceDraft.material,
    };
    setPieces(prev => [...prev, newPiece]);
    setSelectedPieceIds([newPiece.id]);
    setNewPieceDialogOpen(false);
    setViewMode('3d');
    showNotice(`${newPiece.name} creada en milímetros`);
  };

  const deletePiece = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPieces(prev => prev.filter(p => p.id !== id));
    setSelectedPieceIds(prev => prev.filter(p => p !== id));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        // remove the data URL prefix to get raw base64 for Gemini
        const base64Raw = base64data.split(',')[1];
        
        try {
          const extractedPieces = await interpretFurnitureImage(base64Raw, file.type);
          const sanitizedPieces = extractedPieces.map(p => ({
            ...p,
            cantos: p.cantos || { largo1: 'Ninguno', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
            position3D: p.position3D || [0, 0, 0],
            rotation3D: p.rotation3D || [0, 0, 0]
          }));
          setPieces(sanitizedPieces);
          setSelectedPieceIds([]);
          showNotice(`${sanitizedPieces.length} piezas detectadas desde la imagen`);
        } catch (error) {
          showNotice('No se pudo interpretar la imagen; tu proyecto no cambió');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessing(false);
      showNotice('No se pudo leer el archivo seleccionado');
    }
  };

  const consolidatePieces = () => {
    setPieces(prev => {
      const groupsMap: { [key: string]: Piece } = {};
      prev.forEach(p => {
        const c = p.cantos || { largo1: 'Ninguno', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' };
        const key = `${Math.round(p.largo)}-${Math.round(p.ancho)}-${p.espesor}-${c.largo1}-${c.largo2}-${c.ancho1}-${c.ancho2}-${p.veta}-${p.ranurado}`;
        if (groupsMap[key]) {
          groupsMap[key].cantidad += p.cantidad;
        } else {
          groupsMap[key] = { ...p, cantos: c };
        }
      });
      return Object.values(groupsMap);
    });
  };

  const updatePiece = (id: string, updates: Partial<Piece>) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const updateEdge = (id: string, edgeKey: keyof EdgeConfig, value: EdgeConfig['largo1']) => {
    setPieces(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          cantos: {
            ...p.cantos,
            [edgeKey]: value
          }
        };
      }
      return p;
    }));
  };

  const loadFileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveModel = () => {
    const data = JSON.stringify({ pieces, groups }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iamueble_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Proyecto descargado como archivo editable');
  };

  const handleExportCsv = () => {
    const blob = new Blob([`\uFEFF${serializePiecesCsv(pieces)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `despiece_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Despiece CSV listo para abrir en Excel');
  };

  const openShelfModuleDialog = () => {
    setModuleDraft(createShelfModuleDraft());
    setMobileMenuOpen(false);
    setModuleDialogOpen(true);
  };

  const createModuleFromDraft = () => {
    try {
      const rightEdge = pieces.reduce((maximum, piece) => (
        Math.max(maximum, piece.position3D[0] + Math.max(piece.largo, piece.ancho, piece.espesor) / 2)
      ), Number.NEGATIVE_INFINITY);
      const originX = Number.isFinite(rightEdge) ? rightEdge + moduleDraft.width / 2 + 200 : 0;
      const created = createShelfModule(moduleDraft, originX);

      setAppState(previous => ({
        pieces: [...previous.pieces, ...created.pieces],
        groups: [...previous.groups, created.group],
      }));
      setSelectedPieceIds(created.pieces.length ? [created.pieces[0].id] : []);
      setModuleDialogOpen(false);
      setViewMode('3d');
      showNotice(created.group.name + ': ' + created.pieces.length + ' piezas creadas');
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('cad-camera-view', { detail: 'fit' }));
      }, 50);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : 'No se pudo crear el módulo');
    }
  };

  const handleLoadModel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const normalized = Array.isArray(data) ? { pieces: data, groups: [] } : data;
        if (!isProjectState(normalized)) {
          showNotice('El archivo no contiene un proyecto CAD válido');
          return;
        }
        setAppState(normalized);
        setSelectedPieceIds([]);
        setViewMode('3d');
        showNotice(`Proyecto abierto: ${normalized.pieces.length} piezas`);
      } catch (err) {
        console.error("Failed to parse JSON", err);
        showNotice('No se pudo abrir el archivo JSON');
      }
    };
    reader.readAsText(file);
    if (loadFileInputRef.current) {
        loadFileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.isContentEditable;
      const modifier = event.ctrlKey || event.metaKey;

      if (modifier && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSaveModel();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (isEditing) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedPieceIds.length > 0) {
          event.preventDefault();
          setDeleteConfirm({ type: 'selected' });
        }
      } else if (event.key === 'Escape') {
        setNewPieceDialogOpen(false);
        setModuleDialogOpen(false);
        setEditingDimensionsPieceId(null);
        setDidacticGuideOpen(false);
        setSelectedPieceIds([]);
      } else if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        addPiece();
      } else if (event.key === '1') {
        setViewMode('3d');
      } else if (event.key === '2') {
        setViewMode('2d');
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [selectedPieceIds, undo, redo, totalPieceCount]);

  const executeDistribution = () => {
    if (arrayMode === 'between') {
      if (selectedPieceIds.length < 2) {
        alert("Selecciona exactamente 2 piezas (inicio y fin) para realizar la distribución.");
        return;
      }
      
      const piece1 = pieces.find(p => p.id === selectedPieceIds[0]);
      const piece2 = pieces.find(p => p.id === selectedPieceIds[1]);
      if (!piece1 || !piece2) return;

      const numShelves = arrayCount; // number of intermediate shelves
      if (numShelves < 1) return;

      const newPiecesToInsert: Piece[] = [];
      for (let i = 1; i <= numShelves; i++) {
        const t = i / (numShelves + 1);
        const interpolatedPos: [number, number, number] = [
          piece1.position3D[0] + t * (piece2.position3D[0] - piece1.position3D[0]),
          piece1.position3D[1] + t * (piece2.position3D[1] - piece1.position3D[1]),
          piece1.position3D[2] + t * (piece2.position3D[2] - piece1.position3D[2])
        ];

        const newPiece: Piece = {
          ...piece1,
          id: uuidv4(),
          name: `${piece1.name || 'Repisa'} (Int.${i})`,
          position3D: interpolatedPos,
          groupId: piece1.groupId || piece2.groupId
        };
        newPiecesToInsert.push(newPiece);
      }

      setPieces(prev => [...prev, ...newPiecesToInsert]);
      setSelectedPieceIds(newPiecesToInsert.map(p => p.id));
    } else {
      // Offset mode (Blender style)
      if (selectedPieceIds.length === 0) return;
      
      const newPiecesToInsert: Piece[] = [];
      const count = arrayCount; // total count of items in the array (e.g. 3)
      if (count <= 1) return;

      selectedPieceIds.forEach(id => {
        const basePiece = pieces.find(p => p.id === id);
        if (!basePiece) return;

        // Offset distance based on axis
        let dimension = basePiece.largo;
        if (arrayAxis === 'Y') dimension = basePiece.espesor;
        if (arrayAxis === 'Z') dimension = basePiece.ancho;

        const offsetDistance = dimension * arrayOffset;

        for (let i = 1; i < count; i++) {
          const dx = arrayAxis === 'X' ? offsetDistance * i : 0;
          const dy = arrayAxis === 'Y' ? offsetDistance * i : 0;
          const dz = arrayAxis === 'Z' ? offsetDistance * i : 0;

          const newPiece: Piece = {
            ...basePiece,
            id: uuidv4(),
            name: `${basePiece.name || 'Nueva Pieza'} (Arr.${i})`,
            position3D: [
              basePiece.position3D[0] + dx,
              basePiece.position3D[1] + dy,
              basePiece.position3D[2] + dz
            ]
          };
          newPiecesToInsert.push(newPiece);
        }
      });

      setPieces(prev => [...prev, ...newPiecesToInsert]);
      setSelectedPieceIds(newPiecesToInsert.map(p => p.id));
    }
  };

  return (
    <div className="cad-shell flex flex-col h-[100dvh] bg-[#111417] text-[#d7dde5] font-sans overflow-hidden select-none">
      <input 
        type="file" 
        accept=".json" 
        style={{ display: 'none' }} 
        ref={loadFileInputRef} 
        onChange={handleLoadModel} 
      />
      
      <header className="cad-header h-14 border-b border-[#2a3139] bg-[#15191e] flex items-center justify-between px-3 sm:px-4 shrink-0 relative z-40 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className="sm:hidden cad-icon-button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir panel del proyecto"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#f0a144] text-[#16191d] flex items-center justify-center shadow-[0_0_0_1px_rgba(255,255,255,.08)]">
              <Box className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-extrabold text-white leading-tight truncate">Melamina IA</div>
              <div className="text-[13px] text-[#8e99a6] leading-tight hidden sm:block">Diseño y corte en milímetros</div>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-1 border-l border-[#303842] pl-3">
            <button className="cad-action-button" onClick={() => loadFileInputRef.current?.click()} title="Abrir proyecto JSON">
              <FolderOpen className="w-4 h-4" /> Abrir
            </button>
            <button className="cad-action-button" onClick={handleSaveModel} title="Guardar una copia editable (Ctrl+S)">
              <Save className="w-4 h-4" /> Guardar
            </button>
          </div>
        </div>

        <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center bg-[#0e1115] border border-[#303842] rounded-xl p-1" aria-label="Flujo principal">
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`cad-workspace-tab ${viewMode === '3d' ? 'is-active' : ''}`}
          >
            <Box className="w-4 h-4" />
            <span><strong>1</strong> Diseño 3D</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`cad-workspace-tab ${viewMode === '2d' ? 'is-active' : ''}`}
          >
            <Scissors className="w-4 h-4" />
            <span><strong>2</strong> Despiece y corte</span>
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDidacticGuideOpen(true)}
            className="cad-icon-button hidden sm:flex"
            title="Guía de materiales y cantos"
            aria-label="Abrir guía de carpintería"
          >
            <Lightbulb className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="cad-primary-button"
            onClick={handleExportCsv}
            disabled={pieces.length === 0}
            title="Descargar el despiece para Excel"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar despiece</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </header>

      <nav className="md:hidden h-11 bg-[#11151a] border-b border-[#2a3139] grid grid-cols-2 gap-1 p-1.5 shrink-0 z-30" aria-label="Flujo principal móvil">
        <button type="button" onClick={() => setViewMode('3d')} className={`cad-workspace-tab justify-center ${viewMode === '3d' ? 'is-active' : ''}`}>
          <Box className="w-4 h-4" /> Diseño 3D
        </button>
        <button type="button" onClick={() => setViewMode('2d')} className={`cad-workspace-tab justify-center ${viewMode === '2d' ? 'is-active' : ''}`}>
          <Scissors className="w-4 h-4" /> Corte 2D
        </button>
      </nav>

      <div className="flex-1 flex overflow-hidden relative">
        
        {mobileMenuOpen && (
          <div 
            className="absolute inset-0 bg-black/50 z-10 lg:hidden pointer-events-auto"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        
        <div className="hidden sm:flex w-[76px] bg-[#15191e] border-r border-[#2a3139] flex-col items-stretch px-2 py-3 gap-2 z-20">
           <ToolbarIcon icon={<Plus />} label="Pieza" title="Crear una pieza (N)" active={false} onClick={addPiece} />
           <ToolbarIcon icon={<Box />} label="Módulo" title="Crear estante con zócalo" active={false} onClick={openShelfModuleDialog} />
           <div className="h-px bg-[#303842] my-1" />
           <ToolbarIcon icon={<Undo2 />} label="Deshacer" title="Deshacer (Ctrl+Z)" active={false} disabled={!canUndo} onClick={() => undo()} />
           <ToolbarIcon icon={<Redo2 />} label="Rehacer" title="Rehacer (Ctrl+Shift+Z)" active={false} disabled={!canRedo} onClick={() => redo()} />
           <div className="h-px bg-[#303842] my-1" />
           <ToolbarIcon icon={<Trash2 />} label="Limpiar" title="Eliminar todo" active={false} disabled={pieces.length === 0} onClick={() => pieces.length > 0 && setDeleteConfirm({ type: 'all' })} />
           {isAiConfigured && (
             <>
               <div className="h-px bg-[#303842] my-1" />
               <ToolbarIcon icon={<Upload />} label="Imagen" title="Reconocer mueble desde una imagen" active={false} onClick={() => fileInputRef.current?.click()} />
             </>
           )}
        </div>

        <div className="flex-1 relative flex flex-col">
          <div className="h-10 bg-[#1a2026]/95 border-b border-[#2a3139] flex items-center px-3 sm:px-4 gap-3 z-10 shrink-0">
            <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm">
              {activePiece ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#f0a144] shrink-0" />
                  <span className="font-semibold text-white truncate">{selectedPieceIds.length > 1 ? `${selectedPieceIds.length} piezas seleccionadas` : activePiece.name}</span>
                  <span className="hidden sm:inline text-[#8e99a6] font-mono">{Math.round(activePiece.largo)} × {Math.round(activePiece.ancho)} × {Math.round(activePiece.espesor)} mm</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[#aeb7c2]">{pieces.length ? 'Selecciona una pieza para editarla' : 'Crea una pieza o carga el módulo base'}</span>
                </>
              )}
            </div>
            <div className="flex-1" />
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="cad-action-button lg:hidden" aria-label="Abrir propiedades">
              <PanelRightOpen className="w-4 h-4" /> <span className="hidden xs:inline">Propiedades</span>
            </button>
            <span className="hidden lg:inline text-xs text-[#8e99a6]">{totalPieceCount} piezas · mm</span>
          </div>

          <main className="flex-1 relative overflow-hidden w-full max-w-full">
            <input 
              id="ai-upload"
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
            />
            {viewMode === '3d' ? (
              <>
                <ThreeViewer 
                  pieces={pieces} 
                  selectedPieceIds={selectedPieceIds} 
                  onSelectPiece={toggleSelection}
                  onUpdatePieceTransform={updatePieceTransform}
                  onUpdatePieceDimensions={updatePieceDimensions}
                  onUpdatePieceScale={(id, sx, sy, sz) => {
                     const p = pieces.find(x => x.id === id);
                     if (p) {
                         updatePiece(id, { 
                             largo: p.largo * sx,
                             espesor: p.espesor * sy,
                             ancho: p.ancho * sz 
                         });
                         return;
                     }
                  }}
                  // unused scale bypassed
                  onUnusedScale={(id, sx, sy, sz) => {
                     const p = pieces.find(x => x.id === id);
                     if (p) {
                         const nuevoLargo = p.largo * sx;
                         const nuevoEspesor = p.espesor * sy;
                         const nuevoAncho = p.ancho * sz;

                         const dLargo = nuevoLargo - p.largo;
                         const dEspesor = nuevoEspesor - p.espesor;
                         const dAncho = nuevoAncho - p.ancho;

                         // Shift the center in local space by half of the delta in meters 
                         // so that the opposite side remains perfectly anchored in place.
                         const shiftX = (dLargo / 2) * 0.001;
                         const shiftY = (dEspesor / 2) * 0.001;
                         const shiftZ = (dAncho / 2) * 0.001;

                         const euler = new THREE.Euler(p.rotation3D[0], p.rotation3D[1], p.rotation3D[2], 'XYZ');
                         const localShift = new THREE.Vector3(shiftX, shiftY, shiftZ);
                         localShift.applyEuler(euler);

                         updatePiece(id, { 
                             largo: nuevoLargo,
                             espesor: nuevoEspesor,
                             ancho: nuevoAncho,
                             position3D: [
                                 p.position3D[0] + localShift.x,
                                 p.position3D[1] + localShift.y,
                                 p.position3D[2] + localShift.z
                             ]
                         });
                     }
                  }}
                  transformMode={transformMode}
                  snapActive={snapActive}
                  onDoubleClickPiece={(id) => handleOpenDimensionEditor(id, 'largo')}
                  onEditDimensionAxis={(id, axis) => handleOpenDimensionEditor(id, axis)}
                  hide3DLabels={!!editingDimensionsPieceId || didacticGuideOpen}
                  interactMode={interactMode}
                  onToggleDynamicPiece={handleToggleDynamicPiece}
                />
                {pieces.length === 0 && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none p-5">
                    <div className="cad-empty-state pointer-events-auto">
                      <div className="w-12 h-12 rounded-2xl bg-[#f0a144]/15 text-[#f0a144] flex items-center justify-center mx-auto">
                        <FilePlus2 className="w-6 h-6" />
                      </div>
                      <h2>Empieza tu mueble</h2>
                      <p>Crea cada tablero en milímetros o abre un módulo listo para modificar.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" className="cad-primary-button justify-center" onClick={addPiece}><Plus className="w-4 h-4" /> Nueva pieza</button>
                        <button type="button" className="cad-secondary-button justify-center" onClick={openShelfModuleDialog}><Box className="w-4 h-4" /> Estante con zócalo</button>
                      </div>
                    </div>
                  </div>
                )}
                <ThreeViewerOverlay 
                  pieces={pieces}
                  selectedPieceId={selectedPieceIds[0] || null}
                  selectedPieceIds={selectedPieceIds}
                  onSelectPiece={(id) => toggleSelection(id, false)}
                  onAddPiece={addPiece}
                  onUpdatePiece={updatePiece}
                  onDeletePiece={(id) => {
                     setDeleteConfirm({ type: 'selected' });
                  }}
                  onDuplicatePiece={(id) => {
                     const p = pieces.find(x => x.id === id);
                     if (p) {
                        const newPiece = { ...p, id: uuidv4(), position3D: [p.position3D[0], p.position3D[1], p.position3D[2]] as [number, number, number] };
                        setPieces(prev => [...prev, newPiece]);
                        setSelectedPieceIds([newPiece.id]);
                     }
                  }}
                  onGroupPieces={handleGroupPieces}
                  onUngroupPieces={handleUngroupPieces}
                  snapActive={snapActive}
                  onToggleSnap={() => setSnapActive(!snapActive)}
                  multiSelectMode={multiSelectMode}
                  onToggleMultiSelect={() => setMultiSelectMode(!multiSelectMode)}
                  transformMode={transformMode}
                  onChangeTransformMode={setTransformMode}
                  onUndo={undo}
                  onRedo={redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onOpenProperties={() => setMobileMenuOpen(true)}
                  interactMode={interactMode}
                  onToggleInteractMode={() => setInteractMode(!interactMode)}
                  onToggleAllDynamicPieces={handleToggleAllDynamicPieces}
                />
              </>
            ) : (
              <CutPlanViewer 
                pieces={pieces} 
                sheetConfig={sheetConfig} 
                onUpdateSheetConfig={setSheetConfig}
                selectedPieceIds={selectedPieceIds}
                toggleSelection={toggleSelection}
                updatePiece={updatePiece}
                onConsolidatePieces={consolidatePieces}
                setPieces={setPieces}
              />
            )}
          </main>

          <footer className="h-8 bg-[#15191e] border-t border-[#2a3139] flex items-center px-3 sm:px-4 justify-between text-[13px] sm:text-xs font-medium text-[#8e99a6] shrink-0">
             <div className="flex items-center gap-2 sm:gap-4">
               <span className="text-[#cbd3dc] flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> <span className="hidden sm:inline">Guardado automático</span></span>
               {activeDisplacement ? (
                 <div className="flex items-center gap-2 font-mono bg-[#0e1115] px-2 py-1 rounded-lg border border-[#f0a144]/50 text-[#f0a144]">
                   <span className="font-bold">
                     Movimiento: <span className="text-white font-black">{activeDisplacement.dist} mm</span>
                   </span>
                   <span className="text-[#b9c2cc] hidden sm:flex items-center gap-1.5 border-l border-[#3a424d] pl-2">
                     <span className="text-red-400 font-bold">ΔX: {activeDisplacement.dx > 0 ? `+${activeDisplacement.dx}` : activeDisplacement.dx}</span>
                     <span className="text-green-400 font-bold">ΔY: {activeDisplacement.dy > 0 ? `+${activeDisplacement.dy}` : activeDisplacement.dy}</span>
                     <span className="text-blue-400 font-bold">ΔZ: {activeDisplacement.dz > 0 ? `+${activeDisplacement.dz}` : activeDisplacement.dz}</span>
                   </span>
                 </div>
               ) : (
                 <span className="font-mono hidden sm:inline">{totalPieceCount} piezas · {groups.length} grupos</span>
               )}
             </div>
             <div className="flex items-center gap-2 sm:gap-4">
               <span className="hidden sm:inline">Unidades: milímetros</span>
               <span className="text-[#cbd3dc]">v0.9</span>
             </div>
          </footer>
        </div>

        {viewMode === '3d' ? (
          <aside className={"w-[min(92vw,340px)] bg-[#171b20] border-l border-[#2a3139] flex flex-col shrink-0 z-30 absolute right-0 top-0 bottom-0 transition-transform lg:relative lg:translate-x-0 shadow-2xl lg:shadow-none " + (mobileMenuOpen ? "translate-x-0" : "translate-x-full")}>
            
            <div className="min-h-14 bg-[#1d232a] border-b border-[#2a3139] flex items-center justify-between px-4 py-2 shrink-0 select-none">
              <div>
                <div className="text-sm font-bold text-white">Proyecto e inspector</div>
                <div className="text-[13px] text-[#8e99a6]">Selecciona una pieza para editarla</div>
              </div>
              <button type="button" className="cad-icon-button lg:hidden" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar propiedades">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5 p-2.5 bg-[#15191e] border-b border-[#2a3139] shrink-0">
              <button type="button" className="cad-secondary-button justify-center px-1" onClick={() => loadFileInputRef.current?.click()} title="Abrir proyecto JSON">
                <FolderOpen className="w-4 h-4" /> <span>Abrir</span>
              </button>
              <button type="button" className="cad-secondary-button justify-center px-1" onClick={handleSaveModel} title="Guardar copia editable">
                <Save className="w-4 h-4" /> <span>Guardar</span>
              </button>
              <button type="button" className="cad-secondary-button justify-center px-1" onClick={addPiece} title="Crear una pieza">
                <Plus className="w-4 h-4" /> <span>Pieza</span>
              </button>
              <button type="button" className="cad-secondary-button justify-center px-1" onClick={openShelfModuleDialog} title="Crear estante con zócalo">
                <Box className="w-4 h-4" /> <span>Módulo</span>
              </button>
            </div>

            {/* Scrollable Trays Area */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#111111] bg-[#1a1a1a]">
              
              {/* TRAY 1: ESQUEMA (OUTLINER) */}
              <div className="flex flex-col">
                <div 
                  onClick={() => toggleTray('esquema')}
                  className="h-7 bg-[#262626] hover:bg-[#2d2d2d] flex items-center justify-between px-2 cursor-pointer select-none transition-colors border-t border-[#3c3c3c]/30 border-b border-[#151515]"
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.esquema ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span>Piezas del proyecto</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#888888]">
                    <Layers className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="font-mono text-[11px] bg-[#111] px-1 rounded text-[#888]">
                      {totalPieceCount} piezas
                    </span>
                  </div>
                </div>

                {trayOpen.esquema && (
                  <div className="bg-[#1b2026] p-2.5 font-mono animate-in fade-in duration-100 max-h-[280px] overflow-y-auto">
                     <label className="relative block mb-2">
                       <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#74808d]" />
                       <input
                         type="search"
                         value={outlinerSearch}
                         onChange={(event) => setOutlinerSearch(event.target.value)}
                         placeholder="Buscar nombre, medida o material"
                         className="w-full bg-[#0f1317] border border-[#323a44] rounded-lg pl-8 pr-2 py-2 text-xs text-white outline-none focus:border-[#f0a144]"
                       />
                     </label>
                     <div className="flex items-center gap-1.5 px-2 py-1.5 text-[#d5dbe2] rounded-lg cursor-default group">
                       <Box className="w-3 h-3 text-[#f0a144]" />
                       <span className="text-xs font-semibold">Proyecto actual</span>
                     </div>
                     <div className="ml-4 space-y-0.5 mt-1 border-l border-[#333] pl-1">
                       {/* Groups */}
                       {groups.map(group => {
                         const groupPieces = pieces.filter(p => p.groupId === group.id && matchesOutlinerSearch(p));
                         if (normalizedOutlinerSearch && groupPieces.length === 0) return null;
                         const isGroupSelected = groupPieces.length > 0 && groupPieces.every(p => selectedPieceIds.includes(p.id));
                         
                         return (
                           <div key={group.id} className="space-y-0.5">
                              <div 
                                onClick={() => {
                                  const ids = groupPieces.map(p => p.id);
                                  setSelectedPieceIds(ids);
                                }}
                                className={"flex items-center group/item gap-2 px-2 py-0.5 text-[12px] rounded cursor-default " + (isGroupSelected ? "bg-[#3b4b5b] text-white outline outline-1 outline-[#3b82f6]" : "text-emerald-400/80 hover:bg-[#3d3d3d]")}
                              >
                                <Combine className="w-2.5 h-2.5 shrink-0" />
                                <input 
                                  value={group.name} 
                                  onChange={(e) => setGroups(prev => prev.map(g => g.id === group.id ? { ...g, name: e.target.value } : g))}
                                  className="bg-transparent border-none outline-none text-current italic font-bold truncate flex-1 min-w-0" 
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirm({ type: 'group', id: group.id, name: group.name });
                                  }}
                                  className="text-[#888] hover:text-red-400 shrink-0 px-1 transition-colors"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                              <div className="ml-4 space-y-0.5">
                                {groupPieces.map((piece, idx) => (
                                  <div 
                                    key={piece.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSelection(piece.id, e.shiftKey);
                                    }}
                                    className={"flex items-center group/piece gap-2 px-2 py-0.5 text-[12px] rounded cursor-default " + (selectedPieceIds.includes(piece.id) ? "bg-[#565656] text-white outline outline-1 outline-[#f0a144]" : "text-[#888888] hover:bg-[#3d3d3d]")}
                                  >
                                    <Box className="w-2 h-2 shrink-0" />
                                    <input 
                                      value={piece.name || ("Piece." + (idx+1))} 
                                      onChange={(e) => updatePiece(piece.id, { name: e.target.value })}
                                      className="bg-transparent border-none outline-none text-current truncate flex-1 min-w-0" 
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirm({ type: 'piece', id: piece.id, name: piece.name || ("Piece." + (idx+1)) });
                                      }}
                                      className="text-[#888] hover:text-red-400 shrink-0 px-1 transition-colors"
                                    >
                                      <Trash2 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                           </div>
                         )
                       })}

                       {/* Ungrouped Pieces */}
                       {pieces.filter(p => !p.groupId && matchesOutlinerSearch(p)).map((piece, idx) => (
                          <div 
                            key={piece.id}
                            onClick={(e) => toggleSelection(piece.id, e.shiftKey)}
                            className={"flex items-center group/piece gap-2 px-2 py-0.5 text-[12px] rounded cursor-default " + (selectedPieceIds.includes(piece.id) ? "bg-[#565656] text-white outline outline-1 outline-[#f0a144]" : "text-[#999999] hover:bg-[#3d3d3d]")}
                          >
                            <Box className="w-2.5 h-2.5 shrink-0" />
                            <input 
                              value={piece.name || ("Piece." + (idx+1))} 
                              onChange={(e) => updatePiece(piece.id, { name: e.target.value })}
                              className="bg-transparent border-none outline-none text-current truncate flex-1 min-w-0" 
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirm({ type: 'piece', id: piece.id, name: piece.name || ("Piece." + (idx+1)) });
                              }}
                              className="text-[#888] hover:text-red-400 shrink-0 px-1 transition-colors"
                              title="Eliminar pieza"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                       ))}
                     </div>
                  </div>
                )}
              </div>

              {/* TRAY 2: INFORMACIÓN DE LA ENTIDAD (ENTITY INFO) */}
              <div className="flex flex-col">
                <div 
                  onClick={() => toggleTray('entidad')}
                  className="h-7 bg-[#262626] hover:bg-[#2d2d2d] flex items-center justify-between px-2 cursor-pointer select-none transition-colors border-t border-[#3c3c3c]/30 border-b border-[#151515]"
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.entidad ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span>Medidas y posición</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-mono text-[#888888]">INFO</span>
                  </div>
                </div>

                {trayOpen.entidad && (
                  <div className="bg-[#1e1e1e] p-3 text-[12px] text-[#ccc] space-y-3 animate-in fade-in duration-100">
                    {selectedPieceIds.length > 0 ? (
                      <div className="space-y-3">
                        {/* Group info if any */}
                        {(() => {
                           const selectedPiece = pieces.find(p => p.id === selectedPieceIds[0]);
                           const group = groups.find(g => g.id === selectedPiece?.groupId);
                           if (group) {
                             return (
                               <div className="flex flex-col p-2 bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded space-y-1">
                                 <span className="text-[11px] font-black text-[#3b82f6] uppercase">Propiedades del Grupo</span>
                                 <div className="flex flex-col">
                                   <span className="text-[13px] text-[#888] mb-0.5 uppercase">Nombre grupo</span>
                                   <input 
                                     type="text" 
                                     value={group.name}
                                     onChange={(e) => {
                                       setGroups(prev => prev.map(g => g.id === group.id ? { ...g, name: e.target.value } : g));
                                     }}
                                     className="bg-[#111111] border border-[#333333] text-[12px] text-white px-1.5 py-0.5 rounded outline-none w-full focus:border-[#3b82f6]"
                                   />
                                 </div>
                               </div>
                             );
                           }
                           return null;
                        })()}

                        {/* Edit piece name */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[13px] font-bold text-[#888888] uppercase">Nombre de la pieza</label>
                          <input 
                            type="text" 
                            value={pieces.find(p => p.id === selectedPieceIds[0])?.name || ''}
                            onChange={(e) => updatePiece(selectedPieceIds[0], { name: e.target.value })}
                            className="bg-[#111111] border border-[#333333] text-[12px] text-white px-2 py-1 rounded outline-none focus:border-[#f0a144] w-full"
                          />
                        </div>

                        {/* Dimensions */}
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-bold text-[#888888] uppercase">Medidas de corte · mm</label>
                          <div className="grid grid-cols-1 gap-1">
                            <PropertyField 
                              label="Largo (X)" 
                              value={pieces.find(p => p.id === selectedPieceIds[0])?.largo || 0} 
                              onChange={(v) => updatePiece(selectedPieceIds[0], { largo: v })}
                              axis="x"
                            />
                            <PropertyField 
                              label="Espesor (Y)" 
                              value={pieces.find(p => p.id === selectedPieceIds[0])?.espesor || 0} 
                              onChange={(v) => updatePiece(selectedPieceIds[0], { espesor: v })}
                              axis="y"
                            />
                            <PropertyField 
                              label="Ancho (Z)" 
                              value={pieces.find(p => p.id === selectedPieceIds[0])?.ancho || 0} 
                              onChange={(v) => updatePiece(selectedPieceIds[0], { ancho: v })}
                              axis="z"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-[12px] text-[#666] py-3 italic">
                        Selecciona una pieza en el modelo o en la lista
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TRAY 3: MATERIALES (MATERIALS) */}
              <div className="flex flex-col">
                <div 
                  onClick={() => toggleTray('materiales')}
                  className="h-7 bg-[#262626] hover:bg-[#2d2d2d] flex items-center justify-between px-2 cursor-pointer select-none transition-colors border-t border-[#3c3c3c]/30 border-b border-[#151515]"
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.materiales ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span>Material y acabado</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-mono text-[#888888]">TABLERO</span>
                  </div>
                </div>

                {trayOpen.materiales && (
                  <div className="bg-[#1e1e1e] p-3 text-[12px] text-[#ccc] animate-in fade-in duration-100">
                    {selectedPieceIds.length > 0 ? (
                      (() => {
                        const p = pieces.find(pi => pi.id === selectedPieceIds[0]);
                        if (!p) return null;
                        const matName = p.material || 'Blanco';
                        const actualColor = p.customColor || (MATERIAL_MAP[matName]?.color || '#f8fafc');
                        const metVal = p.customMetalness !== undefined ? p.customMetalness : (matName === 'Custom' ? 0.0 : 0.05);
                        const roughVal = p.customRoughness !== undefined ? p.customRoughness : (matName === 'Custom' ? 0.4 : 0.35);

                        let feedbackText = "Melamina Satinada";
                        let tipText = "El acabado estándar ofrece un tacto agradable y disimula de forma óptima el polvo e imperfecciones ordinarias.";
                        
                        if (metVal > 0.4) {
                          feedbackText = "Reflectividad Metálica";
                          tipText = "🛠️ El acabado metálico simula perfiles de aluminio o láminas decorativas excelentes para marcos, pero en aserraderos reales es más complejo y costoso de cortar.";
                        } else if (roughVal < 0.18) {
                          feedbackText = "Brillante (High Gloss)";
                          tipText = "💡 El acabado brillante (alto brillo) otorga gran elegancia y es ideal para frentes de cocinas modernas, pero requiere un cuidado superior para evitar huellas diarias.";
                        } else if (roughVal >= 0.18 && roughVal <= 0.6) {
                          feedbackText = "Satinado / Melamina Estándar";
                          tipText = "💡 El acabado más comercial que simula vetas de maderas reales y oculta huellas dactilares cotidianas a la perfección.";
                        } else {
                          feedbackText = "Madera Cruda / Mate Natural";
                          tipText = "🪵 Simula tableros de MDF/MDP crudos o maderas de aserradero sin tratar. Absorbe agua instantáneamente si no se protege adecuadamente con cantos.";
                        }

                        const hasUnbandedEdges = p.cantos.largo1 === 'Ninguno' || p.cantos.largo2 === 'Ninguno' || p.cantos.ancho1 === 'Ninguno' || p.cantos.ancho2 === 'Ninguno';

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-1 text-[11px] font-bold text-[#888888]">
                              <span className="flex items-center gap-1 text-[#f0a144]">
                                ▼ Acabado visual
                              </span>
                              <span className="text-[#64748b] text-[11px] tracking-wider font-mono">VISTA 3D</span>
                            </div>

                            {/* Template dropdown */}
                            <div className="grid grid-cols-3 items-center gap-1.5">
                              <span className="text-[13px] font-bold text-[#88] uppercase text-right">Material</span>
                              <select 
                                value={matName}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  updatePiece(p.id, { 
                                    material: val,
                                    customColor: val === 'Custom' ? actualColor : undefined,
                                    customRoughness: val === 'Custom' ? roughVal : undefined,
                                    customMetalness: val === 'Custom' ? metVal : undefined
                                  });
                                }}
                                className="col-span-2 bg-[#111111] border border-[#33] rounded px-1.5 py-0.5 text-white text-[12px] outline-none cursor-pointer focus:border-[#f0a144]"
                              >
                                {Object.entries(getGroupedMaterials()).map(([brand, items]) => (
                                  <optgroup key={brand} label={brand} className="text-[#888] bg-[#111] font-bold">
                                    {items.map(item => (
                                      <option key={item.id} value={item.id} className="text-white bg-[#111] font-normal">
                                        {getMaterialEmoji(item.name)} {item.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                                <optgroup label="Avanzado" className="text-[#888] bg-[#111] font-bold">
                                  <option value="Custom" className="text-white bg-[#111] font-normal">🎨 Acabado personalizado</option>
                                </optgroup>
                              </select>
                            </div>

                            {/* Base Color Picker */}
                            <div className="grid grid-cols-3 items-center gap-1.5">
                              <span className="text-[13px] font-bold text-[#88] uppercase text-right">Color Base</span>
                              <div className="col-span-2 flex items-center gap-1.5">
                                <input 
                                  type="color" 
                                  value={actualColor}
                                  onChange={(e) => updatePiece(p.id, { customColor: e.target.value, material: 'Custom' })}
                                  className="w-5 h-5 bg-transparent border border-[#33] rounded cursor-pointer p-0 shrink-0"
                                />
                                <input 
                                  type="text" 
                                  value={actualColor.toUpperCase()}
                                  onChange={(e) => {
                                    let val = e.target.value;
                                    if (!val.startsWith('#')) val = '#' + val;
                                    if (val.length <= 7) {
                                      updatePiece(p.id, { customColor: val, material: 'Custom' });
                                    }
                                  }}
                                  className="flex-1 bg-[#111111] border border-[#33] text-[12px] font-mono text-center text-white py-0.5 rounded outline-none w-0 min-w-0 focus:border-[#f0a144]"
                                />
                              </div>
                            </div>

                            {/* Metalness Slider */}
                            <div className="grid grid-cols-3 items-center gap-1.5">
                              <span className="text-[13px] font-bold text-[#88] uppercase text-right">Reflejo</span>
                              <div className="col-span-2 flex items-center gap-1">
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="1" 
                                  step="0.01"
                                  value={metVal}
                                  onChange={(e) => updatePiece(p.id, { customMetalness: parseFloat(e.target.value), material: 'Custom' })}
                                  className="flex-1 h-1 bg-[#2e2e2e] rounded-lg cursor-pointer appearance-none accent-[#f0a144]"
                                />
                                <span className="text-[13px] font-mono text-[#88] w-6 text-right">{metVal.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Roughness Slider */}
                            <div className="grid grid-cols-3 items-center gap-1.5">
                              <span className="text-[13px] font-bold text-[#88] uppercase text-right">Textura mate</span>
                              <div className="col-span-2 flex items-center gap-1">
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="1" 
                                  step="0.01"
                                  value={roughVal}
                                  onChange={(e) => updatePiece(p.id, { customRoughness: parseFloat(e.target.value), material: 'Custom' })}
                                  className="flex-1 h-1 bg-[#2e2e2e] rounded-lg cursor-pointer appearance-none accent-[#f0a144]"
                                />
                                <span className="text-[13px] font-mono text-[#88] w-6 text-right">{roughVal.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* PBR Didactic Tips & Warnings */}
                            <div className="mt-1.5 pt-1.5 border-t border-[#2a2a2a] space-y-1">
                              <div className="flex justify-between items-center text-[13px] text-[#666]">
                                 <span>RESULTADO VISUAL:</span>
                                 <span className="text-[#f0a144] font-bold">{feedbackText}</span>
                              </div>
                              <p className="text-[13px] leading-snug text-[#999999] bg-[#111111] p-1.5 rounded border border-[#2b2b2b] italic">
                                {tipText}
                              </p>

                              {/* Edgebanding risk indicator */}
                              {hasUnbandedEdges && (
                                <div className="bg-amber-500/10 border border-amber-500/25 p-1.5 rounded text-[13px] text-amber-400 leading-snug">
                                  <strong>⚠️ Alerta de Fabricación:</strong> Esta pieza tiene cantos en aserrado visto (madera interna). El aglomerado sin tapar absorberá humedad y se hinchará. ¡Añade cantos (DEL / GRU) para sellarla!
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center text-[12px] text-[#666] py-3 italic">
                        Selecciona una pieza para ver sus materiales
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TRAY 4: PROCESOS Y CANTOS (Banding & Routing) */}
              <div className="flex flex-col">
                <div 
                  onClick={() => toggleTray('procesos')}
                  className="h-7 bg-[#262626] hover:bg-[#2d2d2d] flex items-center justify-between px-2 cursor-pointer select-none transition-colors border-t border-[#3c3c3c]/30 border-b border-[#151515]"
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.procesos ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span>Procesos y cantos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-mono text-[#888888]">CANTOS</span>
                  </div>
                </div>

                {trayOpen.procesos && (
                  <div className="bg-[#1e1e1e] p-3 text-[12px] text-[#ccc] space-y-2 animate-in fade-in duration-100">
                    {selectedPieceIds.length > 0 ? (
                      (() => {
                        const activePiece = pieces.find(p => p.id === selectedPieceIds[0]);
                        if (!activePiece) return null;
                        
                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-1">
                              <div 
                                className={"p-1.5 rounded border flex flex-col items-center gap-1 cursor-pointer transition-colors " + (activePiece.veta ? "bg-[#f0a144]/10 border-[#f0a144]" : "bg-[#1a1a1a] border-[#333333] hover:border-[#4d4d4d]")}
                                onClick={() => updatePiece(activePiece.id, { veta: !activePiece.veta })}
                              >
                                <span className="text-[11px] font-bold">VETA</span>
                                <span className="text-[11px] text-[#883] font-bold">{activePiece.veta ? 'SÍ' : 'NO'}</span>
                              </div>
                              <div 
                                className={"p-1.5 rounded border flex flex-col items-center gap-1 cursor-pointer transition-colors " + (activePiece.ranurado ? "bg-[#f0a144]/10 border-[#f0a144]" : "bg-[#1a1a1a] border-[#333333] hover:border-[#4d4d4d]")}
                                onClick={() => {
                                   const nextRanurado = !activePiece.ranurado;
                                   updatePiece(activePiece.id, { 
                                     ranurado: nextRanurado,
                                     ranuraConfig: nextRanurado ? (activePiece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8 }) : activePiece.ranuraConfig
                                   });
                                }}
                              >
                                <span className="text-[11px] font-bold">RANURA</span>
                                <span className="text-[11px] text-[#883] font-bold">{activePiece.ranurado ? 'SÍ' : 'NO'}</span>
                              </div>
                            </div>

                            {/* Slot details panel */}
                            {activePiece.ranurado && (() => {
                              const config = activePiece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8 };
                              
                              return (
                                <div className="mt-1 bg-[#141414] border border-[#232323] p-1.5 rounded space-y-1">
                                  <div className="flex items-center justify-between text-[11px] font-bold text-[#f0a144] uppercase border-b border-[#222] pb-0.5">
                                    <span>⚙️ Configuración de Ranura</span>
                                    <span className="text-[#64748b] text-[13px]">TALLER</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div className="flex flex-col gap-0.5">
                                      <label className="text-[#888] font-bold text-[13px] uppercase">LADO</label>
                                      <select 
                                        value={config.lado}
                                        onChange={(e) => updatePiece(activePiece.id, { 
                                          ranuraConfig: { ...config, lado: e.target.value as any } 
                                        })}
                                        className="bg-[#1e1e1e] border border-[#33] rounded px-1 py-0.5 text-white text-[11px] outline-none cursor-pointer focus:border-[#f0a144]"
                                      >
                                        <option value="L1">L1 (Largo Frente)</option>
                                        <option value="L2">L2 (Largo Atrás)</option>
                                        <option value="A1">A1 (Ancho Der)</option>
                                        <option value="A2">A2 (Ancho Izq)</option>
                                      </select>
                                    </div>
                                    
                                    <div className="flex flex-col gap-0.5">
                                      <label className="text-[#888] font-bold text-[13px] uppercase">DIST (mm)</label>
                                      <input 
                                        type="number" 
                                        value={config.dist}
                                        onChange={(e) => updatePiece(activePiece.id, { 
                                          ranuraConfig: { ...config, dist: parseFloat(e.target.value) || 0 } 
                                        })}
                                        className="bg-[#1e1e1e] border border-[#33] rounded px-1 py-0.5 text-white text-[11px] outline-none font-mono focus:border-[#f0a144]"
                                      />
                                    </div>
                                    
                                    <div className="flex flex-col gap-0.5">
                                      <label className="text-[#888] font-bold text-[13px] uppercase">ESP (mm)</label>
                                      <input 
                                        type="number" 
                                        value={config.esp}
                                        onChange={(e) => updatePiece(activePiece.id, { 
                                          ranuraConfig: { ...config, esp: parseFloat(e.target.value) || 0 } 
                                        })}
                                        className="bg-[#1e1e1e] border border-[#33] rounded px-1 py-0.5 text-white text-[11px] outline-none font-mono focus:border-[#f0a144]"
                                      />
                                    </div>
                                    
                                    <div className="flex flex-col gap-0.5">
                                      <label className="text-[#888] font-bold text-[13px] uppercase">PROF (mm)</label>
                                      <input 
                                        type="number" 
                                        value={config.prof}
                                        onChange={(e) => updatePiece(activePiece.id, { 
                                          ranuraConfig: { ...config, prof: parseFloat(e.target.value) || 0 } 
                                        })}
                                        className="bg-[#1e1e1e] border border-[#33] rounded px-1 py-0.5 text-white text-[11px] outline-none font-mono focus:border-[#f0a144]"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Edge Banding items */}
                            <div className="grid grid-cols-2 gap-x-1 gap-y-1 mt-2">
                              {(['largo1', 'largo2', 'ancho1', 'ancho2'] as (keyof EdgeConfig)[]).map((edge) => {
                                const val = activePiece.cantos[edge];
                                const borderColor = val === 'Canto Grueso' ? 'border-b-[#ef4444]' : val === 'Canto Delgado' ? 'border-b-[#3b82f6]' : 'border-b-transparent';
                                
                                return (
                                  <div key={edge} className={"flex flex-col bg-[#111111] p-1 border border-[#333333] rounded border-b-2 " + borderColor}>
                                    <span className="text-[11px] text-[#666666] font-black uppercase text-center">{edge === 'largo1' ? 'L1' : edge === 'largo2' ? 'L2' : edge === 'ancho1' ? 'A1' : 'A2'}</span>
                                    <select 
                                       value={val}
                                       onChange={(e) => updateEdge(activePiece.id, edge, e.target.value as any)}
                                       className="bg-transparent border-0 text-[11px] outline-none text-center appearance-none cursor-pointer text-[#cccccc] hover:text-white w-full"
                                    >
                                       <option value="Ninguno" className="bg-[#2e2e2e]">NO</option>
                                       <option value="Canto Delgado" className="bg-[#2e2e2e]">DEL (Azul)</option>
                                       <option value="Canto Grueso" className="bg-[#2e2e2e]">GRU (Rojo)</option>
                                    </select>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Independent Edge Banding Color */}
                            {(() => {
                              const hasCantos = activePiece.cantos.largo1 !== 'Ninguno' || 
                                                activePiece.cantos.largo2 !== 'Ninguno' || 
                                                activePiece.cantos.ancho1 !== 'Ninguno' || 
                                                activePiece.cantos.ancho2 !== 'Ninguno';
                              
                              if (!hasCantos) return null;

                              const matName = activePiece.material || 'Blanco';
                              const baseColor = activePiece.customColor || (MATERIAL_MAP[matName]?.color || '#f8fafc');

                              return (
                                <div className="space-y-2 mt-3 p-2 bg-[#161616] border border-[#2b2b2b] rounded">
                                  <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-1 text-[11px] font-bold text-[#888888]">
                                    <span className="flex items-center gap-1 text-[#f0a144]">
                                      🎨 Color de Cantos Independiente
                                    </span>
                                    <span className="text-[#64748b] text-[11px] tracking-wider font-mono">CLIENTE</span>
                                  </div>

                                  <div className="flex items-center justify-between text-[11px] py-0.5">
                                    <span className="text-[#aaa] font-bold">Personalizar color de cantos:</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={activePiece.cantoColor !== undefined}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            updatePiece(activePiece.id, { cantoColor: baseColor });
                                          } else {
                                            updatePiece(activePiece.id, { cantoColor: undefined });
                                          }
                                        }}
                                        className="sr-only peer"
                                      />
                                      <div className="w-6 h-3.5 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[#f0a144]"></div>
                                    </label>
                                  </div>

                                  {activePiece.cantoColor !== undefined && (
                                    <div className="space-y-1.5 pt-1.5 border-t border-[#222] animate-in slide-in-from-top-1 duration-150">
                                      <div className="grid grid-cols-3 items-center gap-1.5">
                                        <span className="text-[13px] font-bold text-[#888] uppercase text-right">Material</span>
                                        <select 
                                          value={(() => {
                                            const matchedKey = Object.keys(MATERIAL_MAP).find(
                                              key => MATERIAL_MAP[key].color.toLowerCase() === activePiece.cantoColor?.toLowerCase()
                                            );
                                            return matchedKey || 'Custom';
                                          })()}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val !== 'Custom') {
                                              updatePiece(activePiece.id, { cantoColor: MATERIAL_MAP[val].color });
                                            }
                                          }}
                                          className="col-span-2 bg-[#111111] border border-[#33] rounded px-1.5 py-0.5 text-white text-[12px] outline-none cursor-pointer focus:border-[#f0a144]"
                                        >
                                          {Object.entries(getGroupedMaterials()).map(([brand, items]) => (
                                            <optgroup key={brand} label={brand} className="text-[#888] bg-[#111] font-bold">
                                              {items.map(item => (
                                                <option key={item.id} value={item.id} className="text-white bg-[#111] font-normal">
                                                  {getMaterialEmoji(item.name)} {item.name}
                                                </option>
                                              ))}
                                            </optgroup>
                                          ))}
                                          <optgroup label="Avanzado" className="text-[#888] bg-[#111] font-bold">
                                            <option value="Custom" className="text-white bg-[#111] font-normal">🎨 Personalizado</option>
                                          </optgroup>
                                        </select>
                                      </div>

                                      <div className="grid grid-cols-3 items-center gap-1.5">
                                        <span className="text-[13px] font-bold text-[#888] uppercase text-right">Color Canto</span>
                                        <div className="col-span-2 flex items-center gap-1.5">
                                          <input 
                                            type="color" 
                                            value={activePiece.cantoColor}
                                            onChange={(e) => updatePiece(activePiece.id, { cantoColor: e.target.value })}
                                            className="w-5 h-5 bg-transparent border border-[#33] rounded cursor-pointer p-0 shrink-0"
                                          />
                                          <input 
                                            type="text" 
                                            value={activePiece.cantoColor.toUpperCase()}
                                            onChange={(e) => {
                                              let val = e.target.value;
                                              if (!val.startsWith('#')) val = '#' + val;
                                              if (val.length <= 7) {
                                                updatePiece(activePiece.id, { cantoColor: val });
                                              }
                                            }}
                                            className="flex-1 bg-[#111111] border border-[#33] text-[12px] font-mono text-center text-white py-0.5 rounded outline-none w-0 min-w-0 focus:border-[#f0a144]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Distribución y copias */}
                            <div className="mt-4 pt-3 border-t border-[#2a2a2a]/80 space-y-2.5">
                              <div className="flex items-center justify-between border-b border-[#2a2a2a]/40 pb-1 text-[11px] font-bold text-[#888888]">
                                <span className="flex items-center gap-1 text-[#f0a144]">
                                  <Combine className="w-3.5 h-3.5 text-[#f0a144]" />
                                  <span>▼ DISTRIBUIR Y REPETIR</span>
                                </span>
                                <span className="text-[#64748b] text-[11px] tracking-wider font-mono">MONTAJE</span>
                              </div>

                              {/* Toggle Mode */}
                              <div className="flex bg-[#111111] rounded p-0.5 border border-[#333333]">
                                <button
                                  type="button"
                                  onClick={() => setArrayMode('between')}
                                  className={`flex-1 py-1 rounded text-[11px] font-bold transition-all ${arrayMode === 'between' ? 'bg-[#565656] text-white shadow-sm' : 'hover:bg-[#222] text-[#888]'}`}
                                >
                                  Entre 2 Piezas
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setArrayMode('offset')}
                                  className={`flex-1 py-1 rounded text-[11px] font-bold transition-all ${arrayMode === 'offset' ? 'bg-[#565656] text-white shadow-sm' : 'hover:bg-[#222] text-[#888]'}`}
                                >
                                  Copias por paso
                                </button>
                              </div>

                              {arrayMode === 'between' ? (
                                <div className="space-y-2 animate-in fade-in duration-100">
                                  {selectedPieceIds.length < 2 ? (
                                    <p className="text-[13px] leading-snug text-amber-400 bg-amber-500/5 p-2 rounded border border-amber-500/15 italic">
                                      ⚠️ Selecciona exactamente 2 piezas (mantén pulsado Shift o activa Multiselección) para distribuir las repisas intermedias entre ellas.
                                    </p>
                                  ) : (
                                    <>
                                      <p className="text-[13px] text-[#999] leading-snug italic bg-[#151515] p-1.5 rounded border border-[#222]">
                                        Distribuye las repisas de manera equidistante entre las dos piezas seleccionadas en cualquier posición (3D automático).
                                      </p>
                                      
                                      <div className="grid grid-cols-3 items-center gap-1.5">
                                        <span className="text-[13px] font-bold text-[#888] uppercase text-right">Repisas</span>
                                        <div className="col-span-2 flex items-center gap-2">
                                          <input 
                                            type="number" 
                                            min="1"
                                            max="20"
                                            value={arrayCount}
                                            onChange={(e) => setArrayCount(Math.max(1, parseInt(e.target.value) || 1))}
                                            className="w-12 bg-[#111111] border border-[#333] rounded px-1.5 py-0.5 text-white text-[12px] outline-none text-center focus:border-[#f0a144] font-mono"
                                          />
                                          <span className="text-[13px] text-[#666] font-mono">
                                            ({arrayCount + 1} divisiones)
                                          </span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={executeDistribution}
                                        className="w-full py-1.5 rounded bg-[#f0a144] hover:bg-[#e09134] text-black text-[12px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                                      >
                                        <Combine className="w-3 h-3 text-black" />
                                        Distribuir Repisas
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2 animate-in fade-in duration-100">
                                  <p className="text-[13px] text-[#999] leading-snug italic bg-[#151515] p-1.5 rounded border border-[#222]">
                                    Duplica las piezas seleccionadas con una separación constante en el eje elegido.
                                  </p>

                                  {/* Axis Selector */}
                                  <div className="grid grid-cols-3 items-center gap-1.5">
                                    <span className="text-[13px] font-bold text-[#888] uppercase text-right">Eje</span>
                                    <select 
                                      value={arrayAxis}
                                      onChange={(e) => setArrayAxis(e.target.value as any)}
                                      className="col-span-2 bg-[#111111] border border-[#333] rounded px-1.5 py-0.5 text-white text-[12px] outline-none cursor-pointer focus:border-[#f0a144]"
                                    >
                                      <option value="Y">Eje Y (Espesor / Altura)</option>
                                      <option value="Z">Eje Z (Ancho / Profundidad)</option>
                                      <option value="X">Eje X (Largo / Lateral)</option>
                                    </select>
                                  </div>

                                  {/* Count Slider */}
                                  <div className="grid grid-cols-3 items-center gap-1.5">
                                    <span className="text-[13px] font-bold text-[#888] uppercase text-right">Cantidad</span>
                                    <div className="col-span-2 flex items-center gap-1.5">
                                      <input 
                                        type="range" 
                                        min="2" 
                                        max="15" 
                                        step="1"
                                        value={arrayCount}
                                        onChange={(e) => setArrayCount(parseInt(e.target.value))}
                                        className="flex-1 h-1 bg-[#2e2e2e] rounded-lg cursor-pointer appearance-none accent-[#f0a144]"
                                      />
                                      <span className="text-[13px] font-mono text-[#888] w-6 text-right">{arrayCount}</span>
                                    </div>
                                  </div>

                                  {/* Relative Offset Slider */}
                                  <div className="grid grid-cols-3 items-center gap-1.5">
                                    <span className="text-[13px] font-bold text-[#888] uppercase text-right">Offset Rel.</span>
                                    <div className="col-span-2 flex items-center gap-1.5">
                                      <input 
                                        type="range" 
                                        min="0.1" 
                                        max="5.0" 
                                        step="0.05"
                                        value={arrayOffset}
                                        onChange={(e) => setArrayOffset(parseFloat(e.target.value))}
                                        className="flex-1 h-1 bg-[#2e2e2e] rounded-lg cursor-pointer appearance-none accent-[#f0a144]"
                                      />
                                      <span className="text-[13px] font-mono text-[#888] w-8 text-right">{arrayOffset.toFixed(2)}x</span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={executeDistribution}
                                    className="w-full py-1.5 rounded bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[12px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3 h-3 text-white" />
                                    Crear copias
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center text-[12px] text-[#666] py-3 italic">
                        Selecciona una pieza para ver procesos y cantos
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Puertas y cajones interactivos */}
              <div className="flex flex-col">
                <div 
                  onClick={() => toggleTray('dinamico')}
                  className="h-7 bg-[#262626] hover:bg-[#2d2d2d] flex items-center justify-between px-2 cursor-pointer select-none transition-colors border-t border-[#3c3c3c]/30 border-b border-[#151515]"
                >
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.dinamico ? (
                      <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span className="text-purple-300">Puertas y cajones</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[13px] font-mono text-purple-400 font-bold bg-purple-950/40 px-1 py-0.5 rounded border border-purple-500/30">MOVIMIENTO</span>
                  </div>
                </div>

                {trayOpen.dinamico && (
                  <div className="bg-[#1e1e1e] p-3 text-[12px] text-[#ccc] space-y-2.5 animate-in fade-in duration-100">
                    {/* Global Actions */}
                    <div className="flex items-center gap-1.5 bg-purple-950/30 p-1.5 rounded border border-purple-500/20">
                      <button
                        type="button"
                        onClick={() => handleToggleAllDynamicPieces()}
                        className="flex-1 bg-purple-900/80 hover:bg-purple-800 text-purple-100 py-1 rounded text-[12px] font-bold flex items-center justify-center gap-1 transition-all shadow active:scale-95 cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Probar mueble</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleAutoTagDynamicPieces}
                        className="px-2 py-1 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-purple-300 rounded text-[11px] font-bold transition-colors border border-[#3c3c3c] cursor-pointer"
                        title="Auto-Detectar componentes basándose en nombres (Puertas / Cajones)"
                      >
                        Detectar por nombre
                      </button>
                    </div>

                    {selectedPieceIds.length > 0 ? (
                      (() => {
                        const activePiece = pieces.find(p => p.id === selectedPieceIds[0]);
                        if (!activePiece) return null;
                        const dyn = activePiece.dynamic;

                        return (
                          <div className="space-y-2 pt-1 border-t border-[#2a2a2a]">
                            <div className="flex flex-col gap-1">
                              <label className="text-[13px] font-bold text-purple-400 uppercase tracking-wider">
                                Movimiento de la pieza
                              </label>
                              <select
                                value={dyn ? (dyn.type === 'door' ? (dyn.doorType || 'single_left') : 'drawer') : 'none'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === 'none') {
                                    updatePiece(activePiece.id, { dynamic: undefined });
                                  } else if (val === 'drawer') {
                                    updatePiece(activePiece.id, {
                                      dynamic: {
                                        type: 'drawer',
                                        slideAxis: 'Z',
                                        slideDistance: Math.max(200, Math.round(activePiece.ancho * 0.85)),
                                        isOpen: false
                                      }
                                    });
                                  } else {
                                    const isLift = val === 'lift_up';
                                    const isRight = val === 'single_right';
                                    updatePiece(activePiece.id, {
                                      abisagrado: true,
                                      dynamic: {
                                        type: 'door',
                                        doorType: val as any,
                                        pivotPoint: isLift ? 'top' : isRight ? 'right' : 'left',
                                        openAngle: 95,
                                        isOpen: false
                                      }
                                    });
                                  }
                                }}
                                className="bg-[#111111] border border-purple-500/40 text-purple-200 text-[12px] font-bold px-2 py-1 rounded outline-none w-full focus:border-purple-400 cursor-pointer"
                              >
                                <option value="none">⚪ Estático (Pieza Fija)</option>
                                <option value="single_left">🚪 Puerta Batiente Izquierda (Bisagra Izq)</option>
                                <option value="single_right">🚪 Puerta Batiente Derecha (Bisagra Der)</option>
                                <option value="lift_up">🚪 Puerta Elevable Basculante (Bisagra Superior)</option>
                                <option value="drawer">🗄️ Cajón Deslizante (Corredera Riel Z)</option>
                              </select>
                            </div>

                            {dyn && (
                              <div className="bg-[#141414] border border-purple-500/30 p-2 rounded space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-black text-purple-300 uppercase">
                                    Estado Actual: <span className={dyn.isOpen ? 'text-green-400 font-bold' : 'text-gray-400'}>{dyn.isOpen ? 'ABIERTO' : 'CERRADO'}</span>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleDynamicPiece(activePiece.id)}
                                    className={`px-2.5 py-1 rounded text-[13px] font-bold transition-all shadow cursor-pointer ${
                                      dyn.isOpen 
                                        ? 'bg-amber-600/80 hover:bg-amber-500 text-white' 
                                        : 'bg-purple-700/80 hover:bg-purple-600 text-white'
                                    }`}
                                  >
                                    {dyn.isOpen ? 'Cerrar' : 'Abrir ⚡'}
                                  </button>
                                </div>

                                {dyn.type === 'door' ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-[13px] font-bold text-[#888]">
                                      <span>ÁNGULO MÁXIMO DE APERTURA:</span>
                                      <span className="text-purple-300 font-mono">{dyn.openAngle ?? 95}°</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="30"
                                      max="170"
                                      step="5"
                                      value={dyn.openAngle ?? 95}
                                      onChange={(e) => {
                                        const angle = parseInt(e.target.value);
                                        updatePiece(activePiece.id, {
                                          dynamic: { ...dyn, openAngle: angle }
                                        });
                                      }}
                                      className="w-full h-1 bg-[#2e2e2e] rounded-lg cursor-pointer appearance-none accent-purple-400"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-center text-[13px] font-bold text-[#888]">
                                      <span>DISTANCIA DE APERTURA (RIEL):</span>
                                      <span className="text-purple-300 font-mono">{dyn.slideDistance ?? 350} mm</span>
                                    </div>
                                    <input
                                      type="number"
                                      value={dyn.slideDistance ?? 350}
                                      onChange={(e) => {
                                        const dist = parseInt(e.target.value) || 200;
                                        updatePiece(activePiece.id, {
                                          dynamic: { ...dyn, slideDistance: dist }
                                        });
                                      }}
                                      className="bg-[#1e1e1e] border border-[#333] text-[12px] font-mono text-center text-white py-0.5 rounded outline-none w-full focus:border-purple-400"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center text-[12px] text-[#666] py-2 italic">
                        Selecciona una pieza para asignarle atributos de Puerta o Cajón Dinámico
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          </aside>
        ) : null}
      </div>

      {notice && (
        <div className="fixed top-[116px] md:top-[72px] left-1/2 -translate-x-1/2 z-[70] cad-toast" role="status">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 z-[65] bg-black/55 backdrop-blur-sm flex items-center justify-center p-5" role="status" aria-live="polite">
          <div className="cad-modal p-6 flex items-center gap-4 max-w-sm w-full">
            <Loader2 className="w-7 h-7 text-[#f0a144] animate-spin shrink-0" />
            <div>
              <div className="font-bold text-white">Analizando la imagen</div>
              <div className="text-sm text-[#9aa5b1] mt-1">Tu proyecto actual se mantiene hasta terminar.</div>
            </div>
          </div>
        </div>
      )}

      {moduleDialogOpen && (
        <div className="fixed inset-0 bg-black/65 z-[60] flex items-center justify-center p-3 sm:p-5 backdrop-blur-sm" role="presentation" onMouseDown={() => setModuleDialogOpen(false)}>
          <form
            className="cad-modal w-full max-w-3xl max-h-[92dvh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-module-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              createModuleFromDraft();
            }}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-[#303842]">
              <div>
                <div className="flex items-center gap-2 text-[#f0a144] text-xs font-bold uppercase tracking-wider mb-1"><Box className="w-4 h-4" /> Módulos</div>
                <h2 id="new-module-title" className="text-xl font-extrabold text-white">Estante paramétrico con zócalo</h2>
                <p className="text-sm text-[#9aa5b1] mt-1">Genera la estructura, repisas y divisiones lista para el despiece.</p>
              </div>
              <button type="button" className="cad-icon-button" onClick={() => setModuleDialogOpen(false)} aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <div className="cad-field-label">Variante inicial</div>
                <div className="grid grid-cols-3 gap-2">
                  {SHELF_MODULE_VARIANTS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      className={'cad-orientation-button ' + (moduleDraft.variant === preset.id ? 'is-active' : '')}
                      onClick={() => setModuleDraft(createShelfModuleDraft(preset.id))}
                    >
                      <Box className="w-6 h-6" />
                      <strong>{preset.label}</strong>
                      <small>{preset.help}</small>
                    </button>
                  ))}
                </div>
              </div>

              <label className="cad-field">
                <span>Nombre del módulo</span>
                <input autoFocus value={moduleDraft.name} onChange={(event) => setModuleDraft(draft => ({ ...draft, name: event.target.value }))} placeholder="Ej. Estante Wayra" />
              </label>

              <div>
                <div className="cad-field-label">Medidas exteriores</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <MeasurementInput label="Ancho" value={moduleDraft.width} onChange={(value) => setModuleDraft(draft => ({ ...draft, width: value }))} min={300} />
                  <MeasurementInput label="Alto" value={moduleDraft.height} onChange={(value) => setModuleDraft(draft => ({ ...draft, height: value }))} min={400} />
                  <MeasurementInput label="Fondo" value={moduleDraft.depth} onChange={(value) => setModuleDraft(draft => ({ ...draft, depth: value }))} min={150} />
                </div>
              </div>

              <div>
                <div className="cad-field-label">Construcción</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <MeasurementInput label="Espesor" value={moduleDraft.thickness} onChange={(value) => setModuleDraft(draft => ({ ...draft, thickness: value }))} min={9} />
                  <MeasurementInput label="Alto zócalo" value={moduleDraft.plinthHeight} onChange={(value) => setModuleDraft(draft => ({ ...draft, plinthHeight: value }))} min={40} />
                  <MeasurementInput label="Retiro zócalo" value={moduleDraft.plinthInset} onChange={(value) => setModuleDraft(draft => ({ ...draft, plinthInset: value }))} min={0} />
                  <MeasurementInput label="Repisas" value={moduleDraft.shelves} onChange={(value) => setModuleDraft(draft => ({ ...draft, shelves: value }))} min={0} unit="u." />
                  <MeasurementInput label="Divisiones verticales" value={moduleDraft.verticalDividers} onChange={(value) => setModuleDraft(draft => ({ ...draft, verticalDividers: value }))} min={0} unit="u." />
                  <label className="cad-field">
                    <span>Respaldo</span>
                    <select value={moduleDraft.back} onChange={(event) => setModuleDraft(draft => ({ ...draft, back: event.target.value as ShelfModuleBack }))}>
                      <option value="none">Sin respaldo</option>
                      <option value="mdf3">MDF 3 mm clavado</option>
                      <option value="melamine18">Melamina del mismo espesor</option>
                    </select>
                  </label>
                </div>
              </div>

              <label className="cad-field">
                <span>Material principal</span>
                <select value={moduleDraft.material} onChange={(event) => setModuleDraft(draft => ({ ...draft, material: event.target.value }))}>
                  {Object.entries(getGroupedMaterials()).map(([brand, items]) => (
                    <optgroup key={brand} label={brand}>
                      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className="rounded-xl border border-[#303842] bg-[#11161b] p-4 grid grid-cols-3 gap-3 text-center">
                <div><div className="text-xl font-extrabold text-white">{moduleDraft.verticalDividers + 1}</div><div className="text-xs text-[#8e99a6]">columnas</div></div>
                <div><div className="text-xl font-extrabold text-white">{moduleDraft.shelves + 1}</div><div className="text-xs text-[#8e99a6]">espacios altos</div></div>
                <div>
                  <div className="text-xl font-extrabold text-[#f0a144]">
                    {5 + moduleDraft.verticalDividers + moduleDraft.shelves * (moduleDraft.verticalDividers + 1) + (moduleDraft.back === 'none' ? 0 : 1)}
                  </div>
                  <div className="text-xs text-[#8e99a6]">piezas</div>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                Solo estructura abierta: no se crearán puertas ni cajones. Las repisas se separan por columnas para evitar cruces con las divisiones verticales.
              </div>
            </div>

            <div className="p-4 sm:p-5 bg-[#15191e] border-t border-[#303842] flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button type="button" className="cad-secondary-button justify-center" onClick={() => setModuleDialogOpen(false)}>Cancelar</button>
              <button type="submit" className="cad-primary-button justify-center"><Box className="w-4 h-4" /> Crear estante</button>
            </div>
          </form>
        </div>
      )}

      {newPieceDialogOpen && (
        <div className="fixed inset-0 bg-black/65 z-[60] flex items-center justify-center p-3 sm:p-5 backdrop-blur-sm" role="presentation" onMouseDown={() => setNewPieceDialogOpen(false)}>
          <form
            className="cad-modal w-full max-w-xl max-h-[92dvh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-piece-title"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              createPieceFromDraft();
            }}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-[#303842]">
              <div>
                <div className="flex items-center gap-2 text-[#f0a144] text-xs font-bold uppercase tracking-wider mb-1"><Plus className="w-4 h-4" /> Nueva pieza</div>
                <h2 id="new-piece-title" className="text-xl font-extrabold text-white">Define el tablero en milímetros</h2>
                <p className="text-sm text-[#9aa5b1] mt-1">Podrás moverlo, girarlo y editar sus cantos después.</p>
              </div>
              <button type="button" className="cad-icon-button" onClick={() => setNewPieceDialogOpen(false)} aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <label className="cad-field">
                <span>Nombre</span>
                <input autoFocus value={pieceDraft.name} onChange={(event) => setPieceDraft(draft => ({ ...draft, name: event.target.value }))} placeholder="Ej. Lateral izquierdo" />
              </label>

              <div>
                <div className="cad-field-label">Medidas de corte</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <MeasurementInput label="Largo" value={pieceDraft.largo} onChange={(value) => setPieceDraft(draft => ({ ...draft, largo: value }))} min={10} />
                  <MeasurementInput label="Ancho" value={pieceDraft.ancho} onChange={(value) => setPieceDraft(draft => ({ ...draft, ancho: value }))} min={10} />
                  <MeasurementInput label="Espesor" value={pieceDraft.espesor} onChange={(value) => setPieceDraft(draft => ({ ...draft, espesor: value }))} min={1} />
                  <MeasurementInput label="Cantidad" value={pieceDraft.cantidad} onChange={(value) => setPieceDraft(draft => ({ ...draft, cantidad: value }))} min={1} unit="u." />
                </div>
              </div>

              <div>
                <div className="cad-field-label">Cómo colocarla al crear</div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['horizontal', 'Horizontal', 'Base o repisa'],
                    ['lateral', 'Vertical', 'Lateral'],
                    ['frente', 'Frontal', 'Puerta o respaldo'],
                  ] as [PieceOrientation, string, string][]).map(([value, label, help]) => (
                    <button
                      key={value}
                      type="button"
                      className={`cad-orientation-button ${pieceDraft.orientation === value ? 'is-active' : ''}`}
                      onClick={() => setPieceDraft(draft => ({ ...draft, orientation: value }))}
                    >
                      <span className={`piece-orientation ${value}`} />
                      <strong>{label}</strong>
                      <small>{help}</small>
                    </button>
                  ))}
                </div>
              </div>

              <label className="cad-field">
                <span>Material</span>
                <select value={pieceDraft.material} onChange={(event) => setPieceDraft(draft => ({ ...draft, material: event.target.value }))}>
                  {Object.entries(getGroupedMaterials()).map(([brand, items]) => (
                    <optgroup key={brand} label={brand}>
                      {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>

            <div className="p-4 sm:p-5 bg-[#15191e] border-t border-[#303842] flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button type="button" className="cad-secondary-button justify-center" onClick={() => setNewPieceDialogOpen(false)}>Cancelar</button>
              <button type="submit" className="cad-primary-button justify-center"><Plus className="w-4 h-4" /> Crear y seleccionar pieza</button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl max-w-[280px] w-full p-5 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-white font-bold text-sm mb-2 text-center text-balance">¿Confirmar Eliminación?</h3>
            <p className="text-[#999] text-[13px] mb-6 text-center text-balance leading-relaxed">
              {deleteConfirm.type === 'all' && 'Se eliminarán todas las piezas y grupos del proyecto. Podrás recuperarlos con Deshacer.'}
              {deleteConfirm.type === 'selected' && `Se eliminarán las ${selectedPieceIds.length} piezas seleccionadas. Podrás recuperarlas con Deshacer.`}
              {deleteConfirm.type === 'group' && `Se eliminará el grupo "${deleteConfirm.name}" y sus piezas separadas.`}
              {deleteConfirm.type === 'piece' && `Se eliminará la pieza "${deleteConfirm.name}".`}
            </p>
            <div className="flex w-full gap-2">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-1.5 rounded border border-[#333] hover:bg-[#333] text-[#ccc] text-[12px] font-bold uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 py-1.5 rounded bg-red-500/80 hover:bg-red-500 text-white text-[12px] font-bold uppercase tracking-widest transition-colors"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Didactic Manufacturing & Materials Guide Modal */}
      {didacticGuideOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-[4px]">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-[#252525] border-b border-[#2d2d2d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-pink-500/15 flex items-center justify-center text-pink-400">
                  <Lightbulb className="w-4 h-4 text-pink-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Guía práctica de materiales y fabricación</h3>
                  <p className="text-[#888] text-[12px] uppercase tracking-wider font-mono">Decisiones reales de taller</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setDidacticGuideOpen(false)}
                className="text-gray-400 hover:text-white p-1 hover:bg-[#333] rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="p-5 overflow-y-auto space-y-5 text-[13px] leading-relaxed text-gray-300">
              
              {/* Concept 1 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-xs text-pink-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                  1. Textura y brillo de la melamina
                </h4>
                <p>
                  La textura visual ayuda a representar cómo refleja la luz cada tablero y a comunicar mejor el acabado al cliente:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div className="bg-[#141414] p-2 rounded border border-[#2b2b2b]">
                    <span className="text-pink-300 font-bold block text-[12px] uppercase">Alto brillo</span>
                    Espejado y sumamente elegante. Usado en cocinas de lujo y frentes de armarios modernos. 
                    <span className="text-amber-500/90 text-[12px] font-bold block mt-1">⚠️ Desventaja:</span> Es propenso a rayaduras de lija y marcas de huellas cotidianas.
                  </div>
                  <div className="bg-[#141414] p-2 rounded border border-[#2b2b2b]">
                    <span className="text-emerald-400 font-bold block text-[12px] uppercase">Satinado estándar</span>
                    La textura rugosa media es la reina de las melaminas. Imita la textura de la madera natural y los acabados lacados suaves.
                    <span className="text-emerald-500 text-[12px] font-bold block mt-1">✓ Ventaja:</span> Oculta rayones y manchas de grasa diaria de manera óptima.
                  </div>
                </div>
              </div>

              {/* Concept 2 */}
              <div className="space-y-1.5 border-t border-[#2e2e2e] pt-4">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-xs text-pink-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                  2. La Ley Física de los Cantos (Tapajuntas)
                </h4>
                <p>
                  Cuando cortas una placa de melamina queda expuesto el núcleo del tablero. Los cantos protegen ese borde y definen el acabado final.
                </p>
                <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-amber-400 text-[12px] flex items-start gap-2.5">
                  <span className="text-base leading-none">⚠️</span>
                  <div>
                    <strong>Peligro de Humedad:</strong> Un borde descubierto ("Ninguno / Visto" en el visor propiedades) expone la madera interna. Si entra en contacto con agua (como trapear el piso, vapores de cocinas o baños), el aserrín absorberá la humedad, hinchándose e inutilizando el mueble de modo definitivo.
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 font-mono text-[12px]">
                  <div className="bg-[#181818] p-2 rounded border border-[#252525]">
                    <span className="text-blue-400 font-bold">● Canto Delgado (0.4mm - 0.5mm):</span> Estética limpia y económica. Perfecto para laterales de cajoneras y estantería de guardado interior.
                  </div>
                  <div className="bg-[#181818] p-2 rounded border border-[#252525]">
                    <span className="text-red-400 font-bold">● Canto Grueso (2.0mm / PVC):</span> Absorbe golpes violentos diarios. Indispensable en cantos de frentes de puertas o cubiertas de escritorios de uso constante.
                  </div>
                </div>
              </div>

              {/* Concept 3 */}
              <div className="space-y-1.5 border-t border-[#2e2e2e] pt-4">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-xs text-pink-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                  3. Dirección de Veta (Madera Texturada)
                </h4>
                <p>
                  Las melaminas con simulación de madera real tienen una dirección o sentido del dibujo natural ("Veta"). El patrón de la madera siempre corre en el sentido de la dimensión mayor **(Largo)** de la pieza por defecto. Si desactiva la veta, la pieza se considerará lisa (unicolor) y optimizará mejor los giros en la placa de corte.
                </p>
              </div>

              {/* Tips for Best Usage */}
              <div className="bg-pink-900/10 border border-pink-500/20 p-3 rounded-xl space-y-1 text-pink-300">
                <h5 className="font-bold text-xs">🎓 Práctica recomendada para estudiantes y diseñadores:</h5>
                <ul className="list-disc list-inside space-y-1 pl-1 text-[12px] leading-relaxed">
                  <li>Antes de mandar a fabricar las piezas, repasa el despiece de los cantos para asegurar que no queden orillas descubiertas que se puedan inundar.</li>
                  <li>Intenta agrupar las piezas por materiales personalizados usando el mismo color hexadecimal para que el optimizador de corte genere placas homogéneas.</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-[#252525] border-t border-[#2d2d2d] flex justify-end">
              <button 
                type="button"
                onClick={() => setDidacticGuideOpen(false)}
                className="bg-pink-600 hover:bg-pink-500 text-white font-bold text-[12px] py-1.5 px-4 rounded-lg uppercase tracking-wider select-none transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE CLICK / SIDE SPECIFIC DIMENSION EDITOR MODAL */}
      {editingDimensionsPieceId && (() => {
        const p = pieces.find(x => x.id === editingDimensionsPieceId);
        if (!p) return null;

        const applyDimensionChanges = () => {
          const targetLargo = Math.max(10, tempLargo);
          const targetAncho = Math.max(10, tempAncho);
          const targetEspesor = Math.max(1, tempEspesor);

          const dLargo = targetLargo - p.largo;
          const dAncho = targetAncho - p.ancho;
          const dEspesor = targetEspesor - p.espesor;

          let shiftX = 0;
          let shiftY = 0;
          let shiftZ = 0;

          if (anchorDirection === 'neg') {
            // Anchor negative face -> grows towards positive direction
            shiftX = (dLargo / 2) * 0.001;
            shiftY = (dEspesor / 2) * 0.001;
            shiftZ = (dAncho / 2) * 0.001;
          } else if (anchorDirection === 'pos') {
            // Anchor positive face -> grows towards negative direction
            shiftX = (-dLargo / 2) * 0.001;
            shiftY = (-dEspesor / 2) * 0.001;
            shiftZ = (-dAncho / 2) * 0.001;
          } else {
            // center -> grows symmetrically
            shiftX = 0;
            shiftY = 0;
            shiftZ = 0;
          }

          const euler = new THREE.Euler(p.rotation3D[0], p.rotation3D[1], p.rotation3D[2], 'XYZ');
          const localShift = new THREE.Vector3(shiftX, shiftY, shiftZ);
          localShift.applyEuler(euler);

          updatePiece(editingDimensionsPieceId, {
            largo: targetLargo,
            ancho: targetAncho,
            espesor: targetEspesor,
            position3D: [
              p.position3D[0] + localShift.x * 1000,
              p.position3D[1] + localShift.y * 1000,
              p.position3D[2] + localShift.z * 1000
            ]
          });

          setEditingDimensionsPieceId(null);
          showNotice('Medidas actualizadas y posición conservada');
        };

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-center justify-center p-4 pointer-events-auto select-none">
            <div className="bg-[#1e1e1e] border border-[#383838] rounded-2xl max-w-md w-full shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden font-sans text-gray-200 animate-in zoom-in-95 duration-150">
              
              {/* Header */}
              <div className="bg-[#2a2a2a] border-b border-[#111] px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Ruler className="w-4 h-4 text-[#f0a144]" />
                  <span className="text-xs font-black uppercase tracking-wider">Ajuste de Dimensión por Lado</span>
                </div>
                <button 
                  onClick={() => setEditingDimensionsPieceId(null)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  <span className="text-sm font-bold">✕</span>
                </button>
              </div>

              {/* Axis Selector Tabs */}
              <div className="bg-[#161616] border-b border-[#2d2d2d] p-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setEditingAxis('largo')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    editingAxis === 'largo'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-md'
                      : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#2c2c2c] border border-transparent'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Largo (X): {tempLargo}mm
                </button>

                <button
                  type="button"
                  onClick={() => setEditingAxis('ancho')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    editingAxis === 'ancho'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-md'
                      : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#2c2c2c] border border-transparent'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Ancho (Z): {tempAncho}mm
                </button>

                <button
                  type="button"
                  onClick={() => setEditingAxis('espesor')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    editingAxis === 'espesor'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/50 shadow-md'
                      : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#2c2c2c] border border-transparent'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Espesor (Y): {tempEspesor}mm
                </button>
              </div>

              {/* Main Active Axis Controls */}
              <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Piece Title Banner */}
                <div className="bg-[#141414] p-3 rounded-xl border border-[#2b2b2b] flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black uppercase text-[#888]">Pieza Activa</span>
                    <span className="text-[13px] font-bold text-white uppercase truncate max-w-[200px]">{p.name || 'Nueva Pieza'}</span>
                  </div>
                  <span className="text-[12px] font-mono font-bold text-[#f0a144] bg-[#f0a144]/10 border border-[#f0a144]/20 px-2.5 py-1 rounded-lg">
                    {tempLargo} x {tempAncho} x {tempEspesor} mm
                  </span>
                </div>

                {/* EDITING LARGO (X) */}
                {editingAxis === 'largo' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="bg-red-950/20 border border-red-500/30 p-3 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Modificar Largo (X)
                        </span>
                        <span className="text-[12px] font-mono text-gray-400">Dimensión X</span>
                      </div>

                      {/* Number input and increment buttons */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setTempLargo(prev => Math.max(10, prev - 50))}
                          className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-red-500/30 text-xs font-bold rounded-lg text-red-300 active:scale-95 transition-all cursor-pointer"
                        >
                          -50
                        </button>
                        <button 
                          type="button"
                          onClick={() => setTempLargo(prev => Math.max(10, prev - 10))}
                          className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-red-500/30 text-xs font-bold rounded-lg text-red-300 active:scale-95 transition-all cursor-pointer"
                        >
                          -10
                        </button>
                        
                        <div className="relative flex-1">
                          <input 
                            type="number"
                            value={tempLargo === 0 ? '' : tempLargo}
                            onChange={(e) => setTempLargo(parseInt(e.target.value) || 0)}
                            className="w-full bg-[#0d0d0d] border-2 border-red-500/60 focus:border-red-400 text-white text-base font-mono font-black text-center py-1.5 rounded-lg outline-none transition-colors"
                          />
                          <span className="absolute right-2 top-2.5 text-[12px] font-bold text-gray-500 select-none">mm</span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => setTempLargo(prev => prev + 10)}
                          className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-red-500/30 text-xs font-bold rounded-lg text-red-300 active:scale-95 transition-all cursor-pointer"
                        >
                          +10
                        </button>
                        <button 
                          type="button"
                          onClick={() => setTempLargo(prev => prev + 50)}
                          className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-red-500/30 text-xs font-bold rounded-lg text-red-300 active:scale-95 transition-all cursor-pointer"
                        >
                          +50
                        </button>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[300, 450, 600, 800, 1200, 2440].map(val => (
                          <button
                            key={`largo-${val}`}
                            type="button"
                            onClick={() => setTempLargo(val)}
                            className={`text-[12px] font-mono font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                              tempLargo === val 
                                ? 'bg-red-500 text-white border-red-400 font-black shadow' 
                                : 'bg-[#181818] border-[#2e2e2e] hover:border-red-500/50 text-gray-400 hover:text-white'
                            }`}
                          >
                            {val} mm
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Anchoring / Direction Controls */}
                    <div className="bg-[#141414] border border-[#2b2b2b] p-3 rounded-xl space-y-2">
                      <span className="text-[12px] font-black uppercase tracking-wider text-gray-300 flex items-center justify-between">
                        <span>Lado Anclado / Dirección de Crecimiento</span>
                        <span className="text-[11px] font-normal text-gray-500">(Fija un extremo)</span>
                      </span>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setAnchorDirection('neg')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'neg'
                              ? 'bg-red-500/20 border-red-500 text-red-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">⬅ Izquierda</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Izq (-X)<br/>Crece a Der (+X)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAnchorDirection('center')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'center'
                              ? 'bg-red-500/20 border-red-500 text-red-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">↔ Centro</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Centro<br/>Crece en Ambos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAnchorDirection('pos')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'pos'
                              ? 'bg-red-500/20 border-red-500 text-red-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">Derecha ➔</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Der (+X)<br/>Crece a Izq (-X)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* EDITING ANCHO (Z) */}
                {editingAxis === 'ancho' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="bg-blue-950/20 border border-blue-500/30 p-3 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /> Modificar Ancho (Z)
                        </span>
                        <span className="text-[12px] font-mono text-gray-400">Dimensión Z</span>
                      </div>

                      {/* Number input and increment buttons */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setTempAncho(prev => Math.max(10, prev - 50))}
                          className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-blue-500/30 text-xs font-bold rounded-lg text-blue-300 active:scale-95 transition-all cursor-pointer"
                        >
                          -50
                        </button>
                        <button 
                          type="button"
                          onClick={() => setTempAncho(prev => Math.max(10, prev - 10))}
                          className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-blue-500/30 text-xs font-bold rounded-lg text-blue-300 active:scale-95 transition-all cursor-pointer"
                        >
                          -10
                        </button>
                        
                        <div className="relative flex-1">
                          <input 
                            type="number"
                            value={tempAncho === 0 ? '' : tempAncho}
                            onChange={(e) => setTempAncho(parseInt(e.target.value) || 0)}
                            className="w-full bg-[#0d0d0d] border-2 border-blue-500/60 focus:border-blue-400 text-white text-base font-mono font-black text-center py-1.5 rounded-lg outline-none transition-colors"
                          />
                          <span className="absolute right-2 top-2.5 text-[12px] font-bold text-gray-500 select-none">mm</span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => setTempAncho(prev => prev + 10)}
                          className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-blue-500/30 text-xs font-bold rounded-lg text-blue-300 active:scale-95 transition-all cursor-pointer"
                        >
                          +10
                        </button>
                        <button 
                          type="button"
                          onClick={() => setTempAncho(prev => prev + 50)}
                          className="px-2.5 py-1.5 bg-[#252525] hover:bg-[#333] border border-blue-500/30 text-xs font-bold rounded-lg text-blue-300 active:scale-95 transition-all cursor-pointer"
                        >
                          +50
                        </button>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[300, 400, 450, 500, 600, 1220].map(val => (
                          <button
                            key={`ancho-${val}`}
                            type="button"
                            onClick={() => setTempAncho(val)}
                            className={`text-[12px] font-mono font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                              tempAncho === val 
                                ? 'bg-blue-500 text-white border-blue-400 font-black shadow' 
                                : 'bg-[#181818] border-[#2e2e2e] hover:border-blue-500/50 text-gray-400 hover:text-white'
                            }`}
                          >
                            {val} mm
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Anchoring / Direction Controls */}
                    <div className="bg-[#141414] border border-[#2b2b2b] p-3 rounded-xl space-y-2">
                      <span className="text-[12px] font-black uppercase tracking-wider text-gray-300 flex items-center justify-between">
                        <span>Lado Anclado / Dirección de Crecimiento</span>
                        <span className="text-[11px] font-normal text-gray-500">(Fija un extremo)</span>
                      </span>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setAnchorDirection('neg')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'neg'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">⬆ Atrás</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Atrás (-Z)<br/>Crece Adelante</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAnchorDirection('center')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'center'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">↔ Centro</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Centro<br/>Crece en Ambos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAnchorDirection('pos')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'pos'
                              ? 'bg-blue-500/20 border-blue-500 text-blue-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">Adelante ⬇</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Adelante (+Z)<br/>Crece Atrás</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* EDITING ESPESOR (Y) */}
                {editingAxis === 'espesor' && (
                  <div className="space-y-4 animate-in fade-in duration-150">
                    <div className="bg-green-950/20 border border-green-500/30 p-3 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-green-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Modificar Espesor (Y)
                        </span>
                        <span className="text-[12px] font-mono text-gray-400">Dimensión Y</span>
                      </div>

                      {/* Number input and increment buttons */}
                      <div className="flex items-center gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setTempEspesor(prev => Math.max(1, prev - 1))}
                          className="px-3 py-1.5 bg-[#252525] hover:bg-[#333] border border-green-500/30 text-xs font-bold rounded-lg text-green-300 active:scale-95 transition-all cursor-pointer"
                        >
                          -1
                        </button>
                        
                        <div className="relative flex-1">
                          <input 
                            type="number"
                            value={tempEspesor === 0 ? '' : tempEspesor}
                            onChange={(e) => setTempEspesor(parseInt(e.target.value) || 0)}
                            className="w-full bg-[#0d0d0d] border-2 border-green-500/60 focus:border-green-400 text-white text-base font-mono font-black text-center py-1.5 rounded-lg outline-none transition-colors"
                          />
                          <span className="absolute right-2 top-2.5 text-[12px] font-bold text-gray-500 select-none">mm</span>
                        </div>

                        <button 
                          type="button"
                          onClick={() => setTempEspesor(prev => prev + 1)}
                          className="px-3 py-1.5 bg-[#252525] hover:bg-[#333] border border-green-500/30 text-xs font-bold rounded-lg text-green-300 active:scale-95 transition-all cursor-pointer"
                        >
                          +1
                        </button>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {[15, 18, 25, 36].map(val => (
                          <button
                            key={`espesor-${val}`}
                            type="button"
                            onClick={() => setTempEspesor(val)}
                            className={`text-[12px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                              tempEspesor === val 
                                ? 'bg-green-500 text-white border-green-400 font-black shadow' 
                                : 'bg-[#181818] border-[#2e2e2e] hover:border-green-500/50 text-gray-400 hover:text-white'
                            }`}
                          >
                            {val} mm
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Anchoring / Direction Controls */}
                    <div className="bg-[#141414] border border-[#2b2b2b] p-3 rounded-xl space-y-2">
                      <span className="text-[12px] font-black uppercase tracking-wider text-gray-300 flex items-center justify-between">
                        <span>Lado Anclado / Dirección de Crecimiento</span>
                        <span className="text-[11px] font-normal text-gray-500">(Fija un extremo)</span>
                      </span>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setAnchorDirection('neg')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'neg'
                              ? 'bg-green-500/20 border-green-500 text-green-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">⬇ Abajo</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Abajo (-Y)<br/>Crece Arriba (+Y)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAnchorDirection('center')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'center'
                              ? 'bg-green-500/20 border-green-500 text-green-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">↔ Centro</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Centro<br/>Crece en Ambos</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAnchorDirection('pos')}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                            anchorDirection === 'pos'
                              ? 'bg-green-500/20 border-green-500 text-green-300 font-bold shadow'
                              : 'bg-[#1c1c1c] border-[#2d2d2d] text-gray-400 hover:text-white hover:bg-[#252525]'
                          }`}
                        >
                          <span className="text-xs font-black">Arriba ⬆</span>
                          <span className="text-[11px] leading-tight text-gray-400">Ancla Arriba (+Y)<br/>Crece Abajo (-Y)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3.5 bg-[#252525] border-t border-[#2d2d2d] flex justify-end gap-2 shrink-0">
                <button 
                  type="button"
                  onClick={() => setEditingDimensionsPieceId(null)}
                  className="bg-[#3a3a3a] hover:bg-[#4d4d4d] text-[#cccccc] font-bold text-[12px] py-2 px-4 rounded-xl uppercase tracking-wider select-none transition-all active:scale-95 cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={applyDimensionChanges}
                  className="bg-[#f0a144] hover:bg-[#f2b05e] text-[#111111] font-black text-[12px] py-2 px-5 rounded-xl uppercase tracking-wider select-none transition-all active:scale-95 shadow-lg shadow-[#f0a144]/15 cursor-pointer"
                >
                  Aplicar Dimensión
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}

function ToolbarIcon({ icon, label, title, active, disabled, onClick }: { icon: any, label: string, title: string, active?: boolean, disabled?: boolean, onClick?: () => void }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`cad-tool-button ${active ? 'is-active' : ''}`}
    >
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
      <span>{label}</span>
    </button>
  );
}

function MeasurementInput({ label, value, onChange, min, unit = 'mm' }: { label: string, value: number, onChange: (value: number) => void, min: number, unit?: string }) {
  return (
    <label className="cad-measurement-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          inputMode="decimal"
          min={min}
          step="1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          onFocus={(event) => event.currentTarget.select()}
        />
        <small>{unit}</small>
      </div>
    </label>
  );
}

function PropertyField({ label, value, onChange, axis }: { label: string, value: number, onChange: (v: number) => void, axis: 'x' | 'y' | 'z' }) {
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startValue = useRef(0);
  const axisColor = axis === 'x' ? 'bg-[#da3c3c]' : axis === 'y' ? 'bg-[#3cda3c]' : 'bg-[#3c3cda]';
  const minimum = axis === 'y' ? 1 : 10;

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only trigger if clicking the label/area, not the input itself if we want both
    // Actually Blender allows dragging the whole field
    setIsDragging(true);
    startX.current = e.clientX;
    startValue.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - startX.current;
    // Sensitivity: 1 unit per pixel? Maybe slower for precision
    const newValue = Math.max(minimum, startValue.current + delta);
    onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`flex items-center bg-[#1a1a1a] rounded overflow-hidden border border-[#333333] group focus-within:border-[#f0a144] cursor-ew-resize select-none ${isDragging ? 'border-[#f0a144]' : ''}`}
    >
      <div className={`w-1 self-stretch ${axisColor}`} />
      <span className="text-[11px] text-[#666666] font-black w-20 px-2 uppercase truncate pointer-events-none">{label}</span>
      <input 
        type="number"
        min={minimum}
        step="1"
        value={value === 0 ? '' : Math.round(value)}
        onChange={(e) => onChange(Math.max(minimum, parseFloat(e.target.value) || minimum))}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-1 bg-transparent text-[12px] text-[#cccccc] font-mono px-2 py-1 outline-none text-right cursor-text"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
