// Starts a throwaway Gjeng server, fills it with a made-up conversation between four
// people, and saves screenshots to captures/. Run "npm run build" first.
//
//   node scripts/screenshots.mjs
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3200;
const URL = `http://localhost:${PORT}`;
const OUT = path.resolve('captures');
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

fs.mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), DATA_FILE: path.join(os.tmpdir(), `gjeng-shots-${Date.now()}.json`) },
  stdio: 'inherit',
});

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Server did not start');
}

const browser = await chromium.launch();
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

async function person(name, colour, { screenshotJoin = false } = {}) {
  const context = await browser.newContext({ viewport: DESKTOP });
  const page = await context.newPage();
  await page.goto(URL);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: `Colour ${colour}`, exact: true }).click();
  if (screenshotJoin) await shot(page, '1-join');
  await page.getByRole('button', { name: 'Start chatting' }).click();
  await page.getByRole('heading', { name: 'Your groups' }).waitFor();
  return page;
}

const composer = (page) => page.getByRole('textbox', { name: /^Message/ });

async function say(page, text) {
  await composer(page).fill(text);
  await composer(page).press('Enter');
  await page.getByRole('log').getByText(text, { exact: true }).last().waitFor();
}

async function create(page, name) {
  await page.getByRole('button', { name: 'New group' }).first().click();
  await page.getByLabel('Group name').fill(name);
  await page.getByRole('button', { name: 'Create group' }).click();
  await page.getByRole('heading', { level: 1, name }).waitFor();
  return (await page.getByTestId('invite-code').textContent()).trim();
}

async function join(page, code) {
  await page.getByRole('button', { name: 'Join with code' }).first().click();
  await page.getByLabel('Invite code').fill(code);
  await page.getByRole('button', { name: 'Join group' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
}

async function open(page, groupName) {
  await page.getByRole('navigation', { name: 'Your groups' }).getByRole('button', { name: groupName }).click();
  await page.getByRole('heading', { level: 1, name: groupName }).waitFor();
}

async function react(page, text, emoji) {
  const message = page.getByRole('log').locator('.message', { hasText: text });
  await message.locator('.bubble').hover();
  await message.getByRole('button', { name: `React with ${emoji}` }).click();
}

try {
  await waitForServer();

  const emma = await person('Emma', 1, { screenshotJoin: true });
  const jonas = await person('Jonas', 5);
  const sara = await person('Sara', 3);
  const ola = await person('Ola', 7);

  const flatCode = await create(emma, 'Kollektiv 🏠');
  await join(ola, flatCode);
  const studyCode = await create(emma, 'Exam study group');
  await join(sara, studyCode);
  const gymCode = await create(emma, 'Gym crew');
  for (const p of [jonas, sara, ola]) await join(p, gymCode);
  for (const p of [jonas, sara, ola]) await open(p, 'Gym crew');

  await say(jonas, 'Leg day tomorrow? 💪');
  await say(sara, "I'm in! 7am before lectures?");
  await say(emma, '7am is brutal 😅 can we do 4pm instead?');
  await say(ola, '4pm works for me');
  await say(jonas, 'Fine, 4pm. Last one there buys protein bars');
  await say(sara, 'Also… new deadlift PR today: 100 kg!! 🎉');
  await say(sara, 'Took me all semester');

  await react(emma, 'new deadlift PR', '🔥');
  await react(jonas, 'new deadlift PR', '🔥');
  await react(ola, 'new deadlift PR', '❤️');
  await react(emma, 'buys protein bars', '😂');
  await react(sara, 'buys protein bars', '😂');

  await open(sara, 'Exam study group');
  await say(sara, 'Library at 10 on Monday?');
  await say(sara, 'I booked room 4');
  await open(ola, 'Kollektiv 🏠');
  await say(ola, 'Who finished the milk again?? 🥛');

  // Emma sees the chat while Jonas is typing.
  await emma.bringToFront(); // background tabs pause animations
  await emma.mouse.move(5, 5);
  await composer(jonas).fill('See you there');
  await emma.getByText('Jonas is typing…').waitFor();
  await emma.waitForTimeout(300);
  await shot(emma, '2-chat');

  await emma.getByRole('button', { name: 'Members', exact: true }).click();
  await shot(emma, '3-members');
  await emma.getByRole('button', { name: 'Members', exact: true }).click();

  await emma.getByRole('button', { name: 'Join with code' }).first().click();
  await emma.getByLabel('Invite code').fill('K7P2');
  await emma.waitForTimeout(300); // let the pop-in animation finish
  await shot(emma, '4-join-modal');
  await emma.keyboard.press('Escape');

  await emma.emulateMedia({ colorScheme: 'dark' });
  await emma.waitForTimeout(300); // let colour transitions finish
  await shot(emma, '5-dark');
  await emma.emulateMedia({ colorScheme: 'light' });

  await emma.setViewportSize(PHONE);
  await shot(emma, '6-phone-chat');
  await emma.getByRole('button', { name: 'Back to groups' }).click();
  await shot(emma, '7-phone-list');

  console.log(`Screenshots saved to ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}
