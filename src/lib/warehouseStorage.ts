import { FurnitureCatalogItem } from '../types';

export const WAREHOUSE_STORAGE_KEY = 'ia_mueble_almacen_v2';
export const LEGACY_WAREHOUSE_STORAGE_KEY = 'ia_mueble_almacen_dinamico_v1';

export interface WarehouseStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const parseCatalog = (raw: string | null): FurnitureCatalogItem[] | null => {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : null;
};

/** Loads v2 first and copies a valid v1 catalog forward without deleting it. */
export function loadWarehouseCatalog(storage: WarehouseStorage): FurnitureCatalogItem[] {
  try {
    const current = parseCatalog(storage.getItem(WAREHOUSE_STORAGE_KEY));
    if (current) return current;

    const legacy = parseCatalog(storage.getItem(LEGACY_WAREHOUSE_STORAGE_KEY));
    if (legacy) {
      storage.setItem(WAREHOUSE_STORAGE_KEY, JSON.stringify(legacy));
      return legacy;
    }
  } catch (error) {
    console.warn('Error loading furniture warehouse from storage:', error);
  }
  return [];
}

export function saveWarehouseCatalog(storage: WarehouseStorage, catalog: FurnitureCatalogItem[]): void {
  storage.setItem(WAREHOUSE_STORAGE_KEY, JSON.stringify(catalog));
}
