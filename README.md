# Ikegami practical lesson slot alerts

This checker runs in GitHub Actions, signs in to Ikegami's e-license reservation system, reads green **AT on-site practical** cells, and sends newly open times to your Telegram bot. It never selects a slot, books, cancels, or changes a reservation.

Alerts link to Ikegami's e-license login page. After signing in, open **予約 → 技能予約** to see the reported slots.

It reports every green slot later than the already booked simulator lesson on **2026-10-10 at 15:00 JST**. The e-license site still decides whether you can book a particular slot; a green cell alone does not guarantee eligibility. The script records only the currently open dates and times in `state/check-state.json`, so an unchanged slot is not sent repeatedly. A slot that disappears and later reappears is sent again.

## Before deploying

The e-license login page warns that using the system in multiple browsers is unsupported. Each hosted check signs in through a fresh browser and closes it afterward. This may sign you out of your own Chrome session or otherwise interfere with it. Run one manual check first and see whether your normal session still works. If this is disruptive, disable the GitHub workflow and use the original local checker or ask the school whether a read-only integration is available.

GitHub's scheduled workflows can start late or occasionally be dropped under load. This is an alert for observed openings, not a guarantee of immediate notice or a reservation.

## Set up

1. Create a **private** GitHub repository that you control, and put the contents of this folder at its root. Enable GitHub Actions for the repository. Do not put credentials in files or commit browser cookies.
2. In Telegram, create a bot using [@BotFather](https://t.me/BotFather). Keep its token private. Open the new bot's chat and press **Start**.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions** and add these repository secrets:

   | Secret | Value |
   | --- | --- |
   | `ELICENSE_STUDENT_ID` | Your e-license student number |
   | `ELICENSE_PASSWORD` | Your e-license password |
   | `TELEGRAM_BOT_TOKEN` | Token from BotFather |

4. Open **Actions → Find Telegram chat ID → Run workflow**. In that run's log, copy your private chat ID. Add it as a fourth repository secret named `TELEGRAM_CHAT_ID`. If the log says there are no private chats, send `/start` to your bot and rerun it.
5. Open **Actions → Check Ikegami practical slots → Run workflow** once. The first successful run will send all currently visible green slots after the simulator. Check that the Telegram message arrived and that your e-license Chrome session still works.
6. Leave the workflow enabled. It is scheduled for **08:17, 10:17, 12:17, 14:17, 16:17, 18:17, 20:17, 22:17, and 23:17 JST**. GitHub runs the times in UTC; Japan has no daylight saving time. Use **Actions → Check Ikegami practical slots → Disable workflow** to stop it.

GitHub stores the four credentials as encrypted Actions secrets. The workflow gives its GitHub token permission only to update the slot-state file. Do not post your password or bot token in a chat, issue, commit, or workflow log. If you later change the e-license password or rotate the Telegram token, update the matching repository secret.

## Local checks

With Node.js 24 installed, run `npm install` and `npm test`. `npm run check` requires all four secrets as environment variables and signs in to the live site; it will send Telegram alerts. The tests do not sign in or send messages.

## Source behavior

The checker uses the site's displayed **技能予約** calendar and reads green `status1` practical cells. Numbers printed inside cells are concurrent theory lesson numbers. It advances through all visible weeks using the site's **次週へ** button. The first simulator lesson is already booked and is excluded.
