import { v4 as uuidv4 } from 'uuid';
import { Group3D, Piece } from '../types';

export interface ProjectState {
  pieces: Piece[];
  groups: Group3D[];
}

const noEdges = () => ({
  largo1: 'Ninguno' as const,
  largo2: 'Ninguno' as const,
  ancho1: 'Ninguno' as const,
  ancho2: 'Ninguno' as const,
});

const frontEdge = () => ({
  ...noEdges(),
  ancho1: 'Canto Delgado' as const,
});

/** Creates an editable 800 mm base cabinet using centre positions in millimetres. */
export function createStarterProject(): ProjectState {
  const width = 800;
  const height = 720;
  const depth = 560;
  const thickness = 18;
  const groupId = uuidv4();
  const material = 'Pelikano_Blanco_Absoluto';
  const base = {
    cantidad: 1,
    material,
    veta: false,
    ranurado: false,
    abisagrado: false,
    groupId,
  };

  const pieces: Piece[] = [
    {
      ...base,
      id: uuidv4(),
      name: 'Lateral izquierdo',
      largo: height,
      ancho: depth,
      espesor: thickness,
      cantos: frontEdge(),
      position3D: [-width / 2 + thickness / 2, height / 2, 0],
      rotation3D: [0, 0, Math.PI / 2],
    },
    {
      ...base,
      id: uuidv4(),
      name: 'Lateral derecho',
      largo: height,
      ancho: depth,
      espesor: thickness,
      cantos: frontEdge(),
      position3D: [width / 2 - thickness / 2, height / 2, 0],
      rotation3D: [0, 0, Math.PI / 2],
    },
    {
      ...base,
      id: uuidv4(),
      name: 'Base',
      largo: width - thickness * 2,
      ancho: depth,
      espesor: thickness,
      cantos: frontEdge(),
      position3D: [0, thickness / 2, 0],
      rotation3D: [0, 0, 0],
    },
    {
      ...base,
      id: uuidv4(),
      name: 'Tapa',
      largo: width - thickness * 2,
      ancho: depth,
      espesor: thickness,
      cantos: frontEdge(),
      position3D: [0, height - thickness / 2, 0],
      rotation3D: [0, 0, 0],
    },
    {
      ...base,
      id: uuidv4(),
      name: 'Repisa',
      largo: width - thickness * 2,
      ancho: depth - 20,
      espesor: thickness,
      cantos: frontEdge(),
      position3D: [0, height / 2, 10],
      rotation3D: [0, 0, 0],
    },
    {
      ...base,
      id: uuidv4(),
      name: 'Respaldo MDF 3 mm',
      largo: width,
      ancho: height,
      espesor: 3,
      material: 'MDF 3 mm',
      cantos: noEdges(),
      position3D: [0, height / 2, -depth / 2 + 1.5],
      rotation3D: [Math.PI / 2, 0, 0],
    },
  ];

  return {
    pieces,
    groups: [{ id: groupId, name: 'Módulo base 800', position3D: [0, 0, 0], rotation3D: [0, 0, 0] }],
  };
}

export function isProjectState(value: unknown): value is ProjectState {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<ProjectState>;
  return Array.isArray(project.pieces) && project.pieces.every(piece => (
    piece &&
    typeof piece.id === 'string' &&
    Number.isFinite(piece.largo) && piece.largo > 0 &&
    Number.isFinite(piece.ancho) && piece.ancho > 0 &&
    Number.isFinite(piece.espesor) && piece.espesor > 0 &&
    Array.isArray(piece.position3D) && piece.position3D.length === 3 &&
    Array.isArray(piece.rotation3D) && piece.rotation3D.length === 3
  ));
}

const escapeCsv = (value: unknown) => {
  const text = String(value ?? '');
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function serializePiecesCsv(pieces: Piece[]): string {
  const header = [
    'Pieza', 'Cantidad', 'Largo_mm', 'Ancho_mm', 'Espesor_mm', 'Material', 'Veta',
    'Canto_L1', 'Canto_L2', 'Canto_A1', 'Canto_A2', 'Pos_X_mm', 'Pos_Y_mm', 'Pos_Z_mm',
  ];
  const rows = pieces.map(piece => [
    piece.name,
    piece.cantidad,
    Math.round(piece.largo),
    Math.round(piece.ancho),
    Math.round(piece.espesor),
    piece.material || 'Blanco',
    piece.veta ? 'Sí' : 'No',
    piece.cantos?.largo1 || 'Ninguno',
    piece.cantos?.largo2 || 'Ninguno',
    piece.cantos?.ancho1 || 'Ninguno',
    piece.cantos?.ancho2 || 'Ninguno',
    Math.round(piece.position3D[0]),
    Math.round(piece.position3D[1]),
    Math.round(piece.position3D[2]),
  ]);

  return [header, ...rows].map(row => row.map(escapeCsv).join(';')).join('\n');
}

export function sheetGroupKey(piece: Piece): string {
  return `${piece.espesor || 18}::${piece.material || 'Blanco'}::${piece.customColor || ''}`;
}
