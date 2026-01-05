import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  icon?: LucideIcon;
  iconColor?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ children, icon: Icon, iconColor = 'text-gray-400', action, className = '' }: CardHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-gray-800 flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-3">
        {Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}
        <h3 className="text-lg font-semibold text-white">{children}</h3>
      </div>
      {action}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return (
    <div className={`p-6 ${className}`}>
      {children}
    </div>
  );
}
