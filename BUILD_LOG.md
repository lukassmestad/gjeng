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

| Before | After |
| --- | --- |
| Bubbles, your messages on the right in orange | Everyone on the left with picture and name |

## 7. What I'd add next

- Sending images
- Proper accounts so you can log in on a new device
- Push notifications
- Hosting it online so people don't need to be on the same network
