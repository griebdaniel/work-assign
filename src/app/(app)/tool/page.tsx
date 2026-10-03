import type { Column } from "@/components/data-table/types";
import { ResourceTable } from "@/components/resource-table";
import { getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";

const columns: Column[] = [
  { accessor: "name", type: "string", label: "Name", required: true },
  { accessor: "count", type: "number", label: "Available" },
];

export default async function ToolPage() {
  const { user } = await requireSession();
  const tools = await getRows("tool", user.id);

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Tools</h1>
      <ResourceTable resource="tool" columns={columns} data={tools} />
    </main>
  );
}
