import React from 'react';
import { LucideIcon } from 'lucide-react';
import styles from './IconButton.module.css';

export interface IconButtonProps {
  icon: LucideIcon;
  onClick?: () => void;
  size?: number;
  iconSize?: number;
  active?: boolean;
  variant?: 'ghost' | 'solid' | 'outline';
  className?: string;
  disabled?: boolean;
  title?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  onClick,
  size = 40,
  iconSize = 20,
  active = false,
  variant = 'ghost',
  className = '',
  disabled = false,
  title
}) => {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${active ? styles.active : ''} ${className}`}
      onClick={onClick}
      style={{ width: size, height: size }}
      disabled={disabled}
      title={title}
    >
      <Icon size={iconSize} />
    </button>
  );
};
