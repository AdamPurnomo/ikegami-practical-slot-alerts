const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN secret.');
const identityResponse = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
  signal: AbortSignal.timeout(15000)
});
const identity = await identityResponse.json();
if (!identityResponse.ok || identity.ok !== true) throw new Error('Telegram rejected the bot token.');
console.log(`Checking @${identity.result.username}`);
const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
  signal: AbortSignal.timeout(15000)
});
const data = await response.json();
if (!response.ok || data.ok !== true) throw new Error('Telegram did not return bot updates.');
const chats = new Map();
for (const update of data.result ?? []) {
  const chat = update.message?.chat;
  if (chat?.type === 'private') chats.set(chat.id, chat.first_name ?? 'Private chat');
}
if (!chats.size) {
  console.log('No private chats yet. Open your bot in Telegram, press Start, then run this workflow again.');
} else {
  for (const [id, name] of chats) console.log(`Telegram chat ID: ${id} (${name})`);
}
