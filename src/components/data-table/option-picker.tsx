"use client";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";

import type { Option } from "./types";

// Autocomplete pickers for reference columns: cells store ids, the user types
// and picks by label. Used inline in cells and in the insert dialog.

const sameOption = (a: Option, b: Option) => a.value === b.value;

function OptionList({
  anchor,
}: {
  anchor?: ReturnType<typeof useComboboxAnchor>;
}) {
  return (
    <ComboboxContent anchor={anchor}>
      <ComboboxEmpty>No matches.</ComboboxEmpty>
      <ComboboxList>
        {(option: Option) => (
          <ComboboxItem key={option.value} value={option}>
            {option.label}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxContent>
  );
}

export function OptionPicker({
  options,
  value,
  onChange,
  label,
  id,
  className,
  autoFocus,
}: {
  options: Option[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  label: string;
  id?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <Combobox
      items={options}
      value={options.find((option) => option.value === value) ?? null}
      onValueChange={(next: Option | null) => onChange(next?.value)}
      isItemEqualToValue={sameOption}
    >
      <ComboboxInput
        id={id}
        aria-label={label}
        placeholder="Type to search…"
        className={className}
        autoFocus={autoFocus}
      />
      <OptionList />
    </Combobox>
  );
}

export function MultiOptionPicker({
  options,
  value,
  onChange,
  label,
  id,
  className,
}: {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  label: string;
  id?: string;
  className?: string;
}) {
  const anchor = useComboboxAnchor();
  const selected = options.filter((option) => value.includes(option.value));

  return (
    <Combobox
      multiple
      items={options}
      value={selected}
      onValueChange={(next: Option[]) => onChange(next.map((o) => o.value))}
      isItemEqualToValue={sameOption}
    >
      <ComboboxChips ref={anchor} className={className}>
        <ComboboxValue>
          {(chosen: Option[]) =>
            chosen.map((option) => (
              <ComboboxChip key={option.value}>{option.label}</ComboboxChip>
            ))
          }
        </ComboboxValue>
        <ComboboxChipsInput
          id={id}
          aria-label={label}
          placeholder={selected.length > 0 ? "" : "Type to search…"}
        />
      </ComboboxChips>
      <OptionList anchor={anchor} />
    </Combobox>
  );
}
