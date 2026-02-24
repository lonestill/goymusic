import React, { useState, useEffect } from 'react';
import { clearTokens } from '../../api/yt';
import { player } from '../../api/player';
import styles from './SettingsView.module.css';

interface SettingsViewProps {
    onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onLogout }) => {
    const [accent, setAccent] = useState('#22c55e');

    // You would typically load this from LocalStorage
    useEffect(() => {
        const saved = localStorage.getItem('goymusic-accent');
        if (saved) setAccent(saved);
    }, []);

    const handleAccentChange = (val: string) => {
        setAccent(val);
        document.documentElement.style.setProperty('--accent', val);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(val);
        if (result) {
            const r = parseInt(result[1], 16);
            const g = parseInt(result[2], 16);
            const b = parseInt(result[3], 16);
            document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
            document.documentElement.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.1)`);
        }
        localStorage.setItem('goymusic-accent', val);
    };

    const clearCache = () => {
        // Basic demonstration. True cache cleaning requires Rust logic.
        player.playTrackList([]); // Clear queue
        alert('Local player cache cleared.');
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Settings</h2>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Appearance</h3>
                <label className={styles.row}>
                    <span>Accent Color</span>
                    <input
                        type="color"
                        value={accent}
                        onChange={(e) => handleAccentChange(e.target.value)}
                        className={styles.colorPicker}
                    />
                </label>
            </div>

            <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Account & Data</h3>
                <div className={styles.row}>
                    <div className={styles.col}>
                        <span>Clear App Cache</span>
                        <span className={styles.subtitle}>Frees up local queue and session state variables.</span>
                    </div>
                    <button className={styles.btnSecondary} onClick={clearCache}>Clear</button>
                </div>
                <div className={styles.row}>
                    <div className={styles.col}>
                        <span>Log out from YouTube</span>
                        <span className={styles.subtitle}>Deletes login cookies and restarts the app.</span>
                    </div>
                    <button className={styles.btnDanger} onClick={() => {
                        clearTokens();
                        onLogout();
                    }}>Sign Out</button>
                </div>
            </div>
        </div>
    );
};
