import React from 'react';
import { TrackRow } from '../molecules/TrackRow';
import styles from './MainView.module.css';

/**
 * Organism: MainView
 * The central content area displaying playlist/album details and track lists.
 */
export const MainView: React.FC = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.cover} />
        <div className={styles.info}>
          <div className={styles.label}>PLAYLIST</div>
          <h1 className={styles.title}>Late Night Vibes</h1>
          <div className={styles.meta}>Created by <span className={styles.white}>You</span> • 24 songs, 1 hr 15 min</div>
        </div>
      </header>

      <table className={styles.trackList}>
        <thead>
          <tr className={styles.tableHeader}>
            <th style={{ textAlign: 'left', width: '40px' }}>#</th>
            <th style={{ textAlign: 'left' }}>Title</th>
            <th style={{ textAlign: 'left' }}>Album</th>
            <th style={{ textAlign: 'right' }}>Time</th>
          </tr>
        </thead>
        <tbody>
          <TrackRow 
            index={1} 
            title="Midnight City" 
            artist="M83" 
            album="Hurry Up, We're Dreaming" 
            duration="4:03" 
          />
          <TrackRow 
            index={2} 
            title="Starboy" 
            artist="The Weeknd" 
            album="Starboy" 
            duration="3:50" 
            isActive 
          />
          <TrackRow 
            index={3} 
            title="Blinding Lights" 
            artist="The Weeknd" 
            album="After Hours" 
            duration="3:20" 
          />
        </tbody>
      </table>
    </div>
  );
};
