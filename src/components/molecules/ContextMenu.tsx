import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LucideIcon } from 'lucide-react';
import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  /** Текст пункта меню */
  label: string;
  /** Иконка (LucideIcon) */
  icon?: LucideIcon;
  /** Обработчик нажатия */
  onClick: () => void;
  /** Флаг "опасного" действия (удаление и т.д.) */
  isDanger?: boolean;
}

interface ContextMenuProps {
  /** Координата X появления меню */
  x: number;
  /** Координата Y появления меню */
  y: number;
  /** Список пунктов меню */
  items: ContextMenuItem[];
  /** Обработчик закрытия меню */
  onClose: () => void;
}

/**
 * <summary>
 * Компонент контекстного меню.
 * Отображается в портале поверх всего интерфейса.
 * Автоматически корректирует позицию, чтобы не выходить за границы экрана.
 * </summary>
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      let newX = x;
      let newY = y;

      // Корректировка по X
      if (x + menuRect.width > window.innerWidth) {
        newX = x - menuRect.width;
      }

      // Корректировка по Y
      if (y + menuRect.height > window.innerHeight) {
        newY = y - menuRect.height;
      }

      setPos({ x: newX, y: newY });
    }
  }, [x, y]);

  // Закрытие по клику вне меню или по нажатию Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <>
      <div className={styles.overlay} onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div 
        ref={menuRef}
        className={styles.menu}
        style={{ top: pos.y, left: pos.x }}
      >
        {items.map((item, i) => (
          <div 
            key={`${item.label}-${i}`}
            className={`${styles.item} ${item.isDanger ? styles.danger : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
              onClose();
            }}
          >
            {item.icon && <div className={styles.icon}><item.icon size={16} /></div>}
            <span className={styles.label}>{item.label}</span>
          </div>
        ))}
      </div>
    </>,
    document.body
  );
};
