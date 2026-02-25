import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getHome, getAlbum, getPlaylistTracks, YTMHomeSection, YTMTrack } from '../../api/yt';
import { ArtistCard } from '../molecules/ArtistCard';
import { Skeleton } from '../atoms/Skeleton';
import { LazyImage } from '../atoms/LazyImage';
import { player } from '../../api/player';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import styles from './HomeView.module.css';

interface HomeViewProps {
  onSelectArtist: (id: string) => void;
  onSelectAlbum: (id: string) => void;
  onSelectPlaylist: (id: string, title: string) => void;
  isQueueVisible?: boolean;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onSelectArtist,
  onSelectAlbum,
  onSelectPlaylist,
  isQueueVisible = true
}) => {
  const [sections, setSections] = useState<YTMHomeSection[]>(() => {
    const cached = localStorage.getItem('ytm-home-cache');
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState(sections.length === 0);

  useEffect(() => {
    const load = async () => {
      if (sections.length === 0) setIsLoading(true);
      try {
        const data = await getHome(12);
        if (data && data.length > 0) {
          setSections(data);
          localStorage.setItem('ytm-home-cache', JSON.stringify(data));
        }
      } catch (e) {
        console.error('Failed to load home data', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const handleItemClick = (item: any) => {
    const type = item.type?.toLowerCase();

    if (type === 'artist') {
      onSelectArtist(item.id);
    } else if (type === 'album') {
      onSelectAlbum(item.id);
    } else if (type === 'playlist') {
      onSelectPlaylist(item.id, item.title);
    } else if (type === 'song' || type === 'video') {
      player.playSingle(item as YTMTrack);
    } else {
      if (item.id?.startsWith('UC') || item.id?.startsWith('Fv')) {
        onSelectArtist(item.id);
      } else if (item.id?.startsWith('MPREb')) {
        onSelectAlbum(item.id);
      } else if (item.id?.startsWith('PL') || item.id?.startsWith('VL')) {
        onSelectPlaylist(item.id, item.title);
      }
    }
  };

  const handlePlayClick = async (item: any) => {
    const type = item.type?.toLowerCase();
    
    try {
      if (type === 'song' || type === 'video') {
        await player.playSingle(item as YTMTrack);
      } else if (type === 'album') {
        const albumData = await getAlbum(item.id);
        if (albumData && albumData.tracks && albumData.tracks.length > 0) {
          await player.playTrackList(albumData.tracks);
        }
      } else if (type === 'playlist') {
        const tracks = await getPlaylistTracks(item.id);
        if (tracks && tracks.length > 0) {
          await player.playTrackList(tracks);
        }
      }
    } catch (e) {
      console.error('Failed to start playback from Home:', e);
    }
  };

  if (isLoading && sections.length === 0) {
    return (
      <div className={`${styles.container} ${isQueueVisible ? styles.fullWidth : ''}`}>
        {Array.from({ length: 3 }).map((_, i) => (
          <section key={i} className={styles.section}>
            <Skeleton width={200} height={24} borderRadius={4} style={{ marginBottom: '1.5rem' }} />
            <div className={styles.horizontalScroll}>
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className={styles.cardSkeleton}>
                  <Skeleton width={160} height={160} borderRadius={12} />
                  <Skeleton width={120} height={14} borderRadius={4} style={{ marginTop: '0.75rem' }} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${isQueueVisible ? styles.fullWidth : ''}`}>
      {sections.map((section, i) => (
        <section key={i} className={styles.section}>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
          <HomeSectionContent 
            items={section.contents} 
            onItemClick={handleItemClick} 
            onPlayClick={handlePlayClick}
          />
        </section>
      ))}
    </div>
  );
};

const HomeSectionContent = ({ 
  items, 
  onItemClick, 
  onPlayClick 
}: { 
  items: any[], 
  onItemClick: (item: any) => void,
  onPlayClick: (item: any) => void
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 10);
      setShowRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [items, checkScroll]);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = dir === 'left' ? -600 : 600;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(checkScroll, 400);
    }
  };

  return (
    <div className={styles.scrollWrapper}>
      {showLeft && (
        <button className={`${styles.scrollBtn} ${styles.left}`} onClick={() => scroll('left')}>
          <ChevronLeft size={24} />
        </button>
      )}
      <div className={styles.horizontalScroll} ref={scrollRef} onScroll={checkScroll}>
        {items.map((item, idx) => (
          <div key={(item.id || '') + idx} className={styles.card} onClick={() => onItemClick(item)}>
            <div className={styles.thumbWrapper}>
              <LazyImage 
                src={item.thumbUrl} 
                alt={item.title} 
                className={`${styles.thumb} ${item.type === 'artist' ? styles.artistThumb : ''}`}
                placeholder={<div className={styles.thumbPlaceholder} />}
              />
              {item.type !== 'artist' && (
                <div 
                  className={styles.playOverlay} 
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlayClick(item);
                  }}
                >
                  <Play size={24} fill="currentColor" />
                </div>
              )}
            </div>
            <div className={styles.info}>
              <div className={styles.itemTitle} title={item.title}>{item.title}</div>
              <div className={styles.itemSubtitle}>
                {item.display_type && <span className={styles.typeTag}>{item.display_type}</span>}
                {item.display_type && (item.artists?.length > 0 || item.description) && " • "}
                {item.artists && item.artists.length > 0 ? (
                  item.artists.join(', ')
                ) : item.description ? (
                  item.description
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
      {showRight && (
        <button className={`${styles.scrollBtn} ${styles.right}`} onClick={() => scroll('right')}>
          <ChevronRight size={24} />
        </button>
      )}
    </div>
  );
};
