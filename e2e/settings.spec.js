import { expect, test } from '@playwright/test';

// Settings (profile, privacy, appearance, accessibility), profile cards, search, GIFs and the narrow sidebar.

const unique = (base) => `${base}_${Math.random().toString(36).slice(2, 6)}`;

async function newPerson(browser, base, { accessibility = false } = {}) {
  const name = unique(base);
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Username').fill(name);
  await expect(page.getByText('✓ Available')).toBeVisible();
  if (accessibility) await page.getByLabel(/Turn on accessibility mode/).check();
  await page.getByRole('button', { name: 'Start chatting' }).click();
  await expect(page.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible();
  page.name = name;
  return page;
}

async function createGroup(page, name) {
  await page.getByRole('button', { name: 'New group' }).first().click();
  await page.getByLabel('Group name').fill(name);
  await page.getByRole('button', { name: 'Create group' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.locator('.chat-header').getByRole('button', { name: 'Show invite code' }).click();
  return (await page.getByTestId('invite-code').textContent()).trim();
}

async function joinGroup(page, code, groupName) {
  await page.getByRole('button', { name: 'Join with code' }).first().click();
  await page.getByLabel('Invite code').fill(code);
  await page.getByRole('button', { name: 'Join group' }).click();
  await expect(page.getByRole('heading', { level: 1, name: groupName })).toBeVisible();
}

async function twoInAGroup(browser, groupName) {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');
  await joinGroup(bo, await createGroup(ada, groupName), groupName);
  return { ada, bo };
}

const friendsButton = (page) => page.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /^Friends/ });

async function becomeFriends(asker, accepter) {
  await friendsButton(asker).click();
  await asker.getByLabel('Username to add').fill(accepter.name);
  await asker.getByRole('button', { name: 'Send request' }).click();
  await friendsButton(accepter).click();
  await accepter.getByRole('region', { name: 'Friend requests' }).getByRole('button', { name: 'Accept' }).click();
  await expect(accepter.getByRole('heading', { level: 1, name: asker.name })).toBeVisible();
}

async function openSettings(page, tab) {
  await page.getByRole('button', { name: 'Profile settings' }).click();
  if (tab) await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: tab }).click();
}

const composer = (page) => page.getByRole('textbox', { name: /^Message/ });
const messages = (page) => page.getByRole('log', { name: 'Messages' });
const members = (page) => page.getByRole('complementary', { name: 'Members' });

async function say(page, text) {
  await composer(page).fill(text);
  await composer(page).press('Enter');
  await expect(messages(page).getByText(text)).toBeVisible();
}

test('your profile: built-in picture, about me and banner show on your card for others', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Book club');

  await openSettings(ada);
  await ada.getByRole('radio', { name: 'Built-in picture: fox' }).click();
  await ada.getByLabel('About me').fill('Reads too many books 📚');
  await ada.getByRole('button', { name: 'Banner colour 4' }).click();
  await ada.getByRole('button', { name: 'Save changes' }).click();
  await expect(ada.getByText('Saved ✓')).toBeVisible();
  await ada.keyboard.press('Escape');

  // Bo clicks Ada's picture in the member list.
  await members(bo).getByRole('button', { name: ada.name, exact: true }).click();
  const card = bo.getByRole('dialog', { name: ada.name });
  await expect(card).toContainText(`@${ada.name}`);
  await expect(card).toContainText('Reads too many books 📚');
  await expect(card.locator('.profile-card-avatar img')).toHaveAttribute('src', /^data:image\/svg/);
  await expect(card.getByRole('region', { name: 'Shared groups' })).toContainText('Book club');
  await expect(card.getByRole('button', { name: 'Add friend' })).toBeVisible();
});

test('profile cards open from messages and show mutual friends, unless privacy hides them', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Climbing');
  const cy = await newPerson(browser, 'Cy');
  await becomeFriends(ada, cy);
  await becomeFriends(bo, cy);
  // Making friends opened their new DMs, so go back to the group.
  for (const page of [ada, bo]) await page.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /Climbing/ }).click();

  await say(bo, 'Who is coming?');
  await messages(ada).getByRole('button', { name: `Open ${bo.name}'s profile` }).click();
  const card = ada.getByRole('dialog', { name: bo.name });
  await expect(card.getByRole('region', { name: 'Mutual friends' })).toContainText(cy.name);
  await ada.getByRole('button', { name: 'Close profile' }).click();

  await openSettings(bo, 'Privacy');
  await bo.getByRole('radio', { name: /No one Nobody sees your friends/ }).check();
  await expect(bo.getByText('Saved ✓')).toBeVisible();

  await messages(ada).getByRole('button', { name: `Open ${bo.name}'s profile` }).click();
  await expect(ada.getByRole('dialog', { name: bo.name }).getByText(`Hidden by ${bo.name}'s privacy settings.`)).toBeVisible();
});

test('privacy: refuse friend requests, and look offline', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Quiet');

  await openSettings(bo, 'Privacy');
  await bo.getByRole('radio', { name: /No one Nobody can send you requests/ }).check();
  await bo.getByRole('switch', { name: /Show others when I'm online/ }).uncheck();
  await expect(bo.getByText('Saved ✓')).toBeVisible();
  await bo.keyboard.press('Escape');

  await friendsButton(ada).click();
  await ada.getByLabel('Username to add').fill(bo.name);
  await ada.getByRole('button', { name: 'Send request' }).click();
  await expect(ada.getByRole('alert')).toHaveText(`${bo.name} isn't accepting friend requests.`);

  await ada.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /Quiet/ }).click();
  await expect(members(ada).getByRole('region', { name: 'Offline members' })).toContainText(bo.name);
  // Bo still sees himself as online.
  await expect(bo.locator('.me-status')).toHaveText('Online');
});

