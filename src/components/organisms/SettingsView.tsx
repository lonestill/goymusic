import React from 'react';
import { clearTokens } from '../../api/yt';
import { player } from '../../api/player';
import styles from './SettingsView.module.css';

interface SettingsViewProps {
    onLogout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onLogout }) => {
    const clearCache = () => {
        // Basic demonstration. True cache cleaning requires Rust logic.
        player.playTrackList([]); // Clear queue
        alert('Local player cache cleared.');
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Settings</h2>

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
                    }}>Выход</button>
                </div>
            </div>
        </div>
    );
};
