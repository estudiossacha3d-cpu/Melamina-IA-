import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Upload, Save, FolderOpen, Box, Download, Settings, Loader2, Menu, X, Plus, Trash2, Combine, Ungroup, Layers, Search, Filter, Lightbulb, ChevronDown, ChevronRight, ChevronLeft, PanelRight, Ruler, Package, Sliders, RotateCcw, RotateCw, FileSpreadsheet, FileText, Check, Copy, ArrowUp, ArrowDown, ArrowRight, ArrowLeft, Move, Expand, CornerDownLeft, Palette, Image as ImageIcon, Eye, EyeOff, GripHorizontal, Maximize2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';
import { interpretFurnitureImage } from './lib/gemini';
import { Piece, EdgeConfig, Group3D, FurnitureCatalogItem, EdgeThicknessConfig, PieceFaceKey } from './types';
import { DEFAULT_EDGE_THICKNESS_CONFIG, calculatePieceCutDimensions } from './lib/edgeCalculations';
import { FredoStretchAxis, FredoStretchMode, calculateFredoStretch, computePiecesBoundingBoxMm } from './lib/fredoStretch';
import ThreeViewer, { MATERIAL_MAP, getMaterialEmoji, getGroupedMaterials } from './components/ThreeViewer';
import CutPlanViewer from './components/CutPlanViewer';
import ThreeViewerOverlay from './components/ThreeViewerOverlay';
import FurnitureWarehouse from './components/FurnitureWarehouse';
import TextureEditorModal from './components/TextureEditorModal';
import TextureCompactBar from './components/TextureCompactBar';
import MaterialBrowserModal from './components/MaterialBrowserModal';
import { calculateSnapToFloorDeltaY } from './lib/geometry3D';
import { useDraggableWindow } from './hooks/useDraggableWindow';
import { DEFAULT_FURNITURE_CATEGORIES, DEFAULT_FURNITURE_CATALOG } from './data/defaultFurniture';
import { SmartStretchToolbar } from './components/SmartStretchToolbar';

type ViewMode = '3d' | '2d' | 'warehouse';

interface AppState {
  pieces: Piece[];
  groups: Group3D[];
}

const AUTOSAVE_STORAGE_KEY = 'iamueble_project_autosave_v1';

function getInitialAppState(): AppState {
  try {
    const saved = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.pieces) && parsed.pieces.length > 0) {
        return {
          pieces: parsed.pieces,
          groups: Array.isArray(parsed.groups) ? parsed.groups : []
        };
      }
    }
  } catch (err) {
    console.warn('Could not read autosaved app state:', err);
  }
  return { pieces: [], groups: [] };
}

