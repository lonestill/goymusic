import {
  Shuffle,
  SkipBack,
  Pause,
  SkipForward,
  Repeat,
  ListMusic,
  Mic2,
  Volume2,
  Heart
} from 'lucide-react';
import { IconButton } from '../atoms/IconButton';
import { ProgressBar } from '../atoms/ProgressBar';
import { Icon } from '../atoms/Icon';
import styles from './PlayerBar.module.css';

interface PlayerBarProps {
  queueVisible?: boolean;
  onToggleQueue?: () => void;
  className?: string;
}

/**
 * Organism: PlayerBar
 * The bottom player controls including now playing info and progress.
 */
export const PlayerBar: React.FC<PlayerBarProps> = ({
  queueVisible = true,
  onToggleQueue,
  className
}) => {
  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* Now Playing Info */}
      <div className={styles.nowPlaying}>
        <div className={styles.albumArt} />
        <div className={styles.trackInfo}>
          <div className={styles.title}>Starboy</div>
          <div className={styles.artist}>The Weeknd</div>
        </div>
        <IconButton icon={Heart} size={32} iconSize={16} className={styles.heart} />
      </div>

      {/* Playback Controls */}
      <div className={styles.controls}>
        <div className={styles.buttons}>
          <IconButton icon={Shuffle} size={32} iconSize={16} />
          <IconButton icon={SkipBack} size={32} iconSize={20} />
          <IconButton icon={Pause} size={44} iconSize={20} variant="solid" />    
          <IconButton icon={SkipForward} size={32} iconSize={20} />
          <IconButton icon={Repeat} size={32} iconSize={16} />
        </div>
        <div className={styles.progress}>
          <span className={styles.time}>1:42</span>
          <ProgressBar progress={35} className={styles.progressBar} />
          <span className={styles.time}>3:50</span>
        </div>
      </div>

      {/* Extra Controls */}
      <div className={styles.extra}>
        <IconButton
          icon={ListMusic}
          size={32}
          iconSize={18}
          active={queueVisible}
          onClick={onToggleQueue}
        />
        <IconButton icon={Mic2} size={32} iconSize={18} />
        <div className={styles.volume}>
          <Icon icon={Volume2} size={18} />
          <ProgressBar progress={70} className={styles.volumeBar} />
        </div>
      </div>
    </div>
  );
};

