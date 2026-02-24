import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { TrackRow } from '../molecules/TrackRow';
import { getLikedSongs, getPlaylistTracks, searchMusic, YTMTrack } from '../../api/yt';
import { player } from '../../api/player';
import { ActiveView } from '../../App';
import { Loader2, Search, LogIn, CheckCircle } from 'lucide-react';
import styles from './MainView.module.css';

interface MainViewProps {
  activeView: ActiveView;
  isAuthenticated: boolean;
  onAuthenticated: () => void;
  onSearch: (query: string) => void;
}

/**
 * Organism: MainView
 * The central content area displaying playlist/album details and track lists.
 */
export const MainView: React.FC<MainViewProps> = ({ activeView, isAuthenticated, onAuthenticated, onSearch }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [tracks, setTracks] = useState<YTMTrack[]>([]);

  const [loginStep, setLoginStep] = useState<'idle' | 'window-open' | 'extracting' | 'done'>('idle');
  const [loginError, setLoginError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Keep track of active track ID to update highlights when auto-playing
  const [activeTrackId, setActiveTrackId] = useState<string | undefined>(player.currentTrack?.id);

  useEffect(() => {
    return player.subscribe(() => {
      // Only trigger re-render if the ID actually changed
      setActiveTrackId(prev => {
        if (prev !== player.currentTrack?.id) return player.currentTrack?.id;
        return prev;
      });
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadContent();
    }
  }, [activeView, isAuthenticated]);

  const loadContent = async () => {
    setIsLoading(true);
    try {
      let result: YTMTrack[] = [];

      if (activeView.type === 'liked') {
        result = await getLikedSongs();
      } else if (activeView.type === 'playlist' && activeView.playlistId) {
        result = await getPlaylistTracks(activeView.playlistId);
      } else if (activeView.type === 'search' && activeView.searchQuery) {
        result = await searchMusic(activeView.searchQuery);
      }

      setTracks(result);
    } catch (e) {
      console.error('Failed to load content', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenLogin = async () => {
    setLoginError('');
    try {
      await invoke('open_ytm_login', { loginMode: true });
      setLoginStep('window-open');
    } catch (e: any) {
      setLoginError(e?.toString() || 'Failed to open login window');
    }
  };

  const handleExtractCookies = async () => {
    setLoginStep('extracting');
    setLoginError('');
    try {
      // Mark as logged in — the webview stays alive in background for API calls
      const { setLoggedIn } = await import('../../api/yt');
      setLoggedIn(true);

      // Hide the login window (keep it alive for API proxy)
      try {
        const { Window } = await import('@tauri-apps/api/window');
        const loginWin = await Window.getByLabel('ytm-login');
        if (loginWin) await loginWin.hide();
      } catch (e) {
        console.warn('Could not hide login window:', e);
      }

      setLoginStep('done');
      setTimeout(() => {
        onAuthenticated();
      }, 500);
    } catch (e: any) {
      console.error('Login completion failed:', e);
      setLoginError(e?.toString() || 'Something went wrong.');
      setLoginStep('window-open');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  // Not authenticated — show login
  if (!isAuthenticated) {
    return (
      <div className={styles.container} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem' }}>Welcome to GoyMusic</h2>
        <p style={{ opacity: 0.6, maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
          Sign in with your YouTube Music account to access your playlists, liked songs, and more.
        </p>

        {loginStep === 'idle' && (
          <button
            onClick={handleOpenLogin}
            style={{
              padding: '0.9rem 2rem', background: 'linear-gradient(135deg, #ff0000, #cc0000)',
              color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer',
              fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
              boxShadow: '0 4px 20px rgba(255,0,0,0.3)', transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.03)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            <LogIn size={20} /> Sign in with YouTube Music
          </button>
        )}

        {loginStep === 'window-open' && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              padding: '1rem 1.5rem', background: 'var(--bg-layer-2)', borderRadius: '12px',
              border: '1px solid var(--border-subtle)', maxWidth: 380
            }}>
              <p style={{ marginBottom: '0.5rem', fontWeight: 500 }}>
                📌 A login window has opened
              </p>
              <p style={{ opacity: 0.7, fontSize: '0.9rem', lineHeight: 1.5 }}>
                Sign in to your Google account in that window. Once you see YouTube Music loaded, click the button below.
              </p>
            </div>
            <button
              onClick={handleExtractCookies}
              style={{
                padding: '0.8rem 1.5rem', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer',
                fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem',
                boxShadow: '0 4px 16px rgba(34,197,94,0.3)'
              }}
            >
              <CheckCircle size={18} /> I'm logged in — connect
            </button>
          </div>
        )}

        {loginStep === 'extracting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: 0.8 }}>
            <Loader2 className="animate-spin" size={20} /> Extracting session...
          </div>
        )}

        {loginStep === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#22c55e' }}>
            <CheckCircle size={20} /> Connected! Loading your music...
          </div>
        )}

        {loginError && (
          <div style={{ color: '#ef4444', fontSize: '0.9rem', maxWidth: 400, textAlign: 'center' }}>
            {loginError}
          </div>
        )}
      </div>
    );
  }

  // Search view
  if (activeView.type === 'search') {
    return (
      <div className={styles.container}>
        <header className={styles.header} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <h1 className={styles.title}>Search</h1>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for songs, artists, albums..."
              style={{
                flex: 1, padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)',
                background: 'var(--bg-layer-2)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none'
              }}
            />
            <button type="submit" style={{
              padding: '0.75rem 1rem', background: 'var(--color-primary)', color: '#fff', border: 'none',
              borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem'
            }}>
              <Search size={16} /> Search
            </button>
          </form>
        </header>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <table className={styles.trackList}>
            <thead>
              <tr className={styles.tableHeader}>
                <th style={{ textAlign: 'left', width: '40px' }}>#</th>
                <th style={{ textAlign: 'left' }}>Title</th>
                <th style={{ textAlign: 'left' }}>Album</th>
                <th style={{ textAlign: 'right' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {tracks.map((track, i) => (
                <TrackRow
                  key={track.id}
                  index={i + 1}
                  title={track.title}
                  artist={track.artist}
                  album={track.album}
                  duration={track.duration}
                  thumbUrl={track.thumbUrl}
                  isActive={activeTrackId === track.id}
                  onClick={() => player.playTrackList(tracks, i)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // Liked songs or Playlist view
  const viewTitle = activeView.type === 'liked' ? 'Liked Songs' : (activeView.playlistTitle || 'Playlist');
  const viewLabel = activeView.type === 'liked' ? 'AUTO PLAYLIST' : 'PLAYLIST';

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div
          className={styles.cover}
          style={{
            backgroundImage: tracks[0]?.thumbUrl ? `url(${tracks[0].thumbUrl})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className={styles.info}>
          <div className={styles.label}>{viewLabel}</div>
          <h1 className={styles.title}>{viewTitle}</h1>
          <div className={styles.meta}>
            {tracks.length} songs
          </div>
        </div>
      </header>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <table className={styles.trackList}>
          <thead>
            <tr className={styles.tableHeader}>
              <th style={{ textAlign: 'left', width: '40px' }}>#</th>
              <th style={{ textAlign: 'left' }}>Title</th>
              <th style={{ textAlign: 'left' }}>Album</th>
              <th style={{ textAlign: 'right' }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((track, i) => (
              <TrackRow
                key={track.id}
                index={i + 1}
                title={track.title}
                artist={track.artist}
                album={track.album}
                duration={track.duration}
                thumbUrl={track.thumbUrl}
                isActive={activeTrackId === track.id}
                onClick={() => player.playTrackList(tracks, i)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
