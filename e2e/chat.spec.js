import { expect, test } from '@playwright/test';

// Usernames are unique on the server, so every test gets its own, e.g. "Ada_k3f9".
const PASSWORD = 'a long enough password';
const unique = (base) => `${base}_${Math.random().toString(36).slice(2, 6)}`;

// Each person gets their own browser context, like two different phones.
async function newPerson(browser, base) {
  const name = unique(base);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Username').fill(name);
  await expect(page.getByText('✓ Available')).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible();
  page.name = name;
  return page;
}

async function createGroup(page, name) {
  await page.getByRole('button', { name: 'New group' }).first().click();
  await page.getByLabel('Group name').fill(name);
  await page.getByRole('button', { name: 'Create group' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return readInviteCode(page);
}

// Invite codes are hidden until you press Show.
async function readInviteCode(page) {
  await page.locator('.chat-header').getByRole('button', { name: 'Show invite code' }).click();
  return (await page.getByTestId('invite-code').textContent()).trim();
}

async function joinGroup(page, code) {
  await page.getByRole('button', { name: 'Join with code' }).first().click();
  await page.getByLabel('Invite code').fill(code);
  await page.getByRole('button', { name: 'Join group' }).click();
}

async function becomeFriends(asker, accepter) {
  await asker.getByRole('button', { name: 'Friends' }).click();
  await asker.getByLabel('Username to add').fill(accepter.name);
  await asker.getByRole('button', { name: 'Send request' }).click();
  await accepter.getByRole('button', { name: 'Friends' }).click();
  await accepter.getByRole('region', { name: 'Friend requests' }).getByRole('button', { name: 'Accept' }).click();
  await expect(accepter.getByRole('heading', { level: 1, name: asker.name })).toBeVisible();
}

const composer = (page) => page.getByRole('textbox', { name: /^Message/ });
const messages = (page) => page.getByRole('log', { name: 'Messages' });
const chats = (page) => page.getByRole('navigation', { name: 'Chats' });

test('two people can chat in a group in real time', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');

  const code = await createGroup(ada, 'Gym crew');
  await expect(ada.getByText("It's just you here so far")).toBeVisible();

  await joinGroup(bo, code);
  await expect(bo.getByRole('heading', { level: 1, name: 'Gym crew' })).toBeVisible();
  await expect(messages(ada).getByText(`${bo.name} joined the group`)).toBeVisible();
  await expect(ada.getByText('2 members · 2 online')).toBeVisible();

  // Typing shows up for the other person before the message is sent.
  await composer(bo).fill('Leg day tomorrow?');
  await expect(ada.getByText(`${bo.name} is typing…`)).toBeVisible();
  await composer(bo).press('Enter');
  await expect(messages(ada).getByText('Leg day tomorrow?')).toBeVisible();
  await expect(ada.getByText(`${bo.name} is typing…`)).toBeHidden();

  // Your own messages show your name like everyone else's, not "You".
  const bosMessage = messages(bo).locator('.message', { hasText: 'Leg day tomorrow?' });
  await expect(bosMessage.locator('.message-author')).toHaveText(bo.name);
  await expect(chats(bo)).toContainText(`${bo.name}: Leg day tomorrow?`);

  await composer(ada).fill('Yes! 6pm');
  await composer(ada).press('Enter');
  await expect(messages(bo).getByText('Yes! 6pm')).toBeVisible();

  // Reactions sync both ways.
  const adasMessage = messages(bo).locator('.message', { hasText: 'Yes! 6pm' });
  await adasMessage.getByText('Yes! 6pm').hover();
  await adasMessage.getByRole('button', { name: 'React with 🔥' }).click();
  await expect(ada.getByRole('button', { name: `🔥 1, by ${bo.name}` })).toBeVisible();

  // Clicking your own reaction again removes it.
  await adasMessage.getByRole('button', { name: `🔥 1, by ${bo.name}` }).click();
  await expect(ada.getByRole('button', { name: `🔥 1, by ${bo.name}` })).toBeHidden();
});

test('usernames are unique and must be typeable', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');

  await page.getByLabel('Username').fill(ada.name.toUpperCase());
  await expect(page.getByText(`"${ada.name.toUpperCase()}" is already taken.`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();

  await page.getByLabel('Username').fill('Ada Lovelace');
  await expect(page.getByText('without spaces')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();
});

test('a wrong invite code shows an error', async ({ browser }) => {
  const cy = await newPerson(browser, 'Cy');
  await joinGroup(cy, 'ZZZZZZ');
  await expect(cy.getByRole('alert')).toHaveText('No group has that invite code.');
});

test('unread messages get a badge until you open the group', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');

  const gymCode = await createGroup(ada, 'Gym crew');
  await joinGroup(bo, gymCode);
  await expect(bo.getByRole('heading', { level: 1, name: 'Gym crew' })).toBeVisible();

  // Ada opens a different group, so new messages in Gym crew are unread for her.
  await createGroup(ada, 'Study group');
  await composer(bo).fill('Anyone there?');
  await composer(bo).press('Enter');

  const gymItem = chats(ada).getByRole('button', { name: /Gym crew/ });
  await expect(gymItem.getByLabel('1 unread')).toBeVisible();
  await expect(ada).toHaveTitle('(1) Gjeng');

  await gymItem.click();
  await expect(gymItem.getByLabel('1 unread')).toBeHidden();
  await expect(ada).toHaveTitle('Gjeng');
});

test('chats are still there after reloading the page', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  await createGroup(ada, 'Weekend plans');
  await composer(ada).fill('Cabin trip?');
  await composer(ada).press('Enter');
  await expect(messages(ada).getByText('Cabin trip?')).toBeVisible();

  await ada.reload();
  await expect(ada.getByRole('heading', { level: 1, name: 'Weekend plans' })).toBeVisible();
  await expect(messages(ada).getByText('Cabin trip?')).toBeVisible();
});

test('leaving a group removes it from your list', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');
  const code = await createGroup(ada, 'Book club');
  await joinGroup(bo, code);
  await expect(bo.getByRole('heading', { level: 1, name: 'Book club' })).toBeVisible();

  bo.once('dialog', (dialog) => dialog.accept());
  await bo.getByRole('button', { name: 'Leave group' }).click();

  await expect(bo.getByRole('heading', { name: 'Welcome to Gjeng' })).toBeVisible();
  await expect(messages(ada).getByText(`${bo.name} left the group`)).toBeVisible();
  await expect(ada.getByText('1 member · 1 online')).toBeVisible();
});

