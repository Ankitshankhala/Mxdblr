'use client';

/**
 * QtyStepper — +/- numeric quantity input used in the cart and product actions.
 * Enforces a minimum (typically the product MOQ) and emits change events.
 */
import { Minus, Plus } from 'lucide-react';

interface QtyStepperProps {
  value: number;
  moq: number;
  onChange: (val: number) => void;
}

export default function QtyStepper({ value, moq, onChange }: QtyStepperProps) {
  const belowMoq = value < moq;

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-0"
        style={{
          border: `1px solid ${belowMoq ? '#DC2626' : '#E8E4DE'}`,
          borderRadius: 10,
          overflow: 'hidden',
          display: 'inline-flex',
        }}
      >
        <button
          type="button"
          onClick={() => onChange(Math.max(moq, value - 1))}
          disabled={value <= moq}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F8F6F2',
            border: 'none',
            cursor: value <= moq ? 'not-allowed' : 'pointer',
            color: value <= moq ? '#A8A39A' : '#1A1A2E',
          }}
          aria-label="Decrease quantity"
        >
          <Minus size={14} />
        </button>
        <div
          style={{
            width: 52,
            textAlign: 'center',
            fontWeight: 700,
            fontSize: 15,
            padding: '0 4px',
            background: '#fff',
          }}
        >
          {value}
        </div>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F8F6F2',
            border: 'none',
            cursor: 'pointer',
            color: '#1A1A2E',
          }}
          aria-label="Increase quantity"
        >
          <Plus size={14} />
        </button>
      </div>
      {belowMoq && (
        <span style={{ color: '#DC2626', fontSize: 11 }}>
          Min. order: {moq} pcs
        </span>
      )}
    </div>
  );
}
