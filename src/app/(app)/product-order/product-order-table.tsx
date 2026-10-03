"use client";

import type { Column, Option, Row } from "@/components/data-table/types";
import { ResourceTable } from "@/components/resource-table";

import {
  lineProgress,
  lineUnitsDone,
  orderProgress,
  phaseUnits,
} from "./progress";

export function ProductOrderTable({
  data,
  products,
  phases,
}: {
  data: Row[];
  products: Option[];
  phases: Option[];
}) {
  const batchColumns: Column[] = [
    { accessor: "quantity", type: "number", label: "Units" },
    { accessor: "progress", type: "percent", label: "Progress" },
  ];

  const progressColumns: Column[] = [
    {
      accessor: "phase_id",
      type: "option",
      label: "Phase",
      options: phases,
      required: true,
    },
    { accessor: "sort_order", type: "number", label: "Order" },
    {
      accessor: "done",
      type: "number",
      label: "Units done",
      compute: (row) => phaseUnits(row, true),
    },
    {
      accessor: "in_progress",
      type: "number",
      label: "In progress",
      compute: (row) => phaseUnits(row, false),
    },
    {
      accessor: "batches",
      type: "table",
      label: "Batches",
      columns: batchColumns,
    },
  ];

  const itemColumns: Column[] = [
    {
      accessor: "product_id",
      type: "option",
      label: "Product",
      options: products,
      required: true,
    },
    { accessor: "count", type: "number", label: "Count" },
    {
      accessor: "units_done",
      type: "number",
      label: "Finished",
      compute: lineUnitsDone,
    },
    {
      accessor: "line_progress",
      type: "percent",
      label: "Progress",
      compute: lineProgress,
    },
    {
      accessor: "progress",
      type: "table",
      label: "Phases",
      columns: progressColumns,
    },
  ];

  const columns: Column[] = [
    { accessor: "name", type: "string", label: "Name", required: true },
    { accessor: "order_date", type: "date", label: "Ordered", required: true },
    { accessor: "due_date", type: "date", label: "Due" },
    {
      accessor: "order_progress",
      type: "percent",
      label: "Progress",
      compute: orderProgress,
    },
    {
      accessor: "items",
      type: "table",
      label: "Products",
      columns: itemColumns,
    },
  ];

  return (
    <ResourceTable resource="product-order" columns={columns} data={data} />
  );
}
