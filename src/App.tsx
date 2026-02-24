import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppLayout } from './components/templates/AppLayout';
import { Sidebar } from './components/organisms/Sidebar';
import { PlayerBar } from './components/organisms/PlayerBar';
import { QueuePanel } from './components/organisms/QueuePanel';
import { MainView } from './components/organisms/MainView';
import { TitleBar } from './components/organisms/TitleBar';
import { SettingsView } from './components/organisms/SettingsView';
import { LyricsView } from './components/organisms/LyricsView';
import { isLoggedIn, clearTokens, getLibraryPlaylists, YTMPlaylist } from './api/yt';
import './styles/theme.css';

export type ViewType = 'liked' | 'playlist' | 'search' | 'settings';

export interface ActiveView {
  type: ViewType;
  playlistId?: string;
  playlistTitle?: string;
  searchQuery?: string;
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [rightPanelContent, setRightPanelContent] = useState<'queue' | 'lyrics' | 'none'>('queue');
  const [playlists, setPlaylists] = useState<YTMPlaylist[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const saved = localStorage.getItem('goymusic-active-view');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return { type: 'liked' };
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(() => isLoggedIn());

  useEffect(() => {
    localStorage.setItem('goymusic-active-view', JSON.stringify(activeView));
  }, [activeView]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      if (isLoggedIn()) {
        try {
          console.log('Restoring session — opening YTM webview...');
          // Open webview to music.youtube.com (cookies preserved by WebView2)
          await invoke('open_ytm_login', {});
          // Wait for YouTube Music to fully load
          console.log('Waiting for YTM to load...');
          await new Promise(r => setTimeout(r, 5000));
          // Hide the window
          try {
            const { Window } = await import('@tauri-apps/api/window');
            const loginWin = await Window.getByLabel('ytm-login');
            if (loginWin) await loginWin.hide();
          } catch (_) { }

          console.log('YTM webview ready, loading data...');
          setIsAuthenticated(true);
          await loadPlaylists();
        } catch (e) {
          console.error('Failed to restore session:', e);
          clearTokens();
        }
      }
      setIsInitializing(false);
    };
    init();
  }, []);

  const loadPlaylists = async () => {
    try {
      const pls = await getLibraryPlaylists();
      setPlaylists(pls);
    } catch (e) {
      console.error('Failed to load playlists', e);
    }
  };

  const onAuthenticated = () => {
    setIsAuthenticated(true);
    loadPlaylists();
  };

  const handleLogout = () => {
    clearTokens();
    setIsAuthenticated(false);
    setPlaylists([]);
    setActiveView({ type: 'liked' });
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => !prev);
  };

  const toggleRightPanel = (panel: 'queue' | 'lyrics') => {
    setRightPanelContent(prev => prev === panel ? 'none' : panel);
  };

  return (
    <AppLayout
      titleBar={<TitleBar theme={theme} onToggleTheme={toggleTheme} />}
      sidebar={
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          playlists={playlists}
          activeView={activeView}
          onSelectView={setActiveView}
          isAuthenticated={isAuthenticated}
          isInitializing={isInitializing}
          onLogout={handleLogout}
        />
      }
      main={
        activeView.type === 'settings' ? (
          <SettingsView onLogout={handleLogout} />
        ) : (
          <MainView
            activeView={activeView}
            isAuthenticated={isAuthenticated}
            isInitializing={isInitializing}
            onAuthenticated={onAuthenticated}
            onSearch={(q: string) => setActiveView({ type: 'search', searchQuery: q })}
          />
        )
      }
      rightPanel={rightPanelContent === 'queue' ? <QueuePanel /> : rightPanelContent === 'lyrics' ? <LyricsView /> : undefined}
      playerBar={
        <PlayerBar
          activeRightPanel={rightPanelContent}
          onToggleRightPanel={toggleRightPanel}
        />
      }
      isSidebarCollapsed={isSidebarCollapsed}
      isQueueVisible={rightPanelContent !== 'none'}
    />
  );
}

export default App;
