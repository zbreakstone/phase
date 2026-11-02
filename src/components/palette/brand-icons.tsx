import type * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement>;

/** The CSS3 shield. */
export function CssLogo(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path d="M4 2.5 5.7 21.5 12 23.5l6.3-2L20 2.5H4z" fill="#1572B6" />
      <path d="M12 4.6v16.8l4.9-1.5 1.3-14.4L12 4.6z" fill="#33A9DC" />
      <path d="M8 8.6h8.1l-.2 2.1H10.2l.2 2.1h5.3l-.4 4.6-3.3 1-3.3-1-.2-2.5h2.2l.1 1.2 1.2.4 1.2-.4.2-1.8H8.2L8 8.6z" fill="#fff" />
    </svg>
  );
}

/** The Tailwind CSS wave mark. */
export function TailwindLogo(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        d="M12 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.9.2 1.6.9 2.3 1.6C13.7 10.6 15 12 18 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.9-.2-1.6-.9-2.3-1.6C16.3 6.2 15 4.8 12 4.8zM6 12c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.9.2 1.6.9 2.3 1.6 1.2 1.2 2.5 2.6 5.5 2.6 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.9-.2-1.6-.9-2.3-1.6C10.3 13.4 9 12 6 12z"
        fill="#38BDF8"
      />
    </svg>
  );
}

/** The Figma mark, in its five brand colors. */
export function FigmaLogo(props: IconProps) {
  return (
    <svg viewBox="0 0 38 57" aria-hidden {...props}>
      <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" fill="#1ABCFE" />
      <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" fill="#0ACF83" />
      <path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" fill="#FF7262" />
      <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" fill="#F24E1E" />
      <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" fill="#A259FF" />
    </svg>
  );
}
