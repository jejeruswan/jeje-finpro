import type { IconProps } from './types';

/** The Camera State inspector's title mark: a lens in a gimbal sweep
 *  (jess-mirage, node 710:135607 "Left Icon"). */
export function CameraLens({ size = 20, color, style, ...rest }: IconProps) {
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
      <circle cx="10.0001" cy="10.8333" r="4.58333" stroke="currentColor" strokeWidth="1.25" />
      <path d="M15.4167 5.41634L16.2501 4.58301" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="11.2501" cy="9.58333" r="0.833333" fill="currentColor" />
      <path
        d="M12.6317 2.91505C11.8045 2.64579 10.9197 2.5 10.0001 2.5C5.39771 2.5 1.66675 6.15182 1.66675 10.6566C1.66675 13.035 2.70684 15.1757 4.36614 16.6667M17.9094 8.08081C17.9838 8.29989 18.049 8.5231 18.1045 8.75C18.2542 9.36163 18.3334 10 18.3334 10.6566C18.3334 13.035 17.2933 15.1757 15.634 16.6667"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
