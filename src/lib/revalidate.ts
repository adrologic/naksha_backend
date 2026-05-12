const WEBSITE_URL = process.env.WEBSITE_REVALIDATE_URL;
const SECRET = process.env.REVALIDATE_SECRET;

type Opts = { paths?: string[]; layout?: boolean };

export function revalidateWebsite(opts: Opts = {}): void {
  if (!WEBSITE_URL) return;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SECRET) headers.authorization = `Bearer ${SECRET}`;
  fetch(WEBSITE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ paths: opts.paths ?? [], layout: opts.layout ?? false }),
  }).catch((err) => {
    console.warn("[revalidate] failed:", err?.message ?? err);
  });
}
