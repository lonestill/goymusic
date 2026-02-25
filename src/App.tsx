import { useState, useEffect, useCallback, useMemo } from 'react';
import { AppLayout } from './components/templates/AppLayout';
import { Sidebar } from './components/organisms/Sidebar';
import { PlayerBar } from './components/organisms/PlayerBar';
import { QueuePanel } from './components/organisms/QueuePanel';
import { MainView } from './components/organisms/MainView';
import { ArtistView } from './components/organisms/ArtistView';
import { HomeView } from './components/organisms/HomeView';
import { TitleBar } from './components/organisms/TitleBar';
import { SettingsView } from './components/organisms/SettingsView';
import { LyricsView } from './components/organisms/LyricsView';
import { isLoggedIn, clearTokens, getLibraryPlaylists, getUserInfo, YTMPlaylist, YTMUser } from './api/yt';
import { ViewType, ActiveView } from './types';
import './styles/theme.css';
import './styles/base.css';

declare global {
  interface Window {
    bridge: {
      ping: () => Promise<string>
      pyCall: (command: string, args?: any) => Promise<any>
      onPyEvent: (callback: (msg: any) => void) => void
      openExternal: (url: string) => Promise<void>
      authStart: () => Promise<{ status: string, message?: string }>
      winMinimize: () => void
      winMaximize: () => void
      winClose: () => void
    }
  }
}

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [rightPanelContent, setRightPanelContent] = useState<'queue' | 'lyrics' | 'none'>('queue');
  const [playlists, setPlaylists] = useState<YTMPlaylist[]>([]);
  const [user, setUser] = useState<YTMUser | null>(null);
  
  // Navigation History
  const [history, setHistory] = useState<ActiveView[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    const saved = localStorage.getItem('goymusic-active-view');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.type === 'auth') return { type: 'home' };
        return parsed;
      } catch (e) { }
    }
    return { type: 'home' };
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Key to force re-render/refresh of views
  const [refreshKey, setRefreshKey] = useState(0);

  // New: state to hide global back button if a subview handles its own back navigation
  const [hideGlobalBack, setHideGlobalBack] = useState(false);

  useEffect(() => {
    localStorage.setItem('goymusic-active-view', JSON.stringify(activeView));
  }, [activeView]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const loadPlaylists = useCallback(async () => {
    try {
      const pls = await getLibraryPlaylists();
      setPlaylists(Array.isArray(pls) ? pls : []);
    } catch (e) {
      console.error('Failed to load playlists', e);
      setPlaylists([]);
    }
  }, []);

  const loadUserInfo = useCallback(async () => {
    try {
      console.log('[App] Fetching user info...');
      const info = await getUserInfo();
      console.log('[App] Setting user info:', info);
      setUser(info);
    } catch (e) {
      console.error('Failed to load user info', e);
    }
  }, []);

  const init = async () => {
    setIsInitializing(true);
    try {
      console.log('[App] Initializing auth...');
      const authed = await isLoggedIn();
      console.log('[App] Auth status:', authed);
      setIsAuthenticated(authed);
      if (authed) {
        console.log('[App] Loading library data...');
        await Promise.all([loadPlaylists(), loadUserInfo()]);
      }
    } catch (e) {
      console.error('Init failed:', e);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    init();

    window.bridge.onPyEvent((msg) => {
      if (msg.event === 'auth_complete') {
        setIsAuthenticated(true);
        setIsAuthenticating(false);
        loadPlaylists();
        loadUserInfo();
        navigate({ type: 'home' });
      } else if (msg.event === 'auth_error') {
        setAuthError(msg.message);
        setIsAuthenticating(false);
      }
    });

    const handleError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [loadPlaylists, loadUserInfo]);

  const navigate = useCallback((view: ActiveView) => {
    setActiveView(prev => {
      if (JSON.stringify(view) === JSON.stringify(prev)) return prev;
      setHistory(h => [...h, prev]);
      return view;
    });
    setHideGlobalBack(false);
  }, []);

  const handleBack = useCallback(() => {
    setHistory(prev => {
      const newHistory = [...prev];
      const previousView = newHistory.pop();
      if (previousView) {
        setActiveView(previousView);
        setHideGlobalBack(false);
      }
      return newHistory;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
    if (isAuthenticated) {
      loadPlaylists();
      loadUserInfo();
    }
  }, [isAuthenticated, loadPlaylists, loadUserInfo]);

  const handleLogout = useCallback(async () => {
    await clearTokens();
    setIsAuthenticated(false);
    setPlaylists([]);
    setUser(null);
    setHistory([]);
    setActiveView({ type: 'home' });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => !prev);
  }, []);

  const toggleRightPanel = useCallback((panel: 'queue' | 'lyrics') => {
    setRightPanelContent(prev => prev === panel ? 'none' : panel);
  }, []);

  const handleSelectArtist = useCallback((id: string) => {
    navigate({ type: 'artist', artistId: id });
  }, [navigate]);

  const handleSelectAlbum = useCallback((id: string) => {
    navigate({ type: 'album', albumId: id });
  }, [navigate]);

  const handleSelectPlaylist = useCallback((id: string, title: string) => {
    navigate({ type: 'playlist', playlistId: id, playlistTitle: title });
  }, [navigate]);

  const handleSearch = useCallback((q: string) => {
    navigate({ type: 'search', searchQuery: q });
  }, [navigate]);

  const handleArtistViewModeChange = useCallback((mode: string) => {
    setHideGlobalBack(mode !== 'main');
  }, []);

  const startLogin = async () => {
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const res = await window.bridge.authStart();
      if (res.status === 'error') {
        setAuthError(res.message || 'Authentication failed');
        setIsAuthenticating(false);
      } else if (res.status === 'cancelled') {
        setIsAuthenticating(false);
      }
    } catch (e: any) {
      setAuthError(e.message);
      setIsAuthenticating(false);
    }
  };

  // Memoized Content Area
  const mainContent = useMemo(() => {
    // Generate a unique key for the view to force remount on section change
    const viewKey = `${activeView.type}-${activeView.playlistId || ''}-${activeView.artistId || ''}-${activeView.albumId || ''}-${refreshKey}`;

    return (
      <div style={{ height: '100%' }}>
        {activeView.type === 'settings' ? (
          <SettingsView key="settings" onLogout={handleLogout} />
        ) : activeView.type === 'artist' && activeView.artistId ? (
          <ArtistView 
            key={`artist-${activeView.artistId}`}
            artistId={activeView.artistId} 
            onSelectArtist={handleSelectArtist} 
            onSelectAlbum={handleSelectAlbum}
            onViewModeChange={handleArtistViewModeChange}
          />
        ) : activeView.type === 'home' ? (
          <HomeView
            key="home"
            onSelectArtist={handleSelectArtist}
            onSelectAlbum={handleSelectAlbum}
            onSelectPlaylist={handleSelectPlaylist}
            isQueueVisible={rightPanelContent !== 'none'}
          />
        ) : (
          <MainView
            key={viewKey}
            activeView={activeView}
            isAuthenticated={isAuthenticated}
            isInitializing={isInitializing}
            onSearch={handleSearch}
            onSelectArtist={handleSelectArtist}
            onSelectAlbum={handleSelectAlbum}
            onBack={handleBack}
            canGoBack={history.length > 0}
          />
        )}
      </div>
    );
  }, [refreshKey, activeView, isAuthenticated, isInitializing, handleLogout, handleSelectArtist, handleSelectAlbum, handleSelectPlaylist, handleArtistViewModeChange, handleSearch, handleBack, history.length, rightPanelContent]);

  // Auth Overlay
  const AuthOverlay = () => (
    <div style={{ 
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: '#09090f', display: 'flex', flexDirection: 'column',
      color: '#ffffff'
    }}>
      <TitleBar theme={theme} onToggleTheme={toggleTheme} />
      <div style={{ 
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', 
        justifyContent: 'center', gap: '2rem', padding: '2rem', textAlign: 'center'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h1 style={{ 
            fontSize: 'min(4.5rem, 12vh)', fontWeight: 900, marginBottom: '0.5rem', 
            background: 'linear-gradient(135deg, #89b4fa 0%, #b4befe 100%)', 
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 30px rgba(137,180,250,0.3))'
          }}>
            GoyMusic
          </h1>
          <p style={{ opacity: 0.9, fontSize: '1.25rem', fontWeight: 600, color: '#cdd6f4' }}>Your YouTube Music library, refined.</p>
        </div>
        
        {authError && (
          <div style={{ 
            color: '#f38ba8', backgroundColor: 'rgba(243,139,168,0.15)', 
            padding: '1rem 2rem', borderRadius: '12px', border: '1px solid rgba(243,139,168,0.3)',
            maxWidth: '400px'
          }}>
            <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>Login Issue</p>
            <p style={{ opacity: 0.9, fontSize: '0.9rem' }}>{authError}</p>
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <button 
            onClick={startLogin}
            disabled={isAuthenticating}
            style={{ 
              padding: '1.25rem 3.5rem', backgroundColor: '#89b4fa', border: 'none', 
              borderRadius: '20px', cursor: isAuthenticating ? 'default' : 'pointer', 
              color: '#11111b', fontWeight: 800, fontSize: '1.4rem',
              boxShadow: '0 10px 40px rgba(137,180,250,0.4)', 
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: isAuthenticating ? 0.7 : 1,
              transform: isAuthenticating ? 'scale(0.98)' : 'none'
            }}
          >
            {isAuthenticating ? 'Opening login window...' : 'Sign in with YouTube'}
          </button>
          
          <div style={{ 
            marginTop: '1.5rem', opacity: 0.6, fontSize: '0.9rem', 
            maxWidth: '300px', marginInline: 'auto' 
          }}>
            A separate window will open for you to sign in. We'll automatically handle the rest.
          </div>
        </div>
      </div>
    </div>
  );

  if (isInitializing) {
    return (
      <div style={{ height: '100vh', width: '100vw', backgroundColor: '#09090f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cdd6f4' }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1.5rem', opacity: 0.9, fontSize: '1.5rem', fontWeight: 600 }}>GoyMusic</h2>
          <div className="loading-spinner" style={{ width: '40px', height: '40px', border: '4px solid rgba(137,180,250,0.1)', borderTopColor: '#89b4fa', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }}></div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthOverlay />;
  }

  return (
    <AppLayout
      titleBar={
        <TitleBar 
          theme={theme} 
          onToggleTheme={toggleTheme} 
          onBack={handleBack}
          onRefresh={handleRefresh}
          onSearch={handleSearch}
          canGoBack={history.length > 0 && !hideGlobalBack}
        />
      }
      onBack={handleBack}
      canGoBack={history.length > 0 && !hideGlobalBack}
      sidebar={
        <Sidebar
          collapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          playlists={playlists}
          activeView={activeView}
          onSelectView={navigate}
          isAuthenticated={isAuthenticated}
          isInitializing={isInitializing}
          onLogout={handleLogout}
          user={user}
        />
      }
      rightPanel={rightPanelContent === 'queue' ? <QueuePanel onSelectAlbum={handleSelectAlbum} /> : rightPanelContent === 'lyrics' ? <LyricsView /> : undefined}
      playerBar={
        <PlayerBar
          activeRightPanel={rightPanelContent}
          onToggleRightPanel={toggleRightPanel}
          onSelectArtist={handleSelectArtist}
        />
      }
      isSidebarCollapsed={isSidebarCollapsed}
      isQueueVisible={rightPanelContent !== 'none'}
    >
      {mainContent}
    </AppLayout>
  );
}

export default App;
