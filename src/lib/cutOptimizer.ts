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

interface PendingItem {
  w: number;
  h: number;
  id: string;
  name: string;
  veta: boolean;
  cantos: Piece['cantos'];
  material: string;
  espesor: number;
}

interface FreeSpace {
  x: number;
  y: number;
  w: number;
  h: number;
}

type SortMode = 'area' | 'long-side' | 'width' | 'perimeter';
type SplitMode = 'balanced' | 'wide';

const sortPending = (items: PendingItem[], mode: SortMode) => [...items].sort((a, b) => {
  if (mode === 'long-side') return Math.max(b.w, b.h) - Math.max(a.w, a.h) || (b.w * b.h) - (a.w * a.h);
  if (mode === 'width') return b.w - a.w || b.h - a.h;
  if (mode === 'perimeter') return (b.w + b.h) - (a.w + a.h) || (b.w * b.h) - (a.w * a.h);
  return (b.w * b.h) - (a.w * a.h) || Math.max(b.w, b.h) - Math.max(a.w, a.h);
});

const flattenPieces = (pieces: Piece[]): PendingItem[] => pieces.flatMap(piece => (
  Array.from({ length: Math.max(0, Math.floor(piece.cantidad || 0)) }, () => ({
    w: Math.max(0, piece.largo),
    h: Math.max(0, piece.ancho),
    id: piece.id,
    name: piece.name || 'Pieza sin nombre',
    veta: Boolean(piece.veta),
    cantos: piece.cantos,
    material: piece.material || 'MELAMINA',
    espesor: piece.espesor || 18,
  }))
));

const addBoardMargins = (config: SheetConfig) => {
  const { width, height, margin } = config;
  if (margin <= 0) return [];
  return [
    { x: 0, y: 0, w: width, h: margin, isMargin: true },
    { x: 0, y: height - margin, w: width, h: margin, isMargin: true },
    { x: 0, y: margin, w: margin, h: height - margin * 2, isMargin: true },
    { x: width - margin, y: margin, w: margin, h: height - margin * 2, isMargin: true },
  ];
};

const splitSpace = (space: FreeSpace, placedW: number, placedH: number, kerf: number, mode: SplitMode): FreeSpace[] => {
  const remainingW = space.w - placedW - kerf;
  const remainingH = space.h - placedH - kerf;
  const horizontalFirst = mode === 'wide'
    ? remainingW >= remainingH
    : Math.min(remainingW, placedH) >= Math.min(space.w, remainingH);

  const candidates = horizontalFirst
    ? [
        { x: space.x + placedW + kerf, y: space.y, w: remainingW, h: space.h },
        { x: space.x, y: space.y + placedH + kerf, w: placedW, h: remainingH },
      ]
    : [
        { x: space.x + placedW + kerf, y: space.y, w: remainingW, h: placedH },
        { x: space.x, y: space.y + placedH + kerf, w: space.w, h: remainingH },
      ];

  return candidates.filter(candidate => candidate.w > 0 && candidate.h > 0);
};

