import React from "react";

type Sp500Row = {
  symbol: string;
  security: string;
  sector: string;
  subIndustry: string;
  headquarters: string;
  dateAdded: string | null;
  cik: string | null;
  founded: string | null;
};

export default function Sp500Page() {
  const [rows, setRows] = React.useState<Sp500Row[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/sp500.json", { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Sp500Row[];
        if (!cancel) setRows(data);
      } catch (e: any) {
        if (!cancel) setError(e?.message || String(e));
      } finally {
        if (!cancel) setLoading(false);
      }
    };
    run();
    return () => { cancel = true; };
  }, []);

  if (loading) return <div className="p-4">Loading S&amp;P 500…</div>;
  if (error) return <div className="p-4 text-red-600">Error: {error}</div>;
  if (!rows) return null;

  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold mb-3">S&amp;P 500 Constituents ({rows.length})</h1>
      <div className="overflow-auto border rounded">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Symbol</th>
              <th className="text-left p-2">Security</th>
              <th className="text-left p-2">Sector</th>
              <th className="text-left p-2">Sub-Industry</th>
              <th className="text-left p-2">HQ</th>
              <th className="text-left p-2">Date Added</th>
              <th className="text-left p-2">CIK</th>
              <th className="text-left p-2">Founded</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className="odd:bg-white even:bg-gray-50">
                <td className="p-2 font-semibold">{r.symbol}</td>
                <td className="p-2">{r.security}</td>
                <td className="p-2">{r.sector}</td>
                <td className="p-2">{r.subIndustry}</td>
                <td className="p-2">{r.headquarters}</td>
                <td className="p-2">{r.dateAdded || "—"}</td>
                <td className="p-2">{r.cik || "—"}</td>
                <td className="p-2">{r.founded || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
