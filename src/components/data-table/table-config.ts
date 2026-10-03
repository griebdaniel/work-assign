import type { ReactTable } from "@tanstack/react-table";
import {
  columnFilteringFeature,
  constructFilterFn,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

import type { CellAddress, DataTableHandlers, Row } from "./types";

/** Available to every cell via `table.options.meta`. */
export type DataTableMeta = DataTableHandlers & {
  /** Path to this table: `[]` at the top level, one entry per nested table above it. */
  path: CellAddress[];
};

// v9 is opt-in per feature: only what the table uses gets bundled.
export const features = tableFeatures({
  columnFilteringFeature, // required by the global filter
  globalFilteringFeature,
  rowSortingFeature, // sort state and header toggles; DataTable orders the rows
  rowPaginationFeature,
  rowSelectionFeature,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  tableMeta: metaHelper<DataTableMeta>(),
});

export type DataTableInstance = ReactTable<typeof features, Row>;

export const columnHelper = createColumnHelper<typeof features, Row>();

/**
 * The built-in case-insensitive "contains". Columns hand it the text the user
 * sees (labels, "1h 30m", dates as `YYYY-MM-DD`), not the stored value.
 */
export const searchFilterFn = constructFilterFn({
  ...filterFn_includesString,
  resolveDataValue: (value: unknown) => String(value ?? "").toLowerCase(),
});
