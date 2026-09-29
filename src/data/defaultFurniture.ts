import { FurnitureCatalogItem } from '../types';
import { MODULE_CATEGORIES } from '../lib/moduleLibrary';

export const DEFAULT_FURNITURE_CATEGORIES = [
  'Todas',
  ...MODULE_CATEGORIES.map(category => category.label),
];

// Almacén vacío listo para subir nuevos modelos 3D
export const DEFAULT_FURNITURE_CATALOG: FurnitureCatalogItem[] = [];
