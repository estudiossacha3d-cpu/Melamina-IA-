import { DynamicFurnitureItem } from '../types';

export const DEFAULT_FURNITURE_CATEGORIES = [
  'Todas',
  'Cocina',
  'Dormitorio',
  'Sala y TV',
  'Oficina y Estudio',
  'Baño'
];

export const DEFAULT_FURNITURE_CATALOG: DynamicFurnitureItem[] = [
  {
    id: 'furn-cocina-bajo-2p',
    name: 'Módulo Bajo Cocina 2 Puertas',
    category: 'Cocina',
    subcategory: 'Muebles Bajos',
    description: 'Módulo estándar para cocina con zócalo, 2 puertas batientes y repisa intermedia regulable.',
    dimensions: {
      width: 800,
      height: 750,
      depth: 550
    },
    thickness: 18,
    tags: ['cocina', 'bajo', '2 puertas', 'repisa', 'melamina 18mm'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#e07a5f',
    notes: 'Preparado para recibir piezas 3D y parámetros dinámicos de ancho y número de repisas.',
    dynamicParameters: [
      { id: 'p_ancho', name: 'ancho_total', label: 'Ancho Total', type: 'dimension', defaultValue: 800, unit: 'mm' },
      { id: 'p_alto', name: 'alto_total', label: 'Alto Total', type: 'dimension', defaultValue: 750, unit: 'mm' },
      { id: 'p_prof', name: 'profundidad', label: 'Profundidad', type: 'dimension', defaultValue: 550, unit: 'mm' },
      { id: 'p_puertas', name: 'num_puertas', label: 'Número de Puertas', type: 'select', defaultValue: '2', options: ['1', '2'] }
    ]
  },
  {
    id: 'furn-cocina-aereo-2p',
    name: 'Módulo Aéreo Cocina 2 Puertas',
    category: 'Cocina',
    subcategory: 'Muebles Altos',
    description: 'Módulo superior para pared con 2 puertas y división horizontal interna.',
    dimensions: {
      width: 800,
      height: 600,
      depth: 320
    },
    thickness: 18,
    tags: ['cocina', 'aéreo', 'alto', 'colgante', '2 puertas'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#3d5a80',
    notes: 'Ideal para montaje en muro sobre salpicadero.',
    dynamicParameters: [
      { id: 'p_ancho', name: 'ancho_total', label: 'Ancho Total', type: 'dimension', defaultValue: 800, unit: 'mm' },
      { id: 'p_alto', name: 'alto_total', label: 'Alto Total', type: 'dimension', defaultValue: 600, unit: 'mm' },
      { id: 'p_prof', name: 'profundidad', label: 'Profundidad', type: 'dimension', defaultValue: 320, unit: 'mm' }
    ]
  },
  {
    id: 'furn-cocina-cajonero-3',
    name: 'Módulo Cajonero Bajo 3 Gavetas',
    category: 'Cocina',
    subcategory: 'Cajoneros',
    description: 'Módulo bajo con 2 cajones medianos y 1 cacerolero inferior de gran capacidad.',
    dimensions: {
      width: 600,
      height: 750,
      depth: 550
    },
    thickness: 18,
    tags: ['cocina', 'cajones', 'cacerolero', 'correderas telescópicas'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#81b29a',
    notes: 'Estructura lista para vincular frentes y laterales de cajones dinámicos.',
    dynamicParameters: [
      { id: 'p_ancho', name: 'ancho_total', label: 'Ancho Total', type: 'dimension', defaultValue: 600, unit: 'mm' },
      { id: 'p_cajones', name: 'cant_cajones', label: 'Cantidad de Cajones', type: 'select', defaultValue: '3', options: ['2', '3', '4'] }
    ]
  },
  {
    id: 'furn-cocina-torre-horno',
    name: 'Torre de Hornos y Despensa',
    category: 'Cocina',
    subcategory: 'Torres y Columnas',
    description: 'Columna vertical con nichos para microondas, horno eléctrico empotrable y despensa superior.',
    dimensions: {
      width: 600,
      height: 2100,
      depth: 580
    },
    thickness: 18,
    tags: ['cocina', 'torre', 'horno', 'columna', 'despensa'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#f2cc8f',
    notes: 'Configurable con diferentes alturas de nicho para electrodomésticos.'
  },
  {
    id: 'furn-dorm-ropero-2c',
    name: 'Ropero Clóset 2 Cuerpos con Maletero',
    category: 'Dormitorio',
    subcategory: 'Roperos y Clósets',
    description: 'Armario de 2 puertas altas, espacio de colgado, repisas interiores y maletero superior.',
    dimensions: {
      width: 1000,
      height: 2100,
      depth: 550
    },
    thickness: 18,
    tags: ['dormitorio', 'ropero', 'closet', 'colgador', 'maletero'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#d4a373',
    notes: 'Estructura lista para parametrizar división interior y cajones internos.'
  },
  {
    id: 'furn-dorm-comoda-4c',
    name: 'Cómoda Chifonier 4 Cajones',
    category: 'Dormitorio',
    subcategory: 'Cómodas',
    description: 'Mueble bajo con 4 cajones amplios sobre correderas de extensión total.',
    dimensions: {
      width: 900,
      height: 950,
      depth: 480
    },
    thickness: 18,
    tags: ['dormitorio', 'cómoda', '4 cajones', 'chifonier'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#a5a58d',
    notes: 'Permite graduar altura de tapas frontales.'
  },
  {
    id: 'furn-dorm-velador',
    name: 'Mesa de Noche / Velador Minimalista',
    category: 'Dormitorio',
    subcategory: 'Mesas de Noche',
    description: 'Velador compacto con 1 cajón superior y hueco organizador inferior.',
    dimensions: {
      width: 450,
      height: 550,
      depth: 380
    },
    thickness: 18,
    tags: ['dormitorio', 'velador', 'mesa de noche', 'compacto'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#b7b7a4',
    notes: 'Opción de base con zócalo o patas de madera/metal.'
  },
  {
    id: 'furn-sala-rack-tv',
    name: 'Mueble Rack TV Flotante con Repisas',
    category: 'Sala y TV',
    subcategory: 'Muebles de TV',
    description: 'Centro de entretenimiento flotante con puerta basculante y pasacables oculto.',
    dimensions: {
      width: 1600,
      height: 380,
      depth: 350
    },
    thickness: 18,
    tags: ['sala', 'tv', 'rack flotante', 'puerta abatible'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#6b705c',
    notes: 'Diseñado para anclaje a pared con soporte francés oculto.'
  },
  {
    id: 'furn-oficina-escritorio',
    name: 'Escritorio Home Office con Cajonera',
    category: 'Oficina y Estudio',
    subcategory: 'Escritorios',
    description: 'Escritorio ergonómico con tapa reforzada y cajonera integrada de 3 gavetas a la derecha.',
    dimensions: {
      width: 1300,
      height: 750,
      depth: 600
    },
    thickness: 18,
    tags: ['oficina', 'escritorio', 'home office', 'cajonera'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#588157',
    notes: 'Espacio lateral adaptable a izquierda o derecha.'
  },
  {
    id: 'furn-oficina-librero',
    name: 'Librero Estantería 5 Divisiones',
    category: 'Oficina y Estudio',
    subcategory: 'Libreros y Estantes',
    description: 'Estantería vertical con 5 niveles de almacenamiento y fondo rigidizador.',
    dimensions: {
      width: 800,
      height: 1850,
      depth: 300
    },
    thickness: 18,
    tags: ['oficina', 'estantería', 'librero', 'repisas'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#344e41',
    notes: 'División simétrica con repisas fijas y regulables.'
  },
  {
    id: 'furn-bano-vanitorio',
    name: 'Vanitorio Suspendido para Lavamanos',
    category: 'Baño',
    subcategory: 'Vanitorios',
    description: 'Mueble suspendido resistente a humedad con hueco para sifón y puerta con bisagras cierre suave.',
    dimensions: {
      width: 650,
      height: 500,
      depth: 450
    },
    thickness: 18,
    tags: ['baño', 'vanitorio', 'lavamanos', 'flotante', 'cierre suave'],
    pieces: [],
    status: 'ready_for_3d',
    createdAt: '2026-09-14T10:00:00.000Z',
    updatedAt: '2026-09-14T10:00:00.000Z',
    thumbnailColor: '#2b9348',
    notes: 'Configurado para melamina RH (resistente a humedad).'
  }
];
