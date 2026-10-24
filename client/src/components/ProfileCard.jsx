import { useEffect, useId, useState } from 'react';
import { mix } from '../color.js';
import { plural, presenceLabel, presenceOf, shownName } from '../lib.js';
import { Avatar } from './Avatar.jsx';
import { XIcon } from './Icons.jsx';

export function bannerStyle(user, bannerImage) {
  if (bannerImage) return { backgroundImage: `url(${bannerImage})` };
  const color = user.bannerColor ?? user.color;
  return { background: `linear-gradient(135deg, ${color}, ${mix(color, '#000000', 0.35)})` };
}

const memberSince = (ts) => new Date(ts).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

// The card itself: banner, picture, names, status and "about me". Also used as the preview in settings.
export function ProfileCardView({ user, bio, bannerImage, online, joinedAt, headingId, children }) {
  const presence = online === undefined ? null : presenceOf(user, online);
  return (
    <div className="profile-card">
      <div className="profile-banner" style={bannerStyle(user, bannerImage)} />
      <div className="profile-card-avatar">
        <Avatar user={user} size={88} online={online} />
      </div>
      <div className="profile-card-body">
        <h3 className="profile-card-name" id={headingId}>
          {shownName(user)}
        </h3>
        <p className="profile-card-handle">
          @{user.name}
          {presence && ` · ${presenceLabel(presence)}`}
        </p>
        {bio && (
          <section className="profile-card-section">
            <h4>About me</h4>
            <p className="profile-bio">{bio}</p>
          </section>
        )}
        {joinedAt && (
          <section className="profile-card-section">
            <h4>Member since</h4>
            <p>{memberSince(joinedAt)}</p>
          </section>
        )}
        {children}
      </div>
    </div>
  );
}

// Opens when you click someone's picture or name. Shows what their privacy settings allow.
export default function ProfileCardModal({
  userId,
  liveUser,
  onlineIds,
  getProfile,
  onMessage,
  onAddFriend,
  onAccept,
  onOpenGroup,
  onOpenProfile,
  onEditProfile,
  onClose,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const headingId = useId();

  useEffect(() => {
    let live = true;
    setError(null);
    getProfile(userId)
      .then((profile) => live && setData(profile))
      .catch((err) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, [userId, version]);

  useEffect(() => {
    const escape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);

  const refresh = () => setVersion((v) => v + 1);
  const user = liveUser ?? data?.user;
  const name = user ? shownName(user) : '';

  let action = null;
  if (data && user) {
    if (data.relation === 'self') {
      action = (
        <button className="button" onClick={onEditProfile}>
          Edit profile
        </button>
      );
    } else if (data.relation === 'friend') {
      action = (
        <button className="button primary" onClick={() => onMessage(userId)}>
          Message
        </button>
      );
    } else if (data.relation === 'incoming') {
      action = (
        <button className="button primary" onClick={() => onAccept(userId).then(refresh)}>
          Accept friend request
        </button>
      );
    } else if (data.relation === 'outgoing') {
      action = (
        <button className="button" disabled>
          Request sent
        </button>
      );
    } else {
      action = (
        <button className="button primary" onClick={() => onAddFriend(userId).then(refresh)}>
          Add friend
        </button>
      );
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby={headingId} aria-label={name ? undefined : 'Profile'}>
        <button className="icon-button profile-modal-close" aria-label="Close profile" onClick={onClose}>
          <XIcon />
        </button>
        {error && <p className="form-error">{error}</p>}
        {!user && !error && <p className="hint profile-loading">Loading…</p>}
        {user && (
          <ProfileCardView
            user={user}
            bio={user.bio ?? data?.bio}
            bannerImage={data?.bannerImage}
            joinedAt={data?.joinedAt}
            online={onlineIds.has(userId)}
            headingId={headingId}
          >
            {action && <div className="profile-card-actions">{action}</div>}

            {data && data.relation !== 'self' && (
              <>
                <section className="profile-card-section" aria-label="Shared groups">
                  <h4>{data.sharedGroups.length ? `Shared groups (${data.sharedGroups.length})` : 'Shared groups'}</h4>
                  {data.sharedGroups.length === 0 ? (
                    <p className="hint">No groups in common.</p>
                  ) : (
                    <ul className="chip-list">
                      {data.sharedGroups.map((g) => (
                        <li key={g.id}>
                          <button className="chip" onClick={() => onOpenGroup(g.id)}>
                            {g.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="profile-card-section" aria-label="Mutual friends">
                  <h4>{data.mutualFriends?.length ? `Mutual friends (${data.mutualFriends.length})` : 'Mutual friends'}</h4>
                  {data.mutualFriends === null ? (
                    <p className="hint">Hidden by {name}'s privacy settings.</p>
                  ) : data.mutualFriends.length === 0 ? (
                    <p className="hint">No mutual friends.</p>
                  ) : (
                    <ul className="chip-list">
                      {data.mutualFriends.map((friend) => (
                        <li key={friend.id}>
                          <button className="chip person-chip" onClick={() => onOpenProfile(friend.id)}>
                            <Avatar user={friend} size={22} /> {shownName(friend)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {data.friendCount !== null && (
                    <p className="hint">{plural(data.friendCount, 'friend')} in total</p>
                  )}
                </section>
              </>
            )}
          </ProfileCardView>
        )}
      </div>
    </div>
  );
}
