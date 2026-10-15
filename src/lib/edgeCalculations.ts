import { EdgeConfig, EdgeThicknessConfig } from '../types';

export const DEFAULT_EDGE_THICKNESS_CONFIG: EdgeThicknessConfig = {
  delgado: 0.45,
  grueso: 3.0, // Canto grueso predeterminado a 3 mm según requerimiento
  descontarCorte: true, // Descuenta cantos según reglas de corte de taller
  descontarDelgado: false // Si se activa fuerza descuento unitario
};

/**
 * Calcula el descuento para un par de cantos opuestos (ej. A1-A2 para el Largo, o L1-L2 para el Ancho):
 * 1. Si ambos lados tienen Canto Delgado (0.45 mm cada lado):
 *    0.45 mm + 0.45 mm = 0.90 mm ≈ 1 mm de aumento acumulado.
 *    En taller se descuenta 1 mm del corte para que la pieza terminada mida el valor nominal.
 * 2. Si un lado tiene Canto Grueso (ej. 3 mm) y el otro Canto Grueso:
 *    Se descuenta 3 + 3 = 6 mm.
 * 3. Si un lado tiene Canto Grueso (3 mm) y el otro Ninguno:
 *    Se descuenta 3 mm.
 * 4. Si un lado tiene Canto Grueso (3 mm) y el otro Canto Delgado:
 *    Se descuenta el canto grueso (3 mm).
 * 5. Si solo un lado tiene Canto Delgado y el otro Ninguno:
 *    0.45 mm se absorbe en tolerancia de sierra (0 mm), a menos que descontarDelgado esté forzado.
 */
export function calculatePairDeduction(
  canto1: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno' | undefined,
  canto2: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno' | undefined,
  config: EdgeThicknessConfig = DEFAULT_EDGE_THICKNESS_CONFIG
): { desc1: number; desc2: number; total: number } {
  if (!config.descontarCorte) {
    return { desc1: 0, desc2: 0, total: 0 };
  }

  const isGrueso1 = canto1 === 'Canto Grueso';
  const isGrueso2 = canto2 === 'Canto Grueso';
  const isDelgado1 = canto1 === 'Canto Delgado';
  const isDelgado2 = canto2 === 'Canto Delgado';

  // Caso 1: Ambos lados con Canto Grueso
  if (isGrueso1 && isGrueso2) {
    return {
      desc1: config.grueso,
      desc2: config.grueso,
      total: config.grueso * 2
    };
  }

  // Caso 2: Un lado Grueso y otro No Grueso
  if (isGrueso1 && !isGrueso2) {
    const extra = isDelgado2 && config.descontarDelgado ? config.delgado : 0;
    return {
      desc1: config.grueso,
      desc2: extra,
      total: config.grueso + extra
    };
  }
  if (!isGrueso1 && isGrueso2) {
    const extra = isDelgado1 && config.descontarDelgado ? config.delgado : 0;
    return {
      desc1: extra,
      desc2: config.grueso,
      total: config.grueso + extra
    };
  }

  // Caso 3: Canto Delgado en AMBOS extremos opuestos
  // 0.45 mm + 0.45 mm = 0.90 mm -> la pieza crece 1 mm.
  // Por lo tanto, en corte DEBE descontarse 1 mm (o Math.round(config.delgado * 2) >= 1)
  if (isDelgado1 && isDelgado2) {
    const thinDeduction = config.delgado ? Math.max(1, Math.round(config.delgado * 2)) : 1;
    const half = thinDeduction / 2;
    return {
      desc1: half,
      desc2: half,
      total: thinDeduction
    };
  }

  // Caso 4: Solo un Canto Delgado aislado
  if (isDelgado1 || isDelgado2) {
    if (config.descontarDelgado) {
      return {
        desc1: isDelgado1 ? config.delgado : 0,
        desc2: isDelgado2 ? config.delgado : 0,
        total: config.delgado
      };
    }
    return { desc1: 0, desc2: 0, total: 0 };
  }

  return { desc1: 0, desc2: 0, total: 0 };
}

/**
 * Obtiene el descuento específico de un canto individual según la configuración de espesores.
 */
export function getSingleEdgeDeduction(
  canto: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno' | undefined,
  config: EdgeThicknessConfig = DEFAULT_EDGE_THICKNESS_CONFIG
): number {
  if (!canto || canto === 'Ninguno') return 0;
  if (canto === 'Canto Grueso') {
    return config.descontarCorte ? config.grueso : 0;
  }
  if (canto === 'Canto Delgado') {
    return config.descontarDelgado ? config.delgado : 0;
  }
  return 0;
}

export interface CutDimensionResult {
  largoFinal: number;
  anchoFinal: number;
  largoCorte: number;
  anchoCorte: number;
  descuentoA1: number;
  descuentoA2: number;
  descuentoL1: number;
  descuentoL2: number;
  descuentoLargoTotal: number;
  descuentoAnchoTotal: number;
  tieneDescuento: boolean;
  motivoLargo?: string;
  motivoAncho?: string;
}

/**
 * Determina si la pieza es un divisor/separador vertical cuyo canto frontal está reubicado en A1
 * cuando la altura entre repisas es menor a la profundidad (depth > tierH).
 */
