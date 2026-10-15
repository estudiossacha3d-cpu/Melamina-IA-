import { Piece, DynamicFurnitureItem, EdgeConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';

export type DivisionStyle = 'continuous_vertical' | 'continuous_horizontal' | 'staggered';
export type StaggerPattern = 'offset' | 'brick';

export type DoorLayoutType = 
  | 'none'          // Sin puertas (estante abierto)
  | 'full_2'        // 2 Puertas completas (compartida en 2)
  | 'split_4'       // 4 Puertas (compartida en 4: 2 arriba y 2 abajo)
  | 'bottom_2'      // Solo 2 puertas abajo (mueble bajo cerrado, repisas arriba abiertas)
  | 'top_2'         // Solo 2 puertas arriba (alacena cerrada, repisas abajo abiertas)
  | 'single_1';     // 1 Puerta completa (columna angosta)

export interface DynamicDoorsConfig {
  layout: DoorLayoutType;
  splitShelfIndex?: number;    // Índice de repisa divisoria (para split_4, bottom_2, top_2)
  gap?: number;                // Luz perimetral y central en mm (estándar 2mm)
  material?: string;           // Material de melamina de las puertas
  customColor?: string;        // Color personalizado de las puertas
  handleType?: 'bar_modern' | 'profile_gola' | 'knob' | 'push_open'; // Tirador
  handleColor?: string;        // Color del tirador (#111111, #e5e7eb, #d4af37)
  cantoType?: 'Canto Delgado' | 'Canto Grueso'; // Canto en los 4 bordes (estándar Canto Grueso 3mm)
  isOpen?: boolean;            // Estado de apertura en 3D
  openAngle?: number;          // Grados de apertura (0° a 105°)
}

/**
 * Calculates swung position and rotation for melamine doors swinging on their vertical edge hinges.
 */
export function calculateSwungDoorTransform(
  nominalPos: [number, number, number],
  doorW: number,
  doorT: number,
  hingeSide: 'left' | 'right',
  openAngleDeg: number
): { position3D: [number, number, number]; rotation3D: [number, number, number] } {
  const openAngleRad = (Math.max(0, Math.min(115, openAngleDeg)) * Math.PI) / 180;
  if (openAngleRad <= 0.001) {
    return {
      position3D: nominalPos,
      rotation3D: [0, Math.PI / 2, Math.PI / 2]
    };
  }

  const [nomX, nomY, nomZ] = nominalPos;
  const hingeX = hingeSide === 'left' ? nomX - doorW / 2 : nomX + doorW / 2;
  const hingeZ = nomZ - doorT / 2;
  const theta = hingeSide === 'left' ? -openAngleRad : openAngleRad;

  const relX0 = hingeSide === 'left' ? doorW / 2 : -doorW / 2;
  const relZ0 = doorT / 2;

  const relXRot = relX0 * Math.cos(theta) + relZ0 * Math.sin(theta);
  const relZRot = -relX0 * Math.sin(theta) + relZ0 * Math.cos(theta);

  const swungX = Math.round((hingeX + relXRot) * 10) / 10;
  const swungY = nomY;
  const swungZ = Math.round((hingeZ + relZRot) * 10) / 10;

  return {
    position3D: [swungX, swungY, swungZ],
    rotation3D: [0, (Math.PI / 2) + theta, Math.PI / 2]
  };
}

/**
 * Updates all door pieces in a project to the given angle (0° = closed, 95° = open).
 */
export function updateAllDoorPiecesAngle(pieces: Piece[], angleDeg: number): Piece[] {
  return pieces.map(piece => {
    if (!piece.isDoor && !piece.doorRole && !piece.name.toLowerCase().includes('puerta')) {
      return piece;
    }

    const hingeSide = piece.doorHingeSide || (piece.name.toLowerCase().includes('der') ? 'right' : 'left');
    const nominalPos = piece.nominalPosition3D || piece.position3D;
    const doorW = piece.doorW || piece.ancho;
    const doorT = piece.doorT || piece.espesor;

    const swung = calculateSwungDoorTransform(nominalPos, doorW, doorT, hingeSide, angleDeg);

    return {
      ...piece,
      nominalPosition3D: nominalPos,
      doorW,
      doorT,
      doorHingeSide: hingeSide,
      isDoor: true,
      doorOpenAngle: angleDeg,
      position3D: swung.position3D,
      rotation3D: swung.rotation3D
    };
  });
}

export interface DynamicShelfConfig {
  totalHeight: number;       // Altura total en mm (H)
  totalWidth: number;        // Ancho total en mm (W)
  totalDepth: number;        // Profundidad en mm (D)
  thickness: number;         // Espesor tablero melamina (18mm estándar)
  shelfCount: number;        // Cantidad de repisas intermedias (ej. 4)
  verticalDivisions: number; // Cantidad de divisiones intermedias en medio (0, 1, 2, 3...)
  divisionStyle: DivisionStyle; // Estilo de división para diseños especiales
  staggerPattern?: StaggerPattern; // 'offset' (Asimétrico Nórdico Zig-Zag) o 'brick' (Aparejo Trabado)
  includePlinth: boolean;    // Con zócalo inferior
  plinthHeight: number;      // Altura del zócalo (ej. 80mm)
  includeBack: boolean;      // Con fondo Trupan/MDF
  backThickness: number;     // Espesor de fondo (3mm, 4mm, 5.5mm, 6mm, etc.)
  backType?: 'ranurado' | 'sobrepuesto'; // Ranurado en piezas o sobrepuesto/clavado
  backGrooveDist?: number;   // Distancia de la ranura al borde (ej. 18mm)
  backGrooveDepth?: number;  // Profundidad de la ranura (ej. 8mm)
  material: string;          // Nombre del material (ej. 'Blanco', 'Roble Natural')
  customColor: string;       // Color hex (ej. '#ecebe6')
  customRoughness?: number;
  customMetalness?: number;
  doorsConfig?: DynamicDoorsConfig; // Puertas en melamina interactivas
}

export const DEFAULT_SHELF_CONFIG: DynamicShelfConfig = {
  totalHeight: 2100,
  totalWidth: 636,
  totalDepth: 400,
  thickness: 18,
  shelfCount: 4,
  verticalDivisions: 0,
  divisionStyle: 'continuous_vertical',
  staggerPattern: 'offset',
  includePlinth: true,
  plinthHeight: 80,
  includeBack: true,
  backThickness: 4,
  backType: 'ranurado',
  backGrooveDist: 18,
  backGrooveDepth: 8,
  material: 'Blanco',
  customColor: '#ecebe6',
  customRoughness: 0.85,
  customMetalness: 0,
  doorsConfig: {
    layout: 'none',
    gap: 2,
    handleType: 'bar_modern',
    handleColor: '#111111',
    cantoType: 'Canto Grueso',
    isOpen: false,
    openAngle: 0
  }
};

export interface ShelfCalculatedMetrics {
  interiorWidth: number;
  interiorHeight: number;
  shelfDepth: number;
  bayWidth: number;
  shelfClearHeight: number;
  totalPieces: number;
  totalAreaM2: number;
  estWeightKg: number;
}

/**
 * Generates an array of Pieces matching the exact carpentry coordinate system
 * of the user's reference modular shelf model.
 */
export function generateDynamicShelfPieces(
  config: DynamicShelfConfig,
  groupId: string = uuidv4()
): Piece[] {
  const {
    totalHeight: H,
    totalWidth: W,
    totalDepth: D,
    thickness: T,
    shelfCount,
    verticalDivisions,
    divisionStyle,
    includePlinth,
    plinthHeight: plinthH,
    includeBack,
    backThickness: backT,
    material,
    customColor,
    customRoughness = 0.85,
    customMetalness = 0
  } = config;

  const actualPlinth = includePlinth ? Math.max(40, plinthH) : 0;
  const pieces: Piece[] = [];

  const isWoodMaterial = Boolean(
    material && (
      material.toLowerCase().includes('roble') ||
      material.toLowerCase().includes('rovere') ||
      material.toLowerCase().includes('nogal') ||
      material.toLowerCase().includes('teca') ||
      material.toLowerCase().includes('cedro') ||
      material.toLowerCase().includes('bellota') ||
      material.toLowerCase().includes('caramel') ||
      material.toLowerCase().includes('macadamia') ||
      material.toLowerCase().includes('coñac') ||
      material.toLowerCase().includes('ceniza')
    )
  );

  const basePieceProps = {
    groupId,
    material,
    customColor,
    customRoughness,
    customMetalness,
    customOpacity: 1,
    veta: isWoodMaterial,
    rotacion: !isWoodMaterial,
    ranurado: false,
    abisagrado: false
  };

  /**
   * Helper para crear separadores/divisores verticales intermedios.
   * Regla de carpintería y despiece dinámico:
   * La veta de un divisor vertical corre en sentido vertical (altura tierH).
   * La medida de corte vertical (altura tierH) es el LARGO de la pieza.
   * La profundidad hacia el fondo es el ANCHO de la pieza.
   * El borde expuesto frontal mide tierH y recibe el canto en LARGO 1 (L1).
   * En 3D, la rotación [0, 0, Math.PI / 2] orienta la cara local +Z (Largo 1) directamente hacia el frente (+Z global),
   * mostrando el canto en la parte frontal expuesta.
   * En 2D, el plano de corte, la tabla de piezas y el metrado coinciden 100% en LARGO 1 (medida tierH, ej. 208 mm).
   */
  const createVerticalDividerPiece = (params: {
    id: string;
    name: string;
    tierH: number;
    depth: number;
    T: number;
    position3D: [number, number, number];
    basePieceProps: typeof basePieceProps;
  }): Piece => {
    const { id, name, tierH, depth, T, position3D, basePieceProps } = params;

    return {
      ...basePieceProps,
      id,
      name,
      largo: tierH,
      ancho: depth,
      espesor: T,
      cantidad: 1,
      cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D,
      rotation3D: [0, 0, Math.PI / 2],
      veta: basePieceProps.veta,
      vetaOrientacion: 'longitudinal',
      vetaRotation: 0,
      faceTextureConfigs: {
        top: { rotation: 0 },
        bottom: { rotation: 0 },
        front: { rotation: 0 },
        back: { rotation: 0 },
        right: { rotation: 0 },
        left: { rotation: 0 }
      }
    };
  };

  const isBackRanurado = includeBack && (config.backType ?? 'ranurado') === 'ranurado';
  const backDist = config.backGrooveDist ?? 18;
  const backProf = config.backGrooveDepth ?? 8;

  // 1. LATERAL IZQUIERDO (Parante)
  pieces.push({
    ...basePieceProps,
    id: `${groupId}-lat-izq`,
    name: 'Parante Izquierdo',
    largo: H,
    ancho: D,
    espesor: T,
    cantidad: 1,
    cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Canto Delgado', ancho2: 'Canto Delgado' },
    position3D: [-W / 2 + T / 2, H / 2, 0],
    rotation3D: [0, 0, Math.PI / 2],
    ranurado: isBackRanurado,
    // En Parante Izquierdo (rotado 90° alrededor de Z en X = -W/2), la cara inferior (-Y local) mira hacia el interior (+X del mueble)
    ranuraConfig: isBackRanurado ? { lado: 'L2', dist: backDist, esp: backT, prof: backProf, cara: 'inferior' } : undefined
  });

  // 2. LATERAL DERECHO (Parante)
  pieces.push({
    ...basePieceProps,
    id: `${groupId}-lat-der`,
    name: 'Parante Derecho',
    largo: H,
    ancho: D,
    espesor: T,
    cantidad: 1,
    cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Canto Delgado', ancho2: 'Canto Delgado' },
    position3D: [W / 2 - T / 2, H / 2, 0],
    rotation3D: [0, 0, Math.PI / 2],
    ranurado: isBackRanurado,
    // En Parante Derecho (rotado 90° en X = +W/2), la cara superior (+Y local) mira hacia el interior (-X del mueble)
    ranuraConfig: isBackRanurado ? { lado: 'L2', dist: backDist, esp: backT, prof: backProf, cara: 'superior' } : undefined
  });

  const interiorWidth = Math.max(100, W - 2 * T);

  // 3. ZÓCALOS INFERIORES (si está habilitado)
  if (includePlinth && actualPlinth > 0) {
    // Zócalo Frontal
    pieces.push({
      ...basePieceProps,
      id: `${groupId}-zocalo-front`,
      name: 'Zócalo Frontal',
      largo: interiorWidth,
      ancho: actualPlinth,
      espesor: T,
      cantidad: 1,
      cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [0, actualPlinth / 2, D / 2 - T / 2],
      rotation3D: [Math.PI / 2, 0, 0]
    });

    // Zócalo Posterior (retranqueado para salvar rodapié/zócalo de pared)
    pieces.push({
      ...basePieceProps,
      id: `${groupId}-zocalo-post`,
      name: 'Zócalo Posterior',
      largo: interiorWidth,
      ancho: actualPlinth,
      espesor: T,
      cantidad: 1,
      cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
      position3D: [0, actualPlinth / 2, -D / 2 + T / 2 + (includeBack && !isBackRanurado ? backT : 0) + 20],
      rotation3D: [Math.PI / 2, 0, 0]
    });
  }

  // 4. BASE / PISO (apoyado sobre zócalos entre los parantes)
  const baseY = actualPlinth + T / 2;
  pieces.push({
    ...basePieceProps,
    id: `${groupId}-base-piso`,
    name: 'Piso / Base',
    largo: interiorWidth,
    ancho: D,
    espesor: T,
    cantidad: 1,
    cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
    position3D: [0, baseY, 0],
    rotation3D: [0, 0, 0],
    ranurado: isBackRanurado,
    // En Base/Piso (en la parte inferior), la cara superior (+Y local) mira hacia el interior (hacia arriba)
    ranuraConfig: isBackRanurado ? { lado: 'L2', dist: backDist, esp: backT, prof: backProf, cara: 'superior' } : undefined
  });

  // 5. TECHO / CUBIERTA (entre parantes en la parte superior)
  const techoY = H - T / 2;
  pieces.push({
    ...basePieceProps,
    id: `${groupId}-techo-cubierta`,
    name: 'Techo / Cubierta',
    largo: interiorWidth,
    ancho: D,
    espesor: T,
    cantidad: 1,
    cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
    position3D: [0, techoY, 0],
    rotation3D: [0, 0, 0],
    ranurado: isBackRanurado,
    // En Techo/Cubierta (en la parte superior), la cara inferior (-Y local) mira hacia el interior (hacia abajo)
    ranuraConfig: isBackRanurado ? { lado: 'L2', dist: backDist, esp: backT, prof: backProf, cara: 'inferior' } : undefined
  });

  // 6. FONDO / TRASERA (Rigidizador)
  if (includeBack) {
    if (isBackRanurado) {
      // Fondo embutido en ranuras (suma la profundidad de ranura a cada lado)
      const interiorHNet = Math.max(100, (techoY - T / 2) - (baseY + T / 2));
      const fondoH = interiorHNet + 2 * backProf;
      const fondoW = interiorWidth + 2 * backProf;
      pieces.push({
        ...basePieceProps,
        id: `${groupId}-fondo-trupan`,
        name: `Fondo MDF ${backT}mm (Ranurado)`,
        material: 'MDF Blanco',
        largo: fondoH,
        ancho: fondoW,
        espesor: backT,
        cantidad: 1,
        cantos: { largo1: 'Ninguno', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
        position3D: [0, baseY + T / 2 + interiorHNet / 2, -D / 2 + backDist + backT / 2],
        rotation3D: [0, Math.PI / 2, Math.PI / 2],
        customColor: '#d6d3d1' // Tono trupan / MDF claro
      });
    } else {
      // Fondo sobrepuesto / clavado por detrás
      const fondoH = Math.max(100, H - actualPlinth);
      const fondoW = W;
      pieces.push({
        ...basePieceProps,
        id: `${groupId}-fondo-trupan`,
        name: `Fondo MDF ${backT}mm (Sobrepuesto)`,
        material: 'MDF Blanco',
        largo: fondoH,
        ancho: fondoW,
        espesor: backT,
        cantidad: 1,
        cantos: { largo1: 'Ninguno', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
        position3D: [0, actualPlinth + fondoH / 2, -D / 2 - backT / 2],
        rotation3D: [0, Math.PI / 2, Math.PI / 2],
        customColor: '#d6d3d1'
      });
    }
  }

  // 7. REPISAS Y DIVISIONES EN MEDIO (DISEÑOS ESPECIALES)
  // Cara superior de la base donde apoyan los elementos interiores
  const yBaseTop = baseY + T / 2;
  // Cara inferior del techo donde rematan los elementos interiores
  const yTechoBottom = techoY - T / 2;
  // Luz libre vertical total interior entre piso y techo
  const interiorH = Math.max(50, yTechoBottom - yBaseTop);

  const numDivs = Math.max(0, verticalDivisions);
  const numBays = numDivs + 1;
  const bayWidth = Math.max(40, (interiorWidth - numDivs * T) / numBays);

  // CÁLCULO PRECISO DE NIVELES Y ESPACIOS ENTRE REPISAS:
  // shelfCount repisas intermedias definen exactamente (shelfCount + 1) niveles/huecos.
  // El espesor de cada repisa (T mm) ocupa espacio físico real.
  const numTiers = shelfCount + 1;
  const netAvailableH = Math.max(0, interiorH - shelfCount * T);

  // Repartición en milímetros enteros exactos de la luz libre disponible
  const baseTierH = Math.floor(netAvailableH / numTiers);
  const remainderH = netAvailableH % numTiers;

  const tierHeights: number[] = [];
  for (let lvl = 0; lvl < numTiers; lvl++) {
    tierHeights.push(baseTierH + (lvl < remainderH ? 1 : 0));
  }

  // Precalcular cara inferior (floor), cara superior (ceiling) y centro 3D de cada nivel y repisa
  const tierFloors: number[] = [];
  const tierCeilings: number[] = [];
  const tierCentersY: number[] = [];
  const shelfCentersY: number[] = [];

  let currentY = yBaseTop;
  for (let lvl = 0; lvl < numTiers; lvl++) {
    const tH = tierHeights[lvl];
    tierFloors.push(currentY);
    tierCeilings.push(currentY + tH);
    tierCentersY.push(currentY + tH / 2);

    if (lvl < shelfCount) {
      // Centro 3D de la repisa intermedia apoyada en este nivel
      const sCenter = currentY + tH + T / 2;
      shelfCentersY.push(sCenter);
      // Avanzar al piso del siguiente nivel (sumando espesor de repisa T)
      currentY = currentY + tH + T;
    }
  }

  // CÁLCULO DE PROFUNDIDAD Y POSICIÓN Z DE REPISAS Y ELEMENTOS INTERIORES:
  // Regla carpintera real:
  // - Respaldo Ranurado (embutido en piezas): El fondo MDF se inserta en ranuras a 'backDist' (ej. 18mm)
  //   del borde trasero, con espesor 'backT' (ej. 4mm). Por lo tanto, las repisas y divisores interiores
  //   son MÁS CORTOS en profundidad: interiorDepth = D - (backDist + backT) (ej. 400 - 22 = 378mm).
  //   Su centro en Z se desplaza a +(backDist + backT) / 2 (ej. +11mm) para quedar perfectamente
  //   enrasados al frente (+D/2) y topar de forma exacta contra la cara frontal del fondo MDF sin chocar.
  // - Respaldo Clavado / Sobrepuesto: El fondo se clava por detrás exteriormente.
  //   Toda la profundidad D (ej. 400mm) está libre en el interior: interiorDepth = D, centro Z = 0.
  const interiorDepth = isBackRanurado ? Math.max(50, D - (backDist + backT)) : D;
  const interiorPosZ = isBackRanurado ? (backDist + backT) / 2 : 0;

  if (numDivs === 0) {
    // SIN DIVISIONES VERTICALES (Librero / Estante estándar de 1 sola columna)
    for (let i = 0; i < shelfCount; i++) {
      const shelfY = shelfCentersY[i];
      pieces.push({
        ...basePieceProps,
        id: `${groupId}-repisa-int-${i + 1}`,
        name: `Repisa (Nivel ${i + 1})`,
        largo: interiorWidth,
        ancho: interiorDepth,
        espesor: T,
        cantidad: 1,
        cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
        position3D: [0, shelfY, interiorPosZ],
        rotation3D: [0, 0, 0]
      });
    }
  } else if (divisionStyle === 'continuous_vertical') {
    // ESTILO 1: MONTANTES VERTICALES CONTINUOS (Divisores de piso a techo)
    // Crea columnas robustas e independientes
    for (let d = 0; d < numDivs; d++) {
      const divX = -interiorWidth / 2 + (d + 1) * bayWidth + d * T + T / 2;
      const divY = yBaseTop + interiorH / 2;
      pieces.push({
        ...basePieceProps,
        id: `${groupId}-divisor-vert-${d + 1}`,
        name: `Montante Divisor Vertical ${d + 1}`,
        largo: interiorH,
        ancho: interiorDepth,
        espesor: T,
        cantidad: 1,
        cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
        position3D: [divX, divY, interiorPosZ],
        rotation3D: [0, 0, Math.PI / 2]
      });
    }

    // Repisas individuales en cada columna / bay alineadas a las alturas calculadas
    for (let b = 0; b < numBays; b++) {
      const bayCenterX = -interiorWidth / 2 + b * (bayWidth + T) + bayWidth / 2;
      for (let i = 0; i < shelfCount; i++) {
        const shelfY = shelfCentersY[i];
        pieces.push({
          ...basePieceProps,
          id: `${groupId}-repisa-col${b + 1}-nv${i + 1}`,
          name: `Repisa C${b + 1} (Nivel ${i + 1})`,
          largo: Math.round(bayWidth),
          ancho: interiorDepth,
          espesor: T,
          cantidad: 1,
          cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
          position3D: [bayCenterX, shelfY, interiorPosZ],
          rotation3D: [0, 0, 0]
        });
      }
    }
  } else if (divisionStyle === 'continuous_horizontal') {
    // ESTILO 2: REPISAS CONTINUAS DE EXTREMO A EXTREMO
    // Repisas horizontales completas
    for (let i = 0; i < shelfCount; i++) {
      const shelfY = shelfCentersY[i];
      pieces.push({
        ...basePieceProps,
        id: `${groupId}-repisa-continua-${i + 1}`,
        name: `Repisa Continua (Nivel ${i + 1})`,
        largo: interiorWidth,
        ancho: interiorDepth,
        espesor: T,
        cantidad: 1,
        cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
        position3D: [0, shelfY, interiorPosZ],
        rotation3D: [0, 0, 0]
      });
    }

    // Separadores verticales adaptados milimétricamente al espacio libre de cada nivel
    for (let level = 0; level <= shelfCount; level++) {
      const tierH = tierHeights[level];
      const tierCenterY = tierCentersY[level];
      for (let d = 0; d < numDivs; d++) {
        const divX = -interiorWidth / 2 + (d + 1) * bayWidth + d * T + T / 2;
        pieces.push(createVerticalDividerPiece({
          id: `${groupId}-separador-nv${level + 1}-d${d + 1}`,
          name: `Separador Intermedio N${level + 1}-${d + 1}`,
          tierH,
          depth: interiorDepth,
          T,
          position3D: [divX, tierCenterY, interiorPosZ],
          basePieceProps
        }));
      }
    }
  } else if (divisionStyle === 'staggered') {
    // ESTILO 3: CASILLEROS ASIMÉTRICOS / ALTERNADOS (Diseño moderno tipo cubos nórdicos)
    // Repisas completas horizontales de extremo a extremo
    for (let i = 0; i < shelfCount; i++) {
      const shelfY = shelfCentersY[i];
      pieces.push({
        ...basePieceProps,
        id: `${groupId}-repisa-asym-${i + 1}`,
        name: `Repisa Horizontal (Nivel ${i + 1})`,
        largo: interiorWidth,
        ancho: interiorDepth,
        espesor: T,
        cantidad: 1,
        cantos: { largo1: 'Canto Delgado', largo2: 'Ninguno', ancho1: 'Ninguno', ancho2: 'Ninguno' },
        position3D: [0, shelfY, interiorPosZ],
        rotation3D: [0, 0, 0]
      });
    }

    const pattern = config.staggerPattern || 'offset';

    for (let level = 0; level <= shelfCount; level++) {
      const tierH = tierHeights[level];
      const tierCenterY = tierCentersY[level];
      const isEven = level % 2 === 0;

      if (pattern === 'brick') {
        // MODO APAREJO TRABADO (TIPO LADRILLO INTERCALADO)
        const tierDivCount = numDivs === 1 ? (isEven ? 1 : 2) : (isEven ? numDivs : Math.max(1, numDivs - 1));
        const tierBayW = Math.max(30, (interiorWidth - tierDivCount * T) / (tierDivCount + 1));

        for (let d = 0; d < tierDivCount; d++) {
          const divX = -interiorWidth / 2 + (d + 1) * tierBayW + d * T + T / 2;
          pieces.push(createVerticalDividerPiece({
            id: `${groupId}-casillero-nv${level + 1}-d${d + 1}`,
            name: `Divisor Trabado N${level + 1}-${d + 1} (${isEven ? 'Par' : 'Impar'})`,
            tierH,
            depth: interiorDepth,
            T,
            position3D: [divX, tierCenterY, interiorPosZ],
            basePieceProps
          }));
        }
      } else {
        // MODO ZIG-ZAG ASIMÉTRICO NÓRDICO (POR DEFECTO)
        if (numDivs === 1) {
          // Con 1 división: alterna entre lado izquierdo y lado derecho de forma evidente
          const shiftAmount = Math.max(40, Math.min(bayWidth * 0.35, (interiorWidth - T) * 0.18));
          const divX = isEven ? -shiftAmount : shiftAmount;
          pieces.push(createVerticalDividerPiece({
            id: `${groupId}-casillero-nv${level + 1}-d1`,
            name: `Divisor Casillero N${level + 1} (${isEven ? 'Lado Izq' : 'Lado Der'})`,
            tierH,
            depth: interiorDepth,
            T,
            position3D: [divX, tierCenterY, interiorPosZ],
            basePieceProps
          }));
        } else {
          // Con 2 o más divisiones: desfasar rítmicamente cada divisor a la izquierda o derecha
          const shift = Math.max(35, Math.min(bayWidth * 0.28, bayWidth - 75));
          for (let d = 0; d < numDivs; d++) {
            const nominalX = -interiorWidth / 2 + (d + 1) * bayWidth + d * T + T / 2;
            const divX = isEven ? (nominalX - shift) : (nominalX + shift);
            pieces.push(createVerticalDividerPiece({
              id: `${groupId}-casillero-nv${level + 1}-d${d + 1}`,
              name: `Divisor Casillero N${level + 1}-${d + 1} (${isEven ? 'Izq' : 'Der'})`,
              tierH,
              depth: interiorDepth,
              T,
              position3D: [divX, tierCenterY, interiorPosZ],
              basePieceProps
            }));
          }
        }
      }
    }
  }

  // =========================================================================
  // 8. PUERTAS EN MELAMINA (SUPER INTERACTIVO)
  // Soporta: Sin puertas, 2 Puertas completas (compartida en 2),
  // 4 Puertas (compartida en 4: 2 arriba y 2 abajo),
  // Solo 2 puertas abajo (mueble bajo cerrado), Solo 2 puertas arriba (alacena cerrada),
  // o 1 Puerta completa.
  // =========================================================================
  const doorsConfig = config.doorsConfig;
  const doorLayout = doorsConfig?.layout || 'none';

  if (doorLayout !== 'none') {
    const doorGap = doorsConfig?.gap ?? 2;
    const doorMat = doorsConfig?.material || config.material;
    const doorColor = doorsConfig?.customColor || config.customColor;
    const doorCanto = doorsConfig?.cantoType || 'Canto Grueso';
    const isWoodDoor = Boolean(
      doorMat && (
        doorMat.toLowerCase().includes('roble') ||
        doorMat.toLowerCase().includes('rovere') ||
        doorMat.toLowerCase().includes('nogal') ||
        doorMat.toLowerCase().includes('teca') ||
        doorMat.toLowerCase().includes('cedro') ||
        doorMat.toLowerCase().includes('bellota') ||
        doorMat.toLowerCase().includes('caramel') ||
        doorMat.toLowerCase().includes('macadamia') ||
        doorMat.toLowerCase().includes('coñac') ||
        doorMat.toLowerCase().includes('ceniza')
      )
    );

    const doorBaseProps = {
      groupId,
      material: doorMat,
      customColor: doorColor,
      customRoughness: config.customRoughness ?? 0.45,
      customMetalness: config.customMetalness ?? 0.05,
      customOpacity: 1,
      veta: isWoodDoor,
      vetaOrientacion: 'longitudinal' as const,
      vetaRotation: 0,
      rotacion: !isWoodDoor,
      ranurado: false,
      abisagrado: true,
      isDoor: true
    };

    // Plano frontal exterior donde asientan las puertas sobrepuestas (overlay)
    const doorFrontZ = D / 2 + T / 2;

    // Ángulo de apertura interactiva en 3D (0° a 115°)
    const currentOpenAngleDeg = doorsConfig?.openAngle !== undefined
      ? doorsConfig.openAngle
      : (doorsConfig?.isOpen ? 95 : 0);
    const openAngleRad = (Math.max(0, Math.min(115, currentOpenAngleDeg)) * Math.PI) / 180;

    // Helper para calcular la posición y rotación 3D de puertas batientes
    const calcSwungDoorTransform = (
      nominalPos: [number, number, number],
      doorW: number,
      hingeSide: 'left' | 'right'
    ) => calculateSwungDoorTransform(nominalPos, doorW, T, hingeSide, currentOpenAngleDeg);

    // Medidas de ancho según carpintería sobrepuesta (overlay):
    // Dos puertas: (Ancho exterior - 2 luces exteriores - 1 luz central) / 2 = (W - 3*gap) / 2
    const twoDoorsW = Math.max(80, Math.round(((W - 3 * doorGap) / 2) * 10) / 10);
    const leftDoorNominalX = -doorGap / 2 - twoDoorsW / 2;
    const rightDoorNominalX = doorGap / 2 + twoDoorsW / 2;

    // Una puerta completa:
    const singleDoorW = Math.max(100, Math.round((W - 2 * doorGap) * 10) / 10);

    // Altura y nivel de corte divisorio (split shelf)
    const availableShelves = shelfCount;
    const defaultSplitIdx = availableShelves > 0 ? Math.floor(availableShelves / 2) : 0;
    const splitShelfIdx = doorsConfig?.splitShelfIndex !== undefined
      ? Math.max(0, Math.min(availableShelves - 1, doorsConfig.splitShelfIndex))
      : defaultSplitIdx;

    let splitY: number;
    if (availableShelves > 0 && shelfCentersY[splitShelfIdx] !== undefined) {
      splitY = shelfCentersY[splitShelfIdx];
    } else {
      splitY = actualPlinth + (H - actualPlinth) * 0.42;
    }

    const lowerDoorH = Math.max(80, Math.round((splitY - actualPlinth - 1.5 * doorGap) * 10) / 10);
    const lowerDoorNominalY = actualPlinth + doorGap + lowerDoorH / 2;

    const upperDoorH = Math.max(80, Math.round((H - splitY - 1.5 * doorGap) * 10) / 10);
    const upperDoorNominalY = splitY + doorGap + upperDoorH / 2;

    const fullDoorH = Math.max(100, Math.round(((H - actualPlinth) - 2 * doorGap) * 10) / 10);
    const fullDoorNominalY = actualPlinth + doorGap + fullDoorH / 2;

    // Canto perimetral en las 4 caras de la puerta (estándar carpintería de frentes)
    const doorCantos: EdgeConfig = {
      largo1: doorCanto,
      largo2: doorCanto,
      ancho1: doorCanto,
      ancho2: doorCanto
    };

    if (doorLayout === 'full_2') {
      // 2 PUERTAS COMPLETAS (Compartida en 2)
      const nomPosLeft: [number, number, number] = [leftDoorNominalX, fullDoorNominalY, doorFrontZ];
      const nomPosRight: [number, number, number] = [rightDoorNominalX, fullDoorNominalY, doorFrontZ];
      const bLeft = calcSwungDoorTransform(nomPosLeft, twoDoorsW, 'left');
      const bRight = calcSwungDoorTransform(nomPosRight, twoDoorsW, 'right');

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-full-izq`,
        name: 'Puerta Izquierda (Completa)',
        largo: fullDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: bLeft.position3D,
        rotation3D: bLeft.rotation3D,
        nominalPosition3D: nomPosLeft,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'left',
        doorRole: 'full_left'
      });

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-full-der`,
        name: 'Puerta Derecha (Completa)',
        largo: fullDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: bRight.position3D,
        rotation3D: bRight.rotation3D,
        nominalPosition3D: nomPosRight,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'right',
        doorRole: 'full_right'
      });
    } else if (doorLayout === 'split_4') {
      // 4 PUERTAS (Compartida en 4: 2 arriba y 2 abajo)
      const nomPosBLeft: [number, number, number] = [leftDoorNominalX, lowerDoorNominalY, doorFrontZ];
      const nomPosBRight: [number, number, number] = [rightDoorNominalX, lowerDoorNominalY, doorFrontZ];
      const nomPosTLeft: [number, number, number] = [leftDoorNominalX, upperDoorNominalY, doorFrontZ];
      const nomPosTRight: [number, number, number] = [rightDoorNominalX, upperDoorNominalY, doorFrontZ];

      const bLeft = calcSwungDoorTransform(nomPosBLeft, twoDoorsW, 'left');
      const bRight = calcSwungDoorTransform(nomPosBRight, twoDoorsW, 'right');
      const tLeft = calcSwungDoorTransform(nomPosTLeft, twoDoorsW, 'left');
      const tRight = calcSwungDoorTransform(nomPosTRight, twoDoorsW, 'right');

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-inf-izq`,
        name: 'Puerta Inferior Izquierda',
        largo: lowerDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: bLeft.position3D,
        rotation3D: bLeft.rotation3D,
        nominalPosition3D: nomPosBLeft,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'left',
        doorRole: 'bottom_left'
      });

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-inf-der`,
        name: 'Puerta Inferior Derecha',
        largo: lowerDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: bRight.position3D,
        rotation3D: bRight.rotation3D,
        nominalPosition3D: nomPosBRight,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'right',
        doorRole: 'bottom_right'
      });

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-sup-izq`,
        name: 'Puerta Superior Izquierda',
        largo: upperDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: tLeft.position3D,
        rotation3D: tLeft.rotation3D,
        nominalPosition3D: nomPosTLeft,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'left',
        doorRole: 'top_left'
      });

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-sup-der`,
        name: 'Puerta Superior Derecha',
        largo: upperDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: tRight.position3D,
        rotation3D: tRight.rotation3D,
        nominalPosition3D: nomPosTRight,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'right',
        doorRole: 'top_right'
      });
    } else if (doorLayout === 'bottom_2') {
      // SOLO 2 PUERTAS ABAJO (Mueble bajo cerrado, repisas arriba abiertas)
      const nomPosBLeft: [number, number, number] = [leftDoorNominalX, lowerDoorNominalY, doorFrontZ];
      const nomPosBRight: [number, number, number] = [rightDoorNominalX, lowerDoorNominalY, doorFrontZ];
      const bLeft = calcSwungDoorTransform(nomPosBLeft, twoDoorsW, 'left');
      const bRight = calcSwungDoorTransform(nomPosBRight, twoDoorsW, 'right');

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-inf-izq`,
        name: 'Puerta Inferior Izquierda',
        largo: lowerDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: bLeft.position3D,
        rotation3D: bLeft.rotation3D,
        nominalPosition3D: nomPosBLeft,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'left',
        doorRole: 'bottom_left'
      });

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-inf-der`,
        name: 'Puerta Inferior Derecha',
        largo: lowerDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: bRight.position3D,
        rotation3D: bRight.rotation3D,
        nominalPosition3D: nomPosBRight,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'right',
        doorRole: 'bottom_right'
      });
    } else if (doorLayout === 'top_2') {
      // SOLO 2 PUERTAS ARRIBA (Alacena superior cerrada, estante abajo abierto)
      const nomPosTLeft: [number, number, number] = [leftDoorNominalX, upperDoorNominalY, doorFrontZ];
      const nomPosTRight: [number, number, number] = [rightDoorNominalX, upperDoorNominalY, doorFrontZ];
      const tLeft = calcSwungDoorTransform(nomPosTLeft, twoDoorsW, 'left');
      const tRight = calcSwungDoorTransform(nomPosTRight, twoDoorsW, 'right');

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-sup-izq`,
        name: 'Puerta Superior Izquierda',
        largo: upperDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: tLeft.position3D,
        rotation3D: tLeft.rotation3D,
        nominalPosition3D: nomPosTLeft,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'left',
        doorRole: 'top_left'
      });

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-sup-der`,
        name: 'Puerta Superior Derecha',
        largo: upperDoorH,
        ancho: twoDoorsW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: tRight.position3D,
        rotation3D: tRight.rotation3D,
        nominalPosition3D: nomPosTRight,
        doorW: twoDoorsW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'right',
        doorRole: 'top_right'
      });
    } else if (doorLayout === 'single_1') {
      // 1 PUERTA COMPLETA (Columna angosta)
      const nomPosSingle: [number, number, number] = [0, fullDoorNominalY, doorFrontZ];
      const singleTransform = calcSwungDoorTransform(nomPosSingle, singleDoorW, 'left');

      pieces.push({
        ...doorBaseProps,
        id: `${groupId}-puerta-single`,
        name: 'Puerta Frontal (Completa)',
        largo: fullDoorH,
        ancho: singleDoorW,
        espesor: T,
        cantidad: 1,
        cantos: doorCantos,
        position3D: singleTransform.position3D,
        rotation3D: singleTransform.rotation3D,
        nominalPosition3D: nomPosSingle,
        doorW: singleDoorW,
        doorT: T,
        doorOpenAngle: currentOpenAngleDeg,
        doorHingeSide: 'left',
        doorRole: 'single'
      });
    }
  }

  return pieces;
}

