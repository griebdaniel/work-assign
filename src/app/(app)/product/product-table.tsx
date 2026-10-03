"use client";

import type { Column, Option, Row } from "@/components/data-table/types";
import { ResourceTable } from "@/components/resource-table";
import type { PhaseDetails } from "@/lib/dal/queries";

export function ProductTable({
  data,
  phases,
  details,
}: {
  data: Row[];
  phases: Option[];
  details: PhaseDetails[];
}) {
  // Shown next to each picked phase, so you can see what it takes.
  const byId = new Map(details.map((phase) => [phase.id, phase]));
  const detail = (row: Row) => byId.get(String(row.phase_id));

  const columns: Column[] = [
    { accessor: "name", type: "string", label: "Name", required: true },
    {
      accessor: "phases",
      type: "table",
      label: "Phases",
      columns: [
        {
          accessor: "phase_id",
          type: "option",
          label: "Phase",
          options: phases,
          required: true,
        },
        { accessor: "sort_order", type: "number", label: "Order" },
        {
          accessor: "setup_time",
          type: "duration",
          label: "Setup time",
          compute: (row) => detail(row)?.setup_time,
        },
        {
          accessor: "unit_time",
          type: "duration",
          label: "Time per unit",
          compute: (row) => detail(row)?.unit_time,
        },
        {
          accessor: "max_batch",
          type: "number",
          label: "Max batch",
          compute: (row) => detail(row)?.max_batch ?? undefined,
        },
      ],
    },
  ];

  return <ResourceTable resource="product" columns={columns} data={data} />;
}
