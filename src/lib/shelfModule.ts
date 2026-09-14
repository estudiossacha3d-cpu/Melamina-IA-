import { v4 as uuidv4 } from 'uuid';
import type { EdgeConfig, Group3D, Piece } from '../types';

export type ShelfModuleBack = 'none' | 'mdf3' | 'melamine18';

export interface ShelfModuleConfig {
  name: string;
  width: number;
  height: number;
  depth: number;
  thickness: number;
  plinthHeight: number;
  plinthInset: number;
  shelves: number;
  verticalDividers: number;
  back: ShelfModuleBack;
  material: string;
}

export interface ShelfModuleResult {
  pieces: Piece[];
  group: Group3D;
  columns: number;
  levels: number;
}

const noEdges = (): EdgeConfig => ({
  largo1: 'Ninguno',
  largo2: 'Ninguno',
  ancho1: 'Ninguno',
  ancho2: 'Ninguno',
});

const frontEdge = (): EdgeConfig => ({
  ...noEdges(),
  ancho1: 'Canto Delgado',
});

const wholeNumber = (value: number, label: string, minimum: number, maximum: number) => {
  const normalized = Math.round(Number(value));
  if (!Number.isFinite(normalized) || normalized < minimum || normalized > maximum) {
    throw new Error(label + ' debe estar entre ' + minimum + ' y ' + maximum + '.');
  }
  return normalized;
};

/**
 * Creates an open melamine shelf module with a recessed plinth.
 * Horizontal shelves are split per column so they never intersect vertical dividers.
 */
