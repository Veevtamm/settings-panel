"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { evalNumberExpression } from "../lib/eval-number-expression";
import { cn } from "../lib/utils";
import { SfSymbol, type SfSymbolName } from "../sf-symbol";
import {
  ENUM_DROPDOWN_W,
  FIELD,
  MUTED,
  fieldChrome,
  fieldValueMono,
  fieldValueSans,
  pickActive,
  pickEase,
  pickIdle,
  pickerChrome,
} from "./chrome";
import type { EnumMark, EnumOption, ResetDotProps } from "./types";
import { RowLabel, SettingRow } from "./row";
import { PanelSelectList } from "./select";

export function NumberInput({
  ariaLabel,
  className,
  max,
  min,
  onCommit,
  step = 1,
  value,
}: {
  ariaLabel: string;
  className?: string;
  max?: number;
  min: number;
  onCommit: (value: number) => void;
  step?: number;
  value: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const result = evalNumberExpression(raw, value);
    if (result !== null) onCommit(result);
    setDraft(null);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      spellCheck={false}
      autoComplete="off"
      aria-label={ariaLabel}
      value={draft ?? String(value)}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        // Plain numbers keep the live-update behavior of the old number input.
        if (/^-?\d*(?:[.,]\d+)?$/.test(text.trim()) && text.trim() !== "" && text.trim() !== "-") {
          const parsed = Number(text.trim().replace(",", "."));
          if (Number.isFinite(parsed)) onCommit(parsed);
        }
      }}
      onBlur={(event) => {
        if (draft !== null) commit(event.target.value);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          commit(event.currentTarget.value);
        } else if (event.key === "Escape") {
          setDraft(null);
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          const times = event.shiftKey ? 10 : 1;
          const delta = (event.key === "ArrowUp" ? step : -step) * times;
          const next = Number((value + delta).toFixed(6));
          onCommit(
            Math.max(min, max === undefined ? next : Math.min(max, next)),
          );
          setDraft(null);
        }
      }}
      className={cn(
        "min-w-0 flex-1 bg-transparent text-left outline-none",
        fieldValueMono,
        className,
      )}
    />
  );
}

/** 28 Field chrome: transport, eyedropper, Player/Scrub toggles (`expanded` = xmark on hover). */
export function FieldButton({
  label,
  active = false,
  expanded,
  onClick,
  children,
  className,
  style,
}: {
  label: string;
  active?: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active || undefined}
      aria-expanded={expanded}
      title={label}
      onClick={onClick}
      className={cn(
        "group/field-btn flex size-[28px] shrink-0 items-center justify-center rounded outline-none",
        fieldChrome,
        (active || expanded) && "border-[color:var(--sp-line-strong)]",
        className,
      )}
      style={{
        background: active ? "var(--sp-fill)" : FIELD,
        color: active ? "var(--sp-fg)" : MUTED,
        ...style,
      }}
    >
      {expanded == null ? (
        children
      ) : (
        <span className="relative size-5">
          <span
            className={cn(
              "flex size-5 items-center justify-center transition-opacity duration-150",
              expanded && "fine-hover:group-hover/field-btn:opacity-0",
            )}
          >
            {children}
          </span>
          {expanded ? (
            <SfSymbol
              name="xmark"
              className="absolute inset-0 size-5 opacity-0 transition-opacity duration-150 fine-hover:group-hover/field-btn:opacity-100"
            />
          ) : null}
        </span>
      )}
    </button>
  );
}

/** 86 Field + unit + hover stepper — number, pair, range, player total. */
export function NumberField({
  ariaLabel,
  max,
  min,
  onCommit,
  step = 1,
  unit,
  value,
}: {
  ariaLabel: string;
  max?: number;
  min: number;
  onCommit: (value: number) => void;
  step?: number;
  unit?: string;
  value: number;
}) {
  return (
    <label
      className={cn(
        "group/field relative flex h-[28px] w-[86px] shrink-0 items-center justify-between gap-1 rounded px-1.5 text-[14px] leading-[18px]",
        fieldChrome,
      )}
      style={{ background: FIELD, color: MUTED }}
    >
      <NumberInput
        ariaLabel={ariaLabel}
        max={max}
        min={min}
        onCommit={onCommit}
        step={step}
        value={value}
      />
      {unit ? (
        <span className="pointer-events-none shrink-0 font-sans opacity-50" aria-hidden>
          {unit}
        </span>
      ) : null}
      <StepperZones
        label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        onCommit={onCommit}
      />
    </label>
  );
}

/**
 * Field hover stepper («зоны»): on fine pointers the right 21px of a number
 * field splits into ▴/▾ zones and covers the unit (same as opacity %).
 */
