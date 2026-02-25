import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Icon } from '../atoms/Icon';
import styles from './NavLink.module.css';

interface NavLinkProps {
  icon?: LucideIcon;
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Molecule: NavLink
 * A navigation item for the sidebar with an icon and label.
 */
export const NavLink: React.FC<NavLinkProps> = ({
  icon,
  label,
  active = false,
  onClick,
  className
}) => {
  return (
    <div 
      className={`${styles.container} ${active ? styles.active : ''} ${className || ''}`}
      onClick={onClick}
    >
      {icon && <Icon icon={icon} size={18} className={styles.icon} />}
      <span className={styles.label}>{label}</span>
    </div>
  );
};
