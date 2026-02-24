import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppLayout } from './components/templates/AppLayout';
import { Sidebar } from './components/organisms/Sidebar';
import { PlayerBar } from './components/organisms/PlayerBar';
import { QueuePanel } from './components/organisms/QueuePanel';
import { MainView } from './components/organisms/MainView';
import { TitleBar } from './components/organisms/TitleBar';
import { isLoggedIn, clearTokens, getLibraryPlaylists, YTMPlaylist } from './api/yt';
import './styles/theme.css';

export type ViewType = 'liked' | 'playlist' | 'search';

export interface ActiveView {
  type: ViewType;
  playlistId?: string;
  playlistTitle?: string;
  searchQuery?: string;
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(true);
  const [playlists, setPlaylists] = useState<YTMPlaylist[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'liked' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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
          loadPlaylists();
        } catch (e) {
          console.error('Failed to restore session:', e);
          clearTokens();
        }
      }
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

  const toggleQueue = () => {
    setIsQueueVisible(prev => !prev);
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
          onLogout={handleLogout}
        />
      }
      main={
        <MainView
          activeView={activeView}
          isAuthenticated={isAuthenticated}
          onAuthenticated={onAuthenticated}
          onSearch={(q: string) => setActiveView({ type: 'search', searchQuery: q })}
        />
      }
      rightPanel={isQueueVisible ? <QueuePanel /> : undefined}
      playerBar={
        <PlayerBar
          queueVisible={isQueueVisible}
          onToggleQueue={toggleQueue}
        />
      }
      isSidebarCollapsed={isSidebarCollapsed}
      isQueueVisible={isQueueVisible}
    />
  );
}

export default App;
