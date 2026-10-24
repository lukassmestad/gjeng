import { useEffect, useState } from 'react';
import { readAsDataUrl, storage } from '../lib.js';
import { stickerGif, STICKERS } from '../stickers.js';

const TABS = { stickers: 'Stickers', recent: 'Recent', favorites: 'Favourites' };

// GIFs: our own animated stickers, GIFs people have sent in your chats, and the ones you've starred.
export default function GifPanel({ userId, recentGifs, onSend }) {
  const favoritesKey = `gjeng.gifFavorites.${userId}`;
  const [tab, setTab] = useState('stickers');
  const [query, setQuery] = useState('');
  const [made, setMade] = useState({}); // sticker id -> gif data URL
  const [favorites, setFavorites] = useState(() => storage.get(favoritesKey, []));
  const [sending, setSending] = useState(null);

  // Make the sticker GIFs one by one, showing each as soon as it's ready.
  useEffect(() => {
    let live = true;
    (async () => {
      for (const sticker of STICKERS) {
        const gif = await stickerGif(sticker);
        if (!live) return;
        setMade((prev) => ({ ...prev, [sticker.id]: gif }));
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => storage.set(favoritesKey, favorites), [favoritesKey, favorites]);

  const stickerItems = STICKERS.map((s) => ({ key: `sticker:${s.id}`, sticker: s, label: s.label, search: `${s.label} ${s.tags}`, src: made[s.id]?.data }));
  const recentItems = recentGifs.map((g) => ({ key: `url:${g.url}`, url: g.url, label: g.name, search: g.name, src: g.url }));
  const byKey = new Map([...stickerItems, ...recentItems].map((item) => [item.key, item]));
  // Favourites keep a copy of what they need, so a starred GIF stays even after it leaves "Recent".
  const favoriteItems = favorites.map((f) => byKey.get(f.key) ?? { ...f, src: f.url, search: f.label });

  const items = { stickers: stickerItems, recent: recentItems, favorites: favoriteItems }[tab];
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter((item) => words.every((w) => item.search.toLowerCase().includes(w)));
  const isFavorite = (key) => favorites.some((f) => f.key === key);

  function toggleFavorite(item) {
    setFavorites((list) =>
      list.some((f) => f.key === item.key)
        ? list.filter((f) => f.key !== item.key)
        : [...list, { key: item.key, label: item.label, ...(item.url && { url: item.url }) }],
    );
  }

  async function send(item) {
    setSending(item.key);
    try {
      if (item.sticker) {
        const gif = await stickerGif(item.sticker);
        await onSend({ kind: 'image', name: `${item.sticker.id}.gif`, ...gif });
      } else {
        // A GIF someone sent before: fetch it and send it again.
        const data = await readAsDataUrl(await (await fetch(item.url)).blob());
        await onSend({ kind: 'image', name: item.label, data });
      }
    } finally {
      setSending(null);
    }
  }

  return (
    <div className="gif-panel">
      <input
        type="search"
        className="search-input"
        aria-label="Search GIFs"
        placeholder="Search GIFs…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="segmented" role="tablist" aria-label="GIF lists">
        {Object.entries(TABS).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="hint gif-empty">
          {tab === 'favorites'
            ? 'Star a GIF to keep it here.'
            : tab === 'recent'
              ? 'GIFs sent in your chats show up here.'
              : 'No stickers match that search.'}
        </p>
      ) : (
        <ul className="gif-grid" aria-label={TABS[tab]}>
          {shown.map((item) => (
            <li key={item.key} className="gif-item">
              <button
                type="button"
                className="gif-send"
                aria-label={`Send ${item.label} GIF`}
                disabled={!item.src || sending === item.key}
                onClick={() => send(item)}
              >
                {item.src ? <img src={item.src} alt="" loading="lazy" /> : <span className="gif-loading" />}
              </button>
              <button
                type="button"
                className={`gif-star ${isFavorite(item.key) ? 'on' : ''}`}
                aria-label={isFavorite(item.key) ? `Remove ${item.label} from favourites` : `Add ${item.label} to favourites`}
                aria-pressed={isFavorite(item.key)}
                onClick={() => toggleFavorite(item)}
              >
                ★
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="gif-credit">Stickers are drawn by Gjeng itself. No outside GIF service is used.</p>
    </div>
  );
}
