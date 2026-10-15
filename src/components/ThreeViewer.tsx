import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { MousePointerSquareDashed } from 'lucide-react';
import { Piece, EdgeThicknessConfig, PieceFaceKey, FaceTextureOptions, Group3D } from '../types';
import { getOrCreateThreeTexture, getPelikanoTextureUrl } from '../lib/textureManager';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import FaceTextureGizmo from './FaceTextureGizmo';
import { FredoScaleGizmo } from './FredoScaleGizmo';
import { FredoStretchAxis, FredoStretchMode, calculateFredoStretch } from '../lib/fredoStretch';
import { createGroovedPieceGeometry } from '../lib/pieceGeometry';

import { 
  MATERIAL_MAP, 
  MaterialDefinition, 
  getMaterialEmoji, 
  getGroupedMaterials, 
  getMaterialDefinition 
} from '../lib/materials';

export type { MaterialDefinition };
export { MATERIAL_MAP, getMaterialEmoji, getGroupedMaterials, getMaterialDefinition };

interface ThreeViewerProps {
  pieces: Piece[];
  selectedPieceIds: string[];
  groups?: Group3D[];
  onSelectPiece: (id: string | null, multi: boolean) => void;
  onUpdatePieceTransform: (id: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onUpdateMultiplePiecesTransform?: (updates: { id: string; position: [number, number, number]; rotation: [number, number, number] }[]) => void;
  onUpdatePieceScale?: (id: string, scaleX: number, scaleY: number, scaleZ: number) => void;
  onUpdatePieceDimensions?: (id: string, largo: number, espesor: number, ancho: number, dx: number, dy: number, dz: number) => void;
  onDoubleClickPiece?: (id: string) => void;
  onEditDimensionAxis?: (pieceId: string, axis: 'largo' | 'ancho' | 'espesor') => void;
  hide3DLabels?: boolean;
  transformMode?: 'translate' | 'rotate' | 'scale' | 'texture' | 'stretch';
  fredoAxis?: FredoStretchAxis;
  onChangeFredoAxis?: (axis: FredoStretchAxis) => void;
  fredoMode?: FredoStretchMode;
  onChangeFredoMode?: (mode: FredoStretchMode) => void;
  fredoPlaneRatio?: number;
  onChangeFredoPlaneRatio?: (ratio: number) => void;
  fredoPreviewDelta?: number;
  onChangeFredoPreviewDelta?: (delta: number) => void;
  onCommitFredoStretch?: (pieces: Piece[]) => void;
  dimensionSide?: 'pos' | 'neg';
  anchorMode?: 'single' | 'center';
  snapActive?: boolean;
  floorSnapActive?: boolean;
  pieceSnapActive?: boolean;
  onUnusedScale?: any;
  edgeThicknessConfig?: EdgeThicknessConfig;
  activeTextureFace?: PieceFaceKey | 'all';
  onSelectTextureFace?: (face: PieceFaceKey | 'all') => void;
  isTextureModalOpen?: boolean;
  onCanvasPointerDown?: () => void;
  editingGroupId?: string | null;
  isBoxSelectActive?: boolean;
  onToggleBoxSelect?: () => void;
  isBoxSelectAdditive?: boolean;
  onSelectPieceIds?: (ids: string[]) => void;
  onSelectAllPieces?: () => void;
  onClearSelection?: () => void;
}


const getGlobalHalfSizes = (
  rot: [number, number, number] | THREE.Euler,
  largoVal: number,
  espesorVal: number,
  anchoVal: number
) => {
  const euler = rot instanceof THREE.Euler ? rot : new THREE.Euler(rot[0], rot[1], rot[2]);
  const vX = new THREE.Vector3(1, 0, 0).applyEuler(euler);
  const vY = new THREE.Vector3(0, 1, 0).applyEuler(euler);
  const vZ = new THREE.Vector3(0, 0, 1).applyEuler(euler);

  const halfX = (Math.abs(vX.x) * largoVal + Math.abs(vY.x) * espesorVal + Math.abs(vZ.x) * anchoVal) * 0.001 / 2;
  const halfY = (Math.abs(vX.y) * largoVal + Math.abs(vY.y) * espesorVal + Math.abs(vZ.y) * anchoVal) * 0.001 / 2;
  const halfZ = (Math.abs(vX.z) * largoVal + Math.abs(vY.z) * espesorVal + Math.abs(vZ.z) * anchoVal) * 0.001 / 2;

  return new THREE.Vector3(
    Math.round(halfX * 100000) / 100000,
    Math.round(halfY * 100000) / 100000,
    Math.round(halfZ * 100000) / 100000
  );
};

interface DimensionHandleProps {
  position: [number, number, number];
  color: string;
  axis: 'largo' | 'ancho' | 'espesor';
  side: 'pos' | 'neg';
  isSnapped?: boolean;
  onStartDrag: (e: any, axis: 'largo' | 'ancho' | 'espesor', side: 'pos' | 'neg') => void;
  onSelectSide: (side: 'pos' | 'neg') => void;
}

const DimensionHandle: React.FC<DimensionHandleProps> = ({
  position,
  color,
  axis,
  side,
  isSnapped = false,
  onStartDrag,
  onSelectSide
}) => {
  const [hovered, setHovered] = useState(false);
  const hitMeshRef = useRef<THREE.Mesh>(null);

  // Top-priority raycasting override: assigns an ultra-near distance (0.000001) so R3F event processing
  // guarantees this handle always sorts first over any occluding panels, backboards (respaldos), or laterals.
  useEffect(() => {
    const mesh = hitMeshRef.current;
    if (!mesh) return;
    mesh.raycast = function(raycaster, intersects) {
      const localIntersects: THREE.Intersection[] = [];
      THREE.Mesh.prototype.raycast.call(this, raycaster, localIntersects);
      for (const hit of localIntersects) {
        hit.distance = 0.000001;
        intersects.push(hit);
      }
    };
  }, []);

  return (
    <group position={position}>
      {/* 1. Large touch & pointer hit zone (220mm, visible to Three.js raycaster, ultra-near distance) */}
      <mesh
        ref={hitMeshRef}
        renderOrder={10005}
        onClick={(e) => {
          e.stopPropagation();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          const domTarget = e.nativeEvent?.target as HTMLElement | undefined;
          try {
            domTarget?.setPointerCapture?.(e.pointerId);
          } catch {}
          onSelectSide(side);
          onStartDrag(e, axis, side);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor =
            axis === 'largo' ? 'ew-resize' : axis === 'espesor' ? 'ns-resize' : 'nesw-resize';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <boxGeometry args={[0.22, 0.22, 0.22]} />
        <meshBasicMaterial transparent opacity={0} depthTest={false} depthWrite={false} />
      </mesh>

      {/* Decorative visual meshes have raycast={() => null} so they never compete with or shadow the hit zone */}
      {/* Visual connector line to piece edge */}
      <mesh
        raycast={() => null}
        renderOrder={9997}
        position={[
          axis === 'largo' ? (side === 'pos' ? -0.015 : 0.015) : 0,
          axis === 'espesor' ? (side === 'pos' ? -0.015 : 0.015) : 0,
          axis === 'ancho' ? (side === 'pos' ? -0.015 : 0.015) : 0
        ]}
      >
        <boxGeometry
          args={[
            axis === 'largo' ? 0.03 : 0.0025,
            axis === 'espesor' ? 0.03 : 0.0025,
            axis === 'ancho' ? 0.03 : 0.0025
          ]}
        />
        <meshBasicMaterial
          color={isSnapped ? '#fbbf24' : color}
          opacity={isSnapped ? 0.95 : hovered ? 0.85 : 0.6}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </mesh>

      {/* X-Ray Ghost Pass: Always visible THROUGH any entity / board behind it */}
      <mesh
        raycast={() => null}
        scale={isSnapped ? [1.5, 1.5, 1.5] : hovered ? [1.35, 1.35, 1.35] : [1, 1, 1]}
        renderOrder={9998}
      >
        <boxGeometry args={[0.028, 0.028, 0.028]} />
        <meshBasicMaterial
          color={isSnapped ? '#fbbf24' : hovered ? '#ffffff' : color}
          transparent
          opacity={isSnapped ? 0.95 : hovered ? 0.95 : 0.75}
          depthTest={false}
          depthWrite={false}
        />
        <Edges
          scale={1.03}
          threshold={15}
          renderOrder={9999}
          color="#ffffff"
        />
      </mesh>

      {/* Solid Shaded Pass: 3D lighting when in direct line of sight */}
      <mesh
        raycast={() => null}
        scale={isSnapped ? [1.5, 1.5, 1.5] : hovered ? [1.35, 1.35, 1.35] : [1, 1, 1]}
        renderOrder={10000}
      >
        <boxGeometry args={[0.028, 0.028, 0.028]} />
        <meshStandardMaterial
          color={isSnapped ? '#fbbf24' : hovered ? '#ffffff' : color}
          emissive={isSnapped ? '#f59e0b' : hovered ? color : '#000000'}
          emissiveIntensity={isSnapped ? 0.95 : 0.6}
          roughness={0.2}
          metalness={0.25}
          depthTest={true}
        />
        <Edges
          scale={1.02}
          threshold={15}
          renderOrder={10001}
          color={isSnapped ? '#ffffff' : hovered ? '#ffffff' : '#000000'}
        />
      </mesh>

      {/* Hover / Snap target halo */}
      {(hovered || isSnapped) && (
        <mesh raycast={() => null} renderOrder={10002} scale={[1.8, 1.8, 1.8]}>
          <boxGeometry args={[0.03, 0.03, 0.03]} />
          <meshBasicMaterial
            color={isSnapped ? '#fbbf24' : '#ffffff'}
            wireframe
            depthTest={false}
            depthWrite={false}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
    </group>
  );
};

interface DimensionSnapResult {
  delta: number;
  isSnapped: boolean;
  targetPieceId: string | null;
  snapType?: 'step' | 'match' | 'face' | 'floor' | 'groove' | 'corner' | 'edge';
  snapLabel?: string;
  candidateId?: string;
}

function calculateDimensionSnap(
  axis: 'largo' | 'ancho' | 'espesor',
  side: 'pos' | 'neg',
  rawDeltaMm: number,
  startDim: number,
  isSymmetric: boolean,
  piece: Piece,
  allPieces: Piece[],
  group: THREE.Group,
  lastSnappedDelta?: number | null
): DimensionSnapResult {
  const minDim = axis === 'espesor' ? 1 : 10;
  const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  interface Candidate {
    id: string;
    delta: number;
    threshold: number;
    priority: number;
    targetPieceId: string | null;
    snapType: 'step' | 'match' | 'face' | 'floor' | 'groove' | 'corner' | 'edge';
    snapLabel?: string;
  }

  const rawCandidates: Candidate[] = [];

  // Direction along which the active face moves in world space
  const localVec = axis === 'largo'
    ? new THREE.Vector3(1, 0, 0)
    : axis === 'espesor'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  const worldAxis = localVec.clone().applyEuler(group.rotation).normalize();
  const sideMultiplier = side === 'pos' ? 1 : -1;
  const faceNormalWorld = worldAxis.clone().multiplyScalar(sideMultiplier);

  // Initial face position in world space
  const initialFaceLocal = new THREE.Vector3(0, 0, 0);
  if (axis === 'largo') initialFaceLocal.x = (sideMultiplier * startDim / 2) * 0.001;
  else if (axis === 'espesor') initialFaceLocal.y = (sideMultiplier * startDim / 2) * 0.001;
  else initialFaceLocal.z = (sideMultiplier * startDim / 2) * 0.001;
  const initialFaceWorld = group.localToWorld(initialFaceLocal.clone());

  // Growth factor: meters moved along faceNormalWorld per mm of dimension delta
  const factor = (isSymmetric ? 0.5 : 1.0) * 0.001;

  if (Math.abs(factor) > 0.00001) {
    // 1. Floor snap (when extending downwards toward Y=0)
    if (faceNormalWorld.y < -0.1) {
      const floorDeltaMm = (0 - initialFaceWorld.y) / (faceNormalWorld.y * factor);
      if (startDim + floorDeltaMm >= minDim) {
        rawCandidates.push({
          id: 'floor-y0',
          delta: Math.round(floorDeltaMm),
          threshold: isTouchDevice ? 32 : 22,
          priority: 10,
          targetPieceId: null,
          snapType: 'floor',
          snapLabel: 'Suelo (Y=0)'
        });
      }
    }

    const isPieceRespaldo = piece.name?.toLowerCase().includes('respaldo') ||
                            piece.name?.toLowerCase().includes('fondo') ||
                            piece.name?.toLowerCase().includes('back') ||
                            piece.espesor <= 6;

    // 2. Geometric Snapping against other pieces: FACES, CORNERS, EDGES, GROOVES
    for (const other of allPieces) {
      if (other.id === piece.id || other.hidden) continue;

      const otherCenter = new THREE.Vector3(
        other.position3D[0] * 0.001,
        other.position3D[1] * 0.001,
        other.position3D[2] * 0.001
      );

      // Only reject pieces that are unreasonably far in 3D space (> 4.5m)
      if (otherCenter.distanceTo(group.position) > 4.5) continue;

      const otherEuler = new THREE.Euler(other.rotation3D[0], other.rotation3D[1], other.rotation3D[2]);
      const oHalfX = (other.largo / 2) * 0.001;
      const oHalfY = (other.espesor / 2) * 0.001;
      const oHalfZ = (other.ancho / 2) * 0.001;

      const axisX = new THREE.Vector3(1, 0, 0).applyEuler(otherEuler).normalize();
      const axisY = new THREE.Vector3(0, 1, 0).applyEuler(otherEuler).normalize();
      const axisZ = new THREE.Vector3(0, 0, 1).applyEuler(otherEuler).normalize();

      const isOtherRespaldo = other.name?.toLowerCase().includes('respaldo') ||
                              other.name?.toLowerCase().includes('fondo') ||
                              other.name?.toLowerCase().includes('back') ||
                              other.espesor <= 6;

      // Respaldo snapping has the highest priority and generous magnetic threshold
      const isRespaldoMating = isPieceRespaldo || isOtherRespaldo;
      const basePriority = isRespaldoMating ? 16 : 12;
      const baseThreshold = isTouchDevice ? (isRespaldoMating ? 36 : 28) : (isRespaldoMating ? 26 : 20);

      // A) PARALLEL FACES OF OTHER PIECE (Direct Face-to-Face contact or flush alignment)
      const otherAxes = [
        { v: axisX, half: oHalfX, name: 'Lateral' },
        { v: axisY, half: oHalfY, name: 'Cara' },
        { v: axisZ, half: oHalfZ, name: 'Canto' }
      ];

      for (const ax of otherAxes) {
        const dot = ax.v.dot(faceNormalWorld);
        // Only consider faces whose normal is parallel to our moving face normal
        if (Math.abs(dot) > 0.8) {
          for (const s of [-1, 1]) {
            const facePoint = otherCenter.clone().addScaledVector(ax.v, s * ax.half);
            const worldDist = facePoint.sub(initialFaceWorld).dot(faceNormalWorld);
            const deltaMm = worldDist / factor;

            if (startDim + deltaMm < minDim) continue;

            const isContact = s * dot < 0; // Normals oppose: contact face
            const faceLabel = isOtherRespaldo
              ? (isContact ? `Cara interior Respaldo (${other.name})` : `Cara exterior Respaldo (${other.name})`)
              : (isContact ? `Cara interior (${other.name})` : `Cara exterior enrasada (${other.name})`);

            rawCandidates.push({
              id: `${other.id}-face-${ax.name}-${s}`,
              delta: Math.round(deltaMm),
              threshold: baseThreshold,
              priority: basePriority,
              targetPieceId: other.id,
              snapType: 'face',
              snapLabel: faceLabel
            });
          }
        }
      }

      // B) CORNERS AND PERIMETER EDGES (Vértices y Bordes)
      // Evaluate all 8 corners of other piece projected onto our face normal
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const cornerPoint = otherCenter.clone()
              .addScaledVector(axisX, sx * oHalfX)
              .addScaledVector(axisY, sy * oHalfY)
              .addScaledVector(axisZ, sz * oHalfZ);
            const cDist = cornerPoint.sub(initialFaceWorld).dot(faceNormalWorld);
            const cDeltaMm = cDist / factor;
            if (startDim + cDeltaMm >= minDim) {
              rawCandidates.push({
                id: `${other.id}-c-${sx}-${sy}-${sz}`,
                delta: Math.round(cDeltaMm),
                threshold: baseThreshold - 2,
                priority: basePriority - 2,
                targetPieceId: other.id,
                snapType: 'corner',
                snapLabel: isOtherRespaldo ? `Borde/Esquina Respaldo (${other.name})` : `Borde/Esquina (${other.name})`
              });
            }
          }
        }
      }

      // C) CNC GROOVE / RANURA TARGETS (for back panel insertion)
      if (other.ranurado && other.ranuraConfig) {
        const cfg = other.ranuraConfig;
        const gDist = (cfg.dist || 18) * 0.001;
        const gEsp = (cfg.esp || 4) * 0.001;
        const gProf = (cfg.prof || 8) * 0.001;

        if (cfg.lado === 'L2') {
          // Rear groove along -axisZ
          const gOuter = otherCenter.clone().addScaledVector(axisZ, -oHalfZ + gDist);
          const gInner = otherCenter.clone().addScaledVector(axisZ, -oHalfZ + gDist + gEsp);
          const gCenter = otherCenter.clone().addScaledVector(axisZ, -oHalfZ + gDist + gEsp / 2);

          const dOuter = (gOuter.sub(initialFaceWorld).dot(faceNormalWorld)) / factor;
          const dInner = (gInner.sub(initialFaceWorld).dot(faceNormalWorld)) / factor;
          const dCenter = (gCenter.sub(initialFaceWorld).dot(faceNormalWorld)) / factor;

          if (startDim + dOuter >= minDim) {
            rawCandidates.push({
              id: `${other.id}-groove-outer`,
              delta: Math.round(dOuter),
              threshold: baseThreshold + 2,
              priority: 18,
              targetPieceId: other.id,
              snapType: 'groove',
              snapLabel: `Ranura exterior (${other.name})`
            });
          }
          if (startDim + dInner >= minDim) {
            rawCandidates.push({
              id: `${other.id}-groove-inner`,
              delta: Math.round(dInner),
              threshold: baseThreshold + 2,
              priority: 18,
              targetPieceId: other.id,
              snapType: 'groove',
              snapLabel: `Ranura interior (${other.name})`
            });
          }
          if (startDim + dCenter >= minDim) {
            rawCandidates.push({
              id: `${other.id}-groove-center`,
              delta: Math.round(dCenter),
              threshold: baseThreshold + 4,
              priority: 19,
              targetPieceId: other.id,
              snapType: 'groove',
              snapLabel: `Fondo de ranura (${other.name})`
            });
          }

          // Groove bottom embedded in lateral wood
          for (const s of [-1, 1]) {
            const gBottom = otherCenter.clone().addScaledVector(axisX, s * (oHalfX - gProf));
            const dBottom = (gBottom.sub(initialFaceWorld).dot(faceNormalWorld)) / factor;
            if (startDim + dBottom >= minDim) {
              rawCandidates.push({
                id: `${other.id}-groove-bottom-${s}`,
                delta: Math.round(dBottom),
                threshold: baseThreshold + 2,
                priority: 19,
                targetPieceId: other.id,
                snapType: 'groove',
                snapLabel: `Fondo de ranura lateral (${other.name})`
              });
            }
          }
        }
      }
    }
  }

  // 3. Modular Steps (lowest priority, tight threshold, strictly secondary)
  if (axis === 'espesor') {
    const standardThicknesses = [3, 4, 5.5, 6, 9, 12, 15, 18, 19, 25, 30, 36];
    for (const th of standardThicknesses) {
      rawCandidates.push({
        id: `th-${th}`,
        delta: th - startDim,
        threshold: 4,
        priority: 3,
        targetPieceId: null,
        snapType: 'step',
        snapLabel: `Espesor ${th}mm`
      });
    }
  } else {
    const rawTargetDim = startDim + rawDeltaMm;
    const step10 = Math.round(rawTargetDim / 10) * 10;
    rawCandidates.push({
      id: `step10-${step10}`,
      delta: step10 - startDim,
      threshold: 3,
      priority: 1,
      targetPieceId: null,
      snapType: 'step',
      snapLabel: `${step10} mm (paso 10mm)`
    });

    const step50 = Math.round(rawTargetDim / 50) * 50;
    rawCandidates.push({
      id: `step50-${step50}`,
      delta: step50 - startDim,
      threshold: 5,
      priority: 2,
      targetPieceId: null,
      snapType: 'step',
      snapLabel: `${step50} mm (paso 50mm)`
    });
  }

  // 4. DEDUPLICATION: Merge candidates that share the same delta (within 1mm)
  // Keeps only the candidate with highest priority to prevent candidate collision and flickering
  const sortedRaw = [...rawCandidates].sort((a, b) => b.priority - a.priority);
  const candidates: Candidate[] = [];
  for (const cand of sortedRaw) {
    const duplicate = candidates.find(c => Math.abs(c.delta - cand.delta) <= 1);
    if (!duplicate) {
      candidates.push(cand);
    }
  }

  // 5. ROCK-SOLID DELTA HYSTERESIS (Anti-Flicker)
  // If previously snapped to a delta, stay locked until pulled past escape radius
  if (lastSnappedDelta !== null && lastSnappedDelta !== undefined) {
    const lockedCand = candidates.find(c => Math.abs(c.delta - lastSnappedDelta) <= 1.5);
    if (lockedCand) {
      const escapeThreshold = isTouchDevice ? 40 : 30;
      const diff = Math.abs(rawDeltaMm - lockedCand.delta);
      if (diff <= escapeThreshold) {
        return {
          delta: lockedCand.delta,
          isSnapped: true,
          targetPieceId: lockedCand.targetPieceId,
          snapType: lockedCand.snapType,
          snapLabel: lockedCand.snapLabel,
          candidateId: lockedCand.id
        };
      }
    }
  }

  // 6. Candidate Selection (Maximum priority and closest distance)
  let bestCandidate: Candidate | null = null;
  let minDiff = Infinity;
  let highestPriority = -1;

  for (const cand of candidates) {
    if (startDim + cand.delta < minDim) continue;
    const diff = Math.abs(rawDeltaMm - cand.delta);
    if (diff <= cand.threshold) {
      if (cand.priority > highestPriority || (cand.priority === highestPriority && diff < minDiff)) {
        highestPriority = cand.priority;
        minDiff = diff;
        bestCandidate = cand;
      }
    }
  }

  if (!bestCandidate) {
    return {
      delta: Math.round(rawDeltaMm),
      isSnapped: false,
      targetPieceId: null,
      candidateId: undefined
    };
  }

  return {
    delta: bestCandidate.delta,
    isSnapped: true,
    targetPieceId: bestCandidate.targetPieceId,
    snapType: bestCandidate.snapType,
    snapLabel: bestCandidate.snapLabel,
    candidateId: bestCandidate.id
  };
}


const MelaminePiece = ({
  piece,
  allPieces = [],
  isSelected,
  showControls,
  onClick,
  onTransformEnd,
  onUpdateDimensions,
  onDoubleClickPiece,
  onEditDimensionAxis,
  hide3DLabels = false,
  transformMode = 'translate',
  dimensionSide = 'pos',
  anchorMode = 'single',
  snapActive = false,
  floorSnapActive = true,
  pieceSnapActive = true,
  edgeThicknessConfig,
  activeTextureFace = 'all',
  onSelectTextureFace,
  isTextureModalOpen = false,
  registerPieceGroup
}: {
  piece: Piece;
  allPieces?: Piece[];
  isSelected: boolean;
  showControls: boolean;
  onClick: (e: any) => void;
  onTransformEnd: (pos: [number, number, number], rot: [number, number, number], scale: [number, number, number]) => void;
  onUpdateDimensions?: (dx: number, dy: number, dz: number, originOffset: [number, number, number]) => void;
  onDoubleClickPiece?: (id: string) => void;
  onEditDimensionAxis?: (pieceId: string, axis: 'largo' | 'ancho' | 'espesor') => void;
  hide3DLabels?: boolean;
  transformMode?: 'translate' | 'rotate' | 'scale' | 'texture' | 'stretch';
  dimensionSide?: 'pos' | 'neg';
  anchorMode?: 'single' | 'center';
  snapActive?: boolean;
  floorSnapActive?: boolean;
  pieceSnapActive?: boolean;
  edgeThicknessConfig?: EdgeThicknessConfig;
  activeTextureFace?: PieceFaceKey | 'all';
  onSelectTextureFace?: (face: PieceFaceKey | 'all') => void;
  isTextureModalOpen?: boolean;
  registerPieceGroup?: (pieceId: string, group: THREE.Group | null) => void;
}) => {
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const [group, setGroupState] = useState<THREE.Group | null>(null);
  const activeDragAxisRef = useRef<string | null>(null);
  const setGroup = useCallback((g: THREE.Group | null) => {
    setGroupState(g);
    if (registerPieceGroup) {
      registerPieceGroup(piece.id, g);
    }
  }, [piece.id, registerPieceGroup]);

  useEffect(() => {
    if (group && registerPieceGroup) {
      registerPieceGroup(piece.id, group);
    }
    return () => {
      if (registerPieceGroup) {
        registerPieceGroup(piece.id, null);
      }
    };
  }, [group, piece.id, registerPieceGroup]);

  const transformRef = useRef<any>(null);
  const initialPosRef = useRef(new THREE.Vector3());
  const initialRotRef = useRef(new THREE.Euler());
  const isDraggingRef = useRef(false);
  const [flash, setFlash] = useState(false);
  const [currentDims, setCurrentDims] = useState({
    largo: Math.round(piece.largo),
    ancho: Math.round(piece.ancho),
    espesor: Math.round(piece.espesor)
  });

  useEffect(() => {
    setCurrentDims({
      largo: Math.round(piece.largo),
      ancho: Math.round(piece.ancho),
      espesor: Math.round(piece.espesor)
    });
  }, [piece.largo, piece.ancho, piece.espesor]);

  // Keep mesh visual scale and position aligned with committed props
  useEffect(() => {
    if (mesh) {
      mesh.scale.set(1, 1, 1);
      mesh.position.set(0, 0, 0);
    }
  }, [piece.largo, piece.ancho, piece.espesor, piece.position3D, mesh]);

  const [isSnapTarget, setIsSnapTarget] = useState(false);
  const [isDraggingTranslate, setIsDraggingTranslate] = useState(false);
  const [displacement, setDisplacement] = useState<{ dx: number; dy: number; dz: number; dist: number } | null>(null);

  const [activeSnapHandle, setActiveSnapHandle] = useState<{ axis: string; side: string } | null>(null);
  const activeSnapHandleRef = useRef<{ axis: string; side: string } | null>(null);
  const wasSnappedRef = useRef(false);
  const lastSnappedDeltaRef = useRef<number | null>(null);
  const lastSnapTargetIdRef = useRef<string | null>(null);

  const isDimensionDraggingRef = useRef(false);
  const dragScaleRef = useRef<[number, number, number]>([1, 1, 1]);
  const dragPosRef = useRef<[number, number, number]>([0, 0, 0]);

  // Anti-flicker: guarantees mesh keeps its live dragged scale and position on EVERY rendered Three.js frame,
  // preventing React reconciliation from resetting mesh.position or scale between frames!
  useFrame(() => {
    if (isDimensionDraggingRef.current && mesh) {
      mesh.scale.set(dragScaleRef.current[0], dragScaleRef.current[1], dragScaleRef.current[2]);
      mesh.position.set(dragPosRef.current[0], dragPosRef.current[1], dragPosRef.current[2]);
    }
  });

  const { camera, raycaster, gl, invalidate } = useThree();
  const orbitControls = useThree((state) => state.controls) as any;
  const [currentDimensionSide, setCurrentDimensionSide] = useState<'pos' | 'neg'>(dimensionSide || 'pos');

  useEffect(() => {
    if (dimensionSide) {
      setCurrentDimensionSide(dimensionSide);
    }
  }, [dimensionSide]);

  // Handle direct dragging on 3D boundary handles (Largo / Ancho / Espesor on both positive and negative sides)
  const handleStartHandleDrag = (e: any, axis: 'largo' | 'ancho' | 'espesor', side: 'pos' | 'neg') => {
    if (!group || !mesh) return;

    if (orbitControls) {
      orbitControls.enabled = false;
    }

    setCurrentDimensionSide(side);
    isDimensionDraggingRef.current = true;
    wasSnappedRef.current = false;
    lastSnappedDeltaRef.current = null;
    lastSnapTargetIdRef.current = null;
    activeSnapHandleRef.current = null;
    dragScaleRef.current = [1, 1, 1];
    dragPosRef.current = [0, 0, 0];

    const startLargo = piece.largo;
    const startAncho = piece.ancho;
    const startEspesor = piece.espesor;

    // Stable 3D Axis Vector:
    const localAxis = axis === 'largo'
      ? new THREE.Vector3(1, 0, 0)
      : axis === 'espesor'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
    const worldAxis = localAxis.clone().applyEuler(group.rotation).normalize();

    // The line passes through the handle's initial position in world space:
    const handleInitialLocal = new THREE.Vector3(
      axis === 'largo' ? (side === 'pos' ? 1 : -1) * (startLargo * scale) / 2 : 0,
      axis === 'espesor' ? (side === 'pos' ? 1 : -1) * (startEspesor * scale) / 2 : 0,
      axis === 'ancho' ? (side === 'pos' ? 1 : -1) * (startAncho * scale) / 2 : 0
    );
    const P0 = group.localToWorld(handleInitialLocal.clone());
    const v = worldAxis.clone().normalize();

    // Stable Drag Plane Projection (CAD Industry Standard):
    // Construct a plane containing world axis `v` through P0 that faces the camera.
    // This provides 100% smooth, continuous, linear tracking with zero singularities or jitter!
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    let planeNormal = new THREE.Vector3().crossVectors(v, camDir).normalize();
    if (planeNormal.lengthSq() < 0.001) {
      planeNormal = new THREE.Vector3().crossVectors(v, camera.up).normalize();
    }
    planeNormal.cross(v).normalize();
    // Ensure plane normal faces camera
    if (planeNormal.dot(camera.position.clone().sub(P0)) < 0) {
      planeNormal.negate();
    }
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, P0);

    const projectNdcToAxisT = (ndcX: number, ndcY: number): number => {
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, hit)) {
        return hit.sub(P0).dot(v);
      }
      // Fallback: camera-facing plane through P0
      const fallbackPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir.clone().negate(), P0);
      if (raycaster.ray.intersectPlane(fallbackPlane, hit)) {
        return hit.sub(P0).dot(v);
      }
      return 0;
    };

    const nativeEvt = e.nativeEvent || e;
    const clientX0 = nativeEvt.clientX !== undefined ? nativeEvt.clientX : 0;
    const clientY0 = nativeEvt.clientY !== undefined ? nativeEvt.clientY : 0;
    const rect = gl.domElement.getBoundingClientRect();
    const ndcX0 = ((clientX0 - rect.left) / rect.width) * 2 - 1;
    const ndcY0 = -(((clientY0 - rect.top) / rect.height) * 2 - 1);
    const initialT = projectNdcToAxisT(ndcX0, ndcY0);

    let lastDLargo = 0;
    let lastDAncho = 0;
    let lastDEspesor = 0;
    let isSymmetric = anchorMode === 'center';

    window.dispatchEvent(new CustomEvent('piece-scaling-update', {
      detail: {
        largo: Math.round(startLargo),
        ancho: Math.round(startAncho),
        espesor: Math.round(startEspesor),
        axis,
        delta: 0,
        isDragging: true,
        isSnapped: false,
        pieceId: piece.id
      }
    }));

    let rafMoveId: number | null = null;
    const onPointerMove = (moveEvt: PointerEvent) => {
      if (!group || !mesh) return;

      isSymmetric = moveEvt.altKey || anchorMode === 'center';

      const clientX = moveEvt.clientX;
      const clientY = moveEvt.clientY;
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const currentT = projectNdcToAxisT(ndcX, ndcY);

      const deltaMeters = currentT - initialT;
      // When side === 'pos', moving along +worldAxis expands piece.
      // When side === 'neg', moving along -worldAxis expands piece.
      const rawDeltaMm = (side === 'pos' ? deltaMeters : -deltaMeters) / scale;
      const startDim = axis === 'largo' ? startLargo : (axis === 'ancho' ? startAncho : startEspesor);

      const snapResult = snapActive
        ? calculateDimensionSnap(axis, side, rawDeltaMm, startDim, isSymmetric, piece, allPieces, group, lastSnappedDeltaRef.current)
        : { delta: Math.round(rawDeltaMm), isSnapped: false, targetPieceId: null };

      lastSnappedDeltaRef.current = snapResult.isSnapped ? snapResult.delta : null;
      const effectiveDelta = snapResult.delta;

      // Haptic feedback and visual magnet state on mobile / touch
      if (snapResult.isSnapped && !wasSnappedRef.current) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(15); } catch {}
        }
      }
      wasSnappedRef.current = snapResult.isSnapped;

      // Anti-flicker: only dispatch piece-snap-target when target actually changes
      if (lastSnapTargetIdRef.current !== snapResult.targetPieceId) {
        lastSnapTargetIdRef.current = snapResult.targetPieceId;
        window.dispatchEvent(new CustomEvent('piece-snap-target', {
          detail: { active: !!snapResult.targetPieceId, targetId: snapResult.targetPieceId }
        }));
      }

      // Anti-flicker: Only update React state when snap status transitions to avoid 120 re-renders/sec
      const isNowSnapped = snapResult.isSnapped;
      const currentlyActive = activeSnapHandleRef.current;
      const shouldBeActive = isNowSnapped ? `${axis}-${side}` : null;
      const currentActiveKey = currentlyActive ? `${currentlyActive.axis}-${currentlyActive.side}` : null;

      if (shouldBeActive !== currentActiveKey) {
        activeSnapHandleRef.current = isNowSnapped ? { axis, side } : null;
        setActiveSnapHandle(activeSnapHandleRef.current);
      }

      if (axis === 'largo') {
        lastDLargo = effectiveDelta;
        const scaleFactorX = Math.max(0.01, (startLargo + effectiveDelta) / startLargo);
        dragScaleRef.current = [scaleFactorX, 1, 1];
        if (isSymmetric) {
          dragPosRef.current = [0, 0, 0];
        } else {
          const sign = side === 'neg' ? -1 : 1;
          dragPosRef.current = [((sign * effectiveDelta / 2) * scale), 0, 0];
        }
        mesh.scale.set(dragScaleRef.current[0], dragScaleRef.current[1], dragScaleRef.current[2]);
        mesh.position.set(dragPosRef.current[0], dragPosRef.current[1], dragPosRef.current[2]);

        if (rafMoveId === null) {
          rafMoveId = requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('piece-scaling-update', {
              detail: {
                largo: Math.max(10, Math.round(startLargo + effectiveDelta)),
                espesor: Math.round(piece.espesor),
                ancho: Math.round(piece.ancho),
                axis: 'largo',
                delta: effectiveDelta,
                isDragging: true,
                isSnapped: snapResult.isSnapped,
                snapLabel: snapResult.snapLabel,
                pieceId: piece.id
              }
            }));
            rafMoveId = null;
          });
        }
      } else if (axis === 'ancho') {
        lastDAncho = effectiveDelta;
        const scaleFactorZ = Math.max(0.01, (startAncho + effectiveDelta) / startAncho);
        dragScaleRef.current = [1, 1, scaleFactorZ];
        if (isSymmetric) {
          dragPosRef.current = [0, 0, 0];
        } else {
          const sign = side === 'neg' ? -1 : 1;
          dragPosRef.current = [0, 0, ((sign * effectiveDelta / 2) * scale)];
        }
        mesh.scale.set(dragScaleRef.current[0], dragScaleRef.current[1], dragScaleRef.current[2]);
        mesh.position.set(dragPosRef.current[0], dragPosRef.current[1], dragPosRef.current[2]);

        if (rafMoveId === null) {
          rafMoveId = requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('piece-scaling-update', {
              detail: {
                largo: Math.round(piece.largo),
                espesor: Math.round(piece.espesor),
                ancho: Math.max(10, Math.round(startAncho + effectiveDelta)),
                axis: 'ancho',
                delta: effectiveDelta,
                isDragging: true,
                isSnapped: snapResult.isSnapped,
                snapLabel: snapResult.snapLabel,
                pieceId: piece.id
              }
            }));
            rafMoveId = null;
          });
        }
      } else if (axis === 'espesor') {
        lastDEspesor = effectiveDelta;
        const scaleFactorY = Math.max(0.01, (startEspesor + effectiveDelta) / startEspesor);
        dragScaleRef.current = [1, scaleFactorY, 1];
        if (isSymmetric) {
          dragPosRef.current = [0, 0, 0];
        } else {
          const sign = side === 'neg' ? -1 : 1;
          dragPosRef.current = [0, ((sign * effectiveDelta / 2) * scale), 0];
        }
        mesh.scale.set(dragScaleRef.current[0], dragScaleRef.current[1], dragScaleRef.current[2]);
        mesh.position.set(dragPosRef.current[0], dragPosRef.current[1], dragPosRef.current[2]);

        if (rafMoveId === null) {
          rafMoveId = requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('piece-scaling-update', {
              detail: {
                largo: Math.round(piece.largo),
                espesor: Math.max(1, Math.round(startEspesor + effectiveDelta)),
                ancho: Math.round(piece.ancho),
                axis: 'espesor',
                delta: effectiveDelta,
                isDragging: true,
                isSnapped: snapResult.isSnapped,
                snapLabel: snapResult.snapLabel,
                pieceId: piece.id
              }
            }));
            rafMoveId = null;
          });
        }
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      isDimensionDraggingRef.current = false;
      dragScaleRef.current = [1, 1, 1];
      dragPosRef.current = [0, 0, 0];
      activeSnapHandleRef.current = null;
      setActiveSnapHandle(null);
      wasSnappedRef.current = false;
      lastSnappedDeltaRef.current = null;
      lastSnapTargetIdRef.current = null;
      window.dispatchEvent(new CustomEvent('piece-snap-target', { detail: { active: false, targetId: null } }));

      if (orbitControls) {
        orbitControls.enabled = true;
      }

      // Calculate local shift in local piece space (in meters)
      let localShift = new THREE.Vector3(0, 0, 0);
      if (!isSymmetric) {
        const sign = side === 'neg' ? -1 : 1;
        localShift = new THREE.Vector3(
          axis === 'largo' ? sign * (lastDLargo / 2) * scale : 0,
          axis === 'espesor' ? sign * (lastDEspesor / 2) * scale : 0,
          axis === 'ancho' ? sign * (lastDAncho / 2) * scale : 0
        );
      }

      // Pass localShift directly. App.tsx applies rotation matrix ONCE to world coordinates.
      // This prevents double-rotation bugs and prevents the piece from jumping or shifting erroneously.
      if (onUpdateDimensions && (lastDLargo !== 0 || lastDEspesor !== 0 || lastDAncho !== 0)) {
        onUpdateDimensions(lastDLargo, lastDEspesor, lastDAncho, [localShift.x, localShift.y, localShift.z]);
      }
      const finalDelta = axis === 'largo' ? lastDLargo : (axis === 'ancho' ? lastDAncho : lastDEspesor);
      window.dispatchEvent(new CustomEvent('piece-scaling-update', { 
        detail: {
          largo: Math.round(piece.largo + lastDLargo),
          ancho: Math.round(piece.ancho + lastDAncho),
          espesor: Math.round(piece.espesor + lastDEspesor),
          axis,
          delta: finalDelta,
          isDragging: false,
          isSnapped: false,
          pieceId: piece.id
        }
      }));
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  useEffect(() => {
    const handleSnapTarget = (e: any) => {
      if (e.detail && e.detail.active && e.detail.targetId === piece.id) {
        setIsSnapTarget(true);
      } else {
        setIsSnapTarget(false);
      }
    };
    window.addEventListener('piece-snap-target', handleSnapTarget);
    return () => window.removeEventListener('piece-snap-target', handleSnapTarget);
  }, [piece.id]);

  useEffect(() => {
    const handleSnapFlash = (e: any) => {
      if (e.detail && e.detail.targetId === piece.id) {
        triggerSnapFlash();
      }
    };
    window.addEventListener('piece-snap-flash', handleSnapFlash);
    return () => window.removeEventListener('piece-snap-flash', handleSnapFlash);
  }, [piece.id]);

  const [controlsSize, setControlsSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 1.2 : 0.9;
    }
    return 0.9;
  });

  useEffect(() => {
    const handleResize = () => {
      setControlsSize(window.innerWidth < 768 ? 1.2 : 0.9);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Convert mm to meters for ThreeJS to keep scales manageable (1000mm = 1 unit)
  const scale = 0.001; 
  const dims: [number, number, number] = [
    piece.largo * scale,
    piece.espesor * scale,
    piece.ancho * scale,
  ];

  const pos: [number, number, number] = [
    piece.position3D[0] * scale,
    piece.position3D[1] * scale,
    piece.position3D[2] * scale,
  ];

  const myHalf = getGlobalHalfSizes(piece.rotation3D, piece.largo, piece.espesor, piece.ancho);

  const triggerSnapFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
  };

  const getSnappedPosition = (targetPos: THREE.Vector3, currentAxis?: string | null) => {
    let finalPos = targetPos.clone();
    let snapped = false;
    let targetPieceId: string | null = null;
    let isFloorSnapped = false;

    if (transformMode !== 'translate') {
      return { finalPos, snapped, targetPieceId, isFloorSnapped };
    }

    const effectivePieceSnap = pieceSnapActive !== undefined ? pieceSnapActive : snapActive;
    const effectiveFloorSnap = floorSnapActive !== undefined ? floorSnapActive : snapActive;

    // Detect active drag axes so non-dragged axes are firmly locked and cannot jitter or fight
    let canMoveX = true;
    let canMoveY = true;
    let canMoveZ = true;

    if (currentAxis) {
      const normAxis = currentAxis.toUpperCase();
      if (normAxis === 'X') {
        canMoveX = true; canMoveY = false; canMoveZ = false;
      } else if (normAxis === 'Y') {
        canMoveX = false; canMoveY = true; canMoveZ = false;
      } else if (normAxis === 'Z') {
        canMoveX = false; canMoveY = false; canMoveZ = true;
      } else if (normAxis === 'XZ') {
        canMoveX = true; canMoveY = false; canMoveZ = true;
      } else if (normAxis === 'XY') {
        canMoveX = true; canMoveY = true; canMoveZ = false;
      } else if (normAxis === 'YZ') {
        canMoveX = false; canMoveY = true; canMoveZ = true;
      }
    } else if (initialPosRef.current) {
      // Fallback check against initial position during drag
      const deltaX = Math.abs(targetPos.x - initialPosRef.current.x);
      const deltaY = Math.abs(targetPos.y - initialPosRef.current.y);
      const deltaZ = Math.abs(targetPos.z - initialPosRef.current.z);
      if (deltaX > 0.0005 && deltaY < 0.00005 && deltaZ < 0.00005) {
        canMoveX = true; canMoveY = false; canMoveZ = false;
      } else if (deltaY > 0.0005 && deltaX < 0.00005 && deltaZ < 0.00005) {
        canMoveX = false; canMoveY = true; canMoveZ = false;
      } else if (deltaZ > 0.0005 && deltaX < 0.00005 && deltaY < 0.00005) {
        canMoveX = false; canMoveY = false; canMoveZ = true;
      }
    }

    // Strictly lock non-active axes to prevent cross-axis jumping or accidental floor/piece conflicts
    if (!canMoveX && initialPosRef.current) finalPos.x = initialPosRef.current.x;
    if (!canMoveY && initialPosRef.current) finalPos.y = initialPosRef.current.y;
    if (!canMoveZ && initialPosRef.current) finalPos.z = initialPosRef.current.z;

    const snapThreshold = 0.025; // 25mm magnet snap range
    const floorSnapThreshold = 0.03; // 30mm magnet snap range for floor

    let bestX = finalPos.x;
    let minDiffX = snapThreshold;
    let snapTargetIdX: string | null = null;

    let bestY = finalPos.y;
    let minDiffY = snapThreshold;
    let snapTargetIdY: string | null = null;

    let bestZ = finalPos.z;
    let minDiffZ = snapThreshold;
    let snapTargetIdZ: string | null = null;

    // Floor snap candidate (only evaluated if Y can move and floor snap is active)
    let floorCandidateY: number | null = null;
    let floorDiff = Infinity;
    if (effectiveFloorSnap && canMoveY) {
      floorDiff = Math.abs(finalPos.y - myHalf.y);
      if (floorDiff <= floorSnapThreshold || finalPos.y < myHalf.y) {
        floorCandidateY = myHalf.y;
      }
    }

    // 1) Magnetic Snap Candidates against other pieces
    if (effectivePieceSnap && allPieces && allPieces.length > 1) {
      for (const other of allPieces) {
        if (other.id === piece.id || other.hidden) continue;

        const otherCenter = new THREE.Vector3(
          other.position3D[0] * scale,
          other.position3D[1] * scale,
          other.position3D[2] * scale
        );
        const otherHalf = getGlobalHalfSizes(other.rotation3D, other.largo, other.espesor, other.ancho);

        // Compute minimum gap distance between bounding boxes
        const gapX = Math.max(0, Math.abs(finalPos.x - otherCenter.x) - (myHalf.x + otherHalf.x));
        const gapY = Math.max(0, Math.abs(finalPos.y - otherCenter.y) - (myHalf.y + otherHalf.y));
        const gapZ = Math.max(0, Math.abs(finalPos.z - otherCenter.z) - (myHalf.z + otherHalf.z));

        const dist = Math.sqrt(gapX * gapX + gapY * gapY + gapZ * gapZ);

        // If nearby (within 250mm gap)
        if (dist < 0.25) {
          if (canMoveX) {
            // X Candidates: Contact faces, Flush edges, Center
            const candidatesX = [
              otherCenter.x - otherHalf.x - myHalf.x, // Contact Right-to-Left face
              otherCenter.x + otherHalf.x + myHalf.x, // Contact Left-to-Right face
              otherCenter.x - otherHalf.x + myHalf.x, // Flush Left face
              otherCenter.x + otherHalf.x - myHalf.x, // Flush Right face
              otherCenter.x                           // Align Center X
            ];
            for (const val of candidatesX) {
              const diff = Math.abs(finalPos.x - val);
              if (diff < minDiffX) {
                minDiffX = diff;
                bestX = val;
                snapTargetIdX = other.id;
              }
            }
          }

          if (canMoveY) {
            // Y Candidates: Contact faces, Flush edges, Center
            const candidatesY = [
              otherCenter.y - otherHalf.y - myHalf.y, // Contact Top-to-Bottom face
              otherCenter.y + otherHalf.y + myHalf.y, // Contact Bottom-to-Top face
              otherCenter.y - otherHalf.y + myHalf.y, // Flush Bottom face
              otherCenter.y + otherHalf.y - myHalf.y, // Flush Top face
              otherCenter.y                           // Align Center Y
            ];
            for (const val of candidatesY) {
              const diff = Math.abs(finalPos.y - val);
              if (diff < minDiffY) {
                minDiffY = diff;
                bestY = val;
                snapTargetIdY = other.id;
              }
            }
          }

          if (canMoveZ) {
            // Z Candidates: Contact faces, Flush edges, Center
            const candidatesZ = [
              otherCenter.z - otherHalf.z - myHalf.z, // Contact Front-to-Back face
              otherCenter.z + otherHalf.z + myHalf.z, // Contact Back-to-Front face
              otherCenter.z - otherHalf.z + myHalf.z, // Flush Back face
              otherCenter.z + otherHalf.z - myHalf.z, // Flush Front face
              otherCenter.z                           // Align Center Z
            ];
            for (const val of candidatesZ) {
              const diff = Math.abs(finalPos.z - val);
              if (diff < minDiffZ) {
                minDiffZ = diff;
                bestZ = val;
                snapTargetIdZ = other.id;
              }
            }
          }
        }
      }
    }

    // Harmonize Y between Piece Snap and Floor Snap without conflicts
    if (canMoveY) {
      if (floorCandidateY !== null && effectiveFloorSnap) {
        if (snapTargetIdY && minDiffY < snapThreshold) {
          // If piece snap candidate is closer to current pos than floor, snap to piece; otherwise snap to floor
          if (minDiffY < floorDiff) {
            finalPos.y = bestY;
            snapped = true;
            targetPieceId = snapTargetIdY;
            isFloorSnapped = false;
          } else {
            finalPos.y = floorCandidateY;
            snapped = true;
            targetPieceId = 'floor';
            isFloorSnapped = true;
          }
        } else {
          finalPos.y = floorCandidateY;
          snapped = true;
          targetPieceId = 'floor';
          isFloorSnapped = true;
        }
      } else if (snapTargetIdY && minDiffY < snapThreshold) {
        finalPos.y = bestY;
        snapped = true;
        targetPieceId = snapTargetIdY;
        isFloorSnapped = false;
      }
    }

    if (canMoveX && bestX !== finalPos.x) {
      finalPos.x = bestX;
      snapped = true;
      targetPieceId = snapTargetIdX || targetPieceId;
    }

    if (canMoveZ && bestZ !== finalPos.z) {
      finalPos.z = bestZ;
      snapped = true;
      targetPieceId = snapTargetIdZ || targetPieceId;
    }

    // Floor barrier: piece bottom cannot sink below floor when floorSnapActive (and only if Y can move)
    if (effectiveFloorSnap && canMoveY && finalPos.y < myHalf.y) {
      finalPos.y = myHalf.y;
      snapped = true;
      isFloorSnapped = true;
      targetPieceId = 'floor';
    }

    // 2) Solid Physics Collision Prevention (No Penetration / Fusion)
    // Constrained to allowed movement axes to prevent cross-axis teleportation
    if (allPieces && allPieces.length > 1) {
      for (const other of allPieces) {
        if (other.id === piece.id || other.hidden) continue;

        const otherCenter = new THREE.Vector3(
          other.position3D[0] * scale,
          other.position3D[1] * scale,
          other.position3D[2] * scale
        );
        const otherHalf = getGlobalHalfSizes(other.rotation3D, other.largo, other.espesor, other.ancho);

        const dx = Math.abs(finalPos.x - otherCenter.x);
        const dy = Math.abs(finalPos.y - otherCenter.y);
        const dz = Math.abs(finalPos.z - otherCenter.z);

        const overlapX = (myHalf.x + otherHalf.x) - dx;
        const overlapY = (myHalf.y + otherHalf.y) - dy;
        const overlapZ = (myHalf.z + otherHalf.z) - dz;

        // Soft epsilon (3mm) to detect actual interior penetration
        if (overlapX > 0.003 && overlapY > 0.003 && overlapZ > 0.003) {
          if (canMoveX && !canMoveY && !canMoveZ) {
            // Pure X drag: resolve strictly on X
            finalPos.x = finalPos.x >= otherCenter.x
              ? otherCenter.x + otherHalf.x + myHalf.x
              : otherCenter.x - otherHalf.x - myHalf.x;
            snapped = true;
            targetPieceId = other.id;
          } else if (canMoveY && !canMoveX && !canMoveZ) {
            // Pure Y drag: resolve strictly on Y
            finalPos.y = finalPos.y >= otherCenter.y
              ? otherCenter.y + otherHalf.y + myHalf.y
              : otherCenter.y - otherHalf.y - myHalf.y;
            snapped = true;
            targetPieceId = other.id;
          } else if (canMoveZ && !canMoveX && !canMoveY) {
            // Pure Z drag: resolve strictly on Z
            finalPos.z = finalPos.z >= otherCenter.z
              ? otherCenter.z + otherHalf.z + myHalf.z
              : otherCenter.z - otherHalf.z - myHalf.z;
            snapped = true;
            targetPieceId = other.id;
          } else if (canMoveX && canMoveZ && !canMoveY) {
            // Horizontal plane (XZ): only resolve along X or Z, never Y!
            if (overlapX <= overlapZ) {
              finalPos.x = finalPos.x >= otherCenter.x
                ? otherCenter.x + otherHalf.x + myHalf.x
                : otherCenter.x - otherHalf.x - myHalf.x;
            } else {
              finalPos.z = finalPos.z >= otherCenter.z
                ? otherCenter.z + otherHalf.z + myHalf.z
                : otherCenter.z - otherHalf.z - myHalf.z;
            }
            snapped = true;
            targetPieceId = other.id;
          } else {
            // Multi-axis / Free 3D drag
            const allowedOverlaps: { axis: 'x' | 'y' | 'z'; val: number }[] = [];
            if (canMoveX) allowedOverlaps.push({ axis: 'x', val: overlapX });
            if (canMoveY) allowedOverlaps.push({ axis: 'y', val: overlapY });
            if (canMoveZ) allowedOverlaps.push({ axis: 'z', val: overlapZ });

            allowedOverlaps.sort((a, b) => a.val - b.val);

            let chosenAxis = allowedOverlaps[0]?.axis || 'x';
            if (chosenAxis === 'y' && effectiveFloorSnap && finalPos.y < otherCenter.y) {
              const nextOption = allowedOverlaps.find(o => o.axis !== 'y');
              if (nextOption) chosenAxis = nextOption.axis;
            }

            if (chosenAxis === 'x') {
              finalPos.x = finalPos.x >= otherCenter.x
                ? otherCenter.x + otherHalf.x + myHalf.x
                : otherCenter.x - otherHalf.x - myHalf.x;
            } else if (chosenAxis === 'y') {
              finalPos.y = finalPos.y >= otherCenter.y
                ? otherCenter.y + otherHalf.y + myHalf.y
                : otherCenter.y - otherHalf.y - myHalf.y;
            } else {
              finalPos.z = finalPos.z >= otherCenter.z
                ? otherCenter.z + otherHalf.z + myHalf.z
                : otherCenter.z - otherHalf.z - myHalf.z;
            }
            snapped = true;
            targetPieceId = other.id;
          }
        }
      }
    }

    // Final safety check for floor height
    if (effectiveFloorSnap && canMoveY && finalPos.y < myHalf.y) {
      finalPos.y = myHalf.y;
      isFloorSnapped = true;
    }

    return { finalPos, snapped, targetPieceId, isFloorSnapped };
  };

  const handleTransformEnd = () => {
    if (orbitControls) {
      orbitControls.enabled = true;
    }
    if (group) {
      let finalPos = group.position.clone();
      const finalRot = group.rotation.clone();
      const finalScale = group.scale.clone();

      if (transformMode === 'scale') {
        const sX = finalScale.x;
        const sY = finalScale.y;
        const sZ = finalScale.z;

        const dLargo = piece.largo * (sX - 1);
        const dEspesor = piece.espesor * (sY - 1);
        const dAncho = piece.ancho * (sZ - 1);

        // Single-sided scaling:
        // When currentDimensionSide === 'pos': anchor negative face, center shifts by +delta/2 (growing towards +)
        // When currentDimensionSide === 'neg': anchor positive face, center shifts by -delta/2 (growing towards -)
        const sign = currentDimensionSide === 'neg' ? -1 : 1;
        const originShift = [
          sign * (dLargo / 2) * scale,
          sign * (dEspesor / 2) * scale,
          sign * (dAncho / 2) * scale
        ];

        if (onUpdateDimensions) {
          onUpdateDimensions(dLargo, dEspesor, dAncho, originShift as [number, number, number]);
        }
        window.dispatchEvent(new CustomEvent('piece-scaling-update', { detail: null }));
      } else {
        if (transformMode === 'translate') {
           const { finalPos: snappedPos, snapped, targetPieceId, isFloorSnapped } = getSnappedPosition(finalPos, activeDragAxisRef.current);
           activeDragAxisRef.current = null;

           finalPos.copy(snappedPos);
           group.position.copy(finalPos);

           if (snapped) {
              triggerSnapFlash();

              if (targetPieceId && targetPieceId !== 'floor') {
                window.dispatchEvent(new CustomEvent('piece-snap-flash', {
                  detail: { targetId: targetPieceId }
                }));
              }
              if (isFloorSnapped) {
                window.dispatchEvent(new CustomEvent('floor-snap-flash', {
                  detail: { x: finalPos.x, z: finalPos.z, halfX: myHalf.x, halfZ: myHalf.z }
                }));
              }
           }

           window.dispatchEvent(new CustomEvent('piece-snap-target', {
             detail: { active: false, targetId: null }
           }));
           window.dispatchEvent(new CustomEvent('floor-snap-target', {
             detail: { active: false }
           }));
        }

        onTransformEnd(
          [finalPos.x / scale, finalPos.y / scale, finalPos.z / scale],
          [finalRot.x, finalRot.y, finalRot.z],
          [finalScale.x, finalScale.y, finalScale.z]
        );
      }

      // Reset scale, mesh position and displacement state after drag
      group.scale.set(1, 1, 1);
      if (mesh) {
        mesh.position.set(0, 0, 0);
      }
      isDraggingRef.current = false;
      setIsDraggingTranslate(false);
      if (transformMode !== 'translate') {
        setDisplacement(null);
        window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: null }));
      }
    }
  };


  // Materials based on edge configuration, piece material, and custom uploaded face textures.
  // Order of faces: right (+X), left (-X), top (+Y), bottom (-Y), front (+Z), back (-Z)
  const materials = useMemo(() => {
    const matInfo = getMaterialDefinition(piece.material);

    // Support Blender-style physical overrides
    const finalColor = piece.customColor || matInfo.color;
    const finalRoughness = piece.customRoughness !== undefined ? piece.customRoughness : matInfo.roughness;
    const finalMetalness = piece.customMetalness !== undefined ? piece.customMetalness : matInfo.metalness;
    const isGlass = piece.isGlass || matInfo.isGlass;
    const isMirror = piece.isMirror || matInfo.isMirror;
    const opacity = piece.customOpacity !== undefined ? piece.customOpacity : (matInfo.opacity ?? 1.0);
    const isTransparent = isGlass || opacity < 1.0;

    const baseMat = new THREE.MeshStandardMaterial({ 
      color: finalColor,
      roughness: finalRoughness,
      metalness: finalMetalness,
      transparent: isTransparent,
      opacity: opacity,
      depthWrite: !isTransparent || opacity > 0.85
    });
    
    const createEdgeMat = (edgeType: string) => {
      // If glass or mirror or metal, edges share the physical material finish
      if (isGlass || isMirror) {
        return new THREE.MeshStandardMaterial({
          color: finalColor,
          roughness: finalRoughness,
          metalness: finalMetalness,
          transparent: isTransparent,
          opacity: opacity,
          depthWrite: !isTransparent || opacity > 0.85
        });
      }
      if (finalMetalness > 0.5) {
        return new THREE.MeshStandardMaterial({
          color: finalColor,
          roughness: finalRoughness,
          metalness: finalMetalness
        });
      }

      const isCanto = edgeType !== 'Ninguno';
      // If edge-banded, use the piece's custom edge color (if defined) or fall back to the piece's material color. 
      // If not, show the raw cut wood core (simulates real-world construction).
      const edgeColor = isCanto ? (piece.cantoColor || finalColor) : matInfo.coreColor;
      
      return new THREE.MeshStandardMaterial({ 
        color: edgeColor,
        roughness: isCanto ? finalRoughness * 1.1 : 0.85, // Raw wood core is rougher
        metalness: finalMetalness
      });
    };

    // Reubicación dinámica: si la pieza es un divisor/separador vertical cuyo canto frontal
    // Determina qué cara local del cubo 3D apunta hacia el frente expuesto (+Z global del mueble):
    const rot = piece.rotation3D || [0, 0, 0];
    const euler = new THREE.Euler(rot[0], rot[1], rot[2], 'XYZ');
    const localXDir = new THREE.Vector3(1, 0, 0).applyEuler(euler);
    const localZDir = new THREE.Vector3(0, 0, 1).applyEuler(euler);
    const isLocalXFacingFront = Math.abs(localXDir.z - 1) < 0.1;
    const isLocalZFacingFront = Math.abs(localZDir.z - 1) < 0.1;

    let frontCantoType = piece.cantos?.largo1;
    let rightCantoType = piece.cantos?.ancho1;

    if (isLocalXFacingFront) {
      // Cara +X (Ancho 1 / Face 0) apunta directamente al frente (+Z global):
      // matA1 se muestra en el frente expuesto con el canto A1 (medida corta tierH)
      rightCantoType = piece.cantos?.ancho1;
      frontCantoType = piece.cantos?.largo1;
    } else if (isLocalZFacingFront && piece.cantos?.largo1 === 'Ninguno' && piece.cantos?.ancho1 && piece.cantos?.ancho1 !== 'Ninguno') {
      // Cara +Z (Largo 1 / Face 4) apunta al frente pero la indicación fue reubicada en Ancho 1
      frontCantoType = piece.cantos?.ancho1;
      rightCantoType = 'Ninguno';
    }

    const matL1 = createEdgeMat(frontCantoType);
    const matL2 = createEdgeMat(piece.cantos?.largo2);
    const matA1 = createEdgeMat(rightCantoType);
    const matA2 = createEdgeMat(piece.cantos?.ancho2);

    // Apply custom face texture (photos / images or procedural wood grains)
    const getFaceMaterial = (faceKey: PieceFaceKey, fallbackMat: THREE.Material) => {
      const userTexUrl = piece.faceTextures?.[faceKey];
      const woodUrl = userTexUrl || (matInfo?.hasGrain ? getPelikanoTextureUrl(piece.material) : null);

      if (woodUrl) {
        const config = piece.faceTextureConfigs?.[faceKey];
        const vetaAngle = piece.vetaRotation ?? (piece.vetaOrientacion === 'transversal' ? 90 : 0);
        const effectiveRotation = config?.rotation !== undefined ? config.rotation : vetaAngle;
        const effectiveConfig: FaceTextureOptions = {
          repeatX: config?.repeatX !== undefined ? config.repeatX : 1,
          repeatY: config?.repeatY !== undefined ? config.repeatY : 1,
          offsetX: config?.offsetX || 0,
          offsetY: config?.offsetY || 0,
          rotation: effectiveRotation
        };

        const faceMat = new THREE.MeshStandardMaterial({
          roughness: finalRoughness,
          metalness: finalMetalness,
          color: '#ffffff'
        });

        const tex = getOrCreateThreeTexture(woodUrl, effectiveConfig, () => {
          faceMat.map = tex;
          faceMat.needsUpdate = true;
          invalidate();
        });

        faceMat.map = tex;
        faceMat.needsUpdate = true;
        return faceMat;
      }
      return fallbackMat;
    };

    return [
      getFaceMaterial('right', matA1),   // 0: Right (+X, Ancho 1 / Lateral Der)
      getFaceMaterial('left', matA2),    // 1: Left (-X, Ancho 2 / Lateral Izq)
      getFaceMaterial('top', baseMat),   // 2: Top (+Y / Cara Superior)
      getFaceMaterial('bottom', baseMat),// 3: Bottom (-Y / Cara Inferior)
      getFaceMaterial('front', matL1),   // 4: Front (+Z, Largo 1 / Cara Frontal)
      getFaceMaterial('back', matL2),    // 5: Back (-Z, Largo 2 / Cara Posterior)
    ];
  }, [
    piece.cantos, 
    piece.material, 
    piece.customColor, 
    piece.cantoColor, 
    piece.customRoughness, 
    piece.customMetalness,
    piece.customOpacity,
    piece.isGlass,
    piece.isMirror,
    piece.faceTextures,
    piece.faceTextureConfigs,
    piece.veta,
    piece.vetaOrientacion,
    piece.vetaRotation,
    invalidate
  ]);

  // Memoized 3D geometry with physical CNC groove (ranurado) if active
  const pieceGeometry = useMemo(() => {
    if (!piece.ranurado) return null;
    const cfg = piece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8 };
    return createGroovedPieceGeometry(
      piece.largo * scale,
      piece.espesor * scale,
      piece.ancho * scale,
      cfg,
      scale
    );
  }, [
    piece.ranurado,
    piece.ranuraConfig?.lado,
    piece.ranuraConfig?.dist,
    piece.ranuraConfig?.esp,
    piece.ranuraConfig?.prof,
    piece.ranuraConfig?.cara,
    piece.largo,
    piece.espesor,
    piece.ancho,
    scale
  ]);

  useEffect(() => {
    return () => {
      if (pieceGeometry) {
        pieceGeometry.dispose();
      }
    };
  }, [pieceGeometry]);

  const activeMaterials = useMemo<THREE.Material | THREE.Material[]>(() => {
    if (!piece.ranurado) return materials;
    if (Array.isArray(materials)) {
      const melamineMat: THREE.Material = materials[2] || materials[0];
      return [melamineMat, melamineMat];
    }
    return materials;
  }, [piece.ranurado, materials]);

  useEffect(() => {
    if (mesh && activeMaterials) {
      mesh.material = activeMaterials;
      if (Array.isArray(activeMaterials)) {
        activeMaterials.forEach((m: THREE.Material) => {
          m.needsUpdate = true;
        });
      }
      invalidate();
    }
  }, [mesh, activeMaterials, invalidate]);

  useEffect(() => {
    if (mesh) {
      if (pieceGeometry) {
        mesh.geometry = pieceGeometry;
      }
      invalidate();
    }
  }, [mesh, pieceGeometry, invalidate]);

  useEffect(() => {
    if (transformRef.current) {
      // Fluid movement: null translation snap enables silky smooth continuous drag on mobile
      transformRef.current.setTranslationSnap(null);
      if (snapActive) {
        transformRef.current.setRotationSnap(THREE.MathUtils.degToRad(15));
        transformRef.current.setScaleSnap(0.1); 
      } else {
        transformRef.current.setRotationSnap(null);
        transformRef.current.setScaleSnap(null);
      }
    }
  }, [snapActive]);

  const disableUnwantedHandles = () => {
    const controls = transformRef.current;
    if (!controls) return;
    controls.traverse((child: any) => {
      let shouldHide = false;
      let curr = child;
      while (curr && curr !== controls) {
        if (curr.name) {
          const name = curr.name.toUpperCase();
          if (
            name.includes('XY') || 
            name.includes('YZ') || 
            name.includes('XZ') || 
            name.includes('XYZ') ||
            name.includes('E') ||
            name.includes('OCTANT')
          ) {
            shouldHide = true;
            break;
          }
        }
        curr = curr.parent;
      }

      if (shouldHide) {
        try {
          Object.defineProperty(child, 'visible', {
            get: () => false,
            set: () => {},
            configurable: true,
            enumerable: true
          });
          if (child.scale) {
            child.scale.set(0, 0, 0);
          }
        } catch (e) {
          child.visible = false;
          if (child.scale) {
            child.scale.set(0, 0, 0);
          }
        }
      }
    });
  };

  // Run disableUnwantedHandles right after TransformControls renders or changes state
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      disableUnwantedHandles();
    });
    return () => cancelAnimationFrame(id);
  }, [transformMode, showControls, group]);

  // Handle real-time scale/translate and hide planes in real-time
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls || !group) return;

    // Run immediately to hide plane handles
    disableUnwantedHandles();

    const handleMouseDown = () => {
      disableUnwantedHandles();
      if (orbitControls) {
        orbitControls.enabled = false;
      }
      if (group && transformMode === 'translate') {
        isDraggingRef.current = true;
        activeDragAxisRef.current = controls.axis || null;
        initialPosRef.current.copy(group.position);
        const zeroDisp = { dx: 0, dy: 0, dz: 0, dist: 0 };
        setDisplacement(zeroDisp);
        window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: zeroDisp }));
      } else if (group && transformMode === 'rotate') {
        isDraggingRef.current = true;
        initialRotRef.current.copy(group.rotation);
        const zeroRot = { dRotX: 0, dRotY: 0, dRotZ: 0, angle: 0, axis: 'Y', isDragging: true, pieceId: piece.id };
        window.dispatchEvent(new CustomEvent('piece-rotation-update', { detail: zeroRot }));
      }
    };

    const handleDraggingChanged = (event: any) => {
      const dragging = !!event.value;
      if (dragging) {
        if (orbitControls) {
          orbitControls.enabled = false;
        }
        activeDragAxisRef.current = controls.axis || null;
        disableUnwantedHandles();
      }
      if (dragging && transformMode === 'translate') {
        isDraggingRef.current = true;
        if (group) {
          initialPosRef.current.copy(group.position);
        }
        setIsDraggingTranslate(true);
        const zeroDisp = { dx: 0, dy: 0, dz: 0, dist: 0, isDragging: true, pieceId: piece.id };
        setDisplacement(zeroDisp);
        window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: zeroDisp }));
      } else if (dragging && transformMode === 'rotate') {
        isDraggingRef.current = true;
        if (group) {
          initialRotRef.current.copy(group.rotation);
        }
        const zeroRot = { dRotX: 0, dRotY: 0, dRotZ: 0, angle: 0, axis: 'Y', isDragging: true, pieceId: piece.id };
        window.dispatchEvent(new CustomEvent('piece-rotation-update', { detail: zeroRot }));
      } else if (dragging && transformMode === 'scale') {
        isDraggingRef.current = true;
        const zeroScale = {
          largo: Math.round(piece.largo),
          ancho: Math.round(piece.ancho),
          espesor: Math.round(piece.espesor),
          axis: 'largo',
          delta: 0,
          isDragging: true,
          pieceId: piece.id
        };
        window.dispatchEvent(new CustomEvent('piece-scaling-update', { detail: zeroScale }));
      } else if (!dragging) {
        if (orbitControls) {
          orbitControls.enabled = true;
        }
        isDraggingRef.current = false;
        setIsDraggingTranslate(false);
        activeDragAxisRef.current = null;
        if (transformMode === 'translate' && group) {
          const dx = Math.round((group.position.x - initialPosRef.current.x) * 1000);
          const dy = Math.round((group.position.y - initialPosRef.current.y) * 1000);
          const dz = Math.round((group.position.z - initialPosRef.current.z) * 1000);
          const dist = Math.round(Math.hypot(dx, dy, dz));
          const endDisp = { dx, dy, dz, dist, isDragging: false, pieceId: piece.id };
          setDisplacement(endDisp);
          window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: endDisp }));
        } else if (transformMode === 'rotate' && group) {
          const dX = Math.round(THREE.MathUtils.radToDeg(group.rotation.x - initialRotRef.current.x));
          const dY = Math.round(THREE.MathUtils.radToDeg(group.rotation.y - initialRotRef.current.y));
          const dZ = Math.round(THREE.MathUtils.radToDeg(group.rotation.z - initialRotRef.current.z));
          const activeAxis = Math.abs(dY) >= Math.abs(dX) && Math.abs(dY) >= Math.abs(dZ) ? 'Y' : Math.abs(dX) >= Math.abs(dZ) ? 'X' : 'Z';
          const angle = activeAxis === 'Y' ? dY : (activeAxis === 'X' ? dX : dZ);
          const endRot = { dRotX: dX, dRotY: dY, dRotZ: dZ, angle, axis: activeAxis, isDragging: false, pieceId: piece.id };
          window.dispatchEvent(new CustomEvent('piece-rotation-update', { detail: endRot }));
        } else if (transformMode === 'scale' && group) {
          const sX = group.scale.x;
          const sY = group.scale.y;
          const sZ = group.scale.z;
          const dLargo = Math.round(piece.largo * (sX - 1));
          const dEspesor = Math.round(piece.espesor * (sY - 1));
          const dAncho = Math.round(piece.ancho * (sZ - 1));
          const absL = Math.abs(dLargo);
          const absA = Math.abs(dAncho);
          const absE = Math.abs(dEspesor);
          const activeAxis = (absL >= absA && absL >= absE) ? 'largo' : (absA >= absE ? 'ancho' : 'espesor');
          const activeDelta = activeAxis === 'largo' ? dLargo : (activeAxis === 'ancho' ? dAncho : dEspesor);
          const endScale = {
            largo: Math.round(piece.largo + dLargo),
            ancho: Math.round(piece.ancho + dAncho),
            espesor: Math.round(piece.espesor + dEspesor),
            axis: activeAxis,
            delta: activeDelta,
            isDragging: false,
            pieceId: piece.id
          };
          window.dispatchEvent(new CustomEvent('piece-scaling-update', { detail: endScale }));
        } else {
          setDisplacement(null);
          window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: null }));
          window.dispatchEvent(new CustomEvent('piece-rotation-update', { detail: null }));
          window.dispatchEvent(new CustomEvent('piece-scaling-update', { detail: null }));
        }
        window.dispatchEvent(new CustomEvent('floor-snap-target', { detail: { active: false } }));
      }
    };

    let rafId: number | null = null;
    const handleChange = () => {
      if (transformMode === 'rotate' && group && isDraggingRef.current) {
        const dX = Math.round(THREE.MathUtils.radToDeg(group.rotation.x - initialRotRef.current.x));
        const dY = Math.round(THREE.MathUtils.radToDeg(group.rotation.y - initialRotRef.current.y));
        const dZ = Math.round(THREE.MathUtils.radToDeg(group.rotation.z - initialRotRef.current.z));
        const activeAxis = Math.abs(dY) >= Math.abs(dX) && Math.abs(dY) >= Math.abs(dZ) ? 'Y' : Math.abs(dX) >= Math.abs(dZ) ? 'X' : 'Z';
        const angle = activeAxis === 'Y' ? dY : (activeAxis === 'X' ? dX : dZ);
        const liveRot = { dRotX: dX, dRotY: dY, dRotZ: dZ, angle, axis: activeAxis, isDragging: true, pieceId: piece.id };
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('piece-rotation-update', { detail: liveRot }));
            rafId = null;
          });
        }
      }

      if (transformMode === 'translate' && group && isDraggingRef.current) {
        const currentAxis = controls.axis || activeDragAxisRef.current || null;
        const { finalPos, snapped, targetPieceId, isFloorSnapped } = getSnappedPosition(group.position, currentAxis);
        if (snapped || finalPos.distanceToSquared(group.position) > 0.0000001) {
          group.position.copy(finalPos);
          if (targetPieceId && targetPieceId !== 'floor') {
            window.dispatchEvent(new CustomEvent('piece-snap-target', {
              detail: { active: true, targetId: targetPieceId }
            }));
          } else {
            window.dispatchEvent(new CustomEvent('piece-snap-target', {
              detail: { active: false, targetId: null }
            }));
          }

          if (isFloorSnapped) {
            window.dispatchEvent(new CustomEvent('floor-snap-target', {
              detail: { 
                active: true, 
                x: finalPos.x, 
                z: finalPos.z, 
                halfX: myHalf.x, 
                halfZ: myHalf.z 
              }
            }));
          } else {
            window.dispatchEvent(new CustomEvent('floor-snap-target', {
              detail: { active: false }
            }));
          }
        } else {
          window.dispatchEvent(new CustomEvent('piece-snap-target', {
            detail: { active: false, targetId: null }
          }));
          window.dispatchEvent(new CustomEvent('floor-snap-target', {
            detail: { active: false }
          }));
        }

        const dx = Math.round((group.position.x - initialPosRef.current.x) * 1000);
        const dy = Math.round((group.position.y - initialPosRef.current.y) * 1000);
        const dz = Math.round((group.position.z - initialPosRef.current.z) * 1000);
        const dist = Math.round(Math.hypot(dx, dy, dz));

        const disp = { dx, dy, dz, dist, isDragging: true, isFloorSnapped: !!isFloorSnapped, pieceId: piece.id };
        setIsDraggingTranslate(true);
        setDisplacement(disp);
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: disp }));
            rafId = null;
          });
        }
      }

      if (transformMode !== 'scale') return;
      if (!mesh) return;

      const sX = group.scale.x;
      const sY = group.scale.y;
      const sZ = group.scale.z;

      const dLargo = piece.largo * (sX - 1);
      const dEspesor = piece.espesor * (sY - 1);
      const dAncho = piece.ancho * (sZ - 1);

      // Shift the child mesh locally inside the group to anchor either the negative side (growing +)
      // or the positive side (growing -)
      const sign = currentDimensionSide === 'neg' ? -1 : 1;
      mesh.position.set(
        sX !== 0 ? ((sign * dLargo / 2) * scale) / sX : 0,
        sY !== 0 ? ((sign * dEspesor / 2) * scale) / sY : 0,
        sZ !== 0 ? ((sign * dAncho / 2) * scale) / sZ : 0
      );

      const absL = Math.abs(dLargo);
      const absA = Math.abs(dAncho);
      const absE = Math.abs(dEspesor);
      const activeAxis: 'largo' | 'ancho' | 'espesor' = (absL >= absA && absL >= absE) ? 'largo' : (absA >= absE ? 'ancho' : 'espesor');
      const activeDelta = activeAxis === 'largo' ? Math.round(dLargo) : (activeAxis === 'ancho' ? Math.round(dAncho) : Math.round(dEspesor));

      // Broadcast live dimensions to overlay and footer in real-time
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          window.dispatchEvent(new CustomEvent('piece-scaling-update', {
            detail: {
              largo: Math.max(1, Math.round(piece.largo + dLargo)),
              espesor: Math.max(1, Math.round(piece.espesor + dEspesor)),
              ancho: Math.max(1, Math.round(piece.ancho + dAncho)),
              axis: activeAxis,
              delta: activeDelta,
              isDragging: true,
              pieceId: piece.id
            }
          }));
          rafId = null;
        });
      }
    };

    controls.addEventListener('mouseDown', handleMouseDown);
    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('change', handleChange);

    return () => {
      if (controls) {
        controls.removeEventListener('mouseDown', handleMouseDown);
        controls.removeEventListener('dragging-changed', handleDraggingChanged);
        controls.removeEventListener('change', handleChange);
      }
    };
  }, [group, mesh, showControls, transformMode, currentDimensionSide, snapActive, piece.largo, piece.espesor, piece.ancho]);

  // Handle double click for quick scale mode
  const handleDoubleClick = (e: any) => {
    e.stopPropagation();
  };

  return (
    <group>
      {showControls && group && transformMode !== 'scale' && transformMode !== 'texture' && (
        <TransformControls
          ref={transformRef}
          object={group}
          mode={transformMode as any}
          onMouseUp={handleTransformEnd}
          size={controlsSize}
          showY={true}
        />
      )}

      <group
        ref={setGroup}
        position={pos}
        rotation={piece.rotation3D}
      >
        <mesh
          ref={setMesh}
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            if (transformMode === 'texture' && e.face?.materialIndex !== undefined) {
              const faceIndexMap: PieceFaceKey[] = ['right', 'left', 'top', 'bottom', 'front', 'back'];
              const faceKey = faceIndexMap[e.face.materialIndex];
              if (onSelectTextureFace) {
                onSelectTextureFace(faceKey);
              }
              window.dispatchEvent(new CustomEvent('select-texture-face', {
                detail: { pieceId: piece.id, faceKey }
              }));
            }
            onClick(e);
          }}
          onPointerDown={(e) => {
            if (transformMode === 'scale' && group) {
              const local = group.worldToLocal(e.point.clone());
              if (local.x < -0.005 || local.z < -0.005) {
                setCurrentDimensionSide('neg');
              } else if (local.x > 0.005 || local.z > 0.005) {
                setCurrentDimensionSide('pos');
              }
            }
          }}
          onDoubleClick={(e) => {
             e.stopPropagation();
             if (e.point) {
               window.dispatchEvent(new CustomEvent('focus-3d-point', { 
                 detail: { point: { x: e.point.x, y: e.point.y, z: e.point.z } } 
               }));
             }
             window.dispatchEvent(new CustomEvent('request-transform-mode', { detail: 'scale' }));
             if (onDoubleClickPiece) {
                onDoubleClickPiece(piece.id);
             }
          }}
          material={activeMaterials}
          geometry={pieceGeometry || undefined}
        >
          {!pieceGeometry && <boxGeometry args={dims} />}
          <Edges geometry={pieceGeometry || undefined} scale={1} threshold={15} color={flash ? '#10b981' : isSnapTarget ? '#3b82f6' : isSelected ? '#f0a144' : '#111111'} />
        </mesh>

        {/* Modern 3D Handle (Tirador) for doors */}
        {(piece.isDoor || piece.name.toLowerCase().includes('puerta')) && (
          <group>
            {(() => {
              const isLeftHinge = piece.doorHingeSide === 'left' || piece.name.toLowerCase().includes('izq');
              const handleZ = isLeftHinge ? (dims[2] / 2 - 0.028) : -(dims[2] / 2 - 0.028);
              const isBottomDoor = piece.name.toLowerCase().includes('inf');
              const isTopDoor = piece.name.toLowerCase().includes('sup');
              const handleX = isBottomDoor ? dims[0] * 0.32 : isTopDoor ? -dims[0] * 0.32 : 0;
              const handleY = dims[1] / 2 + 0.007;

              return (
                <mesh position={[handleX, handleY, handleZ]}>
                  <boxGeometry args={[Math.min(0.14, Math.max(0.08, dims[0] * 0.18)), 0.012, 0.014]} />
                  <meshStandardMaterial
                    color="#1c1c1f"
                    roughness={0.25}
                    metalness={0.85}
                  />
                </mesh>
              );
            })()}
          </group>
        )}

        {/* Physical Canto Grueso bands (3mm) with realistic edge band appearance and joinery seams */}
        {(() => {
          const gruesoMm = edgeThicknessConfig?.grueso ?? 3.0;
          const thick3D = Math.max(0.001, (gruesoMm * 0.001)); // Convert mm to 3D units (meters, e.g. 3mm = 0.003)
          const pLargo = dims[0];
          const pEspesor = dims[1];
          const pAncho = dims[2];

          const matInfo = getMaterialDefinition(piece.material);
          const finalColor = piece.customColor || matInfo.color;
          const edgeColor = piece.cantoColor || finalColor;
          
          const cantoBandMat = new THREE.MeshStandardMaterial({
            color: edgeColor,
            roughness: 0.28,
            metalness: (piece.customMetalness ?? 0.05)
          });

          const rotBand = piece.rotation3D || [0, 0, 0];
          const eulerBand = new THREE.Euler(rotBand[0], rotBand[1], rotBand[2], 'XYZ');
          const localXDirBand = new THREE.Vector3(1, 0, 0).applyEuler(eulerBand);
          const localZDirBand = new THREE.Vector3(0, 0, 1).applyEuler(eulerBand);
          const isLocalXFacingFrontBand = Math.abs(localXDirBand.z - 1) < 0.1;
          const isLocalZFacingFrontBand = Math.abs(localZDirBand.z - 1) < 0.1;

          let frontVal = piece.cantos?.largo1;
          let rightVal = piece.cantos?.ancho1;

          if (isLocalXFacingFrontBand) {
            rightVal = piece.cantos?.ancho1;
            frontVal = piece.cantos?.largo1;
          } else if (isLocalZFacingFrontBand && piece.cantos?.largo1 === 'Ninguno' && piece.cantos?.ancho1 && piece.cantos?.ancho1 !== 'Ninguno') {
            frontVal = piece.cantos?.ancho1;
            rightVal = 'Ninguno';
          }

          const hasL1Grueso = frontVal === 'Canto Grueso';
          const hasL2Grueso = piece.cantos?.largo2 === 'Canto Grueso';
          const hasA1Grueso = rightVal === 'Canto Grueso';
          const hasA2Grueso = piece.cantos?.ancho2 === 'Canto Grueso';

          if (!hasL1Grueso && !hasL2Grueso && !hasA1Grueso && !hasA2Grueso) return null;

          return (
            <group name="canto-grueso-bands">
              {/* L1: Front edge (+Z) */}
              {hasL1Grueso && (
                <group position={[0, 0, (pAncho / 2) - (thick3D / 2)]}>
                  <mesh material={cantoBandMat}>
                    <boxGeometry args={[pLargo, pEspesor * 1.001, thick3D]} />
                    <Edges scale={1} threshold={35} color={isSelected ? '#f0a144' : '#b91c1c'} />
                  </mesh>
                </group>
              )}

              {/* L2: Back edge (-Z) */}
              {hasL2Grueso && (
                <group position={[0, 0, -(pAncho / 2) + (thick3D / 2)]}>
                  <mesh material={cantoBandMat}>
                    <boxGeometry args={[pLargo, pEspesor * 1.001, thick3D]} />
                    <Edges scale={1} threshold={35} color={isSelected ? '#f0a144' : '#b91c1c'} />
                  </mesh>
                </group>
              )}

              {/* A1: Right edge (+X) */}
              {hasA1Grueso && (
                <group position={[(pLargo / 2) - (thick3D / 2), 0, 0]}>
                  <mesh material={cantoBandMat}>
                    <boxGeometry args={[thick3D, pEspesor * 1.001, pAncho]} />
                    <Edges scale={1} threshold={35} color={isSelected ? '#f0a144' : '#b91c1c'} />
                  </mesh>
                </group>
              )}

              {/* A2: Left edge (-X) */}
              {hasA2Grueso && (
                <group position={[-(pLargo / 2) + (thick3D / 2), 0, 0]}>
                  <mesh material={cantoBandMat}>
                    <boxGeometry args={[thick3D, pEspesor * 1.001, pAncho]} />
                    <Edges scale={1} threshold={35} color={isSelected ? '#f0a144' : '#b91c1c'} />
                  </mesh>
                </group>
              )}
            </group>
          );
        })()}

        {/* Render 6 directional scale handles directly on the piece when in scale mode */}
        {isSelected && transformMode === 'scale' && (
          <>
            {/* Right handle (+X, positive Largo) */}
            <DimensionHandle
              position={[(piece.largo * scale) / 2 + 0.025, 0, 0]}
              color="#ef4444"
              axis="largo"
              side="pos"
              isSnapped={activeSnapHandle?.axis === 'largo' && activeSnapHandle?.side === 'pos'}
              onStartDrag={handleStartHandleDrag}
              onSelectSide={setCurrentDimensionSide}
            />
            {/* Left handle (-X, negative Largo) */}
            <DimensionHandle
              position={[-(piece.largo * scale) / 2 - 0.025, 0, 0]}
              color="#ef4444"
              axis="largo"
              side="neg"
              isSnapped={activeSnapHandle?.axis === 'largo' && activeSnapHandle?.side === 'neg'}
              onStartDrag={handleStartHandleDrag}
              onSelectSide={setCurrentDimensionSide}
            />
            {/* Front handle (+Z, positive Ancho) */}
            <DimensionHandle
              position={[0, 0, (piece.ancho * scale) / 2 + 0.025]}
              color="#3b82f6"
              axis="ancho"
              side="pos"
              isSnapped={activeSnapHandle?.axis === 'ancho' && activeSnapHandle?.side === 'pos'}
              onStartDrag={handleStartHandleDrag}
              onSelectSide={setCurrentDimensionSide}
            />
            {/* Back handle (-Z, negative Ancho) */}
            <DimensionHandle
              position={[0, 0, -(piece.ancho * scale) / 2 - 0.025]}
              color="#3b82f6"
              axis="ancho"
              side="neg"
              isSnapped={activeSnapHandle?.axis === 'ancho' && activeSnapHandle?.side === 'neg'}
              onStartDrag={handleStartHandleDrag}
              onSelectSide={setCurrentDimensionSide}
            />
            {/* Top handle (+Y, positive Espesor) */}
            <DimensionHandle
              position={[0, (piece.espesor * scale) / 2 + 0.025, 0]}
              color="#10b981"
              axis="espesor"
              side="pos"
              isSnapped={activeSnapHandle?.axis === 'espesor' && activeSnapHandle?.side === 'pos'}
              onStartDrag={handleStartHandleDrag}
              onSelectSide={setCurrentDimensionSide}
            />
            {/* Bottom handle (-Y, negative Espesor) */}
            <DimensionHandle
              position={[0, -(piece.espesor * scale) / 2 - 0.025, 0]}
              color="#10b981"
              axis="espesor"
              side="neg"
              isSnapped={activeSnapHandle?.axis === 'espesor' && activeSnapHandle?.side === 'neg'}
              onStartDrag={handleStartHandleDrag}
              onSelectSide={setCurrentDimensionSide}
            />
          </>
        )}

        {/* Render 6 directional texture face gizmos directly on each face when in texture mode */}
        {isSelected && transformMode === 'texture' && !isTextureModalOpen && (
          <>
            {/* Top (+Y, Cara Superior) */}
            <FaceTextureGizmo
              position={[0, (piece.espesor * scale) / 2 + 0.006, 0]}
              faceKey="top"
              faceLabel="Cara Superior"
              isActive={activeTextureFace === 'top'}
              isAllMode={activeTextureFace === 'all'}
              hasCustomTexture={!!piece.faceTextures?.top}
              texturePreviewUrl={piece.faceTextures?.top}
              onSelect={(faceKey) => {
                if (onSelectTextureFace) onSelectTextureFace(faceKey);
                window.dispatchEvent(new CustomEvent('select-texture-face', { detail: { pieceId: piece.id, faceKey } }));
              }}
            />
            {/* Bottom (-Y, Cara Inferior) */}
            <FaceTextureGizmo
              position={[0, -(piece.espesor * scale) / 2 - 0.006, 0]}
              faceKey="bottom"
              faceLabel="Cara Inferior"
              isActive={activeTextureFace === 'bottom'}
              isAllMode={activeTextureFace === 'all'}
              hasCustomTexture={!!piece.faceTextures?.bottom}
              texturePreviewUrl={piece.faceTextures?.bottom}
              onSelect={(faceKey) => {
                if (onSelectTextureFace) onSelectTextureFace(faceKey);
                window.dispatchEvent(new CustomEvent('select-texture-face', { detail: { pieceId: piece.id, faceKey } }));
              }}
            />
            {/* Front (+Z, Cara Frontal / L1) */}
            <FaceTextureGizmo
              position={[0, 0, (piece.ancho * scale) / 2 + 0.006]}
              faceKey="front"
              faceLabel="Cara Frontal"
              isActive={activeTextureFace === 'front'}
              isAllMode={activeTextureFace === 'all'}
              hasCustomTexture={!!piece.faceTextures?.front}
              texturePreviewUrl={piece.faceTextures?.front}
              onSelect={(faceKey) => {
                if (onSelectTextureFace) onSelectTextureFace(faceKey);
                window.dispatchEvent(new CustomEvent('select-texture-face', { detail: { pieceId: piece.id, faceKey } }));
              }}
            />
            {/* Back (-Z, Cara Posterior / L2) */}
            <FaceTextureGizmo
              position={[0, 0, -(piece.ancho * scale) / 2 - 0.006]}
              faceKey="back"
              faceLabel="Cara Posterior"
              isActive={activeTextureFace === 'back'}
              isAllMode={activeTextureFace === 'all'}
              hasCustomTexture={!!piece.faceTextures?.back}
              texturePreviewUrl={piece.faceTextures?.back}
              onSelect={(faceKey) => {
                if (onSelectTextureFace) onSelectTextureFace(faceKey);
                window.dispatchEvent(new CustomEvent('select-texture-face', { detail: { pieceId: piece.id, faceKey } }));
              }}
            />
            {/* Right (+X, Lateral Derecho / A1) */}
            <FaceTextureGizmo
              position={[(piece.largo * scale) / 2 + 0.006, 0, 0]}
              faceKey="right"
              faceLabel="Lateral Derecho"
              isActive={activeTextureFace === 'right'}
              isAllMode={activeTextureFace === 'all'}
              hasCustomTexture={!!piece.faceTextures?.right}
              texturePreviewUrl={piece.faceTextures?.right}
              onSelect={(faceKey) => {
                if (onSelectTextureFace) onSelectTextureFace(faceKey);
                window.dispatchEvent(new CustomEvent('select-texture-face', { detail: { pieceId: piece.id, faceKey } }));
              }}
            />
            {/* Left (-X, Lateral Izquierdo / A2) */}
            <FaceTextureGizmo
              position={[-(piece.largo * scale) / 2 - 0.006, 0, 0]}
              faceKey="left"
              faceLabel="Lateral Izquierdo"
              isActive={activeTextureFace === 'left'}
              isAllMode={activeTextureFace === 'all'}
              hasCustomTexture={!!piece.faceTextures?.left}
              texturePreviewUrl={piece.faceTextures?.left}
              onSelect={(faceKey) => {
                if (onSelectTextureFace) onSelectTextureFace(faceKey);
                window.dispatchEvent(new CustomEvent('select-texture-face', { detail: { pieceId: piece.id, faceKey } }));
              }}
            />
          </>
        )}


      </group>
    </group>
  );
};

