import { expect, test } from '@playwright/test';

// Calls, profiles, status, attachments, emoji and hidden invite codes.

const unique = (base) => `${base}_${Math.random().toString(36).slice(2, 6)}`;
// A tiny red PNG, for uploading pictures.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function newPerson(browser, base) {
  const name = unique(base);
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Username').fill(name);
  await expect(page.getByText('✓ Available')).toBeVisible();
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

async function becomeFriends(asker, accepter) {
  await asker.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /^Friends/ }).click();
  await asker.getByLabel('Username to add').fill(accepter.name);
  await asker.getByRole('button', { name: 'Send request' }).click();
  await accepter.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /^Friends/ }).click();
  await accepter.getByRole('region', { name: 'Friend requests' }).getByRole('button', { name: 'Accept' }).click();
  await expect(accepter.getByRole('heading', { level: 1, name: asker.name })).toBeVisible();
}

const composer = (page) => page.getByRole('textbox', { name: /^Message/ });
const messages = (page) => page.getByRole('log', { name: 'Messages' });
const stage = (page) => page.getByRole('region', { name: 'Call' });
const bubble = (page, name) => stage(page).getByRole('listitem', { name: new RegExp(`^${name}`) });

test('invite codes stay hidden until you show them', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  await ada.getByRole('button', { name: 'New group' }).first().click();
  await ada.getByLabel('Group name').fill('Secret club');
  await ada.getByRole('button', { name: 'Create group' }).click();

  const header = ada.locator('.chat-header');
  await expect(header.getByLabel('Hidden invite code')).toHaveText('••••••');
  await expect(ada.getByTestId('invite-code')).toHaveCount(0);

  await header.getByRole('button', { name: 'Show invite code' }).click();
  await expect(header.getByTestId('invite-code')).toHaveText(/^[A-Z0-9]{6}$/);
  await header.getByRole('button', { name: 'Hide invite code' }).click();
  await expect(header.getByLabel('Hidden invite code')).toBeVisible();
});

test('a group voice call: join, hear each other, mute and leave', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Gym crew');

  // Ada starts the call alone and waits.
  await ada.getByRole('button', { name: 'Start call' }).click();
  await expect(stage(ada).getByText('Waiting for others to join…')).toBeVisible();
  await expect(bubble(ada, ada.name)).toBeVisible();
  await expect(messages(ada).getByText(`${ada.name} started a call`)).toBeVisible();

  // Bo sees the call going on, in the chat and in the sidebar, and joins.
  await expect(bo.getByLabel('1 in a call')).toBeVisible();
  await stage(bo).getByRole('button', { name: 'Join call' }).click();
  await expect(stage(bo).getByText('Voice connected')).toBeVisible();
  await expect(stage(ada).getByRole('listitem')).toHaveCount(2);

  // Ada's (fake, beeping) microphone reaches Bo: her bubble lights up as talking on his screen.
  await expect(bubble(bo, ada.name)).toHaveAccessibleName(/talking/, { timeout: 15_000 });

  // Muting darkens Ada's picture and shows the mute icon for Bo.
  await stage(ada).getByRole('button', { name: 'Mute', exact: true }).click();
  await expect(bubble(bo, ada.name)).toHaveAccessibleName(/muted/);
  await expect(bubble(bo, ada.name)).toHaveClass(/muted/);

  // Bo's bottom-left corner shows he's connected.
  await expect(bo.getByText('Voice connected').first()).toBeVisible();

  await stage(bo).getByRole('button', { name: 'Leave call' }).click();
  await expect(stage(ada).getByText('Waiting for others to join…')).toBeVisible();
  await stage(ada).getByRole('button', { name: 'Leave call' }).click();
  await expect(stage(ada)).toBeHidden();
  await expect(messages(bo).getByText(/^Call ended after/)).toBeVisible();
});

test('calling a friend in a DM rings on their screen', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');
  await becomeFriends(bo, ada);
  await createGroup(bo, 'Elsewhere'); // Bo is busy in another chat

  await ada.getByRole('button', { name: 'Start call' }).click();
  const ring = bo.getByRole('alertdialog', { name: `${ada.name} is calling` });
  await expect(ring).toBeVisible();
  await ring.getByRole('button', { name: 'Answer call' }).click();

  await expect(bo.getByRole('heading', { level: 1, name: ada.name })).toBeVisible();
  await expect(stage(bo).getByText('Voice connected')).toBeVisible();
  await expect(stage(ada).getByRole('listitem')).toHaveCount(2);
});

