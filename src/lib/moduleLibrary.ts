export type ModuleCategoryId =
  | 'shelves'
  | 'desks'
  | 'wardrobes'
  | 'dressers'
  | 'kitchen-upper'
  | 'kitchen-lower';

export interface ModuleCategory {
  id: ModuleCategoryId;
  code: string;
  label: string;
  description: string;
}

export const MODULE_CATEGORIES: readonly ModuleCategory[] = [
  {
    id: 'shelves',
    code: 'EST',
    label: 'Estantes',
    description: 'Estantes, libreros y exhibidores',
  },
  {
    id: 'desks',
    code: 'ESC',
    label: 'Escritorios',
    description: 'Escritorios y mesas de trabajo',
  },
  {
    id: 'wardrobes',
    code: 'ROP',
    label: 'Roperos',
    description: 'Roperos, clósets y armarios',
  },
  {
    id: 'dressers',
    code: 'COM',
    label: 'Cómodas',
    description: 'Cómodas y cajoneras',
  },
  {
    id: 'kitchen-upper',
    code: 'C-A',
    label: 'Cocina alta',
    description: 'Módulos aéreos y alacenas',
  },
  {
    id: 'kitchen-lower',
    code: 'C-B',
    label: 'Cocina baja',
    description: 'Bases, bajos y módulos de piso',
  },
] as const;
