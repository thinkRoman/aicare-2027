"use client";

import { useMemo } from "react";
import type { AgeGroup, Opqrst } from "@/lib/schemas/encounter";
import { MIN_TOUCH_TARGET_PX } from "@/lib/consumer/triageUi";

export type SmartTapValues = {
  ageGroup: AgeGroup;
  approximateAgeYears?: number;
  ageDays?: number;
  feverIndicated: boolean;
  isPregnant: boolean;
  immunocompromised: boolean;
  anamnesis: Opqrst;
};

type SmartTapSelectorsProps = {
  value: SmartTapValues;
  onChange: (next: SmartTapValues) => void;
};

const AGE_OPTIONS: Array<{ value: AgeGroup; label: string }> = [
  { value: "neonate", label: "Newborn" },
  { value: "infant", label: "Infant" },
  { value: "pediatric", label: "Child" },
  { value: "adult", label: "Adult" },
  { value: "geriatric", label: "65+" },
];

const ONSET_OPTIONS = ["Sudden", "Gradual", "Over days", "Unsure"] as const;
const QUALITY_OPTIONS = ["Sharp", "Dull", "Burning", "Pressure", "Other"] as const;
const TIMING_OPTIONS = ["Constant", "Comes and goes", "Worse at night"] as const;

const tapButtonClass =
  "inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700";

export function SmartTapSelectors({ value, onChange }: SmartTapSelectorsProps) {
  const severityLabel = useMemo(
    () => value.anamnesis.severity ?? 5,
    [value.anamnesis.severity],
  );

  return (
    <section aria-label="Patient context and symptom details" className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Who is this for?</h2>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Age group">
          {AGE_OPTIONS.map((option) => {
            const selected = value.ageGroup === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                className={`${tapButtonClass} ${
                  selected
                    ? "border-teal-800 bg-teal-700 text-white"
                    : "border-slate-300 bg-white text-slate-800"
                }`}
                style={{ minHeight: MIN_TOUCH_TARGET_PX, minWidth: MIN_TOUCH_TARGET_PX }}
                onClick={() => onChange({ ...value, ageGroup: option.value })}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleChip
          label="Fever"
          pressed={value.feverIndicated}
          onPressedChange={(feverIndicated) =>
            onChange({ ...value, feverIndicated })
          }
        />
        <ToggleChip
          label="Pregnancy"
          pressed={value.isPregnant}
          onPressedChange={(isPregnant) => onChange({ ...value, isPregnant })}
        />
        <ToggleChip
          label="Weakened immune system"
          pressed={value.immunocompromised}
          onPressedChange={(immunocompromised) =>
            onChange({ ...value, immunocompromised })
          }
        />
      </div>

      <div>
        <h2 className="text-base font-semibold text-slate-900">Symptom details</h2>
        <p className="mt-1 text-sm text-slate-600">
          Tap what fits. You can skip anything that does not apply.
        </p>

        <OptionRow
          legend="When did it start?"
          options={ONSET_OPTIONS}
          selected={value.anamnesis.onset}
          onSelect={(onset) =>
            onChange({
              ...value,
              anamnesis: { ...value.anamnesis, onset },
            })
          }
        />
        <OptionRow
          legend="What does it feel like?"
          options={QUALITY_OPTIONS}
          selected={value.anamnesis.quality}
          onSelect={(quality) =>
            onChange({
              ...value,
              anamnesis: { ...value.anamnesis, quality },
            })
          }
        />
        <OptionRow
          legend="Timing"
          options={TIMING_OPTIONS}
          selected={value.anamnesis.timing}
          onSelect={(timing) =>
            onChange({
              ...value,
              anamnesis: { ...value.anamnesis, timing },
            })
          }
        />

        <div className="mt-4">
          <label htmlFor="severity" className="text-sm font-medium text-slate-800">
            Severity: {severityLabel} / 10
          </label>
          <input
            id="severity"
            type="range"
            min={1}
            max={10}
            value={severityLabel}
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={severityLabel}
            className="mt-2 h-12 w-full accent-teal-700"
            onChange={(event) =>
              onChange({
                ...value,
                anamnesis: {
                  ...value.anamnesis,
                  severity: Number(event.target.value),
                },
              })
            }
          />
        </div>
      </div>
    </section>
  );
}

function ToggleChip({
  label,
  pressed,
  onPressedChange,
}: {
  label: string;
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`${tapButtonClass} w-full justify-start ${
        pressed
          ? "border-teal-800 bg-teal-700 text-white"
          : "border-slate-300 bg-white text-slate-800"
      }`}
      style={{ minHeight: MIN_TOUCH_TARGET_PX }}
      onClick={() => onPressedChange(!pressed)}
    >
      {label}
    </button>
  );
}

function OptionRow({
  legend,
  options,
  selected,
  onSelect,
}: {
  legend: string;
  options: readonly string[];
  selected?: string;
  onSelect: (value: string) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-medium text-slate-800">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              className={`${tapButtonClass} ${
                isSelected
                  ? "border-teal-800 bg-teal-700 text-white"
                  : "border-slate-300 bg-white text-slate-800"
              }`}
              style={{ minHeight: MIN_TOUCH_TARGET_PX }}
              onClick={() => onSelect(option)}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
