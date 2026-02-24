import React, { useRef, useState, useCallback } from 'react';
import styles from './ProgressBar.module.css';

interface SliderBarProps {
  progress: number; // 0 to 100
  onSeek?: (pct: number) => void;
  showThumb?: boolean;
  accentColor?: string;
  className?: string;
}

/**
 * Atom: SliderBar
 * Interactive progress/slider bar with drag support.
 */
export const ProgressBar: React.FC<SliderBarProps> = ({
  progress,
  onSeek,
  showThumb = true,
  className
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const calcPct = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!ref.current) return 0;
    const rect = ref.current.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!onSeek) return;
    e.preventDefault();
    setIsDragging(true);
    const pct = calcPct(e);
    onSeek(pct);

    const handleMove = (ev: MouseEvent) => {
      const p = calcPct(ev);
      onSeek(p);
    };

    const handleUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  }, [onSeek, calcPct]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setHoverPct(calcPct(e));
  }, [calcPct]);

  const handleMouseLeave = useCallback(() => {
    setHoverPct(null);
  }, []);

  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const interactive = !!onSeek;

  return (
    <div
      ref={ref}
      className={`${styles.container} ${interactive ? styles.interactive : ''} ${isDragging ? styles.dragging : ''} ${className || ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover preview */}
      {hoverPct !== null && interactive && (
        <div className={styles.hoverFill} style={{ width: `${hoverPct}%` }} />
      )}
      {/* Actual progress */}
      <div className={styles.fill} style={{ width: `${clampedProgress}%` }} />
      {/* Thumb */}
      {showThumb && interactive && (
        <div
          className={styles.thumb}
          style={{ left: `${clampedProgress}%` }}
        />
      )}
    </div>
  );
};