function GroupBoundingBoxCage({
  size,
  boxVisualRef
}: {
  size: THREE.Vector3;
  boxVisualRef: React.RefObject<THREE.Group | null>;
}) {
  const halfX = size.x / 2;
  const halfY = size.y / 2;
  const halfZ = size.z / 2;

  // 8 corners of the bounding box
  const corners = [
    [-halfX, -halfY, -halfZ],
    [ halfX, -halfY, -halfZ],
    [-halfX,  halfY, -halfZ],
    [ halfX,  halfY, -halfZ],
    [-halfX, -halfY,  halfZ],
    [ halfX, -halfY,  halfZ],
    [-halfX,  halfY,  halfZ],
    [ halfX,  halfY,  halfZ],
  ];

  const markerSize = Math.max(0.012, Math.min(0.024, Math.max(size.x, size.y, size.z) * 0.03));

  return (
    <group ref={boxVisualRef}>
      {/* Semi-transparent bounding volume with glowing edges */}
      <mesh raycast={() => null}>
        <boxGeometry args={[size.x + 0.006, size.y + 0.006, size.z + 0.006]} />
        <meshBasicMaterial 
          color="#38bdf8" 
          transparent 
          opacity={0.04} 
          depthWrite={false} 
        />
        <Edges 
          scale={1.001} 
          threshold={15} 
          color="#38bdf8" 
        />
      </mesh>

      {/* 8 Corner Brackets */}
      {corners.map((pos, idx) => (
        <mesh key={idx} position={pos as [number, number, number]} raycast={() => null}>
          <boxGeometry args={[markerSize, markerSize, markerSize]} />
          <meshStandardMaterial 
            color="#38bdf8" 
            emissive="#0284c7" 
            emissiveIntensity={0.8} 
            roughness={0.2} 
          />
        </mesh>
      ))}
    </group>
  );
}

