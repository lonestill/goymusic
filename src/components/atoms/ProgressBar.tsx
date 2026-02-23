import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  progress: number; // 0 to 100
  className?: string;
}

/**
 * Atom: ProgressBar
 * A minimalist progress bar used for playback and volume.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, className }) => {
  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div 
        className={styles.fill} 
        style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} 
      />
    </div>
  );
};
