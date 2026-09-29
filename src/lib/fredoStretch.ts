import * as THREE from 'three';
import { Piece } from '../types';

export type FredoStretchAxis = 'X' | 'Y' | 'Z';
export type FredoStretchMode = 'anchor-neg' | 'anchor-pos' | 'center';

export interface FredoGroupBounds {
  min: THREE.Vector3; // in mm
  max: THREE.Vector3; // in mm
  center: THREE.Vector3; // in mm
  size: THREE.Vector3; // in mm
}

/**
 * Calculates AABB bounding box in mm for a group of pieces.
 */
export function computePiecesBoundingBoxMm(pieces: Piece[]): FredoGroupBounds {
  if (pieces.length === 0) {
    return {
      min: new THREE.Vector3(0, 0, 0),
      max: new THREE.Vector3(100, 100, 100),
      center: new THREE.Vector3(50, 50, 50),
      size: new THREE.Vector3(100, 100, 100)
    };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  pieces.forEach(p => {
    const euler = new THREE.Euler(p.rotation3D[0], p.rotation3D[1], p.rotation3D[2]);
    const vX = new THREE.Vector3(1, 0, 0).applyEuler(euler);
    const vY = new THREE.Vector3(0, 1, 0).applyEuler(euler);
    const vZ = new THREE.Vector3(0, 0, 1).applyEuler(euler);

    const halfX = (Math.abs(vX.x) * p.largo + Math.abs(vY.x) * p.espesor + Math.abs(vZ.x) * p.ancho) / 2;
    const halfY = (Math.abs(vX.y) * p.largo + Math.abs(vY.y) * p.espesor + Math.abs(vZ.y) * p.ancho) / 2;
    const halfZ = (Math.abs(vX.z) * p.largo + Math.abs(vY.z) * p.espesor + Math.abs(vZ.z) * p.ancho) / 2;

    minX = Math.min(minX, p.position3D[0] - halfX);
    maxX = Math.max(maxX, p.position3D[0] + halfX);
    minY = Math.min(minY, p.position3D[1] - halfY);
    maxY = Math.max(maxY, p.position3D[1] + halfY);
    minZ = Math.min(minZ, p.position3D[2] - halfZ);
    maxZ = Math.max(maxZ, p.position3D[2] + halfZ);
  });

  const min = new THREE.Vector3(minX, minY, minZ);
  const max = new THREE.Vector3(maxX, maxY, maxZ);
  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  const size = new THREE.Vector3(
    Math.max(10, maxX - minX),
    Math.max(10, maxY - minY),
    Math.max(10, maxZ - minZ)
  );

  return { min, max, center, size };
}

export interface FredoStretchOptions {
  pieces: Piece[];
  axis: FredoStretchAxis;
  planeRatio: number; // 0.0 to 1.0 (default 0.5)
  mode: FredoStretchMode;
  deltaMm: number; // Stretch amount in mm
  initialBounds?: FredoGroupBounds;
}

export interface FredoStretchResult {
  updatedPieces: Piece[];
  newBounds: FredoGroupBounds;
  deltaApplied: number;
}

/**
 * FredoScale Box Stretch without board thickness deformation.
 * Expands length/width of boards crossing the cut plane, moves boards on the mobile side,
 * and maintains board thickness (espesor) intact.
 */
export function calculateFredoStretch(options: FredoStretchOptions): FredoStretchResult {
  const { pieces, axis, planeRatio, mode, deltaMm } = options;
  if (pieces.length === 0 || deltaMm === 0) {
    const currentBounds = computePiecesBoundingBoxMm(pieces);
    return {
      updatedPieces: pieces,
      newBounds: currentBounds,
      deltaApplied: 0
    };
  }

  const initialBounds = options.initialBounds || computePiecesBoundingBoxMm(pieces);
  const axisIdx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
  const axisMin = initialBounds.min.getComponent(axisIdx);
  const axisSize = initialBounds.size.getComponent(axisIdx);

  // Position of the cutting mesh plane along the chosen axis in mm
  const planePos = axisMin + axisSize * Math.max(0.05, Math.min(0.95, planeRatio));
  const tolerance = 2.0; // 2mm tolerance to handle coplanar boundaries cleanly

  const updatedPieces = pieces.map(p => {
    const euler = new THREE.Euler(p.rotation3D[0], p.rotation3D[1], p.rotation3D[2]);
    const vX = new THREE.Vector3(1, 0, 0).applyEuler(euler);
    const vY = new THREE.Vector3(0, 1, 0).applyEuler(euler);
    const vZ = new THREE.Vector3(0, 0, 1).applyEuler(euler);

    // Half size of this piece along the stretch axis
    const halfOnAxis = (Math.abs(vX.getComponent(axisIdx)) * p.largo +
                        Math.abs(vY.getComponent(axisIdx)) * p.espesor +
                        Math.abs(vZ.getComponent(axisIdx)) * p.ancho) / 2;

    const pieceCenterOnAxis = p.position3D[axisIdx];
    const pieceMinOnAxis = pieceCenterOnAxis - halfOnAxis;
    const pieceMaxOnAxis = pieceCenterOnAxis + halfOnAxis;

    // Check if this board's thickness (Y axis) is oriented along the stretch axis
    const isThicknessParallelToStretch = Math.abs(vY.getComponent(axisIdx)) > 0.707;

    // A piece crosses the plane only if it is NOT a partition whose thickness is along the stretch axis.
    // Partition boards (e.g. vertical dividers or side uprights) have thickness along this axis and must never cross-expand.
    const crossesPlane = !isThicknessParallelToStretch && 
                         (pieceMinOnAxis < planePos - tolerance) && 
                         (pieceMaxOnAxis > planePos + tolerance);

    const isStrictlyNegative = isThicknessParallelToStretch ? pieceCenterOnAxis < planePos : pieceMaxOnAxis <= planePos + tolerance;
    const isStrictlyPositive = isThicknessParallelToStretch ? pieceCenterOnAxis >= planePos : pieceMinOnAxis >= planePos - tolerance;

    let shift = 0;
    let newLargo = p.largo;
    let newAncho = p.ancho;
    const newEspesor = p.espesor; // STRICTLY PRESERVED: Never deform thickness!

    if (crossesPlane) {
      // Piece spans across the dividing mesh plane -> resize along the stretch axis
      const alignLargo = Math.abs(vX.getComponent(axisIdx));
      const alignAncho = Math.abs(vZ.getComponent(axisIdx));

      if (alignLargo >= alignAncho) {
        newLargo = Math.max(10, Math.round(p.largo + deltaMm));
      } else {
        newAncho = Math.max(10, Math.round(p.ancho + deltaMm));
      }

      // Center shift for crossing pieces depends on anchoring
      if (mode === 'anchor-neg') {
        shift = deltaMm / 2;
      } else if (mode === 'anchor-pos') {
        shift = -deltaMm / 2;
      } else {
        // center mode: expands symmetrically, center remains fixed
        shift = 0;
      }
    } else if (isStrictlyNegative) {
      // Piece is completely before the cutting plane
      if (mode === 'anchor-neg') {
        shift = 0; // Anchored side stays fixed
      } else if (mode === 'anchor-pos') {
        shift = -deltaMm; // Opposite side pulled outward
      } else {
        // center mode: negative side shifts outwards by -delta/2
        shift = -deltaMm / 2;
      }
    } else if (isStrictlyPositive) {
      // Piece is completely after the cutting plane
      if (mode === 'anchor-neg') {
        shift = deltaMm; // Positive side pulled outward
      } else if (mode === 'anchor-pos') {
        shift = 0; // Anchored side stays fixed
      } else {
        // center mode: positive side shifts outwards by +delta/2
        shift = deltaMm / 2;
      }
    }

    const newPos: [number, number, number] = [...p.position3D];
    newPos[axisIdx] = Math.round((newPos[axisIdx] + shift) * 100) / 100;

    return {
      ...p,
      largo: newLargo,
      ancho: newAncho,
      espesor: newEspesor,
      position3D: newPos
    };
  });

  const newBounds = computePiecesBoundingBoxMm(updatedPieces);
  return {
    updatedPieces,
    newBounds,
    deltaApplied: deltaMm
  };
}
