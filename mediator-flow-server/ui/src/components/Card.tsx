import { ReactNode } from 'react';

interface CardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
  children?: ReactNode;
}

export default function Card({ title, value, subtitle, className = '', children }: CardProps) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-lg p-5 ${className}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      {children}
    </div>
  );
}
