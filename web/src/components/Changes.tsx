import React from 'react';
export function Changes({ entered, exited }:{ entered:string[]; exited:string[] }){
  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <div>
        <h3>Entered Top 500</h3>
        <ul>{entered.map(t => <li key={t}>{t}</li>)}</ul>
      </div>
      <div>
        <h3>Exited Top 500</h3>
        <ul>{exited.map(t => <li key={t}>{t}</li>)}</ul>
      </div>
    </div>
  );
}
