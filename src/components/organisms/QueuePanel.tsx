import React, { useState, useEffect, useRef } from 'react';
import { player } from '../../api/player';
import { useQueue } from '../../hooks/useQueue';
import { QueueItem } from '../molecules/QueueItem';
import { ContextMenu, ContextMenuItem } from '../molecules/ContextMenu';
import { Play, Trash2, ListMusic, PlusCircle, Infinity } from 'lucide-react';
import styles from './QueuePanel.module.css';

interface QueuePanelProps {
  onSelectAlbum: (id: string) => void;
}

export const QueuePanel: React.FC<QueuePanelProps> = ({ onSelectAlbum }) => {
  const { 
    nowPlaying, 
    previous, 
    upcoming, 
    recommendations,
    isPlaying, 
    currentIndex, 
    playFromQueue, 
    removeFromQueue 
  } = useQueue();
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, item: any, type: 'queue' | 'suggested', index?: number } | null>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll active track into view when it changes
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentIndex]);

  const handleContextMenu = (e: React.MouseEvent, item: any, type: 'queue' | 'suggested', index?: number) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item, type, index });
  };

  const handlePlayNext = (index: number) => {
      const track = player.queue[index];
      player.removeFromQueue(index);
      player.playNext(track);
  };

  const handlePlaySuggested = (track: any) => {
    player.addToQueueAndPlay(track);
  };

  const handleAddSuggested = (track: any) => {
    player.addToQueue(track);
  };

  const menuItems: ContextMenuItem[] = contextMenu ? (
    contextMenu.type === 'queue' ? [
      {
        label: 'Play Now',
        icon: Play,
        onClick: () => playFromQueue(contextMenu.index!)
      },
      {
          label: 'Play Next',
          icon: Play,
          onClick: () => handlePlayNext(contextMenu.index!)
      },
      {
        label: 'Remove from Queue',
        icon: Trash2,
        onClick: () => removeFromQueue(contextMenu.index!),
        isDanger: true
      },
      {
          label: 'Go to Album',
          icon: ListMusic,
          onClick: () => {
            if (contextMenu.item.albumId) {
              onSelectAlbum(contextMenu.item.albumId);
            }
          }
      }
    ] : [
      {
        label: 'Play Now',
        icon: Play,
        onClick: () => handlePlaySuggested(contextMenu.item)
      },
      {
        label: 'Add to Queue',
        icon: PlusCircle,
        onClick: () => handleAddSuggested(contextMenu.item)
      },
      {
        label: 'Go to Album',
        icon: ListMusic,
        onClick: () => {
          if (contextMenu.item.albumId) {
            onSelectAlbum(contextMenu.item.albumId);
          }
        }
      }
    ]
  ) : [];

  return (
    <aside className={styles.panel}>
      <header className={styles.header}>
        <h4>Queue</h4>
        <button 
          className={`${styles.autoplayBtn} ${player.autoplay ? styles.active : ''}`}
          onClick={() => player.toggleAutoplay()}
          title="Autoplay"
        >
          <Infinity size={18} />
          <span>Autoplay</span>
        </button>
      </header>
      <div className={styles.list} ref={scrollContainerRef}>
        {/* Previous Section */}
        {previous.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Previous</div>
            {previous.map((track, i) => (
              <QueueItem
                key={`${track.id}-prev-${i}`}
                {...track}
                isActive={false}
                isPlaying={false}
                onClick={() => playFromQueue(i)}
                onContextMenu={(e) => handleContextMenu(e, track, 'queue', i)}
              />
            ))}
          </div>
        )}

        {/* Now Playing Section */}
        {nowPlaying && (
          <div className={styles.section} ref={activeItemRef}>
            <div className={styles.sectionHeader}>Now Playing</div>
            <QueueItem
              {...nowPlaying}
              isActive={true}
              isPlaying={isPlaying}
              onClick={() => {}} 
              onContextMenu={(e) => handleContextMenu(e, nowPlaying, 'queue', currentIndex)}
            />
          </div>
        )}

        {/* Up Next Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Up Next</div>
          {upcoming.length === 0 ? (
            <div className={styles.emptyState}>No upcoming tracks</div>
          ) : (
            upcoming.map((track, i) => (
              <QueueItem
                key={`${track.id}-next-${i}`}
                {...track}
                isActive={false}
                isPlaying={false}
                onClick={() => playFromQueue(currentIndex + 1 + i)}
                onContextMenu={(e) => handleContextMenu(e, track, 'queue', currentIndex + 1 + i)}
              />
            ))
          )}
        </div>

        {/* Suggested Section */}
        {recommendations.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Suggested</div>
            {recommendations.map((track, i) => (
              <QueueItem
                key={`${track.id}-suggested-${i}`}
                {...track}
                isActive={false}
                isPlaying={false}
                onClick={() => handlePlaySuggested(track)}
                onContextMenu={(e) => handleContextMenu(e, track, 'suggested')}
              />
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={menuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  );
};

