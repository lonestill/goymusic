import { YTMTrack, getQueueRecommendations } from './yt';

type PlayerCallback = () => void;

class PlayerStore {
    currentTrack: YTMTrack | null = null;
    queue: YTMTrack[] = [];
    queueIndex: number = -1;
    recommendations: YTMTrack[] = [];
    isPlaying: boolean = false;
    currentTime: number = 0;
    duration: number = 0;
    volume: number = 80;
    private lastVolume: number = 80;
    shuffle: boolean = false;
    repeat: 'off' | 'all' | 'one' = 'off';
    autoplay: boolean = true;

    private audio: HTMLAudioElement;
    private audioContext: AudioContext | null = null;
    private source: MediaElementAudioSourceNode | null = null;
    private filters: BiquadFilterNode[] = [];
    private analyzer: AnalyserNode | null = null;
    private listeners: Set<PlayerCallback> = new Set();
    private updateInterval: any = null;
    private playbackId: number = 0;

    constructor() {
        this.audio = new Audio();
        this.audio.crossOrigin = "anonymous";
        this.loadState();
        this.setupEventListeners();
    }

    private initAudioContext() {
        if (this.audioContext) return;
        
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this.source = this.audioContext.createMediaElementSource(this.audio);
        this.analyzer = this.audioContext.createAnalyser();
        this.analyzer.fftSize = 2048; // Increased from 256 for much better resolution
        this.analyzer.smoothingTimeConstant = 0.8;

        // Default 6-band EQ frequencies
        const freqs = [60, 250, 1000, 4000, 8000, 16000];
        this.filters = freqs.map((f, i) => {
            const filter = this.audioContext!.createBiquadFilter();
            if (i === 0) filter.type = 'lowshelf';
            else if (i === freqs.length - 1) filter.type = 'highshelf';
            else filter.type = 'peaking';
            filter.frequency.value = f;
            filter.Q.value = 1;
            filter.gain.value = 0;
            return filter;
        });

        // Load EQ settings
        this.loadEQSettings();

        // Chain: source -> filters -> analyzer -> destination
        let lastNode: AudioNode = this.source;
        this.filters.forEach(f => {
            lastNode.connect(f);
            lastNode = f;
        });
        lastNode.connect(this.analyzer);
        this.analyzer.connect(this.audioContext.destination);
    }

    private loadEQSettings() {
        try {
            const saved = localStorage.getItem('ytm-eq-presets');
            const activeName = localStorage.getItem('ytm-eq-active') || 'Flat';
            if (saved) {
                const presets = JSON.parse(saved);
                const active = presets.find((p: any) => p.name === activeName) || presets[0];
                if (active && this.filters.length > 0) {
                    active.bands.forEach((b: any, i: number) => {
                        if (this.filters[i]) {
                            this.filters[i].gain.value = b.gain;
                            this.filters[i].frequency.value = b.frequency;
                            this.filters[i].type = b.type;
                        }
                    });
                }
            }
        } catch (e) {
            console.error('Failed to load EQ settings', e);
        }
    }

    setBand(index: number, gain: number, freq?: number, type?: BiquadFilterType) {
        if (this.filters[index]) {
            this.filters[index].gain.value = gain;
            if (freq !== undefined) this.filters[index].frequency.value = freq;
            if (type !== undefined) this.filters[index].type = type;
            this.notify();
        }
    }

    getEQBands() {
        return this.filters.map(f => ({
            gain: f.gain.value,
            frequency: f.frequency.value,
            type: f.type
        }));
    }

    getAnalyzerData() {
        if (!this.analyzer) return new Uint8Array(0);
        const data = new Uint8Array(this.analyzer.frequencyBinCount);
        this.analyzer.getByteFrequencyData(data);
        return data;
    }

    private loadState() {
        try {
            const savedVolume = localStorage.getItem('ytm-volume');
            if (savedVolume !== null) {
                this.volume = parseInt(savedVolume, 10);
                this.audio.volume = this.volume / 100;
            }

            const savedShuffle = localStorage.getItem('ytm-shuffle');
            if (savedShuffle !== null) {
                this.shuffle = savedShuffle === 'true';
            }

            const savedRepeat = localStorage.getItem('ytm-repeat');
            if (savedRepeat !== null) {
                this.repeat = savedRepeat as any;
            }

            const savedAutoplay = localStorage.getItem('ytm-autoplay');
            if (savedAutoplay !== null) {
                this.autoplay = savedAutoplay === 'true';
            }

            const savedTrack = localStorage.getItem('ytm-last-track');
            if (savedTrack) {
                this.currentTrack = JSON.parse(savedTrack);
                this.duration = this.parseDuration(this.currentTrack?.duration || '0:00');
                if (this.currentTrack) this.fetchRecommendations(this.currentTrack.id);
            }

            const savedQueue = localStorage.getItem('ytm-queue');
            if (savedQueue) {
                this.queue = JSON.parse(savedQueue);
            }

            const savedQueueIndex = localStorage.getItem('ytm-queue-index');
            if (savedQueueIndex !== null) {
                this.queueIndex = parseInt(savedQueueIndex, 10);
            }
        } catch (e) {
            console.error('Failed to load player state:', e);
        }
    }

