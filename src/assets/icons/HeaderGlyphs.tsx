import type { IconProps } from './types';

/* The header + canvas chrome glyphs, exported from Figma (jess-mirage,
   Raw-09 · 756:166093). All stroke/fill on currentColor so the buttons'
   existing colors apply. */

/** Sidebar toggle (Figma 61:16211): rounded frame, left panel filled. */
export function SidebarPanel({ size = 20, color, style, ...rest }: IconProps) {
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
      <rect x="3.125" y="3.125" width="13.75" height="13.75" rx="2.1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="4.167" y="4.167" width="5.833" height="11.666" rx="0.833" fill="currentColor" />
    </svg>
  );
}

/** Undo (Figma 27:2378): the curl-back arrow. */
export function UndoArrow({ size = 20, color, style, ...rest }: IconProps) {
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
      <g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" transform="translate(5.208 4.792)">
        <path d="M2.29167 0.625013L0.625 2.5893L2.29167 4.55358" />
        <path d="M0.625081 2.58923H5.62508C7.46619 2.58923 8.95841 4.20125 8.95841 6.19042C8.95841 8.17958 7.46619 9.79161 5.62508 9.79161H1.18064" />
      </g>
    </svg>
  );
}

/** Redo (Figma 27:2383): the curl-forward arrow. */
export function RedoArrow({ size = 20, color, style, ...rest }: IconProps) {
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
      <g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" transform="translate(5.208 4.792)">
        <path d="M7.29167 0.625013L8.95833 2.5893L7.29167 4.55358" />
        <path d="M8.95833 2.58923H3.95833C2.11722 2.58923 0.625 4.20125 0.625 6.19042C0.625 8.17958 2.11722 9.79161 3.95833 9.79161H8.40278" />
      </g>
    </svg>
  );
}

/** Download (Figma 12:643, "download to line"): boxed arrow onto a line. */
export function DownloadTray({ size = 20, color, style, ...rest }: IconProps) {
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
      <g stroke="currentColor" strokeWidth="1.25" strokeLinecap="round">
        <rect x="3.125" y="3.125" width="13.75" height="13.75" rx="2.1" strokeLinecap="butt" />
        <path d="M10 6.2V11.1" />
        <path d="M12.5 9.35L10.6 11.25C10.27 11.58 9.73 11.58 9.4 11.25L7.5 9.35" />
        <path d="M6.875 13.75H13.125" />
      </g>
    </svg>
  );
}

/** Chat (Figma 309:215268, "chat-shine"): twin teardrops with a sparkle. */
export function ChatShine({ size = 20, color, style, ...rest }: IconProps) {
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
        d="M7.50001 13.7494H2.34375C2.21943 13.7494 2.1002 13.7 2.01229 13.6121C1.92439 13.5242 1.875 13.405 1.875 13.2806V8.12437C1.875 6.63254 2.46763 5.2018 3.52252 4.14691C4.57741 3.09202 6.00815 2.49939 7.49999 2.49939H7.5C8.99184 2.49939 10.4226 3.09202 11.4775 4.14691C12.5324 5.20181 13.125 6.63255 13.125 8.12439V8.1244C13.125 9.61624 12.5324 11.047 11.4775 12.1019C10.4226 13.1568 8.99185 13.7494 7.50001 13.7494V13.7494Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.19523 13.7496C7.58339 14.8463 8.30192 15.7958 9.25192 16.4673C10.2019 17.1388 11.3367 17.4994 12.5001 17.4994H17.6563C17.7806 17.4994 17.8999 17.45 17.9878 17.3621C18.0757 17.2742 18.1251 17.155 18.1251 17.0306V11.8744C18.1251 10.4357 17.5738 9.05176 16.5848 8.00705C15.5957 6.96234 14.2439 6.33629 12.8074 6.25763"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        transform="translate(4.529 5.359)"
        d="M2.38719 0.240454C2.53682 -0.0801512 2.99271 -0.0801512 3.14234 0.240454L3.76135 1.56682C3.80274 1.6555 3.87403 1.72679 3.96271 1.76818L5.28908 2.38719C5.60968 2.53682 5.60968 2.99271 5.28908 3.14234L3.96271 3.76135C3.87403 3.80274 3.80274 3.87403 3.76135 3.96271L3.14234 5.28908C2.99271 5.60968 2.53682 5.60968 2.38719 5.28908L1.76818 3.96271C1.72679 3.87403 1.6555 3.80274 1.56682 3.76135L0.240454 3.14234C-0.0801512 2.99271 -0.0801512 2.53682 0.240454 2.38719L1.56682 1.76818C1.6555 1.72679 1.72679 1.6555 1.76818 1.56682L2.38719 0.240454Z"
        fill="currentColor"
      />
    </svg>
  );
}
