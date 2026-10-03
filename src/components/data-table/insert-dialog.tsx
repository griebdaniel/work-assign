"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { inputType, isNumeric } from "./cells";
import { MultiOptionPicker, OptionPicker } from "./option-picker";
import type { Cell, Column, HandlerResult, Row } from "./types";
import { createEmptyRow, parseInput } from "./utils";

type FieldColumn = Exclude<Column, { type: "table" }>;
type Picked = Record<string, string | string[] | undefined>;

const isPicker = (column: Column) =>
  column.type === "option" || column.type === "multiOption";

/**
 * "Add row" button and the form behind it. The dialog stays open until
 * `onInsert` succeeds, so a rejected row keeps what the user typed.
 */
export function InsertRowDialog({
  columns,
  onInsert,
}: {
  columns: Column[];
  onInsert: (row: Row) => HandlerResult | Promise<HandlerResult>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  // Pickers aren't form inputs, so their values are kept here.
  const [picked, setPicked] = useState<Picked>({});

  // Nested tables are edited from their own dialog once the row exists;
  // computed columns have nothing to fill in.
  const fields = columns.filter(
    (column): column is FieldColumn =>
      column.type !== "table" && !column.compute,
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const row = createEmptyRow(columns);
    for (const column of fields) {
      if (isPicker(column)) {
        const value = picked[column.accessor];
        if (column.required && (value === undefined || value.length === 0)) {
          setError(`Pick a ${column.label.toLowerCase()}.`);
          return;
        }
        row[column.accessor] = value as Cell | undefined;
      } else {
        const text = String(form.get(column.accessor) ?? "").trim();
        row[column.accessor] = parseInput(column, text);
      }
    }

    setPending(true);
    setError(undefined);
    try {
      const result = await onInsert(row);
      if (result?.error) setError(result.error);
      else setOpen(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Start fresh next time; the form itself unmounts with the dialog.
        if (!next) {
          setError(undefined);
          setPicked({});
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus aria-hidden />
        Add row
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add row</DialogTitle>
            <DialogDescription>Fields marked * are required.</DialogDescription>
          </DialogHeader>

          {fields.map((column, index) => (
            <Field
              key={column.accessor}
              column={column}
              autoFocus={index === 0}
              picked={picked[column.accessor]}
              onPick={(value) =>
                setPicked((current) => ({
                  ...current,
                  [column.accessor]: value,
                }))
              }
            />
          ))}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  column,
  autoFocus,
  picked,
  onPick,
}: {
  column: FieldColumn;
  autoFocus?: boolean;
  picked: string | string[] | undefined;
  onPick: (value: string | string[] | undefined) => void;
}) {
  const id = `insert-${column.accessor}`;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {column.label}
        {column.required && <span className="text-destructive"> *</span>}
      </label>
      {column.type === "option" ? (
        <OptionPicker
          id={id}
          options={column.options}
          value={typeof picked === "string" ? picked : undefined}
          onChange={onPick}
          label={column.label}
          className="w-full"
          autoFocus={autoFocus}
        />
      ) : column.type === "multiOption" ? (
        <MultiOptionPicker
          id={id}
          options={column.options}
          value={Array.isArray(picked) ? picked : []}
          onChange={onPick}
          label={column.label}
        />
      ) : (
        <Input
          id={id}
          name={column.accessor}
          type={inputType(column)}
          step={inputType(column) === "number" ? "any" : undefined}
          placeholder={column.type === "duration" ? "e.g. 1h 30m" : undefined}
          required={column.required}
          autoFocus={autoFocus}
          className={cn(isNumeric(column) && "text-right")}
        />
      )}
    </div>
  );
}
