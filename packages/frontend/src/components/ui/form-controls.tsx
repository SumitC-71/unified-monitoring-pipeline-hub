//-----------------------------------------------------------------------
// Token-styled form primitives shared by the app's forms.
//-----------------------------------------------------------------------

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

interface FieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-200-nudge', className)}>
      <div className="flex items-baseline justify-between gap-200">
        <label
          htmlFor={id}
          className="text-300 leading-300 font-medium text-foreground"
        >
          {label}
        </label>
        {optional ? (
          <span className="text-200 leading-200 text-muted-foreground">
            Optional
          </span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="flex items-center gap-100 text-200 leading-200 text-destructive"
        >
          <CircleAlert aria-hidden className="icon-size-100 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p
          id={`${id}-hint`}
          className="text-200 leading-200 text-muted-foreground"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  mono?: boolean;
}

export function TextInput({
  invalid,
  mono,
  className,
  id,
  ...props
}: TextInputProps) {
  return (
    <input
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? `${id}-${invalid ? 'error' : 'hint'}` : undefined}
      className={cn(
        'h-10 w-full rounded-lg border border-input bg-card px-300 text-[length:var(--text-300)] text-foreground shadow-xs transition-[color,box-shadow,border-color]',
        'placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground',
        'hover:border-muted-foreground/50',
        'focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/20',
        'dark:bg-input/20',
        mono && 'font-monospace tracking-tight',
        className
      )}
      {...props}
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline';
}

export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-200 rounded-lg px-400 text-[length:var(--text-300)] font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' &&
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90',
        variant === 'outline' &&
          'border border-input bg-card text-foreground hover:bg-secondary',
        variant === 'ghost' &&
          'text-muted-foreground hover:bg-secondary hover:text-foreground',
        className
      )}
      {...props}
    />
  );
}
