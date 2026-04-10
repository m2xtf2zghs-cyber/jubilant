import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: { value: number; label?: string };
  className?: string;
  onClick?: () => void;
}

export function StatCard({ title, value, subtitle, icon: Icon, iconColor, trend, className, onClick }: StatCardProps) {
  return (
    <Card
      className={cn('relative overflow-hidden', onClick && 'cursor-pointer hover:shadow-md transition-shadow', className)}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{title}</p>
            <p className="text-2xl font-bold mt-1 leading-none">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
            {trend && (
              <p className={cn('text-xs mt-1 font-medium', trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ''}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconColor || 'bg-primary/10')}>
              <Icon className={cn('h-5 w-5', iconColor ? 'text-white' : 'text-primary')} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
