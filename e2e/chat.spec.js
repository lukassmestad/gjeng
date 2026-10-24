import { expect, test } from '@playwright/test';

// Each person gets their own browser context, like two different phones.
async function newPerson(browser, name) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Start chatting' }).click();
  await expect(page.getByRole('heading', { name: 'Your groups' })).toBeVisible();
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
  await adasMessage.getByRole('button', { name: /🔥 1, by You/ }).click();
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

  const gymItem = ada.getByRole('navigation', { name: 'Your groups' }).getByRole('button', { name: /Gym crew/ });
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
  await bo.getByRole('button', { name: 'Members' }).click();
  await bo.getByRole('button', { name: 'Leave group' }).click();

  await expect(bo.getByRole('heading', { name: 'Welcome to Gjeng' })).toBeVisible();
  await expect(messages(ada).getByText('Bo left the group')).toBeVisible();
  await expect(ada.getByText('1 member · 1 online')).toBeVisible();
});
