import React, { useEffect, useState } from 'react';
import { player } from '../../api/player';
import styles from './AppLayout.module.css';

interface AppLayoutProps {
  titleBar: React.ReactNode;
  sidebar: React.ReactNode;
  main: React.ReactNode;
  rightPanel?: React.ReactNode;
  playerBar: React.ReactNode;
  isSidebarCollapsed?: boolean;
  isQueueVisible?: boolean;
}

/**
 * Template: AppLayout
 * The main application layout with TitleBar, Sidebar, Main content, Queue, and PlayerBar.
 * Enforces the responsive layout with a minimum size floor and dynamic panels.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  titleBar,
  sidebar,
  main,
  rightPanel,
  playerBar,
  isSidebarCollapsed = false,
  isQueueVisible = true
}) => {
  const [thumb, setThumb] = useState(player.currentTrack?.thumbUrl || '');

  useEffect(() => {
    return player.subscribe(() => {
      setThumb(player.currentTrack?.thumbUrl || '');
    });
  }, []);

  return (
    <div
      className={`${styles.appWindow} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''} ${!isQueueVisible ? styles.queueHidden : ''}`}
    >
      {/* Ambient background layer */}
      {thumb && (
        <div
          className={styles.ambientBlur}
          style={{ backgroundImage: `url(${thumb})` }}
        />
      )}

      {titleBar}
      {sidebar}
      <main className={styles.main}>
        <div className={styles.scrollContent}>
          {main}
        </div>
      </main>
      {rightPanel}
      {playerBar}
    </div>
  );
};
