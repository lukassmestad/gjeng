// Made-up people, friendships, groups and messages for showing Gjeng off ("npm run demo").
// Everything is fictional. The demo starts fresh every time the server starts.
import { COLORS } from '../shared/constants.js';
import { Store } from './store.js';

const MINUTE = 60 * 1000;

// A profile picture drawn in code: an emoji on a colour gradient. No real photos.
function emojiPicture(emoji, from, to) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    `<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    '<rect width="100" height="100" fill="url(#g)"/>' +
    `<text x="50" y="56" font-size="54" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// [key, username, colour, display name, picture]. Some have neither, to show the plain initials too.
const PEOPLE = [
  ['emma', 'Emma', 0, null, emojiPicture('🏋️', '#ffb37a', '#e8590c')],
  ['jonas', 'Jonas', 4, null, emojiPicture('🎸', '#74c0fc', '#1c7ed6')],
  ['sara', 'Sara', 2, 'Sara ✨', emojiPicture('🦊', '#e599f7', '#ae3ec9')],
  ['ola', 'Ola', 6, null, emojiPicture('🚲', '#8ce99a', '#2f9e44')],
  ['noah', 'Noah', 1, 'Noah H.', null],
  ['ingrid', 'Ingrid', 3, null, null],
  ['maja', 'Maja', 7, null, null],
];

export function seedDemo(store = new Store()) {
  const p = {};
  for (const [key, name, colour, displayName, picture] of PEOPLE) {
    p[key] = store.upsertUser({ id: `demo-${key}-0000`, name, color: COLORS[colour] });
    p[key].demo = true;
    if (displayName) p[key].displayName = displayName;
    // Set directly: uploads only accept real photos, but these are our own drawings.
    if (picture) p[key].avatar = picture;
  }

  const befriend = (a, b) => {
    store.addFriend(a.id, { friendId: b.id });
    store.respondToRequest(b.id, a.id, true);
  };
  befriend(p.emma, p.jonas);
  befriend(p.emma, p.sara);
  befriend(p.emma, p.ola);
  befriend(p.jonas, p.ola);
  befriend(p.sara, p.ingrid);
  befriend(p.jonas, p.noah);
  befriend(p.ingrid, p.maja);
  // Requests still waiting for an answer.
  store.addFriend(p.maja.id, { friendId: p.emma.id });
  store.addFriend(p.noah.id, { friendId: p.sara.id });

  const group = (creator, name, members) => {
    const g = store.createGroup(creator.id, name);
    for (const m of members) store.joinGroup(m.id, g.code);
    return g;
  };
  const dm = (a, b) => store.openDm(a.id, b.id).group;

  // say(chat, person, text, minutes ago, { emoji: [people who reacted] })
  const say = (chat, person, text, minutesAgo, reactions = {}) => {
    const message = store.addMessage(person.id, chat.id, text);
    message.ts = Date.now() - minutesAgo * MINUTE;
    for (const [emoji, who] of Object.entries(reactions)) {
      for (const r of who) store.toggleReaction(r.id, chat.id, message.id, emoji);
    }
  };

  const flat = group(p.ola, 'Kollektiv 🏠', [p.emma, p.noah]);
  say(flat, p.ola, 'Who finished the milk again?? 🥛', 300);
  say(flat, p.noah, "Not me, I'm lactose intolerant 😇", 290);
  say(flat, p.emma, '…that was me. Buying more today, sorry!', 285, { '😂': [p.ola, p.noah] });
  say(flat, p.noah, 'Cleaning this week: Emma kitchen, Ola bathroom, me the hallway', 60);
  say(flat, p.ola, 'Deal. Taco Friday at ours? 🌮', 40, { '🔥': [p.emma, p.noah] });

  const study = group(p.sara, 'Exam study group', [p.ingrid, p.emma, p.jonas, p.maja, p.noah]);
  say(study, p.sara, 'Exam is in 12 days 😬 Library sessions?', 180);
  say(study, p.ingrid, 'Yes please. Monday 10:00?', 175);
  say(study, p.maja, "I'll book a group room", 170);
  say(study, p.jonas, 'Can someone explain recursion again 🙃', 150);
  say(study, p.emma, 'To understand recursion, you first have to understand recursion', 148, {
    '😂': [p.sara, p.ingrid, p.noah],
  });
  say(study, p.noah, "I made a summary of chapters 1–6, I'll share it Monday", 140, {
    '👍': [p.sara, p.maja],
    '❤️': [p.ingrid],
  });
  say(study, p.maja, 'Booked room 4 for Monday 10–14 ✅', 12);
  say(study, p.sara, 'Legend 🙌', 10);

  const gym = group(p.emma, 'Gym crew', [p.jonas, p.sara, p.ola]);
  say(gym, p.jonas, 'Leg day tomorrow? 💪', 95);
  say(gym, p.sara, "I'm in! 7am before lectures?", 93);
  say(gym, p.emma, '7am is brutal 😅 can we do 4pm instead?', 90);
  say(gym, p.ola, '4pm works for me', 88);
  say(gym, p.jonas, 'Fine, 4pm. Last one there buys protein bars', 85, { '😂': [p.emma, p.sara] });
  say(gym, p.sara, 'Also… new deadlift PR today: 100 kg!! 🎉', 30, { '🔥': [p.emma, p.jonas], '❤️': [p.ola] });
  say(gym, p.sara, 'Took me all semester', 29);
  say(gym, p.ola, 'Huge! Celebration pizza after leg day?', 6, { '👍': [p.jonas, p.emma, p.sara] });

  const emmaJonas = dm(p.emma, p.jonas);
  say(emmaJonas, p.jonas, 'You coming to the gym later?', 70);
  say(emmaJonas, p.emma, "Yes! I'll bring the protein bars 😅", 68);
  say(emmaJonas, p.jonas, 'Haha deal', 67);

  const emmaSara = dm(p.emma, p.sara);
  say(emmaSara, p.sara, "100 kg!! I can't believe it", 25);
  say(emmaSara, p.emma, 'So proud of you!! Next stop 120 🔥', 24);

  const jonasOla = dm(p.jonas, p.ola);
  say(jonasOla, p.ola, 'Did you fix your bike?', 200);
  say(jonasOla, p.jonas, 'Finally, new chain 🚲', 198);

  // "X joined the group" messages were made just now. Move them to just before each chat starts.
  for (const g of Object.values(store.groups)) {
    const first = Math.min(...g.messages.filter((m) => m.type === 'user').map((m) => m.ts));
    const system = g.messages.filter((m) => m.type === 'system');
    system.forEach((m, i) => (m.ts = first - (system.length - i) * MINUTE));
  }

  return store;
}
