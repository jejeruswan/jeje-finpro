import type { IconProps } from './types';

/** The Script inspector's title mark: a scroll of script
 *  (jess-mirage, node 710:135147 "Left Icon"). */
export function ScriptScroll({ size = 20, color, style, ...rest }: IconProps) {
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
        d="M10.4167 3.95801C10.7619 3.95801 11.0417 3.67819 11.0417 3.33301C11.0417 2.98783 10.7619 2.70801 10.4167 2.70801V3.33301V3.95801ZM1.66675 9.16634H2.29175V4.99968H1.66675H1.04175V9.16634H1.66675ZM3.33341 3.33301V3.95801H10.4167V3.33301V2.70801H3.33341V3.33301ZM1.66675 4.99968H2.29175C2.29175 4.42438 2.75812 3.95801 3.33341 3.95801V3.33301V2.70801C2.06776 2.70801 1.04175 3.73402 1.04175 4.99968H1.66675Z"
        fill="currentColor"
      />
      <path d="M10.4167 3.33301H12.5001C13.8808 3.33301 15.0001 4.4523 15.0001 5.83301V9.16634" stroke="currentColor" strokeWidth="1.25" />
      <path
        d="M15.625 9.16602C15.625 8.82084 15.3452 8.54102 15 8.54102C14.6548 8.54102 14.375 8.82084 14.375 9.16602H15H15.625ZM15 9.16602H14.375V12.4993H15H15.625V9.16602H15Z"
        fill="currentColor"
      />
      <path d="M5.00008 14.1663V4.99967C5.00008 4.0792 4.25389 3.33301 3.33341 3.33301C2.41294 3.33301 1.66675 4.0792 1.66675 4.99967V7.49967" stroke="currentColor" strokeWidth="1.25" />
      <path d="M4.99992 6.66602L4.99992 14.9993C4.99992 15.9198 5.74611 16.666 6.66659 16.666C7.58706 16.666 8.33325 15.9198 8.33325 14.9993L8.33325 14.166" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8.33339 14.9997V12.083H18.3334V14.1663C18.3334 15.5471 17.2141 16.6663 15.8334 16.6663H6.66675" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}
