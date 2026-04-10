import { cn } from '@/lib/utils';
import { DPD_BUCKET, DPD_COLOR, DPD_BG } from '@/types';

interface DPDBadgeProps {
  dpd: number;
  showLabel?: boolean;
  className?: string;
}

export function DPDBadge({ dpd, showLabel = true, className }: DPDBadgeProps) {
  const bucket = DPD_BUCKET(dpd);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        DPD_BG[bucket],
        DPD_COLOR[bucket],
        className
      )}
    >
      {dpd === 0 ? 'Current' : `${dpd}d`}
      {showLabel && dpd > 0 && (
        <span className="ml-1 opacity-70">
          ({bucket === 'mild' ? '1-30' : bucket === 'moderate' ? '31-60' : bucket === 'severe' ? '61-90' : '90+'})
        </span>
      )}
    </span>
  );
}
