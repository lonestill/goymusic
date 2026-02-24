import React, { useState } from 'react';
import { X, Minus, Square, Sun, Moon } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

/**
 * Organism: TitleBar
 * Custom draggable title bar with window controls for Tauri.
 * Includes a theme toggle button.
 */
export const TitleBar: React.FC<TitleBarProps> = ({ theme, onToggleTheme }) => {
  const onMinimize = async () => {
    const window = getCurrentWindow();
    await window.minimize();
  };

  const onMaximize = async () => {
    const window = getCurrentWindow();
    await window.toggleMaximize();
  };

  const onClose = async () => {
    const window = getCurrentWindow();
    await window.close();
  };

  const [clickCount, setClickCount] = useState(0);

  const handleTitleClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);

    if (newCount === 5) {
      document.body.classList.add('mushroom-trip');
    } else if (newCount >= 10) {
      document.body.classList.remove('mushroom-trip');
      setClickCount(0);
    }
  };

  return (
    <div className={styles.titlebar}>
      <div
        data-tauri-drag-region
        className={styles.dragRegion}
        onDoubleClick={onMaximize}
      >
        <div
          className={styles.title}
          onClick={handleTitleClick}
          style={{ pointerEvents: 'auto', cursor: 'grab' }}
        >
          GoyMusic
        </div>
      </div>

      <div className={styles.controls}>
        <div className={styles.button} onClick={onToggleTheme} title="Toggle Theme">
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </div>
        <div className={styles.divider} />
        <div className={styles.button} onClick={onMinimize} title="Minimize">
          <Minus size={14} />
        </div>
        <div className={styles.button} onClick={onMaximize} title="Maximize">
          <Square size={12} />
        </div>
        <div className={`${styles.button} ${styles.close}`} onClick={onClose} title="Close">
          <X size={14} />
        </div>
      </div>
    </div>
  );
};

