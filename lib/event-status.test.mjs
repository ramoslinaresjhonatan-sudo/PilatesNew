import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventStatus } from './event-status.ts';

const event = { estado: 'EN_CURSO', fecha_inicio: '2026-09-22T10:00:00-04:00', fecha_fin: '2026-09-22T11:00:00-04:00' };
test('a cached ongoing event finishes exactly at its end time', () => {
  assert.equal(eventStatus(event, Date.parse('2026-09-22T14:59:59Z')), 'EN_CURSO');
  assert.equal(eventStatus(event, Date.parse('2026-09-22T15:00:00Z')), 'FINALIZADA');
});
test('future and cancelled events keep their correct state', () => {
  assert.equal(eventStatus(event, Date.parse('2026-09-22T13:00:00Z')), 'PUBLICADA');
  assert.equal(eventStatus({ ...event, estado: 'CANCELADA' }, Date.parse('2026-09-23T15:00:00Z')), 'CANCELADA');
});
