export interface EdgeConfig {
  largo1: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno';
  largo2: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno';
  ancho1: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno';
  ancho2: 'Canto Delgado' | 'Canto Grueso' | 'Ninguno';
}

export interface Group3D {
  id: string;
  name: string;
  position3D: [number, number, number];
  rotation3D: [number, number, number];
}

export interface SheetConfig {
  width: number;
  height: number;
  kerf: number;
  margin: number; // refilado
}

export interface DynamicAttributes {
  type: 'door' | 'drawer' | 'shelf' | 'custom';
  doorType?: 'single_left' | 'single_right' | 'double_left' | 'double_right' | 'lift_up';
  pivotPoint?: 'left' | 'right' | 'top' | 'bottom';
  openAngle?: number; // max open angle in degrees (e.g. 90)
  slideAxis?: 'X' | 'Y' | 'Z';
  slideDistance?: number; // max slide distance in mm (e.g. 350)
  isOpen?: boolean;
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
  material?: string;
  customColor?: string;
  cantoColor?: string;
  customRoughness?: number;
  customMetalness?: number;
  ranurado?: boolean;
  ranuraConfig?: {
    lado: 'L1' | 'L2' | 'A1' | 'A2';
    dist: number; // distancia en mm
    esp: number; // espesor de ranura en mm
    prof: number; // profundidad de ranura en mm
  };
  abisagrado?: boolean;
  dynamic?: DynamicAttributes;
}
