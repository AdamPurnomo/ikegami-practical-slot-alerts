import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { normalizeSlots, newlyAvailable, telegramMessages } from './slots.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_PATH = resolve(ROOT, 'state/check-state.json');
const LOGIN_URL = 'https://www.e-license.jp/el32/mSg1DWxRvAI-brGQYS-1OA%3D%3D';
const ALERT_LINK_VERSION = 2;

class MonitorError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new MonitorError('configuration', `Missing ${name} secret.`);
  return value;
}

async function readState() {
  try {
    const state = JSON.parse(await readFile(STATE_PATH, 'utf8'));
    return {
      available: Array.isArray(state.available) ? state.available : [],
      error: state.error ?? null,
      alertLinkVersion: state.alertLinkVersion ?? 1
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { available: [], error: null, alertLinkVersion: 1 };
    throw new MonitorError('state', 'Unable to read monitor state.');
  }
}

async function saveState(state) {
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
}

async function sendTelegram(token, chatId, message) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new MonitorError('telegram', 'Telegram rejected the alert.');
}

async function openCalendar(page, studentId, password) {
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  if (!await page.locator('#studentId').isVisible()) {
    throw new MonitorError('login', 'The e-license login form did not load.');
  }
  await page.locator('#studentId').fill(studentId);
  await page.locator('#password').fill(password);
  await page.locator('#login').click();
  try {
    await page.waitForFunction(() => !document.querySelector('#studentId'), null, { timeout: 20000 });
  } catch {
    throw new MonitorError('login', 'e-license did not accept the sign-in.');
  }

  try {
    await page.locator('#p03AForm, a#navbarDropdown').first().waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    throw new MonitorError('login', 'The signed-in e-license page did not load.');
  }

  if (await page.locator('#p03AForm').count() === 0) {
    const reservationMenu = page.locator('a#navbarDropdown').filter({ hasText: '予約' }).first();
    if (await reservationMenu.count() === 0) throw new MonitorError('navigation', 'The reservation menu is unavailable.');
    await reservationMenu.click();
    const bookingLink = page.locator('a.dropdown-item[data-action="/el32/pc/reserv/p03/p03a/nav"][data-kamoku="0"]');
    if (await bookingLink.count() === 0) throw new MonitorError('navigation', 'The practical booking link is unavailable.');
    await bookingLink.click();
  }
  try {
    await page.locator('#p03AForm').waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    throw new MonitorError('navigation', 'The practical booking calendar did not load.');
  }
}

async function collectSlots(page) {
  const raw = [];
  const visitedHeadings = new Set();
  for (let week = 0; week < 8; week++) {
    const heading = (await page.locator('#ginou-title').innerText()).trim();
    if (visitedHeadings.has(heading)) break;
    visitedHeadings.add(heading);
    raw.push(...await page.locator('td.status1 a.simei[data-yoyaku][data-time]').evaluateAll(elements =>
      elements.map(element => ({ date: element.dataset.yoyaku, time: element.dataset.time }))
    ));
    const next = page.getByRole('button', { name: /次週へ/ }).first();
    if (await next.count() === 0 || !await next.isEnabled()) break;
    await next.click();
    try {
      await page.waitForFunction(previous =>
        document.querySelector('#ginou-title')?.textContent?.trim() !== previous,
      heading, { timeout: 15000 });
    } catch {
      throw new MonitorError('navigation', 'The calendar did not advance to the next week.');
    }
  }
  if (!visitedHeadings.size) throw new MonitorError('calendar', 'No calendar weeks were visible.');
  return normalizeSlots(raw);
}

async function main() {
  const studentId = required('ELICENSE_STUDENT_ID');
  const password = required('ELICENSE_PASSWORD');
  const botToken = required('TELEGRAM_BOT_TOKEN');
  const chatId = required('TELEGRAM_CHAT_ID');
  const previous = await readState();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
    await openCalendar(page, studentId, password);
    const available = await collectSlots(page);
    const fresh = previous.alertLinkVersion < ALERT_LINK_VERSION
      ? available
      : newlyAvailable(previous.available, available);
    for (const message of telegramMessages(fresh, LOGIN_URL)) {
      await sendTelegram(botToken, chatId, message);
    }
    await saveState({ available, error: null, alertLinkVersion: ALERT_LINK_VERSION });
    console.log(`Checked ${available.length} available slots; reported ${fresh.length} new slots.`);
  } catch (error) {
    const code = error instanceof MonitorError ? error.code : 'unexpected';
    const message = error instanceof MonitorError ? error.message : 'The checker failed unexpectedly.';
    if (previous.error !== code && code !== 'telegram') {
      try {
        await sendTelegram(botToken, chatId, `Ikegami checker needs attention: ${message}`);
      } catch {
        console.error('Unable to deliver the checker error alert.');
      }
    }
    await saveState({ ...previous, error: code });
    console.error(`Monitor failed: ${code}.`);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
}

await main();
