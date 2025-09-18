import React from 'react';

type Row = { rank: number; ticker: string; name: string; marketCap: number };

export function TopTable({ rows }: { rows: Row[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{textAlign:'left'}}>#</th>
          <th style={{textAlign:'left'}}>Ticker</th>
          <th style={{textAlign:'left'}}>Name</th>
          <th style={{textAlign:'right'}}>Market Cap</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.ticker}>
            <td>{r.rank}</td>
            <td>{r.ticker}</td>
            <td>{r.name}</td>
            <td style={{textAlign:'right'}}>${(r.marketCap/1e9).toFixed(1)}B</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
