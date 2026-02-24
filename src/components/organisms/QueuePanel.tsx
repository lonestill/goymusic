import React, { useState, useEffect } from 'react';
import { player } from '../../api/player';
import styles from './QueuePanel.module.css';

export const QueuePanel: React.FC = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return player.subscribe(() => setTick(t => t + 1));
  }, []);

  const upcoming = player.getUpcoming();

  return (
    <aside className={styles.panel}>
      <h4 className={styles.header}>Next Up</h4>
      <div className={styles.list}>
        {upcoming.length === 0 && (
          <div style={{ opacity: 0.4, padding: '1rem', fontSize: '0.85rem' }}>
            No upcoming tracks
          </div>
        )}
        {upcoming.map((track, i) => (
          <div
            key={`${track.id}-${i}`}
            className={styles.item}
            onClick={() => player.playTrackList(player.queue, player.queueIndex + 1 + i)}
            style={{ cursor: 'pointer' }}
          >
            {track.thumbUrl ? (
              <img
                src={track.thumbUrl} alt=""
                style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }}
              />
            ) : (
              <div className={styles.cover} />
            )}
            <div className={styles.info}>
              <div className={styles.title}>{track.title}</div>
              <div className={styles.artist}>{track.artist}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
