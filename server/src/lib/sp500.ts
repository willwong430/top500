// server/src/lib/sp500.ts
import axios from "axios";
import * as cheerio from "cheerio";

export type Sp500Row = {
  symbol: string;
  security: string;
  sector: string;
  subIndustry: string;
  headquarters: string;
  dateAdded: string | null;
  cik: string | null;
  founded: string | null;
};

export async function fetchSp500List(): Promise<Sp500Row[]> {
  // MediaWiki API: get rendered HTML of the page
  const api =
    "https://en.wikipedia.org/w/api.php" +
    "?action=parse" +
    "&page=List_of_S%26P_500_companies" +
    "&prop=text" +
    "&format=json" +
    "&formatversion=2" +
    "&origin=*";

  const { data } = await axios.get(api, { timeout: 30000, headers: { Accept: "application/json" } });
  const html: string | undefined = data?.parse?.text;
  if (!html) throw new Error("Wikipedia returned no HTML.");

  const $ = cheerio.load(html);
  // Prefer #constituents; fallback to first .wikitable if needed
  const $table = $("#constituents").length ? $("#constituents") : $("table.wikitable").first();
  if (!$table.length) throw new Error("Could not find the S&P 500 table.");

  const out: Sp500Row[] = [];
  $table.find("tbody > tr").slice(1).each((_, tr) => {
    const $td = $(tr).find("td");
    if ($td.length < 2) return;

    // Column map (as of now):
    // 0: Symbol, 1: Security, 2: SEC filings (link), 3: GICS Sector,
    // 4: GICS Sub-Industry, 5: Headquarters Location, 6: Date first added,
    // 7: CIK, 8: Founded
    const clean = (s: string) =>
      s.replace(/\[\d+]/g, "").replace(/\s+/g, " ").trim();

    const symbol = clean($td.eq(0).text());
    const security = clean($td.eq(1).text());
    const sector = clean($td.eq(3).text());
    const subIndustry = clean($td.eq(4).text());
    const headquarters = clean($td.eq(5).text());
    const dateAdded = clean($td.eq(6).text()) || null;
    const cik = clean($td.eq(7).text()) || null;
    const founded = clean($td.eq(8).text()) || null;

    if (symbol && security) {
      out.push({ symbol, security, sector, subIndustry, headquarters, dateAdded, cik, founded });
    }
  });

  return out;
}
