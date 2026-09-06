/**
 * Logo — the MXD BLR brand lockup and standalone bolt mark.
 *
 * Two artwork variants exist because the lockup is placed on both the warm-white
 * page background and the dark #1F1813 bands:
 *   - `dark`  (default) black wordmark + orange mark — for light backgrounds
 *   - `light`           white wordmark + orange mark — for dark backgrounds
 *
 * Source artwork is 1037 x 375 (aspect 2.765), so callers give a height and the
 * width is derived. Do not pass a width that breaks that ratio.
 */
import Image from 'next/image';

// TESTING: every instance points at MXD_PNG_BLR_2- (all-white knockout).
// Revert = restore the logo-full{,-light}.png sources and 1037 / 375.
const LOCKUP_RATIO = 484 / 176;
const MARK_RATIO = 1;

type Variant = 'dark' | 'light';

export function Logo({
  height = 34,
  variant = 'dark',
  preload = false,
}: {
  height?: number;
  variant?: Variant;
  /** Set on the navbar/above-the-fold instance only. */
  preload?: boolean;
}) {
  return (
    <Image
      src="/brand/logo-white-v2.png"
      alt="MXD BLR — wholesale mobile accessories"
      height={height}
      width={Math.round(height * LOCKUP_RATIO)}
      preload={preload}
      // flexShrink/alignSelf guard the lockup against being stretched or squashed
      // by a flex parent whose align-items resolves to `stretch`.
      style={{ height, width: 'auto', display: 'block', alignSelf: 'flex-start', flexShrink: 0 }}
    />
  );
}

/** The bolt mark alone — for square/tight slots where the wordmark will not fit. */
export function LogoMark({
  size = 32,
  variant = 'dark',
}: {
  size?: number;
  variant?: Variant;
}) {
  return (
    <Image
      src={variant === 'light' ? '/brand/mark-light.png' : '/brand/mark.png'}
      alt="MXD BLR"
      height={size}
      width={Math.round(size * MARK_RATIO)}
      style={{ height: size, width: size, display: 'block' }}
    />
  );
}