    private saveState() {
        try {
            localStorage.setItem('ytm-volume', this.volume.toString());
            localStorage.setItem('ytm-shuffle', this.shuffle.toString());
            localStorage.setItem('ytm-repeat', this.repeat);
            localStorage.setItem('ytm-autoplay', this.autoplay.toString());
            if (this.currentTrack) {
                localStorage.setItem('ytm-last-track', JSON.stringify(this.currentTrack));
            }
            localStorage.setItem('ytm-queue', JSON.stringify(this.queue));
            localStorage.setItem('ytm-queue-index', this.queueIndex.toString());
        } catch (e) {
            console.error('Failed to save player state:', e);
        }
    }

    subscribe(cb: PlayerCallback): () => void {
        this.listeners.add(cb);
        return () => { this.listeners.delete(cb); };
    }

    private notify() {
        this.listeners.forEach(cb => cb());
    }

    private setupEventListeners() {
        this.audio.addEventListener('play', () => {
            this.isPlaying = true;
            this.startTimer();
            this.notify();
        });

        this.audio.addEventListener('pause', () => {
            this.isPlaying = false;
            this.stopTimer();
            this.notify();
        });

        this.audio.addEventListener('ended', () => {
            if (this.repeat === 'one') {
                this.audio.currentTime = 0;
                this.audio.play();
            } else {
                this.next();
            }
        });

        this.audio.addEventListener('timeupdate', () => {
            // Only update if we're not in the middle of a track change
            if (this.audio.src) {
                this.currentTime = this.audio.currentTime;
                this.notify();
            }
        });

        this.audio.addEventListener('durationchange', () => {
            if (this.audio.src) {
                this.duration = this.audio.duration;
                this.notify();
            }
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.isPlaying = false;
            this.notify();
        });
    }

    private startTimer() {
        this.stopTimer();
        this.updateInterval = setInterval(() => {
            if (this.audio.src && !this.audio.paused) {
                this.currentTime = this.audio.currentTime;
                this.notify();
            }
        }, 500);
    }

    private stopTimer() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async playTrackList(tracks: YTMTrack[], startIndex: number = 0) {
        this.queue = [...tracks];
        this.queueIndex = startIndex;
        await this.playCurrentTrack();
    }

    addToQueue(track: YTMTrack) {
        this.queue.push(track);
        this.saveState();
        this.notify();
    }

    removeFromQueue(index: number) {
        if (index < 0 || index >= this.queue.length) return;
        if (index === this.queueIndex) {
            this.next();
        } else if (index < this.queueIndex) {
            this.queueIndex--;
        }
        this.queue.splice(index, 1);
        this.saveState();
        this.notify();
    }

    playNext(track: YTMTrack) {
        if (this.queue.length === 0) {
            this.playTrackList([track], 0);
        } else {
            this.queue.splice(this.queueIndex + 1, 0, track);
            this.saveState();
            this.notify();
        }
    }

    async playSingle(track: YTMTrack) {
        this.currentTrack = track;
        this.queue = [track];
        this.queueIndex = 0;
        await this.startPlayback(track);
    }

    async addToQueueAndPlay(track: YTMTrack) {
        // Check if track is already in queue
        const existingIndex = this.queue.findIndex(t => t.id === track.id);
        if (existingIndex !== -1) {
            this.queueIndex = existingIndex;
        } else {
            this.queue.push(track);
            this.queueIndex = this.queue.length - 1;
        }
        await this.playCurrentTrack();
    }

    private async playCurrentTrack() {
        if (this.queueIndex < 0 || this.queueIndex >= this.queue.length) return;
        this.currentTrack = this.queue[this.queueIndex];
        await this.startPlayback(this.currentTrack);
    }

