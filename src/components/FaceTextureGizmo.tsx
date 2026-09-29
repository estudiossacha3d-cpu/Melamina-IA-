import React, { useState } from 'react';
import { Html } from '@react-three/drei';
import { Palette } from 'lucide-react';
import { PieceFaceKey } from '../types';

interface FaceTextureGizmoProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  faceKey: PieceFaceKey;
  faceLabel?: string;
  faceShort?: string;
  isActive: boolean;
  isAllMode?: boolean;
  hasCustomTexture: boolean;
  texturePreviewUrl?: string | null;
  onSelect: (faceKey: PieceFaceKey) => void;
}

export const FaceTextureGizmo: React.FC<FaceTextureGizmoProps> = ({
  position,
  faceKey,
  isActive,
  hasCustomTexture,
  onSelect
}) => {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position}>
      <Html center style={{ pointerEvents: 'auto' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(faceKey);
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center cursor-pointer transition-all duration-150 shadow-md border select-none ${
            isActive
              ? 'bg-[#f0a144] text-black border-white ring-2 ring-[#f0a144] scale-110 z-20'
              : hasCustomTexture
                ? 'bg-[#10b981] text-white border-white/60 hover:scale-110'
                : 'bg-[#181818]/90 text-[#f0a144] hover:bg-[#f0a144] hover:text-black border-white/30 hover:border-[#f0a144] hover:scale-110'
          }`}
          title="Pintar esta cara"
        >
          <Palette className={`w-3.5 h-3.5 transition-transform duration-150 ${hovered ? 'scale-110 rotate-6' : ''}`} />
          {hasCustomTexture && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#10b981] ring-1 ring-white" />
          )}
        </button>
      </Html>
    </group>
  );
};

export default FaceTextureGizmo;
