import { getOptions, getRows } from "@/lib/dal/queries";
import { requireSession } from "@/lib/session";
import { ProductOrderTable } from "./product-order-table";

export default async function ProductOrderPage() {
  const { user } = await requireSession();
  const [orders, products, phases] = await Promise.all([
    getRows("product-order", user.id),
    getOptions("product", user.id),
    getOptions("phase", user.id),
  ]);

  return (
    <main className="grid gap-4">
      <h1 className="text-lg font-semibold">Product orders</h1>
      <p className="text-sm text-muted-foreground">
        Adding a product to an order copies its phases, so later changes to the
        product don't affect it. Record work on a phase as batches.
      </p>
      <ProductOrderTable data={orders} products={products} phases={phases} />
    </main>
  );
}
