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

export const REACTIONS = ['👍', '❤️', '😂', '😮', '🔥'];

export const INVITE_CODE_LENGTH = 6;
