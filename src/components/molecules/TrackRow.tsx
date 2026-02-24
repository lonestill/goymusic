import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { Visualizer } from '../atoms/Visualizer';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  index: number;
  title: string;
  artist: string;
  album: string;
  duration: string;
  thumbUrl?: string;
  isActive?: boolean;
  isPlaying?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Molecule: TrackRow
 * A single row in a track list. Now with sleek design and hover states.
 */
export const TrackRow: React.FC<TrackRowProps> = ({
  index,
  title,
  artist,
  album,
  duration,
  thumbUrl,
  isActive = false,
  isPlaying = false,
  onClick,
  className
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <tr
      className={`${styles.row} ${isActive ? styles.active : ''} animate-slide-up ${className || ''}`}
      style={{ animationDelay: `${index * 0.03}s` }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <td className={styles.indexCell}>
        <div className={styles.indexWrapper}>
          {isHovered ? (
            <Play size={14} className={styles.playIcon} fill="currentColor" />
          ) : isActive ? (
            <Visualizer isPlaying={isPlaying} />
          ) : (
            <span className={styles.indexText}>{index}</span>
          )}
        </div>
      </td>
      <td className={styles.titleTd}>
        <div className={styles.titleCell}>
          {thumbUrl && (
            <img
              src={thumbUrl}
              alt=""
              className={styles.thumb}
            />
          )}
          <div className={styles.titleWrapper}>
            <div className={styles.title} title={title}>{title}</div>
            <div className={styles.artist} title={artist}>{artist}</div>
          </div>
        </div>
      </td>
      <td className={styles.album}>
        <span className={styles.albumText} title={album}>{album}</span>
      </td>
      <td className={styles.duration}>{duration}</td>
    </tr>
  );
};
