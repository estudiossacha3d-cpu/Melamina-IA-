export interface MaterialDefinition {
  id: string;
  name: string;
  category: 'madera' | 'melamina' | 'vidrio' | 'metal' | 'custom';
  categoryLabel: string;
  color: string;
  coreColor: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  transparent?: boolean;
  isGlass?: boolean;
  isMirror?: boolean;
  description?: string;
  brand?: string;
  hasGrain?: boolean;
}

export const MATERIAL_CATEGORIES = [
  { id: 'all', label: 'Todas', icon: '✨', description: 'Todos los materiales' },
  { id: 'madera', label: 'Maderas', icon: '🪵', description: 'Maderas con veta natural y texturas cálidas' },
  { id: 'melamina', label: 'Colores', icon: '🎨', description: 'Melaminas unicolor y tonos contemporáneos' },
  { id: 'vidrio', label: 'Vidrio / Espejo', icon: '🪞', description: 'Cristales templados y espejos reflectivos' },
  { id: 'metal', label: 'Metales', icon: '🔩', description: 'Acero, aluminio, forja y perfiles' },
  { id: 'custom', label: 'Mis Fotos', icon: '📁', description: 'Texturas fotográficas subidas por ti' }
] as const;

export const FURNITURE_MATERIALS: Record<string, MaterialDefinition> = {
  // --- MADERAS CON VETA (Pelikano y Naturales) ---
  'Pelikano_Rovere': {
    id: 'Pelikano_Rovere',
    name: 'Rovere',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#bca482',
    coreColor: '#70593c',
    roughness: 0.5,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Roble europeo de veta elegante y tono beige cálido.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Roble Natural': {
    id: 'Roble Natural',
    name: 'Roble Natural',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#c4a678',
    coreColor: '#785b37',
    roughness: 0.48,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Roble clásico claro con vetas orgánicas pronunciadas.',
    brand: 'Genérico',
    hasGrain: true
  },
  'Pelikano_Macadamia': {
    id: 'Pelikano_Macadamia',
    name: 'Macadamia',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#ead9c3',
    coreColor: '#9e8568',
    roughness: 0.46,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Madera clara y luminosa para frentes nórdicos.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Nogal': {
    id: 'Nogal',
    name: 'Nogal Americano',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#4e3629',
    coreColor: '#26160e',
    roughness: 0.52,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Nogal oscuro premium con vetas profundas y sofisticadas.',
    brand: 'Genérico',
    hasGrain: true
  },
  'Pelikano_Bellota': {
    id: 'Pelikano_Bellota',
    name: 'Bellota',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#8e7153',
    coreColor: '#533b24',
    roughness: 0.48,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Tono castaño medio de gran calidez y versatilidad.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Pelikano_Conac': {
    id: 'Pelikano_Conac',
    name: 'Coñac',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#824e31',
    coreColor: '#4c2512',
    roughness: 0.48,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Tono rojizo ambarino con veta expresiva tradicional.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Pelikano_Caramel': {
    id: 'Pelikano_Caramel',
    name: 'Caramel',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#a9865b',
    coreColor: '#694825',
    roughness: 0.48,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Dorado suave acaramelado para interiores acogedores.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Pelikano_Ceniza': {
    id: 'Pelikano_Ceniza',
    name: 'Ceniza',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#a0988e',
    coreColor: '#5e5850',
    roughness: 0.5,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Madera desaturada moderna para ambientes minimalistas.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Pelikano_Teca': {
    id: 'Pelikano_Teca',
    name: 'Teca Tropical',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#9b7a4f',
    coreColor: '#573c1c',
    roughness: 0.46,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Teca dorada de alta resistencia y elegancia visual.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Pelikano_Cedro': {
    id: 'Pelikano_Cedro',
    name: 'Cedro',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#995938',
    coreColor: '#562812',
    roughness: 0.5,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Cálido con tintes terracota y vetas finas longitudinales.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Pelikano_Roble_Santana': {
    id: 'Pelikano_Roble_Santana',
    name: 'Roble Santana',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#b59a72',
    coreColor: '#654d2e',
    roughness: 0.48,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Roble rústico con nudos y vetas dinámicas naturales.',
    brand: 'Pelikano',
    hasGrain: true
  },
  'Pino_Radiata': {
    id: 'Pino_Radiata',
    name: 'Pino Radiata',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#e5cf9f',
    coreColor: '#a1885b',
    roughness: 0.5,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Pino nórdico claro con vetas suaves y nudos discretos.',
    brand: 'Genérico',
    hasGrain: true
  },
  'Fresno_Natural': {
    id: 'Fresno_Natural',
    name: 'Fresno Claro',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#dbcbb3',
    coreColor: '#8a7760',
    roughness: 0.46,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Madera europea clara de grano fino y textura contemporánea.',
    brand: 'Genérico',
    hasGrain: true
  },
  'Haya_Europea': {
    id: 'Haya_Europea',
    name: 'Haya Europea',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#d6b38c',
    coreColor: '#966d47',
    roughness: 0.48,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Tono rosáceo suave con poro homogéneo y limpio.',
    brand: 'Genérico',
    hasGrain: true
  },
  'Wengue': {
    id: 'Wengue',
    name: 'Wengué Africano',
    category: 'madera',
    categoryLabel: 'Madera con Veta',
    color: '#2b211a',
    coreColor: '#140f0c',
    roughness: 0.54,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Madera de ébano oscura y elegante con vetas casi negras.',
    brand: 'Genérico',
    hasGrain: true
  },

  // --- COLORES Y MELAMINAS LISAS (Primarios y Básicos) ---
  'Blanco': {
    id: 'Blanco',
    name: 'Blanco Mate',
    category: 'melamina',
    categoryLabel: 'Melamina / Color',
    color: '#ecebe6',
    coreColor: '#c8b49b',
    roughness: 0.85,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Tablero liso melamina blanco mate suave antirreflejos para interiores y estructuras.',
    brand: 'Genérico',
    hasGrain: false
  },
  'Negro': {
    id: 'Negro',
    name: 'Negro Mate',
    category: 'melamina',
    categoryLabel: 'Melamina / Color',
    color: '#1a1a1a',
    coreColor: '#120f0d',
    roughness: 0.5,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Acabado negro mate profundo antirreflejo.',
    brand: 'Genérico',
    hasGrain: false
  },
  'Gris_Grafito': {
    id: 'Gris_Grafito',
    name: 'Gris Grafito',
    category: 'melamina',
    categoryLabel: 'Melamina / Color',
    color: '#3e444a',
    coreColor: '#2b2e32',
    roughness: 0.45,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Gris oscuro contemporáneo para frentes y repisas.',
    brand: 'Genérico',
    hasGrain: false
  },
  'Gris_Claro': {
    id: 'Gris_Claro',
    name: 'Gris Perla',
    category: 'melamina',
    categoryLabel: 'Melamina / Color',
    color: '#d1d5db',
    coreColor: '#b0b5bc',
    roughness: 0.45,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Tono gris suave de alta luminosidad.',
    brand: 'Genérico',
    hasGrain: false
  },
  'Beige_Arena': {
    id: 'Beige_Arena',
    name: 'Arena / Lino',
    category: 'melamina',
    categoryLabel: 'Melamina / Color',
    color: '#d4c3a3',
    coreColor: '#a8987b',
    roughness: 0.45,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Neutro cálido y elegante para ambientes nórdicos.',
    brand: 'Genérico',
    hasGrain: false
  },
  'Azul_Primario': {
    id: 'Azul_Primario',
    name: 'Azul Cobalto',
    category: 'melamina',
    categoryLabel: 'Color Primario',
    color: '#1e40af',
    coreColor: '#142a75',
    roughness: 0.38,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Color primario saturado para muebles de acento.',
    brand: 'Genérico',
    hasGrain: false
  },
  'Rojo_Primario': {
    id: 'Rojo_Primario',
    name: 'Rojo Carmín',
    category: 'melamina',
    categoryLabel: 'Color Primario',
    color: '#b91c1c',
    coreColor: '#7a1111',
    roughness: 0.38,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Color primario vivo para detalles y puertas de muebles.',
    brand: 'Genérico',
    hasGrain: false
  },
  'Amarillo_Primario': {
    id: 'Amarillo_Primario',
    name: 'Amarillo Mostaza',
    category: 'melamina',
    categoryLabel: 'Color Primario',
    color: '#eab308',
    coreColor: '#967104',
    roughness: 0.38,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Color primario cálido y vibrante para mobiliario creativo.',
    brand: 'Genérico',
    hasGrain: false
  },
  'Verde_Salvia': {
    id: 'Verde_Salvia',
    name: 'Verde Salvia',
    category: 'melamina',
    categoryLabel: 'Melamina / Color',
    color: '#5f7a61',
    coreColor: '#3d4f3e',
    roughness: 0.45,
    metalness: 0.0,
    opacity: 1.0,
    description: 'Verde botánico apagado para interiores modernos.',
    brand: 'Genérico',
    hasGrain: false
  },

  // --- VIDRIO Y ESPEJO ---
  'Vidrio_Claro': {
    id: 'Vidrio_Claro',
    name: 'Vidrio Incoloro',
    category: 'vidrio',
    categoryLabel: 'Vidrio Templado',
    color: '#e2f1f8',
    coreColor: '#7dd3fc',
    roughness: 0.05,
    metalness: 0.05,
    opacity: 0.28,
    transparent: true,
    isGlass: true,
    description: 'Cristal transparente para repisas, puertas y vitrinas.',
    brand: 'Genérico'
  },
  'Vidrio_Fume': {
    id: 'Vidrio_Fume',
    name: 'Vidrio Fumé',
    category: 'vidrio',
    categoryLabel: 'Vidrio Tonalizado',
    color: '#2d3748',
    coreColor: '#1a202c',
    roughness: 0.08,
    metalness: 0.1,
    opacity: 0.45,
    transparent: true,
    isGlass: true,
    description: 'Vidrio gris oscuro ahumado de alta gama.',
    brand: 'Genérico'
  },
  'Vidrio_Esmerilado': {
    id: 'Vidrio_Esmerilado',
    name: 'Vidrio Esmerilado',
    category: 'vidrio',
    categoryLabel: 'Vidrio Mate',
    color: '#e2e8f0',
    coreColor: '#cbd5e1',
    roughness: 0.65,
    metalness: 0.05,
    opacity: 0.62,
    transparent: true,
    isGlass: true,
    description: 'Cristal arenado translúcido difusor de luz.',
    brand: 'Genérico'
  },
  'Espejo_Plata': {
    id: 'Espejo_Plata',
    name: 'Espejo Plata',
    category: 'vidrio',
    categoryLabel: 'Espejo Cristal',
    color: '#f8fafc',
    coreColor: '#94a3b8',
    roughness: 0.02,
    metalness: 0.98,
    opacity: 1.0,
    isMirror: true,
    description: 'Espejo clásico con reflectividad pura para tocadores y armarios.',
    brand: 'Genérico'
  },
  'Espejo_Bronce': {
    id: 'Espejo_Bronce',
    name: 'Espejo Bronce',
    category: 'vidrio',
    categoryLabel: 'Espejo Cálido',
    color: '#9d7857',
    coreColor: '#5c4533',
    roughness: 0.04,
    metalness: 0.92,
    opacity: 1.0,
    isMirror: true,
    description: 'Espejo cálido tonalizado en bronce para decoración sofisticada.',
    brand: 'Genérico'
  },

  // --- METALES (Herrajes, Patas, Perfiles, Tiradores) ---
  'Acero_Inoxidable': {
    id: 'Acero_Inoxidable',
    name: 'Acero Inox / Cromo',
    category: 'metal',
    categoryLabel: 'Metal Pulido',
    color: '#d4d8dd',
    coreColor: '#64748b',
    roughness: 0.12,
    metalness: 0.95,
    opacity: 1.0,
    description: 'Acabado cromado reflectivo brillante para herrajes y patas.',
    brand: 'Genérico'
  },
  'Aluminio_Anodizado': {
    id: 'Aluminio_Anodizado',
    name: 'Aluminio Anodizado',
    category: 'metal',
    categoryLabel: 'Metal Satinado',
    color: '#bcc4cc',
    coreColor: '#64748b',
    roughness: 0.35,
    metalness: 0.82,
    opacity: 1.0,
    description: 'Aluminio natural mate para tiradores tipo gola y marcos.',
    brand: 'Genérico'
  },
  'Negro_Forja': {
    id: 'Negro_Forja',
    name: 'Hierro Negro Forja',
    category: 'metal',
    categoryLabel: 'Metal Mate',
    color: '#222222',
    coreColor: '#0a0a0a',
    roughness: 0.65,
    metalness: 0.65,
    opacity: 1.0,
    description: 'Pintura electrostática negra texturizada estilo industrial.',
    brand: 'Genérico'
  },
  'Laton_Dorado': {
    id: 'Laton_Dorado',
    name: 'Latón / Oro Cepillado',
    category: 'metal',
    categoryLabel: 'Metal Noble',
    color: '#d4af37',
    coreColor: '#785f17',
    roughness: 0.25,
    metalness: 0.88,
    opacity: 1.0,
    description: 'Tono dorado satinado para tiradores y zócalos de lujo.',
    brand: 'Genérico'
  },
  'Cobre_Rosa': {
    id: 'Cobre_Rosa',
    name: 'Cobre / Oro Rosa',
    category: 'metal',
    categoryLabel: 'Metal Noble',
    color: '#b86d4e',
    coreColor: '#6e3c27',
    roughness: 0.22,
    metalness: 0.85,
    opacity: 1.0,
    description: 'Metal cálido rojizo para detalles de ebanistería.',
    brand: 'Genérico'
  }
};

