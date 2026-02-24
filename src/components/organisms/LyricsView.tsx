import React, { useState, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { player } from '../../api/player';
import styles from './LyricsView.module.css';
import { Loader2, Music4 } from 'lucide-react';

interface LyricsData {
    syncedLyrics: string;
    plainLyrics: string;
    instrumental: boolean;
}

export const LyricsView: React.FC = () => {
    const [lyrics, setLyrics] = useState<LyricsData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [trackId, setTrackId] = useState('');
    const [currentTime, setCurrentTime] = useState(0);
    const [userScrolled, setUserScrolled] = useState(false);
    const scrollTimeout = useRef<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const lyricsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        return player.subscribe(() => {
            const current = player.currentTrack;
            if (current) {
                if (current.id !== trackId) {
                    setTrackId(current.id);
                    fetchLyrics(current.title, current.artist);
                }
                setCurrentTime(player.currentTime);
            }
        });
    }, [trackId]);

    // Keep a ref to track the latest fetch to avoid race conditions
    const fetchIdRef = useRef<number>(0);

    const fetchLyrics = async (title: string, artist: string) => {
        const currentFetchId = ++fetchIdRef.current;

        setLoading(true);
        setError('');
        setLyrics(null);

        try {
            // Use Rust backend to bypass CORS
            const data: any = await invoke('fetch_lyrics', {
                trackName: title,
                artistName: artist
            });

            // If another fetch was started after this one, ignore these results
            if (fetchIdRef.current !== currentFetchId) return;

            if (data && Array.isArray(data) && data.length > 0) {
                setError('');
                setLyrics({
                    syncedLyrics: data[0].syncedLyrics || '',
                    plainLyrics: data[0].plainLyrics || '',
                    instrumental: data[0].instrumental || false
                });
            } else {
                setLyrics(null);
                setError('No lyrics found for this track.');
            }
        } catch (e) {
            if (fetchIdRef.current !== currentFetchId) return;
            setLyrics(null);
            setError('Failed to fetch lyrics. Try again later.');
        } finally {
            if (fetchIdRef.current === currentFetchId) {
                setLoading(false);
            }
        }
    };

    const parsedLyrics = useMemo(() => {
        if (!lyrics?.syncedLyrics) return [];
        return lyrics.syncedLyrics.split('\n').map((line, idx) => {
            const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
            if (match) {
                const time = parseInt(match[1]) * 60 + parseFloat(match[2]);
                return { time, text: match[3], id: idx };
            }
            return { time: -1, text: line, id: idx };
        }).filter(l => l.time >= 0);
    }, [lyrics?.syncedLyrics]);

    const activeLineIndex = useMemo(() => {
        if (parsedLyrics.length === 0) return -1;
        // Find the last lyric line that has time <= currentTime + offset
        // An offset of +0.6s helps people read slightly ahead and masks any polling delay.
        const adjustedTime = currentTime + 0.6;
        for (let i = parsedLyrics.length - 1; i >= 0; i--) {
            if (adjustedTime >= parsedLyrics[i].time) {
                return i;
            }
        }
        return 0;
    }, [parsedLyrics, currentTime]);

    useEffect(() => {
        if (activeLineIndex >= 0 && scrollRef.current && lyricsContainerRef.current && !userScrolled) {
            const activeEl = scrollRef.current;
            const container = lyricsContainerRef.current;

            const elementRect = activeEl.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const offset = elementRect.top - containerRect.top - (containerRect.height / 2) + (elementRect.height / 2);

            container.scrollTo({
                top: container.scrollTop + offset,
                behavior: 'smooth'
            });
        }
    }, [activeLineIndex, userScrolled]);

    const handleWheelAndTouch = () => {
        setUserScrolled(true);
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
            setUserScrolled(false);
        }, 4000); // Resume auto-scroll after 4s of no manual interaction
    };

    if (!player.currentTrack) {
        return (
            <div className={styles.empty}>
                <Music4 size={64} opacity={0.2} />
                <h2>Play a track to see lyrics</h2>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>{player.currentTrack.title}</h2>
                <p>{player.currentTrack.artist}</p>
            </div>

            <div
                className={styles.content}
                ref={lyricsContainerRef}
                onWheel={handleWheelAndTouch}
                onTouchMove={handleWheelAndTouch}
            >
                {loading && <div className={styles.loading}><Loader2 className="animate-spin" size={32} /></div>}
                {error && <div className={styles.error}>{error}</div>}

                {lyrics?.instrumental && (
                    <div className={styles.instrumental}>Instrumental track 🎵</div>
                )}

                {lyrics && !lyrics.instrumental && (
                    <div className={styles.lyricsText}>
                        {parsedLyrics.length > 0 ? (
                            parsedLyrics.map((line, i) => {
                                const isActive = i === activeLineIndex;
                                return (
                                    <p
                                        key={line.id}
                                        className={`${styles.lyricLine} ${isActive ? styles.active : ''}`}
                                        ref={isActive ? scrollRef : null}
                                        onClick={() => player.seek(line.time)}  // Click lyric to jump
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {line.text || '♪'}
                                    </p>
                                );
                            })
                        ) : (
                            lyrics.plainLyrics?.split('\n').map((line, i) => (
                                <p key={i} className={styles.lyricLine}>{line || '♪'}</p>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
