const MARK_SRC = '/brand/serenity-mark.png';

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <img
      src={MARK_SRC}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
    />
  );
}
