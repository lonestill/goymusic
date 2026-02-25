import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Minus, Square, X, ChevronLeft, RefreshCw, Search } from 'lucide-react';
import { IconButton } from '../atoms/IconButton';
import { EqualizerMenu } from '../molecules/EqualizerMenu';
import { getSearchSuggestions } from '../../api/yt';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onBack?: () => void;
  onRefresh?: () => void;
  onSearch?: (query: string) => void;
  canGoBack?: boolean;
}

/**
 * Organism: TitleBar
 * Custom window title bar with traffic lights (window controls) and theme toggle.
 * Now includes navigation controls (Back, Refresh) and a central Search input.
 */
export const TitleBar: React.FC<TitleBarProps> = ({ 
  theme, 
  onToggleTheme,
  onBack,
  onRefresh,
  onSearch,
  canGoBack = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length > 1) {
        try {
          const results = await getSearchSuggestions(searchQuery.trim());
          setSuggestions(results);
        } catch (e) {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    };

    const debounce = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent, forcedQuery?: string) => {
    e?.preventDefault();
    const query = forcedQuery || searchQuery;
    if (query.trim() && onSearch) {
      setShowSuggestions(false);
      onSearch(query.trim());
      setSearchQuery(''); // Optional: clear after search or keep it
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    handleSearchSubmit(undefined, suggestion);
  };

  const handleMinimize = () => {
    window.bridge.winMinimize();
  };

  const handleMaximize = () => {
    window.bridge.winMaximize();
  };

  const handleClose = () => {
    window.bridge.winClose();
  };

  return (
    <header className={styles.titleBar}>
      {/* Left: Navigation Controls */}
      <div className={styles.leftControls} style={{ WebkitAppRegion: 'no-drag' } as any}>
        {onBack && (
          <IconButton 
            icon={ChevronLeft} 
            size={24} 
            iconSize={16} 
            onClick={onBack}
            disabled={!canGoBack}
            title="Go Back"
          />
        )}
        {onRefresh && (
          <IconButton 
            icon={RefreshCw} 
            size={24} 
            iconSize={14} 
            onClick={onRefresh}
            title="Refresh View"
          />
        )}
      </div>

      {/* Center: Search Area (Replaces Title) */}
      <div className={styles.searchRegion} style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div ref={searchContainerRef} className={styles.searchWrapper}>
          <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
            <div className={styles.inputIconWrapper}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Search songs, artists..."
                className={styles.searchInput}
              />
            </div>
          </form>
          
          {showSuggestions && suggestions.length > 0 && (
            <div className={styles.suggestionsDropdown}>
              {suggestions.map((s, i) => (
                <div 
                  key={i} 
                  className={styles.suggestionItem}
                  onClick={() => handleSuggestionClick(s)}
                >
                  <Search size={12} className={styles.suggestionIcon} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Window Controls */}
      <div className={styles.windowControls} style={{ WebkitAppRegion: 'no-drag' } as any}>
        <EqualizerMenu />
        <IconButton
          icon={theme === 'dark' ? Sun : Moon}
          size={28}
          iconSize={14}
          onClick={onToggleTheme}
          className={styles.themeToggle}
        />
        <div className={styles.divider} />
        <button onClick={handleMinimize} className={styles.controlBtn} title="Minimize">
          <Minus size={14} />
        </button>
        <button onClick={handleMaximize} className={styles.controlBtn} title="Maximize">
          <Square size={12} />
        </button>
        <button onClick={handleClose} className={`${styles.controlBtn} ${styles.closeBtn}`} title="Close">
          <X size={14} />
        </button>
      </div>
    </header>
  );
};