export function StepperZones({
  label,
  min,
  max,
  step = 1,
  value,
  onCommit,
}: {
  label: string;
  min: number;
  max?: number;
  step?: number;
  value: number;
  onCommit: (value: number) => void;
}) {
  const stepBy = (dir: 1 | -1, times: number) => {
    const next = Number((value + dir * step * times).toFixed(6));
    onCommit(Math.max(min, max === undefined ? next : Math.min(max, next)));
  };
  const zone = (dir: 1 | -1) => (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`${dir === 1 ? "Increase" : "Decrease"} ${label}`}
      // Keep focus in the input (or wherever it is) while stepping.
      onMouseDown={(event) => event.preventDefault()}
      onClick={(event) => stepBy(dir, event.shiftKey ? 10 : 1)}
      className="flex min-h-0 flex-1 items-center justify-center text-[color:var(--sp-muted)] transition-colors duration-150 fine-hover:hover:text-[color:var(--sp-fg)]"
    >
      <svg
        width="7"
        height="5"
        viewBox="0 0 7 5"
        aria-hidden
        className={dir === -1 ? "rotate-180" : undefined}
      >
        <path d="M3.5 0 7 5H0Z" fill="currentColor" />
      </svg>
    </button>
  );
  return (
    <span
      className={cn(
        "absolute inset-y-px right-px z-10 hidden w-[21px] flex-col overflow-hidden rounded-r-[3px] border-l border-[color:var(--sp-fill-strong)] fine-hover:group-hover/field:flex",
      )}
      style={{ background: FIELD }}
    >
      {zone(1)}
      <span aria-hidden className="h-px w-full shrink-0 bg-[color:var(--sp-fill-strong)]" />
      {zone(-1)}
    </span>
  );
}

export function SettingToggle({
  label,
  onChange,
  onLabel = "Вкл",
  offLabel = "Выкл",
  offIcon,
  onIcon,
  value,
  control,
  controlWidth,
  wide,
  reduceMotion = false,
  modified,
  onResetValue,
  info,
  icon,
}: {
  label: string;
  onChange: (value: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  offIcon?: SfSymbolName;
  onIcon?: SfSymbolName;
  value: boolean;
  control?: "dropdown" | "segment" | "action";
  /** Segment track width. Overrides `wide` (120) and the 86 default. */
  controlWidth?: number;
  /** Segment 120 instead of 86 — leftover for long text labels. */
  wide?: boolean;
  reduceMotion?: boolean;
} & ResetDotProps) {
  const current = value ? onLabel : offLabel;
  const namedModes = control === "segment" || control === "dropdown";

  if (namedModes && control === "segment") {
    const segments = [
      { on: false, text: offLabel, glyph: offIcon },
      { on: true, text: onLabel, glyph: onIcon },
    ];
    const trackW = controlWidth ?? (wide ? 120 : 86);
    const leftW = Math.floor((trackW - 1) / 2);
    const rightW = trackW - 1 - leftW;
    return (
      <SettingRow
        label={label}
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
      >
        <div
          role="radiogroup"
          aria-label={label}
          className={cn("grid h-[28px] shrink-0", pickerChrome)}
          style={{
            width: trackW,
            gridTemplateColumns: `${leftW}px 1px ${rightW}px`,
          }}
        >
          {segments.flatMap((segment, index) => {
            const active = segment.on === value;
            const cell = (
              <button
                key={segment.text}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={`${label}: ${segment.text}`}
                onClick={() => onChange(segment.on)}
                className={cn(
                  "flex h-[28px] items-center justify-center outline-none",
                  fieldValueSans,
                  pickEase,
                  active ? pickActive : pickIdle,
                )}
              >
                {segment.glyph ? (
                  <SfSymbol name={segment.glyph} className="size-5" />
                ) : (
                  segment.text
                )}
              </button>
            );
            if (index === segments.length - 1) return [cell];
            return [
              cell,
              <div
                key={`rule-${segment.text}`}
                aria-hidden
                className="bg-[color:var(--sp-fill-strong)]"
              />,
            ];
          })}
        </div>
      </SettingRow>
    );
  }

  if (namedModes && control === "dropdown") {
    return (
      <div
        className="group flex items-start justify-between gap-4"
        data-setting-row=""
      >
        <RowLabel
          label={label}
          className="h-[28px]"
          modified={modified}
          onResetValue={onResetValue}
          info={info}
          icon={icon}
        />
        <PanelSelectList
          ariaLabel={label}
          className="shrink-0"
          onChange={(id) => onChange(id === "on")}
          options={[
            { id: "off", label: offLabel },
            { id: "on", label: onLabel },
          ]}
          reduceMotion={reduceMotion}
          value={value ? "on" : "off"}
          width={ENUM_DROPDOWN_W}
        />
      </div>
    );
  }

  if (control === "action") {
    return (
      <SettingRow
        label={label}
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
      >
        <button
          type="button"
          aria-label={`${label}: ${current}`}
          aria-pressed={value}
          onClick={() => onChange(!value)}
          className={cn(
            "flex h-[28px] w-[86px] shrink-0 items-center justify-center rounded px-1.5",
            fieldValueSans,
            "outline-none",
            fieldChrome,
            "fine-hover:hover:bg-[color:var(--sp-fill-hover)]",
          )}
          style={{ background: FIELD, color: MUTED }}
        >
          {current}
        </button>
      </SettingRow>
    );
  }

  return (
    <SettingRow
      label={label}
      modified={modified}
      onResetValue={onResetValue}
      info={info}
      icon={icon}
    >
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={`${label}: ${current}`}
        onClick={() => onChange(!value)}
        className={cn(
          "relative box-border h-[28px] w-[52px] shrink-0 rounded border outline-none",
          "transition-[background-color,border-color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "motion-reduce:transition-none",
          "fine-hover:hover:border-[color:var(--sp-line-strong)]",
          "active:scale-[0.97]",
          "focus-visible:border-[color:var(--sp-line-focus)]",
          value
            ? "border-[color:var(--sp-line-strong)] bg-[color:var(--sp-fill-strong)]"
            : "border-[color:var(--sp-line-mid)] bg-[color:var(--sp-field)]",
        )}
      >
          <span
            aria-hidden
            className={cn(
              "absolute top-[2px] left-[2px] size-[22px] rounded-[2px]",
              "transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]",
              "motion-reduce:transition-none",
              value
                ? "translate-x-[24px] bg-[color:var(--sp-knob)]"
                : "translate-x-0 bg-[color:var(--sp-knob-off)]",
            )}
          />
      </button>
    </SettingRow>
  );
}

export function SettingText({
  label,
  onChange,
  value,
  modified,
  onResetValue,
  info,
  icon,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
} & ResetDotProps) {
  return (
    <div className="flex w-full flex-col gap-1" data-setting-row="">
      <RowLabel
        label={label}
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
      />
      <textarea
        spellCheck={false}
        autoComplete="off"
        aria-label={label}
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "min-h-[56px] w-full resize-y rounded px-1.5 py-1.5 text-left",
          fieldValueSans,
          fieldChrome,
        )}
        style={{
          background: FIELD,
          color: MUTED,
        }}
      />
    </div>
  );
}