export function isA1RelocatedToFront(piece: { name?: string; id?: string; largo: number; ancho: number; cantos?: EdgeConfig }): boolean {
  if (!piece.cantos) return false;
  const isDivider = Boolean(
    piece.name?.toLowerCase().includes('separador') ||
    piece.name?.toLowerCase().includes('divisor') ||
    piece.id?.includes('separador') ||
    piece.id?.includes('divisor') ||
    piece.id?.includes('casillero')
  );
  return Boolean(
    piece.cantos.largo1 === 'Ninguno' &&
    piece.cantos.ancho1 &&
    piece.cantos.ancho1 !== 'Ninguno' &&
    (isDivider || piece.ancho > piece.largo)
  );
}

/**
 * Retorna las longitudes reales en milímetros de cada uno de los 4 cantos de la pieza.
 * - L1 y L2 tienen longitud = piece.largo
 * - A1 y A2 tienen longitud = piece.ancho
 * Permite sumar con precisión exacta el metrado total en metros lineales.
 */
export function getPieceEdgeLengths(piece: { name?: string; id?: string; largo: number; ancho: number; cantos?: EdgeConfig }) {
  const isA1Front = isA1RelocatedToFront(piece);
  // Compatibilidad defensiva: si una pieza tiene largo < ancho y el canto frontal en A1,
  // asegura que A1 corresponda a la medida corta real (tierH) para el metrado exacto:
  if (isA1Front && piece.largo < piece.ancho) {
    const shortDim = Math.min(piece.largo, piece.ancho);
    const longDim = Math.max(piece.largo, piece.ancho);
    return {
      largo1: longDim,
      largo2: longDim,
      ancho1: shortDim,
      ancho2: shortDim,
      isA1Front: true
    };
  }

  return {
    largo1: piece.largo,
    largo2: piece.largo,
    ancho1: piece.ancho,
    ancho2: piece.ancho,
    isA1Front
  };
}

/**
 * Calcula las medidas netas de corte descontando los cantos según la regla universal de carpintería:
 * - A1 y A2 son los cantos en los anchos (extremos en X), por tanto descuentan del LARGO de corte.
 *   Si ambos tienen canto delgado (0.45mm cada uno), descuenta 1 mm total en el Largo.
 * - L1 y L2 son los cantos en los largos (lados longitudinales en Z), por tanto descuentan del ANCHO de corte.
 *   Si ambos tienen canto delgado (0.45mm cada uno), descuenta 1 mm total en el Ancho.
 */
export function calculatePieceCutDimensions(
  piece: { name?: string; id?: string; largo: number; ancho: number; cantos?: EdgeConfig },
  config: EdgeThicknessConfig = DEFAULT_EDGE_THICKNESS_CONFIG
): CutDimensionResult {
  const cantos = piece.cantos;
  const largoFinal = piece.largo;
  const anchoFinal = piece.ancho;

  const isA1Front = isA1RelocatedToFront(piece);

  // Si la pieza viene con dimensiones invertidas heredadas (largo < ancho, ej. largo=208, ancho=378)
  // donde la profundidad estaba en 'ancho' y el canto frontal en A1:
  if (isA1Front && piece.largo < piece.ancho) {
    const pairFrontDepth = calculatePairDeduction(cantos?.ancho1, cantos?.ancho2, config);
    const descDepthTotal = Math.round(pairFrontDepth.total * 100) / 100;
    const anchoCorte = Math.max(1, Math.round((anchoFinal - descDepthTotal) * 10) / 10);
    return {
      largoFinal,
      anchoFinal,
      largoCorte: largoFinal,
      anchoCorte,
      descuentoA1: pairFrontDepth.desc1,
      descuentoA2: pairFrontDepth.desc2,
      descuentoL1: 0,
      descuentoL2: 0,
      descuentoLargoTotal: 0,
      descuentoAnchoTotal: descDepthTotal,
      tieneDescuento: descDepthTotal > 0
    };
  }

  // A1 y A2 están en los anchos y limitan la longitud (Largo)
  const pairLargo = calculatePairDeduction(cantos?.ancho1, cantos?.ancho2, config);
  // L1 y L2 están en los largos y limitan el Ancho
  const pairAncho = calculatePairDeduction(cantos?.largo1, cantos?.largo2, config);

  const descA1 = pairLargo.desc1;
  const descA2 = pairLargo.desc2;
  const descLargoTotal = Math.round(pairLargo.total * 100) / 100;

  const descL1 = pairAncho.desc1;
  const descL2 = pairAncho.desc2;
  const descAnchoTotal = Math.round(pairAncho.total * 100) / 100;

  const largoCorte = Math.max(1, Math.round((largoFinal - descLargoTotal) * 10) / 10);
  const anchoCorte = Math.max(1, Math.round((anchoFinal - descAnchoTotal) * 10) / 10);

  return {
    largoFinal,
    anchoFinal,
    largoCorte,
    anchoCorte,
    descuentoA1: descA1,
    descuentoA2: descA2,
    descuentoL1: descL1,
    descuentoL2: descL2,
    descuentoLargoTotal: descLargoTotal,
    descuentoAnchoTotal: descAnchoTotal,
    tieneDescuento: descLargoTotal > 0 || descAnchoTotal > 0
  };
}


