import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { getArtistDetail, getArtistSongs, YTMArtistDetail, YTMTrack } from '../../api/yt';
import { TrackRow } from '../molecules/TrackRow';
import { ArtistCard } from '../molecules/ArtistCard';
import { Skeleton } from '../atoms/Skeleton';
import { TrackRowSkeleton } from '../molecules/TrackRowSkeleton';
import { LazyImage } from '../atoms/LazyImage';
import { player } from '../../api/player';
import { ChevronRight, ArrowLeft, ChevronLeft } from 'lucide-react';
import styles from './ArtistView.module.css';
import trackStyles from '../molecules/TrackRow.module.css';

interface ArtistViewProps {
  artistId: string;
  onSelectArtist: (id: string) => void;
  onSelectAlbum: (id: string) => void;
  onViewModeChange?: (mode: ViewMode) => void;
}

type ViewMode = 'main' | 'all-songs' | 'discography';

export const ArtistView = React.memo<ArtistViewProps>(({ 
  artistId, 
  onSelectArtist,
  onSelectAlbum,
  onViewModeChange
}) => {
  const [detail, setDetail] = useState<YTMArtistDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [allSongs, setAllSongs] = useState<YTMTrack[]>([]);
  const [isSongsLoading, setIsSongsLoading] = useState(false);
  const [discoCategory, setDiscoCategory] = useState<'Album' | 'Single'>('Album');

  const [activeTrackId, setActiveTrackId] = useState<string | undefined>(player.currentTrack?.id);
  const [isPlaying, setIsPlaying] = useState<boolean>(player.isPlaying);

  const containerRef = useRef<HTMLDivElement>(null);
  const discographyScrollRef = useRef<HTMLDivElement>(null);
  const relatedScrollRef = useRef<HTMLDivElement>(null);

  const [discoScroll, setDiscoScroll] = useState({ left: false, right: false });
  const [relatedScroll, setRelatedScroll] = useState({ left: false, right: false });

  const checkScroll = useCallback((ref: React.RefObject<HTMLDivElement | null>, setter: (val: {left: boolean, right: boolean}) => void) => {
    if (ref.current) {
      const { scrollLeft, scrollWidth, clientWidth } = ref.current;
      setter({
        left: scrollLeft > 10,
        right: scrollLeft + clientWidth < scrollWidth - 10
      });
    }
  }, []);

  useEffect(() => {
    return player.subscribe(() => {
      setActiveTrackId(player.currentTrack?.id);
      setIsPlaying(player.isPlaying);
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setViewMode('main');
      const res = await getArtistDetail(artistId);
      setDetail(res);
      setIsLoading(false);
    };
    load();
  }, [artistId]);

  useEffect(() => {
    if (!isLoading && detail && viewMode === 'main') {
      const timer = setTimeout(() => {
        checkScroll(discographyScrollRef, setDiscoScroll);
        checkScroll(relatedScrollRef, setRelatedScroll);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, detail, viewMode, checkScroll]);

  useEffect(() => {
    if (containerRef.current && viewMode !== 'all-songs') {
      containerRef.current.scrollTop = 0;
    }
    onViewModeChange?.(viewMode);
  }, [viewMode, onViewModeChange]);

  const handleSeeAllSongs = async () => {
    if (!detail?.seeAllSongsId) return;
    
    setViewMode('all-songs');
    setIsSongsLoading(true);
    try {
      const songs = await getArtistSongs(detail.seeAllSongsId, detail.seeAllSongsParams);
      setAllSongs(songs);
    } catch (e) {
      console.error('Failed to load all songs', e);
    } finally {
      setIsSongsLoading(false);
    }
  };

  const scrollAction = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right', setter: any) => {
    if (ref.current) {
      const scrollAmount = direction === 'left' ? -600 : 600;
      ref.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(() => checkScroll(ref, setter), 400);
    }
  };

  const renderTableHead = useCallback(() => (
    <tr className={styles.tableHeader}>
      <th>#</th>
      <th>Title</th>
      <th>Album</th>
      <th>Time</th>
    </tr>
  ), []);

  // Stable TableVirtuoso components
  const TableComponents = useMemo(() => ({
    Table: (props: any) => <table {...props} className={styles.trackList} style={{ ...props.style, borderCollapse: 'collapse' }} />,
    TableHead: React.forwardRef((props: any, ref: any) => <thead {...props} ref={ref} className={styles.tableHeader} />),
    TableRow: (props: any) => {
      const index = props['data-index'];
      const track = allSongs[index];
      const isActive = track && activeTrackId === track.id;
      return (
        <tr 
          {...props} 
          className={`${trackStyles.row} ${isActive ? trackStyles.active : ''}`} 
          onClick={() => player.playTrackList(allSongs, index)}
          style={{ ...props.style, cursor: 'pointer' }}
        />
      );
    },
    TableBody: React.forwardRef((props: any, ref: any) => <tbody {...props} ref={ref} />),
  }), [allSongs, activeTrackId]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <Skeleton width="100%" height={300} borderRadius={24} />
        </header>
        <section className={styles.section}>
          <Skeleton width={150} height={32} borderRadius={4} style={{ marginBottom: '1.5rem' }} />
          <table className={styles.trackList}>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TrackRowSkeleton key={i} index={i} />
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  if (!detail) return <div className={styles.container}>Artist not found.</div>;

  if (viewMode === 'all-songs') {
    return (
      <div className={styles.container} style={{ overflow: 'hidden', padding: '0' }}>
        <div className={styles.allSongsView} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <header className={styles.viewHeader} style={{ padding: '2rem 2rem 1rem 2rem', flexShrink: 0 }}>
            <button className={styles.backBtn} onClick={() => setViewMode('main')} title="Back to Artist">
              <ArrowLeft size={24} />
            </button>
            <h1 className={styles.viewTitle}>Top Songs</h1>
          </header>

          <div style={{ flex: 1, minHeight: 0 }}>
            {isSongsLoading ? (
              <div style={{ padding: '0 2rem' }}>
                <table className={styles.trackList}>
                  <thead>{renderTableHead()}</thead>
                  <tbody>
                    {Array.from({ length: 15 }).map((_, i) => <TrackRowSkeleton key={i} index={i} />)}
                  </tbody>
                </table>
              </div>
            ) : (
              <TableVirtuoso
                style={{ height: '100%' }}
                data={allSongs}
                components={TableComponents}
                fixedHeaderContent={renderTableHead}
                overscan={50}
                itemContent={(index, song) => (
                  <TrackRow 
                    index={index + 1}
                    {...song}
                    isActive={activeTrackId === song.id}
                    isPlaying={isPlaying}
                    renderOnlyCells={true}
                    onSelectArtist={onSelectArtist}
                    onSelectAlbum={onSelectAlbum}
                    onClick={() => player.playTrackList(allSongs, index)}
                  />
                )}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'discography') {
    const items = detail.discography.filter(item => item.category === discoCategory);

    return (
      <div className={styles.container} ref={containerRef}>
        <header className={styles.viewHeader}>
          <button className={styles.backBtn} onClick={() => setViewMode('main')} title="Back to Artist">
            <ArrowLeft size={24} />
          </button>
          <div className={styles.viewSwitcher}>
            <button 
              className={`${styles.viewTab} ${discoCategory === 'Album' ? styles.active : ''}`}
              onClick={() => setDiscoCategory('Album')}
            >
              Albums
            </button>
            <button 
              className={`${styles.viewTab} ${discoCategory === 'Single' ? styles.active : ''}`}
              onClick={() => setDiscoCategory('Single')}
            >
              Singles & EPs
            </button>
          </div>
        </header>
        <div className={styles.grid}>
          {items.map(item => (
            <div key={item.id} className={styles.albumCard} onClick={() => onSelectAlbum(item.id)}>
              <LazyImage 
                src={item.thumbUrl} 
                alt={item.title} 
                className={styles.albumThumbWrapper} 
                placeholder={<div className={styles.albumThumbPlaceholder} />}
              />
              <div className={styles.albumInfo}>
                <div className={styles.albumTitle} title={item.title}>{item.title}</div>
                <div className={styles.albumMeta}>
                  <span>{item.year}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <header className={styles.header}>
        <div className={styles.bannerWrapper}>
          <LazyImage 
            src={detail.thumbUrl} 
            alt={detail.name} 
            className={styles.bannerImage} 
            placeholder={<div className={styles.bannerPlaceholder} />}
          />
          <div className={styles.bannerOverlay}>
            <h1 className={styles.name}>{detail.name}</h1>
          </div>
        </div>
      </header>

      {detail.description && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About</h2>
          <p className={styles.bio}>{detail.description}</p>
        </section>
      )}

      {detail.topSongs?.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Top Songs</h2>
            {detail.seeAllSongsId && (
              <button 
                className={styles.seeAllBtn} 
                onClick={handleSeeAllSongs}
                title="See all tracks"
              >
                See all <ChevronRight size={16} />
              </button>
            )}
          </div>
          <table className={styles.trackList}>
            <tbody>
              {detail.topSongs.map((track, i) => (
                <TrackRow 
                  key={track.id}
                  index={i + 1}
                  {...track}
                  isActive={activeTrackId === track.id}
                  isPlaying={isPlaying}
                  hideDuration={true}
                  onSelectArtist={onSelectArtist}
                  onSelectAlbum={onSelectAlbum}
                  onClick={() => player.playSingle(track)}
                />
              ))}
            </tbody>
          </table>
        </section>
      )}

      {detail.discography?.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Discography</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className={styles.seeAllBtn} onClick={() => { setViewMode('discography'); setDiscoCategory('Album'); }}>
                See All <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className={styles.scrollWrapper}>
            {discoScroll.left && (
              <button className={`${styles.scrollNavBtn} ${styles.left}`} onClick={() => scrollAction(discographyScrollRef, 'left', setDiscoScroll)}>
                <ChevronLeft size={24} />
              </button>
            )}
            <div className={styles.horizontalScroll} ref={discographyScrollRef} onScroll={() => checkScroll(discographyScrollRef, setDiscoScroll)}>
              {detail.discography.map(item => (
                <div key={item.id} className={styles.albumCard} onClick={() => onSelectAlbum(item.id)}>
                  <div className={styles.albumThumbWrapper}>
                    <LazyImage 
                      src={item.thumbUrl} 
                      alt={item.title} 
                      className={styles.albumThumb} 
                      placeholder={<div className={styles.albumThumbPlaceholder} />}
                    />
                  </div>
                  <div className={styles.albumInfo}>
                    <div className={styles.albumTitle} title={item.title}>{item.title}</div>
                    <div className={styles.albumMeta}>
                      <span className={styles.albumCategory}>{item.category}</span>
                      {item.year && <span className={styles.albumYear}> • {item.year}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {discoScroll.right && (
              <button className={`${styles.scrollNavBtn} ${styles.right}`} onClick={() => scrollAction(discographyScrollRef, 'right', setDiscoScroll)}>
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        </section>
      )}

      {detail.related?.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Fans Also Like</h2>
          <div className={styles.scrollWrapper}>
            {relatedScroll.left && (
              <button className={`${styles.scrollNavBtn} ${styles.left}`} onClick={() => scrollAction(relatedScrollRef, 'left', setRelatedScroll)}>
                <ChevronLeft size={24} />
              </button>
            )}
            <div className={styles.horizontalScroll} ref={relatedScrollRef} onScroll={() => checkScroll(relatedScrollRef, setRelatedScroll)}>
              {detail.related.map(artist => (
                <ArtistCard 
                  key={artist.id}
                  {...artist}
                  onClick={() => onSelectArtist(artist.id)}
                />
              ))}
            </div>
            {relatedScroll.right && (
              <button className={`${styles.scrollNavBtn} ${styles.right}`} onClick={() => scrollAction(relatedScrollRef, 'right', setRelatedScroll)}>
                <ChevronRight size={24} />
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
});
