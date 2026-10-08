import Link from "next/link";
import { Clapperboard, Plus } from "lucide-react";
import { ensureSeed } from "@/db/seed";
import { listCampaigns } from "@/db/queries";
import { CampaignRowCard } from "@/components/cards";
import { EmptyState, SectionHead } from "@/components/ui";

export const revalidate = 30;

export default async function CampaignsPage() {
  await ensureSeed();
  const camps = await listCampaigns();

  return (
    <div className="mx-auto max-w-[1100px]">
      <SectionHead
        kicker="Production"
        title={`Campaigns · ${camps.length}`}
        action={
          <Link href="/campaigns/new" prefetch={true} className="btn-gold flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold">
            <Plus size={14} /> New Campaign
          </Link>
        }
      />
      {camps.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No campaigns yet"
          sub="Pick a property, choose a preset and platforms — M & A proposes three creative directions and generates the full ad system."
          action={
            <Link href="/campaigns/new" prefetch={true} className="btn-gold rounded-xl px-5 py-2.5 text-[13px] font-semibold">
              Create campaign
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {camps.map((c, i) => (
            <div key={c.campaign.id} className="anim-up" style={{ animationDelay: `${i * 50}ms` }}>
              <CampaignRowCard row={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
