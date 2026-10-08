import { ensureSeed } from "@/db/seed";
import { getBrand } from "@/db/queries";
import { BrandEditor } from "./editor";

export const revalidate = 60;

export default async function BrandPage() {
  await ensureSeed();
  const brand = await getBrand();
  return <BrandEditor initial={brand} />;
}