test('accepting a friend request opens your direct message for both of you', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');

  // Ada adds Bo by typing his username (in a different letter case) and waits on the Friends page.
  await ada.getByRole('button', { name: 'Friends' }).click();
  await ada.getByLabel('Username to add').fill(bo.name.toLowerCase());
  await ada.getByRole('button', { name: 'Send request' }).click();
  await expect(ada.getByRole('region', { name: 'Sent requests' })).toContainText(bo.name);

  // Bo gets a badge and a notice, accepts, and lands in the new DM.
  await expect(bo.getByLabel('1 friend requests')).toBeVisible();
  await expect(bo.getByText(`${ada.name} sent you a friend request`)).toBeVisible();
  await bo.getByRole('button', { name: 'Friends' }).click();
  await bo.getByRole('region', { name: 'Friend requests' }).getByRole('button', { name: 'Accept' }).click();
  await expect(bo.getByRole('heading', { level: 1, name: ada.name })).toBeVisible();

  // Ada was waiting on the Friends page, so she's taken to the DM too.
  await expect(ada.getByText(`${bo.name} accepted your friend request`)).toBeVisible();
  await expect(ada.getByRole('heading', { level: 1, name: bo.name })).toBeVisible();
  await expect(ada.getByText(`This is the start of your direct messages with ${bo.name}.`)).toBeVisible();

  await composer(ada).fill('Want to grab lunch?');
  await composer(ada).press('Enter');
  await expect(messages(bo).getByText('Want to grab lunch?')).toBeVisible();

  // Both still see each other as friends.
  await ada.getByRole('button', { name: 'Friends' }).click();
  await expect(ada.getByRole('region', { name: 'Your friends' })).toContainText(bo.name);
});

test('you can add friends from a group member list', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');
  const code = await createGroup(ada, 'Climbing');
  await joinGroup(bo, code);
  await expect(messages(ada).getByText(`${bo.name} joined the group`)).toBeVisible();

  await ada.getByRole('button', { name: `Add ${bo.name} as friend` }).click();
  await expect(ada.getByRole('complementary', { name: 'Members' }).getByText('Request sent', { exact: true })).toBeVisible();

  await bo.getByRole('button', { name: `Accept ${ada.name}` }).click();
  await expect(bo.getByRole('heading', { level: 1, name: ada.name })).toBeVisible();
  // Ada is busy in the group, so she stays there, and the DM appears in her list.
  await expect(ada.getByRole('heading', { level: 1, name: 'Climbing' })).toBeVisible();
  await expect(chats(ada).getByRole('button', { name: `${bo.name} No messages yet` })).toBeVisible();
  await expect(ada.getByRole('button', { name: `Message ${bo.name}` })).toBeVisible();
});

