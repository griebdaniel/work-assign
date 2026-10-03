import type { Column } from "@/components/data-table/types";
import { ResourceTable } from "@/components/resource-table";
import { getOptions, getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";

export default async function PhasePage() {
  const { user } = await requireSession();
  const [phases, supplies, tools, skills] = await Promise.all([
    getRows("phase", user.id),
    getOptions("supply", user.id),
    getOptions("tool", user.id),
    getOptions("skill", user.id),
  ]);

  const columns: Column[] = [
    { accessor: "name", type: "string", label: "Name", required: true },
    { accessor: "setup_time", type: "duration", label: "Setup time" },
    { accessor: "unit_time", type: "duration", label: "Time per unit" },
    { accessor: "max_batch", type: "number", label: "Max batch" },
    {
      accessor: "supplies",
      type: "table",
      label: "Supplies per unit",
      columns: [
        {
          accessor: "supply_id",
          type: "option",
          label: "Supply",
          options: supplies,
          required: true,
        },
        { accessor: "quantity", type: "number", label: "Quantity" },
      ],
    },
    {
      accessor: "tools",
      type: "table",
      label: "Tools",
      columns: [
        {
          accessor: "tool_id",
          type: "option",
          label: "Tool",
          options: tools,
          required: true,
        },
        { accessor: "count", type: "number", label: "Count" },
      ],
    },
    {
      accessor: "workers",
      type: "table",
      label: "Workers",
      columns: [
        {
          accessor: "skill_ids",
          type: "multiOption",
          label: "Skills needed",
          options: skills,
        },
      ],
    },
  ];

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Phases</h1>
      <p className="text-sm text-muted-foreground">
        A batch takes setup time + time per unit × units. Leave max batch empty
        for no limit. Add one worker row per employee the phase needs.
      </p>
      <ResourceTable resource="phase" columns={columns} data={phases} />
    </main>
  );
}
