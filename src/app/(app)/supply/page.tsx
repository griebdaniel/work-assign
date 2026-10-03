import type { Column } from "@/components/data-table/types";
import { ResourceTable } from "@/components/resource-table";
import { getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";

const columns: Column[] = [
  { accessor: "name", type: "string", label: "Name", required: true },
  { accessor: "quantity", type: "number", label: "Quantity" },
];

export default async function SupplyPage() {
  const { user } = await requireSession();
  const supplies = await getRows("supply", user.id);

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Supplies</h1>
      <ResourceTable resource="supply" columns={columns} data={supplies} />
    </main>
  );
}
