import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classStatus } from './class-status.ts';

const first = { fecha_inicio: '2026-09-22T07:15:00-04:00', fecha_fin: '2026-09-22T08:15:00-04:00', cupos_disponibles: 1 };
const second = { ...first, fecha_inicio: '2026-09-22T08:30:00-04:00', fecha_fin: '2026-09-22T09:30:00-04:00' };
test('at 08:35 the first class is finished and the second is ongoing', () => {
  const now = Date.parse('2026-09-22T12:35:00Z');
  assert.equal(classStatus(first, now).code, 'FIN');
  assert.equal(classStatus(second, now).code, 'ONGOING');
});
test('changes at the exact start and end and prevents booking once started', () => {
  assert.equal(classStatus(second, Date.parse(second.fecha_inicio) - 1).code, 'OPEN');
  assert.equal(classStatus(second, Date.parse(second.fecha_inicio)).code, 'ONGOING');
  assert.equal(classStatus(second, Date.parse(second.fecha_inicio)).disabled, true);
  assert.equal(classStatus(second, Date.parse(second.fecha_fin) - 1).code, 'ONGOING');
  assert.equal(classStatus(second, Date.parse(second.fecha_fin)).code, 'FIN');
});
test('time status takes precedence over capacity', () => {
  const full = { ...second, cupos_disponibles: 0 };
  assert.equal(classStatus(full, Date.parse(second.fecha_inicio) - 1).code, 'FULL');
  assert.equal(classStatus(full, Date.parse(second.fecha_inicio)).code, 'ONGOING');
  assert.equal(classStatus(full, Date.parse(second.fecha_fin)).code, 'FIN');
});
