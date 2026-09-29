import * as THREE from 'three';
import { FaceTextureOptions, CustomTextureItem } from '../types';

const textureCache = new Map<string, THREE.Texture>();
const loader = new THREE.TextureLoader();

// Helper to generate a realistic procedural wood texture on a canvas
export function generateWoodGrainCanvas(baseColor: string, darkColor: string, grainFrequency = 20): string {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle wood pores & fine fibers
  for (let i = 0; i < 700; i++) {
    const y = Math.random() * 512;
    const height = Math.random() * 2.5 + 1;
    ctx.fillStyle = darkColor;
    ctx.globalAlpha = Math.random() * 0.12 + 0.04;
    ctx.fillRect(0, y, 512, height);
  }

  // Wavy wood grain lines with organic curves
  ctx.lineWidth = 2.2;
  for (let i = 0; i < grainFrequency; i++) {
    const yStart = (i / grainFrequency) * 512;
    ctx.beginPath();
    ctx.moveTo(0, yStart);
    for (let x = 0; x <= 512; x += 16) {
      const wave = Math.sin(x * 0.015 + i * 0.55) * 9 + Math.cos(x * 0.038) * 4.5;
      ctx.lineTo(x, yStart + wave);
    }
    ctx.strokeStyle = darkColor;
    ctx.globalAlpha = Math.random() * 0.22 + 0.09;
    ctx.stroke();
  }

  // Subtle cathedral wood loops for realism
  for (let c = 0; c < 2; c++) {
    const cx = 150 + c * 200 + (Math.random() - 0.5) * 40;
    const cy = 200 + c * 100;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 35, 140, 0, 0, Math.PI * 2);
    ctx.strokeStyle = darkColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.12;
    ctx.stroke();
  }

  // Gentle lighting gradient for visual depth
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.06)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0.06)');
  ctx.fillStyle = grad;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 0, 512, 512);

  return canvas.toDataURL('image/png');
}

// Catálogo oficial de maderas y vetas de la marca Pelikano
export const PELIKANO_WOOD_CONFIGS: Record<string, { name: string; baseColor: string; darkColor: string; grainFreq: number }> = {
  'Pelikano_Rovere': { name: 'Rovere', baseColor: '#bca482', darkColor: '#70593c', grainFreq: 20 },
  'Pelikano_Macadamia': { name: 'Macadamia', baseColor: '#ead9c3', darkColor: '#9e8568', grainFreq: 16 },
  'Pelikano_Bellota': { name: 'Bellota', baseColor: '#8e7153', darkColor: '#533b24', grainFreq: 20 },
  'Pelikano_Conac': { name: 'Coñac', baseColor: '#824e31', darkColor: '#4c2512', grainFreq: 22 },
  'Pelikano_Caramel': { name: 'Caramel', baseColor: '#a9865b', darkColor: '#694825', grainFreq: 18 },
  'Pelikano_Ceniza': { name: 'Ceniza', baseColor: '#a0988e', darkColor: '#5e5850', grainFreq: 19 },
  'Pelikano_Nogal': { name: 'Nogal', baseColor: '#4e3629', darkColor: '#26160e', grainFreq: 24 },
  'Pelikano_Siena': { name: 'Siena', baseColor: '#735c4e', darkColor: '#433227', grainFreq: 21 },
  'Pelikano_Capuccino': { name: 'Capuccino', baseColor: '#ac9a8b', darkColor: '#6d5b4e', grainFreq: 17 },
  'Pelikano_Roble_Santana': { name: 'Roble Santana', baseColor: '#b59a72', darkColor: '#654d2e', grainFreq: 21 },
  'Pelikano_Cedro': { name: 'Cedro', baseColor: '#995938', darkColor: '#562812', grainFreq: 20 },
  'Pelikano_Teca': { name: 'Teca', baseColor: '#9b7a4f', darkColor: '#573c1c', grainFreq: 22 },
  'Pelikano_Almendra': { name: 'Almendra', baseColor: '#e6d3be', darkColor: '#9b856e', grainFreq: 15 },
  'Pelikano_Amaretto': { name: 'Amaretto', baseColor: '#533e2b', darkColor: '#312317', grainFreq: 23 },
  'Pelikano_Opalo': { name: 'Ópalo', baseColor: '#94a8a5', darkColor: '#586b68', grainFreq: 18 },
  'Roble Natural': { name: 'Roble Natural', baseColor: '#c4a678', darkColor: '#785b37', grainFreq: 19 },
  'Nogal': { name: 'Nogal', baseColor: '#4e3629', darkColor: '#26160e', grainFreq: 24 },
  'Pino_Radiata': { name: 'Pino Radiata', baseColor: '#e5cf9f', darkColor: '#a1885b', grainFreq: 17 },
  'Fresno_Natural': { name: 'Fresno Claro', baseColor: '#dbcbb3', darkColor: '#8a7760', grainFreq: 18 },
  'Haya_Europea': { name: 'Haya Europea', baseColor: '#d6b38c', darkColor: '#966d47', grainFreq: 19 },
  'Wengue': { name: 'Wengué', baseColor: '#2b211a', darkColor: '#140f0c', grainFreq: 25 }
};

