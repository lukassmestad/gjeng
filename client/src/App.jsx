import { useState } from 'react';
import ChatApp from './components/ChatApp.jsx';
import JoinScreen from './components/JoinScreen.jsx';
import { api, storage } from './lib.js';

// After logging in, the browser keeps a session key (not the password) and your user id.
const SESSION_KEY = 'gjeng.session';

function loadSession() {
  const session = storage.get(SESSION_KEY, null);
  return session && typeof session.token === 'string' && typeof session.id === 'string' ? session : null;
}

export default function App() {
  const [session, setSession] = useState(loadSession);

  function signIn({ token, userId }) {
    const next = { token, id: userId };
    storage.set(SESSION_KEY, next);
    setSession(next);
  }

  function signOut() {
    if (session) api('/api/logout', {}, session.token).catch(() => {}); // the key is forgotten here either way
    storage.remove(SESSION_KEY);
    setSession(null);
  }

  return session ? <ChatApp user={session} onSignOut={signOut} /> : <JoinScreen onSignIn={signIn} />;
}
