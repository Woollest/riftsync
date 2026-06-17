import type { ReactNode } from "react";

interface DataFactProps {
  icon?: ReactNode;
  label: string;
  tone?: "good" | "warn";
  value: string;
  wide?: boolean;
}

export function DataFact({ icon, label, tone, value, wide = false }: DataFactProps) {
  return (
    <div className={`data-fact ${tone ? `is-${tone}` : ""} ${wide ? "is-wide" : ""}`}>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  );
}
