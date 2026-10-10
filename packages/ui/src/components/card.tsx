import * as React from 'react';
import { cn } from '../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-2xl border border-neutral-200/80 bg-white text-neutral-900 shadow-[0_2px_16px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)]',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

export { Card };
