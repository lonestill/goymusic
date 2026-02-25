import React, { useState, useRef, useEffect } from 'react';
import { Settings, LogOut, PanelLeftClose, PanelLeftOpen, User as UserIcon, ChevronDown, Music } from 'lucide-react';
import { NavLink } from '../molecules/NavLink';
import { IconButton } from '../atoms/IconButton';
import { YTMPlaylist, YTMUser } from '../../api/yt';
import { ActiveView } from '../../types';
import { Skeleton } from '../atoms/Skeleton';
import { LazyImage } from '../atoms/LazyImage';
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
  user?: YTMUser | null;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  playlists = [],
  activeView,
  onSelectView,
  isAuthenticated,
  isInitializing,
  onLogout,
  user,
  className
}) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoClick = () => {
    onSelectView?.({ type: 'home' });
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${className || ''}`}>
      <div className={styles.header}>
        {/* Toggle button on the left */}
        <IconButton
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          size={32}
          iconSize={18}
          onClick={onToggleCollapse}
          className={styles.toggleBtn}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        />
        {!collapsed && (
          <h2 className={styles.logo} onClick={handleLogoClick} style={{ cursor: 'pointer' }}>GoyMusic</h2>
        )}
      </div>

      {isAuthenticated && (
        <div className={`${styles.userProfile} ${collapsed ? styles.userProfileCollapsed : ''}`} ref={userMenuRef}>
          <div 
            className={styles.userTrigger}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            {user?.thumbUrl ? (
              <LazyImage 
                src={user.thumbUrl} 
                alt="Avatar" 
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarPlaceholder}>
                <UserIcon size={16} />
              </div>
            )}
            {!collapsed && (
              <>
                <span className={styles.userName}>{user?.name || 'Account'}</span>
                <ChevronDown size={14} className={`${styles.chevron} ${showUserMenu ? styles.chevronOpen : ''}`} />
              </>
            )}
          </div>

          {showUserMenu && (
            <div className={`${styles.userMenu} ${collapsed ? styles.userMenuCollapsed : ''}`}>
              <button 
                className={styles.menuItem} 
                onClick={() => {
                  onSelectView?.({ type: 'settings' });
                  setShowUserMenu(false);
                }}
              >
                <Settings size={14} />
                Settings
              </button>
              <div className={styles.menuDivider} />
              <button onClick={onLogout} className={`${styles.menuItem} ${styles.logoutBtn}`}>
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Collection / Playlists Section */}
      <div className={styles.playlistSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>{collapsed ? '' : 'Collection'}</h3>
        </div>
        
        <div className={styles.scrollArea}>
          <nav className={styles.nav}>
            {/* Always keep Liked Songs here as part of collection if not redundant, 
                but user said remove it. Let's see. 
                Actually, let's just show Playlists as requested. */}
            
            {isInitializing ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ padding: '0.4rem 0.75rem' }}>
                  <Skeleton width="100%" height={20} borderRadius={6} />
                </div>
              ))
            ) : (
              playlists.map(pl => (
                <NavLink
                  key={pl.id}
                  icon={Music}
                  label={collapsed ? '' : pl.title}
                  active={activeView?.type === 'playlist' && activeView?.playlistId === pl.id}
                  onClick={() => onSelectView?.({ type: 'playlist', playlistId: pl.id, playlistTitle: pl.title })}
                />
              ))
            )}
          </nav>
        </div>
      </div>
    </aside>
  );
};
