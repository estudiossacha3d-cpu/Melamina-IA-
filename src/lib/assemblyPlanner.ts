import { Piece } from '../types';

export interface AssemblyStep {
  stepNumber: number;
  id: string;
  title: string;
  category: 'base' | 'sides' | 'shelves' | 'back' | 'doors_drawers' | 'details';
  description: string;
  pieceIds: string[];
  tips: string[];
  hardwareNeeded: {
    name: string;
    count: number;
    spec: string;
    icon?: string;
  }[];
  toolsNeeded: string[];
  dimensionNotes: {
    label: string;
    valueMm: number;
    axis: 'X' | 'Y' | 'Z';
  }[];
}

export interface AssemblyProjectAnalysis {
  steps: AssemblyStep[];
  allHardware: {
    id: string;
    name: string;
    count: number;
    spec: string;
    category: 'tornilleria' | 'herrajes' | 'fijacion' | 'accesorios';
    purpose: string;
  }[];
  allTools: {
    id: string;
    name: string;
    icon: string;
    description: string;
    required: boolean;
  }[];
  overallDimensions: {
    width: number;
    height: number;
    depth: number;
  };
  totalPiecesCount: number;
  estimatedAssemblyMinutes: number;
}

/**
 * Categorizes a piece by analyzing its geometric aspect ratio and orientation
 */
function inferPieceRole(piece: Piece, minY: number, maxY: number): 'base' | 'top' | 'side' | 'shelf' | 'back' | 'door_drawer' | 'misc' {
  const nameLower = (piece.name || '').toLowerCase();
  
  if (nameLower.includes('fondo') || nameLower.includes('respaldo') || nameLower.includes('trasera')) {
    return 'back';
  }
  if (nameLower.includes('puerta') || nameLower.includes('cajon') || nameLower.includes('frente')) {
    return 'door_drawer';
  }
  if (nameLower.includes('zócalo') || nameLower.includes('zocalo') || nameLower.includes('pata') || nameLower.includes('base')) {
    return 'base';
  }
  if (nameLower.includes('lateral') || nameLower.includes('costado')) {
    return 'side';
  }
  if (nameLower.includes('repisa') || nameLower.includes('estante') || nameLower.includes('division') || nameLower.includes('amarre')) {
    return 'shelf';
  }
  if (nameLower.includes('techo') || nameLower.includes('tapa')) {
    return 'top';
  }

  // Geometric heuristic if name doesn't give clear cue
  const pos = piece.position3D || [0, 0, 0];
  const rot = piece.rotation3D || [0, 0, 0];
  
  // Back panel typically thin espesor (e.g. 3-6mm) or large thin area
  if (piece.espesor <= 6) {
    return 'back';
  }

  // Vertical orientation vs horizontal
  const isVertical = Math.abs(rot[0]) > 0.5 || Math.abs(rot[2]) > 0.5;
  if (!isVertical) {
    if (pos[1] <= minY + 80) return 'base';
    if (pos[1] >= maxY - 80) return 'top';
    return 'shelf';
  } else {
    return 'side';
  }
}

/**
 * Computes bounding box for an array of pieces
 */
export function computeAssemblyBounds(pieces: Piece[]) {
  if (pieces.length === 0) {
    return {
      minX: 0, maxX: 600,
      minY: 0, maxY: 800,
      minZ: 0, maxZ: 400,
      width: 600, height: 800, depth: 400,
      centerX: 0, centerY: 0, centerZ: 0
    };
  }

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  pieces.forEach(p => {
    const pos = p.position3D || [0, 0, 0];
    const halfL = (p.largo || 100) / 2;
    const halfH = (p.espesor || 18) / 2;
    const halfW = (p.ancho || 100) / 2;

    minX = Math.min(minX, pos[0] - halfL);
    maxX = Math.max(maxX, pos[0] + halfL);
    minY = Math.min(minY, pos[1] - halfH);
    maxY = Math.max(maxY, pos[1] + halfH);
    minZ = Math.min(minZ, pos[2] - halfW);
    maxZ = Math.max(maxZ, pos[2] + halfW);
  });

  const width = Math.round(maxX - minX);
  const height = Math.round(maxY - minY);
  const depth = Math.round(maxZ - minZ);

  return {
    minX, maxX,
    minY, maxY,
    minZ, maxZ,
    width: Math.max(10, width),
    height: Math.max(10, height),
    depth: Math.max(10, depth),
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    centerZ: (minZ + maxZ) / 2
  };
}

