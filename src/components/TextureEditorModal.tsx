import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Upload, Image as ImageIcon, Check, RotateCw, 
  Trash2, Layers, Sparkles, Sliders, RefreshCw, Eye
} from 'lucide-react';
import { Piece, PieceFaceKey, FaceTextureOptions, CustomTextureItem } from '../types';
import { 
  getPresetTextures, 
  getStoredCustomTextures, 
  saveCustomTexture, 
  deleteCustomTexture,
  PresetTexture 
} from '../lib/textureManager';
import { FURNITURE_MATERIALS } from '../lib/materials';

interface TextureEditorModalProps {
  piece: Piece;
  isOpen: boolean;
  onClose: () => void;
  onUpdatePiece: (id: string, updates: Partial<Piece>) => void;
}

const FACE_DEFINITIONS: { key: PieceFaceKey; label: string; short: string; axis: string }[] = [
  { key: 'top', label: 'Cara Superior', short: 'Sup (+Y)', axis: '+Y' },
  { key: 'bottom', label: 'Cara Inferior', short: 'Inf (-Y)', axis: '-Y' },
  { key: 'front', label: 'Cara Frontal (L1)', short: 'Front (+Z)', axis: '+Z' },
  { key: 'back', label: 'Cara Posterior (L2)', short: 'Post (-Z)', axis: '-Z' },
  { key: 'right', label: 'Lateral Derecho (A1)', short: 'Der (+X)', axis: '+X' },
  { key: 'left', label: 'Lateral Izquierdo (A2)', short: 'Izq (-X)', axis: '-X' }
];

