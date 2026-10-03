"use client";

import { Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { DataTableInstance } from "./table-config";

export function TableToolbar({
  table,
  insertDialog,
  onDeleteSelected,
}: {
  table: DataTableInstance;
  insertDialog: React.ReactNode;
  onDeleteSelected: () => void;
}) {
  const search = String(table.state.globalFilter ?? "");
  const selectedCount = table.getSelectedRowModel().rows.length;

  function setSearch(value: string) {
    table.setGlobalFilter(value);
    table.firstPage();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-72">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          aria-label="Search rows"
          placeholder="Search rows"
          className="px-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-0.5 size-7 -translate-y-1/2"
            aria-label="Clear search"
            onClick={() => setSearch("")}
          >
            <X aria-hidden />
          </Button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {selectedCount > 0 && (
          <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
            <Trash2 aria-hidden />
            Delete {selectedCount}
          </Button>
        )}
        {insertDialog}
      </div>
    </div>
  );
}
