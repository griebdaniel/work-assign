import type { Column } from "@/components/data-table/types";
import { ResourceTable } from "@/components/resource-table";
import { getOptions, getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";

export default async function SupplyOrderPage() {
  const { user } = await requireSession();
  const [orders, supplies] = await Promise.all([
    getRows("supply-order", user.id),
    getOptions("supply", user.id),
  ]);

  const columns: Column[] = [
    { accessor: "name", type: "string", label: "Name", required: true },
    { accessor: "order_date", type: "date", label: "Ordered", required: true },
    { accessor: "arrival_date", type: "date", label: "Arrives" },
    {
      accessor: "items",
      type: "table",
      label: "Supplies",
      columns: [
        {
          accessor: "supply_id",
          type: "option",
          label: "Supply",
          options: supplies,
          required: true,
        },
        {
          accessor: "quantity",
          type: "number",
          label: "Quantity",
          required: true,
        },
      ],
    },
  ];

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Supply orders</h1>
      <ResourceTable resource="supply-order" columns={columns} data={orders} />
    </main>
  );
}