/**
 * Calculates carpentry metrics: total board area in m², volume in m³, and estimated weight in kg.
 */
export function calculateShelfMetrics(config: DynamicShelfConfig, pieces: Piece[]): ShelfCalculatedMetrics {
  const { totalHeight: H, totalWidth: W, thickness: T, shelfCount, verticalDivisions, plinthHeight, includePlinth } = config;
  const actualPlinth = includePlinth ? Math.max(40, plinthHeight) : 0;
  
  const interiorWidth = Math.max(100, W - 2 * T);
  const interiorHeight = Math.max(100, H - actualPlinth - 2 * T);
  const numDivs = Math.max(0, verticalDivisions);
  const bayWidth = Math.round((interiorWidth - numDivs * T) / (numDivs + 1));
  const netAvailableHeight = Math.max(0, interiorHeight - shelfCount * T);
  const shelfClearHeight = Math.round(netAvailableHeight / (shelfCount + 1));

  let totalAreaMm2 = 0;
  pieces.forEach(p => {
    const qty = p.cantidad || 1;
    const dims = [p.largo || 0, p.ancho || 0, p.espesor || 0].sort((a, b) => b - a);
    totalAreaMm2 += (dims[0] * dims[1]) * qty;
  });

  const totalAreaM2 = Math.round((totalAreaMm2 / 1_000_000) * 100) / 100;
  const estWeightKg = Math.round(totalAreaM2 * 13.5 * 10) / 10;

  const isBackRanurado = config.includeBack && (config.backType ?? 'ranurado') === 'ranurado';
  const backDist = config.backGrooveDist ?? 18;
  const backT = config.backThickness ?? 4;
  const shelfDepth = isBackRanurado ? Math.max(50, config.totalDepth - (backDist + backT)) : config.totalDepth;

  return {
    interiorWidth,
    interiorHeight,
    shelfDepth,
    bayWidth,
    shelfClearHeight,
    totalPieces: pieces.length,
    totalAreaM2,
    estWeightKg
  };
}

