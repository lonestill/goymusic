import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Icon } from './Icon';
import styles from './IconButton.module.css';

interface IconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  size?: number;
  iconSize?: number;
  active?: boolean;
  className?: string;
  variant?: 'ghost' | 'solid' | 'accent';
}

/**
 * Atom: IconButton
 * A clickable icon button with hover effects and variants.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onClick,
  size = 44,
  iconSize = 20,
  active = false,
  className,
  variant = 'ghost'
}) => {
  return (
    <button 
      className={`${styles.button} ${styles[variant]} ${active ? styles.active : ''} ${className || ''}`}
      onClick={onClick}
      style={{ width: size, height: size }}
    >
      <Icon icon={icon} size={iconSize} />
    </button>
  );
};
