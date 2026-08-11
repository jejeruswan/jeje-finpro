import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ui.css';

type ButtonProps = {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  pill?: boolean;
  leftIcon?: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  variant = 'secondary',
  pill = false,
  leftIcon,
  className = '',
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant === 'primary' ? 'btn--primary' : '',
    pill ? 'btn--pill' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={classes} {...rest}>
      {leftIcon}
      {children}
    </button>
  );
}