function EnumMarkGlyph({ mark }: { mark: EnumMark }) {
  const lit = mark === "from-start" ? 0 : mark === "from-center" ? 1 : 2;
  return (
    <svg
      aria-hidden
      className="pointer-events-none block size-3"
      viewBox="0 0 12 12"
    >
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={1.5 + i * 3.5}
          y={3}
          width={2}
          height={6}
          rx={0.5}
          fill="currentColor"
          opacity={i === lit ? 1 : 0.28}
        />
      ))}
    </svg>
  );
}

function SettingEnumSegment({
  label,
  onChange,
  options,
  value,
  modified,
  onResetValue,
  info,
  icon,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly EnumOption[];
  value: string;
} & ResetDotProps) {
  const cols =
    options.length === 2
      ? "grid-cols-[42px_1px_43px]"
      : "grid-cols-[28px_1px_28px_1px_28px]";

  return (
    <SettingRow
      label={label}
      modified={modified}
      onResetValue={onResetValue}
      info={info}
      icon={icon}
    >
      <div
        role="radiogroup"
        aria-label={label}
        className={cn("grid h-[28px] w-[86px] shrink-0", cols, pickerChrome)}
      >
        {options.flatMap((option, index) => {
          const optionLabel =
            typeof option.label === "string" ? option.label : option.label.ru;
          const active = value === option.value;
          const cell = (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={optionLabel}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex size-[28px] items-center justify-center outline-none",
                options.length === 2 && "w-full",
                pickEase,
                active ? pickActive : pickIdle,
              )}
            >
              {option.mark ? (
                <EnumMarkGlyph mark={option.mark} />
              ) : (
                <span className="text-[9px] leading-none">
                  {optionLabel.slice(0, 1)}
                </span>
              )}
            </button>
          );
          if (index === options.length - 1) return [cell];
          return [
            cell,
            <div
              key={`rule-${option.value}`}
              aria-hidden
              className="bg-[color:var(--sp-fill-strong)]"
            />,
          ];
        })}
      </div>
    </SettingRow>
  );
}

export function SettingEnumDropdown({
  label,
  onChange,
  options,
  reduceMotion,
  value,
  control = "dropdown",
  controlWidth,
  modified,
  onResetValue,
  info,
  icon,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly EnumOption[];
  reduceMotion: boolean;
  value: string;
  control?: "dropdown" | "segment";
  controlWidth?: number;
} & ResetDotProps) {
  if (control === "segment" && options.length >= 2 && options.length <= 3) {
    return (
      <SettingEnumSegment
        label={label}
        onChange={onChange}
        options={options}
        value={value}
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
      />
    );
  }
  const selectOptions = options.map((option) => ({
    id: option.value,
    label: typeof option.label === "string" ? option.label : option.label.ru,
  }));
  if (selectOptions.length === 0) return null;

  return (
    <div
      className="group flex items-start justify-between gap-4"
      data-setting-row=""
    >
      <RowLabel
        label={label}
        className="h-[28px]"
        modified={modified}
        onResetValue={onResetValue}
        info={info}
        icon={icon}
      />
      <PanelSelectList
        ariaLabel={label}
        className="shrink-0"
        onChange={onChange}
        options={selectOptions}
        reduceMotion={reduceMotion}
        value={value}
        width={controlWidth ?? ENUM_DROPDOWN_W}
      />
    </div>
  );
}
