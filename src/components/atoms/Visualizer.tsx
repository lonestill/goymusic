import React from 'react';
import styles from './Visualizer.module.css';

interface VisualizerProps {
    isPlaying: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isPlaying }) => {
    return (
        <div className={`${styles.visualizer} ${isPlaying ? styles.playing : ''}`}>
            <span className={styles.bar}></span>
            <span className={styles.bar}></span>
            <span className={styles.bar}></span>
        </div>
    );
};
