import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Upload, RotateCw, Trash2, Palette, 
  Sparkles, Check, Image as ImageIcon, Pipette
} from 'lucide-react';
import { Piece, PieceFaceKey, FaceTextureOptions, CustomTextureItem } from '../types';
import { 
  getStoredCustomTextures, 
  saveCustomTexture, 
  deleteCustomTexture,
  getPelikanoTextureUrl,
  PELIKANO_WOOD_CONFIGS
} from '../lib/textureManager';
import { MATERIAL_MAP, getGroupedMaterials } from './ThreeViewer';

interface TextureCompactBarProps {
  piece: Piece;
  selectedPieces?: Piece[];
  isOpen: boolean;
  activeFace: PieceFaceKey | 'all';
  onSelectFace: (face: PieceFaceKey | 'all') => void;
  onClose: () => void;
  onUpdatePiece: (id: string, updates: Partial<Piece>) => void;
}

export const FACE_DEFINITIONS: { key: PieceFaceKey; label: string; short: string; axis: string }[] = [
  { key: 'top', label: 'Cara Superior', short: 'Sup', axis: '+Y' },
  { key: 'bottom', label: 'Cara Inferior', short: 'Inf', axis: '-Y' },
  { key: 'front', label: 'Cara Frontal (L1)', short: 'Front', axis: '+Z' },
  { key: 'back', label: 'Cara Posterior (L2)', short: 'Post', axis: '-Z' },
  { key: 'right', label: 'Lateral Derecho (A1)', short: 'Der', axis: '+X' },
  { key: 'left', label: 'Lateral Izquierdo (A2)', short: 'Izq', axis: '-X' }
];

