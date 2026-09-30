import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { ensureSeed } from "@/db/seed";
import { listProperties } from "@/db/queries";
import { PropertyCard } from "@/components/cards";
import { EmptyState, SectionHead } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  await ensureSeed();
  const props = await listProperties();

  return (
    <div className="mx-auto max-w-[1280px]">
      <SectionHead
        kicker="Portfolio"
        title={`Properties · ${props.length}`}
        action={
          <Link href="/properties/new" className="btn-gold flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold">
            <Plus size={14} /> New Property
          </Link>
        }
      />
      {props.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          sub="Add your first project — paste a website URL, upload photography, or start from the sample library."
          action={
            <Link href="/properties/new" className="btn-gold rounded-xl px-5 py-2.5 text-[13px] font-semibold">
              Create property
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4.5 sm:grid-cols-2 xl:grid-cols-3">
          {props.map((c, i) => (
            <div key={c.property.id} className="anim-up" style={{ animationDelay: `${i * 60}ms` }}>
              <PropertyCard card={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
