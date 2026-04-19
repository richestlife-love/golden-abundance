import type { ReactNode } from 'react';

type Props = { children: ReactNode; required?: boolean; };

export default function FieldLabel({ children, required }: Props) {
  const fg = "#241c00";
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: fg, marginBottom: 8 }}>
      {children}{" "}
      {required && <span style={{ color: "#E57B7B", fontWeight: 700 }}>*</span>}
    </div>
  );
}
