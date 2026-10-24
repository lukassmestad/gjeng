// Starts Gjeng in demo mode on a spare port, jumps in as the demo people,
// and saves screenshots to captures/. Run "npm run build" first.
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

const server = spawn(process.execPath, ['server/index.js', '--demo'], {
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
const shot = async (page, name) => {
  await page.bringToFront(); // background tabs pause animations
  await page.waitForTimeout(300); // let fades and pop-ins finish
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

async function jumpInAs(name, page) {
  page ??= await (await browser.newContext({ viewport: DESKTOP })).newPage();
  await page.goto(URL);
  await page.getByRole('button', { name: `Jump in as ${name}` }).click();
  await page.getByRole('heading', { name: 'Groups', exact: true }).waitFor();
  return page;
}

async function open(page, chatName) {
  await page.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: chatName }).first().click();
  await page.getByRole('heading', { level: 1, name: chatName }).waitFor();
}

const composer = (page) => page.getByRole('textbox', { name: /^Message/ });

try {
  await waitForServer();

  // The join screen, with a name typed in and the demo people below.
  const emmaPage = await (await browser.newContext({ viewport: DESKTOP })).newPage();
  await emmaPage.goto(URL);
  await emmaPage.getByLabel('Username').fill('Frederik');
  await emmaPage.getByText('✓ Available').waitFor();
  await shot(emmaPage, '1-join');

  const emma = await jumpInAs('Emma', emmaPage);
  const jonas = await jumpInAs('Jonas');

  // Emma sees Gym crew while Jonas is typing.
  await open(jonas, 'Gym crew');
  await open(emma, 'Gym crew');
  await emma.mouse.move(5, 5);
  await composer(jonas).fill('See you at 4!');
  await emma.getByText('Jonas is typing…').waitFor();
  await shot(emma, '2-chat');

  await emma.emulateMedia({ colorScheme: 'dark' });
  await shot(emma, '5-dark');
  await emma.emulateMedia({ colorScheme: 'light' });

  await open(emma, 'Kollektiv 🏠');
  await emma.getByRole('button', { name: 'Add friends' }).click();
  await shot(emma, '3-add-friends');
  await emma.keyboard.press('Escape');

  await open(emma, 'Exam study group');
  await shot(emma, '10-big-group');

  await emma.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /^Friends/ }).click();
  await emma.getByRole('heading', { level: 1, name: 'Friends' }).waitFor();
  await shot(emma, '8-friends');

  await open(emma, 'Jonas');
  await shot(emma, '9-dm');

  await open(emma, 'Gym crew');
  await emma.setViewportSize(PHONE);
  await shot(emma, '6-phone-chat');
  await emma.getByRole('button', { name: 'Back to chats' }).click();
  await shot(emma, '7-phone-list');

  console.log(`Screenshots saved to ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}
