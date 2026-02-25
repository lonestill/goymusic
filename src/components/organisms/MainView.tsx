import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TableVirtuoso } from 'react-virtuoso';
import { TrackRow } from '../molecules/TrackRow';
import { TrackRowSkeleton } from '../molecules/TrackRowSkeleton';
import { ArtistCard } from '../molecules/ArtistCard';
import { Skeleton } from '../atoms/Skeleton';
import { LazyImage } from '../atoms/LazyImage';
import { 
  getLikedSongs, 
  getPlaylistTracks, 
  getAlbum,
  searchMusic, 
  searchMore, 
  getSearchSuggestions, 
  YTMTrack, 
  YTMArtist,
  YTMAlbum
} from '../../api/yt';
import { player } from '../../api/player';
import { ActiveView } from '../../types';
import { Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './MainView.module.css';
import trackStyles from '../molecules/TrackRow.module.css';

interface MainViewProps {
  activeView: ActiveView;
  isAuthenticated: boolean;
  isInitializing?: boolean;
  onSearch: (query: string) => void;
  onSelectArtist: (id: string) => void;
  onSelectAlbum: (id: string) => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export const MainView = React.memo<MainViewProps>(({ 
  activeView, 
  isAuthenticated, 
  isInitializing, 
  onSearch, 
  onSelectArtist,
  onSelectAlbum
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMoreLoading, setIsMoreLoading] = useState<boolean>(false);
  const [tracks, setTracks] = useState<YTMTrack[]>([]);
  const [artists, setArtists] = useState<YTMArtist[]>([]);
  const [albumData, setAlbumData] = useState<YTMAlbum | null>(null);
  const [searchQuery, setSearchQuery] = useState(activeView.searchQuery || '');
  const [hasMore, setHasMore] = useState(true);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const artistsScrollRef = useRef<HTMLDivElement>(null);
  
  // Scroll visibility state
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [activeTrackId, setActiveTrackId] = useState<string | undefined>(player.currentTrack?.id);
  const [isPlaying, setIsPlaying] = useState<boolean>(player.isPlaying);

  const checkScroll = useCallback(() => {
    if (artistsScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = artistsScrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [artists, checkScroll]);

  const loadMore = useCallback(async () => {
    if (isMoreLoading || !activeView.searchQuery) return;
    setIsMoreLoading(true);
    try {
      const moreTracks = await searchMore(activeView.searchQuery, tracks.length, 'songs');
      if (moreTracks.length < 20) {
        setHasMore(false);
      }
      if (moreTracks.length > 0) {
        setTracks(prev => [...prev, ...moreTracks]);
      }
    } catch (e) {
      console.error('Failed to load more', e);
      setHasMore(false);
    } finally {
      setIsMoreLoading(false);
    }
  }, [isMoreLoading, activeView.searchQuery, tracks.length]);

  const observer = useRef<IntersectionObserver | null>(null);
  const lastTrackElementRef = useCallback((node: HTMLTableRowElement) => {
    if (isLoading || isMoreLoading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && activeView.type === 'search') {
        loadMore();
      }
    });
    
    if (node) observer.current.observe(node);
  }, [isLoading, isMoreLoading, hasMore, activeView.type, loadMore]);

  useEffect(() => {
    return player.subscribe(() => {
      setActiveTrackId(player.currentTrack?.id);
      setIsPlaying(player.isPlaying);
    });
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadContent();
    }
  }, [activeView, isAuthenticated]);

  // Handle autocomplete suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (activeView.type === 'search' && searchQuery.trim().length > 1) {
        const results = await getSearchSuggestions(searchQuery.trim());
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, activeView.type]);

  // Handle clicking outside suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadContent = async () => {
    setIsLoading(true);
    setHasMore(true);
    setAlbumData(null);
    try {
      if (activeView.type === 'liked') {
        const result = await getLikedSongs();
        setTracks(result);
        setArtists([]);
      } else if (activeView.type === 'playlist' && activeView.playlistId) {
        const result = await getPlaylistTracks(activeView.playlistId);
        setTracks(result);
        setArtists([]);
      } else if (activeView.type === 'album' && activeView.albumId) {
        const result = await getAlbum(activeView.albumId);
        if (result) {
          setAlbumData(result);
          setTracks(result.tracks);
        }
        setArtists([]);
      } else if (activeView.type === 'search' && activeView.searchQuery) {
        setSearchQuery(activeView.searchQuery);
        const result = await searchMusic(activeView.searchQuery);
        setTracks(result.tracks);
        setArtists(result.artists);
        if (result.tracks.length < 20) setHasMore(false);
      }
    } catch (e) {
      console.error('Failed to load content', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent, forcedQuery?: string) => {
    e?.preventDefault();
    const query = forcedQuery || searchQuery;
    if (query.trim()) {
      setShowSuggestions(false);
      onSearch(query.trim());
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    handleSearchSubmit(undefined, suggestion);
  };

  const scrollArtists = (direction: 'left' | 'right') => {
    if (artistsScrollRef.current) {
      const scrollAmount = direction === 'left' ? -600 : 600;
      artistsScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const renderTableHead = useCallback(() => (
    <tr className={styles.tableHeader}>
      <th style={{ textAlign: 'left', width: '48px' }}>#</th>
      <th style={{ textAlign: 'left' }}>Title</th>
      <th style={{ textAlign: 'left' }}>Album</th>
      <th style={{ textAlign: 'right' }}>Time</th>
    </tr>
  ), []);

  const TableComponents = useMemo(() => ({
    Table: (props: any) => <table {...props} className={styles.trackList} style={{ ...props.style, borderCollapse: 'collapse' }} />,
    TableHead: React.forwardRef((props: any, ref: any) => <thead {...props} ref={ref} className={styles.tableHeader} />),
    TableRow: (props: any) => {
      const index = props['data-index'];
      const track = tracks[index];
      const isActive = track && activeTrackId === track.id;
      return (
        <tr 
          {...props} 
          className={`${trackStyles.row} ${isActive ? trackStyles.active : ''}`} 
          onClick={() => player.playTrackList(tracks, index)}
          style={{ ...props.style, cursor: 'pointer' }}
        />
      );
    },
    TableBody: React.forwardRef((props: any, ref: any) => <tbody {...props} ref={ref} />),
  }), [tracks, activeTrackId]);

  if (!isAuthenticated && !isInitializing) return null;

  if (activeView.type === 'search') {
    return (
      <div className={styles.container}>
        <header className={styles.header} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <h1 className={styles.title}>Search</h1>
          <div ref={searchContainerRef} className={styles.searchWrapper}>
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Search for songs, artists, albums..."
                className={styles.searchInput}
              />
              <button type="submit" className={styles.searchButton}>
                <Search size={16} /> Search
              </button>
            </form>
            
            {showSuggestions && suggestions.length > 0 && (
              <div className={styles.suggestionsDropdown}>
                {suggestions.map((s, i) => (
                  <div 
                    key={i} 
                    className={styles.suggestionItem}
                    onClick={() => handleSuggestionClick(s)}
                  >
                    <Search size={14} className={styles.suggestionIcon} />
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        {isLoading ? (
          <div style={{ padding: '2rem' }}>
            <Skeleton width={200} height={30} borderRadius={8} />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', overflow: 'hidden' }}>
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} width={160} height={200} borderRadius={16} />)}
            </div>
          </div>
        ) : artists.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Artists</h2>
            <div className={styles.scrollWrapper}>
              {canScrollLeft && (
                <button className={`${styles.scrollNavBtn} ${styles.left}`} onClick={() => scrollArtists('left')}>
                  <ChevronLeft size={24} />
                </button>
              )}
              <div className={styles.horizontalScroll} ref={artistsScrollRef} onScroll={checkScroll}>
                {artists.map(artist => (
                  <ArtistCard 
                    key={artist.id} 
                    {...artist} 
                    onClick={() => onSelectArtist(artist.id)} 
                  />
                ))}
              </div>
              {canScrollRight && (
                <button className={`${styles.scrollNavBtn} ${styles.right}`} onClick={() => scrollArtists('right')}>
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          </section>
        )}

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Songs</h2>
          <table className={styles.trackList}>
            <thead>
              <tr className={styles.tableHeader}>
                <th style={{ textAlign: 'left', width: '48px' }}>#</th>
                <th style={{ textAlign: 'left' }}>Title</th>
                <th style={{ textAlign: 'left' }}>Album</th>
                <th style={{ textAlign: 'right' }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <TrackRowSkeleton key={i} index={i} />)
              ) : (
                tracks.map((track, i) => {
                  const isLast = i === tracks.length - 1;
                  return (
                    <TrackRow
                      key={`${track.id}-${i}`}
                      ref={isLast ? lastTrackElementRef : null}
                      index={i + 1}
                      {...track}
                      isActive={activeTrackId === track.id}
                      isPlaying={isPlaying}
                      onClick={() => player.playTrackList(tracks, i)}
                      onSelectArtist={onSelectArtist}
                      onSelectAlbum={onSelectAlbum}
                    />
                  );
                })
              )}
            </tbody>
          </table>
          {isMoreLoading && (
            <div className={styles.loaderContainer}>
              <Loader2 className="animate-spin" size={24} />
              <span>Loading more...</span>
            </div>
          )}
        </section>
      </div>
    );
  }

  const viewTitle = activeView.type === 'liked' 
    ? 'Liked Songs' 
    : (activeView.type === 'album' && albumData ? albumData.title : (activeView.playlistTitle || 'Playlist'));
  
  const viewLabel = activeView.type === 'liked' 
    ? 'AUTO PLAYLIST' 
    : (activeView.type === 'album' ? 'ALBUM' : 'PLAYLIST');

  const showSkeletons = isLoading || isInitializing;
  const coverUrl = activeView.type === 'album' && albumData ? albumData.thumbUrl : tracks[0]?.thumbUrl;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        {showSkeletons ? (
          <Skeleton width={192} height={192} borderRadius={12} className={styles.cover} />
        ) : (
          <LazyImage 
            src={coverUrl} 
            alt={viewTitle} 
            className={styles.cover} 
            placeholder={<Skeleton width={192} height={192} borderRadius={12} />}
          />
        )}
        <div className={styles.info}>
          {showSkeletons ? (
            <>
              <Skeleton width={120} height={14} borderRadius={4} />
              <div style={{ margin: '1rem 0' }}><Skeleton width="80%" height={60} borderRadius={8} /></div>
              <Skeleton width={80} height={14} borderRadius={4} />
            </>
          ) : (
            <>
              <div className={styles.label}>{viewLabel}</div>
              <h1 className={styles.title} title={viewTitle}>{viewTitle}</h1>
              <div className={styles.meta}>{tracks.length} songs</div>
            </>
          )}
        </div>
      </header>

      <div className={styles.virtuosoWrapper}>
        {showSkeletons ? (
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
            data={tracks}
            components={TableComponents}
            fixedHeaderContent={renderTableHead}
            overscan={50}
            itemContent={(index, track) => (
              <TrackRow 
                index={index + 1}
                {...track}
                isActive={activeTrackId === track.id}
                isPlaying={isPlaying}
                renderOnlyCells={true}
                onSelectArtist={onSelectArtist}
                onSelectAlbum={onSelectAlbum}
                onClick={() => player.playTrackList(tracks, index)}
              />
            )}
          />
        )}
      </div>
    </div>
  );
});

