import type { Column } from "@/components/data-table/types";
import { ResourceTable } from "@/components/resource-table";
import { getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";

const columns: Column[] = [
  { accessor: "name", type: "string", label: "Name", required: true },
];

export default async function SkillPage() {
  const { user } = await requireSession();
  const skills = await getRows("skill", user.id);

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Skills</h1>
      <ResourceTable resource="skill" columns={columns} data={skills} />
    </main>
  );
}