const pelikanoTextureCache = new Map<string, string>();

/**
 * Obtiene la textura fotorealista generada para un material Pelikano con veta.
 */
export function getPelikanoTextureUrl(materialId: string): string | null {
  if (pelikanoTextureCache.has(materialId)) {
    return pelikanoTextureCache.get(materialId)!;
  }

  const cfg = PELIKANO_WOOD_CONFIGS[materialId];
  if (!cfg) return null;

  try {
    const dataUrl = generateWoodGrainCanvas(cfg.baseColor, cfg.darkColor, cfg.grainFreq);
    if (dataUrl) {
      pelikanoTextureCache.set(materialId, dataUrl);
      return dataUrl;
    }
  } catch (e) {
    console.warn('Could not generate Pelikano texture for', materialId, e);
  }

  return null;
}

// Helper to generate a realistic marble texture
function generateMarbleCanvas(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, 512, 512);

  // Soft marble cloudy shadows
  for (let i = 0; i < 15; i++) {
    const rad = ctx.createRadialGradient(
      Math.random() * 512, Math.random() * 512, 10,
      Math.random() * 512, Math.random() * 512, 200
    );
    rad.addColorStop(0, 'rgba(200, 205, 210, 0.15)');
    rad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 512, 512);
  }

  // Veins
  ctx.strokeStyle = '#8a949b';
  for (let v = 0; v < 6; v++) {
    let x = Math.random() * 512;
    let y = 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = Math.random() * 2.5 + 1;
    ctx.globalAlpha = Math.random() * 0.25 + 0.15;
    while (y < 512) {
      x += (Math.random() - 0.45) * 24;
      y += Math.random() * 20 + 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

// Helper to generate concrete texture
function generateConcreteCanvas(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#9e9fa3';
  ctx.fillRect(0, 0, 512, 512);

  // Noise specks
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const s = Math.random() * 2 + 1;
    ctx.fillStyle = Math.random() > 0.5 ? '#737478' : '#c2c4c8';
    ctx.globalAlpha = Math.random() * 0.18 + 0.05;
    ctx.fillRect(x, y, s, s);
  }

  return canvas.toDataURL('image/png');
}

export interface PresetTexture {
  id: string;
  name: string;
  category: 'Madera' | 'Piedra / Mármol' | 'Arquitectónico' | 'Sólido';
  url: string;
  colorPreview: string;
}

let cachedPresets: PresetTexture[] | null = null;

export function getPresetTextures(): PresetTexture[] {
  if (cachedPresets) return cachedPresets;

  try {
    cachedPresets = [
      {
        id: 'preset-pelikano-rovere',
        name: 'Pelikano Rovere',
        category: 'Madera',
        url: getPelikanoTextureUrl('Pelikano_Rovere') || generateWoodGrainCanvas('#bca482', '#70593c', 20),
        colorPreview: '#bca482'
      },
      {
        id: 'preset-pelikano-bellota',
        name: 'Pelikano Bellota',
        category: 'Madera',
        url: getPelikanoTextureUrl('Pelikano_Bellota') || generateWoodGrainCanvas('#8e7153', '#533b24', 20),
        colorPreview: '#8e7153'
      },
      {
        id: 'preset-pelikano-conac',
        name: 'Pelikano Coñac',
        category: 'Madera',
        url: getPelikanoTextureUrl('Pelikano_Conac') || generateWoodGrainCanvas('#824e31', '#4c2512', 22),
        colorPreview: '#824e31'
      },
      {
        id: 'preset-pelikano-macadamia',
        name: 'Pelikano Macadamia',
        category: 'Madera',
        url: getPelikanoTextureUrl('Pelikano_Macadamia') || generateWoodGrainCanvas('#ead9c3', '#9e8568', 16),
        colorPreview: '#ead9c3'
      },
      {
        id: 'preset-pelikano-caramel',
        name: 'Pelikano Caramel',
        category: 'Madera',
        url: getPelikanoTextureUrl('Pelikano_Caramel') || generateWoodGrainCanvas('#a9865b', '#694825', 18),
        colorPreview: '#a9865b'
      },
      {
        id: 'preset-pelikano-ceniza',
        name: 'Pelikano Ceniza',
        category: 'Madera',
        url: getPelikanoTextureUrl('Pelikano_Ceniza') || generateWoodGrainCanvas('#a0988e', '#5e5850', 19),
        colorPreview: '#a0988e'
      },
      {
        id: 'preset-pelikano-nogal',
        name: 'Pelikano Nogal',
        category: 'Madera',
        url: getPelikanoTextureUrl('Pelikano_Nogal') || generateWoodGrainCanvas('#4e3629', '#26160e', 24),
        colorPreview: '#4e3629'
      },
      {
        id: 'preset-marmol-calacatta',
        name: 'Mármol Calacatta',
        category: 'Piedra / Mármol',
        url: generateMarbleCanvas(),
        colorPreview: '#eceef0'
      },
      {
        id: 'preset-concreto-loft',
        name: 'Concreto Loft',
        category: 'Arquitectónico',
        url: generateConcreteCanvas(),
        colorPreview: '#9e9fa3'
      },
      {
        id: 'preset-grafito-textil',
        name: 'Grafito Textil',
        category: 'Arquitectónico',
        url: generateWoodGrainCanvas('#2b2f36', '#1a1c20', 35),
        colorPreview: '#2b2f36'
      }
    ];
  } catch (e) {
    cachedPresets = [];
  }

  return cachedPresets;
}

const STORAGE_KEY = 'mueble3d_custom_textures_v1';

export function getStoredCustomTextures(): CustomTextureItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCustomTexture(name: string, dataUrl: string): CustomTextureItem {
  const list = getStoredCustomTextures();
  const newItem: CustomTextureItem = {
    id: 'custom-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    name: name.trim() || 'Textura Personalizada',
    url: dataUrl,
    createdAt: Date.now()
  };

  // Keep up to 25 textures in storage
  const updated = [newItem, ...list.filter(item => item.id !== newItem.id)].slice(0, 25);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('LocalStorage quota reached when saving texture', e);
  }
  return newItem;
}