export default function TextureCompactBar({
  piece,
  selectedPieces = [],
  isOpen,
  activeFace,
  onSelectFace,
  onClose,
  onUpdatePiece
}: TextureCompactBarProps) {
  const [customTextures, setCustomTextures] = useState<CustomTextureItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const isMulti = selectedPieces.length > 1;
  const targetPieces = isMulti ? selectedPieces : [piece];
  const barContainerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent) => {
      if (barContainerRef.current && !barContainerRef.current.contains(e.target as Node)) {
        const targetEl = e.target as HTMLElement | null;
        if (!targetEl?.closest('[data-texture-trigger="true"]')) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isOpen, onClose]);

  // Refresh stored custom textures on open
  useEffect(() => {
    if (isOpen) {
      setCustomTextures(getStoredCustomTextures());
    }
  }, [isOpen]);

  const showBriefToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast((prev) => (prev === msg ? null : prev));
    }, 1800);
  };

  if (!isOpen) return null;

  // Handle uploaded custom photo
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Resize & compress to max 1280px
        const canvas = document.createElement('canvas');
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

          const fileName = file.name.replace(/\.[^/.]+$/, '').slice(0, 24);
          const savedItem = saveCustomTexture(fileName, compressedDataUrl);
          setCustomTextures(getStoredCustomTextures());

          // Apply immediately to current target
          applyTextureUrl(savedItem.url, savedItem.name);
        }
        setIsUploading(false);
      };
      img.onerror = () => setIsUploading(false);
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Apply a texture URL (from custom photos or presets)
  const applyTextureUrl = (url: string, label: string) => {
    targetPieces.forEach((p) => {
      const currentFaceTextures = { ...(p.faceTextures || {}) };
      const currentFaceConfigs = { ...(p.faceTextureConfigs || {}) };

      const baseRot = p.vetaRotation ?? (p.vetaOrientacion === 'transversal' ? 90 : 0);
      const newConfig: FaceTextureOptions = {
        repeatX: 1,
        repeatY: 1,
        rotation: baseRot
      };

      if (activeFace === 'all') {
        // Paint ALL faces by default
        (['top', 'bottom', 'front', 'back', 'right', 'left'] as PieceFaceKey[]).forEach((fKey) => {
          currentFaceTextures[fKey] = url;
          currentFaceConfigs[fKey] = newConfig;
        });
      } else {
        // Paint only selected face
        currentFaceTextures[activeFace] = url;
        currentFaceConfigs[activeFace] = newConfig;
      }

      onUpdatePiece(p.id, {
        faceTextures: currentFaceTextures,
        faceTextureConfigs: currentFaceConfigs
      });
    });

    showBriefToast(activeFace === 'all' ? `Pintado Todo con ${label}` : `Pintada cara seleccionada con ${label}`);
  };

  // Apply a Pelikano material
  const applyPelikanoMaterial = (matKey: string) => {
    const matInfo = MATERIAL_MAP[matKey];
    if (!matInfo) return;

    const isWood = matInfo.hasGrain ?? false;
    const woodUrl = isWood ? getPelikanoTextureUrl(matKey) : null;

    targetPieces.forEach((p) => {
      if (activeFace === 'all') {
        // BY DEFAULT: Paint ALL faces with this Pelikano material!
        onUpdatePiece(p.id, {
          material: matKey,
          customColor: undefined,
          faceTextures: undefined,
          faceTextureConfigs: undefined,
          veta: isWood,
          vetaOrientacion: isWood ? (p.vetaOrientacion || 'longitudinal') : undefined
        });
      } else {
        // Apply to specifically selected face
        const currentFaceTextures = { ...(p.faceTextures || {}) };
        if (woodUrl) {
          currentFaceTextures[activeFace] = woodUrl;
        } else {
          // Unicolor: generate swatch texture
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = matInfo.color;
            ctx.fillRect(0, 0, 64, 64);
            currentFaceTextures[activeFace] = canvas.toDataURL();
          }
        }
        onUpdatePiece(p.id, {
          faceTextures: currentFaceTextures
        });
      }
    });

    showBriefToast(activeFace === 'all' ? `Pintado Todo: ${matInfo.name}` : `Pintada cara seleccionada: ${matInfo.name}`);
  };

  // Apply solid color from color picker
  const handleSolidColorChange = (hex: string) => {
    targetPieces.forEach((p) => {
      if (activeFace === 'all') {
        onUpdatePiece(p.id, {
          material: 'Custom',
          customColor: hex,
          faceTextures: undefined,
          faceTextureConfigs: undefined
        });
      } else {
        const currentFaceTextures = { ...(p.faceTextures || {}) };
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = hex;
          ctx.fillRect(0, 0, 64, 64);
          currentFaceTextures[activeFace] = canvas.toDataURL();
        }
        onUpdatePiece(p.id, {
          faceTextures: currentFaceTextures
        });
      }
    });
    showBriefToast(activeFace === 'all' ? `Pintado Todo con color` : `Pintada cara seleccionada con color`);
  };

  // Eye Dropper tool handler
  const handleEyeDropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        showBriefToast('Gotero: Selecciona un color');
        // @ts-expect-error EyeDropper is standard Web API
        const eyeDropper = new window.EyeDropper();
        const result = await eyeDropper.open();
        if (result && result.sRGBHex) {
          handleSolidColorChange(result.sRGBHex);
        }
      } catch (err) {
        console.log('EyeDropper cancelled', err);
      }
    } else {
      colorInputRef.current?.click();
    }
  };

  // Rotate grain orientation 90 degrees
  const handleRotateGrain = () => {
    const currentRot = piece.vetaRotation ?? (piece.vetaOrientacion === 'transversal' ? 90 : 0);
    const nextRot = (currentRot + 90) % 360;
    const nextOrient = (nextRot === 90 || nextRot === 270) ? 'transversal' : 'longitudinal';

    targetPieces.forEach((p) => {
      if (activeFace === 'all') {
        const currentConfigs = { ...(p.faceTextureConfigs || {}) };
        (['top', 'bottom', 'front', 'back', 'right', 'left'] as PieceFaceKey[]).forEach((fKey) => {
          if (currentConfigs[fKey]) {
            currentConfigs[fKey] = { ...currentConfigs[fKey], rotation: nextRot };
          }
        });
        onUpdatePiece(p.id, {
          vetaRotation: nextRot,
          vetaOrientacion: nextOrient,
          faceTextureConfigs: Object.keys(currentConfigs).length > 0 ? currentConfigs : undefined
        });
      } else {
        const currentConfigs = { ...(p.faceTextureConfigs || {}) };
        const cfg = currentConfigs[activeFace] || { repeatX: 1, repeatY: 1, rotation: 0 };
        currentConfigs[activeFace] = { ...cfg, rotation: nextRot };
        onUpdatePiece(p.id, {
          faceTextureConfigs: currentConfigs,
          vetaRotation: nextRot
        });
      }
    });

    showBriefToast(`Rotación veta: ${nextRot}°`);
  };

  // Clear custom face textures
  const handleClearTextures = () => {
    const defaultWhite = MATERIAL_MAP['Blanco'];
    targetPieces.forEach((p) => {
      onUpdatePiece(p.id, {
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
        vetaOrientacion: 'longitudinal'
      });
    });
    showBriefToast('UV limpiado · Blanco mate por defecto');
  };

  const hasFaceTextures = piece.faceTextures && Object.values(piece.faceTextures).filter(Boolean).length > 0;
  const currentRotAngle = piece.vetaRotation ?? (piece.vetaOrientacion === 'transversal' ? 90 : 0);

  // Grouped materials
  const grouped = getGroupedMaterials();
  const pelikanoWoods = grouped['Maderas con Veta'] || grouped['Pelikano - Maderas con Veta'] || [];
  const pelikanoUnicolors = grouped['Colores y Melaminas'] || grouped['Pelikano - Unicolores'] || [];

  return (
    <div 
      ref={barContainerRef}
      className="fixed bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-1.5 bg-[#141414]/95 backdrop-blur-md border border-[#333333] shadow-[0_16px_40px_rgba(0,0,0,0.92)] rounded-2xl p-2 sm:p-2.5 max-w-[calc(100vw-20px)] w-[680px] max-w-2xl select-none pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-150 text-white"
    >
      {/* Toast feedback pill */}
      {feedbackToast && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#222222] border border-[#f0a144]/60 text-[#f0a144] text-[9px] font-bold px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
          {feedbackToast}
        </div>
      )}

      {/* ROW 1: Target Selector & Quick Controls */}
      <div className="flex items-center justify-between gap-2 border-b border-[#242424] pb-1.5">
        {/* Target Selector: Todo (Defecto) or Active Face indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[8px] font-black uppercase text-[#888888] tracking-wider">
            Pintar:
          </span>

          {/* Pintar Todo Button (DEFAULT) */}
          <button
            type="button"
            onClick={() => onSelectFace('all')}
            className={`px-2.5 py-0.5 rounded-md text-[8.5px] font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
              activeFace === 'all'
                ? 'bg-[#f0a144] text-black shadow-xs font-black'
                : 'bg-[#222222] text-gray-300 hover:text-white hover:bg-[#2c2c2c]'
            }`}
            title="Pintar todas las caras por defecto"
          >
            <Sparkles className="w-2.5 h-2.5" />
            <span>Todo (Defecto)</span>
          </button>

          {/* If a face was selected directly via its 3D icon in the viewport */}
          {activeFace !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectFace('all')}
              className="px-2 py-0.5 rounded-md text-[8px] font-bold bg-[#f0a144]/20 border border-[#f0a144] text-[#f0a144] hover:bg-[#f0a144] hover:text-black transition-all flex items-center gap-1 cursor-pointer"
              title="Cara individual activa. Clic aquí para volver a pintar Todo"
            >
              <Palette className="w-2.5 h-2.5" />
              <span>Cara seleccionada (✕ volver a Todo)</span>
            </button>
          )}
        </div>

        {/* Right Tools: Rotation, Custom Color, Upload, Close */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Veta rotation button */}
          <button
            type="button"
            onClick={handleRotateGrain}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#222222] hover:bg-[#2c2c2c] text-gray-300 hover:text-white text-[8px] font-mono font-bold transition-colors cursor-pointer"
            title="Girar orientación de la veta (90°)"
          >
            <RotateCw className="w-2.5 h-2.5 text-[#f0a144]" />
            <span>{currentRotAngle}°</span>
          </button>

          {/* Color Picker input */}
          <div className="relative flex items-center">
            <input
              type="color"
              ref={colorInputRef}
              onChange={(e) => handleSolidColorChange(e.target.value)}
              className="absolute opacity-0 pointer-events-none w-0 h-0"
            />
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="w-5 h-5 rounded-md border border-[#444] bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
              title="Elegir color personalizado"
            />
          </div>

          {/* Gotero (Eye Dropper) */}
          <button
            type="button"
            onClick={handleEyeDropper}
            className="w-5 h-5 rounded-md border border-[#444] bg-[#222222] hover:bg-[#2e2e2e] flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
            title="Gotero (Muestrear color con cuentagotas)"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>

          {/* Upload photo button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#242424] hover:bg-[#2e2e2e] text-[#f0a144] hover:text-[#ffb766] text-[8px] font-bold transition-colors cursor-pointer"
            title="Subir foto o textura desde archivo"
          >
            <Upload className="w-2.5 h-2.5" />
            <span>{isUploading ? 'Subiendo...' : '+ Subir'}</span>
          </button>

          {/* Clear textures button */}
          {hasFaceTextures && (
            <button
              type="button"
              onClick={handleClearTextures}
              className="p-1 rounded bg-[#222222] hover:bg-red-950/40 text-red-400 hover:text-red-300 text-[8px] transition-colors cursor-pointer"
              title="Quitar texturas de caras y restaurar base"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          )}

          {/* Close bar */}
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded bg-[#222222] hover:bg-[#333333] text-gray-400 hover:text-white text-[9px] transition-colors cursor-pointer ml-1"
            title="Cerrar barra de texturas"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ROW 2: Horizontal Scrollable Swatches Tray */}
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar py-0.5 scroll-smooth">
        {/* Custom Uploaded Swatches (if any) */}
        {customTextures.map((tex) => (
          <div key={tex.id} className="relative group shrink-0">
            <button
              type="button"
              onClick={() => applyTextureUrl(tex.url, tex.name)}
              className="w-7 h-7 rounded-md border border-[#444] hover:border-[#f0a144] overflow-hidden bg-cover bg-center cursor-pointer transition-transform hover:scale-105"
              style={{ backgroundImage: `url(${tex.url})` }}
              title={`Foto: ${tex.name} (Clic para aplicar a ${activeFace === 'all' ? 'Todo' : activeFace})`}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteCustomTexture(tex.id);
                setCustomTextures(getStoredCustomTextures());
              }}
              className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[7px]"
              title="Eliminar foto guardada"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Pelikano Maderas (With Grain) */}
        {pelikanoWoods.map((wood) => {
          const isCurrentMat = piece.material === wood.id && !hasFaceTextures;
          const texUrl = getPelikanoTextureUrl(wood.id);

          return (
            <button
              key={wood.id}
              type="button"
              onClick={() => applyPelikanoMaterial(wood.id)}
              className={`w-7 h-7 rounded-md shrink-0 border overflow-hidden transition-all hover:scale-115 cursor-pointer relative shadow-xs ${
                isCurrentMat ? 'border-[#f0a144] ring-2 ring-[#f0a144]' : 'border-[#3a3a3a] hover:border-[#f0a144]'
              }`}
              style={{
                backgroundImage: texUrl ? `url(${texUrl})` : undefined,
                backgroundColor: wood.color,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
              title={`Pelikano ${wood.name} (Veta 3D)`}
            />
          );
        })}

        {/* Pelikano Unicolores */}
        <div className="h-6 w-px bg-[#333] shrink-0 mx-0.5" />
        {pelikanoUnicolors.map((uni) => {
          const isCurrentMat = piece.material === uni.id && !hasFaceTextures;

          return (
            <button
              key={uni.id}
              type="button"
              onClick={() => applyPelikanoMaterial(uni.id)}
              className={`w-7 h-7 rounded-md shrink-0 border overflow-hidden transition-all hover:scale-115 cursor-pointer relative shadow-xs ${
                isCurrentMat ? 'border-[#f0a144] ring-2 ring-[#f0a144]' : 'border-[#3a3a3a] hover:border-[#f0a144]'
              }`}
              style={{ backgroundColor: uni.color }}
              title={`Pelikano ${uni.name}`}
            />
          );
        })}
      </div>
    </div>
  );
}
