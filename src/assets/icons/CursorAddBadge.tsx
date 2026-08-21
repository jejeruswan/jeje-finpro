import type { IconProps } from './types';

/** The green ⊕ that rides beside the pointer over an empty script lane —
 *  lifted from the design's OS-cursor bundle (Figma 736:153602). */
export function CursorAddBadge({ size = 18, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      {...rest}
    >
      <circle cx="9" cy="9" r="9" fill="url(#cursor-add-badge-g)" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13 8H10V5C10 4.448 9.552 4 9 4C8.448 4 8 4.448 8 5V8H5C4.448 8 4 8.448 4 9C4 9.552 4.448 10 5 10H8V13C8 13.552 8.448 14 9 14C9.552 14 10 13.552 10 13V10H13C13.552 10 14 9.552 14 9C14 8.448 13.552 8 13 8Z"
        fill="white"
      />
      <defs>
        <linearGradient id="cursor-add-badge-g" x1="9" y1="0" x2="9" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5ECE3D" />
          <stop offset="1" stopColor="#188D18" />
        </linearGradient>
      </defs>
    </svg>
  );
}
