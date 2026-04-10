import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  backTo?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, back, backTo, actions, className }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div className="flex items-center gap-2 min-w-0">
        {(back || backTo) && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            className="-ml-1 shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 ml-2">{actions}</div>}
    </div>
  );
}
