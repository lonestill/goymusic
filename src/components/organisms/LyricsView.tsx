import React, { useState, useEffect, useRef } from 'react';
import { player } from '../../api/player';
import { Music, AlertCircle } from 'lucide-react';
import styles from './LyricsView.module.css';

interface LyricLine {
  time: number;
  text: string;
}

/**
 * Organism: LyricsView
 * Displays synchronized or static lyrics for the current track.
 * Supports auto-scrolling to the active line.
 */
export const LyricsView: React.FC = () => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveTrackIndex] = useState(-1);
  const [userIsScrolling, setUserIsScrolling] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeout = useRef<any>(null);

  const currentTrackId = player.currentTrack?.id;

  useEffect(() => {
    if (currentTrackId) {
      fetchLyrics(currentTrackId);
    } else {
      setLyrics([]);
    }
  }, [currentTrackId]);

  useEffect(() => {
    // Subscribe to player updates for time synchronization
    return player.subscribe(() => {
      if (lyrics.length > 0) {
        const currentTime = player.currentTime;
        // Find the line that should be active
        let index = -1;
        for (let i = 0; i < lyrics.length; i++) {
          if (lyrics[i].time <= currentTime) {
            index = i;
          } else {
            break;
          }
        }
        setActiveTrackIndex(index);
      }
    });
  }, [lyrics]);

  useEffect(() => {
    // Auto-scroll to active line if user isn't interacting
    if (activeIndex !== -1 && !userIsScrolling && containerRef.current) {
      const activeElement = containerRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [activeIndex, userIsScrolling]);

  const fetchLyrics = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: Implement get_lyrics in Python bridge
      // For now, return empty or mock
      setLyrics([]);
    } catch (e) {
      setError('Failed to load lyrics');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScroll = () => {
    setUserIsScrolling(true);
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      setUserIsScrolling(false);
    }, 3000);
  };

  if (!currentTrackId) {
    return (
      <div className={styles.empty}>
        <Music size={48} strokeWidth={1.5} opacity={0.2} />
        <p>No track playing</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.empty}>
        <div className={styles.loader} />
        <p>Searching for lyrics...</p>
      </div>
    );
  }

  if (error || lyrics.length === 0) {
    return (
      <div className={styles.empty}>
        <AlertCircle size={32} opacity={0.3} />
        <p>{error || 'Lyrics not available for this track'}</p>
      </div>
    );
  }

  return (
    <div
      className={styles.container}
      ref={containerRef}
      onScroll={handleScroll}
    >
      {lyrics.map((line, i) => (
        <div
          key={i}
          className={`${styles.line} ${i === activeIndex ? styles.active : ''}`}
          onClick={() => player.seek(line.time)}
        >
          {line.text}
        </div>
      ))}
    </div>
  );
};
