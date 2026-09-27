export const EARLIEST_SLOT_KEY = '20261010-15:00';

export function slotKey(slot) {
  return `${slot.date}-${slot.time.padStart(5, '0')}`;
}

export function normalizeSlots(rawSlots, earliestKey = EARLIEST_SLOT_KEY) {
  const unique = new Map();
  for (const raw of rawSlots) {
    const date = String(raw.date ?? '');
    const time = String(raw.time ?? '');
    if (!/^\d{8}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) continue;
    const [hour, minute] = time.split(':').map(Number);
    if (hour > 23 || minute > 59) continue;
    const slot = { date, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
    if (slotKey(slot) > earliestKey) unique.set(slotKey(slot), slot);
  }
  return [...unique.values()].sort((a, b) => slotKey(a).localeCompare(slotKey(b)));
}

export function newlyAvailable(previous, current) {
  const oldKeys = new Set(previous.map(slotKey));
  return current.filter(slot => !oldKeys.has(slotKey(slot)));
}

export function formatSlot(slot) {
  return `${slot.date.slice(0, 4)}-${slot.date.slice(4, 6)}-${slot.date.slice(6, 8)} ${slot.time} JST`;
}

export function telegramMessages(slots, calendarUrl) {
  const header = 'Ikegami practical lesson openings:\n';
  const footer = `\n${calendarUrl}\nCheck lesson order and eligibility before booking.`;
  const messages = [];
  let lines = [];
  for (const slot of slots) {
    const line = `• ${formatSlot(slot)}`;
    if ((header + [...lines, line].join('\n') + footer).length > 3900 && lines.length) {
      messages.push(header + lines.join('\n') + footer);
      lines = [];
    }
    lines.push(line);
  }
  if (lines.length) messages.push(header + lines.join('\n') + footer);
  return messages;
}