export function createShelfModule(config: ShelfModuleConfig, originX = 0): ShelfModuleResult {
  const width = wholeNumber(config.width, 'El ancho', 300, 3000);
  const height = wholeNumber(config.height, 'El alto', 400, 3000);
  const depth = wholeNumber(config.depth, 'El fondo', 150, 800);
  const thickness = wholeNumber(config.thickness, 'El espesor', 9, 36);
  const plinthHeight = wholeNumber(config.plinthHeight, 'La altura del zócalo', 40, 300);
  const plinthInset = wholeNumber(config.plinthInset, 'El retiro del zócalo', 0, 150);
  const shelves = wholeNumber(config.shelves, 'La cantidad de repisas', 0, 12);
  const verticalDividers = wholeNumber(config.verticalDividers, 'La cantidad de divisiones verticales', 0, 8);

  if (width <= thickness * 2 + 100) {
    throw new Error('El ancho es insuficiente para los dos laterales.');
  }
  if (height <= plinthHeight + thickness * 2 + 100) {
    throw new Error('El alto es insuficiente para el zócalo y el espacio interior.');
  }
  if (plinthInset + thickness >= depth) {
    throw new Error('El retiro del zócalo debe ser menor que el fondo.');
  }
  if (!['none', 'mdf3', 'melamine18'].includes(config.back)) {
    throw new Error('Selecciona un respaldo válido.');
  }

  const innerWidth = width - thickness * 2;
  const columns = verticalDividers + 1;
  const bayWidth = (innerWidth - verticalDividers * thickness) / columns;
  if (bayWidth < 100) {
    throw new Error('Reduce las divisiones verticales o aumenta el ancho del módulo.');
  }

  const clearBottom = plinthHeight + thickness;
  const clearTop = height - thickness;
  const clearHeight = clearTop - clearBottom;
  const shelfGap = (clearHeight - shelves * thickness) / (shelves + 1);
  if (shelfGap < 80) {
    throw new Error('Reduce las repisas o aumenta el alto del módulo.');
  }

  const groupId = uuidv4();
  const moduleName = config.name.trim() || 'Estante con zócalo';
  const material = config.material || 'Pelikano_Blanco_Absoluto';
  const common = {
    cantidad: 1,
    material,
    veta: false,
    ranurado: false,
    abisagrado: false,
    groupId,
  };
  const pieces: Piece[] = [];
  const add = (piece: Omit<Piece, 'id'>) => pieces.push({ id: uuidv4(), ...piece });

  add({
    ...common,
    name: 'Lateral izquierdo',
    largo: height,
    ancho: depth,
    espesor: thickness,
    cantos: frontEdge(),
    position3D: [originX - width / 2 + thickness / 2, height / 2, 0],
    rotation3D: [0, 0, Math.PI / 2],
  });
  add({
    ...common,
    name: 'Lateral derecho',
    largo: height,
    ancho: depth,
    espesor: thickness,
    cantos: frontEdge(),
    position3D: [originX + width / 2 - thickness / 2, height / 2, 0],
    rotation3D: [0, 0, Math.PI / 2],
  });
  add({
    ...common,
    name: 'Base sobre zócalo',
    largo: innerWidth,
    ancho: depth,
    espesor: thickness,
    cantos: frontEdge(),
    position3D: [originX, plinthHeight + thickness / 2, 0],
    rotation3D: [0, 0, 0],
  });
  add({
    ...common,
    name: 'Tapa',
    largo: innerWidth,
    ancho: depth,
    espesor: thickness,
    cantos: frontEdge(),
    position3D: [originX, height - thickness / 2, 0],
    rotation3D: [0, 0, 0],
  });
  add({
    ...common,
    name: 'Zócalo frontal',
    largo: innerWidth,
    ancho: plinthHeight,
    espesor: thickness,
    cantos: frontEdge(),
    position3D: [originX, plinthHeight / 2, depth / 2 - plinthInset - thickness / 2],
    rotation3D: [Math.PI / 2, 0, 0],
  });

  const dividerDepth = Math.max(100, depth - 20);
  const leftInside = originX - width / 2 + thickness;

  for (let divider = 1; divider <= verticalDividers; divider += 1) {
    add({
      ...common,
      name: 'División vertical ' + divider,
      largo: clearHeight,
      ancho: dividerDepth,
      espesor: thickness,
      cantos: frontEdge(),
      position3D: [
        leftInside + divider * bayWidth + (divider - 0.5) * thickness,
        (clearBottom + clearTop) / 2,
        10,
      ],
      rotation3D: [0, 0, Math.PI / 2],
    });
  }

  for (let shelf = 0; shelf < shelves; shelf += 1) {
    const shelfY = clearBottom + shelfGap * (shelf + 1) + thickness * shelf + thickness / 2;
    for (let column = 0; column < columns; column += 1) {
      add({
        ...common,
        name: 'Repisa ' + (shelf + 1) + ' · cuerpo ' + (column + 1),
        largo: bayWidth,
        ancho: dividerDepth,
        espesor: thickness,
        cantos: frontEdge(),
        position3D: [
          leftInside + column * (bayWidth + thickness) + bayWidth / 2,
          shelfY,
          10,
        ],
        rotation3D: [0, 0, 0],
      });
    }
  }

  if (config.back === 'mdf3') {
    add({
      ...common,
      name: 'Respaldo MDF 3 mm',
      largo: width,
      ancho: height,
      espesor: 3,
      material: 'MDF 3 mm',
      cantos: noEdges(),
      position3D: [originX, height / 2, -depth / 2 + 1.5],
      rotation3D: [Math.PI / 2, 0, 0],
    });
  } else if (config.back === 'melamine18') {
    add({
      ...common,
      name: 'Respaldo de melamina',
      largo: innerWidth,
      ancho: clearHeight,
      espesor: thickness,
      cantos: noEdges(),
      position3D: [originX, (clearBottom + clearTop) / 2, -depth / 2 + thickness / 2],
      rotation3D: [Math.PI / 2, 0, 0],
    });
  }

  return {
    pieces,
    group: {
      id: groupId,
      name: moduleName,
      position3D: [0, 0, 0],
      rotation3D: [0, 0, 0],
    },
    columns,
    levels: shelves + 1,
  };
}
