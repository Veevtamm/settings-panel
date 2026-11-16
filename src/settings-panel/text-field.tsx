"use client";

/** Multiline copy inside a black section block. No title above: the empty field shows `placeholder`. A single line belongs on a row. */
export function TextField({
  label,
  value,
  onChange,
  rows = 1,
  placeholder,
  caption = true,
  plain = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** `1` is a single line. Above that the field grows and can be dragged taller. */
  rows?: number;
  placeholder?: string;
  /** The name above the field. Off: `placeholder` is the empty hint, `label` stays for the screen reader. */
  caption?: boolean;
  /** Sits in a black block with the other rows: no own fill or corners. */
  plain?: boolean;
}) {
  const field = plain
    ? "w-full bg-transparent px-1 text-[14px] leading-4 text-white outline-none placeholder:text-white/50"
    : "w-full rounded-lg bg-black px-2 text-[14px] leading-4 text-white outline-none placeholder:text-white/50";
  return (
    <label className="flex w-full flex-col gap-1 text-black">
      {caption ? <span className="text-[14px] leading-4">{label}</span> : null}
      {rows <= 1 ? (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={label}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className={`h-8 ${field}`}
        />
      ) : (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          aria-label={label}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          className={`min-h-[72px] resize-y py-2 ${field}`}
        />
      )}
    </label>
  );
}