test('display name, picture and colour show up for others', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Book club');
  await composer(ada).fill('Hi!');
  await composer(ada).press('Enter');
  await expect(messages(bo).getByText('Hi!')).toBeVisible();

  await ada.getByRole('button', { name: 'Profile settings' }).click();
  await ada.getByLabel('Display name').fill('Ada Lovelace 💻');
  await ada.getByLabel('Choose a profile picture').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
  await expect(ada.getByRole('dialog').locator('.profile-preview .avatar img')).toBeVisible();
  await ada.getByRole('button', { name: 'Colour 5', exact: true }).click();
  await ada.getByRole('button', { name: 'Save changes' }).click();
  await expect(ada.getByText('Saved ✓')).toBeVisible();
  await ada.getByRole('button', { name: 'Close settings' }).click();

  // The username stays, everyone else sees the new name and picture, even on old messages.
  await expect(ada.locator('.me-name')).toHaveText('Ada Lovelace 💻');
  const members = bo.getByRole('complementary', { name: 'Members' });
  await expect(members).toContainText('Ada Lovelace 💻');
  await expect(members.locator('.avatar img').first()).toBeVisible();
  await expect(messages(bo).locator('.message', { hasText: 'Hi!' }).locator('.message-author')).toHaveText('Ada Lovelace 💻');

  // Friends still add her by username.
  await bo.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /^Friends/ }).click();
  await bo.getByLabel('Username to add').fill(ada.name);
  await bo.getByRole('button', { name: 'Send request' }).click();
  await expect(bo.getByRole('region', { name: 'Sent requests' })).toContainText('Ada Lovelace 💻');
});

test('your status shows bottom-left and for others', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Study');
  await expect(ada.locator('.me-status')).toHaveText('Online');

  await ada.getByRole('button', { name: /Change status/ }).click();
  await ada.getByRole('menuitemradio', { name: 'Do not disturb' }).click();
  await expect(ada.locator('.me-status')).toHaveText('Do not disturb');

  const adaRow = bo.getByRole('complementary', { name: 'Members' }).getByRole('listitem').filter({ hasText: ada.name });
  await expect(adaRow.locator('.presence-dot')).toHaveClass(/dnd/);
});

test('emoji, pictures and files in messages', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Photos');

  // Emoji go where the cursor is.
  await composer(ada).fill('Leg day ');
  await ada.getByRole('button', { name: 'Add an emoji' }).click();
  await ada.getByRole('button', { name: 'Add 💪' }).click();
  await expect(composer(ada)).toHaveValue('Leg day 💪');
  await composer(ada).press('Enter');
  await expect(messages(bo).getByText('Leg day 💪')).toBeVisible();

  // A picture, with a caption.
  await ada.getByLabel('Choose a file to attach').setInputFiles({ name: 'pr.png', mimeType: 'image/png', buffer: PNG });
  await expect(ada.locator('.attachment-preview')).toContainText('pr.png');
  await composer(ada).fill('New PR!');
  await composer(ada).press('Enter');
  const picture = messages(bo).getByRole('button', { name: 'Open picture pr.png' });
  await expect(picture.locator('img')).toBeVisible();
  await expect(messages(bo).getByText('New PR!')).toBeVisible();
  await picture.click();
  await expect(bo.getByRole('dialog', { name: 'pr.png' })).toBeVisible();
  await bo.keyboard.press('Escape');

  // Any other file becomes a download.
  await ada.getByLabel('Choose a file to attach').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('chapter 1–6 summary'),
  });
  await ada.getByRole('button', { name: 'Send' }).click();
  const file = messages(bo).getByRole('link', { name: /notes\.txt/ });
  await expect(file).toBeVisible();
  const [download] = await Promise.all([bo.waitForEvent('download'), file.click()]);
  expect(download.suggestedFilename()).toBe('notes.txt');
});

test('your own messages are marked, separately from the hover highlight', async ({ browser }) => {
  const { ada, bo } = await twoInAGroup(browser, 'Marks');
  await composer(ada).fill('Mine');
  await composer(ada).press('Enter');
  await expect(messages(ada).locator('.message', { hasText: 'Mine' })).toHaveClass(/\bown\b/);
  await expect(messages(bo).locator('.message', { hasText: 'Mine' })).not.toHaveClass(/\bown\b/);
});

test('the side panels can be resized and remember their width', async ({ browser }) => {
  const { ada } = await twoInAGroup(browser, 'Wide');
  const sidebar = ada.locator('.sidebar');
  const before = (await sidebar.boundingBox()).width;

  const handle = ada.getByRole('separator', { name: 'Resize the chat list' });
  const box = await handle.boundingBox();
  await ada.mouse.move(box.x + box.width / 2, box.y + 200);
  await ada.mouse.down();
  await ada.mouse.move(box.x + box.width / 2 + 100, box.y + 200, { steps: 5 });
  await ada.mouse.up();
  await expect.poll(async () => (await sidebar.boundingBox()).width).toBeGreaterThan(before + 80);

  // The member list handle works with the keyboard too.
  const members = ada.locator('.members-panel');
  const membersBefore = (await members.boundingBox()).width;
  await ada.getByRole('separator', { name: 'Resize the member list' }).focus();
  await ada.keyboard.press('Shift+ArrowLeft');
  await expect.poll(async () => (await members.boundingBox()).width).toBeGreaterThan(membersBefore + 40);

  const widened = (await sidebar.boundingBox()).width;
  await ada.reload();
  await expect.poll(async () => Math.round((await ada.locator('.sidebar').boundingBox()).width)).toBe(Math.round(widened));
});
