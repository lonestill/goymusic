import React, { useState, forwardRef, Fragment } from 'react';
import { Play } from 'lucide-react';
import { Visualizer } from '../atoms/Visualizer';
import { LazyImage } from '../atoms/LazyImage';
import styles from './TrackRow.module.css';

interface TrackRowProps {
  index: number;
  title: string;
  artists?: string[];
  artistIds?: string[];
  album: string;
  albumId?: string;
  duration: string;
  thumbUrl?: string;
  isActive?: boolean;
  isPlaying?: boolean;
  onClick?: () => void;
  onSelectArtist?: (id: string) => void;
  onSelectAlbum?: (id: string) => void;
  hideDuration?: boolean;
  className?: string;
  renderOnlyCells?: boolean;
}

/**
 * Molecule: TrackRow
 * A single row in a track list. 
 * Supports rendering as a full <tr> (default) or just cells (for TableVirtuoso).
 */
export const TrackRow = React.memo(forwardRef<HTMLTableRowElement, TrackRowProps>(({
  index,
  title,
  artists = [],
  artistIds = [],
  album,
  albumId,
  duration,
  thumbUrl,
  isActive = false,
  isPlaying = false,
  onClick,
  onSelectArtist,
  onSelectAlbum,
  hideDuration = false,
  className,
  renderOnlyCells = false
}, ref) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleArtistClick = (e: React.MouseEvent, id?: string) => {
    if (id && onSelectArtist) {
      e.stopPropagation();
      onSelectArtist(id);
    }
  };

  const handleAlbumClick = (e: React.MouseEvent) => {
    if (albumId && onSelectAlbum) {
      e.stopPropagation();
      onSelectAlbum(albumId);
    }
  };

  const cells = (
    <>
      <td 
        className={styles.indexCell}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
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
      <td 
        className={styles.titleTd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={styles.titleCell}>
          {thumbUrl && (
            <LazyImage
              src={thumbUrl}
              alt=""
              className={styles.thumb}
              placeholder={<div className={styles.thumbPlaceholder} />}
            />
          )}
          <div className={styles.titleWrapper}>
            <div className={styles.title} title={title}>{title}</div>
            <div className={styles.artist}>
              {artists.map((artist, i) => {
                const id = artistIds[i];
                return (
                  <Fragment key={i}>
                    <span 
                      className={id ? styles.link : ''} 
                      onClick={(e) => handleArtistClick(e, id)}
                      title={artist}
                    >
                      {artist}
                    </span>
                    {i < artists.length - 1 && ', '}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </td>
      <td 
        className={styles.album}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span 
          className={`${styles.albumText} ${albumId ? styles.link : ''}`} 
          title={album}
          onClick={handleAlbumClick}
        >
          {album}
        </span>
      </td>
      {!hideDuration && (
        <td 
          className={styles.duration}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {duration}
        </td>
      )}
    </>
  );

  if (renderOnlyCells) {
    return cells;
  }

  return (
    <tr
      ref={ref}
      className={`${styles.row} ${isActive ? styles.active : ''} ${className || ''}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {cells}
    </tr>
  );
}));

TrackRow.displayName = 'TrackRow';