test('appearance: themes, and text stays readable whatever colour you pick', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  await openSettings(ada, 'Appearance');

  await ada.getByRole('radio', { name: 'Retro dark' }).click();
  await expect(ada.locator('html')).toHaveAttribute('data-font', 'retro');
  const bg = await ada.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  expect(bg).toMatch(/^#0/); // a very dark background

  // Pick a mid red as the text colour: too dark on this background, so it gets lifted.
  const wheel = ada.getByRole('slider', { name: 'Text' });
  const box = await wheel.boundingBox();
  await wheel.click({ position: { x: box.width / 2, y: box.height / 2 - box.height * 0.3 } });
  await expect(ada.locator('.adjusted-note')).toContainText('so it stays readable');

  const ratio = await ada.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.trim().slice(i, i + 2), 16) / 255);
      const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const [a, b] = [lum(style.getPropertyValue('--text')), lum(style.getPropertyValue('--bg'))].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);

  // Saved on this device.
  await ada.reload();
  await expect(ada.locator('html')).toHaveAttribute('data-font', 'retro');
});

test('accessibility: text size, accessibility mode, and the option on sign-up', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  await openSettings(ada, 'Accessibility');

  await ada.getByRole('slider', { name: 'Text size' }).fill('1.3');
  await expect(ada.locator('.text-size-value')).toHaveText('130%');
  const size = await ada.evaluate(() => getComputedStyle(document.body).fontSize);
  expect(size).toBe('19.5px'); // 15px × 1.3

  await ada.getByRole('button', { name: 'Turn on' }).click();
  const html = ada.locator('html');
  await expect(html).toHaveClass(/reduce-motion/);
  await expect(html).toHaveClass(/status-symbols/);
  await expect(html).toHaveClass(/strong-focus/);
  await expect(html).toHaveAttribute('data-contrast', 'high');

  // The same thing straight from sign-up.
  const bo = await newPerson(browser, 'Bo', { accessibility: true });
  await expect(bo.locator('html')).toHaveClass(/readable-text/);
  await expect(bo.locator('html')).toHaveAttribute('data-contrast', 'high');
});

test('searching messages by words, person and type, then jumping to one', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Planning');
  await say(ada, 'Leg day tomorrow at 4');
  await say(bo, 'Pizza tonight?');
  await say(ada, 'Pizza sounds great, see https://example.com/menu');
  await ada.getByLabel('Choose a file to attach').setInputFiles({ name: 'plan.txt', mimeType: 'text/plain', buffer: Buffer.from('plan') });
  await ada.getByRole('button', { name: 'Send' }).click();

  await ada.getByRole('button', { name: 'Search messages' }).click();
  const search = ada.getByRole('complementary', { name: 'Search messages' });
  await search.getByLabel('Search for words').fill('pizza');
  await expect(search.getByRole('status')).toHaveText('2 messages found');
  await expect(search.locator('mark').first()).toHaveText(/pizza/i);

  await search.getByLabel('From').selectOption({ label: bo.name });
  await expect(search.getByRole('status')).toHaveText('1 message found');

  await search.getByLabel('Search for words').fill('');
  await search.getByLabel('From').selectOption({ label: 'Anyone' });
  await search.getByLabel('Type').selectOption('files');
  await expect(search.getByRole('status')).toHaveText('1 message found');
  await search.getByLabel('Type').selectOption('links');
  await expect(search.getByRole('status')).toHaveText('1 message found');

  await search.getByRole('button', { name: /Pizza sounds great/ }).click();
  await expect(messages(ada).locator('.message.flash')).toContainText('Pizza sounds great');
});

test('GIFs: send a sticker, favourite it and search', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Fun');
  await ada.getByRole('button', { name: 'Add an emoji or GIF' }).click();
  await ada.getByRole('tab', { name: 'GIFs' }).click();

  const gg = ada.getByRole('button', { name: 'Send GG GIF' });
  await expect(gg.locator('img')).toHaveAttribute('src', /^data:image\/gif;base64,R0lG/); // a real GIF file
  await ada.getByRole('button', { name: 'Add GG to favourites' }).click();
  await gg.click();

  await expect(messages(bo).getByRole('button', { name: 'Open picture gg.gif' })).toBeVisible();

  await ada.getByRole('button', { name: 'Add an emoji or GIF' }).click();
  await ada.getByRole('tab', { name: 'GIFs' }).click();
  await ada.getByRole('tab', { name: 'Favourites' }).click();
  await expect(ada.getByRole('button', { name: 'Send GG GIF' })).toBeVisible();
  await ada.getByRole('tab', { name: 'Recent' }).click();
  await expect(ada.getByRole('button', { name: 'Send gg.gif GIF' })).toBeVisible();
  await ada.getByRole('tab', { name: 'Stickers' }).click();
  await ada.getByLabel('Search GIFs').fill('gym');
  await expect(ada.getByRole('list', { name: 'Stickers' }).getByRole('listitem')).toHaveCount(1);
  await expect(ada.getByRole('button', { name: 'Send Leg day GIF' })).toBeVisible();
});

test('the sidebar buttons shrink to icons when the sidebar is narrow', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const label = ada.locator('.sidebar-actions .button-label').last();
  await expect(label).toBeVisible();

  await ada.getByRole('separator', { name: 'Resize the chat list' }).focus();
  for (let i = 0; i < 4; i++) await ada.keyboard.press('Shift+ArrowLeft');
  await expect(label).toBeHidden();
  await expect(ada.locator('.sidebar').getByRole('button', { name: 'Join with code' })).toBeVisible();
});
