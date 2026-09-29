import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { Piece } from '../types';
import {
  FredoStretchAxis,
  FredoStretchMode,
  computePiecesBoundingBoxMm,
  calculateFredoStretch,
  FredoGroupBounds
} from '../lib/fredoStretch';

interface FredoScaleGizmoProps {
  selectedPieces: Piece[];
  onCommitStretch: (newPieces: Piece[]) => void;
  axis: FredoStretchAxis;
  onChangeAxis: (axis: FredoStretchAxis) => void;
  mode: FredoStretchMode;
  onChangeMode: (mode: FredoStretchMode) => void;
  planeRatio: number;
  onChangePlaneRatio: (ratio: number) => void;
  previewDelta: number;
  onPreviewDeltaChange: (delta: number) => void;
}

export const FredoScaleGizmo: React.FC<FredoScaleGizmoProps> = ({
  selectedPieces,
  onCommitStretch,
  axis,
  onChangeAxis,
  mode,
  onChangeMode,
  planeRatio,
  onChangePlaneRatio,
  previewDelta,
  onPreviewDeltaChange
}) => {
  const { camera, raycaster, gl, invalidate } = useThree();
  const orbitControls = useThree((state) => (state as any).controls);

  const initialBounds = useMemo(() => {
    return computePiecesBoundingBoxMm(selectedPieces);
  }, [selectedPieces]);

  // Dragging state
  const isDraggingHandleRef = useRef<boolean>(false);
  const activeHandleRef = useRef<'pos' | 'neg' | 'plane' | null>(null);
  const dragStartPointRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const dragPlaneRef = useRef<THREE.Plane>(new THREE.Plane());
  const initialRatioRef = useRef<number>(planeRatio);
  const [liveDelta, setLiveDelta] = useState<number>(0);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  // Sync preview delta
  useEffect(() => {
    setLiveDelta(previewDelta);
  }, [previewDelta]);

  // Axis index: X -> 0, Y -> 1, Z -> 2
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;

  // Derived current bounds in meters for 3D rendering
  const currentBoundsM = useMemo(() => {
    const minM = initialBounds.min.clone().multiplyScalar(0.001);
    const maxM = initialBounds.max.clone().multiplyScalar(0.001);
    const sizeM = initialBounds.size.clone().multiplyScalar(0.001);
    const centerM = initialBounds.center.clone().multiplyScalar(0.001);
    return { minM, maxM, sizeM, centerM };
  }, [initialBounds]);

  // Clean rectangular Bounding Box Edges (EdgesGeometry has ZERO diagonal lines!)
  const boxEdgesGeometry = useMemo(() => {
    const box = new THREE.BoxGeometry(
      Math.max(0.002, currentBoundsM.sizeM.x),
      Math.max(0.002, currentBoundsM.sizeM.y),
      Math.max(0.002, currentBoundsM.sizeM.z)
    );
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [currentBoundsM.sizeM.x, currentBoundsM.sizeM.y, currentBoundsM.sizeM.z]);

  // 8 Corner Positions for authentic FredoScale corner marker boxes
  const cornerPositions = useMemo(() => {
    const min = currentBoundsM.minM;
    const max = currentBoundsM.maxM;
    return [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z),
    ];
  }, [currentBoundsM]);

  // Plane position in meters along the chosen axis
  const planePosM = useMemo(() => {
    const minOnAxis = currentBoundsM.minM.getComponent(axisIdx);
    const sizeOnAxis = currentBoundsM.sizeM.getComponent(axisIdx);
    return minOnAxis + sizeOnAxis * planeRatio;
  }, [currentBoundsM, axisIdx, planeRatio]);

  // Colors per axis
  const axisColor = axis === 'X' ? '#22c55e' : axis === 'Y' ? '#3b82f6' : '#ef4444';

  // Dimension values in mm
  const originalDimMm = Math.round(initialBounds.size.getComponent(axisIdx));
  const stretchedDimMm = Math.max(10, originalDimMm + liveDelta);

  // Handle Drag Start
  const handleStartDrag = useCallback((e: any, handleType: 'pos' | 'neg' | 'plane') => {
    e.stopPropagation();
    if (orbitControls) orbitControls.enabled = false;

    isDraggingHandleRef.current = true;
    activeHandleRef.current = handleType;
    initialRatioRef.current = planeRatio;

    // Build intersection plane facing camera and containing drag axis
    const worldAxis = new THREE.Vector3(
      axis === 'X' ? 1 : 0,
      axis === 'Y' ? 1 : 0,
      axis === 'Z' ? 1 : 0
    );
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    let planeNormal = new THREE.Vector3().crossVectors(worldAxis, camDir);
    if (planeNormal.lengthSq() < 0.001) {
      planeNormal.copy(camDir).negate();
    } else {
      planeNormal.crossVectors(planeNormal, worldAxis).normalize();
    }
    if (planeNormal.dot(camDir) > 0) planeNormal.negate();

    const planePoint = currentBoundsM.centerM.clone();
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(planeNormal, planePoint);

    // Initial raycast hit
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const intersect = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(dragPlaneRef.current, intersect)) {
      dragStartPointRef.current.copy(intersect);
    }

    const onPointerMove = (moveEvt: PointerEvent) => {
      if (!isDraggingHandleRef.current) return;
      const m = new THREE.Vector2(
        ((moveEvt.clientX - rect.left) / rect.width) * 2 - 1,
        -((moveEvt.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(m, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(dragPlaneRef.current, hit)) return;

      const diff = hit.clone().sub(dragStartPointRef.current);
      const diffOnAxisM = diff.getComponent(axisIdx);
      const diffOnAxisMm = diffOnAxisM * 1000;

      if (activeHandleRef.current === 'plane') {
        // Adjusting plane position
        const totalSizeMm = initialBounds.size.getComponent(axisIdx);
        const ratioDelta = diffOnAxisMm / totalSizeMm;
        const newRatio = Math.max(0.08, Math.min(0.92, initialRatioRef.current + ratioDelta));
        onChangePlaneRatio(Math.round(newRatio * 100) / 100);
      } else {
        // Stretching along axis
        let calcDelta = 0;
        if (mode === 'center') {
          const dist = activeHandleRef.current === 'pos' ? diffOnAxisMm : -diffOnAxisMm;
          calcDelta = dist * 2;
        } else if (activeHandleRef.current === 'pos') {
          calcDelta = diffOnAxisMm;
        } else if (activeHandleRef.current === 'neg') {
          calcDelta = -diffOnAxisMm;
        }

        // Apply grid snap to 5mm
        const snappedDelta = Math.round(calcDelta / 5) * 5;
        const minAllowed = -initialBounds.size.getComponent(axisIdx) + 50;
        const clampedDelta = Math.max(minAllowed, snappedDelta);

        setLiveDelta(clampedDelta);
        onPreviewDeltaChange(clampedDelta);
      }
      invalidate();
    };

    const onPointerUp = () => {
      if (orbitControls) orbitControls.enabled = true;
      isDraggingHandleRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (activeHandleRef.current !== 'plane') {
        // Commit stretch
        setLiveDelta(currentDelta => {
          if (currentDelta !== 0) {
            const effectiveMode: FredoStretchMode = mode === 'center'
              ? 'center'
              : (activeHandleRef.current === 'neg' ? 'anchor-pos' : 'anchor-neg');

            const result = calculateFredoStretch({
              pieces: selectedPieces,
              axis,
              planeRatio,
              mode: effectiveMode,
              deltaMm: currentDelta,
              initialBounds
            });
            onCommitStretch(result.updatedPieces);
          }
          onPreviewDeltaChange(0);
          return 0;
        });
      }
      activeHandleRef.current = null;
      invalidate();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }, [
    orbitControls,
    axis,
    planeRatio,
    onChangePlaneRatio,
    currentBoundsM,
    axisIdx,
    initialBounds,
    mode,
    selectedPieces,
    onCommitStretch,
    onPreviewDeltaChange,
    gl,
    camera,
    raycaster,
    invalidate
  ]);

  // Position of Positive and Negative Handles in 3D
  const posHandlePos = useMemo(() => {
    const p = currentBoundsM.centerM.clone();
    const half = currentBoundsM.sizeM.getComponent(axisIdx) / 2;
    p.setComponent(axisIdx, currentBoundsM.centerM.getComponent(axisIdx) + half);
    return p;
  }, [currentBoundsM, axisIdx]);

  const negHandlePos = useMemo(() => {
    const p = currentBoundsM.centerM.clone();
    const half = currentBoundsM.sizeM.getComponent(axisIdx) / 2;
    p.setComponent(axisIdx, currentBoundsM.centerM.getComponent(axisIdx) - half);
    return p;
  }, [currentBoundsM, axisIdx]);

  const planeCenterPos = useMemo(() => {
    const p = currentBoundsM.centerM.clone();
    p.setComponent(axisIdx, planePosM);
    return p;
  }, [currentBoundsM, axisIdx, planePosM]);

  // Size of plane grid
  const planeGridSize: [number, number] = useMemo(() => {
    if (axis === 'X') {
      return [currentBoundsM.sizeM.z * 1.25, currentBoundsM.sizeM.y * 1.25];
    } else if (axis === 'Y') {
      return [currentBoundsM.sizeM.x * 1.25, currentBoundsM.sizeM.z * 1.25];
    } else {
      return [currentBoundsM.sizeM.x * 1.25, currentBoundsM.sizeM.y * 1.25];
    }
  }, [axis, currentBoundsM]);

  const planeRotation: [number, number, number] = useMemo(() => {
    if (axis === 'X') return [0, Math.PI / 2, 0];
    if (axis === 'Y') return [Math.PI / 2, 0, 0];
    return [0, 0, 0];
  }, [axis]);

  // Clean rectangular outline for the cutting plane (EdgesGeometry has ZERO diagonal lines!)
  const planeEdgesGeometry = useMemo(() => {
    const [w, h] = planeGridSize;
    const planeGeom = new THREE.PlaneGeometry(w, h);
    const edges = new THREE.EdgesGeometry(planeGeom);
    planeGeom.dispose();
    return edges;
  }, [planeGridSize]);

  // Internal mesh grid lines (parallel to axes only, zero diagonal slashes)
  const gridLines = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    const [w, h] = planeGridSize;
    const cols = 6;
    const rows = 6;
    for (let i = 1; i < cols; i++) {
      const x = -w / 2 + (w / cols) * i;
      lines.push([new THREE.Vector3(x, -h / 2, 0), new THREE.Vector3(x, h / 2, 0)]);
    }
    for (let j = 1; j < rows; j++) {
      const y = -h / 2 + (h / rows) * j;
      lines.push([new THREE.Vector3(-w / 2, y, 0), new THREE.Vector3(w / 2, y, 0)]);
    }
    return lines;
  }, [planeGridSize]);

  // Architectural CAD Dimension Line (Cota de Medida FredoScale)
  const dimensionLineData = useMemo(() => {
    const { minM, maxM, centerM, sizeM } = currentBoundsM;
    const offset = 0.08; // 80mm offset outside the bounding box

    if (axis === 'X') {
      const y = maxM.y + offset;
      const z = maxM.z + 0.02;
      const pStart = new THREE.Vector3(minM.x, y, z);
      const pEnd = new THREE.Vector3(maxM.x, y, z);
      const pCenter = new THREE.Vector3(centerM.x, y + 0.02, z);

      const ext1 = [new THREE.Vector3(minM.x, maxM.y + 0.01, z), new THREE.Vector3(minM.x, y + 0.02, z)];
      const ext2 = [new THREE.Vector3(maxM.x, maxM.y + 0.01, z), new THREE.Vector3(maxM.x, y + 0.02, z)];

      const tickLen = 0.018;
      const tick1 = [new THREE.Vector3(minM.x - tickLen, y - tickLen, z), new THREE.Vector3(minM.x + tickLen, y + tickLen, z)];
      const tick2 = [new THREE.Vector3(maxM.x - tickLen, y - tickLen, z), new THREE.Vector3(maxM.x + tickLen, y + tickLen, z)];

      return { pStart, pEnd, pCenter, ext1, ext2, tick1, tick2 };
    } else if (axis === 'Y') {
      const x = maxM.x + offset;
      const z = maxM.z + 0.02;
      const pStart = new THREE.Vector3(x, minM.y, z);
      const pEnd = new THREE.Vector3(x, maxM.y, z);
      const pCenter = new THREE.Vector3(x + 0.02, centerM.y, z);

      const ext1 = [new THREE.Vector3(maxM.x + 0.01, minM.y, z), new THREE.Vector3(x + 0.02, minM.y, z)];
      const ext2 = [new THREE.Vector3(maxM.x + 0.01, maxM.y, z), new THREE.Vector3(x + 0.02, maxM.y, z)];

      const tickLen = 0.018;
      const tick1 = [new THREE.Vector3(x - tickLen, minM.y - tickLen, z), new THREE.Vector3(x + tickLen, minM.y + tickLen, z)];
      const tick2 = [new THREE.Vector3(x - tickLen, maxM.y - tickLen, z), new THREE.Vector3(x + tickLen, maxM.y + tickLen, z)];

      return { pStart, pEnd, pCenter, ext1, ext2, tick1, tick2 };
    } else {
      const x = maxM.x + offset;
      const y = maxM.y + 0.02;
      const pStart = new THREE.Vector3(x, y, minM.z);
      const pEnd = new THREE.Vector3(x, y, maxM.z);
      const pCenter = new THREE.Vector3(x + 0.02, y, centerM.z);

      const ext1 = [new THREE.Vector3(maxM.x + 0.01, y, minM.z), new THREE.Vector3(x + 0.02, y, minM.z)];
      const ext2 = [new THREE.Vector3(maxM.x + 0.01, y, maxM.z), new THREE.Vector3(x + 0.02, y, maxM.z)];

      const tickLen = 0.018;
      const tick1 = [new THREE.Vector3(x, y - tickLen, minM.z - tickLen), new THREE.Vector3(x, y + tickLen, minM.z + tickLen)];
      const tick2 = [new THREE.Vector3(x, y - tickLen, maxM.z - tickLen), new THREE.Vector3(x, y + tickLen, maxM.z + tickLen)];

      return { pStart, pEnd, pCenter, ext1, ext2, tick1, tick2 };
    }
  }, [currentBoundsM, axis]);

  // Determine handle visual roles based on mode
  const isPosAnchor = mode === 'anchor-pos';
  const isNegAnchor = mode === 'anchor-neg';
  const isCenterMode = mode === 'center';

  return (
    <group>
      {/* 1. Clean CAD Bounding Box Outline (ZERO DIAGONAL LINES, NO X-RAY EFFECT) */}
      <lineSegments geometry={boxEdgesGeometry} position={currentBoundsM.centerM}>
        <lineBasicMaterial
          color="#a3e635"
          linewidth={2}
          depthTest={true}
          depthWrite={false}
          transparent
          opacity={0.9}
        />
      </lineSegments>

      {/* 2. FredoScale Corner Marker Nodes on all 8 Vertices */}
      {cornerPositions.map((cPos, idx) => (
        <mesh key={idx} position={cPos}>
          <boxGeometry args={[0.016, 0.016, 0.016]} />
          <meshBasicMaterial
            color="#a3e635"
            depthTest={true}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* 3. Central Guide Axis Line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array([
                negHandlePos.x, negHandlePos.y, negHandlePos.z,
                posHandlePos.x, posHandlePos.y, posHandlePos.z
              ]),
              3
            ]}
          />
        </bufferGeometry>
        <lineDashedMaterial
          color={axisColor}
          dashSize={0.03}
          gapSize={0.02}
          linewidth={2}
          depthTest={true}
          depthWrite={false}
        />
      </line>

      {/* 4. The FredoScale Cutting Grid Plane (Malla Divisoria limpia sin diagonales) */}
      <group position={planeCenterPos} rotation={planeRotation}>
        {/* Plane Outer Frame - Clean rectangular perimeter */}
        <lineSegments geometry={planeEdgesGeometry}>
          <lineBasicMaterial
            color={axisColor}
            linewidth={2}
            depthTest={true}
            depthWrite={false}
            transparent
            opacity={0.85}
          />
        </lineSegments>

        {/* Semi-transparent Plane Face - Gentle highlight respecting solid pieces */}
        <mesh>
          <planeGeometry args={[planeGridSize[0], planeGridSize[1]]} />
          <meshBasicMaterial
            color={axisColor}
            transparent
            opacity={0.12}
            side={THREE.DoubleSide}
            depthWrite={false}
            depthTest={true}
          />
        </mesh>

        {/* Inner Subdividing Grid Lines (Malla FredoScale limpia) */}
        {gridLines.map((pair, idx) => (
          <line key={idx}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([
                    pair[0].x, pair[0].y, pair[0].z,
                    pair[1].x, pair[1].y, pair[1].z
                  ]),
                  3
                ]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color={axisColor}
              transparent
              opacity={0.4}
              depthTest={true}
              depthWrite={false}
            />
          </line>
        ))}

        {/* Center handle on the plane grid to adjust position along group */}
        <mesh
          position={[0, 0, 0]}
          onPointerDown={(e) => handleStartDrag(e, 'plane')}
          onPointerOver={() => setHoveredHandle('plane')}
          onPointerOut={() => setHoveredHandle(null)}
          scale={hoveredHandle === 'plane' ? 1.4 : 1.0}
        >
          <boxGeometry args={[0.03, 0.03, 0.03]} />
          <meshStandardMaterial
            color={isCenterMode ? "#22d3ee" : "#fef08a"}
            emissive={isCenterMode ? "#0891b2" : "#ca8a04"}
            emissiveIntensity={0.6}
            roughness={0.2}
            depthTest={true}
          />
        </mesh>
      </group>

      {/* 5. 3D Architectural CAD Dimension Line & Interactive Measurement Card */}
      <group>
        {/* Main Dimension Line */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  dimensionLineData.pStart.x, dimensionLineData.pStart.y, dimensionLineData.pStart.z,
                  dimensionLineData.pEnd.x, dimensionLineData.pEnd.y, dimensionLineData.pEnd.z
                ]),
                3
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#a3e635" linewidth={2} depthTest={false} />
        </line>

        {/* Extension Line 1 */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  dimensionLineData.ext1[0].x, dimensionLineData.ext1[0].y, dimensionLineData.ext1[0].z,
                  dimensionLineData.ext1[1].x, dimensionLineData.ext1[1].y, dimensionLineData.ext1[1].z
                ]),
                3
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#a3e635" linewidth={1} transparent opacity={0.6} depthTest={false} />
        </line>

        {/* Extension Line 2 */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  dimensionLineData.ext2[0].x, dimensionLineData.ext2[0].y, dimensionLineData.ext2[0].z,
                  dimensionLineData.ext2[1].x, dimensionLineData.ext2[1].y, dimensionLineData.ext2[1].z
                ]),
                3
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#a3e635" linewidth={1} transparent opacity={0.6} depthTest={false} />
        </line>

        {/* Tick Mark 1 (45° CAD mark) */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  dimensionLineData.tick1[0].x, dimensionLineData.tick1[0].y, dimensionLineData.tick1[0].z,
                  dimensionLineData.tick1[1].x, dimensionLineData.tick1[1].y, dimensionLineData.tick1[1].z
                ]),
                3
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#a3e635" linewidth={2} depthTest={false} />
        </line>

        {/* Tick Mark 2 (45° CAD mark) */}
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  dimensionLineData.tick2[0].x, dimensionLineData.tick2[0].y, dimensionLineData.tick2[0].z,
                  dimensionLineData.tick2[1].x, dimensionLineData.tick2[1].y, dimensionLineData.tick2[1].z
                ]),
                3
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#a3e635" linewidth={2} depthTest={false} />
        </line>
      </group>

      {/* 6. Positive End Gizmo Handle */}
      <group position={posHandlePos}>
        <mesh
          onPointerDown={(e) => handleStartDrag(e, 'pos')}
          onPointerOver={() => setHoveredHandle('pos')}
          onPointerOut={() => setHoveredHandle(null)}
          scale={hoveredHandle === 'pos' ? 1.35 : 1.0}
        >
          <boxGeometry args={[0.035, 0.035, 0.035]} />
          <meshStandardMaterial
            color={isPosAnchor ? '#3b82f6' : isCenterMode ? '#22d3ee' : '#ef4444'}
            emissive={isPosAnchor ? '#1d4ed8' : isCenterMode ? '#0891b2' : '#b91c1c'}
            emissiveIntensity={0.5}
            roughness={0.2}
            depthTest={true}
          />
        </mesh>
      </group>

      {/* 7. Negative End Gizmo Handle */}
      <group position={negHandlePos}>
        <mesh
          onPointerDown={(e) => handleStartDrag(e, 'neg')}
          onPointerOver={() => setHoveredHandle('neg')}
          onPointerOut={() => setHoveredHandle(null)}
          scale={hoveredHandle === 'neg' ? 1.35 : 1.0}
        >
          <boxGeometry args={[0.035, 0.035, 0.035]} />
          <meshStandardMaterial
            color={isNegAnchor ? '#3b82f6' : isCenterMode ? '#22d3ee' : '#ffffff'}
            emissive={isNegAnchor ? '#1d4ed8' : isCenterMode ? '#0891b2' : '#94a3b8'}
            emissiveIntensity={0.4}
            roughness={0.2}
            depthTest={true}
          />
        </mesh>
      </group>

      {/* 8. Live In-Scene Tooltip when Dragging */}
      {liveDelta !== 0 && (
        <Html position={[currentBoundsM.centerM.x, currentBoundsM.centerM.y + currentBoundsM.sizeM.y / 2 + 0.08, currentBoundsM.centerM.z]} center>
          <div className="bg-[#111111]/95 text-white border-2 border-[#a3e635] px-3 py-1.5 rounded-lg shadow-2xl backdrop-blur-md pointer-events-none select-none text-[10px] font-mono whitespace-nowrap flex flex-col items-center gap-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#a3e635]">EJE {axis}:</span>
              <span className="text-gray-300 line-through">{originalDimMm} mm</span>
              <span className="text-gray-400">→</span>
              <span className="font-black text-white text-xs">{stretchedDimMm} mm</span>
              <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black ${liveDelta > 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/50' : 'bg-red-950 text-red-400 border border-red-500/50'}`}>
                {liveDelta > 0 ? `+${liveDelta}` : liveDelta} mm
              </span>
            </div>
            <div className="text-[8px] text-gray-400 flex items-center gap-1.5">
              <span>Modo: <strong className="text-white">{mode === 'center' ? 'Desde el Centro de la Malla' : (activeHandleRef.current === 'neg' ? 'Anclado (+)' : 'Anclado (-)')}</strong></span>
              <span>•</span>
              <span className="text-emerald-400 font-semibold">🛡️ Espesores protegidos</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
