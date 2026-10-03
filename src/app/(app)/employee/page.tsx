import type { Column } from "@/components/data-table/types";
import { ResourceTable } from "@/components/resource-table";
import { getOptions, getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";

export default async function EmployeePage() {
  const { user } = await requireSession();
  const [employees, shifts, skills] = await Promise.all([
    getRows("employee", user.id),
    getOptions("shift", user.id),
    getOptions("skill", user.id),
  ]);

  const columns: Column[] = [
    { accessor: "name", type: "string", label: "Name", required: true },
    { accessor: "shift_id", type: "option", label: "Shift", options: shifts },
    {
      accessor: "skill_ids",
      type: "multiOption",
      label: "Skills",
      options: skills,
    },
  ];

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Employees</h1>
      <ResourceTable resource="employee" columns={columns} data={employees} />
    </main>
  );
}
