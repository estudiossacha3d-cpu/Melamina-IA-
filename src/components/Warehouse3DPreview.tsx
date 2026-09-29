import React, { useRef, useMemo, useState, useEffect, useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { Piece } from '../types';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import { 
  RotateCcw, SlidersHorizontal
} from 'lucide-react';

interface Warehouse3DPreviewProps {
  pieces: Piece[];
  dimensions?: { width: number; height: number; depth: number };
  explodeRatio?: number;
  highlightedPieceId?: string | null;
  onSelectPiece?: (pieceId: string) => void;
  interactive?: boolean;
  autoRotate?: boolean;
  height?: number | string;
  showControls?: boolean;
}

const COLOR_PALETTE: Record<string, string> = {
  'Roble Natural': '#c8a882',
  'Coñac': '#8d5b36',
  'Macadamia': '#d5bca2',
  'Rovere': '#bfa58a',
  'Nogal': '#5a3d28',
  'Cedro': '#964b28',
  'Blanco': '#f0f0f2',
  'Blanco Humo': '#e5e7eb',
  'Gris Grafito': '#374151',
  'Negro': '#1f2937'
};

function PieceMesh({
  piece,
  explodeRatio = 0,
  isHighlighted = false,
  onSelect
}: {
  piece: Piece;
  explodeRatio: number;
  isHighlighted: boolean;
  onSelect?: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Offset outward from model origin when exploded
  const effectivePos = useMemo<[number, number, number]>(() => {
    const orig = piece.position3D || [0, 0, 0];
    if (explodeRatio <= 0.001) return orig;

    const mult = explodeRatio * 1.5;
    const offsetX = orig[0] * (1 + mult * 0.7) + (orig[0] === 0 ? 0 : Math.sign(orig[0]) * explodeRatio * 50);
    const offsetY = orig[1] * (1 + mult * 0.7) + (orig[1] === 0 ? 0 : Math.sign(orig[1]) * explodeRatio * 50);
    const offsetZ = orig[2] * (1 + mult * 0.7) + (orig[2] === 0 ? 0 : Math.sign(orig[2]) * explodeRatio * 50);

    return [offsetX, offsetY, offsetZ];
  }, [piece.position3D, explodeRatio]);

  const args = useMemo<[number, number, number]>(() => {
    return [
      Math.max(1, piece.largo || 100), 
      Math.max(1, piece.espesor || 18), 
      Math.max(1, piece.ancho || 100)
    ];
  }, [piece.largo, piece.espesor, piece.ancho]);

  const pieceColor = useMemo(() => {
    if (isHighlighted) return '#f0a144';
    if (hovered) return '#ffba66';
    if (piece.customColor) return piece.customColor;
    if (piece.material && COLOR_PALETTE[piece.material]) return COLOR_PALETTE[piece.material];
    return '#c4a482';
  }, [isHighlighted, hovered, piece.customColor, piece.material]);

  return (
    <mesh
      position={effectivePos}
      rotation={piece.rotation3D || [0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(piece.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      castShadow
      receiveShadow
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={pieceColor}
        roughness={isHighlighted ? 0.3 : 0.65}
        metalness={0.08}
        emissive={isHighlighted ? '#f0a144' : hovered ? '#b36b00' : '#000000'}
        emissiveIntensity={isHighlighted ? 0.45 : hovered ? 0.25 : 0}
      />
      <Edges
        scale={1.001}
        threshold={15}
        color={isHighlighted ? '#ffffff' : hovered ? '#f0a144' : '#1e1e1e'}
      />
    </mesh>
  );
}

function CenteredModelGroup({
  pieces,
  explodeRatio,
  highlightedPieceId,
  onSelectPiece
}: {
  pieces: Piece[];
  explodeRatio: number;
  highlightedPieceId?: string | null;
  onSelectPiece?: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);

  // Exact automatic world bounding-box centering
  useLayoutEffect(() => {
    if (groupRef.current) {
      const box = new THREE.Box3().setFromObject(groupRef.current);
      const c = new THREE.Vector3();
      box.getCenter(c);
      groupRef.current.position.set(-c.x, -c.y, -c.z);
    }
  }, [pieces, explodeRatio]);

  return (
    <group ref={groupRef}>
      {pieces.map((piece) => (
        <PieceMesh
          key={piece.id}
          piece={piece}
          explodeRatio={explodeRatio}
          isHighlighted={highlightedPieceId === piece.id}
          onSelect={onSelectPiece}
        />
      ))}
    </group>
  );
}

function SceneContent({
  pieces,
  maxDim,
  explodeRatio,
  highlightedPieceId,
  onSelectPiece,
  autoRotate
}: {
  pieces: Piece[];
  maxDim: number;
  explodeRatio: number;
  highlightedPieceId?: string | null;
  onSelectPiece?: (id: string) => void;
  autoRotate?: boolean;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Force camera to point dead-center on mount
  useLayoutEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera]);

  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[maxDim * 2, maxDim * 2.5, maxDim * 2]} intensity={1.2} />
      <directionalLight position={[-maxDim * 2, maxDim * 1.5, -maxDim * 2]} intensity={0.6} />
      <directionalLight position={[0, -maxDim, maxDim]} intensity={0.3} />

      <CenteredModelGroup
        pieces={pieces}
        explodeRatio={explodeRatio}
        highlightedPieceId={highlightedPieceId}
        onSelectPiece={onSelectPiece}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={2.2}
        enablePan={true}
        enableZoom={true}
        enableDamping={true}
        dampingFactor={0.08}
        minDistance={maxDim * 0.4}
        maxDistance={maxDim * 6}
      />
    </>
  );
}

export default function Warehouse3DPreview({
  pieces,
  dimensions,
  explodeRatio = 0,
  highlightedPieceId = null,
  onSelectPiece,
  interactive = true,
  autoRotate = false,
  height = '100%',
  showControls = false
}: Warehouse3DPreviewProps) {
  const [internalExplode, setInternalExplode] = useState(explodeRatio);
  const [internalAutoRotate, setInternalAutoRotate] = useState(autoRotate);

  useEffect(() => {
    setInternalExplode(explodeRatio);
  }, [explodeRatio]);

  const maxDim = useMemo(() => {
    if (dimensions) {
      return Math.max(dimensions.width, dimensions.height, dimensions.depth, 600);
    }
    let m = 600;
    pieces.forEach(p => {
      m = Math.max(m, p.largo || 0, p.ancho || 0, p.espesor || 0);
    });
    return m;
  }, [dimensions, pieces]);

  const cameraDistance = maxDim * 1.6;

  return (
    <div 
      className="w-full h-full relative select-none overflow-hidden bg-gradient-to-b from-[#161720] to-[#0c0d11]"
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <CanvasErrorBoundary>
        <Canvas
          camera={{
            position: [cameraDistance * 0.85, cameraDistance * 0.65, cameraDistance * 1.1],
            fov: 35,
            near: 1,
            far: cameraDistance * 20
          }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <SceneContent
            pieces={pieces}
            maxDim={maxDim}
            explodeRatio={internalExplode}
            highlightedPieceId={highlightedPieceId}
            onSelectPiece={onSelectPiece}
            autoRotate={internalAutoRotate}
          />
        </Canvas>
      </CanvasErrorBoundary>

      {/* Floating Toolbar for Inspector Modal */}
      {showControls && (
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-auto bg-[#14151a]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#2d303d] shadow-xl">
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#f0a144] shrink-0" />
            <span className="text-[10px] font-bold text-gray-300 shrink-0">Explosión 3D:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={internalExplode}
              onChange={(e) => setInternalExplode(parseFloat(e.target.value))}
              className="flex-1 h-1 bg-[#282a36] rounded-lg cursor-pointer appearance-none accent-[#f0a144]"
              title="Desarmar piezas en el espacio 3D"
            />
            <span className="text-[9px] font-mono font-bold text-[#f0a144] min-w-[32px] text-right">
              {Math.round(internalExplode * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setInternalAutoRotate(!internalAutoRotate)}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                internalAutoRotate
                  ? 'bg-[#f0a144]/20 border-[#f0a144] text-[#f0a144]'
                  : 'bg-[#1e2029] border-[#313545] text-gray-400 hover:text-white'
              }`}
              title="Giro automático 360°"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${internalAutoRotate ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setInternalExplode(0);
                setInternalAutoRotate(false);
              }}
              className="px-2 py-1 bg-[#1e2029] hover:bg-[#282b38] border border-[#313545] rounded-lg text-[9.5px] font-bold text-gray-300 hover:text-white transition-all cursor-pointer"
              title="Rearmar al 0%"
            >
              Rearmar (0%)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
