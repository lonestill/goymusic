import { invoke } from '@tauri-apps/api/core';
import { YTMTrack } from './yt';

type PlayerCallback = () => void;

class PlayerStore {
    currentTrack: YTMTrack | null = null;
    queue: YTMTrack[] = [];
    queueIndex: number = -1;
    isPlaying: boolean = false;
    currentTime: number = 0;
    duration: number = 0;
    volume: number = 80;
    shuffle: boolean = false;
    repeat: 'off' | 'all' | 'one' = 'off';

    private listeners: Set<PlayerCallback> = new Set();
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private lastToggleTime: number = 0;

    subscribe(cb: PlayerCallback): () => void {
        this.listeners.add(cb);
        return () => { this.listeners.delete(cb); };
    }

    private notify() {
        this.listeners.forEach(cb => cb());
        this.updateRpc();
    }

    private lastRpcUpdate = 0;
    private async updateRpc() {
        const now = Date.now();
        if (now - this.lastRpcUpdate < 1000) return; // limit to 1 RPC request per second
        this.lastRpcUpdate = now;

        const title = this.currentTrack?.title || '';
        const artist = this.currentTrack?.artist || '';
        const videoId = this.currentTrack?.id || '';
        const thumbUrl = this.currentTrack?.thumbUrl || '';

        try {
            // Send state to Rust backend to update Discord Rich Presence via IPC
            await invoke('ytm_update_discord_rpc', {
                title,
                artist,
                videoId,
                thumbUrl,
                isPlaying: this.isPlaying,
                currentTime: this.currentTime,
                duration: this.duration
            });
        } catch (e) {
            console.error('Failed to update Discord RPC', e);
        }
    }

    /** Load a list of tracks and start playing from index */
    async playTrackList(tracks: YTMTrack[], startIndex: number = 0) {
        this.queue = [...tracks];
        this.queueIndex = startIndex;
        await this.playCurrentTrack();
    }

    /** Play a single track */
    async playSingle(track: YTMTrack) {
        this.currentTrack = track;
        this.queue = [track];
        this.queueIndex = 0;
        await this.startPlayback(track);
    }

    private async playCurrentTrack() {
        if (this.queueIndex < 0 || this.queueIndex >= this.queue.length) return;
        this.currentTrack = this.queue[this.queueIndex];
        await this.startPlayback(this.currentTrack);
    }

    private async startPlayback(track: YTMTrack) {
        this.isPlaying = true;
        this.currentTime = 0;
        this.duration = this.parseDuration(track.duration);
        this.notify();

        // Navigate the hidden webview to play this track
        try {
            await invoke('ytm_play_track', { videoId: track.id });
            this.startPolling();
        } catch (e) {
            console.error('Failed to play track:', e);
        }
    }

    async togglePlay() {
        if (!this.currentTrack) return;
        this.lastToggleTime = Date.now();
        try {
            await invoke('ytm_toggle_play');
            this.isPlaying = !this.isPlaying;
            this.notify();
        } catch (e) {
            console.error('Toggle play error:', e);
        }
    }

    async next() {
        if (this.queue.length === 0) return;
        if (this.shuffle) {
            this.queueIndex = Math.floor(Math.random() * this.queue.length);
        } else {
            this.queueIndex++;
            if (this.queueIndex >= this.queue.length) {
                if (this.repeat === 'all') this.queueIndex = 0;
                else return;
            }
        }
        await this.playCurrentTrack();
    }

    async prev() {
        if (this.currentTime > 3) {
            // Restart current track
            this.currentTime = 0;
            try { await invoke('ytm_seek', { time: 0 }); } catch (_) { }
            this.notify();
            return;
        }
        if (this.queueIndex > 0) {
            this.queueIndex--;
            await this.playCurrentTrack();
        }
    }

    async seek(time: number) {
        this.currentTime = time;
        this.notify();
        try { await invoke('ytm_seek', { time }); } catch (_) { }
    }

    async setVolume(vol: number) {
        this.volume = vol;
        this.notify();
        try { await invoke('ytm_set_volume', { volume: vol }); } catch (_) { }
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        this.notify();
    }

    toggleRepeat() {
        const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
        const idx = modes.indexOf(this.repeat);
        this.repeat = modes[(idx + 1) % modes.length];
        this.notify();
    }

    getUpcoming(): YTMTrack[] {
        if (this.queueIndex < 0) return [];
        return this.queue.slice(this.queueIndex + 1, this.queueIndex + 20);
    }

    private startPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);

        this.pollInterval = setInterval(async () => {
            try {
                const state: any = await invoke('ytm_get_playback_state');
                if (state) {
                    this.currentTime = state.current_time || this.currentTime;
                    this.duration = state.duration || this.duration;

                    const wasPlaying = this.isPlaying;

                    // Don't override our local state with stale YTM state right after a toggle
                    if (Date.now() - this.lastToggleTime > 1000) {
                        this.isPlaying = state.is_playing ?? this.isPlaying;
                    }

                    // Auto-advance when track ends (only if we were genuinely playing and hit the end)
                    if (wasPlaying && !this.isPlaying && this.duration > 0 && this.currentTime >= this.duration - 1) {
                        this.next();
                    }
                    this.notify();
                }
            } catch (_) {
                // Webview might not be ready yet
            }
        }, 1000);
    }

    private parseDuration(dur: string): number {
        if (!dur) return 0;
        const parts = dur.split(':').map(Number);
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return 0;
    }
}

export const player = new PlayerStore();
