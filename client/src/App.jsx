import { useState } from 'react';
import ChatApp from './components/ChatApp.jsx';
import JoinScreen from './components/JoinScreen.jsx';
import { storage } from './lib.js';

const USER_KEY = 'gjeng.user';

function loadUser() {
  const user = storage.get(USER_KEY, null);
  return user && typeof user.id === 'string' && typeof user.name === 'string' ? user : null;
}

export default function App() {
  const [user, setUser] = useState(loadUser);

  function join(newUser) {
    storage.set(USER_KEY, newUser);
    setUser(newUser);
  }

  function signOut() {
    storage.remove(USER_KEY);
    setUser(null);
  }

  return user ? <ChatApp user={user} onSignOut={signOut} /> : <JoinScreen onJoin={join} />;
}