export const PRESET_SHELF_RANURADO: DynamicShelfConfig = {
  totalHeight: 2100,
  totalWidth: 636,
  totalDepth: 400,
  thickness: 18,
  shelfCount: 4,
  verticalDivisions: 0,
  divisionStyle: 'continuous_vertical',
  staggerPattern: 'offset',
  includePlinth: true,
  plinthHeight: 80,
  includeBack: true,
  backThickness: 4,
  backType: 'ranurado',
  backGrooveDist: 18,
  backGrooveDepth: 8,
  material: 'Blanco',
  customColor: '#ecebe6',
  customRoughness: 0.85,
  customMetalness: 0
};

export const PRESET_SHELF_SOBREPUESTO: DynamicShelfConfig = {
  totalHeight: 2100,
  totalWidth: 636,
  totalDepth: 400,
  thickness: 18,
  shelfCount: 4,
  verticalDivisions: 0,
  divisionStyle: 'continuous_vertical',
  staggerPattern: 'offset',
  includePlinth: true,
  plinthHeight: 80,
  includeBack: true,
  backThickness: 4,
  backType: 'sobrepuesto',
  backGrooveDist: 18,
  backGrooveDepth: 8,
  material: 'Blanco',
  customColor: '#ecebe6',
  customRoughness: 0.85,
  customMetalness: 0
};