// Aliases for backwards compatibility with any existing saved scene
export const MATERIAL_ALIASES: Record<string, string> = {
  'Pelikano_Blanco_Absoluto': 'Blanco',
  'Pelikano_Negro': 'Negro',
  'Pelikano_Plomo': 'Gris_Grafito',
  'Pelikano_Carbon': 'Negro',
  'Pelikano_Cendra': 'Gris_Grafito',
  'Pelikano_Niebla': 'Gris_Claro',
  'Pelikano_Humo': 'Gris_Claro',
  'Pelikano_Duna': 'Beige_Arena',
  'Pelikano_Almendra': 'Beige_Arena',
  'Pelikano_Salvia': 'Verde_Salvia',
  'Pelikano_Opalo': 'Verde_Salvia',
  'Pelikano_Azul_Acero': 'Azul_Primario',
  'Pelikano_Rovere': 'Beige_Arena',
  'Pelikano_Macadamia': 'Beige_Arena',
  'Pelikano_Bellota': 'Beige_Arena',
  'Pelikano_Conac': 'Beige_Arena',
  'Pelikano_Caramel': 'Beige_Arena',
  'Pelikano_Ceniza': 'Gris_Claro',
  'Pelikano_Nogal': 'Negro',
  'Pelikano_Siena': 'Negro',
  'Pelikano_Capuccino': 'Beige_Arena',
  'Pelikano_Roble_Santana': 'Beige_Arena',
  'Pelikano_Cedro': 'Beige_Arena',
  'Pelikano_Teca': 'Beige_Arena',
  'Pelikano_Amaretto': 'Negro'
};

