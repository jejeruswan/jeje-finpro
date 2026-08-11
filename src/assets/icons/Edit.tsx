import type { IconProps } from './types';

export function Edit({ size = 24, color, style, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={color ? { color, ...style } : style}
      {...rest}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.3 15.5285L15.9142 10.9142C16.2893 10.5392 16.5 10.0304 16.5 9.50001C16.5 8.96957 16.2893 8.46087 15.9142 8.08579V8.08579C15.1332 7.30476 13.8669 7.30476 13.0858 8.08579L8.47153 12.7C8.08904 13.0825 7.84092 13.5787 7.76442 14.1142L7.50515 15.9291C7.4829 16.0849 7.53529 16.2421 7.64657 16.3534C7.75786 16.4647 7.91504 16.517 8.07083 16.4948L9.88574 16.2355C10.4212 16.159 10.9175 15.9109 11.3 15.5285V15.5285Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="21"
        y="21"
        width="18"
        height="18"
        rx="3"
        transform="rotate(-180 21 21)"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
