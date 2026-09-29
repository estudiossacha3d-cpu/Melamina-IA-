export interface EdgeConfig {
  largo1: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno';
  largo2: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno';
  ancho1: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno';
  ancho2: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno';
}

export interface EdgeThicknessConfig {
  delgado: number; // e.g. 0.45 mm
  grueso: number;   // e.g. 3.0 mm
  descontarCorte: boolean; // descontar cantos gruesos para corte
  descontarDelgado?: boolean; // descontar cantos delgados para corte
}

export interface Group3D {
  id: string;
  name: string;
  position3D: [number, number, number];
  rotation3D: [number, number, number];
  hidden?: boolean;
}

export interface SheetConfig {
  width: number;
  height: number;
  kerf: number;
  margin: number; // refilado
}

export type PieceFaceKey = 'top' | 'bottom' | 'front' | 'back' | 'right' | 'left';

export interface FaceTextureOptions {
  repeatX?: number;
  repeatY?: number;
  rotation?: number; // 0, 90, 180, 270
}

export interface CustomTextureItem {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
  createdAt: number;
}

export interface Piece {
  id: string;
  name: string;
  groupId?: string;
  largo: number; // en mm
  ancho: number; // en mm
  espesor: number; // en mm
  cantidad: number;
  cantos: EdgeConfig;
  position3D: [number, number, number]; // [x, y, z]
  rotation3D: [number, number, number]; // [x, y, z]
  veta?: boolean;
  vetaOrientacion?: 'longitudinal' | 'transversal'; // Longitudinal (0°) vs Transversal (90°)
  vetaRotation?: number; // 0, 90, 180, 270 grados
  rotacion?: boolean; // Permite rotar 90° en la optimización de corte
  material?: string;
  customColor?: string;
  cantoColor?: string;
  customRoughness?: number;
  customMetalness?: number;
  customOpacity?: number;
  isGlass?: boolean;
  isMirror?: boolean;
  faceTextures?: {
    top?: string;
    bottom?: string;
    front?: string;
    back?: string;
    right?: string;
    left?: string;
  };
  faceTextureConfigs?: {
    top?: FaceTextureOptions;
    bottom?: FaceTextureOptions;
    front?: FaceTextureOptions;
    back?: FaceTextureOptions;
    right?: FaceTextureOptions;
    left?: FaceTextureOptions;
  };
  ranurado?: boolean;
  ranuraConfig?: {
    lado: 'L1' | 'L2' | 'A1' | 'A2';
    dist: number; // distancia en mm
    esp: number; // espesor de ranura en mm
    prof: number; // profundidad de ranura en mm
  };
  abisagrado?: boolean;
  hidden?: boolean;
}

export interface DynamicParameter {
  id: string;
  name: string;
  label: string;
  type: 'dimension' | 'number' | 'boolean' | 'select';
  defaultValue: string | number | boolean;
  options?: string[];
  unit?: string;
  description?: string;
}

export interface DynamicFurnitureItem {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  description: string;
  dimensions: {
    width: number; // Ancho frontal (X) en mm
    height: number; // Alto (Y) en mm
    depth: number; // Profundidad (Z) en mm
  };
  thickness: number; // Espesor estándar (18, 15, etc.) en mm
  tags: string[];
  pieces: Piece[]; // Piezas 3D que componen el mueble
  dynamicParameters?: DynamicParameter[];
  status: 'ready_for_3d' | 'has_3d';
  createdAt: string;
  updatedAt: string;
  thumbnailColor?: string;
  notes?: string;
}
