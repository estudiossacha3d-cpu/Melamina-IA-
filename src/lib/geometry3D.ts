import * as THREE from 'three';
import { Piece } from '../types';

/**
 * Computes bounding half-dimensions in global 3D space taking Euler rotation into account.
 * Returns half-sizes in meters (multiply by 1000 for mm).
 */
export const getGlobalHalfSizes = (
  rot: [number, number, number] | THREE.Euler,
  largoVal: number,
  espesorVal: number,
  anchoVal: number
): THREE.Vector3 => {
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

/**
 * Calculates the required delta Y (in mm) to snap the bottom of the piece (or group of pieces)
 * exactly to the floor plane (Y = 0).
 */
export const calculateSnapToFloorDeltaY = (piecesToSnap: Piece[]): number => {
  if (piecesToSnap.length === 0) return 0;

  // Find lowest global bottom point among all selected pieces
  let lowestBottomMm = Infinity;

  piecesToSnap.forEach(piece => {
    const halfY_mm = getGlobalHalfSizes(piece.rotation3D, piece.largo, piece.espesor, piece.ancho).y * 1000;
    const centerPosY_mm = piece.position3D[1];
    const bottomY_mm = centerPosY_mm - halfY_mm;
    if (bottomY_mm < lowestBottomMm) {
      lowestBottomMm = bottomY_mm;
    }
  });

  if (!isFinite(lowestBottomMm)) return 0;

  // We want lowestBottom to become 0 mm
  // deltaY = 0 - lowestBottom
  return Math.round(-lowestBottomMm);
};