export function deleteCustomTexture(id: string): void {
  try {
    const list = getStoredCustomTextures();
    const updated = list.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error deleting texture', e);
  }
}

/**
 * Loads and caches a THREE.Texture from a URL/DataURL with repeat and rotation settings.
 */
export function getOrCreateThreeTexture(
  url: string,
  options?: FaceTextureOptions,
  onLoad?: () => void
): THREE.Texture {
  const repX = options?.repeatX !== undefined ? options.repeatX : 1;
  const repY = options?.repeatY !== undefined ? options.repeatY : 1;
  const rot = options?.rotation || 0;
  const cacheKey = `${url}__rx${repX}__ry${repY}__rot${rot}`;

  const cached = textureCache.get(cacheKey);
  if (cached) {
    if (onLoad) {
      const img = cached.image as any;
      if (img && (img.complete || img.width > 0)) {
        setTimeout(onLoad, 0);
      }
    }
    return cached;
  }

  const texture = loader.load(
    url,
    (t) => {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repX, repY);
      t.center.set(0.5, 0.5);
      t.rotation = THREE.MathUtils.degToRad(rot || 0);
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      if (onLoad) onLoad();
    },
    undefined,
    (err) => {
      console.warn('Could not load texture from URL', err);
    }
  );

  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repX, repY);
  texture.center.set(0.5, 0.5);
  texture.rotation = THREE.MathUtils.degToRad(rot || 0);
  texture.colorSpace = THREE.SRGBColorSpace;

  textureCache.set(cacheKey, texture);
  return texture;
}
