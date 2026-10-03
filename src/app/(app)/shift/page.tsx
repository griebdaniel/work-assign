import { getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";
import { ShiftTable } from "./shift-table";

export default async function ShiftPage() {
  const { user } = await requireSession();
  const shifts = await getRows("shift", user.id);

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Shifts</h1>
      <p className="text-sm text-muted-foreground">
        Shifts can't overlap. One that ends before it starts runs past midnight.
      </p>
      <ShiftTable data={shifts} />
    </main>
  );
}