/**
 * Analyzes pieces and generates sequenced assembly steps, required tools, and hardware
 */
export function generateAssemblyPlan(pieces: Piece[]): AssemblyProjectAnalysis {
  if (!pieces || pieces.length === 0) {
    return {
      steps: [],
      allHardware: [],
      allTools: [],
      overallDimensions: { width: 0, height: 0, depth: 0 },
      totalPiecesCount: 0,
      estimatedAssemblyMinutes: 0
    };
  }

  const bounds = computeAssemblyBounds(pieces);
  
  // Categorize pieces
  const basePieces: Piece[] = [];
  const sidePieces: Piece[] = [];
  const shelfPieces: Piece[] = [];
  const backPieces: Piece[] = [];
  const doorPieces: Piece[] = [];
  const otherPieces: Piece[] = [];

  pieces.forEach(p => {
    const role = inferPieceRole(p, bounds.minY, bounds.maxY);
    switch (role) {
      case 'base':
        basePieces.push(p);
        break;
      case 'side':
      case 'top':
        sidePieces.push(p);
        break;
      case 'shelf':
        shelfPieces.push(p);
        break;
      case 'back':
        backPieces.push(p);
        break;
      case 'door_drawer':
        doorPieces.push(p);
        break;
      default:
        otherPieces.push(p);
        break;
    }
  });

  // Calculate estimated hardware
  const standardScrewsPerPiece = 4; // standard 4x50mm drywall/wood screws for joints
  const estimatedScrews = Math.max(8, pieces.length * standardScrewsPerPiece);
  const estimatedMinifix = Math.round(pieces.length * 2);
  const estimatedShelfPins = shelfPieces.length * 4;
  const estimatedDowels = Math.round(pieces.length * 2.5);
  const hasBack = backPieces.length > 0;
  const backScrews = hasBack ? Math.round(Math.max(16, (bounds.width + bounds.height) * 2 / 120)) : 0;
  const hinges = doorPieces.length * 2;

  // Master tools list
  const allTools = [
    {
      id: 'tool-drill',
      name: 'Taladro Atornillador',
      icon: 'drill',
      description: 'Con control de torque regulable para no avellanar ni romper la melamina.',
      required: true
    },
    {
      id: 'tool-bit-ph2',
      name: 'Punta Phillips PH2 / Pozidriv PZ2',
      icon: 'screwdriver',
      description: 'Punta imantada para atornillado firme de tornillos 4x50mm.',
      required: true
    },
    {
      id: 'tool-guide-bit',
      name: 'Broca Guía Avellanadora 3.5mm - 4mm',
      icon: 'tool',
      description: 'Para perforar agujeros guía a 9mm del borde y evitar que el canto se reviente.',
      required: true
    },
    {
      id: 'tool-tape',
      name: 'Huincha / Cinta Métrica milimétrica',
      icon: 'ruler',
      description: 'Para corroborar cotas de repisas y paralelismo entre costados.',
      required: true
    },
    {
      id: 'tool-square',
      name: 'Escuadra de Carpintero 90°',
      icon: 'compass',
      description: 'Para asegurar la perpendicularidad exacta de la estructura.',
      required: true
    },
    {
      id: 'tool-clamps',
      name: 'Prensas de Esquina / Sargento rápido (x2)',
      icon: 'wrench',
      description: 'Sujetan las piezas a 90° mientras se realiza el atornillado firme.',
      required: true
    },
    {
      id: 'tool-level',
      name: 'Nivel de Mano / Burbuja',
      icon: 'level',
      description: 'Para comprobar aplomo vertical y nivel de base en piso.',
      required: false
    },
    {
      id: 'tool-mallet',
      name: 'Martillo de Goma / Suave',
      icon: 'hammer',
      description: 'Para asentar tarugos de madera sin marcar ni rayar la melamina.',
      required: true
    }
  ];

  // Master hardware list
  const allHardware: AssemblyProjectAnalysis['allHardware'] = [
    {
      id: 'hw-screws-4x50',
      name: 'Tornillos Soberbios para Madera / Aglomerado',
      count: estimatedScrews,
      spec: '4.0 x 50 mm (Zincados / Pavonados)',
      category: 'tornilleria' as const,
      purpose: 'Fijación estructural entre tableros de 15 o 18mm.'
    },
    {
      id: 'hw-dowels',
      name: 'Tarugos de Madera Estriada',
      count: estimatedDowels,
      spec: '8 x 30 mm o 6 x 30 mm',
      category: 'fijacion' as const,
      purpose: 'Alineación y resistencia al corte transversal en uniones.'
    },
    {
      id: 'hw-caps',
      name: 'Tapa-tornillos Adhesivos o Plásticos',
      count: estimatedScrews,
      spec: 'Ø 12mm al tono de la melamina',
      category: 'accesorios' as const,
      purpose: 'Ocultar cabezas de tornillos visibles en laterales exteriores.'
    }
  ];

  if (estimatedShelfPins > 0) {
    allHardware.push({
      id: 'hw-shelf-pins',
      name: 'Soportes de Repisa Metálicos',
      count: estimatedShelfPins,
      spec: 'Perno Ø 5mm con tope de goma/niquelado',
      category: 'herrajes' as const,
      purpose: 'Sujeción de entrepaños y divisiones interiores ajustables.'
    });
  }

  if (hasBack) {
    allHardware.push({
      id: 'hw-back-screws',
      name: 'Tornillos para Fondo de Mueble',
      count: backScrews,
      spec: '3.5 x 20 mm o 3.0 x 16 mm con arandela',
      category: 'tornilleria' as const,
      purpose: 'Sujeción perimetral de tablero trasero de 3mm a 6mm.'
    });
  }

  if (hinges > 0) {
    allHardware.push({
      id: 'hw-hinges',
      name: 'Bisagras Cangrejo Cazoleta 35mm',
      count: hinges,
      spec: 'Cierre suave / Rectas o Semi-curvas',
      category: 'herrajes' as const,
      purpose: 'Articulación de frentes de puerta al costado.'
    });
  }

  // Construct assembly steps sequentially
  const steps: AssemblyStep[] = [];
  let currentStep = 1;

  // STEP 1: Preparation & Base Structure
  const step1Pieces = basePieces.length > 0 ? basePieces : (sidePieces.length > 0 ? [sidePieces[0]] : [pieces[0]]);
  steps.push({
    stepNumber: currentStep++,
    id: 'step-base',
    title: '1. Armado de Base y Zócalo de Apoyo',
    category: 'base',
    description: 'Presenta los amarres de base o zócalos inferiores en una superficie plana y limpia. Aplica prensas de esquina a 90° y realiza las perforaciones guía a 9mm del borde antes de atornillar.',
    pieceIds: step1Pieces.map(p => p.id),
    tips: [
      'Coloca una manta protectora o cartón sobre el piso para no rayar los cantos.',
      'Comprueba con la escuadra metálica que las esquinas estén exactamente a 90° antes del apriete final.',
      'Usa avellanador para que la cabeza del tornillo quede a ras o 0.5mm hundida.'
    ],
    hardwareNeeded: [
      { name: 'Tornillos 4x50mm', count: Math.max(4, step1Pieces.length * 2), spec: 'Cabeza avellanada' },
      { name: 'Tarugos de madera', count: Math.max(2, step1Pieces.length * 2), spec: '8x30mm' }
    ],
    toolsNeeded: ['Taladro Atornillador', 'Broca Guía 3.5mm', 'Escuadra 90°', 'Prensas de esquina'],
    dimensionNotes: [
      { label: 'Ancho de Base', valueMm: bounds.width, axis: 'X' },
      { label: 'Profundidad de Base', valueMm: bounds.depth, axis: 'Z' }
    ]
  });

  // STEP 2: Main Sides and Box Frame (Costados y Tapa)
  const remainingSides = sidePieces.filter(p => !step1Pieces.some(sp => sp.id === p.id));
  const step2Pieces = remainingSides.length > 0 ? remainingSides : pieces.slice(1, Math.min(pieces.length, 3));
  if (step2Pieces.length > 0) {
    steps.push({
      stepNumber: currentStep++,
      id: 'step-sides',
      title: '2. Ensamble de Laterales y Estructura Principal',
      category: 'sides',
      description: 'Une los costados laterales verticales con el piso y techo de la estructura. Asegura que los cantos frontales queden perfectamente enrasados antes de introducir los tornillos principales.',
      pieceIds: step2Pieces.map(p => p.id),
      tips: [
        'Verifica que los cantos delgados o gruesos miren hacia el frente visible del mueble.',
        'Mide las dos diagonales en X: si miden exactamente lo mismo en milímetros, el mueble está perfectamente a escuadra.',
        'No fuerces el atornillador a máxima velocidad para no rodar la rosca interna del tablero.'
      ],
      hardwareNeeded: [
        { name: 'Tornillos 4x50mm', count: Math.max(6, step2Pieces.length * 4), spec: 'Zincados' },
        { name: 'Tapa-tornillos adhesivos', count: Math.max(6, step2Pieces.length * 4), spec: 'Al tono del lateral' }
      ],
      toolsNeeded: ['Taladro Atornillador', 'Broca Guía 3.5mm', 'Huincha / Cinta Métrica', 'Prensas de esquina'],
      dimensionNotes: [
        { label: 'Altura Lateral Exterior', valueMm: bounds.height, axis: 'Y' },
        { label: 'Ancho Total Exterior', valueMm: bounds.width, axis: 'X' }
      ]
    });
  }

  // STEP 3: Shelves, Dividers and Internal Ties (Repisas y Divisiones)
  if (shelfPieces.length > 0) {
    steps.push({
      stepNumber: currentStep++,
      id: 'step-shelves',
      title: '3. Instalación de Repisas, Divisiones y Amarres',
      category: 'shelves',
      description: 'Ubica las divisiones verticales y repisas interiores. Mide cuidadosamente las cotas libres entre entrepaños con la cinta métrica milimétrica según el plano de diseño.',
      pieceIds: shelfPieces.map(p => p.id),
      tips: [
        'Utiliza un taco o plantilla de madera cortada a la medida de la luz libre como apoyo temporal para garantizar que ambas caras queden a la misma altura.',
        'Si usas repisas móviles, perfora con tope de profundidad a 10mm para no atravesar el lateral.',
        'Asegura los amarres superiores que recibirán luego la cubierta o fijación a muro.'
      ],
      hardwareNeeded: [
        { name: 'Tornillos 4x50mm', count: Math.max(4, shelfPieces.length * 2), spec: 'Zincados' },
        { name: 'Soportes de Repisa', count: Math.max(4, shelfPieces.length * 4), spec: 'Perno Ø 5mm' }
      ],
      toolsNeeded: ['Huincha / Cinta Métrica', 'Taladro Atornillador', 'Nivel de Mano'],
      dimensionNotes: [
        { label: 'Luz libre aproximada', valueMm: Math.round(bounds.height / Math.max(2, shelfPieces.length + 1)), axis: 'Y' },
        { label: 'Profundidad de repisas', valueMm: bounds.depth, axis: 'Z' }
      ]
    });
  }

  // STEP 4: Back panel (Fondo)
  if (backPieces.length > 0) {
    steps.push({
      stepNumber: currentStep++,
      id: 'step-back',
      title: '4. Colocación y Fijación del Fondo Posterior',
      category: 'back',
      description: 'El fondo es el elemento estructural clave que mantendrá el mueble a escuadra permanente. Colócalo en la ranura o atorníllalo al perímetro trasero manteniendo las diagonales iguales.',
      pieceIds: backPieces.map(p => p.id),
      tips: [
        'Mide nuevamente las diagonales antes de poner el primer tornillo del fondo.',
        'Coloca un tornillo cada 12 a 15 cm a lo largo de todo el perímetro y en las repisas intermedias.',
        'Asegúrate de atornillar al centro del espesor del tablero (a 9mm del borde si la placa es de 18mm).'
      ],
      hardwareNeeded: [
        { name: 'Tornillos para fondo', count: Math.max(12, backScrews), spec: '3.5x20mm cabeza con arandela' }
      ],
      toolsNeeded: ['Taladro Atornillador', 'Huincha / Cinta Métrica', 'Punta PH2'],
      dimensionNotes: [
        { label: 'Ancho de fondo', valueMm: bounds.width - 4, axis: 'X' },
        { label: 'Alto de fondo', valueMm: bounds.height - 4, axis: 'Y' }
      ]
    });
  }

  // STEP 5: Doors, Drawers and Finishing (Puertas, Cajones y Herrajes)
  const step5Pieces = [...doorPieces, ...otherPieces];
  if (step5Pieces.length > 0) {
    steps.push({
      stepNumber: currentStep++,
      id: 'step-doors',
      title: '5. Montaje de Puertas, Cajones y Regulación',
      category: 'doors_drawers',
      description: 'Instala las correderas telescópicas o bisagras cangrejo. Monta los frentes y calibra los tornillos de regulación tridimensional para lograr ranuras de separación uniformes (2 a 3mm).',
      pieceIds: step5Pieces.map(p => p.id),
      tips: [
        'Regula la profundidad, altura y alineación lateral girando suavemente los tornillos de ajuste de la bisagra.',
        'Coloca topes de silicona autoadhesivos en las esquinas interiores de las puertas para evitar ruidos de golpe al cerrar.',
        'Limpia los restos de viruta con un paño húmedo o alcohol isopropílico suave.'
      ],
      hardwareNeeded: [
        { name: 'Bisagras / Correderas', count: Math.max(2, hinges), spec: 'Cazoleta 35mm o Correderas H45' },
        { name: 'Tornillos 3.5x16mm', count: Math.max(8, step5Pieces.length * 4), spec: 'Para herrajes' }
      ],
      toolsNeeded: ['Destornillador de mano PH2', 'Nivel de Mano', 'Cinta Métrica'],
      dimensionNotes: [
        { label: 'Luz perimetral de puerta', valueMm: 3, axis: 'X' }
      ]
    });
  }

  // Fallback if very few pieces
  if (steps.length === 1 && pieces.length > 1) {
    steps.push({
      stepNumber: currentStep++,
      id: 'step-final',
      title: '2. Ensamble de Componentes Secundarios y Acabado',
      category: 'details',
      description: 'Fija las piezas restantes comprobando aplomos y ángulos rectos. Coloca los cubre-tornillos para un acabado limpio.',
      pieceIds: pieces.slice(1).map(p => p.id),
      tips: ['Inspecciona todas las uniones y limpia excedentes.'],
      hardwareNeeded: [{ name: 'Tornillos 4x50mm', count: 4, spec: 'Zincados' }],
      toolsNeeded: ['Taladro Atornillador', 'Punta PH2'],
      dimensionNotes: [{ label: 'Alineación general', valueMm: bounds.width, axis: 'X' }]
    });
  }

  // Estimated assembly time: ~6-8 minutes per piece + 10 min setup
  const estimatedAssemblyMinutes = Math.round(15 + pieces.length * 7);

  return {
    steps,
    allHardware,
    allTools,
    overallDimensions: {
      width: bounds.width,
      height: bounds.height,
      depth: bounds.depth
    },
    totalPiecesCount: pieces.length,
    estimatedAssemblyMinutes
  };
}
