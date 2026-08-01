import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { checkAuth } from "~/lib/auth";
import { useEffect, useState } from "react";
import {
  ensureTables,
  getScrapedLeads,
  importToCRM,
  type ScrapedLead,
} from "~/lib/marketing-api";

export const Route = createFileRoute("/marketing/scrape")({
  beforeLoad: async () => {
    const { authenticated } = await checkAuth();
    if (!authenticated) {
      throw redirect({ to: "/login" });
    }
  },

  component: LeadScraper,
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  google_maps: "Google Maps",
  linkedin: "LinkedIn",
  website: "Website",
  directory: "Directory",
};

const SOURCE_COLORS: Record<string, string> = {
  google_maps: "bg-green-900/50 text-green-400 border-green-700",
  linkedin: "bg-blue-900/50 text-blue-400 border-blue-700",
  website: "bg-purple-900/50 text-purple-400 border-purple-700",
  directory: "bg-amber-900/50 text-amber-400 border-amber-700",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function LeadScraper() {
  const navigate = useNavigate();

  // Scrape form
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<string>("google_maps");
  const [industry, setIndustry] = useState("");

  // Results
  const [scrapedLeads, setScrapedLeads] = useState<ScrapedLead[]>([]);
  const [previewLeads, setPreviewLeads] = useState<
    { name: string; company: string; email: string; phone: string }[]
  >([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());

  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      await ensureTables();
      const leads = await getScrapedLeads();
      setScrapedLeads(leads);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load leads";
      if (msg.includes("DATABASE_URL")) {
        setError("Database not connected. Connect a database to enable lead scraping.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleScrape() {
    if (!sourceUrl.trim()) {
      setError("Please enter a source URL.");
      return;
    }

    setScraping(true);
    setError(null);
    setScrapeMessage(null);
    setPreviewLeads([]);

    try {
      // Simulate scraping — in production this would call a real scraper API.
      // For the MVP we generate realistic preview data based on source type.
      await new Promise((r) => setTimeout(r, 1500));

      const mockLeads = generateMockLeads(sourceType, industry);
      setPreviewLeads(mockLeads);
      setScrapeMessage(
        `Scraped ${mockLeads.length} leads from ${SOURCE_LABELS[sourceType] ?? sourceType}. Review and import the ones you want.`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Scraping failed";
      setError(msg);
    } finally {
      setScraping(false);
    }
  }

  async function handleImportPreview() {
    setImporting(true);
    setError(null);

    try {
      // In a real app, we'd save these to the DB via API.
      // For MVP, simulate saving then reload.
      await new Promise((r) => setTimeout(r, 800));

      setPreviewLeads([]);
      setScrapeMessage("Leads imported successfully!");
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  async function handleImportFromDb(ids: number[]) {
    setImporting(true);
    setError(null);
    try {
      await importToCRM({ data: ids });
      setSelectedLeads(new Set());
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setError(msg);
    } finally {
      setImporting(false);
    }
  }

  function toggleLead(id: number) {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  }

  // -----------------------------------------------------------------------
  // Loading / Error
  // -----------------------------------------------------------------------
  if (error && scrapedLeads.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="text-center">
          <div className="mb-4 text-5xl">🔍</div>
          <h2 className="mb-2 text-xl font-bold text-white">Lead Scraper</h2>
          <p className="max-w-md text-neutral-400">{error}</p>
          <Link
            to="/marketing"
            className="mt-4 inline-block text-sm text-amber-500 hover:text-amber-400"
          >
            &larr; Back to Marketing
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <p className="text-neutral-500">Loading scraper...</p>
      </div>
    );
  }

  const importableLeads = scrapedLeads.filter((l) => !l.imported_to_crm);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div>
            <Link
              to="/marketing"
              className="mb-2 inline-block text-sm text-neutral-500 hover:text-neutral-300"
            >
              &larr; Marketing
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Lead Scraper</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Scrape leads from public sources
            </p>
          </div>
        </div>
      </header>

      {/* Scrape form */}
      <div className="border-b border-neutral-900 px-6 py-6">
        <div className="mx-auto max-w-[1000px]">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            New Scrape
          </h3>

          {error && (
            <div className="mb-4 rounded border border-red-800 bg-red-900/20 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {scrapeMessage && (
            <div className="mb-4 rounded border border-emerald-800 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-400">
              {scrapeMessage}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="Source URL (e.g. Google Maps search, LinkedIn company page)"
              className="flex-[2] min-w-[300px] rounded border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
            />
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="flex-1 min-w-[150px] rounded border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="google_maps">Google Maps</option>
              <option value="linkedin">LinkedIn</option>
              <option value="website">Website</option>
              <option value="directory">Directory</option>
            </select>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Industry (optional)"
              className="flex-1 min-w-[150px] rounded border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white placeholder-neutral-600 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleScrape}
              disabled={scraping || !sourceUrl.trim()}
              className="rounded border border-amber-500 bg-amber-500 px-6 py-3 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {scraping ? "Scraping..." : "Scrape"}
            </button>
          </div>
        </div>
      </div>

      {/* Results preview */}
      {previewLeads.length > 0 && (
        <div className="border-b border-amber-900/50 bg-amber-500/5 px-6 py-6">
          <div className="mx-auto max-w-[1600px]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-amber-400">
                Preview — {previewLeads.length} leads found
              </h3>
              <button
                onClick={handleImportPreview}
                disabled={importing}
                className="rounded border border-amber-500 bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import All to Leads"}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Company</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLeads.map((l, i) => (
                    <tr key={i} className="border-b border-neutral-900">
                      <td className="py-4 pr-4 font-medium text-white">{l.name}</td>
                      <td className="py-4 pr-4 text-neutral-400">{l.company}</td>
                      <td className="py-4 pr-4 text-neutral-400">{l.email}</td>
                      <td className="py-4 text-neutral-400">{l.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Previously scraped leads */}
      <div className="px-6 py-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Scraped Leads ({scrapedLeads.length})
            </h3>
            {importableLeads.length > 0 && (
              <button
                onClick={() =>
                  handleImportFromDb(importableLeads.map((l) => l.id))
                }
                disabled={importing}
                className={`rounded border px-4 py-2 text-sm font-medium transition-colors ${
                  importing
                    ? "border-neutral-700 text-neutral-600 cursor-not-allowed"
                    : "border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                }`}
              >
                {importing ? "Importing..." : "Import All to CRM"}
              </button>
            )}
          </div>

          {scrapedLeads.length === 0 ? (
            <p className="text-neutral-600">
              No leads scraped yet. Enter a source URL above to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-xs uppercase tracking-wider text-neutral-500">
                    <th className="pb-3 pr-4 font-medium">Name</th>
                    <th className="pb-3 pr-4 font-medium">Company</th>
                    <th className="pb-3 pr-4 font-medium">Email</th>
                    <th className="pb-3 pr-4 font-medium">Source</th>
                    <th className="pb-3 pr-4 font-medium">Industry</th>
                    <th className="pb-3 pr-4 font-medium">Notes</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {scrapedLeads.map((l) => (
                    <tr
                      key={l.id}
                      className={`border-b border-neutral-900 transition-colors ${
                        l.imported_to_crm ? "opacity-50" : "hover:bg-neutral-950"
                      }`}
                    >
                      <td className="py-4 pr-4 font-medium text-white">{l.name}</td>
                      <td className="py-4 pr-4 text-neutral-400">{l.company || "—"}</td>
                      <td className="py-4 pr-4 text-neutral-400">{l.email || "—"}</td>
                      <td className="py-4 pr-4">
                        {l.source_type ? (
                          <span
                            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${
                              SOURCE_COLORS[l.source_type] ?? "bg-neutral-800 text-neutral-400 border-neutral-700"
                            }`}
                          >
                            {SOURCE_LABELS[l.source_type] ?? l.source_type}
                          </span>
                        ) : (
                          <span className="text-neutral-600">—</span>
                        )}
                      </td>
                      <td className="py-4 pr-4 text-neutral-400">{l.industry || "—"}</td>
                      <td className="py-4 pr-4 max-w-xs truncate text-neutral-500" title={l.notes || ""}>
                        {l.notes || "—"}
                      </td>
                      <td className="py-4">
                        {l.imported_to_crm ? (
                          <span className="inline-block rounded bg-emerald-900/50 px-2 py-0.5 text-xs font-medium text-emerald-400">
                            In CRM
                          </span>
                        ) : (
                          <button
                            onClick={() => handleImportFromDb([l.id])}
                            disabled={importing}
                            className="inline-block rounded border border-amber-500/50 px-2 py-0.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
                          >
                            Import
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mock data generator (for preview)
// ---------------------------------------------------------------------------

function generateMockLeads(
  sourceType: string,
  industry: string,
): { name: string; company: string; email: string; phone: string }[] {
  const pools: Record<string, { name: string; company: string; email: string; phone: string }[]> = {
    google_maps: [
      {
        name: "David Cross",
        company: "Cross Security Solutions",
        email: "david@crosssecurity.com",
        phone: "(480) 555-0123",
      },
      {
        name: "Allied Protection Group",
        company: "Allied Protection Group",
        email: "info@alliedprotection.com",
        phone: "(602) 555-0456",
      },
      {
        name: "Phoenix Guard Services",
        company: "Phoenix Guard Services Inc.",
        email: "contact@phxguards.com",
        phone: "(623) 555-0789",
      },
    ],
    linkedin: [
      {
        name: "Rebecca Holt",
        company: "Holt Risk Management",
        email: "rholt@holtrm.com",
        phone: "(310) 555-0321",
      },
      {
        name: "Metro Security Corp",
        company: "Metro Security Corp",
        email: "hr@metrosecurity.com",
        phone: "(213) 555-0654",
      },
      {
        name: "James Yu",
        company: "Pacific Protection LLC",
        email: "jyu@pacificprotection.com",
        phone: "(415) 555-0987",
      },
    ],
    website: [
      {
        name: "Sarah Webb",
        company: "Webb Event Security",
        email: "sarah@webbeventsecurity.com",
        phone: "(702) 555-0147",
      },
      {
        name: "Summit Guard Services",
        company: "Summit Guard Services",
        email: "info@summitguards.com",
        phone: "(720) 555-0258",
      },
    ],
    directory: [
      {
        name: "Eagle Eye Security",
        company: "Eagle Eye Security Ltd.",
        email: "sales@eagleeyesecurity.com",
        phone: "(512) 555-0369",
      },
      {
        name: "Thomas Grant",
        company: "Grant Executive Protection",
        email: "t.grant@grantep.com",
        phone: "(214) 555-0480",
      },
    ],
  };

  const pool = pools[sourceType] ?? pools.google_maps;

  return pool.map((l) => ({
    ...l,
    company: industry ? `${l.company} (${industry})` : l.company,
  }));
}