export function getMaterialDefinition(materialId?: string): MaterialDefinition {
  if (!materialId) return FURNITURE_MATERIALS['Blanco'];
  if (FURNITURE_MATERIALS[materialId]) return FURNITURE_MATERIALS[materialId];
  if (MATERIAL_ALIASES[materialId] && FURNITURE_MATERIALS[MATERIAL_ALIASES[materialId]]) {
    return FURNITURE_MATERIALS[MATERIAL_ALIASES[materialId]];
  }
  return FURNITURE_MATERIALS['Blanco'];
}

export const MATERIAL_MAP = FURNITURE_MATERIALS;
export const DEFAULT_MATERIAL_ID = 'Blanco';
export const DEFAULT_MATERIAL = FURNITURE_MATERIALS['Blanco'];

export const getGroupedMaterials = () => {
  const groups: Record<string, MaterialDefinition[]> = {
    'Maderas con Veta': [],
    'Colores y Melaminas': [],
    'Vidrio y Espejo': [],
    'Metales': []
  };

  Object.values(FURNITURE_MATERIALS).forEach(mat => {
    if (mat.category === 'madera') groups['Maderas con Veta'].push(mat);
    else if (mat.category === 'melamina') groups['Colores y Melaminas'].push(mat);
    else if (mat.category === 'vidrio') groups['Vidrio y Espejo'].push(mat);
    else if (mat.category === 'metal') groups['Metales'].push(mat);
  });

  return groups;
};

