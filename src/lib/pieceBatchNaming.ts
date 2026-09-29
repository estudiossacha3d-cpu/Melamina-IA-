import { Piece } from '../types';

export interface ParsedPieceName {
  base: string;
  num: number | null;
  format: 'int' | 'copia' | 'paren' | 'space' | 'none';
}

/**
 * Parsea el nombre de una pieza separando su nombre base y su sufijo de numeración
 * Ejemplos:
 * - "REPISA (INT.2)" -> base: "REPISA", num: 2, format: 'int'
 * - "NUEVA PIEZA (Int.5)" -> base: "NUEVA PIEZA", num: 5, format: 'int'
 * - "Estante (Copia 3)" -> base: "Estante", num: 3, format: 'copia'
 * - "Repisa (4)" -> base: "Repisa", num: 4, format: 'paren'
 * - "Repisa 2" -> base: "Repisa", num: 2, format: 'space'
 */
export function parsePieceName(fullName: string): ParsedPieceName {
  if (!fullName || typeof fullName !== 'string') {
    return { base: 'PIEZA', num: null, format: 'none' };
  }

  const trimmed = fullName.trim();

  // Pattern 1: (Int.X), (int.X), (INT.X), (Int X)
  const intMatch = trimmed.match(/^(.*?)\s*\((?:int\.|int)\s*(\d+)\)$/i);
  if (intMatch) {
    return { base: intMatch[1].trim() || 'Pieza', num: parseInt(intMatch[2], 10), format: 'int' };
  }

  // Pattern 2: (Copia X) or (copia X)
  const copiaMatch = trimmed.match(/^(.*?)\s*\((?:copia)\s*(\d+)\)$/i);
  if (copiaMatch) {
    return { base: copiaMatch[1].trim() || 'Pieza', num: parseInt(copiaMatch[2], 10), format: 'copia' };
  }

  // Pattern 3: (X)
  const parenMatch = trimmed.match(/^(.*?)\s*\((\d+)\)$/);
  if (parenMatch) {
    return { base: parenMatch[1].trim() || 'Pieza', num: parseInt(parenMatch[2], 10), format: 'paren' };
  }

  // Pattern 4: Espacio + número al final
  const spaceMatch = trimmed.match(/^(.*?)\s+(\d+)$/);
  if (spaceMatch) {
    return { base: spaceMatch[1].trim() || 'Pieza', num: parseInt(spaceMatch[2], 10), format: 'space' };
  }

  return { base: trimmed, num: null, format: 'none' };
}

/**
 * Encuentra piezas con medidas idénticas o similares a la pieza objetivo
 */
export function findSimilarPieces(targetPiece: Piece, allPieces: Piece[]): Piece[] {
  if (!targetPiece || !allPieces || allPieces.length === 0) return [];
  
  return allPieces.filter(p => {
    const sameLargo = Math.abs(p.largo - targetPiece.largo) < 1;
    const sameAncho = Math.abs(p.ancho - targetPiece.ancho) < 1;
    const sameEspesor = Math.abs(p.espesor - targetPiece.espesor) < 0.5;
    return sameLargo && sameAncho && sameEspesor;
  });
}

/**
 * Ordena un conjunto de piezas para asignarles una numeración coherente
 * Respeta la numeración previa si ya la tienen, o las ordena espacialmente:
 * - Si varían principalmente en Y (repisas en altura): de abajo a arriba
 * - Si varían principalmente en X (divisiones verticales): de izquierda a derecha
 * - Si varían en Z: de adelante a atrás
 */
export function getSortedPiecesForNumbering(pieceList: Piece[]): { piece: Piece; num: number }[] {
  if (pieceList.length === 0) return [];

  // Verificar si todas ya tienen números previos asignados (e.g. Int.1, Int.2...)
  const withParsed = pieceList.map(p => ({
    piece: p,
    parsed: parsePieceName(p.name || '')
  }));

  const allHaveNums = withParsed.every(item => item.parsed.num !== null);
  if (allHaveNums) {
    // Mantener los números que ya tenían asignados
    return withParsed.map(item => ({
      piece: item.piece,
      num: item.parsed.num as number
    }));
  }

  // Si no tienen numeración previa completa, ordenamos espacialmente
  const xs = pieceList.map(p => p.position3D[0]);
  const ys = pieceList.map(p => p.position3D[1]);
  const zs = pieceList.map(p => p.position3D[2]);

  const rangeX = Math.max(...xs) - Math.min(...xs);
  const rangeY = Math.max(...ys) - Math.min(...ys);
  const rangeZ = Math.max(...zs) - Math.min(...zs);

  const sorted = [...pieceList];
  if (rangeY >= rangeX && rangeY >= rangeZ && rangeY > 5) {
    // Repisas distribuidas en vertical (Y): abajo a arriba
    sorted.sort((a, b) => a.position3D[1] - b.position3D[1]);
  } else if (rangeX >= rangeY && rangeX >= rangeZ && rangeX > 5) {
    // Distribuidas en horizontal (X): izquierda a derecha
    sorted.sort((a, b) => a.position3D[0] - b.position3D[0]);
  } else if (rangeZ > 5) {
    // Distribuidas en profundidad (Z)
    sorted.sort((a, b) => a.position3D[2] - b.position3D[2]);
  }

  return sorted.map((p, idx) => ({
    piece: p,
    num: idx + 1
  }));
}

/**
 * Obtiene el nombre base común de una lista de piezas
 */
export function getCommonBaseName(pieces: Piece[]): string {
  if (!pieces || pieces.length === 0) return 'Pieza';
  const firstBase = parsePieceName(pieces[0].name || '').base;
  const allSame = pieces.every(p => parsePieceName(p.name || '').base.toUpperCase() === firstBase.toUpperCase());
  return allSame ? firstBase : (firstBase || 'Pieza');
}

/**
 * Genera los nuevos nombres para un lote de piezas, aplicando el nuevo nombre base
 * y añadiendo secuencialmente la numeración solicitada por el usuario (e.g. `(Int.1)`, `(Int.2)`).
 */
export function generateBatchPieceNames(
  pieceList: Piece[],
  rawNewName: string,
  numberingStyle: 'int' | 'paren' | 'none' = 'int'
): { id: string; name: string }[] {
  if (!pieceList || pieceList.length === 0) return [];

  const { base: cleanBase } = parsePieceName(rawNewName);
  const baseName = (cleanBase || 'Pieza').trim();

  // Si solo hay 1 pieza o no se requiere numeración
  if (pieceList.length === 1) {
    // Si la pieza original ya tenía (Int.X) y el usuario solo cambió la base,
    // o si el usuario introdujo un nombre simple
    const origParsed = parsePieceName(pieceList[0].name || '');
    if (numberingStyle === 'int' && origParsed.num !== null) {
      return [{ id: pieceList[0].id, name: `${baseName} (Int.${origParsed.num})` }];
    }
    return [{ id: pieceList[0].id, name: baseName }];
  }

  if (numberingStyle === 'none') {
    return pieceList.map(p => ({
      id: p.id,
      name: baseName
    }));
  }

  const sortedItems = getSortedPiecesForNumbering(pieceList);

  return sortedItems.map(({ piece, num }) => {
    let suffix = '';
    if (numberingStyle === 'int') {
      suffix = ` (Int.${num})`;
    } else if (numberingStyle === 'paren') {
      suffix = ` (${num})`;
    }
    return {
      id: piece.id,
      name: `${baseName}${suffix}`
    };
  });
}
