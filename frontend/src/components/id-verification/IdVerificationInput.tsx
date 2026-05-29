import { type IdSchemeConfig } from "@/lib/idSchemes";

interface Props {
  config: IdSchemeConfig;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

export function IdVerificationInput({ config, value, onChange, required, className }: Props) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (config.inputMode === "numeric") {
      onChange(raw.replace(/\D/g, "").slice(0, config.maxLength));
    } else {
      onChange(raw.slice(0, config.maxLength));
    }
  }

  return (
    <div>
      <label className="text-xs font-medium text-white block mb-1.5">
        {config.label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        required={required}
        value={value}
        onChange={handleChange}
        placeholder={config.placeholder}
        inputMode={config.inputMode}
        pattern={config.pattern}
        maxLength={config.maxLength}
        className={
          className ??
          "w-full rounded-md border border-white/[0.08] bg-white/[0.06] px-3 h-10 text-sm text-white placeholder:text-stone-600 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
        }
      />
      <p className="text-[10px] text-stone-400 mt-1">{config.hint}</p>
    </div>
  );
}
