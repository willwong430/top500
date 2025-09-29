export const sleep = (ms:number)=>new Promise(r=>setTimeout(r,ms));
export async function withBackoff<T>(fn:()=>Promise<T>, {tries=6,baseMs=800,maxMs=20000,jitter=true}={}):Promise<T>{
  let a=0,last:any;
  while(a<tries){
    try{return await fn();}catch(e:any){
      last=e; const s=e?.response?.status, c=e?.code;
      const retriable = s===429 || (s>=500&&s<600) || c==='ECONNABORTED'||c==='ETIMEDOUT'||c==='ENETUNREACH';
      if(!retriable) break;
      const ra=Number(e?.response?.headers?.['retry-after']);
      let wait = Number.isFinite(ra)&&ra>0? ra*1000 : Math.min(maxMs, baseMs*Math.pow(2,a));
      if (jitter) wait = Math.round(wait*(0.75+Math.random()*0.5));
      await sleep(wait); a++;
    }
  } throw last;
}
