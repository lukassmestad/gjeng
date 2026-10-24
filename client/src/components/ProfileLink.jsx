import { createContext, useContext } from 'react';

// Lets any picture or name in the app open someone's profile card, without passing a function down every level.
export const ProfileContext = createContext(() => {});

export const useOpenProfile = () => useContext(ProfileContext);

// Wraps a picture and/or name in a button that opens that person's profile card.
export default function ProfileLink({ userId, label, className = '', children }) {
  const openProfile = useOpenProfile();
  return (
    <button
      type="button"
      className={`profile-link ${className}`}
      aria-label={label ? `Open ${label}'s profile` : undefined}
      onClick={(event) => {
        event.stopPropagation();
        openProfile(userId);
      }}
    >
      {children}
    </button>
  );
}
