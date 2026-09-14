import assert from 'node:assert/strict';
import test from 'node:test';
import { createStarterProject, serializePiecesCsv, sheetGroupKey } from '../src/lib/project';
import { professionalPack } from '../src/lib/cutOptimizer';
import { createShelfModule } from '../src/lib/shelfModule';

test('starter project is an assembled six-board module', () => {
  const project = createStarterProject();
  assert.equal(project.pieces.length, 6);
  assert.equal(project.groups.length, 1);
  assert.ok(project.pieces.every(piece => piece.largo > 0 && piece.ancho > 0 && piece.espesor > 0));
  assert.equal(project.pieces.filter(piece => piece.espesor === 18).length, 5);
  assert.equal(project.pieces.filter(piece => piece.espesor === 3).length, 1);
});

test('packing places every starter piece without overlap inside its sheet', () => {
  const melamine = createStarterProject().pieces.filter(piece => piece.espesor === 18);
  const packed = professionalPack(melamine, { width: 2440, height: 2140, kerf: 3, margin: 10 });
  assert.equal(packed.boards.reduce((count, board) => count + board.rects.length, 0), 5);

  for (const board of packed.boards) {
    for (const rect of board.rects) {
      assert.ok(rect.x >= 10 && rect.y >= 10);
      assert.ok(rect.x + rect.w <= 2430 && rect.y + rect.h <= 2130);
    }
    for (let i = 0; i < board.rects.length; i += 1) {
      for (let j = i + 1; j < board.rects.length; j += 1) {
        const a = board.rects[i];
        const b = board.rects[j];
        const overlaps = a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
        assert.equal(overlaps, false);
      }
    }
  }
});

test('cut groups distinguish material, colour and thickness', () => {
  const [piece] = createStarterProject().pieces;
  assert.notEqual(sheetGroupKey(piece), sheetGroupKey({ ...piece, material: 'Grafito' }));
  assert.notEqual(sheetGroupKey(piece), sheetGroupKey({ ...piece, customColor: '#101010' }));
  assert.notEqual(sheetGroupKey(piece), sheetGroupKey({ ...piece, espesor: 15 }));
});

test('CSV contains production dimensions and semicolon-separated columns', () => {
  const project = createStarterProject();
  const csv = serializePiecesCsv(project.pieces);
  assert.match(csv, /Pieza;Cantidad;Largo_mm;Ancho_mm;Espesor_mm/);
  assert.match(csv, /Lateral izquierdo;1;720;560;18/);
  assert.equal(csv.split('\n').length, project.pieces.length + 1);
});

test('grain direction prevents rotation and reports pieces that do not fit', () => {
  const [base] = createStarterProject().pieces;
  const grainPiece = { ...base, largo: 800, ancho: 500, cantidad: 1, veta: true };
  const config = { width: 600, height: 1000, kerf: 3, margin: 0 };

  const locked = professionalPack([grainPiece], config);
  assert.equal(locked.boards.length, 0);
  assert.equal(locked.unplaced.length, 1);

  const rotatable = professionalPack([{ ...grainPiece, veta: false }], config);
  assert.equal(rotatable.unplaced.length, 0);
  assert.equal(rotatable.boards[0].rects[0].rotated, true);
});

test('kerf is reserved between adjacent pieces', () => {
  const [base] = createStarterProject().pieces;
  const pair = [{ ...base, largo: 500, ancho: 500, cantidad: 2, veta: false }];

  assert.equal(professionalPack(pair, { width: 1002, height: 500, kerf: 3, margin: 0 }).boards.length, 2);
  assert.equal(professionalPack(pair, { width: 1003, height: 500, kerf: 3, margin: 0 }).boards.length, 1);
});


test('parametric shelf module creates plinth, shelves and vertical divisions without overlaps', () => {
  const module = createShelfModule({
    name: 'Estante de prueba',
    width: 1200,
    height: 1846,
    depth: 350,
    thickness: 18,
    plinthHeight: 80,
    plinthInset: 30,
    shelves: 3,
    verticalDividers: 1,
    back: 'mdf3',
    material: 'Pelikano_Blanco_Absoluto',
  });

  assert.equal(module.columns, 2);
  assert.equal(module.levels, 4);
  assert.equal(module.pieces.length, 13);
  assert.equal(module.pieces.filter(piece => piece.name.startsWith('Repisa ')).length, 6);
  assert.equal(module.pieces.filter(piece => piece.name.startsWith('División vertical')).length, 1);
  assert.equal(module.pieces.filter(piece => piece.name === 'Zócalo frontal').length, 1);
  assert.equal(module.pieces.filter(piece => piece.name === 'Respaldo MDF 3 mm').length, 1);
  assert.ok(module.pieces.every(piece => piece.groupId === module.group.id));

  const shelves = module.pieces.filter(piece => piece.name.startsWith('Repisa '));
  const divider = module.pieces.find(piece => piece.name.startsWith('División vertical'));
  assert.ok(divider);
  assert.ok(shelves.every(piece => Math.abs(piece.position3D[0] - divider.position3D[0]) > piece.largo / 2));
});

test('parametric shelf module rejects divisions that leave unusable columns', () => {
  assert.throws(() => createShelfModule({
    name: 'Inválido',
    width: 600,
    height: 1846,
    depth: 313,
    thickness: 18,
    plinthHeight: 80,
    plinthInset: 30,
    shelves: 4,
    verticalDividers: 8,
    back: 'none',
    material: 'Pelikano_Blanco_Absoluto',
  }), /Reduce las divisiones verticales/);
});
