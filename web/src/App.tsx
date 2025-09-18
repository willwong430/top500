import React, { useEffect, useState } from 'react';
import { getTop500, getMovers, getChanges } from './api';
import { TopTable } from './components/TopTable';
import { Movers } from './components/Movers';
import { Changes } from './components/Changes';

export default function App(){
  const [top, setTop] = useState<any[]>([]);
  const [movers, setMovers] = useState<any[]>([]);
  const [changes, setChanges] = useState<{entered:string[];exited:string[]}>({entered:[], exited:[]});

  useEffect(() => {
    getTop500().then(setTop);
    getMovers().then(setMovers);
    getChanges().then(setChanges);
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin:'0 auto', padding: 24 }}>
      <h1>US Top 500 by Market Cap (Daily Close)</h1>
      <TopTable rows={top} />
      <div style={{marginTop: 32}}>
        <Movers rows={movers} />
      </div>
      <div style={{marginTop: 32}}>
        <Changes entered={changes.entered} exited={changes.exited} />
      </div>
    </div>
  );
}
