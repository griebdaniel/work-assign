"use client";

import { startTransition, useOptimistic, useState } from "react";

import { DataTable } from "@/components/data-table";
import type { Column, Row } from "@/components/data-table/types";
import { deleteRow, insertRow, updateRow } from "@/components/data-table/utils";
import type { Resource } from "@/lib/dal/resources";
import {
  type ActionResult,
  deleteRowsAction,
  insertRowAction,
  updateCellAction,
} from "@/lib/table-actions";

type Change = (rows: Row[]) => Row[];

/**
 * A DataTable wired to the server: edits show immediately, are saved through
 * the table actions, and the page's fresh `data` replaces the guess once saved
 * (or the change rolls back and the error is shown if it failed).
 *
 * Pages only describe their `columns`; nested tables save the same way.
 */
export function ResourceTable({
  resource,
  columns,
  data,
}: {
  resource: Resource;
  columns: Column[];
  data: Row[];
}) {
  const [rows, applyChange] = useOptimistic(data, (current, change: Change) =>
    change(current),
  );
  const [error, setError] = useState<string>();

  // Resolves with the action's result so callers (the insert dialog) can react.
  function run(change: Change, action: () => Promise<ActionResult>) {
    return new Promise<ActionResult>((resolve) => {
      startTransition(async () => {
        applyChange(change);
        const result = await action().catch(() => ({
          error: "Something went wrong. Please try again.",
        }));
        resolve(result);
      });
    });
  }

  async function report(pending: Promise<ActionResult>) {
    setError((await pending).error);
  }

  return (
    <DataTable
      columns={columns}
      data={rows}
      error={error}
      // The insert dialog shows its own errors and stays open on failure.
      insertRow={(args) =>
        run(
          (current) => insertRow(current, args),
          () => insertRowAction(resource, args.cellAddress, args.row),
        )
      }
      updateRow={(args) =>
        report(
          run(
            (current) => updateRow(current, args),
            () => updateCellAction(resource, args.cellAddress, args.value),
          ),
        )
      }
      deleteRow={(args) =>
        report(
          run(
            (current) => deleteRow(current, args),
            () => deleteRowsAction(resource, args.cellAddress, args.rowsId),
          ),
        )
      }
    />
  );
}