/**
 * Converts a generated shelf into a DynamicFurnitureItem suitable for the Almacén.
 */
export function createDynamicShelfItem(
  config: DynamicShelfConfig,
  customName?: string,
  customId?: string
): DynamicFurnitureItem {
  const pieces = generateDynamicShelfPieces(config);
  const now = new Date().toISOString();
  const id = customId || `furn-shelf-${Date.now().toString(36)}`;
  const name = customName || `Estante Dinámico ${config.totalWidth}×${config.totalHeight}×${config.totalDepth}mm`;

  return {
    id,
    name,
    category: 'Estantes',
    description: `Estante modular paramétrico (${config.shelfCount} repisas, ${config.verticalDivisions} divisiones verticales, zócalo ${config.includePlinth ? config.plinthHeight + 'mm' : 'sin zócalo'}). Fondo MDF ${config.backThickness}mm ${config.backType === 'sobrepuesto' ? 'sobrepuesto / clavado' : 'ranurado en piezas'}.`,
    dimensions: {
      width: config.totalWidth,
      height: config.totalHeight,
      depth: config.totalDepth
    },
    thickness: config.thickness,
    tags: [
      'componente dinámico',
      'paramétrico',
      'estante',
      'modular',
      `repisas-${config.shelfCount}`,
      config.verticalDivisions > 0 ? `div-${config.verticalDivisions}` : 'columna-unica',
      config.backType === 'ranurado' ? 'mdf-ranurado' : 'mdf-sobrepuesto'
    ],
    pieces,
    dynamicShelfConfig: { ...config },
    dynamicParameters: [
      {
        id: 'totalHeight',
        name: 'Altura Total',
        label: 'Altura (H mm)',
        type: 'dimension',
        defaultValue: config.totalHeight,
        unit: 'mm',
        description: 'Altura exterior total del mueble'
      },
      {
        id: 'totalWidth',
        name: 'Ancho Total',
        label: 'Ancho (W mm)',
        type: 'dimension',
        defaultValue: config.totalWidth,
        unit: 'mm',
        description: 'Ancho frontal exterior total'
      },
      {
        id: 'totalDepth',
        name: 'Profundidad',
        label: 'Profundidad (D mm)',
        type: 'dimension',
        defaultValue: config.totalDepth,
        unit: 'mm',
        description: 'Profundidad de repisas y parantes'
      },
      {
        id: 'shelfCount',
        name: 'Repisas Intermedias',
        label: 'Número de Repisas',
        type: 'number',
        defaultValue: config.shelfCount,
        description: 'Cantidad de baldas o repisas intermedias'
      },
      {
        id: 'verticalDivisions',
        name: 'Divisiones Verticales',
        label: 'Divisiones en medio',
        type: 'number',
        defaultValue: config.verticalDivisions,
        description: 'Montantes divisorios para diseños de múltiples columnas'
      },
      {
        id: 'divisionStyle',
        name: 'Estilo de División',
        label: 'Tipo de Estructura',
        type: 'select',
        defaultValue: config.divisionStyle,
        options: ['continuous_vertical', 'continuous_horizontal', 'staggered'],
        description: 'Diseño estructural de las divisiones'
      },
      {
        id: 'staggerPattern',
        name: 'Patrón de Alternancia',
        label: 'Tipo de Alternancia',
        type: 'select',
        defaultValue: config.staggerPattern || 'offset',
        options: ['offset', 'brick'],
        description: 'Patrón de casilleros alternos (offset: zig-zag nórdico, brick: aparejo trabado)'
      }
    ],
    status: 'has_3d',
    createdAt: now,
    updatedAt: now,
    notes: 'Generado desde el componente dinámico de estantes.'
  };
}
