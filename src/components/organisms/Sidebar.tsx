import React from 'react';
import { Home, Search, Library, ChevronLeft, ChevronRight } from 'lucide-react';
import { NavLink } from '../molecules/NavLink';
import { IconButton } from '../atoms/IconButton';
import styles from './Sidebar.module.css';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

/**
 * Organism: Sidebar
 * The left navigation panel with Home, Search, and Library links.
 * Supports a mini (collapsed) state with animation.
 */
export const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed = false, 
  onToggleCollapse,
  className 
}) => {
  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${className || ''}`}>
      <div className={styles.header}>
        <h2 className={styles.logo}>{collapsed ? 'GM' : 'GoyMusic'}</h2>
        <IconButton 
          icon={collapsed ? ChevronRight : ChevronLeft} 
          size={32} 
          iconSize={16} 
          onClick={onToggleCollapse}
          className={styles.toggleBtn}
        />
      </div>
      
      <nav className={styles.nav}>
        <NavLink icon={Home} label={collapsed ? '' : 'Home'} active />
        <NavLink icon={Search} label={collapsed ? '' : 'Search'} />
        <NavLink icon={Library} label={collapsed ? '' : 'Library'} />
      </nav>

      {!collapsed && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Your Playlists</h3>
          <nav className={styles.nav}>
            <NavLink label="Late Night Vibes" />
            <NavLink label="Chill Study" />
            <NavLink label="Metal Core" />
          </nav>
        </div>
      )}
    </aside>
  );
};