function useAppHistory(initialState: AppState | (() => AppState)) {
  const [state, setStateInternal] = useState<AppState>(initialState);
  const historyRef = useRef<AppState[]>([typeof initialState === 'function' ? initialState() : initialState]);
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

export default function App() {
  const [appState, setAppState, undo, redo, canUndo, canRedo] = useAppHistory(getInitialAppState);
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
  const [isTrayOpen, setIsTrayOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const setMobileMenuOpen = setIsTrayOpen;
  const mobileMenuOpen = isTrayOpen;

  const { 
    position: trayPosition, 
    size: traySize, 
    dragProps: trayDragProps,
    resizeCornerProps: trayResizeCornerProps,
    resizeRightProps: trayResizeRightProps,
    resizeBottomProps: trayResizeBottomProps 
  } = useDraggableWindow({
    storageKey: 'iamueble_tray_win_pos',
    defaultPosition: () => ({
      x: typeof window !== 'undefined' ? Math.max(10, window.innerWidth - (window.innerWidth < 640 ? 275 : 340)) : 800,
      y: 45
    }),
    defaultSize: () => ({
      width: typeof window !== 'undefined' && window.innerWidth < 640 ? 260 : 320,
      height: typeof window !== 'undefined' && window.innerWidth < 640 ? 320 : 420
    }),
    minWidth: 190,
    minHeight: 140
  });
  const [sheetConfig, setSheetConfig] = useState<{ width: number; height: number; kerf: number; margin: number }>({
    width: 2440,
    height: 2140,
    kerf: 3,
    margin: 10
  });
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale' | 'texture' | 'stretch'>('translate');
  const [snapActive, setSnapActive] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // FredoScale Box Stretch state (estirar sin deformar espesor)
  const [fredoAxis, setFredoAxis] = useState<FredoStretchAxis>('X');
  const [fredoMode, setFredoMode] = useState<FredoStretchMode>('anchor-neg');
  const [fredoPlaneRatio, setFredoPlaneRatio] = useState<number>(0.5);
  const [fredoPreviewDelta, setFredoPreviewDelta] = useState<number>(0);
  const [fredoInputText, setFredoInputText] = useState<string>('');
  const [didacticGuideOpen, setDidacticGuideOpen] = useState(false);
  const [activeDisplacement, setActiveDisplacement] = useState<{ dx: number; dy: number; dz: number; dist: number; isDragging?: boolean; isFloorSnapped?: boolean } | null>(null);
  const [activeRotation, setActiveRotation] = useState<{ dRotX: number; dRotY: number; dRotZ: number; angle: number; axis?: string; isDragging?: boolean } | null>(null);
  const [activeScaling, setActiveScaling] = useState<{ largo: number; ancho: number; espesor: number; axis?: 'largo' | 'ancho' | 'espesor'; delta?: number; isDragging?: boolean; isSnapped?: boolean; pieceId?: string } | null>(null);
  
  // Custom texture editor state
  const [textureEditingPieceId, setTextureEditingPieceId] = useState<string | null>(null);
  const [isTextureModalOpen, setIsTextureModalOpen] = useState<boolean>(false);
  const [activeTextureFace, setActiveTextureFace] = useState<PieceFaceKey | 'all'>('all');

  const handleOpenTextureEditor = (pieceId?: string, faceKey?: PieceFaceKey) => {
    let targetId = pieceId;
    if (!targetId && selectedPieceIds.length > 0) {
      targetId = selectedPieceIds[0];
    }
    if (!targetId && pieces.length > 0) {
      targetId = pieces[0].id;
      setSelectedPieceIds([targetId]);
    }
    if (!targetId) {
      showToast('Agrega una pieza primero para aplicar texturas');
      return;
    }
    setTextureEditingPieceId(targetId);
    setActiveTextureFace(faceKey || 'all');
    setIsTextureModalOpen(true);
  };

  useEffect(() => {
    let animId: number | null = null;
    let pendingDisp: any = null;
    let pendingRot: any = null;
    let pendingScale: any = null;

    const handleDisplacement = (e: any) => {
      pendingDisp = e.detail;
      if (animId === null) {
        animId = requestAnimationFrame(() => {
          setActiveDisplacement(pendingDisp);
          animId = null;
        });
      }
    };
    const handleRotation = (e: any) => {
      pendingRot = e.detail;
      if (animId === null) {
        animId = requestAnimationFrame(() => {
          setActiveRotation(pendingRot);
          animId = null;
        });
      }
    };
    const handleScaling = (e: any) => {
      pendingScale = e.detail;
      if (animId === null) {
        animId = requestAnimationFrame(() => {
          setActiveScaling(pendingScale);
          animId = null;
        });
      }
    };
    const handleOpenTextureEvent = (e: any) => {
      if (e.detail?.pieceId) {
        setSelectedPieceIds([e.detail.pieceId]);
        setTextureEditingPieceId(e.detail.pieceId);
        setActiveTextureFace(e.detail.faceKey || 'all');
        setIsTextureModalOpen(true);
      }
    };
    const handleSelectTextureFace = (e: any) => {
      if (e.detail?.pieceId) {
        setSelectedPieceIds([e.detail.pieceId]);
        setTextureEditingPieceId(e.detail.pieceId);
      }
      if (e.detail?.faceKey) {
        setActiveTextureFace(e.detail.faceKey);
      }
      setIsTextureModalOpen(true);
    };

    window.addEventListener('piece-displacement-update', handleDisplacement);
    window.addEventListener('piece-rotation-update', handleRotation);
    window.addEventListener('piece-scaling-update', handleScaling);
    window.addEventListener('open-texture-editor', handleOpenTextureEvent);
    window.addEventListener('select-texture-face', handleSelectTextureFace);

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      window.removeEventListener('piece-displacement-update', handleDisplacement);
      window.removeEventListener('piece-rotation-update', handleRotation);
      window.removeEventListener('piece-scaling-update', handleScaling);
      window.removeEventListener('open-texture-editor', handleOpenTextureEvent);
      window.removeEventListener('select-texture-face', handleSelectTextureFace);
    };
  }, []);
  
  // Multiplicar y Distribuir (Repisas y Repetición en Serie)
  const [arrayCount, setArrayCount] = useState<number>(3);
  const [arrayOffset, setArrayOffset] = useState<number>(1.0);
  const [arrayDistanceMm, setArrayDistanceMm] = useState<number>(250);
  const [arraySpacingType, setArraySpacingType] = useState<'mm' | 'touching' | 'multiplier'>('mm');
  const [arrayDirection, setArrayDirection] = useState<1 | -1>(1);
  const [arrayAxis, setArrayAxis] = useState<'X' | 'Y' | 'Z'>('Y');
  const [arrayMode, setArrayMode] = useState<'between' | 'offset'>('between');

  const [edgeThicknessConfig, setEdgeThicknessConfig] = useState<EdgeThicknessConfig>(DEFAULT_EDGE_THICKNESS_CONFIG);

  // SketchUp Tray Open/Closed States - solo esquema abierto por defecto, las demás pestañas cerradas
  const [trayOpen, setTrayOpen] = useState({
    esquema: true,
    entidad: false,
    materiales: false,
    procesos: false,
    cantosConfig: false,
    catalogo: false,
  });
  const [traySelectedCategory, setTraySelectedCategory] = useState<string>('Todas');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Footer Movement & Rotation Controls (Start from zero on every movement / rotation)
  const [footerMoveDist, setFooterMoveDist] = useState<string>('');
  const [footerMoveAxis, setFooterMoveAxis] = useState<'X' | 'Y' | 'Z'>('X');
  const [footerMoveSign, setFooterMoveSign] = useState<1 | -1>(1);

  const [footerRotAngle, setFooterRotAngle] = useState<string>('');
  const [footerRotAxis, setFooterRotAxis] = useState<'X' | 'Y' | 'Z'>('Y');
  const [footerRotSign, setFooterRotSign] = useState<1 | -1>(1);

  const [footerScaleInput, setFooterScaleInput] = useState<string>('');
  const [footerScaleAxis, setFooterScaleAxis] = useState<'largo' | 'ancho' | 'espesor'>('largo');

  // Reset inputs to 0 whenever selection or mode changes
  useEffect(() => {
    setFooterMoveDist('');
    setFooterRotAngle('');
    setFooterScaleInput('');
    setActiveDisplacement(null);
    setActiveRotation(null);
    setActiveScaling(null);
  }, [selectedPieceIds, transformMode]);

  const handleApplyDisplacementOffset = useCallback((dx: number, dy: number, dz: number) => {
    if (selectedPieceIds.length === 0) return;
    setPieces(prev => {
      const idSet = new Set(selectedPieceIds);
      return prev.map(p => {
        if (idSet.has(p.id)) {
          return {
            ...p,
            position3D: [
              Math.round(p.position3D[0] + dx),
              Math.round(p.position3D[1] + dy),
              Math.round(p.position3D[2] + dz)
            ]
          };
        }
        return p;
      });
    });
    // Immediately start from zero for next movement
    setFooterMoveDist('');
    setActiveDisplacement(null);
    showToast(`Pieza(s) desplazada(s): ΔX ${dx >= 0 ? '+' : ''}${dx}, ΔY ${dy >= 0 ? '+' : ''}${dy}, ΔZ ${dz >= 0 ? '+' : ''}${dz} mm`);
  }, [selectedPieceIds]);

  const handleApplyRotationOffset = useCallback((dDegX: number, dDegY: number, dDegZ: number) => {
    if (selectedPieceIds.length === 0) return;
    const dRadX = THREE.MathUtils.degToRad(dDegX);
    const dRadY = THREE.MathUtils.degToRad(dDegY);
    const dRadZ = THREE.MathUtils.degToRad(dDegZ);

    setPieces(prev => {
      const idSet = new Set(selectedPieceIds);
      const selected = prev.filter(p => idSet.has(p.id));
      if (selected.length === 0) return prev;

      const cx = selected.reduce((sum, p) => sum + p.position3D[0], 0) / selected.length;
      const cy = selected.reduce((sum, p) => sum + p.position3D[1], 0) / selected.length;
      const cz = selected.reduce((sum, p) => sum + p.position3D[2], 0) / selected.length;
      const center = new THREE.Vector3(cx, cy, cz);
      const rotEuler = new THREE.Euler(dRadX, dRadY, dRadZ, 'XYZ');

      return prev.map(p => {
        if (idSet.has(p.id)) {
          if (selected.length > 1) {
            const posVec = new THREE.Vector3(p.position3D[0], p.position3D[1], p.position3D[2]).sub(center);
            posVec.applyEuler(rotEuler);
            posVec.add(center);
            return {
              ...p,
              position3D: [Math.round(posVec.x), Math.round(posVec.y), Math.round(posVec.z)] as [number, number, number],
              rotation3D: [
                p.rotation3D[0] + dRadX,
                p.rotation3D[1] + dRadY,
                p.rotation3D[2] + dRadZ
              ] as [number, number, number]
            };
          } else {
            return {
              ...p,
              rotation3D: [
                p.rotation3D[0] + dRadX,
                p.rotation3D[1] + dRadY,
                p.rotation3D[2] + dRadZ
              ] as [number, number, number]
            };
          }
        }
        return p;
      });
    });
    // Immediately start from zero for next rotation
    setFooterRotAngle('');
    setActiveRotation(null);
    const axisDesc = dDegY !== 0 ? `Y (${dDegY > 0 ? '+' : ''}${dDegY}°)` : dDegX !== 0 ? `X (${dDegX > 0 ? '+' : ''}${dDegX}°)` : `Z (${dDegZ > 0 ? '+' : ''}${dDegZ}°)`;
    showToast(`Pieza(s) rotada(s): ${axisDesc}`);
  }, [selectedPieceIds]);

  const handleCommitMove = useCallback(() => {
    if (selectedPieceIds.length === 0) {
      showToast('Selecciona una pieza para mover');
      return;
    }
    const trimmed = footerMoveDist.trim();
    if (!trimmed || trimmed === '0') {
      showToast('Ingresa una medida en mm para mover');
      return;
    }
    if (trimmed.includes(',') || trimmed.split(/\s+/).length === 3) {
      const parts = trimmed.includes(',') ? trimmed.split(',') : trimmed.split(/\s+/);
      const parsedX = parseFloat(parts[0]) || 0;
      const parsedY = parseFloat(parts[1]) || 0;
      const parsedZ = parseFloat(parts[2]) || 0;
      handleApplyDisplacementOffset(parsedX, parsedY, parsedZ);
      return;
    }
    const dist = parseFloat(trimmed);
    if (!isNaN(dist) && dist !== 0) {
      const effectiveDist = dist * footerMoveSign;
      const dX = footerMoveAxis === 'X' ? effectiveDist : 0;
      const dY = footerMoveAxis === 'Y' ? effectiveDist : 0;
      const dZ = footerMoveAxis === 'Z' ? effectiveDist : 0;
      handleApplyDisplacementOffset(dX, dY, dZ);
    }
  }, [selectedPieceIds, footerMoveDist, footerMoveAxis, footerMoveSign, handleApplyDisplacementOffset]);

  const handleCommitRotate = useCallback(() => {
    if (selectedPieceIds.length === 0) {
      showToast('Selecciona una pieza para rotar');
      return;
    }
    const trimmed = footerRotAngle.trim();
    if (!trimmed || trimmed === '0') {
      showToast('Ingresa los grados a rotar');
      return;
    }
    const deg = parseFloat(trimmed);
    if (!isNaN(deg) && deg !== 0) {
      const effectiveDeg = deg * footerRotSign;
      const dDegX = footerRotAxis === 'X' ? effectiveDeg : 0;
      const dDegY = footerRotAxis === 'Y' ? effectiveDeg : 0;
      const dDegZ = footerRotAxis === 'Z' ? effectiveDeg : 0;
      handleApplyRotationOffset(dDegX, dDegY, dDegZ);
    }
  }, [selectedPieceIds, footerRotAngle, footerRotAxis, footerRotSign, handleApplyRotationOffset]);

  const handleSnapSelectedPiecesToFloor = useCallback(() => {
    if (selectedPieceIds.length === 0) return;
    const targets = pieces.filter(p => selectedPieceIds.includes(p.id));
    if (targets.length === 0) return;
    const deltaY = calculateSnapToFloorDeltaY(targets);
    if (deltaY === 0) {
      showToast('La(s) pieza(s) ya está(n) apoyadas en el suelo (Y=0)');
      return;
    }
    handleApplyDisplacementOffset(0, deltaY, 0);
    showToast(`Apoyada en el suelo: cota Y ajustada (${deltaY > 0 ? '+' : ''}${deltaY} mm)`);
  }, [selectedPieceIds, pieces, handleApplyDisplacementOffset]);

  const toggleTray = (key: keyof typeof trayOpen) => {
    setTrayOpen(prev => ({ ...prev, [key]: !prev[key] }));
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tempLargo, setTempLargo] = useState<string>('0');
  const [tempAncho, setTempAncho] = useState<string>('0');
  const [tempEspesor, setTempEspesor] = useState<string>('0');
  const [tempName, setTempName] = useState<string>('');
  const [editingAxis, setEditingAxis] = useState<'largo' | 'ancho' | 'espesor'>('largo');
  const [anchorDirection, setAnchorDirection] = useState<'neg' | 'center' | 'pos'>('neg');
  const [dimensionSide, setDimensionSide] = useState<'pos' | 'neg'>('pos');
  const [anchorMode, setAnchorMode] = useState<'single' | 'center'>('single');

  const handleOpenDimensionEditor = (pieceId: string, axis: 'largo' | 'ancho' | 'espesor' = 'largo') => {
    const p = pieces.find(x => x.id === pieceId);
    if (p) {
      setTempName(p.name || 'Nueva Pieza');
      setTempLargo(String(Math.round(p.largo)));
      setTempAncho(String(Math.round(p.ancho)));
      setTempEspesor(String(Math.round(p.espesor)));
    }
    setEditingDimensionsPieceId(pieceId);
    setEditingAxis(axis);
    setAnchorDirection(dimensionSide === 'neg' ? 'pos' : 'neg');
    setIsTrayOpen(true);
    setTrayOpen(prev => ({ ...prev, entidad: true }));
  };

  useEffect(() => {
    if (editingDimensionsPieceId) {
      const p = pieces.find(x => x.id === editingDimensionsPieceId);
      if (p) {
        setTempName(p.name || 'Nueva Pieza');
        setTempLargo(String(Math.round(p.largo)));
        setTempAncho(String(Math.round(p.ancho)));
        setTempEspesor(String(Math.round(p.espesor)));
      }
    }
  }, [editingDimensionsPieceId]);

  useEffect(() => {
    const handleRequestTransformMode = (e: CustomEvent) => {
       setTransformMode(e.detail);
    };
    window.addEventListener('request-transform-mode', handleRequestTransformMode as EventListener);
    return () => window.removeEventListener('request-transform-mode', handleRequestTransformMode as EventListener);
  }, []);

  const fredoCurrentDim = useMemo(() => {
    if (selectedPieceIds.length === 0) return 0;
    const targetPieces = pieces.filter(p => selectedPieceIds.includes(p.id) && !p.hidden);
    if (targetPieces.length === 0) return 0;
    const bounds = computePiecesBoundingBoxMm(targetPieces);
    const axisIdx = fredoAxis === 'X' ? 0 : fredoAxis === 'Y' ? 1 : 2;
    return bounds.size.getComponent(axisIdx);
  }, [pieces, selectedPieceIds, fredoAxis]);

  const handleCommitFredoStretch = useCallback((updatedPieces: Piece[]) => {
    setAppState(prev => {
      const updateMap = new Map(updatedPieces.map(p => [p.id, p]));
      const nextPieces = prev.pieces.map(p => updateMap.has(p.id) ? updateMap.get(p.id)! : p);
      return {
        ...prev,
        pieces: nextPieces
      };
    });
    setFredoInputText('');
    setFredoPreviewDelta(0);
    showToast('¡Estirado Inteligente aplicado con éxito! (Espesores conservados)');
  }, []);

  const handleApplyFredoNumericStretch = useCallback((targetOrDeltaMm: number, isAbsolute: boolean = false) => {
    if (selectedPieceIds.length === 0) return;
    const targetPieces = pieces.filter(p => selectedPieceIds.includes(p.id) && !p.hidden);
    if (targetPieces.length === 0) return;
    const currentBounds = computePiecesBoundingBoxMm(targetPieces);
    const axisIdx = fredoAxis === 'X' ? 0 : fredoAxis === 'Y' ? 1 : 2;
    const currentDim = currentBounds.size.getComponent(axisIdx);

    let deltaMm = targetOrDeltaMm;
    if (isAbsolute) {
      deltaMm = targetOrDeltaMm - currentDim;
    }

    if (Math.abs(deltaMm) < 0.5) return;

    const result = calculateFredoStretch({
      pieces: targetPieces,
      axis: fredoAxis,
      planeRatio: fredoPlaneRatio,
      mode: fredoMode,
      deltaMm: Math.round(deltaMm),
      initialBounds: currentBounds
    });

    handleCommitFredoStretch(result.updatedPieces);
  }, [selectedPieceIds, pieces, fredoAxis, fredoPlaneRatio, fredoMode, handleCommitFredoStretch]);

  const handleCommitFredoInput = (customText?: string) => {
    const raw = (customText !== undefined ? customText : fredoInputText).trim();
    if (!raw) return;
    if (raw.startsWith('+') || raw.startsWith('-')) {
      const val = parseFloat(raw);
      if (!isNaN(val)) handleApplyFredoNumericStretch(val, false);
    } else {
      const val = parseFloat(raw);
      if (!isNaN(val)) handleApplyFredoNumericStretch(val, true);
    }
  };

  const handleQuickFredoStep = (stepMm: number) => {
    handleApplyFredoNumericStretch(stepMm, false);
  };

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
    setEditingGroupId(null);
    
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
       if (editingGroupId) {
         setSelectedPieceIds([]);
       } else {
         setSelectedPieceIds([]);
         setTextureEditingPieceId(null);
         setIsTextureModalOpen(false);
         if (window.innerWidth < 1024) {
           setIsTrayOpen(false);
         }
       }
       if (transformMode === 'texture') {
         setTransformMode('translate');
       }
       return;
    }
    
    const isMulti = multi || multiSelectMode;
    const piece = pieces.find(p => p.id === id);

    // Si estamos dentro de un grupo editando sus piezas:
    if (editingGroupId) {
      if (piece?.groupId === editingGroupId) {
        setTextureEditingPieceId(id);
        if (isMulti) {
          setSelectedPieceIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
        } else {
          setSelectedPieceIds([id]);
        }
        return;
      } else {
        // Clic a otra pieza fuera del grupo: salimos del grupo
        setEditingGroupId(null);
      }
    }

    const pieceGroupId = piece?.groupId;
    const idsToSelect = pieceGroupId ? pieces.filter(p => p.groupId === pieceGroupId).map(p => p.id) : [id];
    setTextureEditingPieceId(idsToSelect[0] || id);

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

  const handleLongPressPiece = (pieceId: string) => {
    setMultiSelectMode(true);
    const piece = pieces.find(p => p.id === pieceId);
    if (editingGroupId && piece?.groupId === editingGroupId) {
      setSelectedPieceIds(prev => Array.from(new Set([...prev, pieceId])));
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 50, 40]);
      }
      return;
    }
    const pieceGroupId = piece?.groupId;
    const idsToSelect = pieceGroupId ? pieces.filter(p => p.groupId === pieceGroupId).map(p => p.id) : [pieceId];

    setSelectedPieceIds(prev => {
      const next = new Set(prev);
      idsToSelect.forEach(id => next.add(id));
      return Array.from(next);
    });

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 50, 40]);
    }

    showToast('¡Selección múltiple activada! Toca más piezas y presiona Agrupar');
  };

  const updateMultiplePiecesTransform = useCallback((updates: { id: string; position: [number, number, number]; rotation: [number, number, number] }[]) => {
    setPieces(prev => {
      const updateMap = new Map(updates.map(u => [u.id, u]));
      return prev.map(p => {
        const u = updateMap.get(p.id);
        if (u) {
          return {
            ...p,
            position3D: u.position,
            rotation3D: u.rotation
          };
        }
        return p;
      });
    });
  }, [setPieces]);

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
    const defaultWhite = MATERIAL_MAP['Blanco'];
    const newPiece: Piece = {
      id: uuidv4(),
      name: 'Nueva Pieza',
      largo: 600,
      ancho: 400,
      espesor: 18,
      cantidad: 1,
      cantos: { largo1: 'Ninguno', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [0, 200, 0],
      rotation3D: [0, 0, 0],
      material: 'Blanco',
      customColor: defaultWhite.color,
      customRoughness: defaultWhite.roughness,
      customMetalness: defaultWhite.metalness,
      customOpacity: 1.0,
      veta: false,
      rotacion: false,
      ranurado: false,
      abisagrado: false
    };
    setPieces(prev => [...prev, newPiece]);
    setSelectedPieceIds([newPiece.id]);
  };

  const deletePiece = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAppState(prev => {
      const nextPieces = prev.pieces.filter(p => p.id !== id);
      const usedGroupIds = new Set(nextPieces.map(p => p.groupId).filter(Boolean));
      return {
        ...prev,
        pieces: nextPieces,
        groups: prev.groups.filter(g => usedGroupIds.has(g.id))
      };
    });
    setSelectedPieceIds(prev => prev.filter(p => p !== id));
    showToast('Pieza eliminada');
  }, [setAppState]);

  const deleteSelectedPieces = useCallback(() => {
    if (selectedPieceIds.length === 0) return;
    const count = selectedPieceIds.length;
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
    showToast(count === 1 ? 'Pieza eliminada' : `${count} piezas eliminadas`);
  }, [selectedPieceIds, setAppState]);

  const deleteGroup = useCallback((groupId: string) => {
    setAppState(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== groupId),
      pieces: prev.pieces.map(p => p.groupId === groupId ? { ...p, groupId: undefined } : p)
    }));
    showToast('Grupo eliminado');
  }, [setAppState]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setPieces([]);
    
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
        } catch (error) {
          showToast('Hubo un error al procesar la imagen de mueble.');
        } finally {
          setIsProcessing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch {
      setIsProcessing(false);
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
    setPieces(prev => prev.map(p => {
      if (p.id !== id) return p;
      const next = { ...p, ...updates };
      if (updates.faceTextures === undefined && 'faceTextures' in updates) {
        delete next.faceTextures;
      }
      if (updates.faceTextureConfigs === undefined && 'faceTextureConfigs' in updates) {
        delete next.faceTextureConfigs;
      }
      if (updates.cantoColor === undefined && 'cantoColor' in updates) {
        delete next.cantoColor;
      }
      return next;
    }));
  };

  const handleCommitScale = useCallback(() => {
    if (selectedPieceIds.length === 0) {
      showToast('Selecciona una pieza para dimensionar');
      return;
    }
    const trimmed = footerScaleInput.trim();
    if (!trimmed || trimmed === '0') {
      showToast('Ingresa una medida o variación en mm (+/-)');
      return;
    }

    const selectedPiece = pieces.find(p => p.id === selectedPieceIds[0]);
    if (!selectedPiece) return;

    let targetAxis: 'largo' | 'ancho' | 'espesor' = footerScaleAxis;
    if (activeScaling?.axis) {
      targetAxis = activeScaling.axis;
    }

    let delta = 0;
    const isRelative = trimmed.startsWith('+') || trimmed.startsWith('-');
    const parsedVal = parseFloat(trimmed);
    if (isNaN(parsedVal)) return;

    if (isRelative) {
      delta = parsedVal;
    } else {
      // Direct absolute dimension input
      const currentDim = targetAxis === 'largo' ? selectedPiece.largo : (targetAxis === 'ancho' ? selectedPiece.ancho : selectedPiece.espesor);
      delta = parsedVal - currentDim;
    }

    if (delta === 0) return;

    const dLargo = targetAxis === 'largo' ? delta : 0;
    const dAncho = targetAxis === 'ancho' ? delta : 0;
    const dEspesor = targetAxis === 'espesor' ? delta : 0;

    const nuevoLargo = Math.max(10, Math.round(selectedPiece.largo + dLargo));
    const nuevoAncho = Math.max(10, Math.round(selectedPiece.ancho + dAncho));
    const nuevoEspesor = Math.max(1, Math.round(selectedPiece.espesor + dEspesor));

    const isSymmetric = anchorMode === 'center';
    const sign = dimensionSide === 'neg' ? -1 : 1;

    let localShift = new THREE.Vector3(0, 0, 0);
    if (!isSymmetric) {
      localShift = new THREE.Vector3(
        (sign * (dLargo / 2)) * 0.001,
        (sign * (dEspesor / 2)) * 0.001,
        (sign * (dAncho / 2)) * 0.001
      );
      const euler = new THREE.Euler(selectedPiece.rotation3D[0], selectedPiece.rotation3D[1], selectedPiece.rotation3D[2], 'XYZ');
      localShift.applyEuler(euler);
    }

    updatePiece(selectedPiece.id, {
      largo: nuevoLargo,
      ancho: nuevoAncho,
      espesor: nuevoEspesor,
      position3D: [
        selectedPiece.position3D[0] + localShift.x,
        selectedPiece.position3D[1] + localShift.y,
        selectedPiece.position3D[2] + localShift.z
      ]
    });

    setFooterScaleInput('');
    setActiveScaling(null);
    const axisLabel = targetAxis === 'largo' ? 'Largo' : (targetAxis === 'ancho' ? 'Ancho' : 'Espesor');
    const finalVal = targetAxis === 'largo' ? nuevoLargo : (targetAxis === 'ancho' ? nuevoAncho : nuevoEspesor);
    showToast(`Pieza dimensionada (${axisLabel}): ${finalVal} mm (${delta > 0 ? '+' : ''}${Math.round(delta)} mm)`);
  }, [selectedPieceIds, footerScaleInput, footerScaleAxis, activeScaling, pieces, anchorMode, dimensionSide, updatePiece]);

  const updatePieces = (ids: string[], updates: Partial<Piece>) => {
    const idSet = new Set(ids);
    setPieces(prev => prev.map(p => idSet.has(p.id) ? { ...p, ...updates } : p));
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
  };

  const handleLoadModel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data && data.pieces && Array.isArray(data.pieces)) {
          setAppState({
            pieces: data.pieces,
            groups: data.groups || []
          });
          setSelectedPieceIds([]);
        } else if (Array.isArray(data)) {
          setAppState({
            pieces: data,
            groups: []
          });
          setSelectedPieceIds([]);
        }
      } catch (err) {
        console.error("Failed to parse JSON", err);
      }
    };
    reader.readAsText(file);
    if (loadFileInputRef.current) {
        loadFileInputRef.current.value = '';
    }
  };

  // Autosave to localStorage on project modification
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (pieces.length === 0 && groups.length === 0) {
          localStorage.removeItem(AUTOSAVE_STORAGE_KEY);
        } else {
          localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify({ pieces, groups }));
        }
      } catch (e) {
        console.warn('Autosave error:', e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [pieces, groups]);

  // Global Keyboard Shortcuts (Undo, Redo, Delete, Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || (document.activeElement as HTMLElement)?.isContentEditable;
      if (isInput) return;

      // Deshacer: Ctrl+Z o Cmd+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Rehacer: Ctrl+Y o Cmd+Shift+Z o Ctrl+Shift+Z
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        redo();
        return;
      }

      // Modo Estirar (FredoScale Stretch): Tecla E
      if (e.key.toLowerCase() === 'e' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setTransformMode(prev => prev === 'stretch' ? 'translate' : 'stretch');
        return;
      }

      // Eliminar piezas seleccionadas: Supr / Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPieceIds.length > 0) {
        e.preventDefault();
        deleteSelectedPieces();
        return;
      }

      // Escape: Deseleccionar piezas, salir de edición de grupo o cerrar confirmación
      if (e.key === 'Escape') {
        if (deleteConfirm) {
          setDeleteConfirm(null);
        } else if (editingGroupId) {
          const grpPieces = pieces.filter(p => p.groupId === editingGroupId);
          setSelectedPieceIds(grpPieces.map(p => p.id));
          setEditingGroupId(null);
          showToast('Saliste del modo edición de grupo');
        } else if (selectedPieceIds.length > 0) {
          setSelectedPieceIds([]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedPieceIds, deleteConfirm, editingGroupId, pieces]);

  // Export Menu State & Handlers
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  const handleExportCSV = () => {
    if (pieces.length === 0) {
      showToast('No hay piezas en el proyecto para exportar.');
      setIsExportMenuOpen(false);
      return;
    }

    const headers = [
      'Pieza / Nombre',
      'Cantidad',
      'Largo Final (mm)',
      'Ancho Final (mm)',
      'Espesor (mm)',
      'Largo Corte (mm)',
      'Ancho Corte (mm)',
      'Material',
      'Veta',
      'Rotación',
      'Canto Largo 1',
      'Canto Largo 2',
      'Canto Ancho 1',
      'Canto Ancho 2'
    ];

    const rows = pieces.map(p => {
      const cut = calculatePieceCutDimensions(p, edgeThicknessConfig);
      return [
        `"${(p.name || 'Pieza').replace(/"/g, '""')}"`,
        p.cantidad || 1,
        Math.round(p.largo),
        Math.round(p.ancho),
        Math.round(p.espesor || 18),
        Math.round(cut.largoCorte),
        Math.round(cut.anchoCorte),
        `"${(p.material || 'MELAMINA').replace(/"/g, '""')}"`,
        p.veta ? 'Sí' : 'No',
        p.rotacion ? 'Sí' : 'No',
        p.cantos?.largo1 || 'Ninguno',
        p.cantos?.largo2 || 'Ninguno',
        p.cantos?.ancho1 || 'Ninguno',
        p.cantos?.ancho2 || 'Ninguno',
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `despiece_melamina_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
    showToast('Planilla CSV de despiece generada con éxito');
  };

  const handleExportJSON = () => {
    handleSaveModel();
    setIsExportMenuOpen(false);
    showToast('Archivo JSON de proyecto descargado');
  };

  const handleGoToCutPlan = () => {
    setViewMode('2d');
    setIsExportMenuOpen(false);
    showToast('Cambiando a Plano de Corte 2D...');
  };

  const handleLoadFurnitureFromWarehouse = (furniture: FurnitureCatalogItem, mode: 'replace' | 'insert' = 'replace') => {
    let piecesToLoad: Piece[] = [];
    const newGroupId = uuidv4();
    if (furniture.pieces && furniture.pieces.length > 0) {
      piecesToLoad = furniture.pieces.map(p => ({
        ...p,
        id: uuidv4(),
        groupId: newGroupId
      }));
    } else {
      // Create base bounding structure according to furniture dimensions
      const { width: W, height: H, depth: D } = furniture.dimensions;
      const T = furniture.thickness || 18;

      piecesToLoad = [
        {
          id: uuidv4(),
          name: `${furniture.name} - Lateral Izq`,
          groupId: newGroupId,
          largo: D,
          ancho: H,
          espesor: T,
          cantidad: 1,
          cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
          position3D: [-W / 2 + T / 2, 0, 0],
          rotation3D: [0, Math.PI / 2, 0],
          material: 'Roble Natural'
        },
        {
          id: uuidv4(),
          name: `${furniture.name} - Lateral Der`,
          groupId: newGroupId,
          largo: D,
          ancho: H,
          espesor: T,
          cantidad: 1,
          cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
          position3D: [W / 2 - T / 2, 0, 0],
          rotation3D: [0, Math.PI / 2, 0],
          material: 'Roble Natural'
        },
        {
          id: uuidv4(),
          name: `${furniture.name} - Base`,
          groupId: newGroupId,
          largo: Math.max(10, W - 2 * T),
          ancho: D,
          espesor: T,
          cantidad: 1,
          cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
          position3D: [0, -H / 2 + T / 2, 0],
          rotation3D: [0, 0, 0],
          material: 'Roble Natural'
        },
        {
          id: uuidv4(),
          name: `${furniture.name} - Techo`,
          groupId: newGroupId,
          largo: Math.max(10, W - 2 * T),
          ancho: D,
          espesor: T,
          cantidad: 1,
          cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
          position3D: [0, H / 2 - T / 2, 0],
          rotation3D: [0, 0, 0],
          material: 'Roble Natural'
        }
      ];
    }

    if (mode === 'insert' && pieces.length > 0) {
      // Offset new pieces to the right so they don't collide with existing furniture
      const maxX = Math.max(...pieces.map(p => (p.position3D?.[0] || 0) + (p.largo || 0) / 2));
      const offsetX = maxX + (furniture.dimensions.width / 2) + 200;
      const shiftedPieces = piecesToLoad.map(p => ({
        ...p,
        position3D: [p.position3D[0] + offsetX, p.position3D[1], p.position3D[2]] as [number, number, number]
      }));

      const newGroup: Group3D = {
        id: newGroupId,
        name: furniture.name,
        position3D: [offsetX, 0, 0],
        rotation3D: [0, 0, 0]
      };

      setAppState(prev => ({
        pieces: [...prev.pieces, ...shiftedPieces],
        groups: [...prev.groups, newGroup]
      }));
      setSelectedPieceIds(shiftedPieces.map(p => p.id));
      showToast(`Mueble "${furniture.name}" añadido como nuevo grupo en 3D.`);
    } else {
      const newGroup: Group3D = {
        id: newGroupId,
        name: furniture.name,
        position3D: [0, 0, 0],
        rotation3D: [0, 0, 0]
      };
      setAppState({
        pieces: piecesToLoad,
        groups: [newGroup]
      });
      setSelectedPieceIds(piecesToLoad.map(p => p.id));
      showToast(`Mueble "${furniture.name}" cargado en el visor 3D.`);
    }

    setViewMode('3d');
  };

  const executeDistribution = () => {
    if (arrayMode === 'between') {
      if (selectedPieceIds.length < 2) {
        showToast("Selecciona exactamente 2 piezas (ej. piso y techo) para distribuir repisas intermedias.");
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
      showToast(`¡Listo! Se insertaron ${numShelves} repisas equidistantes.`);
    } else {
      // Repetición en serie (Linear Step)
      if (selectedPieceIds.length === 0) {
        showToast("Selecciona al menos una pieza para multiplicar en serie.");
        return;
      }
      
      const newPiecesToInsert: Piece[] = [];
      const copiesCount = arrayCount;
      if (copiesCount < 1) return;

      selectedPieceIds.forEach(id => {
        const basePiece = pieces.find(p => p.id === id);
        if (!basePiece) return;

        // Step distance in mm
        let stepDistance = 0;
        if (arraySpacingType === 'mm') {
          stepDistance = arrayDistanceMm * arrayDirection;
        } else if (arraySpacingType === 'touching') {
          let dim = basePiece.espesor;
          if (arrayAxis === 'X') dim = basePiece.largo;
          if (arrayAxis === 'Z') dim = basePiece.ancho;
          stepDistance = dim * arrayDirection;
        } else {
          // Multiplier factor
          let dim = basePiece.espesor;
          if (arrayAxis === 'X') dim = basePiece.largo;
          if (arrayAxis === 'Z') dim = basePiece.ancho;
          stepDistance = dim * arrayOffset * arrayDirection;
        }

        for (let i = 1; i <= copiesCount; i++) {
          const dx = arrayAxis === 'X' ? stepDistance * i : 0;
          const dy = arrayAxis === 'Y' ? stepDistance * i : 0;
          const dz = arrayAxis === 'Z' ? stepDistance * i : 0;

          const newPiece: Piece = {
            ...basePiece,
            id: uuidv4(),
            name: `${basePiece.name || 'Pieza'} (Copia ${i})`,
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
      showToast(`¡Listo! Se crearon ${newPiecesToInsert.length} piezas en serie.`);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#3d3d3d] text-[#cccccc] font-sans overflow-hidden select-none">
      <input 
        type="file" 
        accept=".json" 
        style={{ display: 'none' }} 
        ref={loadFileInputRef} 
        onChange={handleLoadModel} 
      />
      
      {/* Blender Top Menu Bar */}
      <header className="h-8 border-b border-[#1a1a1a] bg-[#1d1d1d] flex items-center justify-between px-1 sm:px-2 shrink-0 relative z-30 w-full max-w-full min-w-0">
        <div className="flex items-center space-x-1 sm:space-x-3 min-w-0 shrink-0">
          <div className="flex items-center gap-1 px-1 sm:px-1.5 py-0.5 hover:bg-[#4d4d4d] rounded cursor-default shrink-0">
            <Box className="w-3.5 h-3.5 text-[#f0a144]" />
            <span className="text-[11px] font-medium hidden sm:inline">IA Mueble</span>
          </div>
          <div className="hidden md:flex items-center gap-1 border-l border-[#333] pl-2 ml-1">
            <button 
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#333] rounded text-[10px]"
              onClick={() => loadFileInputRef.current?.click()}
              title="Abrir proyecto JSON guardado"
            >
              <FolderOpen className="w-3.5 h-3.5" /> Abrir
            </button>
            <button 
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-[#333] rounded text-[10px]"
              onClick={handleSaveModel}
              title="Guardar archivo de proyecto (.json)"
            >
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
            <div className="h-3 w-[1px] bg-[#333] mx-1" />
            <button 
              type="button"
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors ${canUndo ? 'hover:bg-[#333] text-[#ccc]' : 'text-[#555] cursor-not-allowed'}`}
              onClick={undo}
              disabled={!canUndo}
              title="Deshacer acción (Ctrl+Z)"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button 
              type="button"
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] transition-colors ${canRedo ? 'hover:bg-[#333] text-[#ccc]' : 'text-[#555] cursor-not-allowed'}`}
              onClick={redo}
              disabled={!canRedo}
              title="Rehacer acción (Ctrl+Y)"
            >
              <RotateCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 min-w-0">
          {/* Guía didáctica button */}
          <button 
            type="button"
            onClick={() => setDidacticGuideOpen(true)}
            className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-[#ec4899]/10 text-pink-400 border border-[#ec4899]/20 text-[9.5px] sm:text-[10px] font-bold hover:bg-[#ec4899]/20 transition-all shrink-0"
            title="Aprender sobre materiales y cantos reales"
          >
            <Lightbulb className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-pink-400" />
            <span className="hidden md:inline">Guía</span>
          </button>

          {/* View mode switcher */}
          <div className="flex bg-[#111111] rounded p-0.5 border border-[#333333] shrink-0">
            <button 
              type="button"
              onClick={() => setViewMode('3d')}
              className={`px-1.5 sm:px-2.5 py-0.5 rounded text-[9.5px] sm:text-[10px] font-bold transition-colors ${viewMode === '3d' ? 'bg-[#565656] text-white shadow-inner' : 'hover:bg-[#333333] text-[#888888]'}`}
            >
              <span className="md:hidden">3D</span>
              <span className="hidden md:inline">3D Viewport</span>
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('2d')}
              className={`px-1.5 sm:px-2.5 py-0.5 rounded text-[9.5px] sm:text-[10px] font-bold transition-colors ${viewMode === '2d' ? 'bg-[#565656] text-white shadow-inner' : 'hover:bg-[#333333] text-[#888888]'}`}
            >
              Cortes
            </button>
            <button 
              type="button"
              onClick={() => setViewMode('warehouse')}
              className={`flex items-center gap-1 px-1.5 sm:px-2.5 py-0.5 rounded text-[9.5px] sm:text-[10px] font-bold transition-colors ${viewMode === 'warehouse' ? 'bg-amber-600 text-white shadow-inner' : 'hover:bg-[#333333] text-amber-400'}`}
              title="Almacén de muebles"
            >
              <Package className="w-3 h-3 shrink-0" />
              <span>Almacén</span>
            </button>
          </div>
          
          {/* Export Dropdown Menu */}
          <div className="relative shrink-0" ref={exportMenuRef}>
            <button 
              type="button"
              className="bg-[#285437] hover:bg-[#326945] text-[#eee] text-[9.5px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-bold transition-colors border border-[#1e3f29] flex items-center gap-1 shadow-sm shrink-0"
              onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
              title="Opciones de exportación de proyecto y despiece"
            >
              <Download className="w-3 h-3 text-emerald-400 shrink-0" /> 
              <span className="hidden sm:inline">Exportar</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-70 shrink-0" />
            </button>

            {isExportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[#1f1f1f] border border-[#383838] rounded-md shadow-2xl z-50 py-1 text-[11px] animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-2.5 py-1 text-[9px] font-mono uppercase text-[#777] border-b border-[#2d2d2d] tracking-wider">
                  Formatos de Exportación
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="w-full px-2.5 py-2 text-left hover:bg-[#2c2c2c] text-[#eee] flex items-start gap-2 transition-colors group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[10.5px] group-hover:text-white">Despiece CSV (Excel / Taller)</div>
                    <div className="text-[9px] text-[#888]">Medidas finales y de corte con cantos</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full px-2.5 py-2 text-left hover:bg-[#2c2c2c] text-[#eee] flex items-start gap-2 transition-colors group"
                >
                  <Save className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[10.5px] group-hover:text-white">Copia de Seguridad (.json)</div>
                    <div className="text-[9px] text-[#888]">Guarda el proyecto completo con 3D</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleGoToCutPlan}
                  className="w-full px-2.5 py-2 text-left hover:bg-[#2c2c2c] text-[#eee] flex items-start gap-2 transition-colors border-t border-[#2d2d2d] group"
                >
                  <FileText className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[10.5px] group-hover:text-white">Plano de Corte PDF (2D)</div>
                    <div className="text-[9px] text-[#888]">Ir al optimizador para imprimir o exportar</div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Vertical Toolbar (Blender Style) */}
        <div className={`w-10 bg-[#2b2b2b] border-r border-[#1a1a1a] flex-col items-center py-2 gap-1 z-20 ${viewMode === 'warehouse' ? 'hidden md:flex' : 'flex'}`}>
           <ToolbarIcon 
             icon={<Menu />} 
             active={isTrayOpen} 
             onClick={() => setIsTrayOpen(prev => !prev)} 
             title={isTrayOpen ? "Ocultar Bandeja Predeterminada" : "Mostrar Bandeja Predeterminada"} 
           />
           <div className="w-6 h-px bg-[#404040] my-1" />
           <ToolbarIcon 
             icon={<Package />} 
             active={viewMode === 'warehouse'} 
             onClick={() => setViewMode(viewMode === 'warehouse' ? '3d' : 'warehouse')} 
             title="Almacén de muebles"
           />
           <ToolbarIcon icon={<Plus />} active={false} onClick={addPiece} title="Agregar Pieza" />
           <ToolbarIcon 
             icon={<Trash2 />} 
             active={false} 
             onClick={() => {
               if (selectedPieceIds.length > 0) {
                 deleteSelectedPieces();
               } else if (pieces.length > 0) {
                 setDeleteConfirm({ type: 'all' });
               }
             }} 
             title={selectedPieceIds.length > 0 ? "Eliminar Pieza(s) Seleccionada(s)" : "Eliminar Todo el Proyecto"} 
           />
           <div className="w-6 h-px bg-[#404040] my-1" />
           <ToolbarIcon icon={<Upload />} active={false} onClick={() => fileInputRef.current?.click()} title="Importar Imagen / Plan" />
        </div>

        <div className="flex-1 relative flex flex-col min-w-0 overflow-hidden w-full max-w-full">
          {/* Top View Selector Bar */}
          <div className={`h-7 bg-[#333333]/80 backdrop-blur-sm border-b border-[#1a1a1a] items-center px-4 space-x-4 z-10 ${viewMode === 'warehouse' ? 'hidden' : 'flex'}`}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#aaaaaa]">
              <span className="text-[#f0a144]">
                {viewMode === 'warehouse' ? 'Almacén de muebles' : viewMode === '2d' ? 'Diagrama de Corte 2D' : 'Object Mode 3D'}
              </span>
            </div>
            
            <div className="flex-1" />
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-[#888888]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                IA Engine: <span className="text-[#cccccc]">ACTIVE</span>
              </div>
            </div>
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
            {viewMode === 'warehouse' ? (
              <FurnitureWarehouse 
                currentPieces={pieces}
                groups={groups}
                selectedPieceIds={selectedPieceIds}
                onLoadFurnitureTo3D={handleLoadFurnitureFromWarehouse}
                onClose={() => setViewMode('3d')}
              />
            ) : viewMode === '3d' ? (
              <>
                <ThreeViewer 
                  pieces={pieces} 
                  selectedPieceIds={selectedPieceIds} 
                  groups={groups}
                  onSelectPiece={toggleSelection}
                  onUpdatePieceTransform={updatePieceTransform}
                  onUpdateMultiplePiecesTransform={updateMultiplePiecesTransform}
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
                  fredoAxis={fredoAxis}
                  onChangeFredoAxis={setFredoAxis}
                  fredoMode={fredoMode}
                  onChangeFredoMode={setFredoMode}
                  fredoPlaneRatio={fredoPlaneRatio}
                  onChangeFredoPlaneRatio={setFredoPlaneRatio}
                  fredoPreviewDelta={fredoPreviewDelta}
                  onChangeFredoPreviewDelta={setFredoPreviewDelta}
                  onCommitFredoStretch={handleCommitFredoStretch}
                  dimensionSide={dimensionSide}
                  anchorMode={anchorMode}
                  snapActive={snapActive}
                  onDoubleClickPiece={(id) => {
                    const p = pieces.find(x => x.id === id);
                    if (p?.groupId && !editingGroupId) {
                      setEditingGroupId(p.groupId);
                      setSelectedPieceIds([id]);
                      setTextureEditingPieceId(id);
                      const grp = groups.find(g => g.id === p.groupId);
                      showToast(`Entraste al grupo "${grp?.name || 'Grupo'}"`);
                    } else {
                      handleOpenDimensionEditor(id, 'largo');
                    }
                  }}
                  editingGroupId={editingGroupId}
                  onEditDimensionAxis={(id, axis) => handleOpenDimensionEditor(id, axis)}
                  hide3DLabels={didacticGuideOpen}
                  isTextureModalOpen={isTextureModalOpen}
                  edgeThicknessConfig={edgeThicknessConfig}
                  activeTextureFace={activeTextureFace}
                  onSelectTextureFace={(face) => {
                    setActiveTextureFace(face);
                    setIsTextureModalOpen(true);
                  }}
                  onLongPressPiece={handleLongPressPiece}
                />
                <ThreeViewerOverlay 
                  pieces={pieces}
                  groups={groups}
                  selectedPieceId={selectedPieceIds[0] || null}
                  selectedPieceIds={selectedPieceIds}
                  edgeThicknessConfig={edgeThicknessConfig}
                  onSelectPiece={(id) => toggleSelection(id, false)}
                  onSelectPieceIds={(ids) => setSelectedPieceIds(ids)}
                  onAddPiece={addPiece}
                  onUpdatePiece={updatePiece}
                  onUpdateGroup={(groupId, name) => setGroups(prev => prev.map(g => g.id === groupId ? { ...g, name } : g))}
                  onBatchUpdatePieces={(batchUpdates) => {
                    setPieces(prev => {
                      const updateMap = new Map(batchUpdates.map(u => [u.id, u.name]));
                      return prev.map(p => updateMap.has(p.id) ? { ...p, name: updateMap.get(p.id)! } : p);
                    });
                    showToast(`Se renombraron ${batchUpdates.length} piezas`);
                  }}
                  onDeletePiece={(id) => {
                     if (id) {
                       deletePiece(id);
                     } else {
                       deleteSelectedPieces();
                     }
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
                  isTextureModalOpen={isTextureModalOpen}
                  onChangeTransformMode={(mode) => {
                    if (mode === 'texture') {
                      if (isTextureModalOpen) {
                        setIsTextureModalOpen(false);
                        setTransformMode('translate');
                      } else {
                        setTransformMode('texture');
                        handleOpenTextureEditor();
                      }
                    } else {
                      setIsTextureModalOpen(false);
                      setTransformMode(mode);
                    }
                  }}
                  onOpenTextureEditor={() => {
                    if (isTextureModalOpen) {
                      setIsTextureModalOpen(false);
                      if (transformMode === 'texture') setTransformMode('translate');
                    } else {
                      handleOpenTextureEditor();
                    }
                  }}
                  dimensionSide={dimensionSide}
                  onChangeDimensionSide={setDimensionSide}
                  anchorMode={anchorMode}
                  onChangeAnchorMode={setAnchorMode}
                  onOpenDimensionEditor={() => selectedPieceIds[0] && handleOpenDimensionEditor(selectedPieceIds[0], 'largo')}
                  onUndo={undo}
                  onRedo={redo}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onOpenProperties={() => setMobileMenuOpen(true)}
                  arrayMode={arrayMode}
                  onChangeArrayMode={setArrayMode}
                  arrayCount={arrayCount}
                  onChangeArrayCount={setArrayCount}
                  arrayDistanceMm={arrayDistanceMm}
                  onChangeArrayDistanceMm={setArrayDistanceMm}
                  arraySpacingType={arraySpacingType}
                  onChangeArraySpacingType={setArraySpacingType}
                  arrayDirection={arrayDirection}
                  onChangeArrayDirection={setArrayDirection}
                  arrayAxis={arrayAxis}
                  onChangeArrayAxis={setArrayAxis}
                  arrayOffset={arrayOffset}
                  onChangeArrayOffset={setArrayOffset}
                  activeDisplacement={activeDisplacement}
                  onApplyDisplacementOffset={handleApplyDisplacementOffset}
                  onSnapToFloor={handleSnapSelectedPiecesToFloor}
                  onExecuteDistribution={executeDistribution}
                  editingGroupId={editingGroupId}
                  onEnterGroup={(groupId) => {
                    setEditingGroupId(groupId);
                    const grpPieces = pieces.filter(p => p.groupId === groupId);
                    if (grpPieces.length > 0) {
                      setSelectedPieceIds([grpPieces[0].id]);
                      setTextureEditingPieceId(grpPieces[0].id);
                    }
                    const grp = groups.find(g => g.id === groupId);
                    showToast(`Modo edición: editando piezas de "${grp?.name || 'Grupo'}"`);
                  }}
                  onExitGroup={() => {
                    if (editingGroupId) {
                      const grpPieces = pieces.filter(p => p.groupId === editingGroupId);
                      setSelectedPieceIds(grpPieces.map(p => p.id));
                    }
                    setEditingGroupId(null);
                    showToast('Saliste del modo edición de grupo');
                  }}
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
                edgeThicknessConfig={edgeThicknessConfig}
                onUpdateEdgeThicknessConfig={setEdgeThicknessConfig}
                onSwitchTo3D={() => setViewMode('3d')}
              />
            )}
          </main>

          {/* Bottom Status Bar (Compact, consistent, and clean) */}
          <footer className="min-h-[28px] sm:h-6 py-0.5 bg-[#222222] border-t border-[#181818] flex items-center px-1.5 sm:px-3 justify-between text-[8px] sm:text-[9px] font-medium text-[#888888] shrink-0 whitespace-nowrap overflow-x-auto [scrollbar-width:none] select-none z-30">
             <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
               {/* Engine Status */}
               <div className="flex items-center gap-1 text-[#cccccc] shrink-0">
                 <span className="w-1.5 h-1.5 rounded-full bg-[#f0a144]" />
                 <span className="hidden md:inline font-bold text-gray-300">CAD Engine</span>
               </div>

               {/* Dedicated Control Display according to view and mode */}
               {viewMode === '2d' ? (
                 <div className="flex items-center gap-2 text-[#888888] text-[8.5px] font-sans shrink-0">
                   <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181818] border border-white/5 text-gray-300 font-medium">
                     <span className="text-[#f0a144] font-bold">Plano de Corte 2D</span>
                   </span>
                   <span className="text-gray-400 hidden sm:inline">Optimizador y lista de despiece</span>
                 </div>
               ) : viewMode === 'warehouse' ? (
                 <div className="flex items-center gap-2 text-[#888888] text-[8.5px] font-sans shrink-0">
                   <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181818] border border-white/5 text-gray-300 font-medium">
                     <span className="text-[#f0a144] font-bold">Almacén</span>
                   </span>
                   <span className="text-gray-400 hidden sm:inline">Catálogo de muebles</span>
                 </div>
               ) : selectedPieceIds.length > 0 && transformMode === 'rotate' ? (
                 /* ROTATION MODE (Grados) */
                 <div className="flex items-center gap-1 sm:gap-1.5 font-mono bg-[#141414] px-1.5 sm:px-2 py-0.5 rounded border border-[#f0a144]/60 text-[#f0a144] shrink-0">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#f0a144] shrink-0" />
                   <span className="font-bold text-[9px] sm:text-[9.5px] flex items-center gap-1 shrink-0">
                     <span className="hidden sm:inline">ROTACIÓN:</span>
                     <span className="sm:hidden">ROT:</span>
                     <input 
                       type="text"
                       value={activeRotation?.isDragging ? String(activeRotation.angle) : footerRotAngle}
                       onChange={(e) => {
                         setActiveRotation(null);
                         setFooterRotAngle(e.target.value);
                       }}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           handleCommitRotate();
                         }
                       }}
                       placeholder={activeRotation && activeRotation.angle !== 0 ? String(activeRotation.angle) : "0"}
                       title="Escribe los grados a rotar y presiona Enter o el botón ✓"
                       className="w-11 sm:w-12 h-5 bg-black border border-[#444444] focus:border-[#f0a144] text-white px-1 rounded text-center text-[10px] font-mono font-black outline-none transition-colors"
                     />
                     <span className="text-white font-bold text-[8.5px] sm:text-[9px]">°</span>
                   </span>

                   {/* Botón Aplicar para móvil */}
                   <button
                     type="button"
                     onClick={handleCommitRotate}
                     className="w-4 h-4 sm:w-5 sm:h-5 bg-[#f0a144] hover:bg-[#ffb055] text-black font-black text-[9px] sm:text-[10px] rounded flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
                     title="Aplicar rotación (Enter)"
                   >
                     ✓
                   </button>

                   {/* Mini Eje Selector */}
                   <div className="flex items-center gap-0.5 border-l border-[#333333] pl-1 sm:pl-1.5 shrink-0">
                     {(['X', 'Y', 'Z'] as const).map(ax => (
                       <button
                         key={ax}
                         type="button"
                         onClick={() => setFooterRotAxis(ax)}
                         className={`w-4 h-4 sm:w-auto sm:px-1 sm:py-0.2 rounded text-[8.5px] sm:text-[8px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                           footerRotAxis === ax ? 'bg-[#f0a144] text-black font-black' : 'text-gray-400 hover:text-white'
                         }`}
                         title={`Eje ${ax}`}
                       >
                         {ax}
                       </button>
                     ))}
                   </div>

                   {activeRotation && activeRotation.angle !== 0 ? (
                     <span className="text-gray-300 text-[8px] sm:text-[9px] border-l border-[#3a3a3a] pl-1 sm:pl-1.5 font-semibold shrink-0">
                       <span className="hidden sm:inline">Giro: </span><span className="text-white font-bold">{activeRotation.angle}°</span>
                     </span>
                   ) : (
                     <span className="text-gray-400 text-[8px] border-l border-[#3a3a3a] pl-1.5 font-sans shrink-0 hidden sm:inline">(Eje {footerRotAxis})</span>
                   )}
                 </div>
               ) : selectedPieceIds.length > 0 && transformMode === 'translate' ? (
                 /* MOVEMENT MODE (Distancia mm) */
                 <div className="flex items-center gap-1 sm:gap-1.5 font-mono bg-[#141414] px-1.5 sm:px-2 py-0.5 rounded border border-[#f0a144]/60 text-[#f0a144] shrink-0">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#f0a144] shrink-0" />
                   <span className="font-bold text-[9px] sm:text-[9.5px] flex items-center gap-1 shrink-0">
                     <span className="hidden sm:inline">DISTANCIA:</span>
                     <span className="sm:hidden">DIST:</span>
                     <input 
                       type="text"
                       value={activeDisplacement?.isDragging ? String(activeDisplacement.dist) : footerMoveDist}
                       onChange={(e) => {
                         setActiveDisplacement(null);
                         setFooterMoveDist(e.target.value);
                       }}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           handleCommitMove();
                         }
                       }}
                       placeholder={activeDisplacement && activeDisplacement.dist > 0 ? String(activeDisplacement.dist) : "0"}
                       title="Escribe la medida en mm y presiona Enter o el botón ✓ para mover"
                       className="w-12 sm:w-14 h-5 bg-black border border-[#444444] focus:border-[#f0a144] text-white px-1 rounded text-center text-[10px] font-mono font-black outline-none transition-colors"
                     />
                     <span className="text-white font-bold text-[8.5px] sm:text-[9px]">mm</span>
                   </span>

                   {/* Botón Aplicar para móvil */}
                   <button
                     type="button"
                     onClick={handleCommitMove}
                     className="w-4 h-4 sm:w-5 sm:h-5 bg-[#f0a144] hover:bg-[#ffb055] text-black font-black text-[9px] sm:text-[10px] rounded flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
                     title="Aplicar desplazamiento (Enter)"
                   >
                     ✓
                   </button>

                   {/* Mini Eje Selector */}
                   <div className="flex items-center gap-0.5 border-l border-[#333333] pl-1 sm:pl-1.5 shrink-0">
                     {(['X', 'Y', 'Z'] as const).map(ax => (
                       <button
                         key={ax}
                         type="button"
                         onClick={() => setFooterMoveAxis(ax)}
                         className={`w-4 h-4 sm:w-auto sm:px-1 sm:py-0.2 rounded text-[8.5px] sm:text-[8px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                           footerMoveAxis === ax ? 'bg-[#f0a144] text-black font-black' : 'text-gray-400 hover:text-white'
                         }`}
                         title={`Eje ${ax}`}
                       >
                         {ax}
                       </button>
                     ))}
                   </div>

                   {activeDisplacement && activeDisplacement.dist > 0 ? (
                     <span className="text-gray-300 text-[8px] sm:text-[9px] border-l border-[#3a3a3a] pl-1 sm:pl-1.5 font-semibold shrink-0">
                       <span className="hidden sm:inline">Movido: </span><span className="text-white font-bold">{activeDisplacement.dist} mm</span>
                     </span>
                   ) : (
                     <span className="text-gray-400 text-[8px] border-l border-[#3a3a3a] pl-1.5 font-sans shrink-0 hidden sm:inline">(Eje {footerMoveAxis})</span>
                   )}

                   {/* Deltas visibles unicamente cuando se está arrastrando activamente */}
                   {activeDisplacement && activeDisplacement.isDragging && (activeDisplacement.dx !== 0 || activeDisplacement.dy !== 0 || activeDisplacement.dz !== 0) && (
                     <span className="hidden lg:inline-flex text-[8px] text-gray-400 items-center gap-1.5 border-l border-[#3a3a3a] pl-1.5 shrink-0">
                       <span className="text-red-400">ΔX:{activeDisplacement.dx > 0 ? `+${activeDisplacement.dx}` : activeDisplacement.dx}</span>
                       <span className="text-green-400">ΔY:{activeDisplacement.dy > 0 ? `+${activeDisplacement.dy}` : activeDisplacement.dy}</span>
                       <span className="text-blue-400">ΔZ:{activeDisplacement.dz > 0 ? `+${activeDisplacement.dz}` : activeDisplacement.dz}</span>
                     </span>
                   )}
                 </div>
               ) : selectedPieceIds.length > 0 && transformMode === 'scale' ? (
                 /* DIMENSIONING MODE (Cuánto moví el gizmo / Medida mm) */
                 <div className="flex items-center gap-1 sm:gap-1.5 font-mono bg-[#141414] px-1.5 sm:px-2 py-0.5 rounded border border-[#f0a144]/60 text-[#f0a144] shrink-0">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#f0a144] shrink-0" />
                   <span className="font-bold text-[9px] sm:text-[9.5px] flex items-center gap-1 shrink-0">
                     <span className="hidden sm:inline">MEDIDA:</span>
                     <span className="sm:hidden">MED:</span>
                     <input 
                       type="text"
                       value={
                         activeScaling?.isDragging
                           ? (activeScaling.delta !== undefined && activeScaling.delta !== 0 ? (activeScaling.delta > 0 ? `+${activeScaling.delta}` : String(activeScaling.delta)) : '')
                           : footerScaleInput
                       }
                       onChange={(e) => {
                         setActiveScaling(null);
                         setFooterScaleInput(e.target.value);
                       }}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter') {
                           handleCommitScale();
                         }
                       }}
                       placeholder={
                         activeScaling && activeScaling.delta !== undefined && activeScaling.delta !== 0
                           ? (activeScaling.delta > 0 ? `+${activeScaling.delta}` : String(activeScaling.delta))
                           : "0"
                       }
                       title="Escribe la medida final o variación (+/-) en mm y presiona Enter o el botón ✓"
                       className="w-12 sm:w-14 h-5 bg-black border border-[#444444] focus:border-[#f0a144] text-white px-1 rounded text-center text-[10px] font-mono font-black outline-none transition-colors"
                     />
                     <span className="text-white font-bold text-[8.5px] sm:text-[9px]">mm</span>
                   </span>

                   {/* Botón Aplicar para móvil */}
                   <button
                     type="button"
                     onClick={handleCommitScale}
                     className="w-4 h-4 sm:w-5 sm:h-5 bg-[#f0a144] hover:bg-[#ffb055] text-black font-black text-[9px] sm:text-[10px] rounded flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0"
                     title="Aplicar medida (Enter)"
                   >
                     ✓
                   </button>

                   {/* Selector de Dimensión / Eje (X: Largo, Y: Espesor, Z: Ancho) */}
                   <div className="flex items-center gap-0.5 border-l border-[#333333] pl-1 sm:pl-1.5 shrink-0">
                     {([
                       { key: 'largo', label: 'X', title: 'Largo (X)' },
                       { key: 'espesor', label: 'Y', title: 'Espesor (Y)' },
                       { key: 'ancho', label: 'Z', title: 'Ancho (Z)' }
                     ] as const).map(({ key, label, title }) => (
                       <button
                         key={key}
                         type="button"
                         onClick={() => setFooterScaleAxis(key)}
                         className={`w-4 h-4 sm:w-auto sm:px-1 sm:py-0.2 rounded text-[8.5px] sm:text-[8px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                           (activeScaling?.axis || footerScaleAxis) === key ? 'bg-[#f0a144] text-black font-black' : 'text-gray-400 hover:text-white'
                         }`}
                         title={`Dimensión ${title}`}
                       >
                         {label}
                       </button>
                     ))}
                   </div>

                   {/* Resumen del movimiento del gizmo y medida actual */}
                   <span className="text-gray-300 text-[8px] sm:text-[9px] border-l border-[#3a3a3a] pl-1 sm:pl-1.5 font-semibold shrink-0 hidden sm:inline">
                     {activeScaling && activeScaling.isDragging ? (
                       <span>
                         {activeScaling.axis === 'largo' ? 'Largo' : activeScaling.axis === 'ancho' ? 'Ancho' : 'Espesor'}:{' '}
                         <span className="text-white font-bold">
                           {activeScaling.axis === 'largo' ? activeScaling.largo : activeScaling.axis === 'ancho' ? activeScaling.ancho : activeScaling.espesor} mm
                         </span>
                         {activeScaling.delta !== undefined && activeScaling.delta !== 0 && (
                           <span className="text-[#f0a144] ml-1 font-mono font-bold">
                             ({activeScaling.delta > 0 ? `+${activeScaling.delta}` : activeScaling.delta} mm)
                           </span>
                         )}
                         {activeScaling.isSnapped && (
                           <span className="text-[#fbbf24] ml-1 font-bold text-[7.5px] bg-[#fbbf24]/15 px-1 py-0.2 rounded border border-[#fbbf24]/30" title="Imán acoplado">
                             IMÁN
                           </span>
                         )}
                       </span>
                     ) : (
                       (() => {
                         const p = pieces.find(x => x.id === selectedPieceIds[0]);
                         if (!p) return null;
                         const val = footerScaleAxis === 'largo' ? Math.round(p.largo) : footerScaleAxis === 'ancho' ? Math.round(p.ancho) : Math.round(p.espesor);
                         const name = footerScaleAxis === 'largo' ? 'Largo' : footerScaleAxis === 'ancho' ? 'Ancho' : 'Espesor';
                         return <span>{name}: <span className="text-white font-bold">{val} mm</span></span>;
                       })()
                     )}
                   </span>
                 </div>
               ) : selectedPieceIds.length > 0 && transformMode === 'texture' ? (
                 <div className="flex items-center gap-1.5 font-mono bg-[#141414] px-2 py-0.5 rounded border border-[#f0a144]/60 text-[#f0a144] shrink-0">
                   <span className="w-1.5 h-1.5 rounded-full bg-[#f0a144]" />
                   <span className="font-bold text-[9px] flex items-center gap-1.5">
                     TEXTURA:
                     <button
                       type="button"
                       onClick={() => handleOpenTextureEditor(selectedPieceIds[0])}
                       className="bg-[#f0a144] text-black px-2 py-0.2 rounded text-[8.5px] font-bold hover:bg-[#e09438] transition-colors"
                     >
                       Catálogo
                     </button>
                   </span>
                   {(() => {
                     const p = pieces.find(x => x.id === selectedPieceIds[0]);
                     const count = p?.faceTextures ? Object.values(p.faceTextures).filter(Boolean).length : 0;
                     return (
                       <span className="text-gray-300 text-[8.5px] border-l border-[#3a3a3a] pl-1.5">
                         {count > 0 ? `${count} cara(s) con textura` : 'Color base'}
                       </span>
                     );
                   })()}
                 </div>
               ) : (
                 /* Sin selección: Estado limpio, consistente y libre de información inútil con ceros */
                 <div className="flex items-center gap-2 text-[#888888] text-[8.5px] font-sans shrink-0">
                   <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181818] border border-white/5 text-gray-300 font-medium">
                     <span className="text-gray-500">Modo:</span>
                     <span className="text-[#f0a144] font-bold">
                       {transformMode === 'scale' ? 'Dimensionar' : transformMode === 'rotate' ? 'Rotar' : transformMode === 'texture' ? 'Textura' : transformMode === 'stretch' ? 'Estirado Inteligente' : 'Mover'}
                     </span>
                   </span>
                   <span className="text-gray-400 hidden xs:inline">
                     {transformMode === 'texture'
                       ? 'Selecciona una pieza para aplicar materiales'
                       : 'Selecciona una pieza en 3D para transformar'}
                   </span>
                 </div>
               )}
             </div>

             <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-[8px] sm:text-[9px]">
               {pieces.length > 0 && (
                 <span className="hidden md:inline text-gray-400 font-medium">
                   {pieces.length} {pieces.length === 1 ? 'pieza' : 'piezas'}
                 </span>
               )}
               <span className="hidden sm:inline text-gray-400">Unidades: mm</span>
               <span className={`text-[#cccccc] ${selectedPieceIds.length > 0 ? 'hidden sm:inline' : ''}`}>v0.5.0</span>
             </div>
          </footer>
        </div>

        {/* Floating Draggable Default Tray (matches catalog window, draggable, compact & interactive) */}
        {viewMode === '3d' && isTrayOpen && (
          <div 
            className="fixed z-40 pointer-events-auto select-none"
            style={{ left: `${trayPosition.x}px`, top: `${trayPosition.y}px` }}
            onClick={e => e.stopPropagation()}
          >
            <div 
              className="bg-[#14151a]/95 backdrop-blur-md border border-[#2d313d] rounded-xl sm:rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-gray-200 relative group"
              style={{ width: `${traySize.width}px`, height: `${traySize.height}px` }}
            >
              
              {/* Header (Draggable handle) */}
              <div 
                className="h-7 sm:h-8 bg-[#101115] border-b border-[#22242e] flex items-center justify-between px-2 sm:px-2.5 shrink-0 select-none cursor-grab active:cursor-grabbing"
                {...trayDragProps}
                title="Arrastrar bandeja predeterminada"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <GripHorizontal className="w-3 h-3 text-gray-500 shrink-0" />
                  <PanelRight className="w-3.5 h-3.5 text-[#f0a144] shrink-0" />
                  <span className="text-[9.5px] sm:text-[10px] font-black uppercase text-[#e5e5e5] tracking-wider truncate">
                    Bandeja
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[6.5px] sm:text-[7px] text-[#10b981] font-bold bg-[#10b981]/10 px-1 py-0.2 rounded border border-[#10b981]/20">
                    ACTIVA
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTrayOpen(false)}
                    className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
                    title="Cerrar bandeja"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Trays Area */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#20222a] bg-[#0d0e12] [scrollbar-width:thin]">
              
              {/* TRAY 1: ESQUEMA (OUTLINER) */}
              <div className="flex flex-col">
                <div 
                  onClick={() => toggleTray('esquema')}
                  className="h-7 bg-[#262626] hover:bg-[#2d2d2d] flex items-center justify-between px-2 cursor-pointer select-none transition-colors border-t border-[#3c3c3c]/30 border-b border-[#151515]"
                >
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.esquema ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span>Esquema</span>
                  </div>
                  <div className="flex items-center gap-1 text-[8px] text-[#888888]">
                    <Layers className="w-2.5 h-2.5 text-emerald-400" />
                    <span className="font-mono text-[7px] bg-[#111] px-1 rounded text-[#888]">
                      {pieces.length} OBJ
                    </span>
                  </div>
                </div>

                 {trayOpen.esquema && (
                  <div className="bg-[#232323] p-1.5 font-mono animate-in fade-in duration-100 max-h-[220px] overflow-y-auto">
                     <div className="flex items-center justify-between px-2 py-1 text-[#cccccc] hover:bg-[#3d3d3d] rounded cursor-default group">
                       <div className="flex items-center gap-1.5 min-w-0">
                         <Box className="w-3 h-3 text-[#f0a144] shrink-0" />
                         <span className="text-[10px] truncate">Scene Collection</span>
                       </div>
                       <div className="flex items-center gap-1 shrink-0">
                         {selectedPieceIds.length > 0 && (
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               deleteSelectedPieces();
                             }}
                             className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-white/10 shrink-0 transition-colors cursor-pointer"
                             title={`Eliminar piezas seleccionadas (${selectedPieceIds.length})`}
                           >
                             <Trash2 className="w-2.5 h-2.5" />
                           </button>
                         )}
                         {pieces.some(p => p.hidden) && (
                           <button
                             type="button"
                             onClick={(e) => {
                               e.stopPropagation();
                               setPieces(prev => prev.map(p => ({ ...p, hidden: false })));
                             }}
                             className="text-amber-400 hover:text-amber-300 p-0.5 rounded hover:bg-white/10 shrink-0"
                             title="Mostrar todas las piezas ocultas"
                           >
                             <Eye className="w-3 h-3" />
                           </button>
                         )}
                       </div>
                     </div>
                     <div className="ml-4 space-y-0.5 mt-1 border-l border-[#333] pl-1">
                       {/* Groups */}
                       {groups.map(group => {
                         const groupPieces = pieces.filter(p => p.groupId === group.id);
                         const isGroupSelected = groupPieces.length > 0 && groupPieces.every(p => selectedPieceIds.includes(p.id));
                         const isGroupHidden = groupPieces.length > 0 && groupPieces.every(p => p.hidden);
                         
                         return (
                           <div key={group.id} className="space-y-0.5">
                              <div 
                                onClick={() => {
                                  const ids = groupPieces.map(p => p.id);
                                  setSelectedPieceIds(ids);
                                }}
                                className={"flex items-center group/item gap-2 px-2 py-0.5 text-[10px] rounded cursor-default " + (isGroupSelected ? "bg-[#3b4b5b] text-white outline outline-1 outline-[#3b82f6]" : isGroupHidden ? "text-gray-500 hover:bg-[#3d3d3d]" : "text-emerald-400/80 hover:bg-[#3d3d3d]")}
                              >
                                <Combine className="w-2.5 h-2.5 shrink-0" />
                                <input 
                                  value={group.name} 
                                  onChange={(e) => setGroups(prev => prev.map(g => g.id === group.id ? { ...g, name: e.target.value } : g))}
                                  className="bg-transparent border-none outline-none text-current italic font-bold truncate flex-1 min-w-0" 
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newHiddenState = !isGroupHidden;
                                    setPieces(prev => prev.map(p => p.groupId === group.id ? { ...p, hidden: newHiddenState } : p));
                                  }}
                                  className="text-[#888] hover:text-white shrink-0 px-0.5 transition-colors"
                                  title={isGroupHidden ? "Mostrar grupo" : "Ocultar grupo"}
                                >
                                  {isGroupHidden ? <EyeOff className="w-2.5 h-2.5 text-amber-400/80" /> : <Eye className="w-2.5 h-2.5" />}
                                </button>
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteGroup(group.id);
                                  }}
                                  className="text-[#888] hover:text-red-400 shrink-0 px-1 transition-colors cursor-pointer"
                                  title="Eliminar grupo"
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
                                    className={"flex items-center group/piece gap-2 px-2 py-0.5 text-[9px] rounded cursor-default " + (selectedPieceIds.includes(piece.id) ? "bg-[#565656] text-white outline outline-1 outline-[#f0a144]" : piece.hidden ? "text-[#555555] hover:bg-[#3d3d3d]" : "text-[#888888] hover:bg-[#3d3d3d]")}
                                  >
                                    <Box className="w-2 h-2 shrink-0" />
                                    <input 
                                      value={piece.name || ("Piece." + (idx+1))} 
                                      onChange={(e) => updatePiece(piece.id, { name: e.target.value })}
                                      className="bg-transparent border-none outline-none text-current truncate flex-1 min-w-0" 
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updatePiece(piece.id, { hidden: !piece.hidden });
                                      }}
                                      className="text-[#888] hover:text-white shrink-0 px-0.5 transition-colors"
                                      title={piece.hidden ? "Mostrar pieza" : "Ocultar pieza"}
                                    >
                                      {piece.hidden ? <EyeOff className="w-2.5 h-2.5 text-amber-400/80" /> : <Eye className="w-2.5 h-2.5" />}
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={(e) => {
                                        deletePiece(piece.id, e);
                                      }}
                                      className="text-[#888] hover:text-red-400 shrink-0 px-1 transition-colors cursor-pointer"
                                      title="Eliminar pieza"
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
                       {pieces.filter(p => !p.groupId).map((piece, idx) => (
                          <div 
                            key={piece.id}
                            onClick={(e) => toggleSelection(piece.id, e.shiftKey)}
                            className={"flex items-center group/piece gap-2 px-2 py-0.5 text-[10px] rounded cursor-default " + (selectedPieceIds.includes(piece.id) ? "bg-[#565656] text-white outline outline-1 outline-[#f0a144]" : piece.hidden ? "text-[#555555] hover:bg-[#3d3d3d]" : "text-[#999999] hover:bg-[#3d3d3d]")}
                          >
                            <Box className="w-2.5 h-2.5 shrink-0" />
                            <input 
                              value={piece.name || ("Piece." + (idx+1))} 
                              onChange={(e) => updatePiece(piece.id, { name: e.target.value })}
                              className="bg-transparent border-none outline-none text-current truncate flex-1 min-w-0" 
                              onClick={(e) => e.stopPropagation()}
                            />
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updatePiece(piece.id, { hidden: !piece.hidden });
                              }}
                              className="text-[#888] hover:text-white shrink-0 px-0.5 transition-colors"
                              title={piece.hidden ? "Mostrar pieza" : "Ocultar pieza"}
                            >
                              {piece.hidden ? <EyeOff className="w-2.5 h-2.5 text-amber-400/80" /> : <Eye className="w-2.5 h-2.5" />}
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                deletePiece(piece.id, e);
                              }}
                              className="text-[#888] hover:text-red-400 shrink-0 px-1 transition-colors cursor-pointer"
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
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.entidad ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span>Información de la entidad</span>
                    {(() => {
                      const selPiece = pieces.find(p => p.id === selectedPieceIds[0]);
                      const grp = selPiece?.groupId ? groups.find(g => g.id === selPiece.groupId) : null;
                      if (grp) {
                        return (
                          <span className="text-[7.5px] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/60 ml-1 truncate max-w-[100px]">
                            {grp.name}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7.5px] font-mono text-[#888888]">INFO</span>
                  </div>
                </div>

                {trayOpen.entidad && (
                  <div className="bg-[#1e1e1e] p-3 text-[10px] text-[#ccc] space-y-3 animate-in fade-in duration-100">
                    {selectedPieceIds.length > 0 ? (
                      <div className="space-y-3">
                        {/* Tarjeta Principal de Entidad (Grupo o Pieza) */}
                        {(() => {
                          const currentPiece = pieces.find(p => p.id === selectedPieceIds[0]);
                          if (!currentPiece) return null;
                          const currentGroup = currentPiece.groupId ? groups.find(g => g.id === currentPiece.groupId) : null;
                          const groupPieces = currentGroup ? pieces.filter(p => p.groupId === currentGroup.id) : [];
                          const isGroupHidden = groupPieces.length > 0 && groupPieces.every(p => p.hidden);

                          if (currentGroup) {
                            return (
                              <div className="flex flex-col gap-2 bg-[#141414] p-2.5 rounded-lg border border-cyan-500/30 shadow-xs">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="p-1 rounded bg-cyan-950 border border-cyan-800/60 text-cyan-400">
                                      <Combine className="w-3 h-3" />
                                    </span>
                                    <div className="flex flex-col">
                                      <span className="text-[8px] font-black text-cyan-400 uppercase tracking-wider">
                                        Nombre del Grupo
                                      </span>
                                      <span className="text-[7px] text-gray-400">
                                        {groupPieces.length} {groupPieces.length === 1 ? 'pieza' : 'piezas'} en este grupo
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newHidden = !isGroupHidden;
                                      setPieces(prev => prev.map(p => p.groupId === currentGroup.id ? { ...p, hidden: newHidden } : p));
                                    }}
                                    className={`flex items-center gap-1 text-[7.5px] font-bold px-2 py-1 rounded border transition-colors cursor-pointer ${
                                      isGroupHidden 
                                        ? 'border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20' 
                                        : 'border-cyan-500/30 text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/40'
                                    }`}
                                    title={isGroupHidden ? "Mostrar todo el grupo en 3D" : "Ocultar todo el grupo en 3D"}
                                  >
                                    {isGroupHidden ? <EyeOff className="w-2.5 h-2.5 text-amber-400" /> : <Eye className="w-2.5 h-2.5" />}
                                    <span>{isGroupHidden ? 'Grupo Oculto' : 'Grupo Visible'}</span>
                                  </button>
                                </div>
                                <input 
                                  type="text" 
                                  value={currentGroup.name} 
                                  onChange={(e) => {
                                    setGroups(prev => prev.map(g => g.id === currentGroup.id ? { ...g, name: e.target.value } : g));
                                  }}
                                  placeholder="Nombre del grupo..."
                                  className="bg-[#0c0c0c] border border-cyan-700/50 focus:border-cyan-400 text-[10.5px] text-cyan-200 font-bold px-2 py-1 rounded outline-none w-full select-text"
                                />
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-col gap-1.5 bg-[#141414] p-2 rounded-lg border border-[#2e2e2e]">
                              <div className="flex items-center justify-between">
                                <label className="text-[7.5px] font-bold text-[#888888] uppercase tracking-wider">
                                  Nombre de la Pieza
                                </label>
                                <button
                                  type="button"
                                  onClick={() => updatePiece(currentPiece.id, { hidden: !currentPiece.hidden })}
                                  className={`flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                    currentPiece.hidden 
                                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20' 
                                      : 'text-gray-400 bg-white/5 border-white/10 hover:text-white hover:bg-white/10'
                                  }`}
                                  title={currentPiece.hidden ? "Mostrar pieza en 3D" : "Ocultar pieza en 3D"}
                                >
                                  {currentPiece.hidden ? <EyeOff className="w-2.5 h-2.5 text-amber-400" /> : <Eye className="w-2.5 h-2.5" />}
                                  <span>{currentPiece.hidden ? 'Oculta' : 'Visible'}</span>
                                </button>
                              </div>
                              <input 
                                type="text" 
                                value={currentPiece.name || ''} 
                                onChange={(e) => {
                                  updatePiece(currentPiece.id, { name: e.target.value });
                                }}
                                placeholder="Nombre de la pieza"
                                className="bg-[#0c0c0c] border border-[#333333] focus:border-[#f0a144] text-[10px] text-white px-2 py-1 rounded outline-none w-full font-medium select-text"
                              />
                            </div>
                          );
                        })()}

                        {/* 3D Transform Mode Selector & Quick Tools in Tray */}
                        {(() => {
                          const currentPiece = pieces.find(p => p.id === selectedPieceIds[0]);
                          if (!currentPiece) return null;
                          const posX = Math.round((currentPiece.position3D?.[0] || 0) * 1000);
                          const posY = Math.round((currentPiece.position3D?.[1] || 0) * 1000);
                          const posZ = Math.round((currentPiece.position3D?.[2] || 0) * 1000);

                          return (
                            <div className="bg-[#141414] p-2 rounded-lg border border-[#2e2e2e] space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[7.5px] font-bold text-[#888] uppercase tracking-wider flex items-center gap-1">
                                  <Box className="w-2.5 h-2.5 text-[#f0a144]" />
                                  Herramientas 3D
                                </span>
                                <span className="text-[7px] text-[#f0a144] font-bold font-mono uppercase bg-[#f0a144]/10 px-1.5 py-0.2 rounded border border-[#f0a144]/20">
                                  MODO: {transformMode.toUpperCase()}
                                </span>
                              </div>

                              {/* Mode Buttons */}
                              <div className="grid grid-cols-5 gap-1">
                                <button
                                  type="button"
                                  onClick={() => setTransformMode('translate')}
                                  className={`py-1.5 px-0.5 rounded flex flex-col items-center gap-0.5 text-[7px] font-bold transition-all cursor-pointer ${
                                    transformMode === 'translate' ? 'bg-[#f0a144] text-black shadow-md' : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                                  }`}
                                  title="Mover pieza en el espacio 3D (G)"
                                >
                                  <Move className="w-3.5 h-3.5" />
                                  <span>Mover</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTransformMode('rotate')}
                                  className={`py-1.5 px-0.5 rounded flex flex-col items-center gap-0.5 text-[7px] font-bold transition-all cursor-pointer ${
                                    transformMode === 'rotate' ? 'bg-[#f0a144] text-black shadow-md' : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                                  }`}
                                  title="Rotar libremente con gizmo en 3D (R)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Rotar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTransformMode('scale')}
                                  className={`py-1.5 px-0.5 rounded flex flex-col items-center gap-0.5 text-[7px] font-bold transition-all cursor-pointer ${
                                    transformMode === 'scale' ? 'bg-[#f0a144] text-black shadow-md' : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                                  }`}
                                  title="Dimensionar medidas interactivas en 3D (S)"
                                >
                                  <Expand className="w-3.5 h-3.5" />
                                  <span>Dimens.</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setTransformMode('stretch')}
                                  className={`py-1.5 px-0.5 rounded flex flex-col items-center gap-0.5 text-[7px] font-bold transition-all cursor-pointer ${
                                    transformMode === 'stretch' ? 'bg-[#a3e635] text-black shadow-md font-black' : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                                  }`}
                                  title="Estirado Inteligente: estirar grupo sin deformar espesores (E)"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                  <span>Estirar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenTextureEditor(currentPiece.id)}
                                  className={`py-1.5 px-0.5 rounded flex flex-col items-center gap-0.5 text-[7px] font-bold transition-all cursor-pointer ${
                                    transformMode === 'texture' ? 'bg-[#f0a144] text-black shadow-md' : 'bg-[#222] text-gray-400 hover:text-white hover:bg-[#2c2c2c]'
                                  }`}
                                  title="Editor de texturas y fotos por cara"
                                >
                                  <Palette className="w-3.5 h-3.5" />
                                  <span>Textura</span>
                                </button>
                              </div>

                              {/* Estirado Inteligente In-Tray Config when in stretch mode */}
                              {transformMode === 'stretch' && (
                                <div className="p-2 bg-[#a3e635]/10 border border-[#a3e635]/30 rounded space-y-1.5 animate-in fade-in">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[7.5px] font-bold text-[#a3e635] uppercase">
                                      Estirado Inteligente (Smart Stretch)
                                    </span>
                                    <span className="text-[7px] text-gray-400 font-mono">
                                      {Math.round(fredoCurrentDim)} mm
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-[8px]">
                                    <span className="text-gray-400 font-medium">Eje:</span>
                                    <div className="flex items-center gap-1">
                                      {(['X', 'Y', 'Z'] as const).map(ax => (
                                        <button
                                          key={ax}
                                          type="button"
                                          onClick={() => setFredoAxis(ax)}
                                          className={`px-2 py-0.5 rounded text-[8px] font-bold transition-colors ${
                                            fredoAxis === ax ? 'bg-[#a3e635] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                                          }`}
                                        >
                                          {ax}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-[8px]">
                                    <span className="text-gray-400 font-medium">Anclaje:</span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setFredoMode('anchor-neg')}
                                        className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold transition-colors ${
                                          fredoMode === 'anchor-neg' ? 'bg-[#a3e635] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                                        }`}
                                      >
                                        Anclado
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setFredoMode('center')}
                                        className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold transition-colors ${
                                          fredoMode === 'center' ? 'bg-[#a3e635] text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                                        }`}
                                      >
                                        Simétrico (Centro)
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between text-[8px]">
                                    <span className="text-gray-400 font-medium">Malla:</span>
                                    <div className="flex items-center gap-1">
                                      {[
                                        { r: 0.25, label: '25%' },
                                        { r: 0.5, label: '50%' },
                                        { r: 0.75, label: '75%' }
                                      ].map(({ r, label }) => (
                                        <button
                                          key={label}
                                          type="button"
                                          onClick={() => setFredoPlaneRatio(r)}
                                          className={`px-1.5 py-0.5 rounded text-[7.5px] font-bold transition-colors ${
                                            Math.abs(fredoPlaneRatio - r) < 0.05 ? 'bg-cyan-500 text-black' : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                                          }`}
                                        >
                                          {label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 pt-1 border-t border-[#a3e635]/20">
                                    <input
                                      type="text"
                                      value={fredoInputText}
                                      onChange={(e) => setFredoInputText(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleCommitFredoInput();
                                      }}
                                      placeholder="Medida o +/- mm"
                                      className="flex-1 bg-[#0e0e0e] border border-[#333333] focus:border-[#a3e635] text-[9.5px] text-white px-2 py-0.5 rounded outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleCommitFredoInput()}
                                      className="px-2 py-0.5 bg-[#a3e635] text-black font-bold text-[8.5px] rounded hover:bg-[#bef264] cursor-pointer"
                                    >
                                      Aplicar
                                    </button>
                                  </div>

                                  <div className="flex items-center justify-between pt-0.5">
                                    <span className="text-[7.5px] text-gray-400">Pasos rápidos:</span>
                                    <div className="flex items-center gap-1">
                                      {[-50, +50, +100].map(step => (
                                        <button
                                          key={step}
                                          type="button"
                                          onClick={() => handleQuickFredoStep(step)}
                                          className={`px-1.5 py-0.2 rounded text-[7.5px] font-bold cursor-pointer ${
                                            step > 0 ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-700/50' : 'bg-red-950 text-red-300 hover:bg-red-900 border border-red-700/50'
                                          }`}
                                        >
                                          {step > 0 ? `+${step}` : step}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Rotación Rápida 90° */}
                              <div className="flex items-center justify-between pt-1 border-t border-[#252525]">
                                <span className="text-[7px] text-gray-400 font-bold uppercase">Giro 90°:</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentRot = currentPiece.rotation3D || [0, 0, 0];
                                      updatePiece(currentPiece.id, { rotation3D: [currentRot[0] + Math.PI / 2, currentRot[1], currentRot[2]] });
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#da3c3c]/20 hover:bg-[#da3c3c]/40 text-[#da3c3c] border border-[#da3c3c]/40 transition-colors cursor-pointer"
                                    title="Rotar 90° en Eje X"
                                  >
                                    X 90°
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentRot = currentPiece.rotation3D || [0, 0, 0];
                                      updatePiece(currentPiece.id, { rotation3D: [currentRot[0], currentRot[1] + Math.PI / 2, currentRot[2]] });
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#3cda3c]/20 hover:bg-[#3cda3c]/40 text-[#3cda3c] border border-[#3cda3c]/40 transition-colors cursor-pointer"
                                    title="Rotar 90° en Eje Y"
                                  >
                                    Y 90°
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const currentRot = currentPiece.rotation3D || [0, 0, 0];
                                      updatePiece(currentPiece.id, { rotation3D: [currentRot[0], currentRot[1], currentRot[2] + Math.PI / 2] });
                                    }}
                                    className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#3c3cda]/20 hover:bg-[#3c3cda]/40 text-[#6868ff] border border-[#3c3cda]/40 transition-colors cursor-pointer"
                                    title="Rotar 90° en Eje Z"
                                  >
                                    Z 90°
                                  </button>
                                </div>
                              </div>

                              {/* Posición 3D Numérica (X, Y, Z en mm) */}
                              <div className="pt-1 border-t border-[#252525] space-y-1">
                                <div className="flex items-center justify-between text-[7px] text-gray-400 font-bold uppercase">
                                  <span>Posición 3D (mm):</span>
                                  <button
                                    type="button"
                                    onClick={handleSnapSelectedPiecesToFloor}
                                    className="text-[7px] text-[#f0a144] hover:underline font-bold cursor-pointer"
                                    title="Apoyar exactamente en el suelo (0mm)"
                                  >
                                    Piso (0mm)
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-1 font-mono text-[8px]">
                                  <div className="bg-[#0e0e0e] border border-[#2e2e2e] rounded px-1.5 py-0.5 flex items-center justify-between">
                                    <span className="text-[#da3c3c] font-bold">X</span>
                                    <input
                                      type="number"
                                      value={posX}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        updatePiece(currentPiece.id, { position3D: [val / 1000, currentPiece.position3D[1], currentPiece.position3D[2]] });
                                      }}
                                      className="w-10 bg-transparent text-right text-white outline-none"
                                    />
                                  </div>
                                  <div className="bg-[#0e0e0e] border border-[#2e2e2e] rounded px-1.5 py-0.5 flex items-center justify-between">
                                    <span className="text-[#3cda3c] font-bold">Y</span>
                                    <input
                                      type="number"
                                      value={posY}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        updatePiece(currentPiece.id, { position3D: [currentPiece.position3D[0], val / 1000, currentPiece.position3D[2]] });
                                      }}
                                      className="w-10 bg-transparent text-right text-white outline-none"
                                    />
                                  </div>
                                  <div className="bg-[#0e0e0e] border border-[#2e2e2e] rounded px-1.5 py-0.5 flex items-center justify-between">
                                    <span className="text-[#6868ff] font-bold">Z</span>
                                    <input
                                      type="number"
                                      value={posZ}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        updatePiece(currentPiece.id, { position3D: [currentPiece.position3D[0], currentPiece.position3D[1], val / 1000] });
                                      }}
                                      className="w-10 bg-transparent text-right text-white outline-none"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Dimensions */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[7.5px] font-bold text-[#888888] uppercase">
                              {selectedPieceIds.length > 1 ? `Dimensiones (${selectedPieceIds.length} Piezas)` : 'Dimensiones (Cortes)'}
                            </label>
                            <button
                              type="button"
                              onClick={() => handleOpenDimensionEditor(selectedPieceIds[0], 'largo')}
                              className="text-[8px] font-bold text-[#f0a144] hover:text-[#ffb766] flex items-center gap-1 cursor-pointer transition-colors"
                              title="Ajuste numérico de medidas"
                            >
                              <Ruler className="w-2.5 h-2.5" /> Ajuste Rápido
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            <PropertyField 
                              label="Largo (X)" 
                              value={pieces.find(p => p.id === selectedPieceIds[0])?.largo || 0} 
                              onChange={(v) => {
                                if (selectedPieceIds.length > 1) {
                                  updatePieces(selectedPieceIds, { largo: v });
                                } else {
                                  updatePiece(selectedPieceIds[0], { largo: v });
                                }
                              }}
                              axis="x"
                            />
                            <PropertyField 
                              label="Espesor (Y)" 
                              value={pieces.find(p => p.id === selectedPieceIds[0])?.espesor || 0} 
                              onChange={(v) => {
                                if (selectedPieceIds.length > 1) {
                                  updatePieces(selectedPieceIds, { espesor: v });
                                } else {
                                  updatePiece(selectedPieceIds[0], { espesor: v });
                                }
                              }}
                              axis="y"
                            />
                            <PropertyField 
                              label="Ancho (Z)" 
                              value={pieces.find(p => p.id === selectedPieceIds[0])?.ancho || 0} 
                              onChange={(v) => {
                                if (selectedPieceIds.length > 1) {
                                  updatePieces(selectedPieceIds, { ancho: v });
                                } else {
                                  updatePiece(selectedPieceIds[0], { ancho: v });
                                }
                              }}
                              axis="z"
                            />
                          </div>
                        </div>

                        {/* Material y Textura en Información de la entidad */}
                        {(() => {
                          const activePiece = pieces.find(p => p.id === selectedPieceIds[0]);
                          if (!activePiece) return null;
                          const matName = activePiece.material || 'Blanco';
                          const matInfo = MATERIAL_MAP[matName] || MATERIAL_MAP['Blanco'];
                          const actualColor = activePiece.customColor || matInfo.color;
                          
                          const texturedFacesCount = activePiece.faceTextures 
                            ? Object.values(activePiece.faceTextures).filter(Boolean).length 
                            : 0;
                          
                          const sampleTextureUrl = activePiece.faceTextures 
                            ? (activePiece.faceTextures.top || Object.values(activePiece.faceTextures).find(Boolean))
                            : null;

                          return (
                            <div className="space-y-1.5 pt-2 border-t border-[#2a2a2a]">
                              <div className="flex items-center justify-between">
                                <label className="text-[7.5px] font-bold text-[#888888] uppercase tracking-wider flex items-center gap-1">
                                  <Palette className="w-2.5 h-2.5 text-[#f0a144]" />
                                  Material y Textura
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleOpenTextureEditor(activePiece.id)}
                                  className="text-[7px] font-bold text-[#f0a144] hover:text-[#ffba66] hover:bg-[#f0a144]/10 px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                  title="Abrir editor de texturas y fotos por cara"
                                >
                                  <ImageIcon className="w-2.5 h-2.5" /> Catálogo de Texturas
                                </button>
                              </div>

                              <div className="bg-[#141414] rounded-lg border border-[#2b2b2b] p-2 flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  {sampleTextureUrl ? (
                                    <div 
                                      className="w-5 h-5 rounded border border-[#444] shrink-0 bg-cover bg-center shadow-xs"
                                      style={{ backgroundImage: `url(${sampleTextureUrl})` }}
                                      title="Textura personalizada activa"
                                    />
                                  ) : (
                                    <div 
                                      className="w-5 h-5 rounded border border-[#444] shrink-0 shadow-xs"
                                      style={{ backgroundColor: actualColor }}
                                      title={`Color: ${actualColor}`}
                                    />
                                  )}

                                  <select
                                    value={matName}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const updates: Partial<Piece> = {
                                        material: val,
                                        customColor: val === 'Custom' ? actualColor : undefined
                                      };
                                      if (selectedPieceIds.length > 1) {
                                        selectedPieceIds.forEach(id => updatePiece(id, updates));
                                      } else {
                                        updatePiece(activePiece.id, updates);
                                      }
                                    }}
                                    className="flex-1 bg-[#1e1e1e] border border-[#333333] focus:border-[#f0a144] rounded px-1.5 py-1 text-white text-[9.5px] outline-none cursor-pointer truncate"
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
                                      <option value="Custom" className="text-white bg-[#111] font-normal">🎨 Personalizado (Color libre)</option>
                                    </optgroup>
                                  </select>
                                </div>

                                <div className="flex items-center justify-between text-[7.5px] pt-1 border-t border-[#222222]">
                                  <span className="text-gray-400 font-medium">
                                    {texturedFacesCount > 0 
                                      ? `🖼️ ${texturedFacesCount}/6 caras con foto` 
                                      : 'Color plano (sin foto)'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {texturedFacesCount > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const defaultWhite = MATERIAL_MAP['Blanco'];
                                          const updates = { 
                                            material: 'Blanco',
                                            customColor: defaultWhite.color,
                                            customRoughness: defaultWhite.roughness,
                                            customMetalness: defaultWhite.metalness,
                                            customOpacity: 1.0,
                                            isGlass: false,
                                            isMirror: false,
                                            cantoColor: undefined,
                                            faceTextures: undefined, 
                                            faceTextureConfigs: undefined,
                                            veta: false,
                                            vetaRotation: 0,
                                            vetaOrientacion: 'longitudinal' as const
                                          };
                                          if (selectedPieceIds.length > 1) {
                                            selectedPieceIds.forEach(id => updatePiece(id, updates));
                                          } else {
                                            updatePiece(activePiece.id, updates);
                                          }
                                        }}
                                        className="text-red-400 hover:text-red-300 text-[7px] px-1 py-0.5 rounded hover:bg-red-950/40 transition-colors cursor-pointer"
                                        title="Quitar fotos de todas las caras"
                                      >
                                        Quitar
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenTextureEditor(activePiece.id)}
                                      className="text-[#f0a144] hover:text-[#ffba66] font-bold text-[7px] px-1.5 py-0.5 rounded bg-[#f0a144]/10 hover:bg-[#f0a144]/20 transition-colors cursor-pointer"
                                    >
                                      {texturedFacesCount > 0 ? 'Editar' : '+ Texturizar'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Cantos en Información de la entidad (Minimalista y Práctico) */}
                        {(() => {
                          const activePiece = pieces.find(p => p.id === selectedPieceIds[0]);
                          if (!activePiece) return null;
                          const cutInfo = calculatePieceCutDimensions(activePiece, edgeThicknessConfig);

                          return (
                            <div className="space-y-1.5 pt-2 border-t border-[#2a2a2a]">
                              <div className="flex items-center justify-between">
                                <label className="text-[7.5px] font-bold text-[#888888] uppercase tracking-wider">
                                  Cantos de la Pieza
                                </label>
                                <span className="text-[6.5px] text-[#f0a144] font-mono">
                                  GRU = {edgeThicknessConfig.grueso}mm
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-1">
                                {([
                                  { key: 'largo1', label: 'Largo 1', sub: 'L1 (Frente)' },
                                  { key: 'largo2', label: 'Largo 2', sub: 'L2 (Atrás)' },
                                  { key: 'ancho1', label: 'Ancho 1', sub: 'A1 (Derecha)' },
                                  { key: 'ancho2', label: 'Ancho 2', sub: 'A2 (Izquierda)' },
                                ] as const).map(edge => {
                                  const val = activePiece.cantos?.[edge.key] || 'Ninguno';
                                  return (
                                    <EntityCantoFieldTray
                                      key={edge.key}
                                      label={edge.label}
                                      sub={edge.sub}
                                      value={val}
                                      gruesoMm={edgeThicknessConfig.grueso}
                                      delgadoMm={edgeThicknessConfig.delgado}
                                      onCycle={(reverse) => {
                                        const cycleOrder = ['Ninguno', 'Canto Delgado', 'Canto Grueso'];
                                        const curIdx = cycleOrder.indexOf(val);
                                        const nextIdx = reverse ? (curIdx - 1 + 3) % 3 : (curIdx + 1) % 3;
                                        updateEdge(activePiece.id, edge.key, cycleOrder[nextIdx] as any);
                                      }}
                                    />
                                  );
                                })}
                              </div>

                              {/* Medidas Netas para Corte con Descuento */}
                              <div className="bg-[#141414] border border-[#2b2b2b] rounded p-2 flex flex-col gap-1 mt-1">
                                <div className="flex items-center justify-between text-[7.5px] font-bold uppercase">
                                  <span className="text-[#888888]">Corte Neto Requerido:</span>
                                  {cutInfo.tieneDescuento ? (
                                    <span className="text-red-400 font-mono text-[7px] bg-red-950/70 border border-red-800/40 px-1 py-0.2 rounded font-bold">
                                      -{(cutInfo.descuentoLargoTotal + cutInfo.descuentoAnchoTotal).toFixed(1)}mm cantos
                                    </span>
                                  ) : (
                                    <span className="text-[#666] font-mono text-[7px]">Sin descuento</span>
                                  )}
                                </div>
                                <div className="flex items-baseline justify-between font-mono">
                                  <span className="text-white text-[11px] font-bold">
                                    {cutInfo.largoCorte} <span className="text-[#888] text-[9px]">×</span> {cutInfo.anchoCorte} <span className="text-[#666] text-[8px]">mm</span>
                                  </span>
                                  <span className="text-[7.5px] text-[#aaa]">
                                    (Final: {Math.round(activePiece.largo)} × {Math.round(activePiece.ancho)})
                                  </span>
                                </div>
                              </div>

                              {/* VETA y RANURA con Orientación y Rotación de Textura */}
                              {(() => {
                                const currentVetaRot = activePiece.vetaRotation ?? (activePiece.vetaOrientacion === 'transversal' ? 90 : 0);
                                const isTransversal = activePiece.vetaOrientacion === 'transversal' || currentVetaRot === 90 || currentVetaRot === 270;

                                const handleRotateVetaAndTexture = () => {
                                  const nextRot = (currentVetaRot + 90) % 360;
                                  const nextOrientacion = (nextRot === 90 || nextRot === 270) ? 'transversal' : 'longitudinal';

                                  const updatedConfigs = { ...(activePiece.faceTextureConfigs || {}) };
                                  const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
                                  allFaces.forEach(f => {
                                    updatedConfigs[f] = {
                                      repeatX: updatedConfigs[f]?.repeatX || 1,
                                      repeatY: updatedConfigs[f]?.repeatY || 1,
                                      rotation: nextRot
                                    };
                                  });

                                  const updates: Partial<Piece> = {
                                    veta: true,
                                    vetaRotation: nextRot,
                                    vetaOrientacion: nextOrientacion,
                                    faceTextureConfigs: updatedConfigs
                                  };

                                  if (selectedPieceIds.length > 1) {
                                    selectedPieceIds.forEach(id => updatePiece(id, updates));
                                  } else {
                                    updatePiece(activePiece.id, updates);
                                  }
                                };

                                const handleSetOrientation = (orient: 'longitudinal' | 'transversal') => {
                                  const nextRot = orient === 'transversal' ? 90 : 0;
                                  const updatedConfigs = { ...(activePiece.faceTextureConfigs || {}) };
                                  const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
                                  allFaces.forEach(f => {
                                    updatedConfigs[f] = {
                                      repeatX: updatedConfigs[f]?.repeatX || 1,
                                      repeatY: updatedConfigs[f]?.repeatY || 1,
                                      rotation: nextRot
                                    };
                                  });

                                  const updates: Partial<Piece> = {
                                    veta: true,
                                    vetaRotation: nextRot,
                                    vetaOrientacion: orient,
                                    faceTextureConfigs: updatedConfigs
                                  };

                                  if (selectedPieceIds.length > 1) {
                                    selectedPieceIds.forEach(id => updatePiece(id, updates));
                                  } else {
                                    updatePiece(activePiece.id, updates);
                                  }
                                };

                                const handleToggleVeta = () => {
                                  const nextVeta = !activePiece.veta;
                                  const updates: Partial<Piece> = {
                                    veta: nextVeta,
                                    ...(nextVeta ? {
                                      vetaOrientacion: (currentVetaRot === 90 || currentVetaRot === 270) ? 'transversal' : 'longitudinal',
                                      vetaRotation: currentVetaRot
                                    } : {})
                                  };
                                  if (selectedPieceIds.length > 1) {
                                    selectedPieceIds.forEach(id => updatePiece(id, updates));
                                  } else {
                                    updatePiece(activePiece.id, updates);
                                  }
                                };

                                return (
                                  <div className="space-y-1 pt-1.5 border-t border-[#252525]">
                                    <label className="text-[7.5px] font-bold text-[#888888] uppercase tracking-wider">
                                      Procesos: Veta y Mecanizado
                                    </label>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      {/* Control de Veta y Rotación de Textura */}
                                      <div className={`p-1.5 rounded-lg border transition-all flex flex-col justify-between ${
                                        activePiece.veta 
                                          ? 'bg-[#f0a144]/15 border-[#f0a144]/60 text-white' 
                                          : 'bg-[#141414] border-[#2e2e2e] text-gray-400 hover:border-[#444]'
                                      }`}>
                                        <div className="flex items-center justify-between">
                                          <button
                                            type="button"
                                            onClick={handleToggleVeta}
                                            className="flex items-center gap-1 cursor-pointer"
                                            title="Alternar veta activa/inactiva"
                                          >
                                            <span className="font-bold text-[8px] uppercase tracking-wider text-[#f0a144]">VETA</span>
                                            <span className={`text-[7px] font-bold px-1 py-0.2 rounded font-mono ${
                                              activePiece.veta ? 'bg-[#f0a144] text-black' : 'bg-[#222] text-gray-500'
                                            }`}>
                                              {activePiece.veta ? 'SÍ' : 'NO'}
                                            </span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={handleRotateVetaAndTexture}
                                            className="text-[7.5px] font-mono font-bold text-[#f0a144] hover:text-white bg-[#1e1e1e] hover:bg-[#f0a144]/30 border border-[#3a3a3a] px-1 py-0.5 rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                                            title="Rotar veta y textura 90° (gira la textura en 3D)"
                                          >
                                            <RotateCw className="w-2.5 h-2.5" />
                                            <span>{currentVetaRot}°</span>
                                          </button>
                                        </div>

                                        <div className="flex items-center gap-1 mt-1 pt-1 border-t border-white/5">
                                          <button
                                            type="button"
                                            onClick={() => handleSetOrientation('longitudinal')}
                                            className={`flex-1 py-0.5 rounded text-[7px] font-bold transition-all cursor-pointer ${
                                              !isTransversal
                                                ? 'bg-[#f0a144] text-black shadow-xs'
                                                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                                            }`}
                                            title="Veta longitudinal (0° - A lo largo)"
                                          >
                                            0° Long
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSetOrientation('transversal')}
                                            className={`flex-1 py-0.5 rounded text-[7px] font-bold transition-all cursor-pointer ${
                                              isTransversal
                                                ? 'bg-[#f0a144] text-black shadow-xs'
                                                : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                                            }`}
                                            title="Veta transversal (90° - A lo ancho)"
                                          >
                                            90° Trans
                                          </button>
                                        </div>
                                      </div>

                                      {/* RANURA */}
                                      <div 
                                        className={"p-1.5 rounded-lg border flex flex-col justify-between cursor-pointer transition-colors " + (activePiece.ranurado ? "bg-[#f0a144]/15 border-[#f0a144]/60" : "bg-[#141414] border-[#2e2e2e] hover:border-[#444]")}
                                        onClick={() => {
                                          const nextRanurado = !activePiece.ranurado;
                                          updatePiece(activePiece.id, { 
                                            ranurado: nextRanurado,
                                            ranuraConfig: nextRanurado ? (activePiece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8 }) : activePiece.ranuraConfig
                                          });
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="text-[8px] font-bold text-[#f0a144]">RANURA</span>
                                          <span className={`text-[7px] font-bold px-1 py-0.2 rounded font-mono ${activePiece.ranurado ? 'bg-[#f0a144] text-black' : 'bg-[#222] text-gray-500'}`}>
                                            {activePiece.ranurado ? 'SÍ' : 'NO'}
                                          </span>
                                        </div>
                                        <span className="text-[7px] text-gray-400 mt-1">Mecanizado</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="text-center text-[9px] text-[#666] py-3 italic">
                        Selecciona una pieza para ver su información
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
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.materiales ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span>Materiales</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7.5px] font-mono text-[#888888]">PBR</span>
                  </div>
                </div>

                {trayOpen.materiales && (
                  <div className="bg-[#1e1e1e] p-3 text-[10px] text-[#ccc] animate-in fade-in duration-100">
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
                            {/* Blender surface layout simulator */}
                            <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-1 text-[8px] font-bold text-[#888888]">
                              <span className="flex items-center gap-1 text-[#f0a144]">
                                ▼ Principled BSDF
                              </span>
                              <span className="text-[#64748b] text-[6px] tracking-wider font-mono">CYCLES ENGINE</span>
                            </div>

                            {/* Paleta rápida de materiales */}
                            <div className="space-y-1">
                              <span className="text-[7px] text-[#888] font-bold uppercase">Acceso Rápido:</span>
                              <div className="grid grid-cols-4 gap-1">
                                {[
                                  { id: 'Blanco', name: 'Blanco Mate', color: '#ecebe6', roughness: 0.85, metalness: 0 },
                                  { id: 'Carbono', name: 'Grafito', color: '#2c2d30', roughness: 0.5, metalness: 0 },
                                  { id: 'Roble Santana', name: 'Roble', color: '#b9956d', roughness: 0.45, metalness: 0 },
                                  { id: 'Nogal Terracota', name: 'Nogal', color: '#5f402b', roughness: 0.45, metalness: 0 },
                                ].map(mat => (
                                  <button
                                    key={mat.id}
                                    type="button"
                                    onClick={() => {
                                      updatePiece(p.id, {
                                        material: mat.id,
                                        customColor: mat.color,
                                        customRoughness: mat.roughness,
                                        customMetalness: mat.metalness,
                                        cantoColor: undefined,
                                        faceTextures: undefined,
                                        faceTextureConfigs: undefined
                                      });
                                    }}
                                    className={`p-1 rounded flex flex-col items-center gap-0.5 border transition-all cursor-pointer ${
                                      matName === mat.id ? 'border-[#f0a144] bg-[#f0a144]/10 shadow-xs' : 'border-[#333] hover:border-[#666] bg-[#141414]'
                                    }`}
                                    title={`Aplicar ${mat.name}`}
                                  >
                                    <div className="w-4 h-4 rounded border border-white/20 shadow-xs" style={{ backgroundColor: mat.color }} />
                                    <span className="text-[6.5px] text-gray-300 font-bold truncate max-w-full">{mat.name}</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Template dropdown */}
                            <div className="grid grid-cols-3 items-center gap-1.5">
                              <span className="text-[7.5px] font-bold text-[#88] uppercase text-right">Material</span>
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
                                className="col-span-2 bg-[#111111] border border-[#33] rounded px-1.5 py-0.5 text-white text-[9px] outline-none cursor-pointer focus:border-[#f0a144]"
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
                                  <option value="Custom" className="text-white bg-[#111] font-normal">🎨 Personalizado (PBR)</option>
                                </optgroup>
                              </select>
                            </div>

                            {/* Base Color Picker */}
                            <div className="grid grid-cols-3 items-center gap-1.5">
                              <span className="text-[7.5px] font-bold text-[#88] uppercase text-right">Color Base</span>
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
                                  className="flex-1 bg-[#111111] border border-[#33] text-[9px] font-mono text-center text-white py-0.5 rounded outline-none w-0 min-w-0 focus:border-[#f0a144]"
                                />
                              </div>
                            </div>

                            {/* Metalness Slider */}
                            <div className="grid grid-cols-3 items-center gap-1.5">
                              <span className="text-[7.5px] font-bold text-[#88] uppercase text-right">Metallic</span>
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
                                <span className="text-[7.5px] font-mono text-[#88] w-6 text-right">{metVal.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Roughness Slider */}
                            <div className="grid grid-cols-3 items-center gap-1.5">
                              <span className="text-[7.5px] font-bold text-[#88] uppercase text-right">Roughness</span>
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
                                <span className="text-[7.5px] font-mono text-[#88] w-6 text-right">{roughVal.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Open Texture & Photo Face Editor */}
                            <div className="pt-2 border-t border-[#2a2a2a]">
                              <button
                                type="button"
                                onClick={() => handleOpenTextureEditor(p.id)}
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#252525] hover:bg-[#303030] text-[#f0a144] border border-[#f0a144]/30 hover:border-[#f0a144] transition-all text-[9.5px] font-bold cursor-pointer"
                              >
                                <span>🖼️ Fotos y Texturas por Cara</span>
                                {p.faceTextures && Object.values(p.faceTextures).filter(Boolean).length > 0 && (
                                  <span className="bg-[#f0a144] text-black text-[8px] font-extrabold px-1.5 py-0.2 rounded-full">
                                    {Object.values(p.faceTextures).filter(Boolean).length} caras
                                  </span>
                                )}
                              </button>
                            </div>

                            {/* PBR Didactic Tips & Warnings */}
                            <div className="mt-1.5 pt-1.5 border-t border-[#2a2a2a] space-y-1">
                              <div className="flex justify-between items-center text-[6.5px] text-[#666]">
                                 <span>COMPORTAMIENTO FISICO:</span>
                                 <span className="text-[#f0a144] font-bold">{feedbackText}</span>
                              </div>
                              <p className="text-[7.5px] leading-snug text-[#999999] bg-[#111111] p-1.5 rounded border border-[#2b2b2b] italic">
                                {tipText}
                              </p>

                              {/* Edgebanding risk indicator */}
                              {hasUnbandedEdges && (
                                <div className="bg-amber-500/10 border border-amber-500/25 p-1.5 rounded text-[7.5px] text-amber-400 leading-snug">
                                  <strong>⚠️ Alerta de Fabricación:</strong> Esta pieza tiene cantos en aserrado visto (madera interna). El aglomerado sin tapar absorberá humedad y se hinchará. ¡Añade cantos (DEL / GRU) para sellarla!
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center text-[9px] text-[#666] py-3 italic">
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
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.procesos ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <span>Procesos y cantos</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7.5px] font-mono text-[#888888]">CANTOS</span>
                  </div>
                </div>

                {trayOpen.procesos && (
                  <div className="bg-[#1e1e1e] p-3 text-[10px] text-[#ccc] space-y-2 animate-in fade-in duration-100">
                    {selectedPieceIds.length > 0 ? (
                      (() => {
                        const activePiece = pieces.find(p => p.id === selectedPieceIds[0]);
                        if (!activePiece) return null;
                        
                        return (
                          <div className="space-y-2">
                            {(() => {
                              const currentVetaRot = activePiece.vetaRotation ?? (activePiece.vetaOrientacion === 'transversal' ? 90 : 0);
                              const isTransversal = activePiece.vetaOrientacion === 'transversal' || currentVetaRot === 90 || currentVetaRot === 270;

                              const handleRotateVetaAndTexture = () => {
                                const nextRot = (currentVetaRot + 90) % 360;
                                const nextOrientacion = (nextRot === 90 || nextRot === 270) ? 'transversal' : 'longitudinal';

                                const updatedConfigs = { ...(activePiece.faceTextureConfigs || {}) };
                                const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
                                allFaces.forEach(f => {
                                  updatedConfigs[f] = {
                                    repeatX: updatedConfigs[f]?.repeatX || 1,
                                    repeatY: updatedConfigs[f]?.repeatY || 1,
                                    rotation: nextRot
                                  };
                                });

                                const updates: Partial<Piece> = {
                                  veta: true,
                                  vetaRotation: nextRot,
                                  vetaOrientacion: nextOrientacion,
                                  faceTextureConfigs: updatedConfigs
                                };

                                if (selectedPieceIds.length > 1) {
                                  selectedPieceIds.forEach(id => updatePiece(id, updates));
                                } else {
                                  updatePiece(activePiece.id, updates);
                                }
                              };

                              const handleSetOrientation = (orient: 'longitudinal' | 'transversal') => {
                                const nextRot = orient === 'transversal' ? 90 : 0;
                                const updatedConfigs = { ...(activePiece.faceTextureConfigs || {}) };
                                const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
                                allFaces.forEach(f => {
                                  updatedConfigs[f] = {
                                    repeatX: updatedConfigs[f]?.repeatX || 1,
                                    repeatY: updatedConfigs[f]?.repeatY || 1,
                                    rotation: nextRot
                                  };
                                });

                                const updates: Partial<Piece> = {
                                  veta: true,
                                  vetaRotation: nextRot,
                                  vetaOrientacion: orient,
                                  faceTextureConfigs: updatedConfigs
                                };

                                if (selectedPieceIds.length > 1) {
                                  selectedPieceIds.forEach(id => updatePiece(id, updates));
                                } else {
                                  updatePiece(activePiece.id, updates);
                                }
                              };

                              const handleToggleVeta = () => {
                                const nextVeta = !activePiece.veta;
                                const updates: Partial<Piece> = {
                                  veta: nextVeta,
                                  ...(nextVeta ? {
                                    vetaOrientacion: (currentVetaRot === 90 || currentVetaRot === 270) ? 'transversal' : 'longitudinal',
                                    vetaRotation: currentVetaRot
                                  } : {})
                                };
                                if (selectedPieceIds.length > 1) {
                                  selectedPieceIds.forEach(id => updatePiece(id, updates));
                                } else {
                                  updatePiece(activePiece.id, updates);
                                }
                              };

                              return (
                                <div className="grid grid-cols-2 gap-1">
                                  {/* Control de Veta y Rotación de Textura */}
                                  <div className={`p-1.5 rounded-lg border transition-all flex flex-col justify-between ${
                                    activePiece.veta 
                                      ? 'bg-[#f0a144]/15 border-[#f0a144]/60 text-white' 
                                      : 'bg-[#141414] border-[#2e2e2e] text-gray-400 hover:border-[#444]'
                                  }`}>
                                    <div className="flex items-center justify-between">
                                      <button
                                        type="button"
                                        onClick={handleToggleVeta}
                                        className="flex items-center gap-1 cursor-pointer"
                                        title="Alternar veta activa/inactiva"
                                      >
                                        <span className="font-bold text-[8px] uppercase tracking-wider text-[#f0a144]">VETA</span>
                                        <span className={`text-[7px] font-bold px-1 py-0.2 rounded font-mono ${
                                          activePiece.veta ? 'bg-[#f0a144] text-black' : 'bg-[#222] text-gray-500'
                                        }`}>
                                          {activePiece.veta ? 'SÍ' : 'NO'}
                                        </span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={handleRotateVetaAndTexture}
                                        className="text-[7.5px] font-mono font-bold text-[#f0a144] hover:text-white bg-[#1e1e1e] hover:bg-[#f0a144]/30 border border-[#3a3a3a] px-1 py-0.5 rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                                        title="Rotar veta y textura 90° (gira la textura en 3D)"
                                      >
                                        <RotateCw className="w-2.5 h-2.5" />
                                        <span>{currentVetaRot}°</span>
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1 mt-1 pt-1 border-t border-white/5">
                                      <button
                                        type="button"
                                        onClick={() => handleSetOrientation('longitudinal')}
                                        className={`flex-1 py-0.5 rounded text-[7px] font-bold transition-all cursor-pointer ${
                                          !isTransversal
                                            ? 'bg-[#f0a144] text-black shadow-xs'
                                            : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                                        }`}
                                        title="Veta longitudinal (0° - A lo largo)"
                                      >
                                        0° Long
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSetOrientation('transversal')}
                                        className={`flex-1 py-0.5 rounded text-[7px] font-bold transition-all cursor-pointer ${
                                          isTransversal
                                            ? 'bg-[#f0a144] text-black shadow-xs'
                                            : 'bg-[#1a1a1a] text-gray-400 hover:text-white'
                                        }`}
                                        title="Veta transversal (90° - A lo ancho)"
                                      >
                                        90° Trans
                                      </button>
                                    </div>
                                  </div>

                                  <div 
                                    className={"p-1.5 rounded-lg border flex flex-col justify-between cursor-pointer transition-colors " + (activePiece.ranurado ? "bg-[#f0a144]/15 border-[#f0a144]/60" : "bg-[#141414] border-[#2e2e2e] hover:border-[#444]")}
                                    onClick={() => {
                                       const nextRanurado = !activePiece.ranurado;
                                       updatePiece(activePiece.id, { 
                                         ranurado: nextRanurado,
                                         ranuraConfig: nextRanurado ? (activePiece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8 }) : activePiece.ranuraConfig
                                       });
                                    }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-[8px] font-bold text-[#f0a144]">RANURA</span>
                                      <span className={`text-[7px] font-bold px-1 py-0.2 rounded font-mono ${activePiece.ranurado ? 'bg-[#f0a144] text-black' : 'bg-[#222] text-gray-500'}`}>
                                        {activePiece.ranurado ? 'SÍ' : 'NO'}
                                      </span>
                                    </div>
                                    <span className="text-[7px] text-gray-400 mt-1">Mecanizado</span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Slot details panel */}
                            {activePiece.ranurado && (() => {
                              const config = activePiece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8 };
                              
                              return (
                                <div className="mt-1 bg-[#141414] border border-[#232323] p-1.5 rounded space-y-1">
                                  <div className="flex items-center justify-between text-[8px] font-bold text-[#f0a144] uppercase border-b border-[#222] pb-0.5">
                                    <span>⚙️ Configuración de Ranura</span>
                                    <span className="text-[#64748b] text-[6.5px]">sketchup plugin</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1.5">
                                    <div className="flex flex-col gap-0.5">
                                      <label className="text-[#888] font-bold text-[6.5px] uppercase">LADO</label>
                                      <select 
                                        value={config.lado}
                                        onChange={(e) => updatePiece(activePiece.id, { 
                                          ranuraConfig: { ...config, lado: e.target.value as any } 
                                        })}
                                        className="bg-[#1e1e1e] border border-[#33] rounded px-1 py-0.5 text-white text-[8px] outline-none cursor-pointer focus:border-[#f0a144]"
                                      >
                                        <option value="L1">L1 (Largo Frente)</option>
                                        <option value="L2">L2 (Largo Atrás)</option>
                                        <option value="A1">A1 (Ancho Der)</option>
                                        <option value="A2">A2 (Ancho Izq)</option>
                                      </select>
                                    </div>
                                    
                                    <div className="flex flex-col gap-0.5">
                                      <label className="text-[#888] font-bold text-[6.5px] uppercase">DIST (mm)</label>
                                      <input 
                                        type="number" 
                                        value={config.dist}
                                        onChange={(e) => updatePiece(activePiece.id, { 
                                          ranuraConfig: { ...config, dist: parseFloat(e.target.value) || 0 } 
                                        })}
                                        className="bg-[#1e1e1e] border border-[#33] rounded px-1 py-0.5 text-white text-[8px] outline-none font-mono focus:border-[#f0a144]"
                                      />
                                    </div>
                                    
                                    <div className="flex flex-col gap-0.5">
                                      <label className="text-[#888] font-bold text-[6.5px] uppercase">ESP (mm)</label>
                                      <input 
                                        type="number" 
                                        value={config.esp}
                                        onChange={(e) => updatePiece(activePiece.id, { 
                                          ranuraConfig: { ...config, esp: parseFloat(e.target.value) || 0 } 
                                        })}
                                        className="bg-[#1e1e1e] border border-[#33] rounded px-1 py-0.5 text-white text-[8px] outline-none font-mono focus:border-[#f0a144]"
                                      />
                                    </div>
                                    
                                    <div className="flex flex-col gap-0.5">
                                      <label className="text-[#888] font-bold text-[6.5px] uppercase">PROF (mm)</label>
                                      <input 
                                        type="number" 
                                        value={config.prof}
                                        onChange={(e) => updatePiece(activePiece.id, { 
                                          ranuraConfig: { ...config, prof: parseFloat(e.target.value) || 0 } 
                                        })}
                                        className="bg-[#1e1e1e] border border-[#33] rounded px-1 py-0.5 text-white text-[8px] outline-none font-mono focus:border-[#f0a144]"
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
                                    <span className="text-[7px] text-[#666666] font-black uppercase text-center">{edge === 'largo1' ? 'L1' : edge === 'largo2' ? 'L2' : edge === 'ancho1' ? 'A1' : 'A2'}</span>
                                    <select 
                                       value={val}
                                       onChange={(e) => updateEdge(activePiece.id, edge, e.target.value as any)}
                                       className="bg-transparent border-0 text-[8px] outline-none text-center appearance-none cursor-pointer text-[#cccccc] hover:text-white w-full"
                                    >
                                       <option value="Ninguno" className="bg-[#2e2e2e]">NO</option>
                                       <option value="Canto Delgado" className="bg-[#2e2e2e]">DEL ({edgeThicknessConfig.delgado}mm)</option>
                                       <option value="Canto Grueso" className="bg-[#2e2e2e]">GRU ({edgeThicknessConfig.grueso}mm)</option>
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
                                  <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-1 text-[8px] font-bold text-[#888888]">
                                    <span className="flex items-center gap-1 text-[#f0a144]">
                                      🎨 Color de Cantos Independiente
                                    </span>
                                    <span className="text-[#64748b] text-[6px] tracking-wider font-mono">CLIENTE</span>
                                  </div>

                                  <div className="flex items-center justify-between text-[8px] py-0.5">
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
                                        <span className="text-[7.5px] font-bold text-[#888] uppercase text-right">Material</span>
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
                                          className="col-span-2 bg-[#111111] border border-[#33] rounded px-1.5 py-0.5 text-white text-[9px] outline-none cursor-pointer focus:border-[#f0a144]"
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
                                        <span className="text-[7.5px] font-bold text-[#888] uppercase text-right">Color Canto</span>
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
                                            className="flex-1 bg-[#111111] border border-[#33] text-[9px] font-mono text-center text-white py-0.5 rounded outline-none w-0 min-w-0 focus:border-[#f0a144]"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* --- SECCIÓN: MULTIPLICAR Y DISTRIBUIR (REPISAS Y EN SERIE) --- */}
                            <div className="mt-4 pt-3 border-t border-[#2a2a2a]/80 space-y-2.5">
                              <div className="flex items-center justify-between border-b border-[#2a2a2a]/40 pb-1 text-[8px] font-bold text-[#888888]">
                                <span className="flex items-center gap-1 text-[#f0a144]">
                                  <Combine className="w-3.5 h-3.5 text-[#f0a144]" />
                                  <span>▼ MULTIPLICAR Y DISTRIBUIR</span>
                                </span>
                                <span className="text-[#64748b] text-[6.5px] tracking-wider font-mono bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-white/5">HERRAMIENTA 3D</span>
                              </div>

                              {/* Selector de Modo */}
                              <div className="flex bg-[#111111] rounded-lg p-0.5 border border-[#333333]">
                                <button
                                  type="button"
                                  onClick={() => setArrayMode('between')}
                                  className={`flex-1 py-1.5 rounded-md text-[8.5px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    arrayMode === 'between' 
                                      ? 'bg-[#444444] text-white shadow-sm' 
                                      : 'hover:bg-[#222] text-[#888]'
                                  }`}
                                >
                                  <Combine className="w-3 h-3 text-[#f0a144]" />
                                  Entre 2 Piezas
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setArrayMode('offset')}
                                  className={`flex-1 py-1.5 rounded-md text-[8.5px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    arrayMode === 'offset' 
                                      ? 'bg-[#444444] text-white shadow-sm' 
                                      : 'hover:bg-[#222] text-[#888]'
                                  }`}
                                >
                                  <Copy className="w-3 h-3 text-[#60a5fa]" />
                                  Repetición en Serie
                                </button>
                              </div>

                              {arrayMode === 'between' ? (
                                <div className="space-y-2 animate-in fade-in duration-100">
                                  {selectedPieceIds.length < 2 ? (
                                    <div className="text-[7.5px] leading-snug text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 space-y-1">
                                      <div className="font-bold flex items-center gap-1 text-amber-400">
                                        <span>⚠️ Selecciona 2 piezas límite</span>
                                      </div>
                                      <p className="text-gray-300">
                                        {selectedPieceIds.length === 1 ? (
                                          <span>Tienes 1 pieza seleccionada. Mantén pulsado <b>Shift</b> y haz clic en la segunda pieza en el visor 3D para definir los límites (ej. piso y techo).</span>
                                        ) : (
                                          <span>Haz clic en la primera pieza, mantén pulsado <b>Shift</b> y haz clic en la segunda pieza en el visor 3D para distribuir las repisas intermedias entre ellas.</span>
                                        )}
                                      </p>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="text-[7.5px] text-[#999] leading-snug italic bg-[#151515] p-1.5 rounded border border-[#222]">
                                        Calcula y distribuye repisas de manera 100% equidistante entre las dos piezas seleccionadas.
                                      </p>

                                      {/* Resumen de Luz Libre / Espacio calculado */}
                                      {(() => {
                                        const p1 = pieces.find(p => p.id === selectedPieceIds[0]);
                                        const p2 = pieces.find(p => p.id === selectedPieceIds[1]);
                                        if (!p1 || !p2) return null;
                                        const dy = Math.abs(p2.position3D[1] - p1.position3D[1]);
                                        const dx = Math.abs(p2.position3D[0] - p1.position3D[0]);
                                        const dz = Math.abs(p2.position3D[2] - p1.position3D[2]);
                                        const isVertical = dy >= dx && dy >= dz;
                                        const distCenter = isVertical ? dy : (dx >= dz ? dx : dz);
                                        const t1 = isVertical ? p1.espesor : (dx >= dz ? p1.largo : p1.ancho);
                                        const t2 = isVertical ? p2.espesor : (dx >= dz ? p2.largo : p2.ancho);
                                        const shelfThick = isVertical ? p1.espesor : (dx >= dz ? p1.largo : p1.ancho);
                                        const luzLibre = Math.max(0, Math.round(distCenter - (t1/2) - (t2/2)));
                                        const huecos = arrayCount + 1;
                                        const espacioPorHueco = Math.max(0, Math.round((luzLibre - (arrayCount * shelfThick)) / huecos));

                                        return (
                                          <div className="bg-[#141414] border border-white/10 rounded-lg p-2 text-[8px] space-y-1 font-mono">
                                            <div className="flex items-center justify-between text-gray-400 border-b border-white/5 pb-1 text-[7.5px]">
                                              <span className="truncate max-w-[90px] text-gray-300 font-sans font-bold">1: {p1.name || 'Pieza A'}</span>
                                              <span className="text-[#f0a144]">↔</span>
                                              <span className="truncate max-w-[90px] text-gray-300 font-sans font-bold">2: {p2.name || 'Pieza B'}</span>
                                            </div>
                                            <div className="flex items-center justify-between pt-0.5">
                                              <span className="text-gray-400">Luz libre interior:</span>
                                              <span className="text-[#f0a144] font-bold">{luzLibre} mm</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className="text-gray-400">Espacio útil ({huecos} huecos):</span>
                                              <span className="text-emerald-400 font-bold">~{espacioPorHueco} mm c/u</span>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      
                                      {/* Selector de Repisas */}
                                      <div className="bg-[#181818] p-2 rounded-lg border border-[#262626] space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[8px] font-bold text-gray-300 uppercase">Número de repisas</span>
                                          <div className="flex items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => setArrayCount(Math.max(1, arrayCount - 1))}
                                              className="w-5 h-5 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white text-[10px] font-bold flex items-center justify-center"
                                            >
                                              -
                                            </button>
                                            <input 
                                              type="number" 
                                              min="1"
                                              max="20"
                                              value={arrayCount}
                                              onChange={(e) => setArrayCount(Math.max(1, parseInt(e.target.value) || 1))}
                                              className="w-10 bg-[#111111] border border-[#444] rounded px-1 py-0.5 text-white text-[10px] outline-none text-center focus:border-[#f0a144] font-mono font-bold"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => setArrayCount(Math.min(20, arrayCount + 1))}
                                              className="w-5 h-5 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white text-[10px] font-bold flex items-center justify-center"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>

                                        {/* Presets rápidos */}
                                        <div className="flex items-center gap-1 pt-0.5">
                                          <span className="text-[7px] text-gray-500 uppercase">Rápido:</span>
                                          {[1, 2, 3, 4, 5].map(num => (
                                            <button
                                              key={num}
                                              type="button"
                                              onClick={() => setArrayCount(num)}
                                              className={`flex-1 py-0.5 rounded text-[7.5px] font-mono font-bold transition-all ${
                                                arrayCount === num 
                                                  ? 'bg-[#f0a144] text-black shadow-sm' 
                                                  : 'bg-[#222] hover:bg-[#333] text-gray-400'
                                              }`}
                                            >
                                              {num}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={executeDistribution}
                                        className="w-full py-2 rounded-lg bg-[#f0a144] hover:bg-[#e09134] text-black text-[9.5px] font-bold uppercase tracking-wider transition-all shadow-[0_2px_10px_rgba(240,161,68,0.25)] flex items-center justify-center gap-1.5 active:scale-[0.99]"
                                      >
                                        <Combine className="w-3.5 h-3.5 text-black" />
                                        Distribuir Repisas
                                      </button>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2.5 animate-in fade-in duration-100">
                                  <p className="text-[7.5px] text-[#999] leading-snug italic bg-[#151515] p-1.5 rounded border border-[#222]">
                                    Multiplica la pieza seleccionada en serie hacia cualquier dirección con distancia exacta en milímetros o unida al tope.
                                  </p>

                                  {/* Selector de Eje y Dirección */}
                                  <div className="bg-[#181818] p-2 rounded-lg border border-[#262626] space-y-2">
                                    <div className="grid grid-cols-3 items-center gap-1.5">
                                      <span className="text-[7.5px] font-bold text-[#888] uppercase">Eje</span>
                                      <select 
                                        value={arrayAxis}
                                        onChange={(e) => setArrayAxis(e.target.value as any)}
                                        className="col-span-2 bg-[#111111] border border-[#333] rounded px-2 py-1 text-white text-[8.5px] outline-none cursor-pointer focus:border-[#60a5fa] font-medium"
                                      >
                                        <option value="Y">Eje Y (Vertical / Altura)</option>
                                        <option value="X">Eje X (Lateral / Ancho)</option>
                                        <option value="Z">Eje Z (Profundidad / Fondo)</option>
                                      </select>
                                    </div>

                                    {/* Botones de Dirección (+ / -) */}
                                    <div className="grid grid-cols-3 items-center gap-1.5">
                                      <span className="text-[7.5px] font-bold text-[#888] uppercase">Sentido</span>
                                      <div className="col-span-2 flex gap-1">
                                        <button
                                          type="button"
                                          onClick={() => setArrayDirection(1)}
                                          className={`flex-1 py-1 px-1.5 rounded text-[7.5px] font-bold flex items-center justify-center gap-1 transition-all ${
                                            arrayDirection === 1 
                                              ? 'bg-[#3b82f6] text-white shadow-sm' 
                                              : 'bg-[#222] hover:bg-[#2e2e2e] text-gray-400'
                                          }`}
                                        >
                                          {arrayAxis === 'Y' && <ArrowUp className="w-2.5 h-2.5" />}
                                          {arrayAxis === 'X' && <ArrowRight className="w-2.5 h-2.5" />}
                                          {arrayAxis === 'Z' && <ArrowUp className="w-2.5 h-2.5 rotate-45" />}
                                          <span>{arrayAxis === 'Y' ? 'Arriba (+Y)' : arrayAxis === 'X' ? 'Derecha (+X)' : 'Frente (+Z)'}</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setArrayDirection(-1)}
                                          className={`flex-1 py-1 px-1.5 rounded text-[7.5px] font-bold flex items-center justify-center gap-1 transition-all ${
                                            arrayDirection === -1 
                                              ? 'bg-[#3b82f6] text-white shadow-sm' 
                                              : 'bg-[#222] hover:bg-[#2e2e2e] text-gray-400'
                                          }`}
                                        >
                                          {arrayAxis === 'Y' && <ArrowDown className="w-2.5 h-2.5" />}
                                          {arrayAxis === 'X' && <ArrowLeft className="w-2.5 h-2.5" />}
                                          {arrayAxis === 'Z' && <ArrowDown className="w-2.5 h-2.5 rotate-45" />}
                                          <span>{arrayAxis === 'Y' ? 'Abajo (-Y)' : arrayAxis === 'X' ? 'Izquierda (-X)' : 'Fondo (-Z)'}</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Modo de Espaciado (Milímetros vs A Tope vs Proporcional) */}
                                  <div className="bg-[#181818] p-2 rounded-lg border border-[#262626] space-y-2">
                                    <div className="flex bg-[#111] p-0.5 rounded border border-[#333]">
                                      <button
                                        type="button"
                                        onClick={() => setArraySpacingType('mm')}
                                        className={`flex-1 py-1 rounded text-[7.5px] font-bold transition-all ${
                                          arraySpacingType === 'mm' 
                                            ? 'bg-[#3b82f6] text-white' 
                                            : 'hover:bg-[#222] text-gray-400'
                                        }`}
                                      >
                                        Milímetros (mm)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setArraySpacingType('touching')}
                                        className={`flex-1 py-1 rounded text-[7.5px] font-bold transition-all ${
                                          arraySpacingType === 'touching' 
                                            ? 'bg-[#3b82f6] text-white' 
                                            : 'hover:bg-[#222] text-gray-400'
                                        }`}
                                      >
                                        A Tope (Pegadas)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setArraySpacingType('multiplier')}
                                        className={`flex-1 py-1 rounded text-[7.5px] font-bold transition-all ${
                                          arraySpacingType === 'multiplier' 
                                            ? 'bg-[#3b82f6] text-white' 
                                            : 'hover:bg-[#222] text-gray-400'
                                        }`}
                                      >
                                        Factor (x)
                                      </button>
                                    </div>

                                    {/* Si es por milímetros */}
                                    {arraySpacingType === 'mm' && (
                                      <div className="space-y-1.5 animate-in fade-in duration-100">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[7.5px] font-bold text-gray-300 uppercase">Paso / Separación</span>
                                          <div className="flex items-center gap-1">
                                            <input 
                                              type="number" 
                                              min="10" 
                                              max="2500" 
                                              step="5"
                                              value={arrayDistanceMm}
                                              onChange={(e) => setArrayDistanceMm(Math.max(1, parseInt(e.target.value) || 0))}
                                              className="w-16 bg-[#111111] border border-[#444] rounded px-1.5 py-0.5 text-white text-[9px] font-mono text-center focus:border-[#60a5fa] outline-none font-bold"
                                            />
                                            <span className="text-[7.5px] text-gray-400 font-mono">mm</span>
                                          </div>
                                        </div>

                                        {/* Presets de distancias comunes */}
                                        <div className="flex items-center gap-1">
                                          {[150, 200, 250, 300, 400].map(dist => (
                                            <button
                                              key={dist}
                                              type="button"
                                              onClick={() => setArrayDistanceMm(dist)}
                                              className={`flex-1 py-0.5 rounded text-[7px] font-mono transition-all ${
                                                arrayDistanceMm === dist 
                                                  ? 'bg-[#3b82f6] text-white font-bold' 
                                                  : 'bg-[#222] hover:bg-[#333] text-gray-400'
                                              }`}
                                            >
                                              {dist}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Si es A Tope */}
                                    {arraySpacingType === 'touching' && (
                                      <p className="text-[7.5px] text-emerald-400/90 leading-tight bg-emerald-500/10 p-1.5 rounded border border-emerald-500/20 italic">
                                        ✓ Las piezas se generarán pegadas cara a cara sin espacio intermedio (grosor exacto).
                                      </p>
                                    )}

                                    {/* Si es Factor multiplicador */}
                                    {arraySpacingType === 'multiplier' && (
                                      <div className="space-y-1 animate-in fade-in duration-100">
                                        <div className="flex items-center justify-between text-[7.5px] font-mono">
                                          <span className="text-gray-400">Factor de dimensión:</span>
                                          <span className="text-[#60a5fa] font-bold">{arrayOffset.toFixed(2)}x</span>
                                        </div>
                                        <input 
                                          type="range" 
                                          min="0.5" 
                                          max="4.0" 
                                          step="0.05"
                                          value={arrayOffset}
                                          onChange={(e) => setArrayOffset(parseFloat(e.target.value))}
                                          className="w-full h-1 bg-[#2e2e2e] rounded-lg cursor-pointer appearance-none accent-[#60a5fa]"
                                        />
                                      </div>
                                    )}
                                  </div>

                                  {/* Cantidad de Copias */}
                                  <div className="bg-[#181818] p-2 rounded-lg border border-[#262626] flex items-center justify-between">
                                    <span className="text-[8px] font-bold text-gray-300 uppercase">Cantidad de copias</span>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setArrayCount(Math.max(1, arrayCount - 1))}
                                        className="w-5 h-5 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white text-[10px] font-bold flex items-center justify-center"
                                      >
                                        -
                                      </button>
                                      <input 
                                        type="number" 
                                        min="1" 
                                        max="20" 
                                        value={arrayCount}
                                        onChange={(e) => setArrayCount(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-10 bg-[#111111] border border-[#444] rounded px-1 py-0.5 text-white text-[10px] outline-none text-center focus:border-[#60a5fa] font-mono font-bold"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setArrayCount(Math.min(20, arrayCount + 1))}
                                        className="w-5 h-5 rounded bg-[#2a2a2a] hover:bg-[#3a3a3a] text-white text-[10px] font-bold flex items-center justify-center"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={executeDistribution}
                                    className="w-full py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-[9.5px] font-bold uppercase tracking-wider transition-all shadow-[0_2px_10px_rgba(37,99,235,0.3)] flex items-center justify-center gap-1.5 active:scale-[0.99]"
                                  >
                                    <Copy className="w-3.5 h-3.5 text-white" />
                                    Multiplicar en Serie ({arrayCount} {arrayCount === 1 ? 'copia' : 'copias'})
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center text-[9px] text-[#666] py-3 italic">
                        Selecciona una pieza para ver procesos y cantos
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* TRAY 5: CONFIGURACIÓN DE CANTOS Y DESCUENTOS */}
              <div className="flex flex-col">
                <div 
                  onClick={() => toggleTray('cantosConfig')}
                  className="h-7 bg-[#262626] hover:bg-[#2d2d2d] flex items-center justify-between px-2 cursor-pointer select-none transition-colors border-t border-[#3c3c3c]/30 border-b border-[#151515]"
                >
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.cantosConfig ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <Sliders className="w-3 h-3 text-[#f0a144]" />
                    <span>Grosores de canto</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7.5px] font-mono text-[#ef4444] font-bold bg-[#ef4444]/15 px-1 py-0.2 rounded border border-[#ef4444]/30">
                      GRU {edgeThicknessConfig.grueso}mm
                    </span>
                  </div>
                </div>

                {trayOpen.cantosConfig && (
                  <div className="bg-[#1e1e1e] p-3 text-[10px] text-[#ccc] space-y-2.5 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between text-[8px] font-bold text-[#aaaaaa] uppercase tracking-wider border-b border-[#2d2d2d] pb-1">
                      <span>Parámetros de Taller</span>
                      <span className="text-[7px] text-[#f0a144] font-mono">DESPIECE AUTO</span>
                    </div>

                    {/* Canto Grueso Input */}
                    <div className="bg-[#151515] border border-red-950/70 p-2 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]"></span>
                          <span className="text-[8px] font-black text-white uppercase">Canto Grueso</span>
                        </div>
                        <span className="text-[7px] font-mono text-red-400 font-bold bg-red-950/80 px-1 rounded border border-red-800/50">
                          DESCUENTA EN CORTE
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <input 
                          type="number" 
                          step="0.5"
                          min="0"
                          max="10"
                          value={edgeThicknessConfig.grueso}
                          onChange={(e) => setEdgeThicknessConfig(prev => ({
                            ...prev,
                            grueso: Math.max(0, parseFloat(e.target.value) || 0)
                          }))}
                          className="flex-1 bg-[#1e1e1e] border border-red-900/60 rounded px-2 py-1 text-white font-mono font-bold text-[11px] focus:border-red-500 outline-none"
                        />
                        <span className="text-[9px] font-mono text-[#888888] font-bold">MM</span>
                      </div>
                      <p className="text-[7px] text-[#888888] font-sans leading-tight">
                        Cada lado con Canto Grueso descuenta {edgeThicknessConfig.grueso}mm en el plano de corte y se proyecta físicamente con {edgeThicknessConfig.grueso}mm en el modelo 3D.
                      </p>
                    </div>

                    {/* Canto Delgado Input */}
                    <div className="bg-[#151515] border border-blue-950/70 p-2 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.5)]"></span>
                          <span className="text-[8px] font-black text-white uppercase">Canto Delgado</span>
                        </div>
                        <span className="text-[7px] font-mono text-blue-400 font-bold bg-blue-950/80 px-1 rounded border border-blue-800/50">
                          TAPACANTO 0.45-0.5
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1">
                        <input 
                          type="number" 
                          step="0.05"
                          min="0"
                          max="5"
                          value={edgeThicknessConfig.delgado}
                          onChange={(e) => setEdgeThicknessConfig(prev => ({
                            ...prev,
                            delgado: Math.max(0, parseFloat(e.target.value) || 0)
                          }))}
                          className="flex-1 bg-[#1e1e1e] border border-blue-900/60 rounded px-2 py-1 text-white font-mono font-bold text-[11px] focus:border-blue-500 outline-none"
                        />
                        <span className="text-[9px] font-mono text-[#888888] font-bold">MM</span>
                      </div>
                      <p className="text-[7px] text-[#888888] font-sans leading-tight">
                        Cuando hay canto delgado en ambos extremos opuestos (0.45mm + 0.45mm = 0.9mm), la pieza aumenta 1mm y se descuenta 1mm automáticamente del corte.
                      </p>
                    </div>

                    {/* Quick Presets */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[7px] text-[#777777] font-bold uppercase tracking-wider block">PRESETS RÁPIDOS</span>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => setEdgeThicknessConfig(prev => ({ ...prev, grueso: 3, delgado: 0.45 }))}
                          className={`px-1.5 py-1 rounded text-[7.5px] font-mono font-bold border transition-all cursor-pointer ${edgeThicknessConfig.grueso === 3 ? 'bg-red-950/80 border-red-500 text-white' : 'bg-[#151515] border-[#333333] text-[#888888] hover:text-white'}`}
                        >
                          3 mm (Actual)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEdgeThicknessConfig(prev => ({ ...prev, grueso: 2, delgado: 0.45 }))}
                          className={`px-1.5 py-1 rounded text-[7.5px] font-mono font-bold border transition-all cursor-pointer ${edgeThicknessConfig.grueso === 2 ? 'bg-red-950/80 border-red-500 text-white' : 'bg-[#151515] border-[#333333] text-[#888888] hover:text-white'}`}
                        >
                          2 mm (PVC)
                        </button>
                        <button
                          type="button"
                          onClick={() => setEdgeThicknessConfig(prev => ({ ...prev, grueso: 1, delgado: 0.45 }))}
                          className={`px-1.5 py-1 rounded text-[7.5px] font-mono font-bold border transition-all cursor-pointer ${edgeThicknessConfig.grueso === 1 ? 'bg-red-950/80 border-red-500 text-white' : 'bg-[#151515] border-[#333333] text-[#888888] hover:text-white'}`}
                        >
                          1 mm (Fino)
                        </button>
                      </div>
                    </div>

                    {/* Toggle Descontar en Corte */}
                    <div className="flex items-center justify-between p-2 bg-[#161616] border border-[#2b2b2b] rounded-lg">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-white uppercase">Descontar en Despiece</span>
                        <span className="text-[6.5px] text-[#888888] font-sans">Aplica resta de {edgeThicknessConfig.grueso}mm en plano de corte</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={edgeThicknessConfig.descontarCorte}
                          onChange={(e) => setEdgeThicknessConfig(prev => ({
                            ...prev,
                            descontarCorte: e.target.checked
                          }))}
                          className="sr-only peer"
                        />
                        <div className="w-6 h-3.5 bg-[#2a2a2a] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-300 after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all peer-checked:bg-[#ef4444]"></div>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* TRAY 6: CATEGORÍAS Y COMPONENTES (ALMACÉN) */}
              <div className="flex flex-col">
                <div 
                  onClick={() => toggleTray('catalogo')}
                  className="h-7 bg-[#262626] hover:bg-[#2d2d2d] flex items-center justify-between px-2 cursor-pointer select-none transition-colors border-t border-[#3c3c3c]/30 border-b border-[#151515]"
                >
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#dddddd] uppercase tracking-wider">
                    {trayOpen.catalogo ? (
                      <ChevronDown className="w-3.5 h-3.5 text-[#f0a144]" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-[#888888]" />
                    )}
                    <Layers className="w-3 h-3 text-[#f0a144]" />
                    <span>Categorías y Almacén</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[7.5px] font-mono text-[#f0a144] font-bold bg-[#f0a144]/15 px-1 py-0.2 rounded border border-[#f0a144]/30">
                      CATÁLOGO
                    </span>
                  </div>
                </div>

                {trayOpen.catalogo && (
                  <div className="bg-[#1e1e1e] p-2 text-[10px] text-[#ccc] space-y-2 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between pb-1 border-b border-[#2d2d2d]">
                      <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Categorías</span>
                      <button
                        type="button"
                        onClick={() => setViewMode('warehouse')}
                        className="text-[8px] text-[#f0a144] font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>Abrir Almacén</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Interactive Horizontal Category Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
                      {DEFAULT_FURNITURE_CATEGORIES.map(cat => {
                        const isSel = traySelectedCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setTraySelectedCategory(cat)}
                            className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                              isSel 
                                ? 'bg-[#f0a144] text-black font-black shadow-xs' 
                                : 'bg-[#151515] text-gray-400 hover:text-white border border-[#2b2b2b]'
                            }`}
                          >
                            {cat}
                          </button>
                        );
                      })}
                    </div>

                    {/* Filtered Furniture Mini List */}
                    <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-0.5">
                      {DEFAULT_FURNITURE_CATALOG
                        .filter(item => traySelectedCategory === 'Todas' || item.category === traySelectedCategory)
                        .map(item => (
                          <div 
                            key={item.id} 
                            className="bg-[#151515] border border-[#2b2b2b] hover:border-[#f0a144]/50 rounded-lg p-2 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <div className="min-w-0">
                                <h4 className="text-[9.5px] font-bold text-white truncate">{item.name}</h4>
                                <span className="text-[7.5px] font-mono text-gray-400">
                                  {item.dimensions.width}x{item.dimensions.height}x{item.dimensions.depth} mm
                                </span>
                              </div>
                              <span className="text-[7px] bg-[#222] text-[#f0a144] px-1 py-0.2 rounded font-mono shrink-0">
                                {item.category}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 pt-1 border-t border-[#222]">
                              <button
                                type="button"
                                onClick={() => {
                                  handleLoadFurnitureFromWarehouse(item, 'insert');
                                  showToast(`"${item.name}" añadido al espacio 3D`);
                                }}
                                className="flex-1 py-1 bg-[#252836] hover:bg-[#32364a] text-[#f0a144] rounded text-[8px] font-bold transition-colors cursor-pointer text-center"
                              >
                                + Insertar 3D
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleLoadFurnitureFromWarehouse(item, 'replace');
                                  showToast(`"${item.name}" cargado en 3D`);
                                }}
                                className="px-2 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 hover:text-white rounded text-[8px] font-medium border border-[#333] transition-colors cursor-pointer"
                              >
                                Reemplazar
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Border and Corner Resize Handles */}
              <div 
                className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-[#f0a144]/30 z-20 transition-colors"
                {...trayResizeRightProps}
                title="Arrastrar borde para cambiar ancho"
              />
              <div 
                className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-[#f0a144]/30 z-20 transition-colors"
                {...trayResizeBottomProps}
                title="Arrastrar borde para cambiar alto"
              />
              <div 
                className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30 flex items-end justify-end p-0.5 text-gray-400 hover:text-[#f0a144] hover:bg-[#f0a144]/20 rounded-br-xl transition-all"
                {...trayResizeCornerProps}
                title="Reducir o ampliar tamaño de la bandeja"
              >
                <svg className="w-2.5 h-2.5 pointer-events-none" viewBox="0 0 6 6" fill="currentColor">
                  <circle cx="5" cy="5" r="0.75" />
                  <circle cx="5" cy="2.5" r="0.75" />
                  <circle cx="2.5" cy="5" r="0.75" />
                </svg>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-[2px]">
          <div className="bg-[#1e1e1e] border border-[#333] rounded-lg shadow-2xl max-w-[280px] w-full p-5 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4 text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-white font-bold text-sm mb-2 text-center text-balance">¿Confirmar Eliminación?</h3>
            <p className="text-[#999] text-[11px] mb-6 text-center text-balance leading-relaxed">
              {deleteConfirm.type === 'all' && 'Se eliminarán TODAS las piezas y grupos de la escena. Esta acción no se puede deshacer.'}
              {deleteConfirm.type === 'selected' && `Se eliminarán las ${selectedPieceIds.length} piezas seleccionadas. Esta acción no se puede deshacer.`}
              {deleteConfirm.type === 'group' && `Se eliminará el grupo "${deleteConfirm.name}" y sus piezas separadas.`}
              {deleteConfirm.type === 'piece' && `Se eliminará la pieza "${deleteConfirm.name}".`}
            </p>
            <div className="flex w-full gap-2">
              <button 
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-1.5 rounded border border-[#333] hover:bg-[#333] text-[#ccc] text-[10px] font-bold uppercase tracking-widest transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={executeDelete}
                className="flex-1 py-1.5 rounded bg-red-500/80 hover:bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest transition-colors"
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
                  <h3 className="text-white font-bold text-sm">Guía Didáctica: Materiales y Fabricación</h3>
                  <p className="text-[#888] text-[9px] uppercase tracking-wider font-mono">Física PBR en Carpintería Real</p>
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
            <div className="p-5 overflow-y-auto space-y-5 text-[11px] leading-relaxed text-gray-300">
              
              {/* Concept 1 */}
              <div className="space-y-1.5">
                <h4 className="font-bold text-white flex items-center gap-1.5 text-xs text-pink-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                  1. Roughness (Rugosidad) en Melaminas
                </h4>
                <p>
                  En motores gráficos modernos (como Cycles / EEVEE en Blender) y aserraderos industriales reales, la rugosidad física determina cómo se dispersa la luz al tocar el tablero:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div className="bg-[#141414] p-2 rounded border border-[#2b2b2b]">
                    <span className="text-pink-300 font-bold block text-[10px] uppercase">Brillo Alto / High Gloss (Roughness &lt; 0.15)</span>
                    Espejado y sumamente elegante. Usado en cocinas de lujo y frentes de armarios modernos. 
                    <span className="text-amber-500/90 text-[10px] font-bold block mt-1">⚠️ Desventaja:</span> Es propenso a rayaduras de lija y marcas de huellas cotidianas.
                  </div>
                  <div className="bg-[#141414] p-2 rounded border border-[#2b2b2b]">
                    <span className="text-emerald-400 font-bold block text-[10px] uppercase">Satinado Estándar (Roughness 0.35 - 0.50)</span>
                    La textura rugosa media es la reina de las melaminas. Imita la textura de la madera natural y los acabados lacados suaves.
                    <span className="text-emerald-500 text-[10px] font-bold block mt-1">✓ Ventaja:</span> Oculta rayones y manchas de grasa diaria de manera óptima.
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
                  Cuando cortas una placa de melamina estándar en una escuadradora o CNC, dejas expuesto el **Núcleo del Tablero** (hecho de aglomerado de virutas de pino o fibras de madera MDF prensada).
                </p>
                <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg text-amber-400 text-[10px] flex items-start gap-2.5">
                  <span className="text-base leading-none">⚠️</span>
                  <div>
                    <strong>Peligro de Humedad:</strong> Un borde descubierto ("Ninguno / Visto" en el visor propiedades) expone la madera interna. Si entra en contacto con agua (como trapear el piso, vapores de cocinas o baños), el aserrín absorberá la humedad, hinchándose e inutilizando el mueble de modo definitivo.
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 font-mono text-[9.5px]">
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
                <ul className="list-disc list-inside space-y-1 pl-1 text-[10px] leading-relaxed">
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
                className="bg-pink-600 hover:bg-pink-500 text-white font-bold text-[10px] py-1.5 px-4 rounded-lg uppercase tracking-wider select-none transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOUBLE CLICK / ENTITY INFO DIMENSION EDITOR MODAL */}
      {editingDimensionsPieceId && (() => {
        const p = pieces.find(x => x.id === editingDimensionsPieceId);
        if (!p) return null;

        const applyDimensionChanges = () => {
          const parsedLargo = parseFloat(tempLargo);
          const targetLargo = isNaN(parsedLargo) ? Math.round(p.largo) : Math.max(10, Math.round(parsedLargo));

          const parsedAncho = parseFloat(tempAncho);
          const targetAncho = isNaN(parsedAncho) ? Math.round(p.ancho) : Math.max(10, Math.round(parsedAncho));

          const parsedEspesor = parseFloat(tempEspesor);
          const targetEspesor = isNaN(parsedEspesor) ? Math.round(p.espesor) : Math.max(1, Math.round(parsedEspesor));

          updatePiece(editingDimensionsPieceId, {
            name: tempName.trim() || undefined,
            largo: targetLargo,
            ancho: targetAncho,
            espesor: targetEspesor,
          });

          setEditingDimensionsPieceId(null);
        };

        return (
          <div className="fixed top-12 left-14 z-30 pointer-events-none select-none">
            <div className="bg-[#181818]/95 backdrop-blur-md border border-[#333333] rounded-2xl w-[260px] shadow-[0_16px_50px_rgba(0,0,0,0.85)] p-3.5 space-y-2.5 font-sans text-gray-200 animate-in zoom-in-95 duration-150 pointer-events-auto">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-0.5 border-b border-[#282828]">
                <div className="flex items-center gap-1.5 text-[9.5px] font-black text-[#f0a144] uppercase tracking-wider">
                  <span className="w-2 h-2 rounded-full bg-[#f0a144]" />
                  <span>Ajuste Rápido 3D</span>
                </div>
                <button 
                  onClick={() => setEditingDimensionsPieceId(null)}
                  className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#252525] transition-colors cursor-pointer"
                  title="Cerrar panel flotante (puedes seguir editando en la Bandeja Predeterminada)"
                >
                  <span className="text-xs font-bold leading-none">✕</span>
                </button>
              </div>

              {/* Nombre del Objeto */}
              <div className="flex flex-col gap-1">
                <label className="text-[7.5px] font-black uppercase text-[#888888] tracking-wider">
                  Nombre del Objeto
                </label>
                <input 
                  type="text" 
                  value={tempName}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') applyDimensionChanges();
                  }}
                  className="bg-[#0e0e0e] border border-[#2e2e2e] focus:border-[#f0a144] text-white text-[11px] px-2.5 py-1.5 rounded-lg outline-none font-medium w-full select-text"
                  placeholder="Nombre de la pieza"
                />
              </div>

              {/* Dimensiones (Cortes) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[7.5px] font-black uppercase text-[#888888] tracking-wider">
                  Dimensiones (Cortes)
                </label>

                {/* Largo (X) */}
                <div className="bg-[#0e0e0e] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 flex items-center justify-between focus-within:border-red-500 transition-colors">
                  <div className="flex flex-col select-none">
                    <span className="text-[8.5px] font-bold text-gray-300 uppercase tracking-tight">Largo</span>
                    <span className="text-[7px] text-gray-500 font-mono leading-none">(X)</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tempLargo}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTempLargo(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') applyDimensionChanges();
                      }}
                      className="bg-transparent text-[13px] font-mono font-black text-white text-right outline-none w-16 select-text cursor-text"
                    />
                    <span className="text-[7.5px] text-gray-400 font-mono select-none">mm</span>
                  </div>
                </div>

                {/* Espesor (Y) */}
                <div className="bg-[#0e0e0e] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 flex items-center justify-between focus-within:border-green-500 transition-colors">
                  <div className="flex flex-col select-none">
                    <span className="text-[8.5px] font-bold text-gray-300 uppercase tracking-tight">Espesor</span>
                    <span className="text-[7px] text-gray-500 font-mono leading-none">(Y)</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tempEspesor}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTempEspesor(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') applyDimensionChanges();
                      }}
                      className="bg-transparent text-[13px] font-mono font-black text-white text-right outline-none w-16 select-text cursor-text"
                    />
                    <span className="text-[7.5px] text-gray-400 font-mono select-none">mm</span>
                  </div>
                </div>

                {/* Ancho (Z) */}
                <div className="bg-[#0e0e0e] border border-[#2e2e2e] rounded-lg px-2.5 py-1.5 flex items-center justify-between focus-within:border-blue-500 transition-colors">
                  <div className="flex flex-col select-none">
                    <span className="text-[8.5px] font-bold text-gray-300 uppercase tracking-tight">Ancho</span>
                    <span className="text-[7px] text-gray-500 font-mono leading-none">(Z)</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <input 
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={tempAncho}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setTempAncho(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') applyDimensionChanges();
                      }}
                      className="bg-transparent text-[13px] font-mono font-black text-white text-right outline-none w-16 select-text cursor-text"
                    />
                    <span className="text-[7.5px] text-gray-400 font-mono select-none">mm</span>
                  </div>
                </div>
              </div>

              {/* Footer: Material & Cantos */}
              <div className="border-t border-[#252525] pt-1.5 flex items-center justify-between text-[7.5px] text-gray-400">
                <span className="truncate max-w-[110px]">🎨 {p.material || 'Blanco'}</span>
                <div className="flex gap-2 font-mono text-[7px] text-gray-300">
                  <span>L1: {p.cantos.largo1 === 'Ninguno' ? '--' : p.cantos.largo1.slice(0, 3).toUpperCase()}</span>
                  <span>A1: {p.cantos.ancho1 === 'Ninguno' ? '--' : p.cantos.ancho1.slice(0, 3).toUpperCase()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex justify-end gap-2 border-t border-[#252525]">
                <button 
                  type="button"
                  onClick={() => setEditingDimensionsPieceId(null)}
                  className="bg-[#2a2a2a] hover:bg-[#383838] text-[#aaaaaa] font-bold text-[9px] py-1.5 px-3 rounded-lg uppercase tracking-wider select-none transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={applyDimensionChanges}
                  className="bg-[#f0a144] hover:bg-[#f2b05e] text-black font-black text-[9.5px] py-1.5 px-4 rounded-lg uppercase tracking-wider select-none transition-all shadow-md cursor-pointer"
                >
                  Guardar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MATERIAL BROWSER & EDITOR (Poly Haven Style) */}
      {isTextureModalOpen && (() => {
        const activeTargetId = selectedPieceIds[0] || textureEditingPieceId;
        const p = pieces.find(x => x.id === activeTargetId) || pieces.find(x => x.id === textureEditingPieceId) || pieces[0] || null;
        const selectedPieces = pieces.filter(x => selectedPieceIds.includes(x.id));
        return (
          <MaterialBrowserModal
            isOpen={isTextureModalOpen}
            isTrayOpen={isTrayOpen}
            piece={p}
            selectedPieces={selectedPieces.length > 0 ? selectedPieces : (p ? [p] : [])}
            allPieces={pieces}
            onSelectPiece={(id) => {
              setSelectedPieceIds(id ? [id] : []);
              setTextureEditingPieceId(id);
            }}
            onClose={() => {
              setIsTextureModalOpen(false);
              if (transformMode === 'texture') {
                setTransformMode('translate');
              }
            }}
            onUpdatePiece={(id, updates) => updatePiece(id, updates)}
            onUpdateAllPieces={(updates) => {
              setPieces(prev => prev.map(pc => {
                const next = { ...pc, ...updates };
                if (updates.faceTextures === undefined && 'faceTextures' in updates) {
                  delete next.faceTextures;
                }
                if (updates.faceTextureConfigs === undefined && 'faceTextureConfigs' in updates) {
                  delete next.faceTextureConfigs;
                }
                if (updates.cantoColor === undefined && 'cantoColor' in updates) {
                  delete next.cantoColor;
                }
                return next;
              }));
            }}
          />
        );
      })()}

      {/* MOVABLE FLOATING SMART STRETCH TOOLBAR (Barra única de estirado inteligente movible en pantalla) */}
      {selectedPieceIds.length > 0 && transformMode === 'stretch' && (() => {
        const selPieces = pieces.filter(p => selectedPieceIds.includes(p.id) && !p.hidden);
        if (selPieces.length === 0) return null;
        const currentBounds = computePiecesBoundingBoxMm(selPieces);
        const axisIdx = fredoAxis === 'X' ? 0 : fredoAxis === 'Y' ? 1 : 2;
        const currentDim = currentBounds.size.getComponent(axisIdx) + (fredoPreviewDelta || 0);

        return (
          <SmartStretchToolbar
            axis={fredoAxis}
            onChangeAxis={setFredoAxis}
            mode={fredoMode}
            onChangeMode={setFredoMode}
            currentDimMm={currentDim}
            onApplyDimension={(dim, isAbsolute) => handleApplyFredoNumericStretch(dim, isAbsolute)}
            onQuickStep={(step) => handleQuickFredoStep(step)}
            onClose={() => setTransformMode('translate')}
          />
        );
      })()}

      {/* Floating non-blocking Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1e1e] border border-[#f0a144]/40 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-[#f0a144] animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

// Blender Components
function ToolbarIcon({ icon, active, onClick, title }: { icon: any, active?: boolean, onClick?: () => void, title?: string }) {
  return (
    <button 
      type="button"
      onClick={onClick}
      title={title}
      className={`p-2 rounded transition-colors ${active ? 'bg-amber-600 text-white shadow' : 'text-[#888888] hover:bg-[#4d4d4d] hover:text-[#cccccc]'}`}
    >
      {React.cloneElement(icon, { className: 'w-4 h-4' })}
    </button>
  );
}

function EntityCantoFieldTray({ 
  label, 
  sub, 
  value, 
  gruesoMm = 3, 
  delgadoMm = 0.45, 
  onCycle 
}: { 
  label: string; 
  sub: string; 
  value: EdgeConfig['largo1']; 
  gruesoMm?: number; 
  delgadoMm?: number; 
  onCycle: (reverse?: boolean) => void; 
}) {
  const isDelgado = value === 'Canto Delgado';
  const isGrueso = value === 'Canto Grueso';

  const badgeText = isDelgado ? `DEL ${delgadoMm}` : isGrueso ? `GRU ${gruesoMm}mm` : 'NO';

  const borderClass = isDelgado 
    ? 'border-[#3b82f6]/70 border-b-2 border-b-[#3b82f6] shadow-[0_1px_4px_rgba(59,130,246,0.15)] bg-[#101926]' 
    : isGrueso 
    ? 'border-[#ef4444]/70 border-b-2 border-b-[#ef4444] shadow-[0_1px_4px_rgba(239,68,68,0.15)] bg-[#241212]' 
    : 'border-[#2d2d2d] hover:border-[#444444] bg-[#141414]';

  const badgeColor = isDelgado 
    ? 'text-[#60a5fa] bg-blue-500/20 border-blue-500/40' 
    : isGrueso 
    ? 'text-[#f87171] bg-red-500/20 border-red-500/40' 
    : 'text-[#666666] bg-[#1a1a1a] border-[#2c2c2c]';

  return (
    <button
      type="button"
      onClick={() => onCycle(false)}
      onContextMenu={(e) => {
        e.preventDefault();
        onCycle(true);
      }}
      title={`${label} (${sub}): Clic para alternar (NO → DEL ${delgadoMm}mm → GRU ${gruesoMm}mm con descuento de corte)`}
      className={`border rounded px-2 py-1.5 flex items-center justify-between transition-all cursor-pointer select-none text-left w-full active:scale-[0.98] ${borderClass}`}
    >
      <div className="flex flex-col min-w-0 pr-1">
        <span className="text-[8px] font-bold text-[#dddddd] uppercase truncate">{label}</span>
        <span className="text-[6.5px] text-[#777777] font-mono leading-none truncate">{sub}</span>
      </div>
      <span className={`text-[7px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${badgeColor}`}>
        {badgeText}
      </span>
    </button>
  );
}

function PropertyField({ label, value, onChange, axis }: { label: string, value: number, onChange: (v: number) => void, axis: 'x' | 'y' | 'z' }) {
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startValue = useRef(0);
  const axisColor = axis === 'x' ? 'bg-[#da3c3c]' : axis === 'y' ? 'bg-[#3cda3c]' : 'bg-[#3c3cda]';
  const min = axis === 'y' ? 1 : 10;
  const [text, setText] = useState<string>(String(Math.round(value) || 0));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setText(String(Math.round(value) || 0));
    }
  }, [value, isFocused]);

  const commitValue = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === '') {
      setText(String(Math.round(value) || min));
      return;
    }
    const parsed = parseFloat(trimmed);
    if (isNaN(parsed)) {
      setText(String(Math.round(value) || min));
      return;
    }
    const clamped = Math.max(min, Math.round(parsed));
    setText(String(clamped));
    if (clamped !== Math.round(value)) {
      onChange(clamped);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startX.current = e.clientX;
    startValue.current = value;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - startX.current;
    const newValue = Math.max(min, Math.round(startValue.current + delta));
    setText(String(newValue));
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
      <span className="text-[8px] text-[#666666] font-black w-20 px-2 uppercase truncate pointer-events-none">{label}</span>
      <input 
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text}
        onFocus={(e) => {
          setIsFocused(true);
          e.target.select();
        }}
        onBlur={(e) => {
          setIsFocused(false);
          commitValue(e.target.value);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            commitValue(text);
            (e.target as HTMLElement).blur();
          } else if (e.key === 'Escape') {
            setText(String(Math.round(value) || min));
            (e.target as HTMLElement).blur();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const cur = parseFloat(text) || value;
            const delta = e.shiftKey ? 10 : 1;
            const nextVal = Math.max(min, Math.round(cur + delta));
            setText(String(nextVal));
            onChange(nextVal);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            const cur = parseFloat(text) || value;
            const delta = e.shiftKey ? 10 : 1;
            const nextVal = Math.max(min, Math.round(cur - delta));
            setText(String(nextVal));
            onChange(nextVal);
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-1 bg-transparent text-[10px] text-[#cccccc] font-mono px-2 py-1 outline-none text-right cursor-text select-text"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
