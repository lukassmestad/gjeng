import { expect, test } from '@playwright/test';

// Each person gets their own browser context, like two different phones.
async function newPerson(browser, name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Start chatting' }).click();
  await expect(page.getByRole('heading', { name: 'Groups', exact: true })).toBeVisible();
  return page;
}

async function createGroup(page, name) {
  await page.getByRole('button', { name: 'New group' }).first().click();
  await page.getByLabel('Group name').fill(name);
  await page.getByRole('button', { name: 'Create group' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return (await page.getByTestId('invite-code').textContent()).trim();
}

async function joinGroup(page, code) {
  await page.getByRole('button', { name: 'Join with code' }).first().click();
  await page.getByLabel('Invite code').fill(code);
  await page.getByRole('button', { name: 'Join group' }).click();
}

const composer = (page) => page.getByRole('textbox', { name: /^Message/ });
const messages = (page) => page.getByRole('log', { name: 'Messages' });

test('two people can chat in a group in real time', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');

  const code = await createGroup(ada, 'Gym crew');
  await expect(ada.getByText("It's just you here so far")).toBeVisible();

  await joinGroup(bo, code);
  await expect(bo.getByRole('heading', { level: 1, name: 'Gym crew' })).toBeVisible();
  await expect(messages(ada).getByText('Bo joined the group')).toBeVisible();
  await expect(ada.getByText('2 members · 2 online')).toBeVisible();

  // Typing shows up for the other person before the message is sent.
  await composer(bo).fill('Leg day tomorrow?');
  await expect(ada.getByText('Bo is typing…')).toBeVisible();
  await composer(bo).press('Enter');
  await expect(messages(ada).getByText('Leg day tomorrow?')).toBeVisible();

  // Your own messages show your name like everyone else's, not "You".
  const bosMessage = messages(bo).locator('.message', { hasText: 'Leg day tomorrow?' });
  await expect(bosMessage.locator('.message-author')).toHaveText('Bo');
  await expect(bo.getByRole('navigation', { name: 'Chats' })).toContainText('Bo: Leg day tomorrow?');
  await expect(ada.getByText('Bo is typing…')).toBeHidden();

  await composer(ada).fill('Yes! 6pm');
  await composer(ada).press('Enter');
  await expect(messages(bo).getByText('Yes! 6pm')).toBeVisible();

  // Reactions sync both ways.
  const adasMessage = messages(bo).locator('.message', { hasText: 'Yes! 6pm' });
  await adasMessage.getByText('Yes! 6pm').hover();
  await adasMessage.getByRole('button', { name: 'React with 🔥' }).click();
  await expect(ada.getByRole('button', { name: /🔥 1, by Bo/ })).toBeVisible();

  // Clicking your own reaction again removes it.
  await adasMessage.getByRole('button', { name: /🔥 1, by Bo/ }).click();
  await expect(ada.getByRole('button', { name: /🔥 1, by Bo/ })).toBeHidden();
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

  const gymItem = ada.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /Gym crew/ });
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
  await expect(bo.getByRole('complementary', { name: 'Members' })).toBeVisible();
  await bo.getByRole('button', { name: 'Leave group' }).click();

  await expect(bo.getByRole('heading', { name: 'Welcome to Gjeng' })).toBeVisible();
  await expect(messages(ada).getByText('Bo left the group')).toBeVisible();
  await expect(ada.getByText('1 member · 1 online')).toBeVisible();
});

test('friends can add each other by code and chat privately', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');

  // Bo shares his friend code and Ada sends a request with it.
  await bo.getByRole('button', { name: 'Friends' }).click();
  const code = (await bo.getByTestId('friend-code').textContent()).trim();
  await ada.getByRole('button', { name: 'Friends' }).click();
  await ada.getByLabel('Friend code').fill(code);
  await ada.getByRole('button', { name: 'Send request' }).click();
  await expect(ada.getByRole('region', { name: 'Sent requests' })).toContainText('Bo');

  // Bo gets a badge and a notice, and accepts.
  await expect(bo.getByLabel('1 friend requests')).toBeVisible();
  await expect(bo.getByText('Ada sent you a friend request')).toBeVisible();
  await bo.getByRole('region', { name: 'Friend requests' }).getByRole('button', { name: 'Accept' }).click();
  await expect(ada.getByText('Bo accepted your friend request')).toBeVisible();

  // Ada opens a direct message, and only Bo gets it.
  await ada.getByRole('button', { name: 'Message Bo' }).click();
  await expect(ada.getByRole('heading', { level: 1, name: 'Bo' })).toBeVisible();
  await expect(ada.getByText('This is the start of your direct messages with Bo.')).toBeVisible();
  await composer(ada).fill('Want to grab lunch?');
  await composer(ada).press('Enter');

  const dmItem = bo.getByRole('navigation', { name: 'Chats' }).getByRole('button', { name: /Ada/ });
  await expect(dmItem.getByLabel('1 unread')).toBeVisible();
  await dmItem.click();
  await expect(messages(bo).getByText('Want to grab lunch?')).toBeVisible();
});

test('you can add friends from a group member list', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');
  const code = await createGroup(ada, 'Climbing');
  await joinGroup(bo, code);
  await expect(messages(ada).getByText('Bo joined the group')).toBeVisible();

  await expect(ada.getByRole('complementary', { name: 'Members' })).toBeVisible();
  await ada.getByRole('button', { name: 'Add Bo as friend' }).click();
  await expect(ada.getByRole('complementary', { name: 'Members' }).getByText('Request sent', { exact: true })).toBeVisible();

  await expect(bo.getByRole('complementary', { name: 'Members' })).toBeVisible();
  await bo.getByRole('button', { name: 'Accept Ada' }).click();
  await expect(bo.getByRole('button', { name: 'Message Ada' })).toBeVisible();
  await expect(ada.getByRole('button', { name: 'Message Bo' })).toBeVisible();
});

test('the member list shows who is online and who is offline', async ({ browser }) => {
  const ada = await newPerson(browser, 'Ada');
  const bo = await newPerson(browser, 'Bo');
  const code = await createGroup(ada, 'Running club');
  await joinGroup(bo, code);

  // On a wide screen the list is open next to the chat without clicking anything.
  const members = ada.getByRole('complementary', { name: 'Members' });
  await expect(members.getByRole('heading', { name: 'Online — 2' })).toBeVisible();
  await expect(members.getByRole('region', { name: 'Online members' })).toContainText('Bo');

  // Bo closes the app and moves down to Offline.
  await bo.context().close();
  await expect(members.getByRole('heading', { name: 'Offline — 1' })).toBeVisible();
  await expect(members.getByRole('region', { name: 'Offline members' })).toContainText('Bo');

  // Hiding the list is remembered after a reload.
  await ada.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(members).toBeHidden();
  await ada.reload();
  await expect(ada.getByRole('heading', { level: 1, name: 'Running club' })).toBeVisible();
  await expect(members).toBeHidden();
});
