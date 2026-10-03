"use client";

import type { Column, Row } from "@/components/data-table/types";
import { timeSpan } from "@/components/data-table/utils";
import { ResourceTable } from "@/components/resource-table";

const columns: Column[] = [
  { accessor: "name", type: "string", label: "Name", required: true },
  { accessor: "start_time", type: "time", label: "Start", required: true },
  { accessor: "end_time", type: "time", label: "End", required: true },
  {
    accessor: "length",
    type: "duration",
    label: "Length",
    compute: (row) => timeSpan(row.start_time, row.end_time),
  },
];

export function ShiftTable({ data }: { data: Row[] }) {
  return <ResourceTable resource="shift" columns={columns} data={data} />;
}
