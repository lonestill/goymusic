import { useState, useEffect } from 'react';
import { AppLayout } from './components/templates/AppLayout';
import { Sidebar } from './components/organisms/Sidebar';
import { PlayerBar } from './components/organisms/PlayerBar';
import { QueuePanel } from './components/organisms/QueuePanel';
import { MainView } from './components/organisms/MainView';
import { TitleBar } from './components/organisms/TitleBar';
import './styles/theme.css';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isQueueVisible, setIsQueueVisible] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
        />
      }
      main={<MainView />}
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
