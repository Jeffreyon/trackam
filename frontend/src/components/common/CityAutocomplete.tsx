import { useEffect, useRef, useState } from "react";
import { searchCities } from "@/lib/nigerianCities";

interface Props {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  className?: string;
}

export function CityAutocomplete({ value, onChange, placeholder, id, required, className }: Props) {
  const [open, setOpen]       = useState(false);
  const [results, setResults] = useState<{ city: string; state: string }[]>([]);
  const containerRef          = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    onChange(v);
    const hits = searchCities(v);
    setResults(hits);
    setOpen(hits.length > 0);
  }

  function select(city: string) {
    onChange(city);
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={() => {
          const hits = searchCities(value);
          setResults(hits);
          setOpen(hits.length > 0);
        }}
        className={className}
      />
      {open && results.length > 0 && (
        <div className="absolute z-[60] top-full left-0 right-0 mt-1 rounded-lg border border-white/[0.08] bg-[#0c1828] shadow-2xl overflow-hidden max-h-44 overflow-y-auto">
          {results.map(({ city, state }) => (
            <button
              key={`${city}-${state}`}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(city); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-white/[0.05] transition-colors"
            >
              <span className="font-medium text-stone-200">{city}</span>
              <span className="text-stone-600">{state}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
