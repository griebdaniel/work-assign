import { getOptions, getPhaseDetails, getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";
import { ProductTable } from "./product-table";

export default async function ProductPage() {
  const { user } = await requireSession();
  const [products, phases, details] = await Promise.all([
    getRows("product", user.id),
    getOptions("phase", user.id),
    getPhaseDetails(user.id),
  ]);

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Products</h1>
      <p className="text-sm text-muted-foreground">
        A phase starts once every phase with a lower order is done. Phases with
        the same order can run at the same time.
      </p>
      <ProductTable data={products} phases={phases} details={details} />
    </main>
  );
}
