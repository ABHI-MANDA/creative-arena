import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url } = (await req.json()) as { url?: string };
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Please enter a valid website URL starting with http:// or https://" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
    } catch {
      clearTimeout(timeout);
      return NextResponse.json({ error: "Could not reach the website URL. Please check the web address." }, { status: 400 });
    }
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch website (HTTP ${res.status}).` }, { status: 400 });
    }

    const html = await res.text();

    // 1. Extract OpenGraph & Meta Tags
    const getMeta = (prop: string) => {
      const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["'](?:og:)?${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
        || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?${prop}["']`, "i"));
      return match ? match[1].trim() : "";
    };

    const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || "";
    const ogTitle = getMeta("title") || pageTitle;
    const ogDesc = getMeta("description") || getMeta("site_name");
    const ogImage = getMeta("image");

    // Extract images from <img> tags or og:image
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    const scrapedImages: { url: string; label: string }[] = [];
    if (ogImage) {
      try {
        const absUrl = new URL(ogImage, url).href;
        scrapedImages.push({ url: absUrl, label: "Exterior" });
      } catch {}
    }

    for (const match of imgMatches.slice(0, 15)) {
      const src = match[1];
      if (src && !src.endsWith(".svg") && !src.endsWith(".ico") && !src.includes("logo") && !src.includes("icon")) {
        try {
          const absUrl = new URL(src, url).href;
          if (!scrapedImages.some((i) => i.url === absUrl)) {
            scrapedImages.push({ url: absUrl, label: scrapedImages.length === 0 ? "Exterior" : "Property Shot" });
          }
        } catch {}
      }
    }

    // 2. Use OpenRouter AI to parse structured brief if API key is set
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (apiKey) {
      try {
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .slice(0, 6000);

        const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: process.env.OPENROUTER_MODEL || "google/gemini-2.0-flash",
            messages: [
              {
                role: "system",
                content: "Extract real estate listing details into strict JSON object with keys: { \"name\": string, \"location\": string, \"propertyType\": string, \"price\": string, \"audience\": string, \"amenities\": string, \"description\": string }.",
              },
              {
                role: "user",
                content: `URL: ${url}\nTitle: ${ogTitle}\nDescription: ${ogDesc}\n\nWebpage content snippet:\n${textContent}`,
              },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = (await aiRes.json()) as { choices?: { message?: { content?: string } }[] };
          const reply = aiData.choices?.[0]?.message?.content ?? "";
          const start = reply.indexOf("{");
          const end = reply.lastIndexOf("}");
          if (start >= 0 && end > start) {
            const parsed = JSON.parse(reply.slice(start, end + 1)) as Record<string, unknown>;
            return NextResponse.json({
              brief: {
                name: String(parsed.name || ogTitle || "Web Property").split("|")[0].split("-")[0].trim(),
                location: String(parsed.location || "Prime Location"),
                propertyType: String(parsed.propertyType || "Luxury Residences"),
                price: String(parsed.price || "Price on Request"),
                audience: String(parsed.audience || "Premium Buyers & Investors"),
                amenities: Array.isArray(parsed.amenities) ? parsed.amenities.join(", ") : String(parsed.amenities || "Gated Security, Parking, Clubhouse"),
                description: String(parsed.description || ogDesc || "Exclusive real estate property."),
              },
              images: scrapedImages.length ? scrapedImages : [{ url: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80", label: "Exterior" }],
            });
          }
        }
      } catch (aiErr) {
        console.warn("AI website extraction falling back to heuristic parsing:", aiErr);
      }
    }

    // Heuristic Fallback
    const cleanTitle = ogTitle.split("|")[0].split("-")[0].trim() || "Web Property";
    return NextResponse.json({
      brief: {
        name: cleanTitle,
        location: "Prime Location",
        propertyType: "Luxury Residences",
        price: "Price on Request",
        audience: "Premium Homeowners & Investors",
        amenities: "Gated Security, Landscaped Gardens, Parking, Clubhouse",
        description: ogDesc || `Discover ${cleanTitle}, an exclusive property destination.`,
      },
      images: scrapedImages.length ? scrapedImages : [{ url: "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80", label: "Exterior" }],
    });
  } catch (error) {
    console.error("Web scraping API error:", error);
    return NextResponse.json({ error: "Failed to scrape property details from URL." }, { status: 500 });
  }
}
