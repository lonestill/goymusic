import React from 'react';
import { Search, Heart, ChevronLeft, ChevronRight, Settings, LogOut } from 'lucide-react';
import { NavLink } from '../molecules/NavLink';
import { IconButton } from '../atoms/IconButton';
import { YTMPlaylist } from '../../api/yt';
import { ActiveView } from '../../App';
import { Skeleton } from '../atoms/Skeleton';
import styles from './Sidebar.module.css';

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  playlists?: YTMPlaylist[];
  activeView?: ActiveView;
  onSelectView?: (view: ActiveView) => void;
  isAuthenticated?: boolean;
  isInitializing?: boolean;
  onLogout?: () => void;
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
  playlists = [],
  activeView,
  onSelectView,
  isAuthenticated,
  isInitializing,
  onLogout,
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
        <NavLink
          icon={Heart}
          label={collapsed ? '' : 'Liked Songs'}
          active={activeView?.type === 'liked'}
          onClick={() => onSelectView?.({ type: 'liked' })}
        />
        <NavLink
          icon={Search}
          label={collapsed ? '' : 'Search'}
          active={activeView?.type === 'search'}
          onClick={() => onSelectView?.({ type: 'search', searchQuery: '' })}
        />
        <NavLink
          icon={Settings}
          label={collapsed ? '' : 'Settings'}
          active={activeView?.type === 'settings'}
          onClick={() => onSelectView?.({ type: 'settings' })}
        />
      </nav>

      {!collapsed && (isInitializing ? (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Your Playlists</h3>
          <nav className={styles.nav}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center' }}>
                <Skeleton width="100%" height={20} borderRadius={6} />
              </div>
            ))}
          </nav>
        </div>
      ) : playlists.length > 0 ? (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Your Playlists</h3>
          <nav className={styles.nav}>
            {playlists.map(pl => (
              <NavLink
                key={pl.id}
                label={pl.title}
                active={activeView?.type === 'playlist' && activeView?.playlistId === pl.id}
                onClick={() => onSelectView?.({ type: 'playlist', playlistId: pl.id, playlistTitle: pl.title })}
              />
            ))}
          </nav>
        </div>
      ) : null)}

      {isAuthenticated && (
        <div style={{ marginTop: 'auto', padding: '0.75rem' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%', padding: '0.6rem 0.75rem',
              background: 'transparent', border: '1px solid var(--border-subtle)',
              borderRadius: '8px', color: 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: '0.5rem', transition: 'all 0.15s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ef4444';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <LogOut size={16} />
            {!collapsed && 'Sign out'}
          </button>
        </div>
      )}
    </aside>
  );
};
