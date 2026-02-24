import React, { useState, useEffect, useCallback } from 'react';
import {
  Shuffle, SkipBack, Pause, Play, SkipForward, Repeat, Repeat1,
  ListMusic, Mic2, Volume2, Volume1, VolumeX
} from 'lucide-react';
import { IconButton } from '../atoms/IconButton';
import { ProgressBar } from '../atoms/ProgressBar';
import { player } from '../../api/player';
import styles from './PlayerBar.module.css';

interface PlayerBarProps {
  activeRightPanel?: 'none' | 'queue' | 'lyrics';
  onToggleRightPanel?: (panel: 'queue' | 'lyrics') => void;
  className?: string;
}

function formatTime(sec: number): string {
  if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const PlayerBar: React.FC<PlayerBarProps> = ({
  activeRightPanel = 'none',
  onToggleRightPanel,
  className
}) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    return player.subscribe(() => setTick(t => t + 1));
  }, []);

  const track = player.currentTrack;
  const progress = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;

  const handleSeek = useCallback((pct: number) => {
    if (!player.duration) return;
    player.seek((pct / 100) * player.duration);
  }, []);

  const handleVolumeChange = useCallback((pct: number) => {
    player.setVolume(Math.round(pct));
  }, []);

  const VolumeIcon = player.volume === 0 ? VolumeX : player.volume < 50 ? Volume1 : Volume2;
  const RepeatIcon = player.repeat === 'one' ? Repeat1 : Repeat;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* Now Playing */}
      <div className={styles.nowPlaying}>
        {track?.thumbUrl ? (
          <img src={track.thumbUrl} alt="" className={styles.albumArt} />
        ) : (
          <div className={styles.albumArtEmpty} />
        )}
        <div className={styles.trackInfo}>
          <div className={styles.title}>{track?.title || 'No track selected'}</div>
          <div className={styles.artist}>{track?.artist || ''}</div>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.buttons}>
          <IconButton
            icon={Shuffle} size={32} iconSize={16}
            active={player.shuffle}
            onClick={() => player.toggleShuffle()}
          />
          <IconButton icon={SkipBack} size={32} iconSize={20} onClick={() => player.prev()} />
          <IconButton
            icon={player.isPlaying ? Pause : Play}
            size={44} iconSize={20} variant="solid"
            onClick={() => player.togglePlay()}
          />
          <IconButton icon={SkipForward} size={32} iconSize={20} onClick={() => player.next()} />
          <IconButton
            icon={RepeatIcon} size={32} iconSize={16}
            active={player.repeat !== 'off'}
            onClick={() => player.toggleRepeat()}
          />
        </div>
        <div className={styles.progress}>
          <span className={styles.time}>{formatTime(player.currentTime)}</span>
          <ProgressBar
            progress={progress}
            onSeek={handleSeek}
            className={styles.progressBar}
          />
          <span className={styles.time}>{formatTime(player.duration)}</span>
        </div>
      </div>

      {/* Volume + Queue */}
      <div className={styles.extra} style={{ gap: '0.2rem' }}>
        <IconButton
          icon={Mic2}
          size={32}
          iconSize={18}
          active={activeRightPanel === 'lyrics'}
          onClick={() => onToggleRightPanel?.('lyrics')}
        />
        <IconButton
          icon={ListMusic}
          size={32}
          iconSize={18}
          active={activeRightPanel === 'queue'}
          onClick={() => onToggleRightPanel?.('queue')}
        />
        <div className={styles.volume} style={{ marginLeft: '1rem' }}>
          <IconButton
            icon={VolumeIcon}
            size={28}
            iconSize={16}
            onClick={() => player.setVolume(player.volume === 0 ? 80 : 0)}
          />
          <ProgressBar
            progress={player.volume}
            onSeek={handleVolumeChange}
            showThumb={true}
            className={styles.volumeBar}
          />
        </div>
      </div>
    </div>
  );
};
