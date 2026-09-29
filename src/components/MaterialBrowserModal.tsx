import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Upload, Trash2, Check, RotateCw, RotateCcw,
  Sliders, ChevronUp, Plus, Eye, Image as ImageIcon,
  Palette, SlidersHorizontal, GripHorizontal, Pipette
} from 'lucide-react';
import { Piece, PieceFaceKey, FaceTextureOptions, CustomTextureItem } from '../types';
import { 
  FURNITURE_MATERIALS, 
  MaterialDefinition, 
  getMaterialDefinition 
} from '../lib/materials';
import { 
  getStoredCustomTextures, 
  saveCustomTexture, 
  deleteCustomTexture,
  getPelikanoTextureUrl,
  generateWoodGrainCanvas
} from '../lib/textureManager';
import MaterialSphere from './MaterialSphere';
import { useDraggableWindow } from '../hooks/useDraggableWindow';

// High-visibility, ultra-fluid hardware-accelerated SVG cursor for Gotero (tip at 2, 18)
const GOTERO_CURSOR_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">
  <path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12" stroke="#000000" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="#14151a"/>
  <path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z" stroke="#000000" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" fill="#14151a"/>
  <path d="m2 22 .414-.414" stroke="#000000" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m12 9-8.414 8.414A2 2 0 0 0 3 18.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 3.828 21h1.344a2 2 0 0 0 1.414-.586L15 12" stroke="#f0a144" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m18 9 .4.4a1 1 0 1 1-3 3l-3.8-3.8a1 1 0 1 1 3-3l.4.4 3.4-3.4a1 1 0 1 1 3 3z" stroke="#f0a144" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="m2 22 .414-.414" stroke="#f0a144" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`);

const GOTERO_CURSOR_URL = `data:image/svg+xml;utf8,${GOTERO_CURSOR_SVG}`;

interface MaterialBrowserModalProps {
  isOpen: boolean;
  isTrayOpen?: boolean;
  onClose: () => void;
  piece?: Piece | null;
  selectedPieces?: Piece[];
  allPieces?: Piece[];
  onSelectPiece?: (id: string | null) => void;
  onUpdatePiece: (id: string, updates: Partial<Piece>) => void;
  onUpdateAllPieces?: (updates: Partial<Piece>) => void;
}

type CategoryTab = 'madera' | 'melamina' | 'metal' | 'vidrio' | 'color_picker' | 'custom';

