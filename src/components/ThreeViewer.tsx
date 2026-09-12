import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, Edges, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Piece } from '../types';

export const MATERIAL_MAP: Record<string, { color: string, coreColor: string, name: string, brand: string }> = {
  // --- Estándar ---
  'Blanco': { color: '#f8fafc', coreColor: '#5c4535', name: 'Blanco Melamina', brand: 'Estándar' },
  'Gris Claro': { color: '#cbd5e1', coreColor: '#5c4535', name: 'Gris Claro', brand: 'Estándar' },
  'Grafito': { color: '#31353d', coreColor: '#3d2e24', name: 'Grafito', brand: 'Estándar' },
  'Roble Natural': { color: '#c4a678', coreColor: '#523d30', name: 'Roble Natural', brand: 'Estándar' },
  'Nogal': { color: '#594433', coreColor: '#2b1c12', name: 'Nogal', brand: 'Estándar' },
  'Negro': { color: '#171717', coreColor: '#1a120e', name: 'Negro', brand: 'Estándar' },

  // --- Pelikano ---
  'Pelikano_Blanco_Absoluto': { color: '#ffffff', coreColor: '#5c4535', name: 'Blanco Absoluto', brand: 'Pelikano' },
  'Pelikano_Humo': { color: '#dcdcda', coreColor: '#5c4535', name: 'Humo', brand: 'Pelikano' },
  'Pelikano_Niebla': { color: '#c8c9c5', coreColor: '#5c4535', name: 'Niebla', brand: 'Pelikano' },
  'Pelikano_Cendra': { color: '#8f8d87', coreColor: '#5c4535', name: 'Cendra', brand: 'Pelikano' },
  'Pelikano_Plomo': { color: '#616365', coreColor: '#3d2e24', name: 'Plomo', brand: 'Pelikano' },
  'Pelikano_Carbon': { color: '#2f3235', coreColor: '#3d2e24', name: 'Carbón', brand: 'Pelikano' },
  'Pelikano_Negro': { color: '#1a1a1a', coreColor: '#1a120e', name: 'Negro', brand: 'Pelikano' },
  'Pelikano_Macadamia': { color: '#ead9c3', coreColor: '#523d30', name: 'Macadamia', brand: 'Pelikano' },
  'Pelikano_Capuccino': { color: '#ac9a8b', coreColor: '#523d30', name: 'Capuccino', brand: 'Pelikano' },
  'Pelikano_Bellota': { color: '#8e7153', coreColor: '#523d30', name: 'Bellota', brand: 'Pelikano' },
  'Pelikano_Rovere': { color: '#bca482', coreColor: '#523d30', name: 'Rovere', brand: 'Pelikano' },
  'Pelikano_Conac': { color: '#824e31', coreColor: '#523d30', name: 'Coñac', brand: 'Pelikano' },
  'Pelikano_Amaretto': { color: '#533e2b', coreColor: '#3d2e24', name: 'Amaretto', brand: 'Pelikano' },
  'Pelikano_Caramel': { color: '#a9865b', coreColor: '#523d30', name: 'Caramel', brand: 'Pelikano' },
  'Pelikano_Ceniza': { color: '#a0988e', coreColor: '#5c4535', name: 'Ceniza', brand: 'Pelikano' },
  'Pelikano_Nogal': { color: '#4e3629', coreColor: '#2b1c12', name: 'Nogal', brand: 'Pelikano' },
  'Pelikano_Siena': { color: '#735c4e', coreColor: '#3d2e24', name: 'Siena', brand: 'Pelikano' },
  'Pelikano_Opalo': { color: '#94a8a5', coreColor: '#5c4535', name: 'Ópalo', brand: 'Pelikano' },
  'Pelikano_Almendra': { color: '#e6d3be', coreColor: '#523d30', name: 'Almendra', brand: 'Pelikano' },

  // --- Hispanos ---
  'Hispanos_Blanco_Soft': { color: '#f4f4f4', coreColor: '#5c4535', name: 'Blanco Soft', brand: 'Hispanos' },
  'Hispanos_Gris_Antracita': { color: '#4a4e53', coreColor: '#3d2e24', name: 'Gris Antracita', brand: 'Hispanos' },
  'Hispanos_Roble_Sinatra': { color: '#a08c6e', coreColor: '#523d30', name: 'Roble Sinatra', brand: 'Hispanos' },
  'Hispanos_Pino_Dinamarca': { color: '#c8bca6', coreColor: '#523d30', name: 'Pino Dinamarca', brand: 'Hispanos' },
  'Hispanos_Haya_Rosada': { color: '#d5b79c', coreColor: '#523d30', name: 'Haya Rosada', brand: 'Hispanos' },
  'Hispanos_Cerezo_Silvestre': { color: '#a06f51', coreColor: '#523d30', name: 'Cerezo Silvestre', brand: 'Hispanos' },
  'Hispanos_Nogal_Selecto': { color: '#59453c', coreColor: '#2b1c12', name: 'Nogal Selecto', brand: 'Hispanos' },
  'Hispanos_Verde_Salvia': { color: '#7b8c7e', coreColor: '#5c4535', name: 'Verde Salvia', brand: 'Hispanos' },
  'Hispanos_Azul_Turco': { color: '#344b5b', coreColor: '#3d2e24', name: 'Azul Turco', brand: 'Hispanos' },
  'Hispanos_Sahara_Crema': { color: '#e2d5be', coreColor: '#523d30', name: 'Sahara Crema', brand: 'Hispanos' },
  'Hispanos_Roble_Denver': { color: '#9c8262', coreColor: '#523d30', name: 'Roble Denver', brand: 'Hispanos' },
  'Hispanos_Cemento_Loft': { color: '#a6a6a6', coreColor: '#5c4535', name: 'Cemento Loft', brand: 'Hispanos' }
};

