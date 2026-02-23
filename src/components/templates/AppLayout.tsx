import React from 'react';
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
  return (
    <div 
      className={`${styles.appWindow} ${isSidebarCollapsed ? styles.sidebarCollapsed : ''} ${!isQueueVisible ? styles.queueHidden : ''}`}
    >
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
