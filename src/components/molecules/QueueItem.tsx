import React from 'react';
import { Visualizer } from '../atoms/Visualizer';
import styles from './QueueItem.module.css';

interface QueueItemProps {
  /** Уникальный идентификатор видео */
  id: string;
  /** Заголовок трека */
  title: string;
  /** Имена исполнителей */
  artists?: string[];
  /** URL обложки трека */
  thumbUrl?: string;
  /** Флаг активного трека (выбран в очереди) */
  isActive?: boolean;
  /** Флаг проигрывания трека в данный момент */
  isPlaying?: boolean;
  /** Обработчик клика (левая кнопка мыши) */
  onClick?: () => void;
  /** Обработчик контекстного меню (правая кнопка мыши) */
  onContextMenu?: (e: React.MouseEvent) => void;
  /** Дополнительный CSS класс */
  className?: string;
}

/**
 * <summary>
 * Компонент элемента очереди воспроизведения.
 * Отображает обложку, название трека, исполнителя и визуализатор для активного трека.
 * Поддерживает кастомные обработчики кликов и контекстного меню.
 * </summary>
 */
export const QueueItem: React.FC<QueueItemProps> = ({
  title,
  artists = [],
  thumbUrl,
  isActive = false,
  isPlaying = false,
  onClick,
  onContextMenu,
  className
}) => {
  const artistsText = artists.join(', ');

  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ''} ${className || ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <div className={styles.coverWrapper}>
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className={styles.cover} />
        ) : (
          <div className={styles.cover} />
        )}
        {isActive && (
          <div className={styles.playingOverlay}>
            <Visualizer isPlaying={isPlaying} />
          </div>
        )}
      </div>
      <div className={styles.info}>
        <div className={styles.title} title={title}>{title}</div>
        <div className={styles.artist} title={artistsText}>{artistsText}</div>
      </div>
    </div>
  );
};
