import { Piece, SheetConfig } from '../types';
import { PackedBoardResult, professionalPack } from './cutOptimizer';
import { sheetGroupKey } from './project';

export interface MaterialReportGroup {
  key: string;
  material: string;
  color?: string;
  thickness: number;
  config: SheetConfig;
  piecesCount: number;
  uniquePieces: number;
  boards: PackedBoardResult[];
  stats: {
    efficiency: number;
    areaUsed: number;
    totalArea: number;
    boardsCount: number;
  };
  requiredAreaM2: number;
  purchaseAreaM2: number;
  wasteAreaM2: number;
  thinEdgeM: number;
  thickEdgeM: number;
  unplaced: string[];
}

export interface MaterialReport {
  groups: MaterialReportGroup[];
  totals: {
    materialGroups: number;
    piecesCount: number;
    uniquePieces: number;
    boardsCount: number;
    areaUsed: number;
    totalArea: number;
    requiredAreaM2: number;
    purchaseAreaM2: number;
    wasteAreaM2: number;
    efficiency: number;
    thinEdgeM: number;
    thickEdgeM: number;
    unplacedCount: number;
  };
  unplacedPieces: string[];
}

const validQuantity = (piece: Piece) => Math.max(0, Math.floor(piece.cantidad || 0));

const edgeMeters = (pieces: Piece[]) => pieces.reduce((totals, piece) => {
  const quantity = validQuantity(piece);
  const edges = [
    { type: piece.cantos?.largo1, length: piece.largo },
    { type: piece.cantos?.largo2, length: piece.largo },
    { type: piece.cantos?.ancho1, length: piece.ancho },
    { type: piece.cantos?.ancho2, length: piece.ancho },
  ];

  edges.forEach(edge => {
    const lengthM = Math.max(0, edge.length) * quantity / 1000;
    if (edge.type === 'Canto Delgado') totals.thin += lengthM;
    if (edge.type === 'Canto Grueso') totals.thick += lengthM;
  });

  return totals;
}, { thin: 0, thick: 0 });

/**
 * Produces the purchasing and production summary used by the 2D cut view.
 * Sheets are separated by material, colour and thickness because those groups
 * cannot share a physical board.
 */
export function buildMaterialReport(pieces: Piece[], sheetConfig: SheetConfig): MaterialReport {
  const grouped = new Map<string, Piece[]>();

  pieces.forEach(piece => {
    const key = sheetGroupKey(piece);
    const group = grouped.get(key) || [];
    group.push(piece);
    grouped.set(key, group);
  });

  const groups = Array.from(grouped.entries()).map(([key, groupPieces]) => {
    const firstPiece = groupPieces[0];
    const thickness = firstPiece.espesor || 18;
    const config = thickness === 3
      ? { ...sheetConfig, width: 2440, height: 1850 }
      : { ...sheetConfig };
    const packed = professionalPack(groupPieces, config);
    const piecesCount = groupPieces.reduce((sum, piece) => sum + validQuantity(piece), 0);
    const requiredAreaM2 = groupPieces.reduce((sum, piece) => (
      sum + Math.max(0, piece.largo) * Math.max(0, piece.ancho) * validQuantity(piece)
    ), 0) / 1_000_000;
    const purchaseAreaM2 = packed.stats.totalArea / 1_000_000;
    const wasteAreaM2 = Math.max(0, packed.stats.totalArea - packed.stats.areaUsed) / 1_000_000;
    const edges = edgeMeters(groupPieces);

    return {
      key,
      material: firstPiece.material || 'Blanco',
      color: firstPiece.customColor,
      thickness,
      config,
      piecesCount,
      uniquePieces: groupPieces.length,
      boards: packed.boards,
      stats: packed.stats,
      requiredAreaM2,
      purchaseAreaM2,
      wasteAreaM2,
      thinEdgeM: edges.thin,
      thickEdgeM: edges.thick,
      unplaced: packed.unplaced,
    } satisfies MaterialReportGroup;
  });

  const totals = groups.reduce((summary, group) => {
    summary.piecesCount += group.piecesCount;
    summary.uniquePieces += group.uniquePieces;
    summary.boardsCount += group.stats.boardsCount;
    summary.areaUsed += group.stats.areaUsed;
    summary.totalArea += group.stats.totalArea;
    summary.requiredAreaM2 += group.requiredAreaM2;
    summary.purchaseAreaM2 += group.purchaseAreaM2;
    summary.wasteAreaM2 += group.wasteAreaM2;
    summary.thinEdgeM += group.thinEdgeM;
    summary.thickEdgeM += group.thickEdgeM;
    summary.unplacedCount += group.unplaced.length;
    return summary;
  }, {
    materialGroups: groups.length,
    piecesCount: 0,
    uniquePieces: 0,
    boardsCount: 0,
    areaUsed: 0,
    totalArea: 0,
    requiredAreaM2: 0,
    purchaseAreaM2: 0,
    wasteAreaM2: 0,
    efficiency: 0,
    thinEdgeM: 0,
    thickEdgeM: 0,
    unplacedCount: 0,
  });

  totals.efficiency = totals.totalArea > 0 ? totals.areaUsed / totals.totalArea * 100 : 0;

  return {
    groups,
    totals,
    unplacedPieces: groups.flatMap(group => group.unplaced),
  };
}
