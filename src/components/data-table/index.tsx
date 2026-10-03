"use client";

import {
  functionalUpdate,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Checkbox, EditableCell, isNumeric, SortHeader } from "./cells";
import { InsertRowDialog } from "./insert-dialog";
import { PaginationBar } from "./pagination-bar";
import {
  columnHelper,
  type DataTableMeta,
  features,
  searchFilterFn,
} from "./table-config";
import { TableToolbar } from "./toolbar";
import type { CellAddress, Column, DataTableProps, Row } from "./types";
import { cellValue, formatCell, orderRows, sortRowIds } from "./utils";

export type * from "./types";

const ROOT_PATH: CellAddress[] = [];

/**
 * Editable table. Cells edit inline; `table` columns open their rows in a
 * dialog that renders this same component one level deeper (`path`).
 */
export function DataTable({
  columns,
  data,
  path = ROOT_PATH,
  ...handlers
}: DataTableProps & { path?: CellAddress[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  // Row order captured when the sort changes. Edits don't re-sort, so a row
  // stays where it is while you work on it; click the header to re-sort.
  const [sortedIds, setSortedIds] = useState<string[]>([]);

  const table = useTable({
    features,
    // React Compiler memoizes these on their inputs, so no useMemo needed.
    columns: buildColumns(columns),
    data: orderRows(data, sortedIds),
    getRowId: (row) => row.id,
    meta: { ...handlers, path },
    globalFilterFn: searchFilterFn,
    manualSorting: true,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = functionalUpdate(updater, sorting);
      setSorting(next);
      setSortedIds(next.length > 0 ? sortRowIds(data, columns, next) : []);
    },
    // Edits produce new data; don't bounce back to page 1 on every keystroke.
    autoResetPageIndex: false,
  });

  // Deleting the last rows of the last page leaves us past the end: step back.
  const pageCount = table.getPageCount();
  const { pageIndex } = table.state.pagination;
  useEffect(() => {
    if (pageCount > 0 && pageIndex >= pageCount) table.lastPage();
  }, [pageCount, pageIndex, table]);

  async function deleteSelected() {
    const rowsId = table.getSelectedRowModel().rows.map((row) => row.id);
    await handlers.deleteRow({ cellAddress: path, rowsId });
    table.resetRowSelection();
  }

  const rows = table.getRowModel().rows;

  return (
    <div className="grid gap-3">
      {handlers.error && (
        <p role="alert" className="text-sm text-destructive">
          {handlers.error}
        </p>
      )}
      <TableToolbar
        table={table}
        insertDialog={
          <InsertRowDialog
            columns={columns}
            onInsert={(row) => handlers.insertRow({ cellAddress: path, row })}
          />
        }
        onDeleteSelected={deleteSelected}
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} className="px-1">
                    <table.FlexRender header={header} />
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="p-1">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getAllLeafColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {data.length === 0
                    ? "No rows yet. Use Add row to create the first one."
                    : "No rows match your search."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationBar table={table} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Column definitions                                                         */
/* -------------------------------------------------------------------------- */

// Header/cell renderers read table state inline and pass plain values down,
// so the compiler-memoized child components always see fresh props.
function buildColumns(columns: Column[]) {
  return columnHelper.columns([
    columnHelper.display({
      id: "select",
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
    }),

    ...columns.map((column) =>
      // The accessor gives search the text the user sees; cells read the row.
      columnHelper.accessor(
        (row) => formatCell(column, cellValue(column, row)),
        {
          id: column.accessor,
          header: (ctx) => (
            <SortHeader
              label={column.label}
              sorted={ctx.column.getIsSorted()}
              align={isNumeric(column) ? "end" : undefined}
              onToggle={
                ctx.column.getCanSort()
                  ? ctx.column.getToggleSortingHandler()
                  : undefined
              }
            />
          ),
          cell: (ctx) => {
            // Always set by DataTable; TanStack types meta as optional.
            const meta = ctx.table.options.meta as DataTableMeta;
            const address = { rowId: ctx.row.id, columnId: column.accessor };
            const value = cellValue(column, ctx.row.original);

            if (column.type === "table") {
              return (
                <NestedTable
                  column={column}
                  rows={Array.isArray(value) ? (value as Row[]) : []}
                  {...meta}
                  path={[...meta.path, address]}
                />
              );
            }
            return (
              <EditableCell
                column={column}
                value={value}
                onCommit={(next) =>
                  meta.updateRow({
                    cellAddress: [...meta.path, address],
                    value: next,
                  })
                }
              />
            );
          },
          sortDescFirst: false,
          enableSorting: column.type !== "table",
          enableGlobalFilter: column.type !== "table",
        },
      ),
    ),
  ]);
}

/* -------------------------------------------------------------------------- */
/*  Nested table: the same DataTable, one level down, in a dialog             */
/* -------------------------------------------------------------------------- */

function NestedTable({
  column,
  rows,
  ...props
}: DataTableMeta & {
  column: Extract<Column, { type: "table" }>;
  rows: Row[];
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-start font-normal"
          />
        }
      >
        {rows.length} {rows.length === 1 ? "row" : "rows"}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{column.label}</DialogTitle>
          <DialogDescription>Changes are saved as you edit.</DialogDescription>
        </DialogHeader>
        {/* Rows come from the parent's current data, so edits show up live. */}
        <DataTable columns={column.columns} data={rows} {...props} />
      </DialogContent>
    </Dialog>
  );
}
