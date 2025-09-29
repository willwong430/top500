import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { getTop500, getMovers, getChanges } from './api';
import { TopTable } from './components/TopTable';
import { Movers } from './components/Movers';
import { Changes } from './components/Changes';
import Sp500Page from "./pages/Sp500";

function Home() {
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

export default function App(){
  return (
    <BrowserRouter>
      <nav style={{
        display:'flex', gap:16, alignItems:'center',
        padding:'12px 16px', borderBottom:'1px solid #eee',
        position:'sticky', top:0, background:'#fff', zIndex:10
      }}>
        <Link to="/">Home</Link>
        <Link to="/sp500">S&amp;P 500</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sp500" element={<Sp500Page />} />
      </Routes>
    </BrowserRouter>
  );
}