interface ThreeViewerProps {
  pieces: Piece[];
  selectedPieceIds: string[];
  onSelectPiece: (id: string | null, multi: boolean) => void;
  onUpdatePieceTransform: (id: string, position: [number, number, number], rotation: [number, number, number]) => void;
  onUpdatePieceScale?: (id: string, scaleX: number, scaleY: number, scaleZ: number) => void;
  onUpdatePieceDimensions?: (id: string, largo: number, espesor: number, ancho: number, dx: number, dy: number, dz: number) => void;
  onDoubleClickPiece?: (id: string) => void;
  onEditDimensionAxis?: (pieceId: string, axis: 'largo' | 'ancho' | 'espesor') => void;
  hide3DLabels?: boolean;
  transformMode?: 'translate' | 'rotate' | 'scale';
  snapActive?: boolean;
  onUnusedScale?: any;
  interactMode?: boolean;
  onToggleDynamicPiece?: (id: string) => void;
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
  snapActive = false,
  interactMode = false,
  onToggleDynamicPiece
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
  transformMode?: 'translate' | 'rotate' | 'scale';
  snapActive?: boolean;
  interactMode?: boolean;
  onToggleDynamicPiece?: (id: string) => void;
}) => {
  const [mesh, setMesh] = useState<THREE.Mesh | null>(null);
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const transformRef = useRef<any>(null);
  const initialPosRef = useRef(new THREE.Vector3());
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

  const [isSnapTarget, setIsSnapTarget] = useState(false);
  const [isDraggingTranslate, setIsDraggingTranslate] = useState(false);
  const [displacement, setDisplacement] = useState<{ dx: number; dy: number; dz: number; dist: number } | null>(null);

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

  const triggerSnapFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 300);
  };

  const getSnappedPosition = (targetPos: THREE.Vector3) => {
    let finalPos = targetPos.clone();
    let snapped = false;
    let targetPieceId: string | null = null;

    if (transformMode !== 'translate' || allPieces.length <= 1) {
      return { finalPos, snapped, targetPieceId };
    }

    const myHalf = getGlobalHalfSizes(piece.rotation3D, piece.largo, piece.espesor, piece.ancho);

    // 1) Magnetic Snap Candidates (Faces, Edges, Corners)
    if (snapActive) {
      const snapThreshold = 0.06; // 60mm magnet snap range

      let bestX = finalPos.x;
      let minDiffX = snapThreshold;
      let snapTargetIdX: string | null = null;

      let bestY = finalPos.y;
      let minDiffY = snapThreshold;
      let snapTargetIdY: string | null = null;

      let bestZ = finalPos.z;
      let minDiffZ = snapThreshold;
      let snapTargetIdZ: string | null = null;

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

    // 2) Solid Physics Collision Prevention (No Penetration / Fusion)
    // Ensures pieces behave like real solid 3D boards and cannot intersect
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

      // Small epsilon (0.1mm) to detect actual interior penetration
      if (overlapX > 0.0001 && overlapY > 0.0001 && overlapZ > 0.0001) {
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

    return { finalPos, snapped, targetPieceId };
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

        // Sizing with single-sided scaling shifts the center by half of the delta size
        // in local space, so the opposite side (-X, -Y, -Z) stays anchored in place
        const originShift = [
          (dLargo / 2) * scale,
          (dEspesor / 2) * scale,
          (dAncho / 2) * scale
        ];

        if (onUpdateDimensions) {
          onUpdateDimensions(dLargo, dEspesor, dAncho, originShift as [number, number, number]);
        }
      } else {
        if (transformMode === 'translate' && allPieces.length > 1) {
           const { finalPos: snappedPos, snapped, targetPieceId } = getSnappedPosition(finalPos);

           finalPos.copy(snappedPos);
           group.position.copy(finalPos);

           if (snapped) {
              triggerSnapFlash();

              if (targetPieceId) {
                window.dispatchEvent(new CustomEvent('piece-snap-flash', {
                  detail: { targetId: targetPieceId }
                }));
              }
           }

           window.dispatchEvent(new CustomEvent('piece-snap-target', {
             detail: { active: false, targetId: null }
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
      setDisplacement(null);
      window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: null }));
    }
  };


  // Materials based on edge configuration and piece material.
  // Order of faces: right, left, top, bottom, front, back
  const materials = useMemo(() => {
    const matName = piece.material || 'Blanco';
    const matInfo = MATERIAL_MAP[matName] || MATERIAL_MAP['Blanco'];

    // Support Blender-style physical overrides
    const finalColor = piece.customColor || matInfo.color;
    const finalRoughness = piece.customRoughness !== undefined ? piece.customRoughness : (matName === 'Custom' ? 0.4 : 0.35);
    const finalMetalness = piece.customMetalness !== undefined ? piece.customMetalness : (matName === 'Custom' ? 0.0 : 0.05);

    const baseMat = new THREE.MeshStandardMaterial({ 
      color: finalColor,
      roughness: finalRoughness,
      metalness: finalMetalness
    });
    
    const createEdgeMat = (edgeType: string) => {
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

    return [
      matA1, // Right
      matA2, // Left
      baseMat, // Top
      baseMat, // Bottom
      matL1, // Front
      matL2, // Back
    ];
  }, [piece.cantos, piece.material, piece.customColor, piece.cantoColor, piece.customRoughness, piece.customMetalness]);

  useEffect(() => {
    if (transformRef.current) {
      if (snapActive) {
        transformRef.current.setTranslationSnap(0.001); // 1mm precision snap
        transformRef.current.setRotationSnap(THREE.MathUtils.degToRad(15));
        transformRef.current.setScaleSnap(0.1); 
      } else {
        transformRef.current.setTranslationSnap(null);
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
      if (group && transformMode === 'translate') {
        isDraggingRef.current = true;
        initialPosRef.current.copy(group.position);
        const zeroDisp = { dx: 0, dy: 0, dz: 0, dist: 0 };
        setDisplacement(zeroDisp);
        window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: zeroDisp }));
      }
    };

    const handleDraggingChanged = (event: any) => {
      const dragging = !!event.value;
      if (dragging && transformMode === 'translate') {
        isDraggingRef.current = true;
        if (group) {
          initialPosRef.current.copy(group.position);
        }
        setIsDraggingTranslate(true);
        const zeroDisp = { dx: 0, dy: 0, dz: 0, dist: 0 };
        setDisplacement(zeroDisp);
        window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: zeroDisp }));
      } else if (!dragging) {
        isDraggingRef.current = false;
        setIsDraggingTranslate(false);
        setDisplacement(null);
        window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: null }));
      }
    };

    const handleChange = () => {
      // Keep hiding planes on every interaction state change since TransformControls might reset them
      disableUnwantedHandles();

      if (transformMode === 'translate' && group && isDraggingRef.current) {
        if (allPieces.length > 1) {
          const { finalPos, snapped, targetPieceId } = getSnappedPosition(group.position);
          if (snapped || finalPos.distanceToSquared(group.position) > 0.0000001) {
            group.position.copy(finalPos);
            if (targetPieceId) {
              window.dispatchEvent(new CustomEvent('piece-snap-target', {
                detail: { active: true, targetId: targetPieceId }
              }));
            }
          } else {
            window.dispatchEvent(new CustomEvent('piece-snap-target', {
              detail: { active: false, targetId: null }
            }));
          }
        }

        const dx = Math.round((group.position.x - initialPosRef.current.x) * 1000);
        const dy = Math.round((group.position.y - initialPosRef.current.y) * 1000);
        const dz = Math.round((group.position.z - initialPosRef.current.z) * 1000);
        const dist = Math.round(Math.hypot(dx, dy, dz));

        const disp = { dx, dy, dz, dist };
        setIsDraggingTranslate(true);
        setDisplacement(disp);
        window.dispatchEvent(new CustomEvent('piece-displacement-update', { detail: disp }));
      }

      if (transformMode !== 'scale') return;
      if (!mesh) return;

      const sX = group.scale.x;
      const sY = group.scale.y;
      const sZ = group.scale.z;

      const dLargo = piece.largo * (sX - 1);
      const dEspesor = piece.espesor * (sY - 1);
      const dAncho = piece.ancho * (sZ - 1);

      // Shift the child mesh locally inside the group to anchor the (-X, -Y, -Z) side.
      // Since the parent coordinate is scaled, we divide the physical delta offset inside R3 render-world
      // by the scale factors, keeping parent unshifted so TransformControls is 100% stable.
      mesh.position.set(
        sX !== 0 ? ((dLargo / 2) * scale) / sX : 0,
        sY !== 0 ? ((dEspesor / 2) * scale) / sY : 0,
        sZ !== 0 ? ((dAncho / 2) * scale) / sZ : 0
      );

      // Update real-time dimensions for the labels
      setCurrentDims({
        largo: Math.max(1, Math.round(piece.largo + dLargo)),
        espesor: Math.max(1, Math.round(piece.espesor + dEspesor)),
        ancho: Math.max(1, Math.round(piece.ancho + dAncho))
      });
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
  }, [group, mesh, showControls, transformMode, snapActive, piece.largo, piece.espesor, piece.ancho]);

  // Dynamic Component (SketchUp) Animation & Pivot Logic
  const pivotGroupRef = useRef<THREE.Group>(null);
  const progressRef = useRef<number>(piece.dynamic?.isOpen ? 1 : 0);

  useFrame((_, delta) => {
    if (!pivotGroupRef.current || !piece.dynamic) return;

    const target = piece.dynamic.isOpen ? 1 : 0;
    progressRef.current = THREE.MathUtils.lerp(progressRef.current, target, Math.min(1, 10 * delta));
    const p = progressRef.current;

    if (piece.dynamic.type === 'door') {
      const maxAngleRad = THREE.MathUtils.degToRad(piece.dynamic.openAngle ?? 95);
      const doorType = piece.dynamic.doorType || 'single_left';
      const pivot = piece.dynamic.pivotPoint || (doorType.includes('right') ? 'right' : doorType === 'lift_up' ? 'top' : 'left');

      if (pivot === 'left') {
        pivotGroupRef.current.rotation.y = -p * maxAngleRad;
      } else if (pivot === 'right') {
        pivotGroupRef.current.rotation.y = p * maxAngleRad;
      } else if (pivot === 'top') {
        pivotGroupRef.current.rotation.x = -p * maxAngleRad;
      } else if (pivot === 'bottom') {
        pivotGroupRef.current.rotation.x = p * maxAngleRad;
      }
    } else if (piece.dynamic.type === 'drawer') {
      const slideDist = (piece.dynamic.slideDistance ?? Math.max(200, piece.ancho * 0.85)) * scale;
      const axis = piece.dynamic.slideAxis || 'Z';
      if (axis === 'Z') {
        pivotGroupRef.current.position.z = p * slideDist;
      } else if (axis === 'X') {
        pivotGroupRef.current.position.x = p * slideDist;
      } else if (axis === 'Y') {
        pivotGroupRef.current.position.y = p * slideDist;
      }
    }
  });

  const halfLargo = (piece.largo * scale) / 2;
  const halfEspesor = (piece.espesor * scale) / 2;

  const isDoor = piece.dynamic?.type === 'door';
  const doorType = piece.dynamic?.doorType || 'single_left';
  const pivot = piece.dynamic?.pivotPoint || (doorType.includes('right') ? 'right' : doorType === 'lift_up' ? 'top' : 'left');

  let pivotOffset: [number, number, number] = [0, 0, 0];
  let meshOffset: [number, number, number] = [0, 0, 0];

  if (isDoor) {
    if (pivot === 'left') {
      pivotOffset = [-halfLargo, 0, 0];
      meshOffset = [halfLargo, 0, 0];
    } else if (pivot === 'right') {
      pivotOffset = [halfLargo, 0, 0];
      meshOffset = [-halfLargo, 0, 0];
    } else if (pivot === 'top') {
      pivotOffset = [0, halfEspesor, 0];
      meshOffset = [0, -halfEspesor, 0];
    } else if (pivot === 'bottom') {
      pivotOffset = [0, -halfEspesor, 0];
      meshOffset = [0, halfEspesor, 0];
    }
  }

  // Handle double click for quick scale mode
  const handleDoubleClick = (e: any) => {
    e.stopPropagation();
  };

  return (
    <group>
      {showControls && group && (
        <TransformControls
          ref={transformRef}
          object={group}
          mode={transformMode}
          onMouseUp={handleTransformEnd}
          size={controlsSize}
          showY={transformMode !== 'scale'}
        />
      )}

      <group
        ref={setGroup}
        position={pos}
        rotation={piece.rotation3D}
      >
        <group ref={pivotGroupRef} position={pivotOffset}>
          <mesh
            ref={setMesh}
            position={meshOffset}
            rotation={[0, 0, 0]}
            onClick={(e) => {
              e.stopPropagation();
              if (interactMode && piece.dynamic && onToggleDynamicPiece) {
                onToggleDynamicPiece(piece.id);
              } else {
                onClick(e);
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
          <Edges scale={1} threshold={15} color={flash ? '#10b981' : isSnapTarget ? '#3b82f6' : isSelected ? '#f0a144' : piece.dynamic ? '#a855f7' : '#111111'} />
          
          {/* Dynamic Component Badge Overlay */}
          {piece.dynamic && (
            <Html position={[0, (piece.espesor * scale) / 2 + 0.03, 0]} center>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleDynamicPiece) {
                    onToggleDynamicPiece(piece.id);
                  }
                }}
                className={`px-2 py-0.5 rounded-full backdrop-blur-md shadow-lg border text-[10px] font-black flex items-center gap-1.5 transition-all cursor-pointer pointer-events-auto select-none hover:scale-110 active:scale-95 ${
                  piece.dynamic.isOpen 
                    ? 'bg-purple-900/90 border-purple-400 text-purple-200' 
                    : 'bg-[#18181b]/90 border-purple-500/50 text-purple-300 hover:border-purple-400'
                }`}
                title="Componente Dinámico SketchUp - Click para Abrir/Cerrar"
              >
                <span className="text-[11px]">{piece.dynamic.type === 'door' ? '🚪' : '🗄️'}</span>
                <span>{piece.dynamic.type === 'door' ? (piece.dynamic.isOpen ? 'Puerta Abierta' : 'Puerta Cerrada') : (piece.dynamic.isOpen ? 'Cajón Abierto' : 'Cajón Cerrado')}</span>
              </button>
            </Html>
          )}
          
          {/* Dimensiones en tiempo real al arrastrar/seleccionar */}
          {!hide3DLabels && isSelected && transformMode === 'scale' && (
            <>
              {/* Largo (X) */}
              <Html position={[(piece.largo * scale) / 2 + 0.04, 0, 0]} center>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditDimensionAxis) {
                      onEditDimensionAxis(piece.id, 'largo');
                    } else if (onDoubleClickPiece) {
                      onDoubleClickPiece(piece.id);
                    }
                  }}
                  className="bg-[#121212]/95 border-2 border-red-500 hover:border-red-400 hover:bg-red-950/60 px-2 py-0.5 rounded-lg shadow-[0_4px_15px_rgba(0,0,0,0.8)] flex items-center gap-1 text-[11px] font-mono font-bold text-white whitespace-nowrap select-none pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 transition-all duration-150 group"
                  title="Editar Largo (X)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-gray-400 text-[9px] font-sans">L:</span>
                  <span className="text-red-400 text-xs font-black group-hover:underline">{currentDims.largo}</span>
                  <span className="text-[9px] text-gray-400 font-sans">mm</span>
                </button>
              </Html>

              {/* Ancho (Z) */}
              <Html position={[0, 0, (piece.ancho * scale) / 2 + 0.04]} center>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditDimensionAxis) {
                      onEditDimensionAxis(piece.id, 'ancho');
                    } else if (onDoubleClickPiece) {
                      onDoubleClickPiece(piece.id);
                    }
                  }}
                  className="bg-[#121212]/95 border-2 border-blue-500 hover:border-blue-400 hover:bg-blue-950/60 px-2 py-0.5 rounded-lg shadow-[0_4px_15px_rgba(0,0,0,0.8)] flex items-center gap-1 text-[11px] font-mono font-bold text-white whitespace-nowrap select-none pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 transition-all duration-150 group"
                  title="Editar Ancho (Z)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-gray-400 text-[9px] font-sans">A:</span>
                  <span className="text-blue-400 text-xs font-black group-hover:underline">{currentDims.ancho}</span>
                  <span className="text-[9px] text-gray-400 font-sans">mm</span>
                </button>
              </Html>

              {/* Espesor (Y) */}
              <Html position={[0, (piece.espesor * scale) / 2 + 0.04, 0]} center>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditDimensionAxis) {
                      onEditDimensionAxis(piece.id, 'espesor');
                    } else if (onDoubleClickPiece) {
                      onDoubleClickPiece(piece.id);
                    }
                  }}
                  className="bg-[#121212]/95 border-2 border-green-500 hover:border-green-400 hover:bg-green-950/60 px-2 py-0.5 rounded-lg shadow-[0_4px_15px_rgba(0,0,0,0.8)] flex items-center gap-1 text-[11px] font-mono font-bold text-white whitespace-nowrap select-none pointer-events-auto cursor-pointer hover:scale-110 active:scale-95 transition-all duration-150 group"
                  title="Editar Espesor (Y)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-gray-400 text-[9px] font-sans">E:</span>
                  <span className="text-green-400 text-xs font-black group-hover:underline">{currentDims.espesor}</span>
                  <span className="text-[9px] text-gray-400 font-sans">mm</span>
                </button>
              </Html>
            </>
          )}
        </mesh>

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
    </group>
  );
};

