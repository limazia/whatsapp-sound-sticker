import { useId } from "react";

import { Input } from "@components/ui/input";

interface BrazilPhoneFieldProps {
  label: string;
  value: string;
  onChange: (nationalNumber: string) => void;
  disabled: boolean;
}

export function BrazilPhoneField({ label, value, onChange, disabled }: BrazilPhoneFieldProps) {
  const hint = useId();
  const area = value.slice(0, 2);
  const subscriber = value.slice(2);
  const split = subscriber.length > 8 ? 5 : 4;
  const formatted = [area, [subscriber.slice(0, split), subscriber.slice(split)].filter(Boolean).join("-")].filter(Boolean).join(" ");

  return <>
    <label className="stack">
      <span>{label}</span>
      <span className="flex items-center overflow-hidden rounded-lg border border-input focus-within:border-ring has-disabled:cursor-not-allowed has-disabled:bg-secondary has-disabled:opacity-60">
        <span className="flex shrink-0 items-center gap-2 border-r border-input px-3" aria-hidden="true">🇧🇷 +55</span>
        <Input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="DD XXXXX-XXXX"
          aria-describedby={hint} className="rounded-none border-0 bg-transparent disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:disabled:bg-transparent"
          disabled={disabled} required value={formatted} onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            onChange(digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits);
          }} />
      </span>
    </label>
    <p className="hint" id={hint}>Brasil (+55). Informe o DDD e o número.</p>
  </>;
}
