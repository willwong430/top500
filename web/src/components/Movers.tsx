import React from 'react';
export function Movers({ rows }:{ rows:{ticker:string;prevRank:number;newRank:number;rankDelta:number;}[] }){
  return (
    <div>
      <h3>Top 10 Movers (by rank)</h3>
      <ol>
        {rows.map(r => (
          <li key={r.ticker}>
            {r.ticker}: {r.rankDelta > 0 ? '+' : ''}{r.rankDelta} (#{r.prevRank} → #{r.newRank})
          </li>
        ))}
      </ol>
    </div>
  );
}
