import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlots, newlyAvailable, telegramMessages } from '../src/slots.mjs';

test('keeps only valid slots after the simulator and removes duplicates', () => {
  assert.deepEqual(normalizeSlots([
    { date: '20261010', time: '15:00' },
    { date: '20261010', time: '16:00' },
    { date: '20261027', time: '9:00' },
    { date: '20261027', time: '09:00' },
    { date: 'oops', time: '10:00' }
  ]), [
    { date: '20261010', time: '16:00' },
    { date: '20261027', time: '09:00' }
  ]);
});

test('reports newly appearing and reappearing slots without repeating unchanged ones', () => {
  const monday = { date: '20261026', time: '15:00' };
  const tuesday = { date: '20261027', time: '09:00' };
  assert.deepEqual(newlyAvailable([], [monday]), [monday]);
  assert.deepEqual(newlyAvailable([monday], [monday, tuesday]), [tuesday]);
  assert.deepEqual(newlyAvailable([monday, tuesday], [monday, tuesday]), []);
  assert.deepEqual(newlyAvailable([], [monday]), [monday]);
});

test('alerts include a login link and no account details', () => {
  const messages = telegramMessages([{ date: '20261026', time: '15:00' }], 'https://example.test/login');
  assert.equal(messages.length, 1);
  assert.match(messages[0], /2026-10-26 15:00 JST/);
  assert.match(messages[0], /Log in here: https:\/\/example\.test\/login/);
});
