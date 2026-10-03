import { workbench } from '../theme';

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill={workbench.leaf} />
      <path d="M16 24c0-8 4.2-12.2 10.2-14.2C25 18 21 22.2 16 24Z" fill={workbench.mist} />
      <path d="M16 24c0-8-4.2-12.2-10.2-14.2C7 18 11 22.2 16 24Z" fill={workbench.gold} />
      <path d="M16 24.2V9.5" stroke={workbench.greenhouseDeep} strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
