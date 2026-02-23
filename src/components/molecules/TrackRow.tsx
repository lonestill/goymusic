import React from 'react';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  index: number;
  title: string;
  artist: string;
  album: string;
  duration: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Molecule: TrackRow
 * A single row in a track list.
 */
export const TrackRow: React.FC<TrackRowProps> = ({
  index,
  title,
  artist,
  album,
  duration,
  isActive = false,
  onClick,
  className
}) => {
  return (
    <tr 
      className={`${styles.row} ${isActive ? styles.active : ''} ${className || ''}`}
      onClick={onClick}
    >
      <td className={styles.index}>{index}</td>
      <td className={styles.titleCell}>
        <div className={styles.title}>{title}</div>
        <div className={styles.artist}>{artist}</div>
      </td>
      <td className={styles.album}>{album}</td>
      <td className={styles.duration}>{duration}</td>
    </tr>
  );
};