interface GroupTransformControlsProps {
  selectedPieces: Piece[];
  allPieces: Piece[];
  groups?: Group3D[];
  transformMode?: 'translate' | 'rotate' | 'scale' | 'texture';
  snapActive?: boolean;
  floorSnapActive?: boolean;
  pieceSnapActive?: boolean;
  pieceGroupsRef: React.MutableRefObject<Map<string, THREE.Group>>;
  onUpdateMultiplePiecesTransform?: (updates: { id: string; position: [number, number, number]; rotation: [number, number, number] }[]) => void;
  onUpdatePieceTransform: (id: string, position: [number, number, number], rotation: [number, number, number]) => void;
}

const GroupTransformControls: React.FC<GroupTransformControlsProps> = ({
  selectedPieces,
  allPieces,
  groups,
  transformMode = 'translate',
  snapActive = false,
  floorSnapActive = true,
  pieceSnapActive = true,
  pieceGroupsRef,
  onUpdateMultiplePiecesTransform,
  onUpdatePieceTransform,
}) => {
  const [anchor, setAnchor] = useState<THREE.Group | null>(null);
  const boxVisualRef = useRef<THREE.Group | null>(null);
  const transformRef = useRef<any>(null);
  const isDraggingRef = useRef(false);

  const initialAnchorPos = useRef(new THREE.Vector3());
  const initialAnchorRot = useRef(new THREE.Euler());
  const initialPiecePositions = useRef<Map<string, THREE.Vector3>>(new Map());
  const initialPieceRotations = useRef<Map<string, THREE.Euler>>(new Map());
  const initialBoxCenter = useRef(new THREE.Vector3());
  const initialMinYRef = useRef(0);
  const lastDeltaRef = useRef({ dx: 0, dy: 0, dz: 0 });
  const lastDeltaRotRef = useRef(new THREE.Euler());

  const { controls: orbitControls, invalidate } = useThree() as any;

  // Compute AABB bounding box for the entire group
  const { center, size, minY } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    selectedPieces.forEach(p => {
      const pCenter = new THREE.Vector3(
        p.position3D[0] * 0.001,
        p.position3D[1] * 0.001,
        p.position3D[2] * 0.001
      );
      const half = getGlobalHalfSizes(p.rotation3D, p.largo, p.espesor, p.ancho);
      minX = Math.min(minX, pCenter.x - half.x);
      maxX = Math.max(maxX, pCenter.x + half.x);
      minY = Math.min(minY, pCenter.y - half.y);
      maxY = Math.max(maxY, pCenter.y + half.y);
      minZ = Math.min(minZ, pCenter.z - half.z);
      maxZ = Math.max(maxZ, pCenter.z + half.z);
    });

    const c = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    const s = new THREE.Vector3(
      Math.max(0.02, maxX - minX),
      Math.max(0.02, maxY - minY),
      Math.max(0.02, maxZ - minZ)
    );

    return { center: c, size: s, minY };
  }, [selectedPieces]);

  // Keep anchor and box visual at group center when not actively dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      if (anchor) {
        anchor.position.copy(center);
        anchor.rotation.set(0, 0, 0);
      }
      if (boxVisualRef.current) {
        boxVisualRef.current.position.copy(center);
        boxVisualRef.current.rotation.set(0, 0, 0);
      }
      invalidate();
    }
  }, [center, anchor, invalidate]);

  // Responsive Gizmo Size covering the group
  const maxDim = Math.max(size.x, size.y, size.z);
  const controlsSize = useMemo(() => {
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    if (isMobile) {
      return Math.max(1.15, Math.min(1.6, 1.0 + maxDim * 0.25));
    }
    return Math.max(0.9, Math.min(1.4, 0.75 + maxDim * 0.2));
  }, [maxDim]);

  // Group name for badge
  const groupName = useMemo(() => {
    const firstPiece = selectedPieces[0];
    if (firstPiece?.groupId) {
      const g = groups?.find(grp => grp.id === firstPiece.groupId);
      if (g?.name) return g.name;
      return 'Grupo';
    }
    return `${selectedPieces.length} Piezas`;
  }, [selectedPieces, groups]);

  // Disable planar handles so gizmo has crisp X, Y, Z controls
  const disableUnwantedHandles = () => {
    const controls = transformRef.current;
    if (!controls) return;
    controls.traverse((child: any) => {
      let shouldHide = false;
      let curr = child;
      while (curr && curr !== controls) {
        if (curr.name) {
          const name = curr.name.toUpperCase();
          if (
            name.includes('XY') || 
            name.includes('YZ') || 
            name.includes('XZ') || 
            name.includes('XYZ') ||
            name.includes('E') ||
            name.includes('OCTANT')
          ) {
            shouldHide = true;
            break;
          }
        }
        curr = curr.parent;
      }

      if (shouldHide) {
        try {
          Object.defineProperty(child, 'visible', {
            get: () => false,
            set: () => {},
            configurable: true,
            enumerable: true
          });
          if (child.scale) child.scale.set(0, 0, 0);
        } catch {
          child.visible = false;
          if (child.scale) child.scale.set(0, 0, 0);
        }
      }
    });
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      disableUnwantedHandles();
    });
    return () => cancelAnimationFrame(id);
  }, [transformMode]);

  useEffect(() => {
    if (transformRef.current) {
      transformRef.current.setTranslationSnap(null);
      if (snapActive) {
        transformRef.current.setRotationSnap(THREE.MathUtils.degToRad(15));
      } else {
        transformRef.current.setRotationSnap(null);
      }
    }
  }, [snapActive]);

  useEffect(() => {
    const controls = transformRef.current;
    if (!controls || !anchor) return;

    disableUnwantedHandles();

    const handleMouseDown = () => {
      if (isDraggingRef.current) return;
      disableUnwantedHandles();
      isDraggingRef.current = true;
      initialAnchorPos.current.copy(anchor.position);
      initialAnchorRot.current.copy(anchor.rotation);
      initialBoxCenter.current.copy(center);
      initialMinYRef.current = minY;

      lastDeltaRef.current = { dx: 0, dy: 0, dz: 0 };
      lastDeltaRotRef.current.set(0, 0, 0);

      initialPiecePositions.current.clear();
      initialPieceRotations.current.clear();

      selectedPieces.forEach(p => {
        const pPos = new THREE.Vector3(
          p.position3D[0] * 0.001,
          p.position3D[1] * 0.001,
          p.position3D[2] * 0.001
        );
        const pRot = new THREE.Euler(p.rotation3D[0], p.rotation3D[1], p.rotation3D[2]);
        initialPiecePositions.current.set(p.id, pPos);
        initialPieceRotations.current.set(p.id, pRot);

        const grp = pieceGroupsRef.current.get(p.id);
        if (grp) {
          grp.position.copy(pPos);
          grp.rotation.copy(pRot);
        }
      });

      if (orbitControls) orbitControls.enabled = false;
      window.dispatchEvent(new CustomEvent('piece-displacement-update', {
        detail: { dx: 0, dy: 0, dz: 0, dist: 0, isDragging: true }
      }));
    };

    const handleDraggingChanged = (e: any) => {
      const dragging = !!e.value;
      if (dragging) {
        handleMouseDown();
      } else {
        handleTransformEnd();
      }
    };

    let rafId: number | null = null;
    const handleChange = () => {
      if (!isDraggingRef.current || !anchor) return;

      if (transformMode === 'translate') {
        const controls = transformRef.current;
        const currentAxis = controls?.axis || null;
        let canMoveX = true;
        let canMoveY = true;
        let canMoveZ = true;

        if (currentAxis) {
          const normAxis = currentAxis.toUpperCase();
          if (normAxis === 'X') {
            canMoveX = true; canMoveY = false; canMoveZ = false;
          } else if (normAxis === 'Y') {
            canMoveX = false; canMoveY = true; canMoveZ = false;
          } else if (normAxis === 'Z') {
            canMoveX = false; canMoveY = false; canMoveZ = true;
          } else if (normAxis === 'XZ') {
            canMoveX = true; canMoveY = false; canMoveZ = true;
          }
        } else {
          const rawDx = Math.abs(anchor.position.x - initialAnchorPos.current.x);
          const rawDy = Math.abs(anchor.position.y - initialAnchorPos.current.y);
          const rawDz = Math.abs(anchor.position.z - initialAnchorPos.current.z);
          if (rawDx > 0.0005 && rawDy < 0.00005 && rawDz < 0.00005) {
            canMoveX = true; canMoveY = false; canMoveZ = false;
          } else if (rawDy > 0.0005 && rawDx < 0.00005 && rawDz < 0.00005) {
            canMoveX = false; canMoveY = true; canMoveZ = false;
          } else if (rawDz > 0.0005 && rawDx < 0.00005 && rawDy < 0.00005) {
            canMoveX = false; canMoveY = false; canMoveZ = true;
          }
        }

        let dx = canMoveX ? anchor.position.x - initialAnchorPos.current.x : 0;
        let dy = canMoveY ? anchor.position.y - initialAnchorPos.current.y : 0;
        let dz = canMoveZ ? anchor.position.z - initialAnchorPos.current.z : 0;

        anchor.position.x = initialAnchorPos.current.x + dx;
        anchor.position.y = initialAnchorPos.current.y + dy;
        anchor.position.z = initialAnchorPos.current.z + dz;

        const effectiveFloorSnap = floorSnapActive !== undefined ? floorSnapActive : snapActive;
        const effectivePieceSnap = pieceSnapActive !== undefined ? pieceSnapActive : snapActive;

        // Floor magnet snap for group base (only if Y can move and floor snap is enabled)
        let isFloorSnapped = false;
        if (effectiveFloorSnap && canMoveY) {
          const currentMinY = initialMinYRef.current + dy;
          if (currentMinY < 0.03 || currentMinY < 0) {
            dy = -initialMinYRef.current;
            anchor.position.y = initialAnchorPos.current.y + dy;
            isFloorSnapped = true;
          }
        }

        // Magnetic snap against other non-selected pieces
        const nonSelectedPieces = allPieces.filter(
          p => !selectedPieces.some(sp => sp.id === p.id) && !p.hidden
        );

        if (effectivePieceSnap && nonSelectedPieces.length > 0) {
          const snapThreshold = 0.025; // 25mm magnet snap
          const currentCenter = new THREE.Vector3(
            initialBoxCenter.current.x + dx,
            initialBoxCenter.current.y + dy,
            initialBoxCenter.current.z + dz
          );
          const halfX = size.x / 2;
          const halfY = size.y / 2;
          const halfZ = size.z / 2;

          for (const other of nonSelectedPieces) {
            const oCenter = new THREE.Vector3(
              other.position3D[0] * 0.001,
              other.position3D[1] * 0.001,
              other.position3D[2] * 0.001
            );
            const oHalf = getGlobalHalfSizes(other.rotation3D, other.largo, other.espesor, other.ancho);
            
            // Accurate AABB gap distance calculation between group and other piece!
            const gapX = Math.max(0, Math.abs(currentCenter.x - oCenter.x) - (halfX + oHalf.x));
            const gapY = Math.max(0, Math.abs(currentCenter.y - oCenter.y) - (halfY + oHalf.y));
            const gapZ = Math.max(0, Math.abs(currentCenter.z - oCenter.z) - (halfZ + oHalf.z));
            const gapDist = Math.hypot(gapX, gapY, gapZ);

            if (gapDist < 0.25) {
              if (canMoveX) {
                // Candidates X (flush left, right, contact)
                const candX = [
                  oCenter.x - oHalf.x - halfX,
                  oCenter.x + oHalf.x + halfX,
                  oCenter.x - oHalf.x + halfX,
                  oCenter.x + oHalf.x - halfX
                ];
                for (const cX of candX) {
                  if (Math.abs(currentCenter.x - cX) < snapThreshold) {
                    dx = cX - initialBoxCenter.current.x;
                    anchor.position.x = initialAnchorPos.current.x + dx;
                    break;
                  }
                }
              }

              if (canMoveY) {
                // Candidates Y (flush top/bottom, contact top/bottom)
                const candY = [
                  oCenter.y + oHalf.y + halfY,
                  oCenter.y - oHalf.y - halfY,
                  oCenter.y + oHalf.y - halfY,
                  oCenter.y - oHalf.y + halfY
                ];
                for (const cY of candY) {
                  if (Math.abs(currentCenter.y - cY) < snapThreshold) {
                    dy = cY - initialBoxCenter.current.y;
                    anchor.position.y = initialAnchorPos.current.y + dy;
                    isFloorSnapped = false;
                    break;
                  }
                }
              }

              if (canMoveZ) {
                // Candidates Z (flush front, back, contact)
                const candZ = [
                  oCenter.z - oHalf.z - halfZ,
                  oCenter.z + oHalf.z + halfZ,
                  oCenter.z - oHalf.z + halfZ,
                  oCenter.z + oHalf.z - halfZ
                ];
                for (const cZ of candZ) {
                  if (Math.abs(currentCenter.z - cZ) < snapThreshold) {
                    dz = cZ - initialBoxCenter.current.z;
                    anchor.position.z = initialAnchorPos.current.z + dz;
                    break;
                  }
                }
              }
            }
          }
        }

        lastDeltaRef.current = { dx, dy, dz };

        // Synchronously move ALL pieces in the group at the exact same instant!
        selectedPieces.forEach(p => {
          const grp = pieceGroupsRef.current.get(p.id);
          const initPos = initialPiecePositions.current.get(p.id);
          if (grp && initPos) {
            grp.position.set(initPos.x + dx, initPos.y + dy, initPos.z + dz);
          }
        });

        // Also update bounding box cage in real time!
        if (boxVisualRef.current) {
          boxVisualRef.current.position.set(
            initialBoxCenter.current.x + dx,
            initialBoxCenter.current.y + dy,
            initialBoxCenter.current.z + dz
          );
        }

        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            const mmDx = Math.round(dx * 1000);
            const mmDy = Math.round(dy * 1000);
            const mmDz = Math.round(dz * 1000);
            const dist = Math.round(Math.hypot(mmDx, mmDy, mmDz));
            window.dispatchEvent(new CustomEvent('piece-displacement-update', {
              detail: { dx: mmDx, dy: mmDy, dz: mmDz, dist, isDragging: true, isFloorSnapped }
            }));
            if (isFloorSnapped) {
              window.dispatchEvent(new CustomEvent('floor-snap-target', {
                detail: {
                  active: true,
                  x: anchor.position.x,
                  z: anchor.position.z,
                  halfX: size.x / 2,
                  halfZ: size.z / 2
                }
              }));
            } else {
              window.dispatchEvent(new CustomEvent('floor-snap-target', { detail: { active: false } }));
            }
            invalidate();
            rafId = null;
          });
        }
      } else if (transformMode === 'rotate') {
        const currRot = anchor.rotation;
        const deltaEuler = new THREE.Euler(
          currRot.x - initialAnchorRot.current.x,
          currRot.y - initialAnchorRot.current.y,
          currRot.z - initialAnchorRot.current.z
        );
        lastDeltaRotRef.current.copy(deltaEuler);

        selectedPieces.forEach(p => {
          const grp = pieceGroupsRef.current.get(p.id);
          const initPos = initialPiecePositions.current.get(p.id);
          const initRot = initialPieceRotations.current.get(p.id);
          if (grp && initPos) {
            const offset = initPos.clone().sub(initialAnchorPos.current);
            offset.applyEuler(deltaEuler);
            grp.position.copy(initialAnchorPos.current.clone().add(offset));
            if (initRot) {
              const qInit = new THREE.Quaternion().setFromEuler(initRot);
              const qDelta = new THREE.Quaternion().setFromEuler(deltaEuler);
              grp.rotation.setFromQuaternion(qDelta.multiply(qInit));
            }
          }
        });

        if (boxVisualRef.current) {
          boxVisualRef.current.rotation.copy(deltaEuler);
        }

        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            const dX = Math.round(THREE.MathUtils.radToDeg(deltaEuler.x));
            const dY = Math.round(THREE.MathUtils.radToDeg(deltaEuler.y));
            const dZ = Math.round(THREE.MathUtils.radToDeg(deltaEuler.z));
            const activeAxis = Math.abs(dY) >= Math.abs(dX) && Math.abs(dY) >= Math.abs(dZ) ? 'Y' : Math.abs(dX) >= Math.abs(dZ) ? 'X' : 'Z';
            const angle = activeAxis === 'Y' ? dY : (activeAxis === 'X' ? dX : dZ);
            window.dispatchEvent(new CustomEvent('piece-rotation-update', {
              detail: { dRotX: dX, dRotY: dY, dRotZ: dZ, angle, axis: activeAxis, isDragging: true }
            }));
            invalidate();
            rafId = null;
          });
        }
      }
    };

    const handleTransformEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (orbitControls) orbitControls.enabled = true;

      const { dx, dy, dz } = lastDeltaRef.current;
      const deltaRot = lastDeltaRotRef.current;

      const updates = selectedPieces.map(p => {
        const initPos = initialPiecePositions.current.get(p.id) || new THREE.Vector3(
          p.position3D[0] * 0.001,
          p.position3D[1] * 0.001,
          p.position3D[2] * 0.001
        );
        const initRot = initialPieceRotations.current.get(p.id) || new THREE.Euler(
          p.rotation3D[0],
          p.rotation3D[1],
          p.rotation3D[2]
        );

        if (transformMode === 'translate') {
          const finalPosX = Math.round((initPos.x + dx) * 1000);
          const finalPosY = Math.round((initPos.y + dy) * 1000);
          const finalPosZ = Math.round((initPos.z + dz) * 1000);

          const grp = pieceGroupsRef.current.get(p.id);
          if (grp) {
            grp.position.set(finalPosX * 0.001, finalPosY * 0.001, finalPosZ * 0.001);
          }

          return {
            id: p.id,
            position: [finalPosX, finalPosY, finalPosZ] as [number, number, number],
            rotation: p.rotation3D
          };
        } else if (transformMode === 'rotate') {
          const offset = initPos.clone().sub(initialAnchorPos.current);
          offset.applyEuler(deltaRot);
          const newPos = initialAnchorPos.current.clone().add(offset);
          const qInit = new THREE.Quaternion().setFromEuler(initRot);
          const qDelta = new THREE.Quaternion().setFromEuler(deltaRot);
          const newEuler = new THREE.Euler().setFromQuaternion(qDelta.multiply(qInit));

          const finalPosX = Math.round(newPos.x * 1000);
          const finalPosY = Math.round(newPos.y * 1000);
          const finalPosZ = Math.round(newPos.z * 1000);

          const grp = pieceGroupsRef.current.get(p.id);
          if (grp) {
            grp.position.copy(newPos);
            grp.rotation.copy(newEuler);
          }

          return {
            id: p.id,
            position: [finalPosX, finalPosY, finalPosZ] as [number, number, number],
            rotation: [newEuler.x, newEuler.y, newEuler.z] as [number, number, number]
          };
        }

        return {
          id: p.id,
          position: p.position3D,
          rotation: p.rotation3D
        };
      });

      if (anchor) {
        anchor.rotation.set(0, 0, 0);
      }
      if (boxVisualRef.current) {
        boxVisualRef.current.rotation.set(0, 0, 0);
      }

      if (onUpdateMultiplePiecesTransform) {
        onUpdateMultiplePiecesTransform(updates);
      } else {
        updates.forEach(u => onUpdatePieceTransform(u.id, u.position, u.rotation));
      }

      window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: null }));
      window.dispatchEvent(new CustomEvent('piece-rotation-update', { detail: null }));
      window.dispatchEvent(new CustomEvent('floor-snap-target', { detail: { active: false } }));
      invalidate();
    };

    controls.addEventListener('mouseDown', handleMouseDown);
    controls.addEventListener('dragging-changed', handleDraggingChanged);
    controls.addEventListener('change', handleChange);

    return () => {
      controls.removeEventListener('mouseDown', handleMouseDown);
      controls.removeEventListener('dragging-changed', handleDraggingChanged);
      controls.removeEventListener('change', handleChange);
    };
  }, [selectedPieces, allPieces, transformMode, snapActive, center, minY, size, orbitControls, invalidate, onUpdateMultiplePiecesTransform, onUpdatePieceTransform, anchor]);

  return (
    <>
      {/* 3D Visual Bounding Box Cage without floating badge */}
      <GroupBoundingBoxCage
        size={size}
        boxVisualRef={boxVisualRef}
      />

      {/* Anchor group for TransformControls gizmo */}
      <group ref={setAnchor} position={center} />

      {/* The Unified Group Transform Gizmo */}
      {anchor && transformMode !== 'scale' && transformMode !== 'texture' && (
        <TransformControls
          ref={transformRef}
          object={anchor}
          mode={transformMode as any}
          size={controlsSize}
          showY={true}
        />
      )}
    </>
  );
};

