'use client';

import { IconMinus, IconPlus } from '@tabler/icons-react';

type FeeStepperProps = {
  id?: string;
  label: string;
  hint?: string;
  valueLabel: string;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementDisabled?: boolean;
  incrementDisabled?: boolean;
  disabled?: boolean;
};

export function FeeStepper({
  id,
  label,
  hint,
  valueLabel,
  onDecrement,
  onIncrement,
  decrementDisabled,
  incrementDisabled,
  disabled,
}: FeeStepperProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Kurangi ${label}`}
          disabled={disabled || decrementDisabled}
          onClick={onDecrement}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:border-[#002c5f] hover:text-[#002c5f] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-800 cursor-pointer"
        >
          <IconMinus size={16} />
        </button>
        <div
          id={id}
          className="flex-1 h-10 px-3 rounded-lg border border-gray-300 bg-white flex items-center justify-center text-sm font-semibold text-gray-900"
        >
          {valueLabel}
        </div>
        <button
          type="button"
          aria-label={`Tambah ${label}`}
          disabled={disabled || incrementDisabled}
          onClick={onIncrement}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-800 hover:border-[#002c5f] hover:text-[#002c5f] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-gray-800 cursor-pointer"
        >
          <IconPlus size={16} />
        </button>
      </div>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