const packVariant = (source: PendingItem[], config: SheetConfig, sortMode: SortMode, splitMode: SplitMode) => {
  const width = Math.max(0, config.width);
  const height = Math.max(0, config.height);
  const kerf = Math.max(0, config.kerf);
  const margin = Math.max(0, config.margin);
  const usableW = width - margin * 2;
  const usableH = height - margin * 2;
  const pending = sortPending(source, sortMode);
  const boards: PackedBoardResult[] = [];
  const unplaced: string[] = [];
  let areaUsed = 0;

  if (usableW <= 0 || usableH <= 0) {
    return {
      boards,
      unplaced: pending.map(item => `${item.name} (${item.w}×${item.h} mm)`),
      stats: { efficiency: 0, areaUsed: 0, totalArea: 0, boardsCount: 0 },
    };
  }

  while (pending.length > 0) {
    const rects: PackedRect[] = [];
    const spaces: FreeSpace[] = [{ x: margin, y: margin, w: usableW, h: usableH }];

    for (let itemIndex = 0; itemIndex < pending.length; itemIndex += 1) {
      const item = pending[itemIndex];
      let best: { spaceIndex: number; rotated: boolean; score: number } | null = null;

      spaces.forEach((space, spaceIndex) => {
        const orientations = [{ w: item.w, h: item.h, rotated: false }];
        if (!item.veta && item.w !== item.h) orientations.push({ w: item.h, h: item.w, rotated: true });

        orientations.forEach(orientation => {
          if (orientation.w > space.w || orientation.h > space.h) return;
          const leftoverArea = space.w * space.h - orientation.w * orientation.h;
          const shortSideGap = Math.min(space.w - orientation.w, space.h - orientation.h);
          const longSideGap = Math.max(space.w - orientation.w, space.h - orientation.h);
          const score = leftoverArea * 1000 + shortSideGap * 10 + longSideGap;
          if (!best || score < best.score) best = { spaceIndex, rotated: orientation.rotated, score };
        });
      });

      if (!best) continue;
      const selected = best as { spaceIndex: number; rotated: boolean; score: number };
      const space = spaces[selected.spaceIndex];
      const placedW = selected.rotated ? item.h : item.w;
      const placedH = selected.rotated ? item.w : item.h;

      rects.push({
        x: space.x,
        y: space.y,
        w: placedW,
        h: placedH,
        id: item.id,
        name: item.name,
        rotated: selected.rotated,
        cutIndex: rects.length + 1,
        cantos: item.cantos,
        material: item.material,
        espesor: item.espesor,
      });
      areaUsed += placedW * placedH;

      spaces.splice(selected.spaceIndex, 1, ...splitSpace(space, placedW, placedH, kerf, splitMode));
      spaces.sort((a, b) => (a.w * a.h) - (b.w * b.h));
      pending.splice(itemIndex, 1);
      itemIndex -= 1;
    }

    if (rects.length === 0) {
      const rejected = pending.shift();
      if (rejected) unplaced.push(`${rejected.name} (${rejected.w}×${rejected.h} mm)`);
      continue;
    }

    const totalArea = width * height;
    const boardAreaUsed = rects.reduce((sum, rect) => sum + rect.w * rect.h, 0);
    boards.push({
      boardIndex: boards.length + 1,
      rects,
      wasteRects: [
        ...addBoardMargins({ width, height, kerf, margin }),
        ...spaces.filter(space => space.w > 2 && space.h > 2).map(space => ({ ...space, isMargin: false })),
      ],
      stats: {
        efficiency: totalArea > 0 ? boardAreaUsed / totalArea * 100 : 0,
        areaUsed: boardAreaUsed,
        totalArea,
      },
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
};

/**
 * Runs several guillotine strategies and keeps the result that uses the fewest
 * sheets. Grain-directed pieces are never rotated; kerf and trimming margins
 * are reserved in every placement.
 */
export function professionalPack(pieces: Piece[], config: SheetConfig) {
  const items = flattenPieces(pieces);
  const variants = (['area', 'long-side', 'width', 'perimeter'] as SortMode[]).flatMap(sortMode => (
    (['balanced', 'wide'] as SplitMode[]).map(splitMode => packVariant(items, config, sortMode, splitMode))
  ));

  return variants.reduce((best, candidate) => {
    if (candidate.unplaced.length !== best.unplaced.length) {
      return candidate.unplaced.length < best.unplaced.length ? candidate : best;
    }
    if (candidate.stats.boardsCount !== best.stats.boardsCount) {
      return candidate.stats.boardsCount < best.stats.boardsCount ? candidate : best;
    }
    return candidate.stats.efficiency > best.stats.efficiency ? candidate : best;
  }, variants[0] || packVariant(items, config, 'area', 'balanced'));
}