function GroundSnapVisualizer() {
  const [snapInfo, setSnapInfo] = useState<{
    active: boolean;
    x: number;
    z: number;
    halfX: number;
    halfZ: number;
  } | null>(null);

  const [flash, setFlash] = useState(false);
  const [flashPos, setFlashPos] = useState<{ x: number; z: number; halfX: number; halfZ: number } | null>(null);

  useEffect(() => {
    const handleFloorSnap = (e: any) => {
      if (e.detail && e.detail.active) {
        setSnapInfo(e.detail);
      } else {
        setSnapInfo(null);
      }
    };

    const handleFloorFlash = (e: any) => {
      if (e.detail) {
        setFlashPos(e.detail);
      }
      setFlash(true);
      setTimeout(() => {
        setFlash(false);
        setFlashPos(null);
      }, 400);
    };

    window.addEventListener('floor-snap-target', handleFloorSnap);
    window.addEventListener('floor-snap-flash', handleFloorFlash);
    return () => {
      window.removeEventListener('floor-snap-target', handleFloorSnap);
      window.removeEventListener('floor-snap-flash', handleFloorFlash);
    };
  }, []);

  const current = snapInfo || flashPos;
  if (!current && !flash) return null;

  const width = current ? Math.max(current.halfX * 2, 0.05) : 0.4;
  const depth = current ? Math.max(current.halfZ * 2, 0.05) : 0.4;
  const posX = current ? current.x : 0;
  const posZ = current ? current.z : 0;

  return (
    <group position={[posX, 0.001, posZ]}>
      {/* Semi-transparent magnetic contact footprint on the floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 0.015, depth + 0.015]} />
        <meshBasicMaterial 
          color="#f59e0b" 
          transparent 
          opacity={flash ? 0.65 : 0.28} 
          depthWrite={false}
        />
      </mesh>
      
      {/* High-visibility golden boundary on the floor */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(width + 0.015, depth + 0.015)]} />
        <lineBasicMaterial color={flash ? "#ffffff" : "#fbbf24"} />
      </lineSegments>

      {/* Grid crosshairs radiating along floor to indicate magnetic floor contact */}
      <lineSegments position={[0, 0.001, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              -width - 0.25, 0, 0,
               width + 0.25, 0, 0,
              0, 0, -depth - 0.25,
              0, 0,  depth + 0.25,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={flash ? "#ffffff" : "#f59e0b"} transparent opacity={0.65} />
      </lineSegments>
    </group>
  );
}

function CameraNavigationController({
  controlsRef,
  selectedPiece,
  pieces = []
}: {
  controlsRef: React.RefObject<any>;
  selectedPiece?: Piece;
  pieces?: Piece[];
}) {
  const { camera, invalidate } = useThree();

  const animRef = useRef<{
    active: boolean;
    startCamPos: THREE.Vector3;
    targetCamPos: THREE.Vector3;
    startLookAt: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    startTime: number;
    duration: number;
  }>({
    active: false,
    startCamPos: new THREE.Vector3(),
    targetCamPos: new THREE.Vector3(),
    startLookAt: new THREE.Vector3(),
    targetLookAt: new THREE.Vector3(),
    startTime: 0,
    duration: 350
  });

  const triggerAnimation = useCallback((targetLookAt: THREE.Vector3, targetDist: number) => {
    if (!controlsRef.current) return;
    const startCamPos = camera.position.clone();
    const startLookAt = controlsRef.current.target ? controlsRef.current.target.clone() : new THREE.Vector3();

    // Direction from target to camera
    let dir = camera.position.clone().sub(startLookAt).normalize();
    if (dir.lengthSq() < 0.0001 || !isFinite(dir.x)) {
      dir = new THREE.Vector3(1, 0.8, 1).normalize();
    }

    const targetCamPos = targetLookAt.clone().add(dir.multiplyScalar(targetDist));

    animRef.current = {
      active: true,
      startCamPos,
      targetCamPos,
      startLookAt,
      targetLookAt: targetLookAt.clone(),
      startTime: performance.now(),
      duration: 350
    };
    invalidate();
  }, [camera, controlsRef, invalidate]);

  useEffect(() => {
    const handleFocusPoint = (e: any) => {
      const pt = e.detail?.point;
      if (pt) {
        const vPoint = new THREE.Vector3(pt.x, pt.y, pt.z);
        // Focus closely on the clicked point (7cm distance for fine details like grooves without clipping)
        triggerAnimation(vPoint, 0.07);
      }
    };

    const handleFocusPiece = (e?: any) => {
      const targetP = e?.detail?.pieceId
        ? pieces.find(p => p.id === e.detail.pieceId)
        : selectedPiece;

      if (targetP) {
        const scale = 0.001;
        const pPos = new THREE.Vector3(
          targetP.position3D[0] * scale,
          targetP.position3D[1] * scale,
          targetP.position3D[2] * scale
        );
        const maxDim = Math.max(targetP.largo, targetP.ancho, targetP.espesor) * scale;
        // Si la pieza tiene ranura, acercar a 8-12cm para apreciar el mecanizado al detalle
        const targetDist = targetP.ranurado
          ? Math.max(0.08, Math.min(0.20, maxDim * 0.28))
          : Math.max(0.12, Math.min(0.38, maxDim * 0.45));
        triggerAnimation(pPos, targetDist);
      }
    };

    const handleResetCamera = () => {
      if (!pieces || pieces.length === 0) {
        triggerAnimation(new THREE.Vector3(0, 0, 0), 1.8);
        return;
      }
      const scale = 0.001;
      const box = new THREE.Box3();
      pieces.forEach(p => {
        const cx = p.position3D[0] * scale;
        const cy = p.position3D[1] * scale;
        const cz = p.position3D[2] * scale;
        const hx = (p.largo * scale) / 2;
        const hy = (p.espesor * scale) / 2;
        const hz = (p.ancho * scale) / 2;
        box.expandByPoint(new THREE.Vector3(cx - hx, cy - hy, cz - hz));
        box.expandByPoint(new THREE.Vector3(cx + hx, cy + hy, cz + hz));
      });
      const center = new THREE.Vector3();
      box.getCenter(center);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const targetDist = Math.max(0.7, maxDim * 1.6);
      triggerAnimation(center, targetDist);
    };

    window.addEventListener('focus-3d-point', handleFocusPoint);
    window.addEventListener('focus-selected-piece', handleFocusPiece);
    window.addEventListener('reset-camera', handleResetCamera);
    window.addEventListener('focus-scene-all', handleResetCamera);

    return () => {
      window.removeEventListener('focus-3d-point', handleFocusPoint);
      window.removeEventListener('focus-selected-piece', handleFocusPiece);
      window.removeEventListener('reset-camera', handleResetCamera);
      window.removeEventListener('focus-scene-all', handleResetCamera);
    };
  }, [selectedPiece, pieces, triggerAnimation]);

  useFrame(() => {
    if (!animRef.current.active || !controlsRef.current) return;
    const now = performance.now();
    const elapsed = now - animRef.current.startTime;
    const progress = Math.min(1, elapsed / animRef.current.duration);
    const ease = 1 - Math.pow(1 - progress, 3); // Ease-out cubic

    camera.position.lerpVectors(animRef.current.startCamPos, animRef.current.targetCamPos, ease);
    if (controlsRef.current.target) {
      controlsRef.current.target.lerpVectors(animRef.current.startLookAt, animRef.current.targetLookAt, ease);
      controlsRef.current.update();
    }
    invalidate();

    if (progress >= 1) {
      animRef.current.active = false;
    }
  });

  return null;
}

export default function ThreeViewer({
  pieces,
  selectedPieceIds,
  groups,
  onSelectPiece,
  onUpdatePieceTransform,
  onUpdateMultiplePiecesTransform,
  onUpdatePieceScale,
  onUpdatePieceDimensions,
  onDoubleClickPiece,
  onEditDimensionAxis,
  hide3DLabels = false,
  transformMode,
  fredoAxis,
  onChangeFredoAxis,
  fredoMode,
  onChangeFredoMode,
  fredoPlaneRatio,
  onChangeFredoPlaneRatio,
  fredoPreviewDelta,
  onChangeFredoPreviewDelta,
  onCommitFredoStretch,
  dimensionSide = 'pos',
  anchorMode = 'single',
  snapActive = true,
  floorSnapActive = true,
  pieceSnapActive = true,
  onUnusedScale,
  edgeThicknessConfig,
  activeTextureFace = 'all',
  onSelectTextureFace,
  isTextureModalOpen,
  onCanvasPointerDown,
  editingGroupId,
  isBoxSelectActive = false,
  onToggleBoxSelect,
  isBoxSelectAdditive = false,
  onSelectPieceIds,
  onSelectAllPieces,
  onClearSelection
}: ThreeViewerProps) {
  const pieceGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const projectorRef = useRef<((rect: { minX: number; minY: number; maxX: number; maxY: number }) => string[]) | null>(null);
  const [boxDrag, setBoxDrag] = useState<{ startX: number; startY: number; currentX: number; currentY: number; isDragging: boolean } | null>(null);
  const [liveEnclosedCount, setLiveEnclosedCount] = useState(0);

  const handleBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isBoxSelectActive) return;
    e.stopPropagation();
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setBoxDrag({ startX: x, startY: y, currentX: x, currentY: y, isDragging: true });
    setLiveEnclosedCount(0);
  };

  const handleBoxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!boxDrag?.isDragging || !isBoxSelectActive) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    setBoxDrag(prev => prev ? { ...prev, currentX, currentY } : null);

    if (projectorRef.current) {
      const minX = Math.min(boxDrag.startX, currentX);
      const maxX = Math.max(boxDrag.startX, currentX);
      const minY = Math.min(boxDrag.startY, currentY);
      const maxY = Math.max(boxDrag.startY, currentY);
      if ((maxX - minX) >= 5 || (maxY - minY) >= 5) {
        const liveIds = projectorRef.current({ minX, minY, maxX, maxY });
        setLiveEnclosedCount(liveIds.length);
      }
    }
  };

  const handleBoxPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!boxDrag?.isDragging || !isBoxSelectActive) return;
    e.stopPropagation();
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const rect = e.currentTarget.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    const minX = Math.min(boxDrag.startX, endX);
    const maxX = Math.max(boxDrag.startX, endX);
    const minY = Math.min(boxDrag.startY, endY);
    const maxY = Math.max(boxDrag.startY, endY);

    if ((maxX - minX) >= 6 || (maxY - minY) >= 6) {
      if (projectorRef.current) {
        const enclosedIds = projectorRef.current({ minX, minY, maxX, maxY });
        if (navigator.vibrate) {
          try { navigator.vibrate(20); } catch {}
        }
        if (e.shiftKey || isBoxSelectAdditive) {
          const merged = Array.from(new Set([...selectedPieceIds, ...enclosedIds]));
          onSelectPieceIds?.(merged);
        } else {
          onSelectPieceIds?.(enclosedIds);
        }
      }
    }
    setBoxDrag(null);
    setLiveEnclosedCount(0);
  };

  const handleBoxPointerCancel = () => {
    setBoxDrag(null);
    setLiveEnclosedCount(0);
  };

  const registerPieceGroup = useCallback((pieceId: string, grp: THREE.Group | null) => {
    if (grp) {
      pieceGroupsRef.current.set(pieceId, grp);
    } else {
      pieceGroupsRef.current.delete(pieceId);
    }
  }, []);

  const selectedPieces = useMemo(() => {
    return pieces.filter(p => selectedPieceIds.includes(p.id) && !p.hidden);
  }, [pieces, selectedPieceIds]);

  // Real-time live stretch preview without deforming thickness
  const displayPieces = useMemo(() => {
    if (transformMode === 'stretch' && fredoPreviewDelta && fredoPreviewDelta !== 0 && selectedPieces.length > 0) {
      try {
        const previewResult = calculateFredoStretch({
          pieces: selectedPieces,
          axis: fredoAxis || 'X',
          planeRatio: fredoPlaneRatio ?? 0.5,
          mode: fredoMode || 'anchor-neg',
          deltaMm: fredoPreviewDelta
        });
        const map = new Map(previewResult.updatedPieces.map(p => [p.id, p]));
        return pieces.map(p => map.get(p.id) || p);
      } catch (err) {
        console.error('Error calculating FredoStretch preview', err);
        return pieces;
      }
    }
    return pieces;
  }, [pieces, transformMode, fredoPreviewDelta, selectedPieces, fredoAxis, fredoPlaneRatio, fredoMode]);

  const isGroupTransformActive = !editingGroupId && (selectedPieces.length > 1 || (selectedPieces.length === 1 && !!selectedPieces[0].groupId));
  const orbitControlsRef = useRef<any>(null);

  return (
    <div 
      className="absolute inset-0 bg-transparent overflow-hidden"
      onPointerDown={() => onCanvasPointerDown?.()}
    >
      <CanvasErrorBoundary fallbackTitle="Visor 3D (Optimización Móvil)">
        <Canvas 
          camera={{ position: [2, 2, 2], fov: 45, near: 0.001, far: 200 }}
          dpr={[1, Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 1.5)]}
          gl={{
            antialias: true,
            powerPreference: 'default',
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false,
            alpha: false
          }}
          shadows
          onPointerMissed={() => {
            onSelectPiece(null, false);
            onCanvasPointerDown?.();
          }}
          onCreated={({ gl }) => {
            // Listen for webglcontextlost to gracefully handle mobile device app switching / low memory
            const domElement = gl.domElement;
            const handleContextLost = (event: Event) => {
              event.preventDefault();
              console.warn('WebGL context lost, pausing render.');
            };
            const handleContextRestored = () => {
              console.info('WebGL context restored, resuming render.');
            };
            domElement.addEventListener('webglcontextlost', handleContextLost, false);
            domElement.addEventListener('webglcontextrestored', handleContextRestored, false);
          }}
        >
          <color attach="background" args={['#393939']} />
          <ambientLight intensity={1.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          <spotLight 
            position={[-10, 10, 10]} 
            angle={0.2} 
            penumbra={1} 
            intensity={1} 
            castShadow 
            shadow-mapSize={[512, 512]}
            shadow-bias={-0.0005}
          />
          
          <gridHelper args={[20, 40, '#282828', '#282828']} position={[0, -0.001, 0]} />
          <axesHelper args={[2]} />
          <GroundSnapVisualizer />

          {/* FredoScale Box Stretch Gizmo (Non-deforming group stretch with cutting plane grid) */}
          {transformMode === 'stretch' && selectedPieces.length > 0 && (
            <FredoScaleGizmo
              selectedPieces={selectedPieces}
              axis={fredoAxis || 'X'}
              onChangeAxis={onChangeFredoAxis || (() => {})}
              mode={fredoMode || 'anchor-neg'}
              onChangeMode={onChangeFredoMode || (() => {})}
              planeRatio={fredoPlaneRatio ?? 0.5}
              onChangePlaneRatio={onChangeFredoPlaneRatio || (() => {})}
              previewDelta={fredoPreviewDelta || 0}
              onPreviewDeltaChange={onChangeFredoPreviewDelta || (() => {})}
              onCommitStretch={onCommitFredoStretch || (() => {})}
            />
          )}

          {isGroupTransformActive && transformMode !== 'stretch' && (
            <GroupTransformControls
              selectedPieces={selectedPieces}
              allPieces={pieces}
              groups={groups}
              transformMode={transformMode}
              snapActive={snapActive}
              floorSnapActive={floorSnapActive}
              pieceSnapActive={pieceSnapActive}
              pieceGroupsRef={pieceGroupsRef}
              onUpdateMultiplePiecesTransform={onUpdateMultiplePiecesTransform}
              onUpdatePieceTransform={onUpdatePieceTransform}
            />
          )}
   
          {displayPieces.map((piece) => {
            if (piece.hidden) return null;
            return piece.cantidad > 0 && Array.from({ length: piece.cantidad }).map((_, idx) => (
              <MelaminePiece
                key={`${piece.id}-${idx}`}
                piece={{
                  ...piece,
                  // offset copies slightly so they don't overlap totally perfectly
                  position3D: [
                    piece.position3D[0],
                    piece.position3D[1] + (idx * piece.espesor * 1.5),
                    piece.position3D[2]
                  ]
                }}
                allPieces={displayPieces}
                isSelected={selectedPieceIds.includes(piece.id)}
                showControls={!isGroupTransformActive && transformMode !== 'stretch' && selectedPieceIds[0] === piece.id && idx === 0}
                registerPieceGroup={idx === 0 ? registerPieceGroup : undefined}
                onClick={(e) => onSelectPiece(piece.id, e.shiftKey || e.ctrlKey || e.metaKey)}
                onTransformEnd={(pos, rot, scale) => {
                   onUpdatePieceTransform(piece.id, pos, rot);
                   if (onUpdatePieceScale && (scale[0] !== 1 || scale[1] !== 1 || scale[2] !== 1)) {
                       onUpdatePieceScale(piece.id, scale[0], scale[1], scale[2]);
                   }
                }}
                onUpdateDimensions={onUpdatePieceDimensions ? (dx, dy, dz, originOffset) => onUpdatePieceDimensions(piece.id, dx, dy, dz, originOffset[0], originOffset[1], originOffset[2]) : undefined}
                onDoubleClickPiece={onDoubleClickPiece}
                onEditDimensionAxis={onEditDimensionAxis}
                hide3DLabels={hide3DLabels}
                transformMode={transformMode}
                dimensionSide={dimensionSide}
                anchorMode={anchorMode}
                snapActive={snapActive}
                floorSnapActive={floorSnapActive}
                pieceSnapActive={pieceSnapActive}
                edgeThicknessConfig={edgeThicknessConfig}
                activeTextureFace={activeTextureFace}
                onSelectTextureFace={onSelectTextureFace}
                isTextureModalOpen={isTextureModalOpen}
              />
            ));
          })}

          <SelectionProjector
            pieces={pieces}
            editingGroupId={editingGroupId}
            pieceGroupsRef={pieceGroupsRef}
            onRegisterProjector={(fn) => { projectorRef.current = fn; }}
          />

          <CameraNavigationController
            controlsRef={orbitControlsRef}
            selectedPiece={pieces.find(p => selectedPieceIds.includes(p.id))}
            pieces={pieces}
          />

          <OrbitControls 
            ref={orbitControlsRef}
            makeDefault 
            enabled={!isBoxSelectActive && !boxDrag?.isDragging}
            enableDamping={true}
            dampingFactor={0.08}
            screenSpacePanning={true}
            minDistance={0.001}
            maxDistance={80}
            zoomSpeed={0.85}
            rotateSpeed={0.65}
            panSpeed={0.45}
          />
        </Canvas>
      </CanvasErrorBoundary>

      {/* Box Selection Transparent Overlay (Active only when isBoxSelectActive) */}
      {isBoxSelectActive && (
        <div
          className="absolute inset-0 z-20 cursor-crosshair touch-none select-none"
          onPointerDown={handleBoxPointerDown}
          onPointerMove={handleBoxPointerMove}
          onPointerUp={handleBoxPointerUp}
          onPointerCancel={handleBoxPointerCancel}
        >
          {/* Top Banner indicating Box Select Mode - Situada más abajo para no tapar las pestañas superiores */}
          <div className="absolute top-14 sm:top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-[#181818]/95 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#f0a144] shadow-2xl flex items-center gap-2 text-white animate-in fade-in slide-in-from-top-2 duration-150 max-w-[95vw]">
            <MousePointerSquareDashed className="w-3.5 h-3.5 text-[#f0a144] animate-pulse shrink-0" />
            <span className="text-[8px] sm:text-[9.5px] font-bold text-gray-200 truncate">
              {liveEnclosedCount > 0 ? `${liveEnclosedCount} ${liveEnclosedCount === 1 ? 'pieza en recuadro' : 'piezas en recuadro'}` : 'Desliza en pantalla para encerrar piezas'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {onSelectAllPieces && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (navigator.vibrate) {
                      try { navigator.vibrate(20); } catch {}
                    }
                    onSelectAllPieces();
                  }}
                  className="text-[7.5px] font-black uppercase bg-[#2a2a2a] hover:bg-[#333] text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95 shrink-0"
                  title="Seleccionar todas las piezas"
                >
                  Todo
                </button>
              )}
              {selectedPieceIds.length > 0 && onClearSelection && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (navigator.vibrate) {
                      try { navigator.vibrate(15); } catch {}
                    }
                    onClearSelection();
                  }}
                  className="text-[7.5px] font-black uppercase bg-[#2a2a2a] hover:bg-[#333] text-red-400 border border-red-500/30 px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95 shrink-0"
                  title="Deseleccionar todo"
                >
                  Limpiar
                </button>
              )}
              {onToggleBoxSelect && (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (navigator.vibrate) {
                      try { navigator.vibrate(15); } catch {}
                    }
                    onToggleBoxSelect();
                  }}
                  className="text-[7.5px] font-black uppercase bg-[#f0a144] hover:bg-[#ffba66] text-black px-2 py-0.5 rounded cursor-pointer transition-all active:scale-95 shrink-0"
                >
                  Listo ✓
                </button>
              )}
            </div>
          </div>

          {/* Marquee Selection Rectangle (Animated CAD box with live counter) */}
          {boxDrag && boxDrag.isDragging && (
            <div
              className="absolute pointer-events-none border-2 border-dashed border-[#f0a144] bg-[#f0a144]/15 rounded-xs transition-none shadow-[0_0_15px_rgba(240,161,68,0.25)]"
              style={{
                left: Math.min(boxDrag.startX, boxDrag.currentX),
                top: Math.min(boxDrag.startY, boxDrag.currentY),
                width: Math.abs(boxDrag.currentX - boxDrag.startX),
                height: Math.abs(boxDrag.currentY - boxDrag.startY),
              }}
            >
              <div className="absolute top-1 left-1 bg-black/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-mono font-black text-[#f0a144] border border-[#f0a144]/40 flex items-center gap-1 shadow-lg select-none whitespace-nowrap">
                <MousePointerSquareDashed className="w-2.5 h-2.5" />
                <span>{liveEnclosedCount} {liveEnclosedCount === 1 ? 'pieza' : 'piezas'}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SelectionProjector({
  pieces,
  editingGroupId,
  pieceGroupsRef,
  onRegisterProjector
}: {
  pieces: Piece[];
  editingGroupId?: string | null;
  pieceGroupsRef: React.MutableRefObject<Map<string, THREE.Group>>;
  onRegisterProjector: (fn: (rect: { minX: number; minY: number; maxX: number; maxY: number }) => string[]) => void;
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    const projectBox = (rect: { minX: number; minY: number; maxX: number; maxY: number }): string[] => {
      const selected = new Set<string>();

      pieces.forEach(piece => {
        if (piece.hidden) return;
        const grp = pieceGroupsRef.current.get(piece.id);

        let screenMinX = Infinity;
        let screenMaxX = -Infinity;
        let screenMinY = Infinity;
        let screenMaxY = -Infinity;
        let hasPointsInFront = false;

        if (grp) {
          const box3 = new THREE.Box3().setFromObject(grp);
          if (!box3.isEmpty()) {
            const corners = [
              new THREE.Vector3(box3.min.x, box3.min.y, box3.min.z),
              new THREE.Vector3(box3.max.x, box3.min.y, box3.min.z),
              new THREE.Vector3(box3.min.x, box3.max.y, box3.min.z),
              new THREE.Vector3(box3.max.x, box3.max.y, box3.min.z),
              new THREE.Vector3(box3.min.x, box3.min.y, box3.max.z),
              new THREE.Vector3(box3.max.x, box3.min.y, box3.max.z),
              new THREE.Vector3(box3.min.x, box3.max.y, box3.max.z),
              new THREE.Vector3(box3.max.x, box3.max.y, box3.max.z),
            ];

            for (const c of corners) {
              const p = c.clone().project(camera);
              if (p.z >= -1 && p.z <= 1) {
                hasPointsInFront = true;
              }
              const sx = ((p.x + 1) / 2) * size.width;
              const sy = ((-p.y + 1) / 2) * size.height;
              screenMinX = Math.min(screenMinX, sx);
              screenMaxX = Math.max(screenMaxX, sx);
              screenMinY = Math.min(screenMinY, sy);
              screenMaxY = Math.max(screenMaxY, sy);
            }
          }
        }

        if (!hasPointsInFront || screenMinX === Infinity) {
          const v = new THREE.Vector3(piece.position3D[0] / 1000, piece.position3D[1] / 1000, piece.position3D[2] / 1000).project(camera);
          if (v.z >= -1 && v.z <= 1) {
            hasPointsInFront = true;
            const sx = ((v.x + 1) / 2) * size.width;
            const sy = ((-v.y + 1) / 2) * size.height;
            screenMinX = sx - 15;
            screenMaxX = sx + 15;
            screenMinY = sy - 15;
            screenMaxY = sy + 15;
          }
        }

        if (hasPointsInFront) {
          const overlaps = (
            screenMinX <= rect.maxX && screenMaxX >= rect.minX &&
            screenMinY <= rect.maxY && screenMaxY >= rect.minY
          );
          if (overlaps) {
            selected.add(piece.id);
          }
        }
      });

      const finalSelected = new Set(selected);
      pieces.forEach(p => {
        if (p.groupId && selected.has(p.id) && (!editingGroupId || editingGroupId !== p.groupId)) {
          pieces.filter(sibling => sibling.groupId === p.groupId).forEach(sibling => finalSelected.add(sibling.id));
        }
      });

      return Array.from(finalSelected);
    };

    onRegisterProjector(projectBox);
  }, [camera, size, pieces, editingGroupId, pieceGroupsRef, onRegisterProjector]);

  return null;
}
