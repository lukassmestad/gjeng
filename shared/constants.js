// Used by both the server (validation) and the client (UI), so they always agree.

// Usernames are unique, so they can be typed to add a friend: letters (æøå too), numbers, . _ -
export const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]{2,20}$/u;
export const USERNAME_RULES = 'Use 2–20 letters or numbers (. _ - are fine too), without spaces.';

export const LIMITS = {
  userName: 20,
  groupName: 40,
  message: 2000,
  history: 500,
};

export const COLORS = [
  '#e8590c',
  '#d6336c',
  '#ae3ec9',
  '#7048e8',
  '#1c7ed6',
  '#0c8599',
  '#2f9e44',
  '#f08c00',
];

export const REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '😡', '🔥'];

// Display names are free text (spaces and emoji are fine) and don't have to be unique.
export const DISPLAY_NAME_MAX = 32;

// Profile pictures are shrunk in the browser before upload, so they stay small.
export const AVATAR_MAX_LENGTH = 200_000;

// Pictures and files attached to messages (pictures are shrunk first).
export const ATTACHMENT_MAX_BYTES = 1_000_000;

// "Invisible" is left out on purpose: in a small friend group it mostly causes confusion.
// (You can still hide when you're online, in the privacy settings.)
export const STATUS_VALUES = ['online', 'away', 'dnd'];

export const BIO_MAX = 190;
export const BANNER_MAX_LENGTH = 300_000;

// Privacy choices, with the default first.
export const PRIVACY_OPTIONS = {
  friendRequests: ['everyone', 'friends-of-friends', 'nobody'],
  friendsVisibility: ['friends-of-friends', 'everyone', 'friends', 'nobody'],
};

export const INVITE_CODE_LENGTH = 6;