export const getMaterialEmoji = (name: string): string => {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('rovere') || lowercase.includes('roble') || lowercase.includes('nogal') || lowercase.includes('teca') || lowercase.includes('cedro') || lowercase.includes('bellota') || lowercase.includes('caramel') || lowercase.includes('macadamia') || lowercase.includes('coñac') || lowercase.includes('ceniza')) return '🪵';
  if (lowercase.includes('vidrio')) return '🪟';
  if (lowercase.includes('espejo')) return '🪞';
  if (lowercase.includes('acero') || lowercase.includes('aluminio') || lowercase.includes('cromo')) return '🔩';
  if (lowercase.includes('latón') || lowercase.includes('laton') || lowercase.includes('oro')) return '🪙';
  if (lowercase.includes('cobre')) return '🥉';
  if (lowercase.includes('hierro') || lowercase.includes('forja')) return '⛓️';
  if (lowercase.includes('blanco')) return '⚪';
  if (lowercase.includes('negro')) return '⚫';
  if (lowercase.includes('gris')) return '🔘';
  if (lowercase.includes('azul')) return '🔵';
  if (lowercase.includes('rojo')) return '🔴';
  if (lowercase.includes('amarillo')) return '🟡';
  if (lowercase.includes('verde')) return '🟢';
  if (lowercase.includes('arena') || lowercase.includes('lino')) return '🟤';
  return '🎨';
};