export default function MaterialBrowserModal({
  isOpen,
  onClose,
  piece,
  selectedPieces = [],
  allPieces = [],
  onSelectPiece,
  onUpdatePiece,
  onUpdateAllPieces
}: MaterialBrowserModalProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('madera');
  const [applyScope, setApplyScope] = useState<'piece' | 'all'>('piece');
  const [showAdjustDrawer, setShowAdjustDrawer] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [customTextures, setCustomTextures] = useState<CustomTextureItem[]>([]);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [isDropperActive, setIsDropperActive] = useState<boolean>(false);
  const [highlightedMaterialId, setHighlightedMaterialId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMulti = selectedPieces.length > 1;
  const targetPiece = piece || selectedPieces[0];

  const { 
    position, 
    size, 
    dragProps, 
    resizeCornerProps, 
    resizeRightProps, 
    resizeBottomProps 
  } = useDraggableWindow({
    storageKey: 'iamueble_catalog_win_pos',
    defaultPosition: () => ({
      x: typeof window !== 'undefined' ? (window.innerWidth < 640 ? 10 : 50) : 20,
      y: typeof window !== 'undefined' ? Math.max(45, window.innerHeight - (window.innerWidth < 640 ? 250 : 380)) : 300
    }),
    defaultSize: () => ({
      width: typeof window !== 'undefined' && window.innerWidth < 640 ? 260 : 320,
      height: typeof window !== 'undefined' && window.innerWidth < 640 ? 210 : 350
    }),
    minWidth: 190,
    minHeight: 140
  });

  useEffect(() => {
    if (isOpen) {
      setCustomTextures(getStoredCustomTextures());
      setIsMinimized(false);
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(prev => (prev === msg ? null : prev));
    }, 1800);
  };

  const currentMatDef = useMemo(() => {
    if (!targetPiece) return FURNITURE_MATERIALS['Blanco'];
    return getMaterialDefinition(targetPiece.material);
  }, [targetPiece?.material]);

  const currentColor = targetPiece?.customColor || currentMatDef.color;
  const currentRoughness = targetPiece?.customRoughness !== undefined 
    ? targetPiece.customRoughness 
    : currentMatDef.roughness;
  const currentMetalness = targetPiece?.customMetalness !== undefined 
    ? targetPiece.customMetalness 
    : currentMatDef.metalness;

  const sampleTextureUrl = targetPiece?.faceTextures 
    ? (targetPiece.faceTextures.top || Object.values(targetPiece.faceTextures).find(Boolean) || null)
    : (currentMatDef.hasGrain ? getPelikanoTextureUrl(targetPiece?.material || '') : null);

  const hasTexture = Boolean(
    (targetPiece?.faceTextures && Object.values(targetPiece.faceTextures).some(Boolean)) ||
    currentMatDef.hasGrain ||
    sampleTextureUrl ||
    targetPiece?.veta ||
    targetPiece?.material === 'Custom' ||
    (targetPiece?.material && FURNITURE_MATERIALS[targetPiece.material]?.hasGrain)
  );

  const currentUVScale = targetPiece?.faceTextureConfigs?.top?.repeatX !== undefined 
    ? targetPiece.faceTextureConfigs.top.repeatX 
    : 1;

  // Group materials by active category
  const categoryMaterials = useMemo(() => {
    const all = Object.values(FURNITURE_MATERIALS);
    if (activeCategory === 'madera') {
      return all.filter(m => m.category === 'madera');
    }
    if (activeCategory === 'metal') {
      return all.filter(m => m.category === 'metal');
    }
    if (activeCategory === 'melamina') {
      return all.filter(m => m.category === 'melamina');
    }
    if (activeCategory === 'vidrio') {
      return all.filter(m => m.category === 'vidrio');
    }
    return [];
  }, [activeCategory]);

  const applyMaterialToTarget = (mat: MaterialDefinition) => {
    if (!targetPiece) return;

    const isWood = mat.category === 'madera' || !!mat.hasGrain;
    const woodGrainUrl = isWood 
      ? (getPelikanoTextureUrl(mat.id) || generateWoodGrainCanvas(mat.color, mat.coreColor || '#333333', 20))
      : null;

    let updates: Partial<Piece>;

    if (woodGrainUrl) {
      const allFaces: Record<PieceFaceKey, string> = {
        top: woodGrainUrl,
        bottom: woodGrainUrl,
        front: woodGrainUrl,
        back: woodGrainUrl,
        left: woodGrainUrl,
        right: woodGrainUrl
      };
      const configs: Record<PieceFaceKey, FaceTextureOptions> = {
        top: { repeatX: 1, repeatY: 1, rotation: 0 },
        bottom: { repeatX: 1, repeatY: 1, rotation: 0 },
        front: { repeatX: 1, repeatY: 1, rotation: 0 },
        back: { repeatX: 1, repeatY: 1, rotation: 0 },
        left: { repeatX: 1, repeatY: 1, rotation: 0 },
        right: { repeatX: 1, repeatY: 1, rotation: 0 }
      };

      updates = {
        material: mat.id,
        customColor: mat.color,
        customRoughness: mat.roughness,
        customMetalness: mat.metalness,
        customOpacity: 1.0,
        isGlass: false,
        isMirror: false,
        faceTextures: allFaces,
        faceTextureConfigs: configs,
        veta: true,
        vetaRotation: 0,
        vetaOrientacion: 'longitudinal'
      };
    } else {
      updates = {
        material: mat.id,
        customColor: mat.color,
        customRoughness: mat.roughness,
        customMetalness: mat.metalness,
        customOpacity: mat.opacity ?? 1.0,
        isGlass: mat.isGlass || false,
        isMirror: mat.isMirror || false,
        faceTextures: undefined,
        faceTextureConfigs: undefined,
        veta: false,
        vetaRotation: 0,
        vetaOrientacion: 'longitudinal'
      };
    }

    if (applyScope === 'all' && onUpdateAllPieces) {
      onUpdateAllPieces(updates);
      showToast(`${mat.name} · Todo el mueble`);
    } else if (isMulti) {
      selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
      showToast(`${mat.name} (${selectedPieces.length} piezas)`);
    } else {
      onUpdatePiece(targetPiece.id, updates);
      showToast(`${mat.name}`);
    }
  };

  const applyCustomTextureToPieces = (textureUrl: string, name?: string) => {
    if (!targetPiece) return;

    const allFaces: Record<PieceFaceKey, string> = {
      top: textureUrl,
      bottom: textureUrl,
      front: textureUrl,
      back: textureUrl,
      left: textureUrl,
      right: textureUrl
    };

    const configs: Record<PieceFaceKey, FaceTextureOptions> = {
      top: { repeatX: 1, repeatY: 1, rotation: 0 },
      bottom: { repeatX: 1, repeatY: 1, rotation: 0 },
      front: { repeatX: 1, repeatY: 1, rotation: 0 },
      back: { repeatX: 1, repeatY: 1, rotation: 0 },
      left: { repeatX: 1, repeatY: 1, rotation: 0 },
      right: { repeatX: 1, repeatY: 1, rotation: 0 }
    };

    const updates: Partial<Piece> = {
      material: name || 'Custom',
      customColor: '#ffffff',
      customRoughness: 0.45,
      customMetalness: 0.0,
      customOpacity: 1.0,
      isGlass: false,
      isMirror: false,
      faceTextures: allFaces,
      faceTextureConfigs: configs,
      veta: true,
      vetaRotation: 0,
      vetaOrientacion: 'longitudinal'
    };

    if (applyScope === 'all' && onUpdateAllPieces) {
      onUpdateAllPieces(updates);
      showToast(`Textura · Todo el mueble`);
    } else if (isMulti) {
      selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
      showToast(`Textura aplicada (${selectedPieces.length})`);
    } else {
      onUpdatePiece(targetPiece.id, updates);
      showToast('Textura aplicada');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Formato no válido (usa JPG, PNG)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const saved = saveCustomTexture(cleanName, dataUrl);
        setCustomTextures(getStoredCustomTextures());
        setActiveCategory('custom');
        applyCustomTextureToPieces(dataUrl, saved.name);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const rotateTexture90 = () => {
    if (!targetPiece) return;
    const currentRot = targetPiece.vetaRotation ?? 0;
    const nextRot = (currentRot + 90) % 360;
    const updatedConfigs = { ...(targetPiece.faceTextureConfigs || {}) };
    const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
    allFaces.forEach(f => {
      updatedConfigs[f] = {
        repeatX: updatedConfigs[f]?.repeatX || 1,
        repeatY: updatedConfigs[f]?.repeatY || 1,
        rotation: nextRot
      };
    });

    const updates: Partial<Piece> = {
      vetaRotation: nextRot,
      vetaOrientacion: (nextRot === 90 || nextRot === 270) ? 'transversal' : 'longitudinal',
      faceTextureConfigs: updatedConfigs
    };

    if (applyScope === 'all' && onUpdateAllPieces) {
      onUpdateAllPieces(updates);
      showToast(`Veta rotada ${nextRot}° (Todo)`);
    } else if (isMulti) {
      selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
      showToast(`Veta rotada ${nextRot}°`);
    } else {
      onUpdatePiece(targetPiece.id, updates);
      showToast(`Veta rotada ${nextRot}°`);
    }
  };

  const setTextureTiling = (rep: number) => {
    if (!targetPiece) return;
    const updatedConfigs = { ...(targetPiece.faceTextureConfigs || {}) };
    const allFaces: PieceFaceKey[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];
    allFaces.forEach(f => {
      updatedConfigs[f] = {
        repeatX: rep,
        repeatY: rep,
        rotation: updatedConfigs[f]?.rotation || 0
      };
    });
    const updates: Partial<Piece> = { faceTextureConfigs: updatedConfigs };
    if (applyScope === 'all' && onUpdateAllPieces) {
      onUpdateAllPieces(updates);
    } else if (isMulti) {
      selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
    } else {
      onUpdatePiece(targetPiece.id, updates);
    }
    showToast(`Escala UV ${rep}x`);
  };

  const resetUV = () => {
    if (!targetPiece) return;
    const defaultConfigs: Record<PieceFaceKey, FaceTextureOptions> = {
      top: { repeatX: 1, repeatY: 1, rotation: 0 },
      bottom: { repeatX: 1, repeatY: 1, rotation: 0 },
      front: { repeatX: 1, repeatY: 1, rotation: 0 },
      back: { repeatX: 1, repeatY: 1, rotation: 0 },
      left: { repeatX: 1, repeatY: 1, rotation: 0 },
      right: { repeatX: 1, repeatY: 1, rotation: 0 }
    };

    const updates: Partial<Piece> = {
      vetaRotation: 0,
      vetaOrientacion: 'longitudinal',
      faceTextureConfigs: defaultConfigs
    };

    if (applyScope === 'all' && onUpdateAllPieces) {
      onUpdateAllPieces(updates);
      showToast('UV restablecido (1x · 0°) · Todo');
    } else if (isMulti) {
      selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
      showToast('UV restablecido (1x · 0°)');
    } else {
      onUpdatePiece(targetPiece.id, updates);
      showToast('UV restablecido (1x · 0°)');
    }
  };

  const removeTexture = () => {
    if (!targetPiece) return;
    const defaultWhiteMat = FURNITURE_MATERIALS['Blanco'];
    const updates: Partial<Piece> = {
      material: 'Blanco',
      customColor: defaultWhiteMat.color,
      customRoughness: defaultWhiteMat.roughness,
      customMetalness: defaultWhiteMat.metalness,
      customOpacity: 1.0,
      isGlass: false,
      isMirror: false,
      cantoColor: undefined,
      faceTextures: undefined,
      faceTextureConfigs: undefined,
      veta: false,
      vetaRotation: 0,
      vetaOrientacion: 'longitudinal'
    };
    if (applyScope === 'all' && onUpdateAllPieces) {
      onUpdateAllPieces(updates);
      showToast('UV limpiado · Blanco mate por defecto (Todo)');
    } else if (isMulti) {
      selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
      showToast(`UV limpiado · Blanco mate por defecto (${selectedPieces.length})`);
    } else {
      onUpdatePiece(targetPiece.id, updates);
      showToast('UV limpiado · Blanco mate por defecto');
    }
  };

  const applyCustomColor = (hex: string) => {
    if (!targetPiece) return;
    const updates: Partial<Piece> = {
      customColor: hex,
      material: 'Color Libre'
    };
    if (applyScope === 'all' && onUpdateAllPieces) {
      onUpdateAllPieces(updates);
    } else if (isMulti) {
      selectedPieces.forEach(p => onUpdatePiece(p.id, updates));
    } else {
      onUpdatePiece(targetPiece.id, updates);
    }
  };

  const curatedColors = [
    { name: 'Blanco Mate', color: '#ecebe6' },
    { name: 'Perla', color: '#e5e7eb' },
    { name: 'Gris Ceniza', color: '#9ca3af' },
    { name: 'Grafito', color: '#374151' },
    { name: 'Negro', color: '#171717' },
    { name: 'Arena', color: '#d8c7b5' },
    { name: 'Terracota', color: '#c26548' },
    { name: 'Verde Salvia', color: '#5f7a61' },
    { name: 'Azul Marino', color: '#1e3a8a' },
    { name: 'Roble', color: '#bfa07a' },
    { name: 'Nogal', color: '#523a28' },
    { name: 'Mostaza', color: '#d97706' }
  ];

  // Helper: parse hex color into RGB components
  const parseHex = (hex: string): { r: number; g: number; b: number } => {
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    const intVal = parseInt(clean, 16);
    if (isNaN(intVal)) return { r: 240, g: 240, b: 240 };
    return {
      r: (intVal >> 16) & 255,
      g: (intVal >> 8) & 255,
      b: intVal & 255
    };
  };

  // Euclidean color distance with human eye weighting
  const colorDistance = (c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number => {
    const rmean = (c1.r + c2.r) / 2;
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt((((512 + rmean) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rmean) * db * db) >> 8));
  };

  // Locate material in catalog from sampled color and highlight it
  const locateMaterialFromColor = (hex: string) => {
    const rgb = parseHex(hex);

    // 1. Search in FURNITURE_MATERIALS for exact or closest match
    let bestMatch: MaterialDefinition | null = null;
    let bestDist = Infinity;

    Object.values(FURNITURE_MATERIALS).forEach((mat) => {
      const matRgb = parseHex(mat.color);
      const dist = colorDistance(rgb, matRgb);
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = mat;
      }
    });

    // 2. If close match to standard material (or best match overall)
    if (bestMatch && bestDist < 55) {
      const mat: MaterialDefinition = bestMatch;
      setActiveCategory(mat.category);
      setHighlightedMaterialId(mat.id);
      applyMaterialToTarget(mat);

      setTimeout(() => {
        const el = document.getElementById(`mat-swatch-${mat.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 120);

      const catName = mat.category === 'madera' ? 'Maderas' : mat.category === 'melamina' ? 'Melaminas' : mat.category === 'vidrio' ? 'Vidrios' : 'Metales';
      showToast(`🎯 Gotero: Ubicado en ${catName} · ${mat.name}`);

      setTimeout(() => {
        setHighlightedMaterialId(prev => (prev === mat.id ? null : prev));
      }, 4500);
      return;
    }

    // 3. Check curated colors in color_picker
    const curatedMatch = curatedColors.find(c => colorDistance(rgb, parseHex(c.color)) < 30);
    if (curatedMatch) {
      setActiveCategory('color_picker');
      setHighlightedMaterialId(`color-swatch-${curatedMatch.name}`);
      applyCustomColor(curatedMatch.color);
      showToast(`🎯 Gotero: Ubicado ${curatedMatch.name} en pestaña Color`);
      setTimeout(() => {
        setHighlightedMaterialId(null);
      }, 4500);
      return;
    }

    // 4. Custom color
    setActiveCategory('color_picker');
    setHighlightedMaterialId('custom-color-preview');
    applyCustomColor(hex);
    showToast(`🎯 Gotero: Color detectado (${hex.toUpperCase()}) en pestaña Color`);
    setTimeout(() => {
      setHighlightedMaterialId(null);
    }, 4500);
  };

  // Locate material directly from a 3D piece
  const locatePieceMaterial = (p: Piece) => {
    if (p.customColor) {
      locateMaterialFromColor(p.customColor);
      return;
    }

    if (p.faceTextures && Object.values(p.faceTextures).some(Boolean)) {
      setActiveCategory('custom');
      showToast('🎯 Gotero: Textura personalizada en Fotos');
      return;
    }

    const matKey = p.material || 'Blanco';
    const def = getMaterialDefinition(matKey);
    if (def) {
      setActiveCategory(def.category);
      setHighlightedMaterialId(def.id);

      setTimeout(() => {
        const el = document.getElementById(`mat-swatch-${def.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

      const catName = def.category === 'madera' ? 'Maderas' : def.category === 'melamina' ? 'Melaminas' : def.category === 'vidrio' ? 'Vidrios' : 'Metales';
      showToast(`🎯 Gotero: Ubicado en ${catName} · ${def.name}`);

      setTimeout(() => {
        setHighlightedMaterialId(prev => (prev === def.id ? null : prev));
      }, 4500);
    }
  };

  const lastTargetPieceIdRef = useRef<string | null>(null);

  // Escape key handler for custom gotero cursor mode
  useEffect(() => {
    if (!isDropperActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropperActive(false);
        showToast('Gotero desactivado');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropperActive]);

  // When dropper is active, automatically locate material whenever a piece is clicked/selected
  useEffect(() => {
    if (isDropperActive && targetPiece) {
      if (lastTargetPieceIdRef.current !== targetPiece.id) {
        lastTargetPieceIdRef.current = targetPiece.id;
        locatePieceMaterial(targetPiece);
      }
    }
  }, [isDropperActive, targetPiece?.id, targetPiece?.material, targetPiece?.customColor]);

  // Gotero (Eye Dropper) toggle handler - uses custom cursor instead of native browser circle
  const handleEyeDropper = () => {
    if (isDropperActive) {
      setIsDropperActive(false);
      showToast('Gotero desactivado');
    } else {
      lastTargetPieceIdRef.current = null;
      setIsDropperActive(true);
      showToast('Gotero activo: Haz clic en cualquier pieza o color del mueble (Esc para salir)');
      if (targetPiece) {
        locatePieceMaterial(targetPiece);
      }
    }
  };

  if (!isOpen) return null;

  // MINIMIZED FLOATING PILL
  if (isMinimized) {
    return (
      <div 
        className="fixed z-30 pointer-events-auto select-none"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
      >
        <div 
          className="bg-[#14151a]/95 backdrop-blur-md border border-[#2d313d] rounded-full pl-2 pr-3 py-1 shadow-2xl flex items-center gap-2 animate-in fade-in duration-150 cursor-grab active:cursor-grabbing select-none"
          {...dragProps}
          title="Arrastrar catálogo"
        >
          <GripHorizontal className="w-3 h-3 text-gray-500" />
          <MaterialSphere 
            color={currentColor}
            textureUrl={sampleTextureUrl}
            roughness={currentRoughness}
            metalness={currentMetalness}
            size={22}
          />
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-white hover:text-[#f0a144] transition-colors cursor-pointer"
          >
            <span>{targetPiece?.material || 'Catálogo'}</span>
            <ChevronUp className="w-3.5 h-3.5 text-[#f0a144]" />
          </button>
          <div className="w-[1px] h-3.5 bg-white/15" />
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-0.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar catálogo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  const categoryTabs: { id: CategoryTab; label: string; icon: string }[] = [
    { id: 'madera', label: 'Maderas', icon: '🪵' },
    { id: 'melamina', label: 'Melaminas', icon: '⚪' },
    { id: 'metal', label: 'Metales', icon: '⚙️' },
    { id: 'vidrio', label: 'Vidrios', icon: '🪞' },
    { id: 'color_picker', label: 'Color', icon: '🎨' },
    { id: 'custom', label: 'Fotos', icon: '📷' }
  ];

  return (
    <>
      {/* 100% Native Hardware-Accelerated CSS Cursor for Gotero (Zero-lag, 60fps/120fps/144fps smooth) */}
      {isDropperActive && (
        <style>{`
          *, body, html, canvas, button, div, a, svg, span, input {
            cursor: url("${GOTERO_CURSOR_URL}") 2 18, crosshair !important;
          }
        `}</style>
      )}

      <div 
        data-catalog-panel="true"
        className="fixed z-30 pointer-events-auto select-none"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onClick={e => e.stopPropagation()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept="image/png,image/jpeg,image/webp,image/jpg" 
          className="hidden" 
        />

      {/* COMPACT SQUARE FLOATING WINDOW (resizable and draggable) */}
      <div 
        className="bg-[#14151a]/95 backdrop-blur-md border border-[#2d313d] rounded-xl sm:rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden text-gray-200 relative group"
        style={{ width: `${size.width}px`, height: `${size.height}px` }}
      >
        
        {/* Top Header Bar (Draggable handle) */}
        <div 
          className="h-7 sm:h-8 px-2 sm:px-2.5 bg-[#101115] border-b border-[#22242e] flex items-center justify-between shrink-0 select-none cursor-grab active:cursor-grabbing"
          {...dragProps}
          title="Arrastrar ventana de catálogo"
        >
          
          {/* Title, Grip & Target Piece */}
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <GripHorizontal className="w-3 h-3 text-gray-500 shrink-0" />
            <span className="text-[10px] sm:text-xs">🎨</span>
            <span className="text-[9.5px] sm:text-[10.5px] font-bold text-white tracking-tight truncate">
              Catálogo
            </span>
          </div>

          {/* Controls: Sliders Toggle, Minimize, Close */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            {/* Ajustes Finos Button */}
            <button
              type="button"
              onClick={() => setShowAdjustDrawer(!showAdjustDrawer)}
              className={`p-0.5 sm:p-1 rounded border transition-colors cursor-pointer ${
                showAdjustDrawer 
                  ? 'bg-[#f0a144]/20 border-[#f0a144]/40 text-[#f0a144]' 
                  : 'bg-[#1b1c22] border-[#292c36] text-gray-300 hover:text-white'
              }`}
              title="Ajustes de veta, rotación 90° y escala UV"
            >
              <Sliders className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>

            {/* Minimize to Pill */}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-0.5 sm:p-1 rounded bg-[#1b1c22] hover:bg-[#252832] border border-[#292c36] text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Minimizar a píldora"
            >
              <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-0.5 sm:p-1 rounded bg-[#1b1c22] hover:bg-red-950/60 border border-[#292c36] hover:border-red-500/40 text-gray-400 hover:text-white transition-colors cursor-pointer"
              title="Cerrar catálogo"
            >
              <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            </button>
          </div>
        </div>

        {/* SketchUp-style Inspector Bar: Active Material Name, Mini Preview & Gotero (Eye Dropper) Button */}
        <div className="px-2 py-1 bg-[#101115] border-b border-[#1f212a] flex items-center justify-between gap-1.5 shrink-0 select-none">
          {/* Left: Active Material Preview & Name */}
          <div className="flex items-center gap-1.5 min-w-0">
            <MaterialSphere 
              color={currentColor}
              textureUrl={sampleTextureUrl}
              roughness={currentRoughness}
              metalness={currentMetalness}
              size={20}
            />
            <div className="flex flex-col min-w-0">
              <span className="text-[6.5px] text-gray-400 uppercase font-mono tracking-tight leading-none">
                Nombre
              </span>
              <span className="text-[8.5px] sm:text-[9.5px] font-bold text-white truncate max-w-[120px] sm:max-w-[170px] leading-tight" title={currentMatDef.name || targetPiece?.material || 'Blanco'}>
                {currentMatDef.name || targetPiece?.material || 'Blanco'}
              </span>
            </div>
          </div>

          {/* Right: Gotero (Pipette) tool button */}
          <button
            type="button"
            onClick={handleEyeDropper}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8px] font-bold uppercase transition-all cursor-pointer shrink-0 ${
              isDropperActive
                ? 'bg-[#f0a144] text-black border-[#f0a144] font-black shadow-lg ring-2 ring-[#f0a144]/80 animate-pulse'
                : 'bg-[#1b1c23] hover:bg-[#252834] text-gray-200 hover:text-[#f0a144] border-[#2c303c] hover:border-[#f0a144]/60'
            }`}
            title="Gotero (Muestrear color en pantalla o 3D para ubicarlo en la barra)"
          >
            <Pipette className={`w-3 h-3 ${isDropperActive ? 'text-black' : 'text-[#f0a144]'}`} />
            <span>Gotero</span>
            {isDropperActive && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping ml-0.5" />}
          </button>
        </div>

        {/* COMPACT CATEGORY TABS (3 columns x 2 rows: ALL 6 tabs fully visible at any width without horizontal stretching!) */}
        <div className="grid grid-cols-3 gap-1 px-1.5 py-1 bg-[#0c0d11] border-b border-[#20222a] shrink-0">
          {categoryTabs.map(tab => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`py-1 px-1 rounded-md text-[8px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer truncate ${
                  isActive 
                    ? 'bg-[#f0a144] text-black shadow-xs font-black' 
                    : 'bg-[#171820] hover:bg-[#222430] text-gray-300 hover:text-white border border-[#282a36]'
                }`}
                title={tab.label}
              >
                <span className="text-[9px] shrink-0">{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Collapsible Quick Adjustment Drawer */}
        {showAdjustDrawer && (
          <div className="bg-[#0b0c10] border-b border-[#242632] px-2 py-1 flex flex-wrap items-center justify-between gap-1 shrink-0 animate-in fade-in duration-150 text-[8.5px]">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[8px] text-gray-400 font-bold uppercase tracking-wider">Veta:</span>
              <button
                type="button"
                onClick={rotateTexture90}
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-[#1a1c24] hover:bg-[#242733] border border-[#2d303e] rounded text-[8px] font-semibold text-white transition-all cursor-pointer"
                title="Girar veta 90°"
              >
                <RotateCw className="w-2.5 h-2.5 text-[#f0a144]" />
                <span>90°</span>
              </button>
              
              {/* Opciones UV */}
              <div className="flex items-center gap-0.5 bg-[#1a1c24] p-0.5 rounded border border-[#2d303e]">
                {[-2, -1, 1, 2].map(s => {
                  const isSelected = currentUVScale === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setTextureTiling(s)}
                      className={`px-1 py-0.2 rounded text-[7.5px] font-mono transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-[#f0a144] text-black font-bold' 
                          : 'text-gray-300 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {s}x
                    </button>
                  );
                })}
              </div>

              {hasTexture && (
                <button
                  type="button"
                  onClick={resetUV}
                  className="px-1 py-0.5 bg-[#1a1c24] hover:bg-[#242733] border border-[#373b4d] rounded text-[7.5px] text-gray-200 hover:text-[#f0a144] transition-all cursor-pointer"
                  title="Restablecer coordenadas UV"
                >
                  <RotateCcw className="w-2 h-2 inline mr-0.5 text-[#f0a144]" />
                  1x
                </button>
              )}

              <button
                type="button"
                onClick={removeTexture}
                className="px-1 py-0.5 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 rounded text-[7.5px] text-red-300 transition-all cursor-pointer"
                title="Limpiar UV"
              >
                <Trash2 className="w-2 h-2 inline mr-0.5 text-red-400" />
                Limpiar
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (targetPiece) onUpdatePiece(targetPiece.id, { customRoughness: 0.1, customMetalness: 0.0 });
                }}
                className="px-1 py-0.5 rounded bg-[#1a1c24] border border-[#2d303e] text-[7.5px] text-gray-300 cursor-pointer"
              >
                Brillante
              </button>
              <button
                type="button"
                onClick={() => {
                  if (targetPiece) onUpdatePiece(targetPiece.id, { customRoughness: 0.5, customMetalness: 0.0 });
                }}
                className="px-1 py-0.5 rounded bg-[#1a1c24] border border-[#2d303e] text-[7.5px] text-gray-300 cursor-pointer"
              >
                Satinado
              </button>
              <button
                type="button"
                onClick={() => {
                  if (targetPiece) onUpdatePiece(targetPiece.id, { customRoughness: 0.9, customMetalness: 0.0 });
                }}
                className="px-1 py-0.5 rounded bg-[#1a1c24] border border-[#2d303e] text-[7.5px] text-gray-300 cursor-pointer"
              >
                Mate
              </button>
            </div>
          </div>
        )}

        {/* MAIN BODY: 3-COLUMN SQUARE GRID (as sketched in red: circles in 3 columns) */}
        <div className="flex-1 overflow-y-auto p-1.5 sm:p-2 bg-[#0d0e12] [scrollbar-width:thin]">
          
          {/* A. 3-COLUMN SPHERE GRID (Maderas, Melaminas, Metales, Vidrios) */}
          {activeCategory !== 'color_picker' && activeCategory !== 'custom' && (
            <div className="grid grid-cols-3 gap-1 sm:gap-2 pb-1.5">
              {categoryMaterials.map(mat => {
                const isActive = targetPiece?.material === mat.id;
                const isHighlighted = highlightedMaterialId === mat.id;
                const woodUrl = mat.hasGrain ? getPelikanoTextureUrl(mat.id) : null;

                return (
                  <div
                    id={`mat-swatch-${mat.id}`}
                    key={mat.id}
                    onClick={() => applyMaterialToTarget(mat)}
                    className={`relative p-1 sm:p-1.5 rounded-lg sm:rounded-xl transition-all duration-200 cursor-pointer flex flex-col items-center justify-between group active:scale-95 ${
                      isHighlighted
                        ? 'bg-[#2a2211] border-2 border-[#f0a144] ring-4 ring-[#f0a144] shadow-[0_0_22px_rgba(240,161,68,0.9)] scale-105 z-10 animate-pulse'
                        : isActive 
                          ? 'bg-[#1e1c15] border border-[#f0a144] ring-2 ring-[#f0a144]/60 shadow-md' 
                          : 'bg-[#15161c] hover:bg-[#1c1d25] border border-[#232530]'
                    }`}
                  >
                    {/* Badge when highlighted by Dropper */}
                    {isHighlighted && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#f0a144] text-black px-1.5 py-0.5 rounded-full text-[6.5px] font-black uppercase tracking-wider shadow-lg z-20 flex items-center gap-0.5 whitespace-nowrap animate-bounce">
                        <Pipette className="w-2 h-2" />
                        <span>UBICADO</span>
                      </div>
                    )}

                    {isActive && !isHighlighted && (
                      <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-[#f0a144] text-black p-0.5 rounded-full shadow z-10">
                        <Check className="w-2 h-2 stroke-[3]" />
                      </div>
                    )}

                    <MaterialSphere 
                      color={mat.color}
                      textureUrl={woodUrl}
                      roughness={mat.roughness}
                      metalness={mat.metalness}
                      opacity={mat.opacity}
                      isGlass={mat.isGlass}
                      isMirror={mat.isMirror}
                      size={32}
                      glow={isActive || isHighlighted}
                    />

                    <div className="w-full text-center mt-0.5">
                      <div className={`text-[7.5px] sm:text-[8.5px] font-bold truncate px-0.5 leading-tight ${isHighlighted ? 'text-[#f0a144]' : 'text-white'}`} title={mat.name}>
                        {mat.name}
                      </div>
                      <div className="text-[6.5px] sm:text-[7px] text-gray-400 font-medium truncate leading-none mt-0.5">
                        {mat.hasGrain ? 'Veta' : mat.isGlass ? 'Vidrio' : mat.category === 'metal' ? 'Metal' : 'Liso'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* B. COLOR PICKER WORKSPACE */}
          {activeCategory === 'color_picker' && (
            <div className="space-y-1.5 sm:space-y-2.5 pb-2">
              
              {/* Active Color Preview */}
              <div className="bg-[#15161c] border border-[#22242e] rounded-xl p-1.5 sm:p-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <MaterialSphere 
                    color={currentColor}
                    roughness={currentRoughness}
                    metalness={currentMetalness}
                    size={30}
                  />
                  <div>
                    <div className="text-[8.5px] sm:text-[9.5px] font-bold text-white">Color Actual</div>
                    <div className="text-[7.5px] sm:text-[8px] font-mono text-[#f0a144]">{currentColor.toUpperCase()}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[7.5px] sm:text-[8px] text-gray-400 font-medium">Libre:</span>
                  <input 
                    type="color"
                    value={currentColor.startsWith('#') ? currentColor : '#ffffff'}
                    onChange={(e) => applyCustomColor(e.target.value)}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded border border-white/20 bg-transparent cursor-pointer p-0"
                  />
                </div>
              </div>

              {/* Curated Swatches Grid */}
              <div>
                <span className="text-[7.5px] sm:text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">
                  Colores Predefinidos
                </span>
                <div className="grid grid-cols-4 gap-1 sm:gap-1.5">
                  {curatedColors.map(sw => {
                    const isCuratedHighlighted = highlightedMaterialId === `color-swatch-${sw.name}`;
                    return (
                      <button
                        id={`color-swatch-${sw.name}`}
                        key={sw.name}
                        type="button"
                        onClick={() => applyCustomColor(sw.color)}
                        className={`h-6 sm:h-7 rounded-lg border transition-transform active:scale-95 flex items-center justify-center shadow-xs cursor-pointer relative ${
                          isCuratedHighlighted
                            ? 'border-[#f0a144] ring-4 ring-[#f0a144] shadow-[0_0_15px_#f0a144] scale-105 animate-pulse'
                            : currentColor.toLowerCase() === sw.color.toLowerCase()
                              ? 'border-[#f0a144] ring-2 ring-[#f0a144]'
                              : 'border-white/10 hover:border-white/30'
                        }`}
                        style={{ backgroundColor: sw.color }}
                        title={sw.name}
                      >
                        {isCuratedHighlighted && (
                          <div className="absolute -top-1.5 bg-[#f0a144] text-black text-[6px] font-black px-1 rounded-full shadow">
                            UBICADO
                          </div>
                        )}
                        {currentColor.toLowerCase() === sw.color.toLowerCase() && !isCuratedHighlighted && (
                          <Check className={`w-2.5 h-2.5 stroke-[3] ${sw.color === '#ffffff' || sw.color === '#e5e7eb' ? 'text-black' : 'text-white'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sliders for Roughness and Metalness */}
              <div className="space-y-1 pt-1 border-t border-[#1e2028]">
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[7.5px] sm:text-[8px]">
                    <span className="font-semibold text-gray-300">Acabado / Brillo</span>
                    <span className="font-mono text-gray-400 tabular-nums">
                      {Math.round(currentRoughness * 100)}%
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentRoughness}
                    onChange={(e) => {
                      if (targetPiece) onUpdatePiece(targetPiece.id, { customRoughness: parseFloat(e.target.value) });
                    }}
                    className="w-full h-1 bg-[#252833] rounded-lg appearance-none accent-[#f0a144] cursor-pointer"
                  />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center justify-between text-[7.5px] sm:text-[8px]">
                    <span className="font-semibold text-gray-300">Metalicidad</span>
                    <span className="font-mono text-gray-400 tabular-nums">
                      {Math.round(currentMetalness * 100)}%
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={currentMetalness}
                    onChange={(e) => {
                      if (targetPiece) onUpdatePiece(targetPiece.id, { customMetalness: parseFloat(e.target.value) });
                    }}
                    className="w-full h-1 bg-[#252833] rounded-lg appearance-none accent-[#f0a144] cursor-pointer"
                  />
                </div>
              </div>

            </div>
          )}

          {/* C. CUSTOM TEXTURES 3-COLUMN GRID */}
          {activeCategory === 'custom' && (
            <div className="grid grid-cols-3 gap-1 sm:gap-2 pb-1.5">
              
              {/* Upload Card */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl border border-dashed border-[#3a3f50] hover:border-[#f0a144] bg-[#15161c]/50 hover:bg-[#1a1c24] flex flex-col items-center justify-center text-center cursor-pointer transition-colors group active:scale-95 min-h-[75px] sm:min-h-[90px]"
                title="Subir foto o textura JPG/PNG"
              >
                <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-[#f0a144]/15 text-[#f0a144] flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[7.5px] sm:text-[8px] font-bold text-white leading-tight">Subir Foto</span>
                <span className="text-[6.5px] text-gray-400">JPG/PNG</span>
              </div>

              {/* Uploaded Cards */}
              {customTextures.map(tex => {
                const isActive = sampleTextureUrl === tex.url;
                const isCustomHighlighted = highlightedMaterialId === `custom-swatch-${tex.id}`;

                return (
                  <div
                    id={`custom-swatch-${tex.id}`}
                    key={tex.id}
                    onClick={() => applyCustomTextureToPieces(tex.url, tex.name)}
                    className={`relative p-1 sm:p-1.5 rounded-lg sm:rounded-xl transition-all duration-150 cursor-pointer flex flex-col items-center justify-between group active:scale-95 ${
                      isCustomHighlighted
                        ? 'bg-[#2a2211] border-2 border-[#f0a144] ring-4 ring-[#f0a144] shadow-[0_0_20px_#f0a144] scale-105 animate-pulse'
                        : isActive 
                          ? 'bg-[#1e1c15] border border-[#f0a144] ring-2 ring-[#f0a144]/60 shadow-md' 
                          : 'bg-[#15161c] hover:bg-[#1c1d25] border border-[#232530]'
                    }`}
                    title={tex.name}
                  >
                    {isCustomHighlighted && (
                      <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-[#f0a144] text-black px-1.5 py-0.5 rounded-full text-[6.5px] font-black uppercase tracking-wider shadow-lg z-20 flex items-center gap-0.5 whitespace-nowrap animate-bounce">
                        <Pipette className="w-2 h-2" />
                        <span>UBICADO</span>
                      </div>
                    )}

                    {isActive && !isCustomHighlighted && (
                      <div className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 bg-[#f0a144] text-black p-0.5 rounded-full shadow z-10">
                        <Check className="w-2 h-2 stroke-[3]" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`¿Eliminar textura "${tex.name}"?`)) {
                          deleteCustomTexture(tex.id);
                          setCustomTextures(getStoredCustomTextures());
                          showToast('Eliminada');
                        }
                      }}
                      className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 p-0.5 rounded-full bg-black/70 text-gray-400 hover:text-red-400 opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Eliminar"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>

                    <MaterialSphere 
                      color="#ffffff"
                      textureUrl={tex.url}
                      roughness={0.45}
                      metalness={0.0}
                      size={32}
                      glow={isActive}
                    />

                    <div className="w-full text-center mt-0.5">
                      <div className="text-[7.5px] sm:text-[8px] font-bold text-white truncate px-0.5 leading-tight">
                        {tex.name}
                      </div>
                      <div className="text-[6.5px] sm:text-[7px] text-[#f0a144] font-medium leading-none mt-0.5">
                        Foto
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Floating Notification Toast */}
        {feedbackToast && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-[#1c1d24] border border-[#f0a144]/70 text-white text-[9px] font-semibold px-2.5 py-0.5 rounded-full shadow-xl flex items-center gap-1.5 z-50 pointer-events-none animate-in fade-in duration-100">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f0a144] animate-pulse" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Border and Corner Resize Handles */}
        <div 
          className="absolute top-0 right-0 w-2 h-full cursor-ew-resize hover:bg-[#f0a144]/30 z-20 transition-colors"
          {...resizeRightProps}
          title="Arrastrar borde para cambiar ancho"
        />
        <div 
          className="absolute bottom-0 left-0 w-full h-2 cursor-ns-resize hover:bg-[#f0a144]/30 z-20 transition-colors"
          {...resizeBottomProps}
          title="Arrastrar borde para cambiar alto"
        />
        <div 
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-30 flex items-end justify-end p-0.5 text-gray-400 hover:text-[#f0a144] hover:bg-[#f0a144]/20 rounded-br-xl transition-all"
          {...resizeCornerProps}
          title="Reducir o ampliar tamaño del catálogo"
        >
          <svg className="w-2.5 h-2.5 pointer-events-none" viewBox="0 0 6 6" fill="currentColor">
            <circle cx="5" cy="5" r="0.75" />
            <circle cx="5" cy="2.5" r="0.75" />
            <circle cx="2.5" cy="5" r="0.75" />
          </svg>
        </div>

      </div>
    </div>
    </>
  );
}