export default function TextureEditorModal({
  piece,
  isOpen,
  onClose,
  onUpdatePiece
}: TextureEditorModalProps) {
  const [selectedFace, setSelectedFace] = useState<PieceFaceKey | 'all'>('top');
  const [customTextures, setCustomTextures] = useState<CustomTextureItem[]>([]);
  const [presets, setPresets] = useState<PresetTexture[]>([]);
  const [activeTab, setActiveTab] = useState<'upload' | 'presets'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current repeat and rotation for selected face
  const currentConfig: FaceTextureOptions = (
    selectedFace !== 'all' 
      ? piece.faceTextureConfigs?.[selectedFace] 
      : piece.faceTextureConfigs?.top
  ) || { repeatX: 1, repeatY: 1, rotation: 0 };

  const initialRot = currentConfig.rotation ?? (piece.vetaRotation ?? (piece.vetaOrientacion === 'transversal' ? 90 : 0));
  const [repeatVal, setRepeatVal] = useState<number>(currentConfig.repeatX || 1);
  const [rotVal, setRotVal] = useState<number>(initialRot);

  useEffect(() => {
    setCustomTextures(getStoredCustomTextures());
    setPresets(getPresetTextures());
  }, [isOpen]);

  useEffect(() => {
    if (selectedFace !== 'all') {
      const cfg = piece.faceTextureConfigs?.[selectedFace];
      const faceRot = cfg?.rotation ?? (piece.vetaRotation ?? (piece.vetaOrientacion === 'transversal' ? 90 : 0));
      setRepeatVal(cfg?.repeatX || 1);
      setRotVal(faceRot);
    } else {
      const generalRot = piece.vetaRotation ?? (piece.vetaOrientacion === 'transversal' ? 90 : 0);
      setRotVal(generalRot);
    }
  }, [selectedFace, piece.faceTextureConfigs, piece.vetaRotation, piece.vetaOrientacion]);

  if (!isOpen) return null;

  // Handle uploaded image file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress & scale to max 1280px to guarantee fast rendering & storage efficiency
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
          setActiveTab('upload');

          // Immediately apply to selected face
          applyTextureUrl(savedItem.url);
        }
        setIsUploading(false);
      };
      img.onerror = () => setIsUploading(false);
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
    // Reset file input so same file can be reselected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const applyTextureUrl = (url: string) => {
    const currentFaceTextures = { ...(piece.faceTextures || {}) };
    const currentFaceConfigs = { ...(piece.faceTextureConfigs || {}) };

    const newConfig: FaceTextureOptions = {
      repeatX: repeatVal,
      repeatY: repeatVal,
      rotation: rotVal
    };

    if (selectedFace === 'all') {
      FACE_DEFINITIONS.forEach(f => {
        currentFaceTextures[f.key] = url;
        currentFaceConfigs[f.key] = newConfig;
      });
    } else {
      currentFaceTextures[selectedFace] = url;
      currentFaceConfigs[selectedFace] = newConfig;
    }

    onUpdatePiece(piece.id, {
      faceTextures: currentFaceTextures,
      faceTextureConfigs: currentFaceConfigs
    });
  };

  const removeTextureFromFace = (faceKey: PieceFaceKey | 'all') => {
    const currentFaceTextures = { ...(piece.faceTextures || {}) };
    const currentFaceConfigs = { ...(piece.faceTextureConfigs || {}) };

    if (faceKey === 'all') {
      const defaultWhite = FURNITURE_MATERIALS['Blanco'];
      onUpdatePiece(piece.id, {
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
    } else {
      delete currentFaceTextures[faceKey];
      delete currentFaceConfigs[faceKey];
      onUpdatePiece(piece.id, {
        faceTextures: currentFaceTextures,
        faceTextureConfigs: currentFaceConfigs
      });
    }
  };

  const applyBatchFaces = (keys: PieceFaceKey[], url: string) => {
    const currentFaceTextures = { ...(piece.faceTextures || {}) };
    const currentFaceConfigs = { ...(piece.faceTextureConfigs || {}) };
    const newConfig: FaceTextureOptions = {
      repeatX: repeatVal,
      repeatY: repeatVal,
      rotation: rotVal
    };

    keys.forEach(k => {
      currentFaceTextures[k] = url;
      currentFaceConfigs[k] = newConfig;
    });

    onUpdatePiece(piece.id, {
      faceTextures: currentFaceTextures,
      faceTextureConfigs: currentFaceConfigs
    });
  };

  const handleConfigChange = (newRepeat: number, newRot: number) => {
    setRepeatVal(newRepeat);
    setRotVal(newRot);

    const currentFaceConfigs = { ...(piece.faceTextureConfigs || {}) };
    const newConfig: FaceTextureOptions = {
      repeatX: newRepeat,
      repeatY: newRepeat,
      rotation: newRot
    };

    if (selectedFace === 'all') {
      FACE_DEFINITIONS.forEach(f => {
        if (piece.faceTextures?.[f.key]) {
          currentFaceConfigs[f.key] = newConfig;
        }
      });
    } else {
      currentFaceConfigs[selectedFace] = newConfig;
    }

    onUpdatePiece(piece.id, {
      faceTextureConfigs: currentFaceConfigs,
      veta: true,
      vetaRotation: newRot,
      vetaOrientacion: (newRot === 90 || newRot === 270) ? 'transversal' : 'longitudinal'
    });
  };

  // Count applied textures
  const appliedCount = piece.faceTextures ? Object.values(piece.faceTextures).filter(Boolean).length : 0;
  const uniqueTextures = piece.faceTextures ? new Set(Object.values(piece.faceTextures).filter(Boolean)).size : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/65 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1e1e1e] border border-[#333333] rounded-xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden text-white">
        
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-[#2e2e2e] bg-[#252525]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#f0a144]/20 text-[#f0a144]">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold tracking-tight text-white flex items-center gap-2">
                Texturizar por Caras
                {uniqueTextures > 0 && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[#f0a144]/20 text-[#f0a144] border border-[#f0a144]/30">
                    {uniqueTextures} textura{uniqueTextures > 1 ? 's' : ''} aplicada{uniqueTextures > 1 ? 's' : ''}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-gray-400 truncate max-w-[260px]">
                {piece.name} ({piece.largo}x{piece.ancho}x{piece.espesor} mm)
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-[#333333] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5 custom-scrollbar">
          
          {/* Step 1: Face Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#f0a144]" />
                1. Selecciona la cara a texturizar:
              </span>
              {appliedCount > 0 && (
                <button
                  type="button"
                  onClick={() => removeTextureFromFace('all')}
                  className="text-[9px] text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="w-3 h-3" /> Limpiar texturas
                </button>
              )}
            </div>

            {/* Quick Face Presets */}
            <div className="flex flex-wrap gap-1 mb-2">
              <button
                type="button"
                onClick={() => setSelectedFace('all')}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${
                  selectedFace === 'all'
                    ? 'bg-[#f0a144] text-black font-bold shadow'
                    : 'bg-[#2a2a2a] text-gray-300 hover:bg-[#333333]'
                }`}
              >
                Todas las Caras
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFace('top');
                  // quick select
                }}
                className="px-2 py-1 rounded text-[10px] font-semibold bg-[#2a2a2a] text-gray-300 hover:bg-[#333333]"
                title="Aplica a ambas caras amplias"
              >
                Superficies (Sup + Inf)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedFace('front');
                }}
                className="px-2 py-1 rounded text-[10px] font-semibold bg-[#2a2a2a] text-gray-300 hover:bg-[#333333]"
                title="Aplica a los cantos perimetrales"
              >
                Cantos Perimetrales
              </button>
            </div>

            {/* 6 Individual Face Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {FACE_DEFINITIONS.map(f => {
                const isFaceSelected = selectedFace === f.key;
                const hasTexture = !!piece.faceTextures?.[f.key];
                const texturePreviewUrl = piece.faceTextures?.[f.key];

                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setSelectedFace(f.key)}
                    className={`relative p-2 rounded-lg border text-left transition-all flex items-center gap-2 ${
                      isFaceSelected
                        ? 'border-[#f0a144] bg-[#f0a144]/15 shadow-sm'
                        : 'border-[#333333] bg-[#262626] hover:border-gray-500'
                    }`}
                  >
                    {/* Thumbnail / Swatch */}
                    <div className="w-6 h-6 rounded border border-black/40 overflow-hidden shrink-0 bg-[#3a3a3a] flex items-center justify-center">
                      {hasTexture && texturePreviewUrl ? (
                        <img 
                          src={texturePreviewUrl} 
                          alt={f.label} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div 
                          className="w-full h-full" 
                          style={{ backgroundColor: piece.customColor || '#f8fafc' }}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-white truncate leading-tight">
                        {f.label}
                      </div>
                      <div className="text-[8px] text-gray-400 font-mono">
                        {hasTexture ? '✓ Texturizada' : 'Color base'}
                      </div>
                    </div>
                    {isFaceSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#f0a144]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Texture Selection Tabs */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#f0a144]" />
                2. Elige o sube la imagen de textura:
              </span>
            </div>

            <div className="flex border-b border-[#333333] mb-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-1.5 text-center text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'upload'
                    ? 'border-[#f0a144] text-[#f0a144]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Upload className="w-3 h-3" />
                Mis Fotos / Subidas ({customTextures.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-1.5 text-center text-xs font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'presets'
                    ? 'border-[#f0a144] text-[#f0a144]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                Catálogo Vetas & Maderas ({presets.length})
              </button>
            </div>

            {/* TAB: Upload Custom Photos */}
            {activeTab === 'upload' && (
              <div className="space-y-2">
                {/* Upload Button */}
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/png, image/jpeg, image/webp, image/avif"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full py-2.5 px-3 rounded-lg border-2 border-dashed border-[#444444] hover:border-[#f0a144] bg-[#262626] hover:bg-[#2b2b2b] text-center transition-all group flex items-center justify-center gap-2 text-xs font-semibold text-gray-200"
                  >
                    <Upload className="w-4 h-4 text-[#f0a144] group-hover:scale-110 transition-transform" />
                    <span>{isUploading ? 'Procesando foto...' : '+ Subir Foto o Textura desde Dispositivo'}</span>
                  </button>
                  <p className="text-[9px] text-gray-400 text-center mt-1">
                    Formatos JPG, PNG o WebP. Ideal para fotos de melaminas, maderas o diseños propios.
                  </p>
                </div>

                {/* Uploaded Textures Grid */}
                {customTextures.length === 0 ? (
                  <div className="p-4 rounded-lg bg-[#242424] border border-[#333333] text-center text-gray-400 text-xs">
                    <p className="text-[11px]">No has subido ninguna imagen todavía.</p>
                    <p className="text-[9px] text-gray-500 mt-1">Sube una foto o explora el catálogo de maderas preconfiguradas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                    {customTextures.map(tex => (
                      <div
                        key={tex.id}
                        className="group relative rounded-lg border border-[#3a3a3a] overflow-hidden bg-[#2a2a2a] hover:border-[#f0a144] transition-all cursor-pointer"
                        onClick={() => applyTextureUrl(tex.url)}
                      >
                        <div className="aspect-square w-full relative overflow-hidden bg-black/40">
                          <img 
                            src={tex.url} 
                            alt={tex.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCustomTexture(tex.id);
                              setCustomTextures(getStoredCustomTextures());
                            }}
                            className="absolute top-1 right-1 p-1 rounded bg-black/70 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Eliminar de mi galería"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="p-1 text-[9px] font-semibold truncate text-gray-300 text-center">
                          {tex.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: Presets Catalog */}
            {activeTab === 'presets' && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                {presets.map(pre => (
                  <div
                    key={pre.id}
                    onClick={() => applyTextureUrl(pre.url)}
                    className="group rounded-lg border border-[#3a3a3a] overflow-hidden bg-[#252525] hover:border-[#f0a144] transition-all cursor-pointer p-1.5 flex items-center gap-2"
                  >
                    <div className="w-9 h-9 rounded overflow-hidden shrink-0 border border-black/30">
                      <img src={pre.url} alt={pre.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-white truncate">{pre.name}</div>
                      <div className="text-[8px] text-[#f0a144]">{pre.category}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: UV & Orientation Controls (Veta / Repetición) */}
          <div className="p-2.5 rounded-lg bg-[#242424] border border-[#333333] space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#f0a144]" />
              3. Orientación y Escala de la Textura / Veta:
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Rotation */}
              <div>
                <label className="text-[9px] text-gray-400 block mb-1">Rotación de veta:</label>
                <div className="flex gap-1">
                  {[0, 90, 180, 270].map(deg => (
                    <button
                      key={deg}
                      type="button"
                      onClick={() => handleConfigChange(repeatVal, deg)}
                      className={`flex-1 py-1 rounded text-[9px] font-mono font-bold transition-all ${
                        rotVal === deg
                          ? 'bg-[#f0a144] text-black'
                          : 'bg-[#333333] text-gray-300 hover:bg-[#444444]'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>

              {/* Repeat / Tiling */}
              <div>
                <label className="text-[9px] text-gray-400 block mb-1">Repetición / Escala:</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(rep => (
                    <button
                      key={rep}
                      type="button"
                      onClick={() => handleConfigChange(rep, rotVal)}
                      className={`flex-1 py-1 rounded text-[9px] font-mono font-bold transition-all ${
                        repeatVal === rep
                          ? 'bg-[#f0a144] text-black'
                          : 'bg-[#333333] text-gray-300 hover:bg-[#444444]'
                      }`}
                    >
                      {rep}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-2 border-t border-[#2e2e2e] bg-[#222222] flex items-center justify-between">
          <div className="text-[9px] text-gray-400">
            {selectedFace === 'all' ? (
              <span>Modo: <b className="text-white">Todas las caras</b></span>
            ) : (
              <span>Cara activa: <b className="text-[#f0a144]">{FACE_DEFINITIONS.find(f => f.key === selectedFace)?.label}</b></span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-[#f0a144] text-black font-bold text-xs hover:bg-[#e09438] transition-colors shadow"
          >
            Listo / Aplicar
          </button>
        </div>

      </div>
    </div>
  );
}
