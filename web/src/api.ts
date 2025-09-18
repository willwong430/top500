export async function getTop500() { return (await fetch('/api/top500.json')).json(); }
export async function getMovers() { return (await fetch('/api/movers.json')).json(); }
export async function getChanges() { return (await fetch('/api/changes.json')).json(); }
