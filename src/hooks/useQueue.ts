import { useState, useEffect, useCallback } from 'react';
import { player } from '../api/player';
import { YTMTrack } from '../api/yt';

interface QueueState {
  nowPlaying: YTMTrack | null;
  previous: YTMTrack[];
  upcoming: YTMTrack[];
  recommendations: YTMTrack[];
  isPlaying: boolean;
  currentIndex: number;
}

/**
 * <summary>
 * Хук для работы с очередью воспроизведения.
 * Предоставляет текущий трек, список предыдущих и предстоящих треков, рекомендации, а также состояние проигрывания.
 * Автоматически обновляется при изменениях в PlayerStore.
 * </summary>
 */
export const useQueue = () => {
  const getPrevious = () => {
    if (player.queueIndex <= 0) return [];
    return player.queue.slice(0, player.queueIndex);
  };

  const [state, setState] = useState<QueueState>({
    nowPlaying: player.currentTrack,
    previous: getPrevious(),
    upcoming: player.getUpcoming(),
    recommendations: player.recommendations,
    isPlaying: player.isPlaying,
    currentIndex: player.queueIndex
  });

  useEffect(() => {
    const update = () => {
      setState({
        nowPlaying: player.currentTrack,
        previous: getPrevious(),
        upcoming: player.getUpcoming(),
        recommendations: player.recommendations,
        isPlaying: player.isPlaying,
        currentIndex: player.queueIndex
      });
    };

    // Подписка на уведомления от PlayerStore
    return player.subscribe(update);
  }, []);

  /**
   * Воспроизвести трек из очереди по его индексу
   */
  const playFromQueue = useCallback((index: number) => {
    player.playTrackList(player.queue, index);
  }, []);

  /**
   * Удалить трек из очереди
   */
  const removeFromQueue = useCallback((index: number) => {
    player.removeFromQueue(index);
  }, []);

  return {
    ...state,
    playFromQueue,
    removeFromQueue
  };
};
