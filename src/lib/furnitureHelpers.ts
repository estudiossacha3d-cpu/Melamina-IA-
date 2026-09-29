import { DynamicFurnitureItem, Piece } from '../types';

/**
 * Ensures that every furniture item in the warehouse has realistic, correctly-oriented 3D pieces,
 * whether custom-created in 3D or generated from dynamic dimensions.
 */
export function getFurnitureEffectivePieces(item: DynamicFurnitureItem): Piece[] {
  if (item.pieces && item.pieces.length > 0) {
    return item.pieces;
  }

  const { width: W, height: H, depth: D } = item.dimensions;
  const T = item.thickness || 18;
  const groupId = item.id;
  
  // Pick standard wood or melamine based on category
  const mat = item.category === 'Cocina' ? 'Roble Natural' 
    : item.category === 'Dormitorio' ? 'Macadamia' 
    : item.category === 'Baño' ? 'Blanco Humo' 
    : 'Coñac';

  const pieces: Piece[] = [
    {
      id: `${item.id}-lat-izq`,
      name: 'Lateral Izquierdo',
      groupId,
      largo: T,
      espesor: H,
      ancho: D,
      cantidad: 1,
      cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [-W / 2 + T / 2, 0, 0],
      rotation3D: [0, 0, 0],
      material: mat
    },
    {
      id: `${item.id}-lat-der`,
      name: 'Lateral Derecho',
      groupId,
      largo: T,
      espesor: H,
      ancho: D,
      cantidad: 1,
      cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [W / 2 - T / 2, 0, 0],
      rotation3D: [0, 0, 0],
      material: mat
    },
    {
      id: `${item.id}-base`,
      name: 'Piso / Base',
      groupId,
      largo: Math.max(10, W - 2 * T),
      espesor: T,
      ancho: D,
      cantidad: 1,
      cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [0, -H / 2 + T / 2, 0],
      rotation3D: [0, 0, 0],
      material: mat
    },
    {
      id: `${item.id}-techo`,
      name: 'Techo / Cubierta',
      groupId,
      largo: Math.max(10, W - 2 * T),
      espesor: T,
      ancho: D,
      cantidad: 1,
      cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [0, H / 2 - T / 2, 0],
      rotation3D: [0, 0, 0],
      material: mat
    },
    {
      id: `${item.id}-repisa`,
      name: 'Repisa Central',
      groupId,
      largo: Math.max(10, W - 2 * T),
      espesor: T,
      ancho: Math.max(10, D - 20),
      cantidad: 1,
      cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [0, 0, -10],
      rotation3D: [0, 0, 0],
      material: mat
    },
    {
      id: `${item.id}-fondo`,
      name: 'Fondo Rigidizador',
      groupId,
      largo: Math.max(10, W - 2 * T + 10),
      espesor: Math.max(10, H - 2 * T + 10),
      ancho: 3,
      cantidad: 1,
      cantos: { largo1: 'Ninguno', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [0, 0, -D / 2 + 1.5],
      rotation3D: [0, 0, 0],
      material: 'Blanco Humo'
    }
  ];

  return pieces;
}

/**
 * Calculates carpentry metrics: total board area in m², volume in m³, and estimated weight in kg.
 */
export function calculateFurnitureMetrics(pieces: Piece[]) {
  let totalAreaMm2 = 0;
  let totalPiecesCount = 0;

  pieces.forEach(p => {
    const qty = p.cantidad || 1;
    // Length in planar cutting is the 2 largest dimensions
    const dimsSorted = [p.largo || 0, p.ancho || 0, p.espesor || 0].sort((a, b) => b - a);
    const d1 = dimsSorted[0];
    const d2 = dimsSorted[1];
    totalAreaMm2 += (d1 * d2) * qty;
    totalPiecesCount += qty;
  });

  const totalAreaM2 = totalAreaMm2 / 1_000_000;
  // Standard 18mm melamine density is ~13.5 kg/m2
  const estWeightKg = Math.round(totalAreaM2 * 13.5 * 10) / 10;

  return {
    totalAreaM2: Math.round(totalAreaM2 * 100) / 100,
    totalPiecesCount,
    estWeightKg
  };
}
