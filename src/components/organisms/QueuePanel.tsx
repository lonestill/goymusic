import React from 'react';
import styles from './QueuePanel.module.css';

interface QueueItemProps {
  title: string;
  artist: string;
  hasGlow?: boolean;
}

const QueueItem: React.FC<QueueItemProps> = ({ title, artist, hasGlow }) => (
  <div className={styles.item}>
    <div className={`${styles.cover} ${hasGlow ? styles.glow : ''}`} />
    <div className={styles.info}>
      <div className={styles.title}>{title}</div>
      <div className={styles.artist}>{artist}</div>
    </div>
  </div>
);

/**
 * Organism: QueuePanel
 * The right panel displaying the "Next Up" queue.
 */
export const QueuePanel: React.FC = () => {
  return (
    <aside className={styles.panel}>
      <h4 className={styles.header}>Next Up</h4>
      <div className={styles.list}>
        <QueueItem title="Blinding Lights" artist="The Weeknd" />
        <QueueItem title="Save Your Tears" artist="The Weeknd" hasGlow />
        <QueueItem title="In Your Eyes" artist="The Weeknd" />
      </div>
    </aside>
  );
};
