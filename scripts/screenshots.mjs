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

// A fake microphone that beeps, so the call screenshots show someone talking.
const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const newPage = async () => (await browser.newContext({ viewport: DESKTOP, permissions: ['microphone'] })).newPage();
const shot = async (page, name) => {
  await page.bringToFront(); // background tabs pause animations
  await page.waitForTimeout(300); // let fades and pop-ins finish
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

async function jumpInAs(name, page) {
  page ??= await newPage();
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
  const emmaPage = await newPage();
  await emmaPage.goto(URL);
  await emmaPage.getByLabel('Username').fill('Frederik');
  await emmaPage.getByText('✓ Available').waitFor();
  await emmaPage.getByLabel('Password', { exact: true }).fill('my secret password');
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
  await emma.setViewportSize(DESKTOP);

  // A call in Gym crew: Jonas starts it and talks, Sara joins muted, Emma joins.
  const sara = await jumpInAs('Sara');
  await open(jonas, 'Gym crew');
  await jonas.getByRole('button', { name: 'Start call' }).click();
  await open(sara, 'Gym crew');
  await sara.getByRole('region', { name: 'Call' }).getByRole('button', { name: 'Join call' }).click();
  await sara.getByRole('region', { name: 'Call' }).getByRole('button', { name: 'Mute', exact: true }).click();
  await open(emma, 'Gym crew');
  await emma.getByRole('region', { name: 'Call' }).getByRole('button', { name: 'Join call' }).click();
  await emma.getByRole('region', { name: 'Call' }).getByRole('button', { name: 'Mute', exact: true }).click();
  await emma.getByRole('region', { name: 'Call' }).getByRole('listitem', { name: /^Jonas.*talking/ }).waitFor({ timeout: 15000 });
  await shot(emma, '11-call');

  // Your corner: status menu and profile.
  await emma.getByRole('button', { name: /Change status/ }).click();
  await shot(emma, '12-status');
  await emma.keyboard.press('Escape');
  await emma.getByRole('button', { name: 'Profile settings' }).click();
  await emma.getByLabel('Display name').fill('Emma 💪');
  await shot(emma, '13-profile');
  await emma.getByRole('button', { name: 'Close settings' }).click();

  // A picture and a file in a DM, plus the emoji picker.
  const picture = await emma.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 800, 500);
    gradient.addColorStop(0, '#ffb37a');
    gradient.addColorStop(1, '#ae3ec9');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 800, 500);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 96px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('100 kg 🎉', 400, 230);
    ctx.font = '40px system-ui';
    ctx.fillText('New deadlift PR', 400, 320);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await open(emma, 'Sara');
  await emma.getByLabel('Choose a file to attach').setInputFiles({ name: 'pr.png', mimeType: 'image/png', buffer: Buffer.from(picture, 'base64') });
  await composer(emma).fill('Framed it for you 😄');
  await composer(emma).press('Enter');
  await emma.getByLabel('Choose a file to attach').setInputFiles({
    name: 'training-plan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 made-up training plan'),
  });
  await emma.getByRole('button', { name: 'Send' }).click();
  await emma.getByRole('link', { name: /training-plan\.pdf/ }).waitFor();
  await emma.getByRole('button', { name: 'Add an emoji' }).click();
  await shot(emma, '14-attachments');
  await emma.keyboard.press('Escape');

  // Profile card: Emma clicks Sara in the Gym crew member list (after leaving the call).
  await open(emma, 'Gym crew');
  await emma.getByRole('region', { name: 'Call' }).getByRole('button', { name: 'Leave call' }).click();
  await emma.getByRole('complementary', { name: 'Members' }).getByRole('button', { name: 'Sara ✨', exact: true }).click();
  await emma.getByRole('dialog', { name: 'Sara ✨' }).getByRole('region', { name: 'Mutual friends' }).waitFor();
  await shot(emma, '15-profile-card');
  await emma.getByRole('button', { name: 'Close profile' }).click();

  // Settings, tab by tab.
  await emma.getByRole('button', { name: 'Profile settings' }).click();
  await shot(emma, '16-settings-profile');
  const tab = (name) => emma.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name }).click();
  await tab('Account');
  await shot(emma, '23-settings-account');
  await tab('Privacy');
  await shot(emma, '17-settings-privacy');
  await tab('Appearance');
  await emma.getByRole('radio', { name: 'Midnight' }).click();
  await shot(emma, '18-settings-appearance');
  await tab('Accessibility');
  await shot(emma, '19-settings-accessibility');
  await tab('Appearance');
  await emma.getByRole('radio', { name: 'Match my device' }).click();
  await emma.getByRole('button', { name: 'Close settings' }).click();

  // Search in Gym crew.
  await emma.getByRole('button', { name: 'Search messages' }).click();
  await emma.getByLabel('Search for words').fill('pizza');
  await emma.getByRole('complementary', { name: 'Search messages' }).getByRole('status').waitFor();
  await shot(emma, '20-search');
  await emma.getByRole('button', { name: 'Close search' }).click();

  // The GIF tab.
  await emma.getByRole('button', { name: 'Add an emoji or GIF' }).click();
  await emma.getByRole('tab', { name: 'GIFs' }).click();
  await emma.locator('.gif-send img').nth(8).waitFor();
  await shot(emma, '21-gifs');
  await emma.keyboard.press('Escape');

  // A different theme, and the sidebar dragged narrow.
  await emma.getByRole('button', { name: 'Profile settings' }).click();
  await tab('Appearance');
  await emma.getByRole('radio', { name: 'Retro dark' }).click();
  await emma.getByRole('button', { name: 'Close settings' }).click();
  await emma.getByRole('separator', { name: 'Resize the chat list' }).focus();
  for (let i = 0; i < 4; i++) await emma.keyboard.press('Shift+ArrowLeft');
  await emma.mouse.move(700, 400);
  await shot(emma, '22-retro-dark-narrow');

  // Accessibility mode, on a fresh start screen and in a chat.
  const a11y = await newPage();
  await a11y.goto(URL);
  await a11y.getByLabel(/Turn on accessibility mode/).check();
  await shot(a11y, '24-accessibility-join');
  await jumpInAs('Ola', a11y);
  await open(a11y, 'Gym crew');
  await shot(a11y, '25-accessibility-chat');

  console.log(`Screenshots saved to ${OUT}`);
} finally {
  await browser.close();
  server.kill();
}
