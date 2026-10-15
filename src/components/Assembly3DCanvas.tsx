import React, { useRef, useMemo, useEffect, useState, useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Piece } from '../types';
import { AssemblyStep } from '../lib/assemblyPlanner';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import { 
  RotateCcw, 
  Maximize2, 
  Layers, 
  Ruler, 
  Eye, 
  Sparkles,
  Camera,
  Play,
  Pause
} from 'lucide-react';

interface Assembly3DCanvasProps {
  pieces: Piece[];
  currentStep: AssemblyStep | null;
  allSteps: AssemblyStep[];
  stepIndex: number;
  explodeRatio: number;
  onExplodeChange: (val: number) => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  highlightedPieceId: string | null;
  onSelectPiece: (pieceId: string) => void;
  assembledPieceIds: Set<string>;
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

/**
 * Renders an animated piece mesh in the assembly view
 */
function AssemblyPieceMesh({
  piece,
  isCurrentStepPiece,
  isAssembled,
  isHighlighted,
  explodeRatio,
  onSelect
}: {
  piece: Piece;
  isCurrentStepPiece: boolean;
  isAssembled: boolean;
  isHighlighted: boolean;
  explodeRatio: number;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Compute exploded displacement vector
  const effectivePos = useMemo<[number, number, number]>(() => {
    const orig = piece.position3D || [0, 0, 0];
    if (explodeRatio <= 0.001) return orig;

    const mult = explodeRatio * 1.8;
    const offsetX = orig[0] * (1 + mult * 0.7) + (orig[0] === 0 ? 0 : Math.sign(orig[0]) * explodeRatio * 70);
    const offsetY = orig[1] * (1 + mult * 0.7) + (orig[1] === 0 ? 0 : Math.sign(orig[1]) * explodeRatio * 70);
    const offsetZ = orig[2] * (1 + mult * 0.7) + (orig[2] === 0 ? 0 : Math.sign(orig[2]) * explodeRatio * 70);

    return [offsetX, offsetY, offsetZ];
  }, [piece.position3D, explodeRatio]);

  const args = useMemo<[number, number, number]>(() => {
    return [
      Math.max(1, piece.largo || 100), 
      Math.max(1, piece.espesor || 18), 
      Math.max(1, piece.ancho || 100)
    ];
  }, [piece.largo, piece.espesor, piece.ancho]);

  // Color logic according to assembly state
  const { color, emissive, emissiveIntensity, opacity, transparent } = useMemo(() => {
    if (isHighlighted) {
      return { color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.6, opacity: 1, transparent: false };
    }
    if (hovered) {
      return { color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.4, opacity: 1, transparent: false };
    }
    if (isCurrentStepPiece) {
      // Step pieces highlighted in active emerald
      return { color: '#10b981', emissive: '#059669', emissiveIntensity: 0.5, opacity: 1, transparent: false };
    }
    if (isAssembled) {
      // Normal wood or solid material color
      const base = piece.customColor || (piece.material && COLOR_PALETTE[piece.material]) || '#c8a882';
      return { color: base, emissive: '#000000', emissiveIntensity: 0, opacity: 0.95, transparent: false };
    }
    // Future pieces that haven't been assembled yet: ghosted wireframe / translucent
    return { color: '#6b7280', emissive: '#000000', emissiveIntensity: 0, opacity: 0.25, transparent: true };
  }, [isHighlighted, hovered, isCurrentStepPiece, isAssembled, piece.customColor, piece.material]);

  return (
    <mesh
      position={effectivePos}
      rotation={piece.rotation3D || [0, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(piece.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      castShadow={!transparent}
      receiveShadow={!transparent}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        metalness={0.1}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
        transparent={transparent}
        opacity={opacity}
      />
      <Edges
        scale={1.001}
        threshold={15}
        color={isCurrentStepPiece ? '#34d399' : (isHighlighted ? '#fbbf24' : (transparent ? '#4b5563' : '#1f2937'))}
      />
    </mesh>
  );
}

/**
 * 3D Dimension Indicator Line with Millimeter Tag
 */
function DimensionLine3D({
  start,
  end,
  label,
  valueMm,
  color = '#38bdf8'
}: {
  start: [number, number, number];
  end: [number, number, number];
  label: string;
  valueMm: number;
  color?: string;
}) {
  const linePoints = useMemo(() => {
    return [new THREE.Vector3(...start), new THREE.Vector3(...end)];
  }, [start, end]);

  const lineGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(linePoints);
    return geom;
  }, [linePoints]);

  const midPoint: [number, number, number] = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2
  ];

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                start[0], start[1], start[2],
                end[0], end[1], end[2]
              ]),
              3
            ]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={2} />
      </line>

      {/* Endpoint ticks */}
      <mesh position={start}>
        <sphereGeometry args={[6, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={end}>
        <sphereGeometry args={[6, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Floating 3D HTML Dimension Badge */}
      <Html position={midPoint} center distanceFactor={1200}>
        <div className="bg-[#111111]/95 text-white border border-[#38bdf8] px-2 py-0.5 rounded shadow-lg select-none pointer-events-none whitespace-nowrap text-[10px] font-mono flex items-center gap-1">
          <span className="text-[#38bdf8] font-bold">{label}:</span>
          <span className="font-extrabold text-amber-300">{Math.round(valueMm)} mm</span>
        </div>
      </Html>
    </group>
  );
}

/**
 * Centered scene group holding all pieces and dynamic dimension lines
 */
function AssemblyModelGroup({
  pieces,
  currentStep,
  assembledPieceIds,
  explodeRatio,
  showDimensions,
  highlightedPieceId,
  onSelectPiece
}: {
  pieces: Piece[];
  currentStep: AssemblyStep | null;
  assembledPieceIds: Set<string>;
  explodeRatio: number;
  showDimensions: boolean;
  highlightedPieceId: string | null;
  onSelectPiece: (id: string) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [modelBounds, setModelBounds] = useState<THREE.Box3 | null>(null);

  // Compute model center to keep it perfectly centered on the orbit target
  useLayoutEffect(() => {
    if (groupRef.current) {
      const box = new THREE.Box3().setFromObject(groupRef.current);
      const center = new THREE.Vector3();
      box.getCenter(center);
      groupRef.current.position.set(-center.x, -center.y, -center.z);
      setModelBounds(box);
    }
  }, [pieces, explodeRatio]);

  // Key piece sets
  const currentStepPieceIds = useMemo(() => {
    return new Set(currentStep?.pieceIds || []);
  }, [currentStep]);

  // Dynamic dimension lines for current step
  const dimensionLines = useMemo(() => {
    if (!showDimensions || !modelBounds) return [];

    const lines: Array<{
      id: string;
      start: [number, number, number];
      end: [number, number, number];
      label: string;
      valueMm: number;
      color?: string;
    }> = [];

    const size = new THREE.Vector3();
    modelBounds.getSize(size);
    const center = new THREE.Vector3();
    modelBounds.getCenter(center);

    const minX = -size.x / 2;
    const maxX = size.x / 2;
    const minY = -size.y / 2;
    const maxY = size.y / 2;
    const minZ = -size.z / 2;
    const maxZ = size.z / 2;

    const offsetOut = 40 + explodeRatio * 30;

    // 1. Overall Width (X) Dimension Line along the front bottom
    lines.push({
      id: 'dim-width',
      start: [minX, minY - offsetOut, maxZ + offsetOut],
      end: [maxX, minY - offsetOut, maxZ + offsetOut],
      label: 'Ancho Total',
      valueMm: Math.round(size.x),
      color: '#38bdf8'
    });

    // 2. Overall Height (Y) Dimension Line along the front right
    lines.push({
      id: 'dim-height',
      start: [maxX + offsetOut, minY, maxZ + offsetOut],
      end: [maxX + offsetOut, maxY, maxZ + offsetOut],
      label: 'Alto Total',
      valueMm: Math.round(size.y),
      color: '#10b981'
    });

    // 3. Overall Depth (Z) Dimension Line along the right side bottom
    lines.push({
      id: 'dim-depth',
      start: [maxX + offsetOut, minY - offsetOut, minZ],
      end: [maxX + offsetOut, minY - offsetOut, maxZ],
      label: 'Profundidad',
      valueMm: Math.round(size.z),
      color: '#f59e0b'
    });

    // 4. Step-specific annotations
    if (currentStep && currentStep.dimensionNotes.length > 0) {
      currentStep.dimensionNotes.forEach((dn, idx) => {
        if (dn.axis === 'Y') {
          // Internal height clearance
          lines.push({
            id: `step-dim-${idx}`,
            start: [0, -size.y / 4, 0],
            end: [0, size.y / 4, 0],
            label: dn.label,
            valueMm: dn.valueMm,
            color: '#a855f7'
          });
        }
      });
    }

    return lines;
  }, [showDimensions, modelBounds, currentStep, explodeRatio]);

  return (
    <group ref={groupRef}>
      {pieces.map((piece) => {
        const isCurrentStep = currentStepPieceIds.has(piece.id);
        const isAssembled = assembledPieceIds.has(piece.id);
        const isHighlighted = highlightedPieceId === piece.id;

        return (
          <AssemblyPieceMesh
            key={piece.id}
            piece={piece}
            isCurrentStepPiece={isCurrentStep}
            isAssembled={isAssembled}
            isHighlighted={isHighlighted}
            explodeRatio={explodeRatio}
            onSelect={onSelectPiece}
          />
        );
      })}

      {/* Render Dynamic 3D Dimensions */}
      {showDimensions && dimensionLines.map((line) => (
        <DimensionLine3D
          key={line.id}
          start={line.start}
          end={line.end}
          label={line.label}
          valueMm={line.valueMm}
          color={line.color}
        />
      ))}
    </group>
  );
}

function AssemblySceneContent({
  pieces,
  currentStep,
  assembledPieceIds,
  explodeRatio,
  showDimensions,
  highlightedPieceId,
  onSelectPiece,
  autoRotate
}: {
  pieces: Piece[];
  currentStep: AssemblyStep | null;
  assembledPieceIds: Set<string>;
  explodeRatio: number;
  showDimensions: boolean;
  highlightedPieceId: string | null;
  onSelectPiece: (id: string) => void;
  autoRotate: boolean;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  const maxDim = useMemo(() => {
    let m = 700;
    pieces.forEach(p => {
      m = Math.max(m, (p.largo || 0) * 1.5, (p.ancho || 0) * 1.5);
    });
    return m;
  }, [pieces]);

  useLayoutEffect(() => {
    camera.position.set(maxDim * 1.3, maxDim * 1.1, maxDim * 1.5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [camera, maxDim]);

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[maxDim * 2, maxDim * 2.5, maxDim * 1.8]} intensity={1.3} castShadow />
      <directionalLight position={[-maxDim * 2, maxDim * 1.5, -maxDim * 1.8]} intensity={0.6} />
      <directionalLight position={[0, -maxDim * 1.5, maxDim]} intensity={0.3} />

      <AssemblyModelGroup
        pieces={pieces}
        currentStep={currentStep}
        assembledPieceIds={assembledPieceIds}
        explodeRatio={explodeRatio}
        showDimensions={showDimensions}
        highlightedPieceId={highlightedPieceId}
        onSelectPiece={onSelectPiece}
      />

      <gridHelper args={[maxDim * 3, 20, '#333333', '#222222']} position={[0, -maxDim * 0.45, 0]} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={1.5}
        enablePan={true}
        enableZoom={true}
        enableDamping={true}
        dampingFactor={0.07}
        minDistance={maxDim * 0.3}
        maxDistance={maxDim * 6}
      />
    </>
  );
}

export const Assembly3DCanvas: React.FC<Assembly3DCanvasProps> = ({
  pieces,
  currentStep,
  allSteps,
  stepIndex,
  explodeRatio,
  onExplodeChange,
  showDimensions,
  onToggleDimensions,
  highlightedPieceId,
  onSelectPiece,
  assembledPieceIds
}) => {
  const [autoRotate, setAutoRotate] = useState(false);

  return (
    <div className="relative w-full h-full bg-[#121212] overflow-hidden select-none">
      <CanvasErrorBoundary>
        <Canvas
          shadows
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <AssemblySceneContent
            pieces={pieces}
            currentStep={currentStep}
            assembledPieceIds={assembledPieceIds}
            explodeRatio={explodeRatio}
            showDimensions={showDimensions}
            highlightedPieceId={highlightedPieceId}
            onSelectPiece={onSelectPiece}
            autoRotate={autoRotate}
          />
        </Canvas>
      </CanvasErrorBoundary>

      {/* Top Floating Viewport Control Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
        {/* Step indicator badge */}
        <div className="bg-[#1e1e1e]/90 backdrop-blur-md border border-[#333] px-3 py-1.5 rounded-lg flex items-center gap-2 pointer-events-auto shadow-xl">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-white tracking-wide">
            Paso {stepIndex + 1} de {Math.max(1, allSteps.length)}
          </span>
          <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
            ({currentStep?.pieceIds.length || 0} piezas en este paso)
          </span>
        </div>

        {/* Viewport tool actions */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Cotas Dinámicas Toggle */}
          <button
            type="button"
            onClick={onToggleDimensions}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border shadow-md ${
              showDimensions 
                ? 'bg-sky-950/80 text-sky-300 border-sky-500/50' 
                : 'bg-[#1e1e1e]/90 text-gray-300 border-[#333] hover:bg-[#2a2a2a]'
            }`}
            title="Mostrar / Ocultar Cotas Dinámicas en mm"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cotas 3D</span>
          </button>

          {/* Auto Rotate Toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-1.5 rounded-lg transition-colors border shadow-md ${
              autoRotate 
                ? 'bg-amber-950/80 text-amber-300 border-amber-500/50' 
                : 'bg-[#1e1e1e]/90 text-gray-300 border-[#333] hover:bg-[#2a2a2a]'
            }`}
            title="Giro automático 3D"
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Bottom Floating Explode / Despiece Slider */}
      <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 bg-[#1e1e1e]/90 backdrop-blur-md border border-[#333] p-2.5 rounded-xl shadow-2xl pointer-events-auto flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-gray-300 flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-400" /> Despiece / Explosión 3D
          </span>
          <span className="font-bold text-amber-400">{Math.round(explodeRatio * 100)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={explodeRatio}
            onChange={(e) => onExplodeChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#333] rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          {explodeRatio > 0 && (
            <button
              type="button"
              onClick={() => onExplodeChange(0)}
              className="text-[9px] text-gray-400 hover:text-white px-1.5 py-0.5 rounded bg-[#2a2a2a] border border-[#3a3a3a]"
              title="Restablecer ensamble compacto"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
