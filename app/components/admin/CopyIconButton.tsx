'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconCheck } from '@tabler/icons-react';

type CopyIconButtonProps = {
  value: string;
  idleTitle: string;
  copiedTitle?: string;
  className: string;
  copiedClassName?: string;
  wrapperClassName?: string;
  icon?: ReactNode;
  children?: ReactNode;
};

export function CopyIconButton({
  value,
  idleTitle,
  copiedTitle = 'Tersalin',
  className,
  copiedClassName,
  wrapperClassName,
  icon,
  children,
}: CopyIconButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const flash = (next: 'copied' | 'failed') => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setStatus(next);
    timerRef.current = window.setTimeout(() => setStatus('idle'), 2000);
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      flash('copied');
    } catch {
      flash('failed');
    }
  };

  const copied = status === 'copied';
  const failed = status === 'failed';
  const title = copied ? copiedTitle : failed ? 'Gagal menyalin' : idleTitle;

  return (
    <span className={wrapperClassName ?? 'inline-flex'}>
      <button
        type="button"
        onClick={() => void onCopy()}
        className={copied && copiedClassName ? copiedClassName : className}
        title={title}
        aria-label={title}
      >
        {copied ? <IconCheck size={14} /> : icon}
        {copied ? copiedTitle : failed ? 'Gagal' : children}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? copiedTitle : failed ? 'Gagal menyalin' : ''}
      </span>
    </span>
  );
}
