import type { Row } from "@/components/data-table/types";

// Progress figures for the product order page, worked out from the batches.
// A batch is finished at progress 1; units count by the batch's quantity.

const rowsOf = (row: Row, key: string) => (row[key] as Row[] | undefined) ?? [];
const numberOf = (row: Row, key: string) => Number(row[key] ?? 0);

/** Units of a phase whose batch is finished, or still in progress. */
export function phaseUnits(phase: Row, finished: boolean) {
  return rowsOf(phase, "batches")
    .filter((batch) => numberOf(batch, "progress") >= 1 === finished)
    .reduce((sum, batch) => sum + numberOf(batch, "quantity"), 0);
}

/** Units that went through every phase of the line. */
export function lineUnitsDone(line: Row) {
  const phases = rowsOf(line, "progress");
  if (phases.length === 0) return 0;
  return Math.min(...phases.map((phase) => phaseUnits(phase, true)));
}

/** Work done and work total, in phase-units (one unit through one phase = 1). */
function lineWork(line: Row) {
  const phases = rowsOf(line, "progress");
  const done = phases
    .flatMap((phase) => rowsOf(phase, "batches"))
    .reduce(
      (sum, batch) =>
        sum + numberOf(batch, "quantity") * numberOf(batch, "progress"),
      0,
    );
  return { done, total: numberOf(line, "count") * phases.length };
}

function share({ done, total }: { done: number; total: number }) {
  return total > 0 ? Math.min(done / total, 1) : undefined;
}

export function lineProgress(line: Row) {
  return share(lineWork(line));
}

export function orderProgress(order: Row) {
  const work = rowsOf(order, "items").map(lineWork);
  return share({
    done: work.reduce((sum, w) => sum + w.done, 0),
    total: work.reduce((sum, w) => sum + w.total, 0),
  });
}
