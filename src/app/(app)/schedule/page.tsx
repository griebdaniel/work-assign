import { getBatchOptions, getOptions, getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";
import { ScheduleTable } from "./schedule-table";

export default async function SchedulePage() {
  const { user } = await requireSession();
  const [schedules, shifts, employees, batches] = await Promise.all([
    getRows("schedule", user.id),
    getOptions("shift", user.id),
    getOptions("employee", user.id),
    getBatchOptions(user.id),
  ]);

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Schedule</h1>
      <p className="text-sm text-muted-foreground">
        One row per day. Each day lists its shifts, and each shift who works on
        which batch, and when.
      </p>
      <ScheduleTable
        data={schedules}
        shifts={shifts}
        employees={employees}
        batches={batches}
      />
    </main>
  );
}
