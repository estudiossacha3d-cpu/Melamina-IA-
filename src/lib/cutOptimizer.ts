import { Piece, SheetConfig } from '../types';

export interface PackedRect {
  x: number;
  y: number;
  w: number;
  h: number;
  id: string;
  name: string;
  rotated: boolean;
  cutIndex: number;
  cantos: Piece['cantos'];
  material?: string;
  espesor?: number;
}

export interface PackedBoardResult {
  boardIndex: number;
  rects: PackedRect[];
  wasteRects: { x: number; y: number; w: number; h: number; isMargin?: boolean }[];
  stats: { efficiency: number; areaUsed: number; totalArea: number };
}

/** First-fit decreasing guillotine packing with kerf, margin and grain support. */
export function professionalPack(pieces: Piece[], config: SheetConfig) {
  const { width, height, kerf, margin } = config;
  const usableW = width - margin * 2;
  const usableH = height - margin * 2;
  const pending = pieces.flatMap(piece => Array.from({ length: Math.max(0, piece.cantidad) }, () => ({
    w: piece.largo,
    h: piece.ancho,
    id: piece.id,
    name: piece.name,
    veta: !!piece.veta,
    cantos: piece.cantos,
    material: piece.material || 'MELAMINA',
    espesor: piece.espesor || 18,
  }))).sort((a, b) => b.w * b.h - a.w * a.h);

  const boards: PackedBoardResult[] = [];
  const unplaced: string[] = [];
  let areaUsed = 0;

  while (pending.length > 0) {
    const rects: PackedRect[] = [];
    const spaces = [{ x: margin, y: margin, w: usableW, h: usableH }];

    for (let i = 0; i < pending.length; i += 1) {
      const item = pending[i];
      let spaceIndex = -1;
      let rotated = false;

      for (let j = 0; j < spaces.length; j += 1) {
        const space = spaces[j];
        if (item.w <= space.w && item.h <= space.h) {
          spaceIndex = j;
          break;
        }
        if (!item.veta && item.h <= space.w && item.w <= space.h) {
          spaceIndex = j;
          rotated = true;
          break;
        }
      }

      if (spaceIndex < 0) continue;
      const space = spaces[spaceIndex];
      const placedW = rotated ? item.h : item.w;
      const placedH = rotated ? item.w : item.h;
      rects.push({
        x: space.x,
        y: space.y,
        w: placedW,
        h: placedH,
        id: item.id,
        name: item.name,
        rotated,
        cutIndex: rects.length + 1,
        cantos: item.cantos,
        material: item.material,
        espesor: item.espesor,
      });
      areaUsed += placedW * placedH;

      const remainingW = space.w - placedW - kerf;
      const remainingH = space.h - placedH - kerf;
      spaces.splice(spaceIndex, 1);
      if (remainingW > 0) spaces.push({ x: space.x + placedW + kerf, y: space.y, w: remainingW, h: placedH });
      if (remainingH > 0) spaces.push({ x: space.x, y: space.y + placedH + kerf, w: space.w, h: remainingH });
      spaces.sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y);
      pending.splice(i, 1);
      i -= 1;
    }

    if (rects.length === 0) {
      const rejected = pending.shift();
      if (rejected) unplaced.push(`${rejected.name} (${rejected.w}×${rejected.h} mm)`);
      continue;
    }

    const wasteRects = [
      ...(margin > 0 ? [
        { x: 0, y: 0, w: width, h: margin, isMargin: true },
        { x: 0, y: height - margin, w: width, h: margin, isMargin: true },
        { x: 0, y: margin, w: margin, h: height - margin * 2, isMargin: true },
        { x: width - margin, y: margin, w: margin, h: height - margin * 2, isMargin: true },
      ] : []),
      ...spaces.filter(space => space.w > 2 && space.h > 2).map(space => ({ ...space, isMargin: false })),
    ];
    const boardAreaUsed = rects.reduce((sum, rect) => sum + rect.w * rect.h, 0);
    const totalArea = width * height;
    boards.push({
      boardIndex: boards.length + 1,
      rects,
      wasteRects,
      stats: { efficiency: totalArea > 0 ? boardAreaUsed / totalArea * 100 : 0, areaUsed: boardAreaUsed, totalArea },
    });
  }

  const totalArea = boards.length * width * height;
  return {
    boards,
    unplaced,
    stats: {
      efficiency: totalArea > 0 ? areaUsed / totalArea * 100 : 0,
      areaUsed,
      totalArea,
      boardsCount: boards.length,
    },
  };
}
