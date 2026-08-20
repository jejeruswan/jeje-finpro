import type { IconProps } from './types';

/** The Attention inspector's title mark: an eye inside viewfinder corner
 *  brackets (jess-mirage, node 710:135514 "Left Icon"). */
export function AttentionEye({ size = 20, color, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={color ? { color, ...style } : style}
      {...rest}
    >
      <path
        d="M16.0416 10C16.0416 10 14.1536 13.75 9.99992 13.75C5.84627 13.75 3.95825 10 3.95825 10C3.95825 10 5.84627 6.25 9.99992 6.25C14.1536 6.25 16.0416 10 16.0416 10Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <ellipse cx="10.0001" cy="10" rx="1.88802" ry="1.875" stroke="currentColor" strokeWidth="1.25" />
      <path d="M2.5 15V16.6667C2.5 17.1269 2.8731 17.5 3.33333 17.5H5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 5L17.5 3.33333C17.5 2.8731 17.1269 2.5 16.6667 2.5L15 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.5 5V3.33333C2.5 2.8731 2.8731 2.5 3.33333 2.5H5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 15L17.5 16.6667C17.5 17.1269 17.1269 17.5 16.6667 17.5L15 17.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