test('you can add your friends straight into a group', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');
  await becomeFriends(bo, ada);

  await createGroup(ada, 'Cabin trip');
  await ada.getByRole('button', { name: 'Add friends' }).click();
  await ada.getByRole('button', { name: `Add ${bo.name} to the group` }).click();
  await expect(ada.getByRole('dialog').getByText('Added ✓')).toBeVisible();
  await ada.getByRole('button', { name: 'Done' }).click();

  await expect(messages(ada).getByText(`${ada.name} added ${bo.name}`)).toBeVisible();
  await expect(chats(bo).getByRole('button', { name: /Cabin trip/ })).toBeVisible();
});

test('the member list shows who is online and who is offline', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');
  const code = await createGroup(ada, 'Running club');
  await joinGroup(bo, code);

  // On a wide screen the list is open next to the chat without clicking anything.
  const members = ada.getByRole('complementary', { name: 'Members' });
  await expect(members.getByRole('heading', { name: 'Online — 2' })).toBeVisible();
  await expect(members.getByRole('region', { name: 'Online members' })).toContainText(bo.name);

  // Bo closes the app and moves down to Offline.
  await bo.context().close();
  await expect(members.getByRole('heading', { name: 'Offline — 1' })).toBeVisible();
  await expect(members.getByRole('region', { name: 'Offline members' })).toContainText(bo.name);

  // Hiding the list is remembered after a reload.
  await ada.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(members).toBeHidden();
  await ada.reload();
  await expect(ada.getByRole('heading', { level: 1, name: 'Running club' })).toBeVisible();
  await expect(members).toBeHidden();
});

test('accounts: log out, wrong password, log back in, and a second device', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  await createGroup(ada, 'Saved chats');

  // Sign out from settings.
  await ada.getByRole('button', { name: 'Profile settings' }).click();
  await ada.getByRole('button', { name: 'Sign out' }).click();
  await expect(ada.getByRole('tab', { name: 'Log in' })).toBeVisible();

  // A wrong password gives the same message as an unknown name.
  await ada.getByRole('tab', { name: 'Log in' }).click();
  await ada.getByLabel('Username').fill(ada.name);
  await ada.getByLabel('Password', { exact: true }).fill('not my password');
  await ada.getByRole('button', { name: 'Log in' }).click();
  await expect(ada.getByRole('alert')).toHaveText('Wrong username or password.');

  // The right password (and the name in other letters) brings everything back.
  await ada.getByLabel('Username').fill(ada.name.toLowerCase());
  await ada.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await ada.getByRole('button', { name: 'Log in' }).click();
  await expect(chats(ada).getByRole('button', { name: /Saved chats/ })).toBeVisible();

  // Logging in on another device works at the same time.
  const phone = await (await browser.newContext()).newPage();
  await phone.goto('/');
  await phone.getByRole('tab', { name: 'Log in' }).click();
  await phone.getByLabel('Username').fill(ada.name);
  await phone.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await phone.getByRole('button', { name: 'Log in' }).click();
  await expect(chats(phone).getByRole('button', { name: /Saved chats/ })).toBeVisible();
});

test('passwords must be long enough, and changing one logs out other devices', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByLabel('Username').fill(unique('Ada'));
  await page.getByLabel('Password', { exact: true }).fill('short');
  await expect(page.getByText('At least 8 characters.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account' })).toBeDisabled();

  const ada = await newPerson(browser, 'Ada');
  const laptop = await (await browser.newContext()).newPage();
  await laptop.goto('/');
  await laptop.getByRole('tab', { name: 'Log in' }).click();
  await laptop.getByLabel('Username').fill(ada.name);
  await laptop.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await laptop.getByRole('button', { name: 'Log in' }).click();
  await expect(laptop.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible();

  await ada.getByRole('button', { name: 'Profile settings' }).click();
  await ada.getByRole('navigation', { name: 'Settings sections' }).getByRole('button', { name: 'Account' }).click();
  await ada.getByLabel('Current password').fill('wrong one!');
  await ada.getByLabel('New password').fill('a brand new password');
  await ada.getByRole('button', { name: 'Change password' }).click();
  await expect(ada.getByRole('alert')).toHaveText('Your current password is wrong.');

  await ada.getByLabel('Current password').fill(PASSWORD);
  await ada.getByRole('button', { name: 'Change password' }).click();
  await expect(ada.getByText(/Password changed/)).toBeVisible();
  await expect(laptop.getByText('You were logged out.')).toBeVisible();
  await expect(laptop.getByRole('button', { name: 'Log in again' })).toBeVisible();
});

test('the demo shortcut is switched off on a normal server', async ({ request }) => {
  const reply = await request.post('/api/demo-login', { data: { userId: 'demo-emma-0000' } });
  expect(reply.status()).toBe(403);
  expect(await (await request.get('/api/demo-users')).json()).toEqual([]);
});
