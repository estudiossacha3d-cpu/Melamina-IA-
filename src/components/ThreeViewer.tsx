import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { Piece, EdgeThicknessConfig, PieceFaceKey, FaceTextureOptions, Group3D } from '../types';
import { getOrCreateThreeTexture, getPelikanoTextureUrl } from '../lib/textureManager';
import CanvasErrorBoundary from './CanvasErrorBoundary';
import FaceTextureGizmo from './FaceTextureGizmo';
import { FredoScaleGizmo } from './FredoScaleGizmo';
import { FredoStretchAxis, FredoStretchMode, calculateFredoStretch } from '../lib/fredoStretch';

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
  onLongPressPiece?: (pieceId: string) => void;
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
  onUnusedScale?: any;
  edgeThicknessConfig?: EdgeThicknessConfig;
  activeTextureFace?: PieceFaceKey | 'all';
  onSelectTextureFace?: (face: PieceFaceKey | 'all') => void;
  isTextureModalOpen?: boolean;
  onCanvasPointerDown?: () => void;
  editingGroupId?: string | null;
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

  return (
    <group position={position}>
      {/* Visual connector line to piece edge */}
      <mesh
        position={[
          axis === 'largo' ? (side === 'pos' ? -0.013 : 0.013) : 0,
          axis === 'espesor' ? (side === 'pos' ? -0.013 : 0.013) : 0,
          axis === 'ancho' ? (side === 'pos' ? -0.013 : 0.013) : 0
        ]}
      >
        <boxGeometry
          args={[
            axis === 'largo' ? 0.026 : 0.002,
            axis === 'espesor' ? 0.026 : 0.002,
            axis === 'ancho' ? 0.026 : 0.002
          ]}
        />
        <meshBasicMaterial color={isSnapped ? '#fbbf24' : color} opacity={isSnapped ? 0.9 : 0.6} transparent />
      </mesh>

      {/* Larger invisible hit area for comfortable touch on mobile devices (110mm / >44px) */}
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          try {
            (e.nativeEvent?.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
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
        <boxGeometry args={[0.11, 0.11, 0.11]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Visible Handle Cube with Magnetic Glow */}
      <mesh scale={isSnapped ? [1.45, 1.45, 1.45] : hovered ? [1.3, 1.3, 1.3] : [1, 1, 1]}>
        <boxGeometry args={[0.024, 0.024, 0.024]} />
        <meshStandardMaterial
          color={isSnapped ? '#fbbf24' : hovered ? '#ffffff' : color}
          emissive={isSnapped ? '#f59e0b' : hovered ? color : '#000000'}
          emissiveIntensity={isSnapped ? 0.9 : 0.6}
          roughness={0.2}
          metalness={0.25}
        />
        <Edges scale={1.02} threshold={15} color={isSnapped ? '#ffffff' : hovered ? '#ffffff' : '#000000'} />
      </mesh>
    </group>
  );
};

interface DimensionSnapResult {
  delta: number;
  isSnapped: boolean;
  targetPieceId: string | null;
  snapType?: 'step' | 'match' | 'face' | 'floor';
}

function calculateDimensionSnap(
  axis: 'largo' | 'ancho' | 'espesor',
  side: 'pos' | 'neg',
  rawDeltaMm: number,
  startDim: number,
  isSymmetric: boolean,
  piece: Piece,
  allPieces: Piece[],
  group: THREE.Group
): DimensionSnapResult {
  const minDim = axis === 'espesor' ? 1 : 10;
  const rawTargetDim = Math.max(minDim, startDim + rawDeltaMm);

  interface Candidate {
    delta: number;
    threshold: number;
    priority: number;
    targetPieceId: string | null;
    snapType: 'step' | 'match' | 'face' | 'floor';
  }

  const candidates: Candidate[] = [];

  // 1. Grid / Standard Step Candidates
  if (axis === 'espesor') {
    const standardThicknesses = [3, 4, 5.5, 6, 9, 12, 15, 18, 19, 25, 30, 36];
    for (const th of standardThicknesses) {
      candidates.push({
        delta: th - startDim,
        threshold: 7,
        priority: 3,
        targetPieceId: null,
        snapType: 'step'
      });
    }
  } else {
    // 10mm modular step
    const step10 = Math.round(rawTargetDim / 10) * 10;
    candidates.push({
      delta: step10 - startDim,
      threshold: 5,
      priority: 1,
      targetPieceId: null,
      snapType: 'step'
    });

    // 50mm modular step (stronger magnet)
    const step50 = Math.round(rawTargetDim / 50) * 50;
    candidates.push({
      delta: step50 - startDim,
      threshold: 9,
      priority: 2,
      targetPieceId: null,
      snapType: 'step'
    });
  }

  // 2. Matching dimensions of other pieces in project
  for (const other of allPieces) {
    if (other.id === piece.id) continue;
    // Same axis dimension match (e.g. aligning shelf length to side height or other shelf)
    const otherSameDim = axis === 'largo' ? other.largo : (axis === 'ancho' ? other.ancho : other.espesor);
    candidates.push({
      delta: otherSameDim - startDim,
      threshold: 12,
      priority: 3,
      targetPieceId: other.id,
      snapType: 'match'
    });

    // Perpendicular dimension match (e.g. shelf length matching depth)
    if (axis === 'largo') {
      candidates.push({
        delta: other.ancho - startDim,
        threshold: 10,
        priority: 3,
        targetPieceId: other.id,
        snapType: 'match'
      });
    } else if (axis === 'ancho') {
      candidates.push({
        delta: other.largo - startDim,
        threshold: 10,
        priority: 3,
        targetPieceId: other.id,
        snapType: 'match'
      });
    }
  }

  // 3. World Space Face Alignment with other pieces & floor
  const localVec = axis === 'largo'
    ? new THREE.Vector3(1, 0, 0)
    : axis === 'espesor'
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(0, 0, 1);
  const worldDir = localVec.clone().applyEuler(group.rotation).normalize();

  const absX = Math.abs(worldDir.x);
  const absY = Math.abs(worldDir.y);
  const absZ = Math.abs(worldDir.z);

  let primaryCoord: 'x' | 'y' | 'z' | null = null;
  if (absX > 0.7) primaryCoord = 'x';
  else if (absY > 0.7) primaryCoord = 'y';
  else if (absZ > 0.7) primaryCoord = 'z';

  if (primaryCoord) {
    const dirComponent = worldDir[primaryCoord];
    const sideMultiplier = side === 'pos' ? 1 : -1;
    const factor = sideMultiplier * (isSymmetric ? 0.5 : 1.0) * dirComponent * 0.001;

    if (Math.abs(factor) > 0.00001) {
      const faceLocal = new THREE.Vector3(0, 0, 0);
      if (axis === 'largo') faceLocal.x = (sideMultiplier * startDim / 2) * 0.001;
      else if (axis === 'espesor') faceLocal.y = (sideMultiplier * startDim / 2) * 0.001;
      else faceLocal.z = (sideMultiplier * startDim / 2) * 0.001;

      const initialFaceWorld = group.localToWorld(faceLocal.clone());
      const initialCoord = initialFaceWorld[primaryCoord];

      // Snap to floor if vertical
      if (primaryCoord === 'y') {
        const floorDeltaMm = (0 - initialCoord) / factor;
        if (startDim + floorDeltaMm >= minDim) {
          candidates.push({
            delta: Math.round(floorDeltaMm),
            threshold: 16,
            priority: 5,
            targetPieceId: null,
            snapType: 'floor'
          });
        }
      }

      // Snap to faces of other pieces
      for (const other of allPieces) {
        if (other.id === piece.id) continue;
        const otherCenter = new THREE.Vector3(
          other.position3D[0] * 0.001,
          other.position3D[1] * 0.001,
          other.position3D[2] * 0.001
        );
        const otherHalf = getGlobalHalfSizes(other.rotation3D, other.largo, other.espesor, other.ancho);
        
        const face1 = otherCenter[primaryCoord] - otherHalf[primaryCoord];
        const face2 = otherCenter[primaryCoord] + otherHalf[primaryCoord];
        const center = otherCenter[primaryCoord];

        for (const targetW of [face1, face2, center]) {
          const targetDeltaMm = (targetW - initialCoord) / factor;
          if (startDim + targetDeltaMm >= minDim) {
            candidates.push({
              delta: Math.round(targetDeltaMm),
              threshold: 16,
              priority: 4,
              targetPieceId: other.id,
              snapType: 'face'
            });
          }
        }
      }
    }
  }

  // 4. Evaluate candidates
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
      targetPieceId: null
    };
  }

  // 5. Magnetic well with soft touch release (no jerkiness)
  const diff = rawDeltaMm - bestCandidate.delta;
  const lockZone = 4; // 4mm full magnetic lock
  if (Math.abs(diff) <= lockZone) {
    return {
      delta: bestCandidate.delta,
      isSnapped: true,
      targetPieceId: bestCandidate.targetPieceId,
      snapType: bestCandidate.snapType
    };
  }

  // Smooth attraction curve between lockZone and threshold
  const normalized = (Math.abs(diff) - lockZone) / Math.max(1, bestCandidate.threshold - lockZone);
  const smoothedDiff = Math.sign(diff) * (lockZone + (bestCandidate.threshold - lockZone) * Math.pow(normalized, 1.5));
  const easedDelta = Math.round(bestCandidate.delta + smoothedDiff);

  return {
    delta: Math.max(minDim - startDim, easedDelta),
    isSnapped: true,
    targetPieceId: bestCandidate.targetPieceId,
    snapType: bestCandidate.snapType
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
  edgeThicknessConfig,
  activeTextureFace = 'all',
  onSelectTextureFace,
  isTextureModalOpen = false,
  onLongPressPiece,
  registerPieceGroup
}: {
  piece: Piece;
  allPieces?: Piece[];
  isSelected: boolean;
  showControls: boolean;
  onClick: (e: any) => void;
  onLongPressPiece?: (pieceId: string) => void;
  onTransformEnd: (pos: [number, number, number], rot: [number, number, number], scale: [number, number, number]) => void;
  onUpdateDimensions?: (dx: number, dy: number, dz: number, originOffset: [number, number, number]) => void;
  onDoubleClickPiece?: (id: string) => void;
  onEditDimensionAxis?: (pieceId: string, axis: 'largo' | 'ancho' | 'espesor') => void;
  hide3DLabels?: boolean;
  transformMode?: 'translate' | 'rotate' | 'scale' | 'texture' | 'stretch';
  dimensionSide?: 'pos' | 'neg';
  anchorMode?: 'single' | 'center';
  snapActive?: boolean;
  edgeThicknessConfig?: EdgeThicknessConfig;
  activeTextureFace?: PieceFaceKey | 'all';
  onSelectTextureFace?: (face: PieceFaceKey | 'all') => void;
  isTextureModalOpen?: boolean;
  registerPieceGroup?: (pieceId: string, group: THREE.Group | null) => void;
}) => {
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const [group, setGroupState] = useState<THREE.Group | null>(null);
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
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);
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
  const wasSnappedRef = useRef(false);

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
    wasSnappedRef.current = false;

    // Stable Drag Plane: contains the world axis of the dimension handle and is oriented towards the camera
    const localAxis = axis === 'largo'
      ? new THREE.Vector3(1, 0, 0)
      : axis === 'espesor'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, 1);
    const worldAxis = localAxis.clone().applyEuler(group.rotation).normalize();
    const camDir = camera.getWorldDirection(new THREE.Vector3());

    let planeNormal = new THREE.Vector3().crossVectors(worldAxis, camDir);
    if (planeNormal.lengthSq() < 0.001) {
      planeNormal.copy(camDir).negate();
    } else {
      planeNormal.crossVectors(planeNormal, worldAxis).normalize();
    }
    if (planeNormal.dot(camDir) > 0) {
      planeNormal.negate();
    }

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, group.position);

    // Initial hit in group local coordinates
    const hitPoint = new THREE.Vector3();
    raycaster.setFromCamera(e.pointer, camera);
    raycaster.ray.intersectPlane(plane, hitPoint);
    const initialHitLocal = group.worldToLocal(hitPoint.clone());

    const startLargo = piece.largo;
    const startAncho = piece.ancho;
    const startEspesor = piece.espesor;
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

      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((moveEvt.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((moveEvt.clientY - rect.top) / rect.height) * 2 - 1);
      const pointer = new THREE.Vector2(ndcX, ndcY);

      raycaster.setFromCamera(pointer, camera);
      const currentHit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(plane, currentHit)) return;

      const currentHitLocal = group.worldToLocal(currentHit.clone());

      let rawDeltaLocal = 0;
      if (axis === 'largo') {
        rawDeltaLocal = currentHitLocal.x - initialHitLocal.x;
      } else if (axis === 'ancho') {
        rawDeltaLocal = currentHitLocal.z - initialHitLocal.z;
      } else if (axis === 'espesor') {
        rawDeltaLocal = currentHitLocal.y - initialHitLocal.y;
      }

      const rawDeltaMm = (side === 'pos' ? rawDeltaLocal : -rawDeltaLocal) / scale;
      const startDim = axis === 'largo' ? startLargo : (axis === 'ancho' ? startAncho : startEspesor);

      const snapResult = snapActive
        ? calculateDimensionSnap(axis, side, rawDeltaMm, startDim, isSymmetric, piece, allPieces, group)
        : { delta: Math.round(rawDeltaMm), isSnapped: false, targetPieceId: null };

      const effectiveDelta = snapResult.delta;

      // Haptic feedback and visual magnet state on mobile / touch
      if (snapResult.isSnapped && !wasSnappedRef.current) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(10); } catch {}
        }
      }
      wasSnappedRef.current = snapResult.isSnapped;

      if (snapResult.targetPieceId) {
        window.dispatchEvent(new CustomEvent('piece-snap-target', {
          detail: { active: true, targetId: snapResult.targetPieceId }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('piece-snap-target', {
          detail: { active: false, targetId: null }
        }));
      }

      setActiveSnapHandle(snapResult.isSnapped ? { axis, side } : null);

      if (axis === 'largo') {
        lastDLargo = effectiveDelta;
        const scaleFactorX = Math.max(0.01, (startLargo + effectiveDelta) / startLargo);
        mesh.scale.set(scaleFactorX, 1, 1);

        if (isSymmetric) {
          mesh.position.set(0, 0, 0);
        } else {
          const sign = side === 'neg' ? -1 : 1;
          mesh.position.set(((sign * effectiveDelta / 2) * scale), 0, 0);
        }

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
                pieceId: piece.id
              }
            }));
            rafMoveId = null;
          });
        }
      } else if (axis === 'ancho') {
        lastDAncho = effectiveDelta;
        const scaleFactorZ = Math.max(0.01, (startAncho + effectiveDelta) / startAncho);
        mesh.scale.set(1, 1, scaleFactorZ);

        if (isSymmetric) {
          mesh.position.set(0, 0, 0);
        } else {
          const sign = side === 'neg' ? -1 : 1;
          mesh.position.set(0, 0, ((sign * effectiveDelta / 2) * scale));
        }

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
                pieceId: piece.id
              }
            }));
            rafMoveId = null;
          });
        }
      } else if (axis === 'espesor') {
        lastDEspesor = effectiveDelta;
        const scaleFactorY = Math.max(0.01, (startEspesor + effectiveDelta) / startEspesor);
        mesh.scale.set(1, scaleFactorY, 1);

        if (isSymmetric) {
          mesh.position.set(0, 0, 0);
        } else {
          const sign = side === 'neg' ? -1 : 1;
          mesh.position.set(0, ((sign * effectiveDelta / 2) * scale), 0);
        }

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

      setActiveSnapHandle(null);
      wasSnappedRef.current = false;
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

  const getSnappedPosition = (targetPos: THREE.Vector3) => {
    let finalPos = targetPos.clone();
    let snapped = false;
    let targetPieceId: string | null = null;
    let isFloorSnapped = false;

    if (transformMode !== 'translate') {
      return { finalPos, snapped, targetPieceId, isFloorSnapped };
    }

    // 1) Magnetic Snap Candidates (Floor plane & other Pieces' Faces, Edges, Corners)
    if (snapActive) {
      const snapThreshold = 0.025; // 25mm magnet snap range (suave y preciso, sin tirones)
      const floorSnapThreshold = 0.03; // 30mm magnet snap range para el suelo

      let bestX = finalPos.x;
      let minDiffX = snapThreshold;
      let snapTargetIdX: string | null = null;

      let bestY = finalPos.y;
      let minDiffY = snapThreshold;
      let snapTargetIdY: string | null = null;

      let bestZ = finalPos.z;
      let minDiffZ = snapThreshold;
      let snapTargetIdZ: string | null = null;

      // Floor snap evaluation: the piece's bottom face is at (finalPos.y - myHalf.y)
      // Resting on the floor (Y = 0) corresponds to finalPos.y = myHalf.y
      const floorDiff = Math.abs(finalPos.y - myHalf.y);
      if (floorDiff <= floorSnapThreshold || finalPos.y < myHalf.y) {
        bestY = myHalf.y;
        minDiffY = floorDiff;
        snapTargetIdY = 'floor';
        isFloorSnapped = true;
      }

      // Check other pieces if there are any
      if (allPieces && allPieces.length > 1) {
        for (const other of allPieces) {
          if (other.id === piece.id) continue;

          const otherCenter = new THREE.Vector3(
            other.position3D[0] * scale,
            other.position3D[1] * scale,
            other.position3D[2] * scale
          );
          const otherHalf = getGlobalHalfSizes(other.rotation3D, other.largo, other.espesor, other.ancho);

          // Compute minimum gap distance between bounding boxes
          const dx = Math.max(0, Math.abs(finalPos.x - otherCenter.x) - (myHalf.x + otherHalf.x));
          const dy = Math.max(0, Math.abs(finalPos.y - otherCenter.y) - (myHalf.y + otherHalf.y));
          const dz = Math.max(0, Math.abs(finalPos.z - otherCenter.z) - (myHalf.z + otherHalf.z));

          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // If nearby (within 250mm)
          if (dist < 0.25) {
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
                isFloorSnapped = false;
              }
            }

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

      if (bestX !== finalPos.x) {
        finalPos.x = bestX;
        snapped = true;
        targetPieceId = snapTargetIdX;
      }
      if (bestY !== finalPos.y) {
        finalPos.y = bestY;
        snapped = true;
        targetPieceId = snapTargetIdY || targetPieceId;
      }
      if (bestZ !== finalPos.z) {
        finalPos.z = bestZ;
        snapped = true;
        targetPieceId = snapTargetIdZ || targetPieceId;
      }
    }

    // Floor barrier: piece bottom cannot sink below the floor (Y < 0) when snap is active
    if (snapActive && finalPos.y < myHalf.y) {
      finalPos.y = myHalf.y;
      snapped = true;
      isFloorSnapped = true;
      targetPieceId = 'floor';
    }

    // 2) Solid Physics Collision Prevention (No Penetration / Fusion)
    // Ensures pieces behave like real solid 3D boards and cannot intersect
    if (allPieces && allPieces.length > 1) {
      for (const other of allPieces) {
        if (other.id === piece.id) continue;

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

        // Soft epsilon (3mm) to detect actual interior penetration without micro-jittering during drag
        if (overlapX > 0.003 && overlapY > 0.003 && overlapZ > 0.003) {
          // Resolve penetration by pushing out along axis with smallest penetration depth
          if (overlapX <= overlapY && overlapX <= overlapZ) {
            finalPos.x = finalPos.x >= otherCenter.x
              ? otherCenter.x + otherHalf.x + myHalf.x
              : otherCenter.x - otherHalf.x - myHalf.x;
          } else if (overlapY <= overlapX && overlapY <= overlapZ) {
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

    // Final safety check for floor height
    if (snapActive && finalPos.y < myHalf.y) {
      finalPos.y = myHalf.y;
      isFloorSnapped = true;
    }

    return { finalPos, snapped, targetPieceId, isFloorSnapped };
  };

  const handleTransformEnd = () => {
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
           const { finalPos: snappedPos, snapped, targetPieceId, isFloorSnapped } = getSnappedPosition(finalPos);

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

    const matL1 = createEdgeMat(piece.cantos.largo1);
    const matL2 = createEdgeMat(piece.cantos.largo2);
    const matA1 = createEdgeMat(piece.cantos.ancho1);
    const matA2 = createEdgeMat(piece.cantos.ancho2);

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

  useEffect(() => {
    if (mesh && materials) {
      mesh.material = materials;
      if (Array.isArray(materials)) {
        materials.forEach(m => {
          m.needsUpdate = true;
        });
      }
      invalidate();
    }
  }, [mesh, materials, invalidate]);

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
      if (group && transformMode === 'translate') {
        isDraggingRef.current = true;
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
        isDraggingRef.current = false;
        setIsDraggingTranslate(false);
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
        const { finalPos, snapped, targetPieceId, isFloorSnapped } = getSnappedPosition(group.position);
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
            if (longPressTriggeredRef.current) {
              longPressTriggeredRef.current = false;
              e.stopPropagation();
              return;
            }
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
            longPressTriggeredRef.current = false;
            pointerStartRef.current = { x: e.clientX, y: e.clientY };

            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
            }

            // Iniciar temporizador de 2 segundos (2000 ms) para empezar a agrupar
            longPressTimerRef.current = setTimeout(() => {
              longPressTriggeredRef.current = true;
              if (onLongPressPiece) {
                onLongPressPiece(piece.id);
              }
            }, 2000);

            if (transformMode === 'scale' && group) {
              const local = group.worldToLocal(e.point.clone());
              if (local.x < -0.005 || local.z < -0.005) {
                setCurrentDimensionSide('neg');
              } else if (local.x > 0.005 || local.z > 0.005) {
                setCurrentDimensionSide('pos');
              }
            }
          }}
          onPointerMove={(e) => {
            if (pointerStartRef.current && longPressTimerRef.current) {
              const dx = e.clientX - pointerStartRef.current.x;
              const dy = e.clientY - pointerStartRef.current.y;
              if (Math.hypot(dx, dy) > 8) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
            }
          }}
          onPointerUp={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }}
          onPointerCancel={() => {
            if (longPressTimerRef.current) {
              clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = null;
            }
          }}
          onDoubleClick={(e) => {
             e.stopPropagation();
             window.dispatchEvent(new CustomEvent('request-transform-mode', { detail: 'scale' }));
             if (onDoubleClickPiece) {
                onDoubleClickPiece(piece.id);
             }
          }}
          material={materials}
        >
          <boxGeometry args={dims} />
          <Edges scale={1} threshold={15} color={flash ? '#10b981' : isSnapTarget ? '#3b82f6' : isSelected ? '#f0a144' : '#111111'} />
        </mesh>

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

          const hasL1Grueso = piece.cantos?.largo1 === 'Canto Grueso';
          const hasL2Grueso = piece.cantos?.largo2 === 'Canto Grueso';
          const hasA1Grueso = piece.cantos?.ancho1 === 'Canto Grueso';
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

        {/* Render the groove visually if ranurado is active */}
        {piece.ranurado && (() => {
          const config = piece.ranuraConfig || { lado: 'L2', dist: 18, esp: 4, prof: 8 };
          const lado = config.lado || 'L2';
          const dist = (config.dist || 18) * scale;
          const esp = (config.esp || 4) * scale;
          const prof = (config.prof || 8) * scale;
          
          let gSize: [number, number, number] = [0, 0, 0];
          let gPos: [number, number, number] = [0, 0, 0];
          
          const pLargo = piece.largo * scale;
          const pEspesor = piece.espesor * scale;
          const pAncho = piece.ancho * scale;
          
          if (lado === 'L1') { // Along Largo (X), near +Z face (Front)
            gSize = [pLargo, prof + 0.0002, esp];
            gPos = [
              0, 
              (pEspesor / 2) - (prof / 2) + 0.0001, 
              (pAncho / 2) - dist - (esp / 2)
            ];
          } else if (lado === 'L2') { // Along Largo (X), near -Z face (Back)
            gSize = [pLargo, prof + 0.0002, esp];
            gPos = [
              0, 
              (pEspesor / 2) - (prof / 2) + 0.0001, 
              -(pAncho / 2) + dist + (esp / 2)
            ];
          } else if (lado === 'A1') { // Along Ancho (Z), near +X face (Right)
            gSize = [esp, prof + 0.0002, pAncho];
            gPos = [
              (pLargo / 2) - dist - (esp / 2), 
              (pEspesor / 2) - (prof / 2) + 0.0001, 
              0
            ];
          } else if (lado === 'A2') { // Along Ancho (Z), near -X face (Left)
            gSize = [esp, prof + 0.0002, pAncho];
            gPos = [
              -(pLargo / 2) + dist + (esp / 2), 
              (pEspesor / 2) - (prof / 2) + 0.0001, 
              0
            ];
          }
          
          return (
            <mesh position={gPos}>
              <boxGeometry args={gSize} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.05} />
            </mesh>
          );
        })()}
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
        let dx = anchor.position.x - initialAnchorPos.current.x;
        let dy = anchor.position.y - initialAnchorPos.current.y;
        let dz = anchor.position.z - initialAnchorPos.current.z;

        // Floor magnet snap for group base
        let isFloorSnapped = false;
        if (snapActive) {
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

        if (snapActive && nonSelectedPieces.length > 0) {
          const snapThreshold = 0.025; // 25mm magnet snap
          const currentCenter = new THREE.Vector3(
            initialBoxCenter.current.x + dx,
            initialBoxCenter.current.y + dy,
            initialBoxCenter.current.z + dz
          );
          const halfX = size.x / 2;
          const halfZ = size.z / 2;

          for (const other of nonSelectedPieces) {
            const oCenter = new THREE.Vector3(
              other.position3D[0] * 0.001,
              other.position3D[1] * 0.001,
              other.position3D[2] * 0.001
            );
            const oHalf = getGlobalHalfSizes(other.rotation3D, other.largo, other.espesor, other.ancho);
            const dist = currentCenter.distanceTo(oCenter);
            if (dist < 0.35) {
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
  snapActive,
  onUnusedScale,
  edgeThicknessConfig,
  activeTextureFace = 'all',
  onSelectTextureFace,
  isTextureModalOpen,
  onLongPressPiece,
  onCanvasPointerDown,
  editingGroupId
}: ThreeViewerProps) {
  const pieceGroupsRef = useRef<Map<string, THREE.Group>>(new Map());

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

  return (
    <div 
      className="absolute inset-0 bg-transparent overflow-hidden"
      onPointerDown={() => onCanvasPointerDown?.()}
    >
      <CanvasErrorBoundary fallbackTitle="Visor 3D (Optimización Móvil)">
        <Canvas 
          camera={{ position: [2, 2, 2], fov: 50 }}
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
                edgeThicknessConfig={edgeThicknessConfig}
                activeTextureFace={activeTextureFace}
                onSelectTextureFace={onSelectTextureFace}
                isTextureModalOpen={isTextureModalOpen}
                onLongPressPiece={onLongPressPiece}
              />
            ));
          })}

          <OrbitControls makeDefault />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}
