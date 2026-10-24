# Build log: how Gjeng was made with AI

**AI tool:** Claude Code (model: Claude Opus 5.5), running as an extension in VS Code. The AI wrote the code, ran the tests, took screenshots and looked at them, and fixed what it found. I made the decisions about what to build and checked the results.

**Time:** about one afternoon (24 Oct 2026), plus polishing.

## 1. Brainstorming

I gave the AI the assignment text and asked for app ideas. It came back with several rounds of suggestions, and I said no to most of them:

| Round | Ideas | What I decided |
| --- | --- | --- |
| 1 | Shared flat app, study planner, student event app, textbook marketplace | Asked for other ideas |
| 2 | Pay tracker for part-time jobs, focus timer with a growing plant, Secret Santa draw, room booking, party word game, gym logger | Pay tracker: workplaces already do this. Didn't like the others either |
| 3 | Ideas based on my hobbies (lifting, drawing, gaming, making games, factory work): gym tracker as an RPG, pixel art editor, machine downtime log, drawing practice timer | Gym trackers are overdone, even with a twist |
| 4 | Factory tools, playable level maker, draw-your-own-enemy game, dialogue writer for games, draw & guess (like skribbl.io), and more | Decided on something else |

I picked **a chat and group app** (option C, "recreate or improve an existing app", inspired by Messenger/Discord). The AI suggested the name **Gjeng** (Norwegian for "the gang") and I liked it.

The AI also read the VibeOff publishing rules first. They say: no real company APIs, only made-up data, and no copied logos. That ruled out ideas that depend on outside services, and it's why everything runs on our own small server.

## 2. Plan

Features (kept to a few that should work well):

1. Join with a name and colour, with no password, so there are no passwords to leak.
2. Groups with 6-character invite codes (no `0/O` or `1/I`, so codes are easy to read out loud).
3. Live messages, typing indicator, online status and emoji reactions.

Technology: React front end, Node.js server with Socket.IO for real-time updates, data saved in a JSON file. No database or API keys needed.

## 3. Key prompts

- *"I think just a basic chat and group application could be better."*
- *"I like the name Gjeng then! Lets get started."*
- After trying the first version: *"I think the messages should not be shown left to right, as that fits a phone view more. It should instead be all to the left of the page and show the profile picture and name with their message under. So it should show your name instead of something like 'You' or a different colour."*
- *"Would it be possible to add voice chat into this webapp or is that not possible with a weak server connection? We should also be able to add friends for more direct messages."*

From there the AI planned the structure, wrote the server, the chat logic, the React app and the styles, and wrote tests for all of it.

## 4. Testing

There are two kinds of automated tests:

- **17 unit tests** for the chat logic, for example: you can't post in a group you're not in, wrong invite codes are rejected, reactions toggle on and off, and the history is capped at 500 messages.
- **5 browser tests** with Playwright that open *two separate browsers* (two people) and check that:
  - messages, typing indicators and reactions show up for the other person,
  - a wrong invite code shows an error,
  - unread badges appear and go away when you open the group,
  - chats survive a page reload,
  - leaving a group works and the others see it.

The AI also took screenshots in desktop, phone and dark mode and **looked at them** to find visual problems.

## 5. Problems found and fixed

| What went wrong | How it was found | Fix |
| --- | --- | --- |
| The emoji reaction bar appeared **on top of** the message you hovered over and covered short messages completely | A browser test couldn't reach the message because the bar was in the way | Moved the bar *beside* the message, or above it on phones |
| The chat **didn't scroll to the bottom** when a reaction made the list taller, so the last message was cut off | Looking at a screenshot | Scroll after every update while you're at the bottom, not only when a new message arrives |
| The reaction bar **stayed open** after clicking a reaction | Screenshot | Only keep it open for keyboard focus (`:focus-visible`), not after a mouse click |
| "Join with code" **wrapped onto two lines** in the sidebar | Screenshot | Slightly wider sidebar and no wrapping |
| Some tests failed because each message appears twice: in the chat and as the preview in the group list | Test output | Made the tests look only inside the message area |
| Screenshots showed half-faded menus and buttons | Screenshot. The AI measured the opacity in the browser and found an animation that hadn't finished | Only the screenshot script needed fixing (wait for animations), not the app |

Problems handled before they happened:

- **Phones on the same Wi-Fi use plain `http://`**, where browsers turn off `crypto.randomUUID()` and the clipboard API. The app uses fallbacks for both, so joining and copying invite codes work on phones too.
- **No crashes if browser storage is blocked** (private mode), because every read and write of saved data is wrapped in error handling.

## 6. Changes after trying it myself

The first version showed messages like a phone chat: other people's messages on the left in white bubbles, and yours on the right in orange. Everyone's messages are now on the left, Discord/Slack style:

- Each message has the person's profile picture, their **name** and the time, with the message underneath.
- Your own messages look the same as everyone else's and show your name, not "You". This also applies to the group list preview and the reaction tooltips.
- Several messages in a row from the same person are grouped under one name. Pointing at one shows its time.
- The reaction bar now pops up in the top-right corner of the message instead of beside a bubble.

