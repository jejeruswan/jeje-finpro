import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

type IconButtonProps = {
  children: ReactNode;
  /** Square size in px. Maps to the design's 40 / 32 / 26 / 24 icon buttons. */
  size?: 40 | 32 | 26 | 24;
  variant?: 'solid' | 'active' | 'ghost' | 'selected';
  /** Pill (fully rounded) shape instead of the default 8px radius. */
  pill?: boolean;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const SIZE_CLASS: Record<number, string> = {
  40: '',
  32: 'icon-btn--32',
  26: 'icon-btn--26',
  24: 'icon-btn--24',
};

export function IconButton({
  children,
  size = 40,
  variant = 'solid',
  pill = false,
  className = '',
  ...rest
}: IconButtonProps) {
  const classes = [
    'icon-btn',
    SIZE_CLASS[size],
    variant !== 'solid' ? `icon-btn--${variant}` : '',
    pill ? 'icon-btn--pill' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
