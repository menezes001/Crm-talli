interface TalliWordmarkProps {
  variant?: 'light' | 'dark';
  className?: string;
}

/**
 * Official Talli geometric wordmark (Brand Manual V4, p. 03):
 * - t: diagonal cut top and curved foot
 * - a: circular counter and straight right stem
 * - ll: two tall straight stems tightly spaced
 * - i: short stem (half height of l) with diagonal top cut, no dot
 */
export function TalliWordmark({
  variant = 'light',
  className = 'h-6 w-auto',
}: TalliWordmarkProps) {
  const fill = variant === 'light' ? '#F4F1EA' : '#12241D';

  return (
    <svg
      viewBox="0 0 218 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="talli"
    >
      {/* t: diagonal cut top, crossbar, curved bottom foot */}
      <path
        d="M14 23L31 12V28H45V41H31V51.5C31 57.5 34.5 60.5 40.5 60.5H45V74H37.5C21.8 74 14 65.8 14 51.2V41H5V28H14V23Z"
        fill={fill}
      />
      {/* a: geometric circular bowl with vertical right stem */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M84.5 26C91.2 26 96.8 28.4 100.5 32.2V27.5H117V74H100.5V69.2C96.7 73.1 91.1 75.5 84.5 75.5C70.4 75.5 59.5 64.7 59.5 50.75C59.5 36.8 70.4 26 84.5 26ZM88.3 39.8C81.6 39.8 76.7 44.5 76.7 50.75C76.7 57 81.6 61.7 88.3 61.7C95 61.7 99.9 57 99.9 50.75C99.9 44.5 95 39.8 88.3 39.8Z"
        fill={fill}
      />
      {/* l (first) */}
      <rect x="128" y="2" width="16.5" height="72" fill={fill} />
      {/* l (second) */}
      <rect x="155" y="2" width="16.5" height="72" fill={fill} />
      {/* i: short stem (half height of l) with diagonal top cut, no dot */}
      <path d="M183 45L199.5 36V74H183V45Z" fill={fill} />
    </svg>
  );
}

interface TalliSymbolProps {
  variant?: 'light' | 'dark';
  dotColor?: '#FF5A1F' | '#FFD23F' | '#B69CFF';
  className?: string;
}

/**
 * Official Talli T· symbol (Brand Manual V4, p. 05):
 * Rounded-corner geometric T with neon circular dot.
 */
export function TalliSymbol({
  variant = 'light',
  dotColor = '#FF5A1F',
  className = 'h-7 w-7',
}: TalliSymbolProps) {
  const stemFill = variant === 'light' ? '#F4F1EA' : '#12241D';

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 10.5C8 9.11929 9.11929 8 10.5 8H28.5C29.8807 8 31 9.11929 31 10.5V39.5C31 40.8807 29.8807 42 28.5 42H24.5C23.1193 42 22 40.8807 22 39.5V16.5H10.5C9.11929 16.5 8 15.3807 8 14V10.5Z"
        fill={stemFill}
      />
      <circle cx="38.5" cy="12.5" r="4.5" fill={dotColor} />
    </svg>
  );
}
