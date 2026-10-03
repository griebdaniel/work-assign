"use client";

import type { SortDirection } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { MultiOptionPicker, OptionPicker } from "./option-picker";
import type { Cell, Column, Row } from "./types";
import { formatCell, parseInput, toInputText } from "./utils";

type EditableColumn = Exclude<Column, { type: "table" }>;

const ghostField =
  "h-8 w-full border-transparent bg-transparent shadow-none hover:border-input dark:bg-transparent";

export const isNumeric = (column: Column) =>
  column.type === "number" ||
  column.type === "duration" ||
  column.type === "percent";

/**
 * Inline editor for a scalar cell. Text-like inputs commit on blur or Enter
 * (Escape reverts); option cells commit as soon as a value is picked.
 */
export function EditableCell({
  column,
  value,
  onCommit,
}: {
  column: EditableColumn;
  value: Cell | Row[] | undefined;
  onCommit: (value: Cell | undefined) => void;
}) {
  if (column.compute) {
    return (
      <span
        className={cn(
          "block px-2.5 text-sm text-muted-foreground",
          isNumeric(column) && "text-right tabular-nums",
        )}
      >
        {formatCell(column, value) || "—"}
      </span>
    );
  }

  if (column.type === "option") {
    return (
      <OptionPicker
        options={column.options}
        value={typeof value === "string" ? value : undefined}
        onChange={(next) => {
          if (next !== value) onCommit(next);
        }}
        label={column.label}
        className={cn(ghostField, "min-w-40")}
      />
    );
  }

  if (column.type === "multiOption") {
    return (
      <MultiOptionPicker
        options={column.options}
        value={Array.isArray(value) ? (value as string[]) : []}
        onChange={onCommit}
        label={column.label}
        className={cn(ghostField, "h-auto min-h-8 min-w-48")}
      />
    );
  }

  const text = toInputText(column, value);

  return (
    <Input
      // Remount when the stored value changes so the uncontrolled draft resyncs.
      key={text}
      type={inputType(column)}
      step={inputType(column) === "number" ? "any" : undefined}
      defaultValue={text}
      aria-label={column.label}
      placeholder={column.type === "duration" ? "e.g. 1h 30m" : undefined}
      className={cn(ghostField, isNumeric(column) && "text-right")}
      onBlur={(event) => {
        const next = event.currentTarget.value;
        if (next !== text) onCommit(parseInput(column, next));
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.currentTarget.value = text;
        if (event.key === "Enter" || event.key === "Escape") {
          event.currentTarget.blur();
        }
      }}
    />
  );
}

/** The `<input type>` for a text-like column. */
export function inputType(column: Column) {
  switch (column.type) {
    case "number":
    case "percent":
      return "number";
    case "date":
    case "time":
      return column.type;
    default:
      return "text";
  }
}

export function SortHeader({
  label,
  sorted,
  align,
  onToggle,
}: {
  label: string;
  sorted: false | SortDirection;
  align?: "end";
  onToggle?: (event: unknown) => void;
}) {
  if (!onToggle) return <span className="px-1">{label}</span>;
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <div className={cn("flex", align === "end" && "justify-end")}>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 font-medium"
        title="Click to sort, Shift+click to sort by several columns"
        onClick={onToggle}
      >
        {label}
        <Icon className={cn("size-3.5", !sorted && "opacity-40")} aria-hidden />
      </Button>
    </div>
  );
}

export function Checkbox({
  indeterminate,
  ...props
}: React.ComponentProps<"input"> & { indeterminate?: boolean }) {
  return (
    <input
      type="checkbox"
      className="size-4 cursor-pointer accent-primary align-middle"
      ref={(element) => {
        if (element) element.indeterminate = Boolean(indeterminate);
      }}
      {...props}
    />
  );
}