    private async startPlayback(track: YTMTrack) {
        const currentPlaybackId = ++this.playbackId;
        
        // Immediate UI update and stop current audio
        this.audio.pause();
        this.audio.removeAttribute('src');
        this.audio.load(); // Reset audio element state
        
        this.isPlaying = true;
        this.currentTime = 0;
        this.duration = this.parseDuration(track.duration);
        this.saveState();
        this.notify();
        
        // Only fetch recommendations if we have few upcoming tracks or every other track
        const upcomingCount = this.queue.length - (this.queueIndex + 1);
        if (upcomingCount < 5 || this.playbackId % 2 === 0) {
            this.fetchRecommendations(track.id);
        }

        console.log('Fetching stream for:', track.title);
        try {
            const res = await (window as any).bridge.pyCall('get_stream_url', { videoId: track.id });
            
            // Check if this request is still relevant
            if (currentPlaybackId !== this.playbackId) {
                console.log('Aborting playback for obsolete request:', track.title);
                return;
            }

            if (res.status === 'ok' && res.url) {
                this.audio.src = res.url;
                this.audio.volume = this.volume / 100;
                await this.audio.play();
            } else {
                console.error('Failed to get stream URL:', res.message);
                this.next();
            }
        } catch (e) {
            console.error('Playback error:', e);
            if (currentPlaybackId === this.playbackId) {
                this.next();
            }
        }
    }

    private async fetchRecommendations(videoId: string) {
        try {
            const tracks = await getQueueRecommendations(videoId);
            // Filter out tracks already in the queue to avoid duplicates
            const queueIds = new Set(this.queue.map(t => t.id));
            this.recommendations = tracks.filter(t => !queueIds.has(t.id));
            this.notify();
        } catch (e) {
            console.error('Failed to fetch recommendations:', e);
        }
    }

    async togglePlay() {
        if (!this.currentTrack) return;
        
        // Initialize context on first user interaction
        this.initAudioContext();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        // If track is selected but no src is loaded (e.g. after restart), start playback normally
        if (!this.audio.src && this.currentTrack) {
            await this.startPlayback(this.currentTrack);
            return;
        }

        if (this.isPlaying) {
            this.audio.pause();
        } else {
            await this.audio.play();
        }
    }

    async next() {
        if (this.queue.length === 0) return;
        if (this.shuffle) {
            this.queueIndex = Math.floor(Math.random() * this.queue.length);
        } else {
            this.queueIndex++;
            if (this.queueIndex >= this.queue.length) {
                if (this.repeat === 'all') {
                    this.queueIndex = 0;
                } else if (this.autoplay && this.recommendations.length > 0) {
                    // Autoplay logic: add first recommendation to queue and play it
                    const nextTrack = this.recommendations[0];
                    this.queue.push(nextTrack);
                    // queueIndex is already correctly pointing to the new end
                } else {
                    this.isPlaying = false;
                    this.notify();
                    this.saveState();
                    return;
                }
            }
        }
        await this.playCurrentTrack();
    }

    async prev() {
        if (this.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        if (this.queueIndex > 0) {
            this.queueIndex--;
            await this.playCurrentTrack();
        }
    }

    async seek(time: number) {
        if (this.audio.src) {
            this.audio.currentTime = time;
            this.currentTime = time;
            this.notify();
        }
    }

    setVolume(vol: number) {
        this.volume = Math.max(0, Math.min(100, vol));
        this.audio.volume = this.volume / 100;
        if (this.volume > 0) {
            this.lastVolume = this.volume;
        }
        this.saveState();
        this.notify();
    }

    toggleMute() {
        if (this.volume > 0) {
            this.lastVolume = this.volume;
            this.setVolume(0);
        } else {
            this.setVolume(this.lastVolume || 80);
        }
    }

    toggleShuffle() {
        this.shuffle = !this.shuffle;
        this.saveState();
        this.notify();
    }

    toggleRepeat() {
        const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
        const idx = modes.indexOf(this.repeat);
        this.repeat = modes[(idx + 1) % modes.length];
        this.saveState();
        this.notify();
    }

    toggleAutoplay() {
        this.autoplay = !this.autoplay;
        this.saveState();
        this.notify();
    }

    getUpcoming(): YTMTrack[] {
        if (this.queueIndex < 0) return [];
        // Return all remaining tracks in the queue
        return this.queue.slice(this.queueIndex + 1);
    }

    async playFromQueue(index: number) {
        if (index < 0 || index >= this.queue.length) return;
        this.queueIndex = index;
        await this.playCurrentTrack();
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
