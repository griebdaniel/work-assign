"use client";

import type { Column, Option, Row } from "@/components/data-table/types";
import { timeSpan } from "@/components/data-table/utils";
import { ResourceTable } from "@/components/resource-table";

export function ScheduleTable({
  data,
  shifts,
  employees,
  batches,
}: {
  data: Row[];
  shifts: Option[];
  employees: Option[];
  batches: Option[];
}) {
  const workColumns: Column[] = [
    {
      accessor: "employee_id",
      type: "option",
      label: "Employee",
      options: employees,
      required: true,
    },
    {
      accessor: "batch_id",
      type: "option",
      label: "Batch",
      options: batches,
      required: true,
    },
    { accessor: "start_time", type: "time", label: "Start", required: true },
    { accessor: "end_time", type: "time", label: "End", required: true },
    {
      accessor: "length",
      type: "duration",
      label: "Length",
      compute: (row) => timeSpan(row.start_time, row.end_time),
    },
  ];

  const columns: Column[] = [
    { accessor: "date", type: "date", label: "Date", required: true },
    {
      accessor: "shifts",
      type: "table",
      label: "Shifts",
      columns: [
        {
          accessor: "shift_id",
          type: "option",
          label: "Shift",
          options: shifts,
          required: true,
        },
        {
          accessor: "work",
          type: "table",
          label: "Work",
          columns: workColumns,
        },
      ],
    },
  ];

  return <ResourceTable resource="schedule" columns={columns} data={data} />;
}
