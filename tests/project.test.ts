import assert from 'node:assert/strict';
import test from 'node:test';
import { createStarterProject, serializePiecesCsv, sheetGroupKey } from '../src/lib/project';
import { professionalPack } from '../src/lib/cutOptimizer';

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
