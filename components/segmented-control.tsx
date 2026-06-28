"use client";

interface SegmentedOption {
  value: string;
  label: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="etax-segmented">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="etax-segmented-item"
          data-active={opt.value === value ? "true" : "false"}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
