import { ShieldCheck } from "lucide-react";
import { roles } from "../data";
import type { Role } from "../domain/types";

interface RoleSelectorProps {
  title: string;
  value: Role;
  onChange: (role: Role) => void;
  disabledRole?: Role;
}

export function RoleSelector({ title, value, onChange, disabledRole }: RoleSelectorProps) {
  return (
    <div className="field-block">
      <div className="section-title">
        <ShieldCheck aria-hidden="true" size={17} />
        <span>{title}</span>
      </div>
      <div className="role-segment">
        {roles.map((role) => {
          const disabled = disabledRole === role.id;

          return (
            <button
              className={value === role.id ? "active" : ""}
              disabled={disabled}
              key={role.id}
              onClick={() => onChange(role.id)}
              type="button"
            >
              <span>{role.shortLabel}</span>
              <small>{role.label}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
