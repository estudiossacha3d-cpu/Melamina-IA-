import { Piece } from '../types';
import { FURNITURE_MATERIALS, getMaterialDefinition } from './materials';

export type SubstrateType = 'melamina' | 'mdf' | 'madera' | 'vidrio' | 'metal' | 'custom';

export interface PieceMaterialProfile {
  groupKey: string;
  code: string;
  materialName: string;
  displayName: string;
  color: string;
  textColor: string;
  isDark: boolean;
  substrate: SubstrateType;
  substrateLabel: string;
  thickness: number;
  isWood: boolean;
  isGlass: boolean;
  isMirror: boolean;
  hasGrain: boolean;
  textureUrl: string | null;
}

// Helper to calculate perceived brightness/luminance
function isColorDark(hexColor: string): boolean {
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Perceived luminance formula (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 128;
}

// Generate a clean 2-3 letter code for cut plan tagging (e.g. RO18, BL18, NG15)
function generateMaterialCode(name: string, thickness: number): string {
  const clean = name.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '').toUpperCase();
  const prefix = clean.length >= 2 ? clean.substring(0, 2) : (clean + 'M').substring(0, 2);
  return `${prefix}${thickness}`;
}

export function getPieceMaterialProfile(piece: Piece): PieceMaterialProfile {
  const matDef = getMaterialDefinition(piece.material);
  const thickness = piece.espesor || 18;
  const matName = matDef.name || piece.material || 'Blanco Mate';

  // Determine Substrate
  const lowerName = (matName + ' ' + (piece.name || '')).toLowerCase();
  let substrate: SubstrateType = 'melamina';
  let substrateLabel = 'Melamina';

  if (matDef.isGlass || lowerName.includes('vidrio') || lowerName.includes('cristal')) {
    substrate = 'vidrio';
    substrateLabel = 'Vidrio';
  } else if (matDef.isMirror || lowerName.includes('espejo')) {
    substrate = 'vidrio';
    substrateLabel = 'Espejo';
  } else if (thickness <= 4 || lowerName.includes('fondo') || lowerName.includes('mdf') || lowerName.includes('nordex')) {
    substrate = 'mdf';
    substrateLabel = 'MDF / Fondo';
  } else if (matDef.category === 'metal' || lowerName.includes('acero') || lowerName.includes('aluminio')) {
    substrate = 'metal';
    substrateLabel = 'Perfilería Metálica';
  } else if (matDef.category === 'madera') {
    substrate = 'madera';
    substrateLabel = 'Madera / Enchapado';
  } else if (matDef.category === 'custom') {
    substrate = 'custom';
    substrateLabel = 'Personalizado';
  }

  const color = piece.customColor || matDef.color || '#ecebe6';
  const isDark = isColorDark(color);
  const textColor = isDark ? '#ffffff' : '#1e2028';
  const code = generateMaterialCode(matName, thickness);

  // Group key keeps cuts grouped by substrate, specific material, and board thickness
  const groupKey = `${substrate}_${matName.replace(/\s+/g, '_')}_${thickness}mm`;
  const displayName = `${substrateLabel} ${matName} ${thickness}mm`;

  const isWood = substrate === 'madera' || matDef.category === 'madera' || !!matDef.hasGrain;
  const isGlass = substrate === 'vidrio';
  const isMirror = !!matDef.isMirror || lowerName.includes('espejo');
  const hasGrain = !isGlass && !isMirror && (piece.veta !== undefined ? !!piece.veta : !!matDef.hasGrain);

  let textureUrl: string | null = null;
  if (piece.faceTextures?.front) {
    textureUrl = piece.faceTextures.front;
  }

  return {
    groupKey,
    code,
    materialName: matName,
    displayName,
    color,
    textColor,
    isDark,
    substrate,
    substrateLabel,
    thickness,
    isWood,
    isGlass,
    isMirror,
    hasGrain,
    textureUrl
  };
}
