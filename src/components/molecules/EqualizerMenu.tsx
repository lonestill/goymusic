import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SlidersHorizontal, Save, Trash2, ChevronDown, Check, X as CloseIcon, Plus } from 'lucide-react';
import { player } from '../../api/player';
import { IconButton } from '../atoms/IconButton';
import styles from './EqualizerMenu.module.css';

interface Band {
    gain: number;
    frequency: number;
    type: BiquadFilterType;
}

interface Preset {
    name: string;
    bands: Band[];
}

const DEFAULT_BANDS: Band[] = [
    { frequency: 60, gain: 0, type: 'lowshelf' },
    { frequency: 250, gain: 0, type: 'peaking' },
    { frequency: 1000, gain: 0, type: 'peaking' },
    { frequency: 4000, gain: 0, type: 'peaking' },
    { frequency: 8000, gain: 0, type: 'peaking' },
    { frequency: 16000, gain: 0, type: 'highshelf' },
];

const FILTER_TYPES: BiquadFilterType[] = ['lowshelf', 'peaking', 'highshelf', 'lowpass', 'highpass', 'bandpass', 'notch', 'allpass'];

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MAX_GAIN = 15;

export const EqualizerMenu: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [bands, setBands] = useState<Band[]>(DEFAULT_BANDS);
    const [presets, setPresets] = useState<Preset[]>([]);
    const [activePreset, setActivePreset] = useState('Flat');
    const [selectedBand, setSelectedBand] = useState<number | null>(null);
    const [showPresets, setShowPresets] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [newPresetName, setNewPresetName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const analyzerRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);

    // Initialize/Load
    useEffect(() => {
        const savedPresets = localStorage.getItem('ytm-eq-presets');
        const active = localStorage.getItem('ytm-eq-active') || 'Flat';
        
        if (savedPresets) {
            const parsed = JSON.parse(savedPresets);
            setPresets(parsed);
            const current = parsed.find((p: Preset) => p.name === active);
            if (current) {
                const loadedBands = current.bands.slice(0, 6);
                setBands(loadedBands);
                setActivePreset(active);
            }
        } else {
            const flat = { name: 'Flat', bands: DEFAULT_BANDS };
            setPresets([flat]);
            localStorage.setItem('ytm-eq-presets', JSON.stringify([flat]));
        }

        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setIsSaving(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getX = (freq: number, width: number) => {
        return (Math.log10(freq) - Math.log10(MIN_FREQ)) / (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ)) * width;
    };

    const getY = (gain: number, height: number) => {
        return height / 2 - (gain / MAX_GAIN) * (height / 2);
    };

    const getFreq = (x: number, width: number) => {
        const ratio = x / width;
        const log = Math.log10(MIN_FREQ) + ratio * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ));
        return Math.pow(10, log);
    };

    const getGainFromY = (y: number, height: number) => {
        const ratio = (height / 2 - y) / (height / 2);
        return Math.max(-MAX_GAIN, Math.min(MAX_GAIN, ratio * MAX_GAIN));
    };

    const getMagnitudeResponse = (f: number, band: Band): number => {
        const fs = 44100;
        const w0 = 2 * Math.PI * band.frequency / fs;
        const alpha = Math.sin(w0) / (2 * 1);
        const A = Math.pow(10, band.gain / 40);
        
        let b0, b1, b2, a0, a1, a2;

        if (band.type === 'peaking') {
            b0 = 1 + alpha * A; b1 = -2 * Math.cos(w0); b2 = 1 - alpha * A;
            a0 = 1 + alpha / A; a1 = -2 * Math.cos(w0); a2 = 1 - alpha / A;
        } else if (band.type === 'lowshelf') {
            const sqrtA = Math.sqrt(A);
            b0 = A * ((A + 1) - (A - 1) * Math.cos(w0) + 2 * sqrtA * alpha);
            b1 = 2 * A * ((A - 1) - (A + 1) * Math.cos(w0));
            b2 = A * ((A + 1) - (A - 1) * Math.cos(w0) - 2 * sqrtA * alpha);
            a0 = (A + 1) + (A - 1) * Math.cos(w0) + 2 * sqrtA * alpha;
            a1 = -2 * ((A - 1) + (A + 1) * Math.cos(w0));
            a2 = (A + 1) + (A - 1) * Math.cos(w0) - 2 * sqrtA * alpha;
        } else if (band.type === 'highshelf') {
            const sqrtA = Math.sqrt(A);
            b0 = A * ((A + 1) + (A - 1) * Math.cos(w0) + 2 * sqrtA * alpha);
            b1 = -2 * A * ((A - 1) + (A + 1) * Math.cos(w0));
            b2 = A * ((A + 1) + (A - 1) * Math.cos(w0) - 2 * sqrtA * alpha);
            a0 = (A + 1) - (A - 1) * Math.cos(w0) + 2 * sqrtA * alpha;
            a1 = 2 * ((A - 1) - (A + 1) * Math.cos(w0));
            a2 = (A + 1) - (A - 1) * Math.cos(w0) - 2 * sqrtA * alpha;
        } else {
            return 0;
        }

        const phi = 2 * Math.PI * f / fs;
        const cosPhi = Math.cos(phi);
        const cos2Phi = Math.cos(2 * phi);
        const sinPhi = Math.sin(phi);
        const sin2Phi = Math.sin(2 * phi);

        const numReal = b0 + b1 * cosPhi + b2 * cos2Phi;
        const numImag = b1 * sinPhi + b2 * sin2Phi;
        const denReal = a0 + a1 * cosPhi + a2 * cos2Phi;
        const denImag = a1 * sinPhi + a2 * sin2Phi;

        const mag = Math.sqrt((numReal ** 2 + numImag ** 2) / (denReal ** 2 + denImag ** 2));
        return 20 * Math.log10(mag);
    };

    const drawAnalyzer = useCallback(() => {
        if (!analyzerRef.current) return;
        const ctx = analyzerRef.current.getContext('2d');
        if (!ctx) return;

        const data = player.getAnalyzerData(); // This is 1024 bins (linear)
        const width = analyzerRef.current.width;
        const height = analyzerRef.current.height;
        const sampleRate = 44100;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(137, 180, 250, 0.12)';
        
        const barCount = 80;
        const barWidth = width / barCount;
        
        for (let i = 0; i < barCount; i++) {
            // Find frequency range for this visual bar on log scale
            const fStart = getFreq(i * barWidth, width);
            const fEnd = getFreq((i + 1) * barWidth, width);
            
            // Map frequencies to FFT bin indices
            const iStart = Math.max(0, Math.floor(fStart / (sampleRate / 2) * data.length));
            const iEnd = Math.min(data.length - 1, Math.floor(fEnd / (sampleRate / 2) * data.length));
            
            // Get max value in this frequency range
            let maxVal = 0;
            for (let j = iStart; j <= iEnd; j++) {
                if (data[j] > maxVal) maxVal = data[j];
            }
            
            // Apply slight boost to higher frequencies for better visualization 
            // (since they naturally have less energy)
            const boost = 1 + (i / barCount) * 0.5;
            const barHeight = Math.min(height, (maxVal / 255) * height * boost);
            
            ctx.fillRect(i * barWidth, height - barHeight, barWidth - 1, barHeight);
        }
        requestRef.current = requestAnimationFrame(drawAnalyzer);
    }, []);

    useEffect(() => {
        if (isOpen) requestRef.current = requestAnimationFrame(drawAnalyzer);
        else cancelAnimationFrame(requestRef.current);
        return () => cancelAnimationFrame(requestRef.current);
    }, [isOpen, drawAnalyzer]);

    useEffect(() => {
        if (!canvasRef.current || !isOpen) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        ctx.clearRect(0, 0, width, height);

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        [15, 10, 5, 0, -5, -10, -15].forEach(g => {
            const y = getY(g, height);
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
            if (g !== 0) ctx.fillText(`${g > 0 ? '+' : ''}${g}dB`, 4, y - 4);
        });

        [60, 250, 1000, 4000, 10000, 16000].forEach(f => {
            const x = getX(f, width);
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
            ctx.fillText(label, x + 4, height - 4);
        });

        ctx.beginPath();
        ctx.strokeStyle = '#89b4fa';
        ctx.lineWidth = 2;
        
        for (let x = 0; x < width; x++) {
            const f = getFreq(x, width);
            let totalGain = 0;
            bands.forEach(b => {
                totalGain += getMagnitudeResponse(f, b);
            });
            const y = getY(totalGain, height);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        bands.forEach((b, i) => {
            const x = getX(b.frequency, width);
            const y = getY(b.gain, height);
            const active = selectedBand === i;
            ctx.fillStyle = active ? '#89b4fa' : '#ffffff';
            ctx.shadowBlur = active ? 10 : 0;
            ctx.shadowColor = '#89b4fa';
            ctx.beginPath();
            ctx.arc(x, y, active ? 5 : 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if (active) {
                ctx.strokeStyle = 'rgba(137, 180, 250, 0.4)';
                ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke();
            }
        });
    }, [bands, isOpen, selectedBand]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const width = canvasRef.current!.width;
        const height = canvasRef.current!.height;

        let found = -1;
        bands.forEach((b, i) => {
            const px = getX(b.frequency, width);
            const py = getY(b.gain, height);
            const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
            if (dist < 15) found = i;
        });

        if (found !== -1) {
            setSelectedBand(found);
            setIsDragging(true);
        } else {
            setSelectedBand(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging || selectedBand === null) return;
        const rect = canvasRef.current!.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        
        const width = canvasRef.current!.width;
        const height = canvasRef.current!.height;
        
        let newFreq = getFreq(x, width);
        const newGain = getGainFromY(y, height);
        
        const prev = bands[selectedBand - 1];
        const next = bands[selectedBand + 1];
        if (prev && newFreq < prev.frequency + 10) newFreq = prev.frequency + 10;
        if (next && newFreq > next.frequency - 10) newFreq = next.frequency - 10;

        const newBands = [...bands];
        newBands[selectedBand] = { ...newBands[selectedBand], frequency: newFreq, gain: newGain };
        setBands(newBands);
        player.setBand(selectedBand, newGain, newFreq);
        setActivePreset('Custom');
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleSave = () => {
        if (!newPresetName.trim()) return;
        const name = newPresetName.trim();
        const newPresets = [...presets.filter(p => p.name !== name), { name, bands: [...bands] }];
        setPresets(newPresets);
        setActivePreset(name);
        localStorage.setItem('ytm-eq-presets', JSON.stringify(newPresets));
        localStorage.setItem('ytm-eq-active', name);
        setIsSaving(false);
        setNewPresetName('');
    };

    const applyPreset = (p: Preset) => {
        const loadedBands = p.bands.slice(0, 6);
        setBands(loadedBands);
        setActivePreset(p.name);
        loadedBands.forEach((b, i) => player.setBand(i, b.gain, b.frequency, b.type));
        localStorage.setItem('ytm-eq-active', p.name);
        setShowPresets(false);
    };

    const deletePreset = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (name === 'Flat') return;
        const newPresets = presets.filter(p => p.name !== name);
        setPresets(newPresets);
        if (activePreset === name) applyPreset(presets.find(p => p.name === 'Flat')!);
        localStorage.setItem('ytm-eq-presets', JSON.stringify(newPresets));
    };

    const updateType = (type: BiquadFilterType) => {
        if (selectedBand === null) return;
        const newBands = [...bands];
        newBands[selectedBand] = { ...newBands[selectedBand], type };
        setBands(newBands);
        player.setBand(selectedBand, newBands[selectedBand].gain, newBands[selectedBand].frequency, type);
    };

    return (
        <div className={styles.container} ref={containerRef}>
            <IconButton 
                icon={SlidersHorizontal} 
                size={28} 
                iconSize={14} 
                onClick={() => setIsOpen(!isOpen)} 
                className={isOpen ? styles.active : ''}
                title="Equalizer"
            />

            {isOpen && (
                <div className={styles.menu}>
                    <div className={styles.header}>
                        {!isSaving ? (
                            <>
                                <div className={styles.presetSelector}>
                                    <button className={styles.presetBtn} onClick={() => setShowPresets(!showPresets)}>
                                        {activePreset}
                                        <ChevronDown size={14} />
                                    </button>
                                    {showPresets && (
                                        <div className={styles.presetsDropdown}>
                                            {presets.map(p => (
                                                <div key={p.name} className={styles.presetItem} onClick={() => applyPreset(p)}>
                                                    <span>{p.name}</span>
                                                    <div className={styles.presetActions}>
                                                        {activePreset === p.name && <Check size={12} />}
                                                        {p.name !== 'Flat' && (
                                                            <Trash2 size={12} className={styles.deleteIcon} onClick={(e) => deletePreset(p.name, e)} />
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <IconButton icon={Plus} size={28} iconSize={14} onClick={() => setIsSaving(true)} title="Save current as new preset" />
                            </>
                        ) : (
                            <div className={styles.saveForm}>
                                <input 
                                    autoFocus
                                    placeholder="Preset Name..." 
                                    value={newPresetName}
                                    onChange={(e) => setNewPresetName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                />
                                <IconButton icon={Check} size={28} onClick={handleSave} className={styles.saveBtn} />
                                <IconButton icon={CloseIcon} size={28} onClick={() => setIsSaving(false)} />
                            </div>
                        )}
                    </div>

                    <div className={styles.visualizer}>
                        <canvas ref={analyzerRef} width={288} height={140} className={styles.spectrum} />
                        <canvas 
                            ref={canvasRef} 
                            width={288} 
                            height={140} 
                            className={styles.curve} 
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        />
                    </div>

                    <div className={styles.controls}>
                        {selectedBand !== null ? (
                            <div className={styles.bandEditor}>
                                <div className={styles.info}>
                                    <span>Band {selectedBand + 1}</span>
                                    <span>{Math.round(bands[selectedBand].frequency)}Hz / {bands[selectedBand].gain.toFixed(1)}dB</span>
                                </div>
                                <div className={styles.typeGrid}>
                                    {FILTER_TYPES.slice(0, 3).map(t => (
                                        <button 
                                            key={t} 
                                            className={`${styles.typeBtn} ${bands[selectedBand].type === t ? styles.typeActive : ''}`}
                                            onClick={() => updateType(t)}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className={styles.hint}>Move points on the graph to adjust sound</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