export default function ThreeViewer({
  pieces,
  selectedPieceIds,
  onSelectPiece,
  onUpdatePieceTransform,
  onUpdatePieceScale,
  onUpdatePieceDimensions,
  onDoubleClickPiece,
  onEditDimensionAxis,
  hide3DLabels = false,
  transformMode,
  snapActive,
  onUnusedScale,
  interactMode,
  onToggleDynamicPiece
}: ThreeViewerProps) {
  return (
    <div className="absolute inset-0 bg-transparent overflow-hidden">
      <Canvas 
        camera={{ position: [2, 2, 2], fov: 50 }}
        shadows
        onPointerMissed={() => onSelectPiece(null, false)}
      >
        <color attach="background" args={['#393939']} />
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        
        <gridHelper args={[20, 40, '#282828', '#282828']} position={[0, -0.001, 0]} />
        <axesHelper args={[2]} />
 
        {pieces.map((piece) => (
          piece.cantidad > 0 && Array.from({ length: piece.cantidad }).map((_, idx) => (
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
              allPieces={pieces}
              isSelected={selectedPieceIds.includes(piece.id)}
              showControls={selectedPieceIds[0] === piece.id && idx === 0}
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
              snapActive={snapActive}
              interactMode={interactMode}
              onToggleDynamicPiece={onToggleDynamicPiece}
            />
          ))
        ))}

        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