A new browser test checks that your own messages show your name.

## 7. Friends and direct messages

Added after I asked for a way to message people one-on-one:

- Everyone gets a **friend code**. You can add someone by code, or with "Add friend" next to them in a group's member list.
- The other person sees a badge and a notice, and can **accept or decline**. If two people ask each other, they become friends straight away.
- Friends get a **Message** button that opens a private chat. Direct messages reuse everything groups already had: live messages, typing, reactions and unread badges.
- The sidebar is now split into **Friends**, **Direct messages** and **Groups**.
- Rules the server checks: you can only message friends, you can't add yourself, friend codes aren't shown to other people, and direct messages can't be joined by code.

Tests: 11 new unit tests (28 in total) and 2 new browser tests (7 in total). One adds a friend by code, accepts and sends a direct message. The other adds a friend from a group's member list. Both passed the first time.

While checking the screenshots, the AI noticed a notice that seemed to never go away. Before changing anything, it measured how long the notice was visible: it disappeared after 2.5 seconds as intended, and the screenshots had just been taken quickly. So the screenshot script was fixed, not the app.

I also asked whether **voice chat** would work with a weak server. The AI explained that voice would go directly between the browsers (WebRTC), with the server only connecting people, so the server's connection isn't the problem. The catch is that browsers only allow the microphone on `https` or `localhost`.

## 8. Group icons and a Discord-style member list

My prompts:

- *"Add all profiles in like an app folder for the group chat, so it shows the larger icon with all members icons."*
- *"For a group, show active group members on a tab to the right similar to Discord's solution."*

What changed:

- **Group icons look like an app folder on a phone.** They're a rounded square, tinted in the group's colour, with every member's profile picture inside. Up to 4 members fit in a 2×2 grid, bigger groups get a 3×3 grid, and if there are more than 9 the last spot shows "+N". A large version sits at the top of the member list.
- **Member list on the right, like Discord.** It's open by default on wide screens and split into "Online — N" and "Offline — N", with offline people faded. You can hide it with the members button and it remembers that. On smaller screens and phones it slides over the chat instead, so it doesn't squeeze the messages.
- To keep the list calm, "Message" and "Add friend" only appear when you point at someone. "Accept" always shows, because it needs an answer. On touch screens all buttons show, since there's no pointing there.

A new browser test checks the Online/Offline sections (one person closes the app and moves to Offline) and that hiding the list is remembered after a reload. The old tests had clicked a button to *open* the member list, and now it's already open, so they were updated. That was 8 browser tests in total, all passing.

![A big group with the folder icon and the member list](docs/big-group.png)

## 9. Usernames, adding friends to groups, and demo data

My prompts:

- *"How about first making usernames more exclusive and having the friend codes based on the username? So it's easier to add friends. I also think when a friend is added their DM should automatically be opened. For both people it also says 'No friends' in the friends tab."*
- *"Also add an option to add or invite people from your friend list to a group."*
- *"When launching the app, how about having already created some users who share friends among each other, with for example 3 different groups of different combinations and some already typed messages. Would look good for the demo I think."*

**The "No friends" problem.** Before changing any code, the AI looked at the data the server had saved from my testing. Frederik and Ola had a direct message with messages in it, so they *had* been friends, and the friendship had later been removed. That only happens through the ✕ next to a friend, which looked like a "close" button but meant "Remove friend". So it was a confusing design rather than a crash, and the ✕ became a clearly labelled "Remove friend" button.

What changed:

- **Usernames are unique** (upper/lower case doesn't matter) and can be typed: 2–20 letters or numbers, no spaces, æøå allowed. The join screen asks the server while you type and shows "✓ Available" or "already taken". Friend codes are gone: **you add friends by typing their username**.
- **Accepting a friend request creates your direct message straight away.** The person who accepts lands in it. The person who asked also jumps there if they were waiting on the Friends page, and otherwise it shows up in their list.
- **Add friends to a group:** an "Add friends" button in the member list opens your friends who aren't in the group yet, each with an "Add" button. The group sees "Emma added Jonas".
- **Demo mode (`npm run demo`):** seven made-up people (Emma, Jonas, Sara, Ola, Noah, Ingrid, Maja) who are friends in different combinations, three groups (Gym crew, Kollektiv, Exam study group), three direct messages, reactions and a waiting friend request. The join screen offers **"Jump in as …"** buttons. The demo resets every time it starts and is kept apart from real data.

Tests: 35 unit tests and 10 browser tests, all passing. New ones cover unique usernames, adding by username, the DM opening on both sides after accepting, adding friends to a group, and that the demo data is complete and in time order. Because usernames are unique now, the browser tests give each person a name like `Ada_k3f9`, so the tests don't clash with each other.

![Adding friends to a group](docs/add-friends.png)

## 10. What surprised me

How efficient the AI was, and how well it understood what I meant even when my prompts weren't well structured.

## 11. What I'd add next

- Sending images
- Voice chat
- Proper accounts so you can log in on a new device
- Push notifications
- Hosting it online so people don't need to be on the same network
