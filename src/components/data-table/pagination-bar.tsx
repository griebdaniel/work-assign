"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import type { DataTableInstance } from "./table-config";

const PAGE_SIZES = [5, 10, 20, 50];

type PageItem = { kind: "page"; page: number } | { kind: "gap"; after: number };

/**
 * Page buttons to show (zero-based): first, last, and the current page with one
 * neighbour on each side. Gaps become an ellipsis, or the page itself when
 * the gap is a single page.
 */
function getPageItems(current: number, count: number): PageItem[] {
  const last = count - 1;
  const pages = [...new Set([0, last, current - 1, current, current + 1])]
    .filter((page) => page >= 0 && page <= last)
    .sort((a, b) => a - b);

  const items: PageItem[] = [];
  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined) {
      if (page - previous === 2)
        items.push({ kind: "page", page: previous + 1 });
      else if (page - previous > 2)
        items.push({ kind: "gap", after: previous });
    }
    items.push({ kind: "page", page });
  });
  return items;
}

export function PaginationBar({ table }: { table: DataTableInstance }) {
  const { pageIndex, pageSize } = table.state.pagination;
  const total = table.getPrePaginatedRowModel().rows.length;
  const pageCount = Math.max(table.getPageCount(), 1);
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min(total, (pageIndex + 1) * pageSize);
  const canPrevious = table.getCanPreviousPage();
  const canNext = table.getCanNextPage();

  // shadcn's links are anchors: stop the "#" navigation and drive the table instead.
  const go = (action: () => void) => (event: React.MouseEvent) => {
    event.preventDefault();
    action();
  };
  const disabledProps = (disabled: boolean) => ({
    "aria-disabled": disabled,
    tabIndex: disabled ? -1 : undefined,
    className: cn(disabled && "pointer-events-none opacity-50"),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
      <p className="tabular-nums">
        {total === 0 ? "0 rows" : `${from}–${to} of ${total}`}
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-18" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={go(() => table.previousPage())}
                {...disabledProps(!canPrevious)}
              />
            </PaginationItem>

            {getPageItems(pageIndex, pageCount).map((item) =>
              item.kind === "gap" ? (
                <PaginationItem key={`gap-${item.after}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item.page}>
                  <PaginationLink
                    href="#"
                    isActive={item.page === pageIndex}
                    aria-label={`Go to page ${item.page + 1}`}
                    onClick={go(() => table.setPageIndex(item.page))}
                  >
                    {item.page + 1}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={go(() => table.nextPage())}
                {...disabledProps(!canNext)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
