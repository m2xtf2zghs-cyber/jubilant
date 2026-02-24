import { Component, useEffect, useMemo, useRef, useState } from 'react';
import './styles.css';
import ChitModule from './ChitModule';

/* ── ICONS ── */
const I=({n,s=18,c=''})=>{
  const p={
    wallet:<><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></>,
    dashboard:<><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></>,
    user:<><circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/></>,
    users:<><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></>,
    coins:<><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1110.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></>,
    card:<><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>,
    report:<><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    printer:<><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>,
    logout:<><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    plus:<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    percent:<><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
    db:<><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></>,
    upload:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    search:<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    eye:<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    x:<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    check:<polyline points="20 6 9 17 4 12"/>,
    alert:<><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    lock:<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></>,
    calendar:<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
    download:<><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    sms:<><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></>,
    list:<><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
    trash:<><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></>,
  };
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={c} style={{flexShrink:0}}>{p[n]}</svg>;
};

/* ── UTILS ── */
const fc=v=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:0}).format(v||0);
const fd=d=>new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'});
const ts=()=>new Date().toISOString().split('T')[0];

const FREQ={
  WEEKLY:{label:'Weekly',days:7},BI_WEEKLY:{label:'Bi-Weekly',days:14},
  BI_MONTHLY:{label:'Bi-Monthly',days:15},MONTHLY:{label:'Monthly',days:30},
};
const ECATS=['Salary & Wages','Office Rent','Electricity/Utilities','Printing & Stationery','Legal Fees','Commission','Bad Debts Written Off','Travel & Conveyance','Tea & Refreshments','Other Indirect Expenses'];
const RISK_META={
  STANDARD:{label:'Standard',cls:'bg-g'},
  WATCH:{label:'Watchlist',cls:'bg-y'},
  HIGH_RISK:{label:'High Risk',cls:'bg-r'},
};
const blankProfile=(name='')=>({name,phone:'',kycRef:'',address:'',riskGrade:'STANDARD',notes:'',fundingChannel:'DIRECT',tieUpPartnerName:''});
const blankCollect=()=>({
  show:false,loanId:null,idx:null,partAmt:'',fullAmt:0,client:'',
  shortReceiptReason:'PARTIAL', // PARTIAL | TDS
  tdsAmt:'',
  tdsReceiptStatus:'PENDING',
  tdsDeducedBy:'AUTO', // AUTO | CLIENT | TIE_UP_PARTNER
  tdsCertificateRef:'',
  tdsNotes:'',
});

const calcRate=(p,i,fk,d)=>{p=+p||0;i=+i||0;d=+d||0;if(!p||!d)return 0;const r=i/p;return fk==='MONTHLY'?(r/((d+1)/2))*100:(r/((d+1)/2)/FREQ[fk].days)*3000;};
const toNum=v=>Number.isFinite(+v)?+v:0;
const buildInstallmentComponents=(principal,interest,duration)=>{
  const d=Math.max(0,parseInt(duration,10)||0);
  const p=toNum(principal),i=toNum(interest);
  if(!d) return [];
  const pBase=p/d,iBase=i/d;
  let pDone=0,iDone=0;
  return Array.from({length:d},(_,idx)=>{
    const principalDue=idx===d-1?Math.max(0,p-pDone):pBase;
    const interestDue=idx===d-1?Math.max(0,i-iDone):iBase;
    pDone+=principalDue;iDone+=interestDue;
    return{principalDue,interestDue,payment:principalDue+interestDue};
  });
};
const getScheduleItemSplitBase=(loan,p)=>{
  if(Number.isFinite(+p?.principalDue)&&Number.isFinite(+p?.interestDue)){
    return{principalDue:Math.max(0,+p.principalDue),interestDue:Math.max(0,+p.interestDue)};
  }
  const payment=toNum(p?.payment);
  const total=toNum(loan?.total);
  const principal=toNum(loan?.principal);
  const principalDue=total>0?payment*(principal/total):payment;
  return{principalDue:Math.max(0,principalDue),interestDue:Math.max(0,payment-principalDue)};
};
const getTxInterestComponent=(tx,loan)=>{
  if(Number.isFinite(+tx?.interestComponent)) return +tx.interestComponent;
  if(tx?.tag!=='COLLECTION') return 0;
  const total=toNum(loan?.total),interest=toNum(loan?.interest);
  return total>0?toNum(tx.amount)*(interest/total):0;
};
const getTxPrincipalComponent=(tx,loan)=>{
  if(Number.isFinite(+tx?.principalComponent)) return +tx.principalComponent;
  if(tx?.tag!=='COLLECTION') return 0;
  return Math.max(0,toNum(tx.amount)-getTxInterestComponent(tx,loan));
};
const DEMO_LOGIN_USER=(import.meta.env.VITE_DEMO_USERNAME||'').trim();
const DEMO_LOGIN_PASS=(import.meta.env.VITE_DEMO_PASSWORD||'');
const DEMO_LOGIN_ENABLED=!!(DEMO_LOGIN_USER&&DEMO_LOGIN_PASS);
const BACKEND_API_BASE=(import.meta.env.VITE_API_BASE_URL||'').trim().replace(/\/+$/,'');
const BACKEND_API_ENABLED=!!BACKEND_API_BASE;
const BACKEND_ORG_CODE=(import.meta.env.VITE_BACKEND_ORG_CODE||'').trim();
const BACKEND_SESSION_KEY='ypm_backend_auth';

/* ── SMALL COMPONENTS ── */
const Lbl=({ch})=><label className="lbl">{ch}</label>;
const SC=({label,value,col='sb',sub,onClick})=>(
  <div className="card" style={{padding:'18px 20px',cursor:onClick?'pointer':'default'}} onClick={onClick}>
    <p style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--st)',marginBottom:7}}>{label}</p>
    <p className={`mono ${col}`} style={{fontSize:20,fontWeight:700}}>{value}</p>
    {sub&&<p style={{fontSize:11,color:'var(--st)',marginTop:3}}>{sub}</p>}
  </div>
);
const Modal=({show,onClose,title,children,wide=false})=>{
  if(!show)return null;
  return(
    <div className="mo fade-in" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="md" style={{maxWidth:wide?700:440}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
          <h3 style={{fontSize:17,fontWeight:700}}>{title}</h3>
          <button onClick={onClose} style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:8,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--st)'}}><I n="x" s={14}/></button>
        </div>
        {children}
      </div>
    </div>
  );
};

class AppErrorBoundary extends Component{
  constructor(props){
    super(props);
    this.state={error:null};
  }
  static getDerivedStateFromError(error){
    return{error};
  }
  componentDidCatch(error,info){
    console.error('App render error',error,info);
  }
  render(){
    if(this.state.error){
      return(
        <div style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#07090f',padding:20,color:'#E5E7EB'}}>
          <div style={{maxWidth:720,width:'100%',background:'rgba(17,24,39,.92)',border:'1px solid rgba(239,68,68,.25)',borderRadius:14,padding:18}}>
            <h2 style={{fontSize:20,fontWeight:800,marginBottom:8,color:'#FCA5A5'}}>Screen Error</h2>
            <p style={{fontSize:13,color:'#CBD5E1',marginBottom:10}}>A runtime error occurred after login. Please share this message so it can be fixed quickly.</p>
            <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:12,lineHeight:1.45,background:'rgba(0,0,0,.25)',borderRadius:8,padding:12,margin:0}}>{String(this.state.error?.stack||this.state.error?.message||this.state.error)}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── LOGIN ── */
const Login=({onLogin,loginConfigured,authMode='demo'})=>{
  const [u,setU]=useState('');
  const [p,setP]=useState('');
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const submit=async()=>{
    if(busy) return;
    if(!loginConfigured){
      setErr(authMode==='backend'
        ? 'Backend login not configured. Set VITE_API_BASE_URL (and optional VITE_BACKEND_ORG_CODE).'
        : 'Login not configured. Set VITE_DEMO_USERNAME and VITE_DEMO_PASSWORD.');
      return;
    }
    setBusy(true);
    try{
      const ok=await onLogin(u,p);
      if(!ok) setErr('Invalid credentials.');
      else setErr('');
    }catch(e){
      setErr(e?.message||'Login failed.');
    }finally{
      setBusy(false);
    }
  };
  return(
    <div className="lbg fade-in" style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
      <div style={{width:'100%',maxWidth:400}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{width:54,height:54,background:'linear-gradient(135deg,#C9A84C,#8B6020)',borderRadius:15,display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>
            <I n="wallet" s={24}/>
          </div>
          <h1 className="gold-text" style={{fontSize:26,fontWeight:800}}>Yash Portfolio</h1>
          <p style={{color:'var(--st)',fontSize:13,marginTop:3}}>Secure Financial Management System</p>
        </div>
        <div className="card" style={{padding:28}}>
          {!loginConfigured&&<div style={{background:'rgba(251,191,36,.08)',border:'1px solid rgba(251,191,36,.22)',borderRadius:8,padding:'10px 12px',color:'var(--yellow)',fontSize:12,lineHeight:1.4,marginBottom:14}}>{authMode==='backend'?'Backend API login is disabled until VITE_API_BASE_URL is configured.':'Demo login is disabled until environment credentials are configured.'}</div>}
          {authMode==='backend'&&loginConfigured&&<div style={{background:'rgba(96,165,250,.08)',border:'1px solid rgba(96,165,250,.22)',borderRadius:8,padding:'9px 12px',color:'var(--blue)',fontSize:12,lineHeight:1.4,marginBottom:14}}>Backend Login Mode {BACKEND_ORG_CODE?`• Org: ${BACKEND_ORG_CODE}`:''}</div>}
          <div style={{marginBottom:14}}><span className="lbl">{authMode==='backend'?'Email':'Username'}</span><input className="inp" value={u} onChange={e=>setU(e.target.value)} placeholder={authMode==='backend'?'Enter email':'Enter username'} autoFocus disabled={busy}/></div>
          <div style={{marginBottom:16}}><span className="lbl">Password</span><input className="inp" type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="Enter password" disabled={busy} onKeyDown={e=>e.key==='Enter'&&submit()}/></div>
          {err&&<div style={{background:'rgba(255,107,107,.1)',border:'1px solid rgba(255,107,107,.25)',borderRadius:8,padding:'9px 13px',color:'var(--red)',fontSize:13,textAlign:'center',marginBottom:14}}>{err}</div>}
          <button className="bg" style={{width:'100%',justifyContent:'center',fontSize:14,padding:'12px',opacity:busy?0.85:1}} onClick={submit} disabled={busy}>{busy?'Signing In...':'Access System'}</button>
        </div>
        <p style={{textAlign:'center',fontSize:11,color:'var(--ob4)',marginTop:18}}>AUTHORIZED PERSONNEL ONLY • v5.0</p>
      </div>
    </div>
  );
};

/* ══════════════ MAIN APP ══════════════ */
function App(){
  const[loggedIn,setLoggedIn]=useState(false);
  const[view,setView]=useState('DASHBOARD');

  const[ob,setOb]=useState(0);
  const[transactions,setTransactions]=useState([]);
  const[loans,setLoans]=useState([]);
  const[clientProfiles,setClientProfiles]=useState({});

  const[newLoan,setNL]=useState({clientName:'',clientPhone:'',kycRef:'',purpose:'',notes:'',principal:100000,interest:20000,duration:10,freq:'MONTHLY',startDate:ts()});
  const[newExp,setNE]=useState({desc:'',amount:'',category:'Other Indirect Expenses'});
  const[capAmt,setCapAmt]=useState('');
  const[showCap,setShowCap]=useState(false);
  const[collect,setCollect]=useState(blankCollect);
  const[cSearch,setCSearch]=useState('');
  const[dbDate,setDbDate]=useState(ts());
  const[repMonth,setRepMonth]=useState(new Date().toISOString().slice(0,7));
  const[reportTieUpFilter,setReportTieUpFilter]=useState('ALL');
  const[cDetail,setCDetail]=useState(null);
  const[showSetup,setShowSetup]=useState(false);
  const[setupBal,setSetupBal]=useState('');
  const[calDate,setCalDate]=useState(new Date());
  const[calDay,setCalDay]=useState(null);
  const[showSms,setShowSms]=useState(false);
  const[closeLoan,setCloseLoan]=useState(null);
  const[txFilter,setTxFilter]=useState('ALL');
  const[txSearch,setTxSearch]=useState('');
  const[colPendingFilter,setColPendingFilter]=useState('ALL');
  const[editProfile,setEditProfile]=useState(null);
  const[tdsByClientId,setTdsByClientId]=useState({});
  const[tdsMetaByClientId,setTdsMetaByClientId]=useState({});
  const[tdsForm,setTdsForm]=useState({entryScope:'CLIENT',deductionDate:ts(),periodMonth:new Date().toISOString().slice(0,7),grossEmiAmount:'',cashReceivedAmount:'',tdsRatePercent:'',tdsAmount:'',receiptStatus:'PENDING',receivedDate:ts(),collectionId:'',loanId:'',certificateRef:'',sourceType:'CLIENT_COLLECTION',tieUpPartnerName:'',notes:''});
  const[tdsBusy,setTdsBusy]=useState(false);
  const[backendAuth,setBackendAuth]=useState(null);
  const[backendDash,setBackendDash]=useState({loading:false,error:'',summary:null,risk:null,lastFetchedAt:null});
  const[backendReports,setBackendReports]=useState({loading:false,error:'',pnl:null,efficiency:null,clientArrears:null,dayBook:null,topCollections:null,expenseMix:null,ledgerSummary:null,lastFetchedAt:null});
  const[backendTdsFollowup,setBackendTdsFollowup]=useState({loading:false,error:'',items:[],summary:null,lastFetchedAt:null});
  const[disburseBusy,setDisburseBusy]=useState(false);
  const isBackendSession=!!(BACKEND_API_ENABLED&&backendAuth?.accessToken&&backendAuth?.organization?.id);
  const fileRef=useRef(null);
  const backendRefreshPromiseRef=useRef(null);
  const disburseInFlightRef=useRef(false);

  useEffect(()=>{
    try{
      const raw=sessionStorage.getItem(BACKEND_SESSION_KEY);
      if(raw&&BACKEND_API_ENABLED){
        const sess=JSON.parse(raw);
        if(sess?.accessToken&&sess?.organization?.id){
          setBackendAuth(sess);
          setLoggedIn(true);
        }
      }else if(sessionStorage.getItem('ypm_auth')==='1'){
        setLoggedIn(true);
      }
    }catch(_){
      if(sessionStorage.getItem('ypm_auth')==='1') setLoggedIn(true);
    }
    try{
      const d=JSON.parse(localStorage.getItem('ypm_v4')||'{}');
      if(d.openingBalance!==undefined) setOb(d.openingBalance);
      if(d.transactions) setTransactions(d.transactions);
      if(d.loans) setLoans(d.loans);
      if(d.clientProfiles&&typeof d.clientProfiles==='object') setClientProfiles(d.clientProfiles);
      else if(Array.isArray(d.loans)&&d.loans.length){
        const migrated={};
        d.loans.forEach(l=>{
          if(!l?.client) return;
          const curr=migrated[l.client]||blankProfile(l.client);
          migrated[l.client]={
            ...curr,
            name:l.client,
            phone:curr.phone||l.clientPhone||'',
            kycRef:curr.kycRef||l.kycRef||'',
            notes:curr.notes||l.notes||'',
          };
        });
        setClientProfiles(migrated);
      }
      if(d.openingBalance===undefined&&!d.transactions?.length) setShowSetup(true);
    }catch(_){}
  },[]);

  const save=(o,t,l,cp)=>{
    const data={
      schemaVersion:5,
      updatedAt:new Date().toISOString(),
      openingBalance:o!==undefined?o:ob,
      transactions:t!==undefined?t:transactions,
      loans:l!==undefined?l:loans,
      clientProfiles:cp!==undefined?cp:clientProfiles,
    };
    if(!isBackendSession) localStorage.setItem('ypm_v4',JSON.stringify(data));
    if(o!==undefined) setOb(o);
    if(t!==undefined) setTransactions(t);
    if(l!==undefined) setLoans(l);
    if(cp!==undefined) setClientProfiles(cp);
  };

  const refreshBackendAccessToken=async()=>{
    if(!BACKEND_API_ENABLED) throw new Error('Backend API not configured');
    if(backendRefreshPromiseRef.current) return backendRefreshPromiseRef.current;
    const refreshToken=backendAuth?.refreshToken;
    const org=backendAuth?.organization||null;
    if(!refreshToken||!org?.id) throw new Error('Session expired. Please login again.');
    backendRefreshPromiseRef.current=(async()=>{
      const res=await fetch(`${BACKEND_API_BASE}/api/v1/auth/refresh`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({refreshToken}),
      });
      let data=null;
      try{data=await res.json();}catch(_){}
      if(!res.ok){
        sessionStorage.removeItem(BACKEND_SESSION_KEY);
        setBackendAuth(null);
        setLoggedIn(false);
        throw new Error(data?.error?.message||'Session expired. Please login again.');
      }
      const nextSession={
        ...backendAuth,
        accessToken:data.accessToken,
        refreshToken:data.refreshToken||refreshToken,
      };
      sessionStorage.setItem(BACKEND_SESSION_KEY,JSON.stringify(nextSession));
      setBackendAuth(nextSession);
      return nextSession;
    })();
    try{
      return await backendRefreshPromiseRef.current;
    }finally{
      backendRefreshPromiseRef.current=null;
    }
  };

  const backendApiFetch=async(path,{method='GET',body,token,orgId,headers={},_retryAfterRefresh=true}={})=>{
    if(!BACKEND_API_ENABLED) throw new Error('Backend API not configured');
    const res=await fetch(`${BACKEND_API_BASE}${path}`,{
      method,
      headers:{
        'Content-Type':'application/json',
        ...(token?{Authorization:`Bearer ${token}`}:{})
        ,...(orgId?{'X-Org-Id':orgId}:{})
        ,...headers,
      },
      body:body!==undefined?JSON.stringify(body):undefined,
    });
    if(res.status===204) return null;
    let data=null;
    try{data=await res.json();}catch(_){}
    if(!res.ok){
      if(
        _retryAfterRefresh&&token&&res.status===401&&
        !String(path).includes('/api/v1/auth/login')&&
        !String(path).includes('/api/v1/auth/refresh')
      ){
        const code=String(data?.error?.code||'');
        if(code==='INVALID_ACCESS_TOKEN'||/expired|invalid/i.test(String(data?.error?.message||''))){
          const nextSession=await refreshBackendAccessToken();
          return backendApiFetch(path,{
            method,body,
            token:nextSession.accessToken,
            orgId:orgId||nextSession.organization?.id,
            headers,
            _retryAfterRefresh:false,
          });
        }
      }
      const msg=data?.error?.message||`Request failed (${res.status})`;
      throw new Error(msg);
    }
    return data;
  };

  const backendFetchAll=async(path,{token,orgId,query={}}={})=>{
    const items=[];
    let page=1;
    let total=0;
    while(true){
      const sp=new URLSearchParams();
      Object.entries(query||{}).forEach(([k,v])=>{
        if(v===undefined||v===null||v==='') return;
        sp.set(k,String(v));
      });
      sp.set('page',String(page));
      sp.set('pageSize','100');
      const data=await backendApiFetch(`${path}?${sp.toString()}`,{token,orgId});
      const pageItems=Array.isArray(data?.items)?data.items:[];
      items.push(...pageItems);
      total=Math.max(total,Number(data?.total||0));
      if(!pageItems.length) break;
      if(total&&items.length>=total) break;
      page+=1;
      if(page>200) break;
    }
    return items;
  };

  const refreshBackendSnapshot=async(sessionOverride)=>{
    const sess=sessionOverride||backendAuth;
    const token=sess?.accessToken;
    const orgId=sess?.organization?.id;
    if(!BACKEND_API_ENABLED||!token||!orgId) return;

    const [clientsRaw,loansRaw,instRaw,collectionsRaw,ledgerRaw]=await Promise.all([
      backendFetchAll('/api/v1/clients',{token,orgId,query:{active:true}}),
      backendFetchAll('/api/v1/loans',{token,orgId}),
      backendFetchAll('/api/v1/installments',{token,orgId}),
      backendFetchAll('/api/v1/collections',{token,orgId}),
      backendFetchAll('/api/v1/ledger',{token,orgId}),
    ]);

    const parseObj=v=>{
      if(!v) return {};
      if(typeof v==='object'&&!Array.isArray(v)) return v;
      try{
        const p=JSON.parse(v);
        return p&&typeof p==='object'&&!Array.isArray(p)?p:{};
      }catch{
        return {};
      }
    };
    const mapLoanStatus=s=>{
      if(String(s).toUpperCase()==='ACTIVE') return 'Active';
      if(String(s).toUpperCase()==='CLOSED') return 'Closed';
      return String(s||'').toLowerCase().replace(/\b\w/g,ch=>ch.toUpperCase());
    };
    const mapInstStatus=s=>{
      const v=String(s||'').toUpperCase();
      if(v==='PENDING') return 'Pending';
      if(v==='PARTIAL') return 'Partial';
      if(v==='PAID') return 'Paid';
      if(v==='BAD_DEBT') return 'Bad Debt';
      if(v==='CLOSED') return 'Closed';
      return String(s||'');
    };

    const clientById={};
    const nextProfiles={};
    clientsRaw.forEach(c=>{
      if(!c?.id||!c?.name) return;
      clientById[c.id]=c;
      nextProfiles[c.name]={
        ...blankProfile(c.name),
        name:c.name,
        phone:c.phone||'',
        kycRef:c.kyc_ref||'',
        riskGrade:(c.risk_grade||'STANDARD').toUpperCase(),
        notes:c.notes||'',
        address:c.address_line||'',
        fundingChannel:(c.funding_channel||'DIRECT').toUpperCase(),
        tieUpPartnerName:c.tie_up_partner_name||'',
        backendId:c.id,
        clientCode:c.client_code||'',
        isActive:c.is_active,
      };
    });

    const collectionsById={};
    collectionsRaw.forEach(c=>{ if(c?.id) collectionsById[c.id]=c; });

    const instByLoan={};
    instRaw.forEach(i=>{
      if(!i?.loan_id) return;
      (instByLoan[i.loan_id]||(instByLoan[i.loan_id]=[])).push(i);
    });

    Object.values(instByLoan).forEach(arr=>arr.sort((a,b)=>(a.installment_no-b.installment_no)||new Date(a.due_date)-new Date(b.due_date)));

    const mappedLoans=loansRaw.map(l=>{
      const c=clientById[l.client_id]||{};
      const schedule=(instByLoan[l.id]||[]).map(i=>{
        const meta=parseObj(i.metadata);
        return{
          id:i.id,
          no:i.installment_no,
          date:i.due_date||i.dueDate,
          payment:toNum(i.scheduled_amount),
          principalDue:toNum(meta.principal_due),
          interestDue:toNum(meta.interest_due),
          principalPaid:toNum(meta.principal_paid),
          interestPaid:toNum(meta.interest_paid),
          paid:toNum(i.paid_amount),
          paidDate:i.paid_at||null,
          status:mapInstStatus(i.status),
        };
      });
      return{
        id:l.id,
        loanNumber:l.loan_number,
        client:l.client_name||c.name||'Unknown',
        clientId:l.client_id,
        clientPhone:c.phone||'',
        kycRef:c.kyc_ref||'',
        purpose:l.purpose||'',
        notes:l.loan_notes||'',
        principal:toNum(l.principal_amount),
        interest:toNum(l.interest_amount),
        total:toNum(l.total_amount)||toNum(l.principal_amount)+toNum(l.interest_amount),
        effectiveRate:Number.isFinite(+l.effective_rate_percent)?+l.effective_rate_percent:calcRate(l.principal_amount,l.interest_amount,l.frequency_code,l.installment_count),
        startDate:(l.first_due_date||l.disbursed_at||ts()),
        freq:(l.frequency_code||'MONTHLY').toUpperCase(),
        schedule,
        status:mapLoanStatus(l.status),
        disbursedAt:l.disbursed_at||null,
        closedDate:l.closed_at||null,
      };
    });

    const mappedTx=ledgerRaw
      .map(le=>{
        const col=le.collection_id?collectionsById[le.collection_id]:null;
        return{
          id:le.id,
          date:le.entry_time||le.created_at||new Date().toISOString(),
          desc:le.description||'',
          type:String(le.tx_type||'').toUpperCase()==='CREDIT'?'CREDIT':'DEBIT',
          amount:toNum(le.amount),
          tag:String(le.tag||'').toUpperCase(),
          relatedId:le.loan_id||null,
          category:le.category||null,
          ...(col?{
            principalComponent:col.principal_component==null?undefined:toNum(col.principal_component),
            interestComponent:col.interest_component==null?undefined:toNum(col.interest_component),
            splitMethod:col.split_method||undefined,
          }:{}),
        };
      })
      .sort((a,b)=>new Date(a.date)-new Date(b.date));

    setShowSetup(false);
    setOb(0);
    setTransactions(mappedTx);
    setLoans(mappedLoans);
    setClientProfiles(nextProfiles);
  };

  const handleLogin=async(u,p)=>{
    if(BACKEND_API_ENABLED){
      const email=String(u||'').trim();
      const password=String(p||'');
      if(!email||!password) return false;
      const payload={email,password};
      if(BACKEND_ORG_CODE) payload.organizationCode=BACKEND_ORG_CODE;
      const data=await backendApiFetch('/api/v1/auth/login',{method:'POST',body:payload});
      const session={
        accessToken:data.accessToken,
        refreshToken:data.refreshToken,
        user:data.user,
        organization:data.organization,
      };
      sessionStorage.setItem(BACKEND_SESSION_KEY,JSON.stringify(session));
      sessionStorage.removeItem('ypm_auth');
      setBackendAuth(session);
      setLoggedIn(true);
      return true;
    }
    if(!DEMO_LOGIN_ENABLED) return false;
    if(u===DEMO_LOGIN_USER&&p===DEMO_LOGIN_PASS){
      sessionStorage.setItem('ypm_auth','1');
      sessionStorage.removeItem(BACKEND_SESSION_KEY);
      setBackendAuth(null);
      setLoggedIn(true);
      return true;
    }
    return false;
  };
  const handleLogout=()=>{
    sessionStorage.removeItem('ypm_auth');
    sessionStorage.removeItem(BACKEND_SESSION_KEY);
    setBackendAuth(null);
    setBackendDash({loading:false,error:'',summary:null,risk:null,lastFetchedAt:null});
    setLoggedIn(false);
  };

  useEffect(()=>{
    let cancel=false;
    if(!loggedIn||!BACKEND_API_ENABLED||!backendAuth?.accessToken||!backendAuth?.organization?.id){
      setBackendDash(prev=>prev.summary||prev.risk||prev.error?{loading:false,error:'',summary:null,risk:null,lastFetchedAt:null}:prev);
      return()=>{};
    }
    setBackendDash(prev=>({...prev,loading:true,error:''}));
    (async()=>{
      try{
        const [summary,risk]=await Promise.all([
          backendApiFetch('/api/v1/dashboard/summary',{token:backendAuth.accessToken,orgId:backendAuth.organization.id}),
          backendApiFetch('/api/v1/dashboard/risk',{token:backendAuth.accessToken,orgId:backendAuth.organization.id}),
        ]);
        if(cancel) return;
        setBackendDash({loading:false,error:'',summary,risk,lastFetchedAt:new Date().toISOString()});
      }catch(e){
        if(cancel) return;
        setBackendDash(prev=>({...prev,loading:false,error:e?.message||'Failed to load backend dashboard'}));
      }
    })();
    return()=>{cancel=true;};
  },[loggedIn,backendAuth?.accessToken,backendAuth?.organization?.id]);

  useEffect(()=>{
    let cancel=false;
    if(!loggedIn||!isBackendSession) return()=>{};
    (async()=>{
      try{
        await refreshBackendSnapshot();
      }catch(e){
        if(cancel) return;
        console.error('Backend snapshot sync failed',e);
      }
    })();
    return()=>{cancel=true;};
  },[loggedIn,isBackendSession,backendAuth?.accessToken,backendAuth?.organization?.id]);

  useEffect(()=>{
    let cancel=false;
    if(!loggedIn||!isBackendSession){
      setBackendReports(prev=>prev.pnl||prev.efficiency||prev.clientArrears||prev.dayBook||prev.topCollections||prev.expenseMix||prev.ledgerSummary||prev.error?{loading:false,error:'',pnl:null,efficiency:null,clientArrears:null,dayBook:null,topCollections:null,expenseMix:null,ledgerSummary:null,lastFetchedAt:null}:prev);
      return()=>{};
    }
    setBackendReports(prev=>({...prev,loading:true,error:''}));
    (async()=>{
      try{
        const token=backendAuth.accessToken;
        const orgId=backendAuth.organization.id;
        const [pnl,efficiency,clientArrears,dayBook,topCollections,expenseMix,ledgerSummary]=await Promise.all([
          backendApiFetch(`/api/v1/reports/pnl?month=${encodeURIComponent(repMonth)}`,{token,orgId}),
          backendApiFetch(`/api/v1/reports/collections-efficiency?month=${encodeURIComponent(repMonth)}`,{token,orgId}),
          backendFetchAll('/api/v1/reports/client-arrears',{token,orgId}),
          backendApiFetch(`/api/v1/ledger/day-book?date=${encodeURIComponent(dbDate)}`,{token,orgId}),
          backendApiFetch(`/api/v1/reports/top-collections?month=${encodeURIComponent(repMonth)}&limit=10`,{token,orgId}),
          backendApiFetch(`/api/v1/reports/expense-mix?month=${encodeURIComponent(repMonth)}&limit=10`,{token,orgId}),
          backendApiFetch(`/api/v1/reports/monthly-ledger-summary?month=${encodeURIComponent(repMonth)}`,{token,orgId}),
        ]);
        if(cancel) return;
        setBackendReports({loading:false,error:'',pnl,efficiency,clientArrears,dayBook,topCollections,expenseMix,ledgerSummary,lastFetchedAt:new Date().toISOString()});
      }catch(e){
        if(cancel) return;
        setBackendReports(prev=>({...prev,loading:false,error:e?.message||'Failed to load report APIs'}));
      }
    })();
    return()=>{cancel=true;};
  },[loggedIn,isBackendSession,backendAuth?.accessToken,backendAuth?.organization?.id,repMonth,dbDate]);

  useEffect(()=>{
    let cancel=false;
    if(!loggedIn||!isBackendSession){
      setBackendTdsFollowup(prev=>(prev.items.length||prev.error||prev.summary)?{loading:false,error:'',items:[],summary:null,lastFetchedAt:null}:prev);
      return()=>{};
    }
    setBackendTdsFollowup(prev=>({...prev,loading:true,error:''}));
    (async()=>{
      try{
        const token=backendAuth.accessToken;
        const orgId=backendAuth.organization.id;
        const pending=await backendApiFetch(`/api/v1/tds?periodMonth=${encodeURIComponent(repMonth)}&status=PENDING&page=1&pageSize=500`,{token,orgId});
        if(cancel) return;
        setBackendTdsFollowup({
          loading:false,
          error:'',
          items:Array.isArray(pending?.items)?pending.items:[],
          summary:pending?.summary||null,
          lastFetchedAt:new Date().toISOString(),
        });
      }catch(e){
        if(cancel) return;
        setBackendTdsFollowup(prev=>({...prev,loading:false,error:e?.message||'Failed to load TDS follow-up'}));
      }
    })();
    return()=>{cancel=true;};
  },[loggedIn,isBackendSession,backendAuth?.accessToken,backendAuth?.organization?.id,repMonth]);

  const expData=()=>{
    if(isBackendSession) return alert('Local backup export is disabled in backend mode.');
    const blob=new Blob([localStorage.getItem('ypm_v4')||'{}'],{type:'application/json'});
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:`yash_backup_${ts()}.json`}).click();
  };
  const impData=e=>{
    if(isBackendSession){alert('Local backup import is disabled in backend mode.');e.target.value='';return;}
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        const valid=d&&(Array.isArray(d.transactions)||Array.isArray(d.loans)||d.openingBalance!==undefined);
        if(!valid) return alert('Invalid file');
        const normalized={
          ...d,
          schemaVersion:d.schemaVersion||5,
          updatedAt:new Date().toISOString(),
          clientProfiles:d.clientProfiles&&typeof d.clientProfiles==='object'?d.clientProfiles:{},
        };
        localStorage.setItem('ypm_v4',JSON.stringify(normalized));
        window.location.reload();
      }catch{
        alert('Read error');
      }
    };
    r.readAsText(f);
  };
  const expCSV=()=>{
    const rows=[['Date','Description','Type','Tag','Amount','Category']];
    transactions.forEach(t=>rows.push([fd(t.date),t.desc,t.type,t.tag,t.amount,t.category||'']));
    const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:`yash_tx_${ts()}.csv`}).click();
  };

  /* ── COMPUTED ── */
  const bal=useMemo(()=>{let b=ob;transactions.forEach(t=>t.type==='CREDIT'?b+=t.amount:b-=t.amount);return b;},[ob,transactions]);

  const stats=useMemo(()=>{
    const totalCap=ob+transactions.filter(t=>t.tag==='CAPITAL').reduce((a,t)=>a+t.amount,0);
    const revenue=transactions.filter(t=>t.tag==='COLLECTION').reduce((a,t)=>a+t.amount,0);
    const expenses=transactions.filter(t=>t.tag==='EXPENSE').reduce((a,t)=>a+t.amount,0);
    const bad=transactions.filter(t=>t.tag==='BAD_DEBT').reduce((a,t)=>a+t.amount,0);
    let recv=0;
    const aging={'0-30':0,'31-60':0,'61-90':0,'90+':0};
    const now=new Date();
    const todayStart=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const next7End=new Date(now.getFullYear(),now.getMonth(),now.getDate()+6,23,59,59,999);
    const monthStart=new Date(now.getFullYear(),now.getMonth(),1);
    const monthEnd=new Date(now.getFullYear(),now.getMonth()+1,0,23,59,59,999);
    const overdueList=[];
    const dueTodayList=[];
    const overdueByClient={};
    const todayDate=ts();
    let monthDemand=0;
    let monthScheduledCollected=0;
    let dueThisMonthCount=0;
    let paidThisMonthCount=0;
    let next7Due=0;
    loans.forEach(l=>{
      l.schedule.forEach((p,idx)=>{
        const pDate=new Date(p.date);
        const paidAmt=Math.min(p.payment,p.paid||0);
        if(pDate>=monthStart&&pDate<=monthEnd){
          monthDemand+=p.payment;
          monthScheduledCollected+=paidAmt;
          dueThisMonthCount++;
          if((p.status==='Paid')||(p.paid||0)>=p.payment) paidThisMonthCount++;
        }
        if(l.status!=='Active') return;
        if(p.status==='Pending'||p.status==='Partial'){
          const due=p.payment-(p.paid||0);
          recv+=due;
          const diff=Math.ceil((now-new Date(p.date))/86400000);
          if(diff>90) aging['90+']+=due;
          else if(diff>60) aging['61-90']+=due;
          else if(diff>30) aging['31-60']+=due;
          else if(diff>0) aging['0-30']+=due;
          if(pDate>=todayStart&&pDate<=next7End) next7Due+=due;
          if(p.date.startsWith(todayDate)) dueTodayList.push({loanId:l.id,client:l.client,clientPhone:l.clientPhone||'',date:p.date,due,idx});
          else if(pDate<now){
            overdueList.push({loanId:l.id,client:l.client,clientPhone:l.clientPhone||'',date:p.date,due,idx,daysLate:Math.max(diff,1)});
            overdueByClient[l.client]=(overdueByClient[l.client]||0)+due;
          }
        }
      });
    });
    const loanMapById={};loans.forEach(l=>{loanMapById[l.id]=l;});
    const interestIncome=transactions.filter(t=>t.tag==='COLLECTION').reduce((a,t)=>a+getTxInterestComponent(t,loanMapById[t.relatedId]),0);
    const activeLoanList=loans.filter(l=>l.status==='Active');
    const activePrincipalBase=activeLoanList.reduce((a,l)=>a+(+l.principal||0),0);
    const avgInterestRate=activePrincipalBase
      ? activeLoanList.reduce((a,l)=>{
          const rate=Number.isFinite(+l.effectiveRate)?+l.effectiveRate:calcRate(l.principal,l.interest,l.freq,l.schedule?.length||0);
          return a+(rate*(+l.principal||0));
        },0)/activePrincipalBase
      : 0;
    const overdueAmt=Object.values(aging).reduce((a,v)=>a+v,0);
    const par30Amt=aging['31-60']+aging['61-90']+aging['90+'];
    return{
      totalCap,revenue,totalExp:expenses+bad,recv,aging,interestIncome,netProfit:interestIncome-expenses-bad,
      activeLoans:loans.filter(l=>l.status==='Active').length,
      closedLoans:loans.filter(l=>l.status==='Closed').length,
      totalDisbursed:transactions.filter(t=>t.tag==='LENDING').reduce((a,t)=>a+t.amount,0),
      overdueAmt,
      overdueRatio:recv?overdueAmt/recv*100:0,
      par30Amt,
      par30Ratio:recv?par30Amt/recv*100:0,
      monthDemand,
      monthScheduledCollected,
      collectionEfficiency:monthDemand?monthScheduledCollected/monthDemand*100:0,
      dueThisMonthCount,
      paidThisMonthCount,
      next7Due,
      avgInterestRate,
      topOverdueClients:Object.entries(overdueByClient).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([client,amount])=>({client,amount})),
      overdueList,dueTodayList,
    };
  },[loans,transactions,ob]);

  const cashflow=useMemo(()=>{
    const arr=[];
    for(let i=5;i>=0;i--){
      const d=new Date();d.setMonth(d.getMonth()-i);
      const s=new Date(d.getFullYear(),d.getMonth(),1);
      const e=new Date(d.getFullYear(),d.getMonth()+1,0);
      const mt=transactions.filter(t=>{const td=new Date(t.date);return td>=s&&td<=e;});
      arr.push({label:d.toLocaleString('default',{month:'short',year:'2-digit'}),inflow:mt.filter(t=>t.type==='CREDIT'&&t.tag==='COLLECTION').reduce((a,t)=>a+t.amount,0),outflow:mt.filter(t=>t.type==='DEBIT'&&t.tag!=='LENDING').reduce((a,t)=>a+t.amount,0)});
    }
    return arr;
  },[transactions]);

  const expBrk=useMemo(()=>{
    const m={};transactions.filter(t=>t.tag==='EXPENSE').forEach(t=>{m[t.category||'Other']=(m[t.category||'Other']||0)+t.amount;});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([l,v])=>({l,v}));
  },[transactions]);

  const dbTx=useMemo(()=>transactions.filter(t=>t.date&&t.date.startsWith(dbDate)),[transactions,dbDate]);

  const clientMap=useMemo(()=>{
    const m={};
    loans.forEach(l=>{
      const pf=clientProfiles[l.client]||blankProfile(l.client);
      if(!m[l.client]) m[l.client]={name:l.client,loans:[],totalP:0,totalI:0,totalDue:0,totalIP:0,totalColl:0,phone:pf.phone||l.clientPhone||'',kycRef:pf.kycRef||l.kycRef||'',address:pf.address||'',riskGrade:pf.riskGrade||'STANDARD',notes:pf.notes||l.notes||'',fundingChannel:pf.fundingChannel||'DIRECT',tieUpPartnerName:pf.tieUpPartnerName||'',lastLoanDate:l.startDate||null,backendId:pf.backendId||l.clientId||null};
      const c=m[l.client];
      c.backendId=c.backendId||pf.backendId||l.clientId||null;
      c.phone=c.phone||pf.phone||l.clientPhone||'';
      c.kycRef=c.kycRef||pf.kycRef||l.kycRef||'';
      c.address=c.address||pf.address||'';
      c.notes=c.notes||pf.notes||l.notes||'';
      c.riskGrade=pf.riskGrade||c.riskGrade||'STANDARD';
      c.fundingChannel=pf.fundingChannel||c.fundingChannel||'DIRECT';
      c.tieUpPartnerName=pf.tieUpPartnerName||c.tieUpPartnerName||'';
      if(l.startDate&&(!c.lastLoanDate||new Date(l.startDate)>new Date(c.lastLoanDate))) c.lastLoanDate=l.startDate;
      c.loans.push(l);c.totalP+=l.principal;c.totalI+=l.interest;
      const pt=l.schedule.reduce((a,p)=>a+(p.paid||0),0);
      c.totalColl+=pt;c.totalIP+=pt*(l.total?l.interest/l.total:0);
      l.schedule.forEach(p=>{if(p.status==='Pending'||p.status==='Partial') c.totalDue+=(p.payment-(p.paid||0));});
    });
    Object.values(clientProfiles).forEach(p=>{
      if(!p?.name) return;
      if(!m[p.name]) m[p.name]={name:p.name,loans:[],totalP:0,totalI:0,totalDue:0,totalIP:0,totalColl:0,phone:p.phone||'',kycRef:p.kycRef||'',address:p.address||'',riskGrade:p.riskGrade||'STANDARD',notes:p.notes||'',fundingChannel:p.fundingChannel||'DIRECT',tieUpPartnerName:p.tieUpPartnerName||'',lastLoanDate:null,backendId:p.backendId||null};
    });
    return Object.values(m)
      .filter(c=>{
        // In backend mode, Client Master should hide soft-deleted (inactive) clients even if historical loans still exist.
        if(isBackendSession&&c.backendId){
          const pf=clientProfiles[c.name];
          if(!pf?.backendId) return false;
          if(pf.isActive===false) return false;
        }
        return c.name.toLowerCase().includes(cSearch.toLowerCase())||(c.phone||'').includes(cSearch.trim())||(c.kycRef||'').toLowerCase().includes(cSearch.toLowerCase());
      })
      .sort((a,b)=>(b.totalDue-a.totalDue)||(b.totalP-a.totalP)||a.name.localeCompare(b.name));
  },[loans,cSearch,clientProfiles,isBackendSession]);

  const tieUpPartyOptions=useMemo(()=>(
    Array.from(new Set(
      Object.values(clientProfiles||{})
        .filter(p=>String(p?.fundingChannel||'DIRECT').toUpperCase()==='TIE_UP')
        .map(p=>String(p?.tieUpPartnerName||'').trim())
        .filter(Boolean)
    )).sort((a,b)=>a.localeCompare(b))
  ),[clientProfiles]);

  const collectionLoansView=useMemo(()=>{
    const now=new Date();
    const rows=loans
      .filter(l=>l.status==='Active')
      .map(loan=>{
        let overdueEmi=0;
        let arrearAmt=0;
        loan.schedule.forEach(p=>{
          if(p.status==='Pending'||p.status==='Partial'){
            const outstanding=Math.max(0,(p.payment||0)-(p.paid||0));
            if(outstanding>0){
              arrearAmt+=outstanding; // user-defined arrear = total receivable balance
              if(new Date(p.date)<now) overdueEmi++;
            }
          }
        });
        return{loan,overdueEmi,arrearAmt};
      });
    const counts={
      ALL:rows.length,
      CURRENT_PENDING:rows.filter(r=>r.overdueEmi>=1&&r.overdueEmi<=3).length,
      LONG_PENDING:rows.filter(r=>r.overdueEmi>=4).length,
    };
    const arrears={
      ALL:rows.reduce((a,r)=>a+r.arrearAmt,0),
      CURRENT_PENDING:rows.filter(r=>r.overdueEmi>=1&&r.overdueEmi<=3).reduce((a,r)=>a+r.arrearAmt,0),
      LONG_PENDING:rows.filter(r=>r.overdueEmi>=4).reduce((a,r)=>a+r.arrearAmt,0),
    };
    const visible=rows.filter(r=>{
      if(colPendingFilter==='CURRENT_PENDING') return r.overdueEmi>=1&&r.overdueEmi<=3;
      if(colPendingFilter==='LONG_PENDING') return r.overdueEmi>=4;
      return true;
    });
    const visibleArrear=visible.reduce((a,r)=>a+r.arrearAmt,0);
    return{counts,arrears,visible,visibleArrear};
  },[loans,colPendingFilter]);

  const clientArrearRows=useMemo(()=>{
    const now=new Date();
    const map={};
    loans.forEach(l=>{
      let countedActiveLoan=false;
      l.schedule.forEach(p=>{
        if(p.status!=='Pending'&&p.status!=='Partial') return;
        const outstanding=Math.max(0,(p.payment||0)-(p.paid||0));
        if(outstanding<=0) return;
        if(!map[l.client]) map[l.client]={client:l.client,activeLoans:0,totalReceivable:0,overdueEmiCount:0,pendingEmiCount:0};
        const row=map[l.client];
        row.totalReceivable+=outstanding;
        row.pendingEmiCount++;
        if(new Date(p.date)<now) row.overdueEmiCount++;
        if(l.status==='Active'&&!countedActiveLoan){
          row.activeLoans++;
          countedActiveLoan=true;
        }
      });
    });
    return Object.values(map)
      .sort((a,b)=>(b.totalReceivable-a.totalReceivable)||(b.overdueEmiCount-a.overdueEmiCount)||a.client.localeCompare(b.client));
  },[loans]);

  const calData=useMemo(()=>{
    const map={};
    const now=new Date();
    loans.filter(l=>l.status==='Active').forEach(l=>{
      l.schedule.forEach((p,idx)=>{
        const dk=p.date.slice(0,10);
        if(!map[dk]) map[dk]={payments:[],paid:[]};
        if(p.status==='Paid') map[dk].paid.push({client:l.client,amt:p.payment});
        else if(p.status==='Pending'||p.status==='Partial'){
          map[dk].payments.push({client:l.client,amt:p.payment-(p.paid||0),overdue:new Date(p.date)<now,loanId:l.id,idx});
        }
      });
    });
    return map;
  },[loans]);

  const filteredTx=useMemo(()=>{
    let tx=[...transactions].reverse();
    if(txFilter!=='ALL') tx=tx.filter(t=>t.tag===txFilter);
    if(txSearch) tx=tx.filter(t=>t.desc.toLowerCase().includes(txSearch.toLowerCase()));
    return tx;
  },[transactions,txFilter,txSearch]);

  const ovMsg=useMemo(()=>stats.overdueList.map(o=>{
    const pf=clientProfiles[o.client]||{};
    const phone=pf.phone||o.clientPhone||'';
    return{
      ...o,
      phone,
      msg:`Dear ${o.client}, your EMI of ${fc(o.due)} was due on ${fd(o.date)} (${o.daysLate} day${o.daysLate>1?'s':''} overdue). Please pay immediately. - Yash Finance`,
    };
  }),[stats.overdueList,clientProfiles]);

  const loadClientTds=async(clientId)=>{
    if(!isBackendSession||!clientId) return;
    setTdsBusy(true);
    try{
      const detail=clientMap.find(c=>c.backendId===clientId)||null;
      const isTieUp=String(detail?.fundingChannel||'DIRECT').toUpperCase()==='TIE_UP';
      const partner=(detail?.tieUpPartnerName||'').trim();
      const qs=isTieUp&&partner
        ? `/api/v1/tds?fundingChannel=TIE_UP&tieUpPartnerName=${encodeURIComponent(partner)}&page=1&pageSize=100`
        : `/api/v1/tds?clientId=${encodeURIComponent(clientId)}&page=1&pageSize=100`;
      const data=await backendApiFetch(qs,{
        token:backendAuth.accessToken,orgId:backendAuth.organization.id,
      });
      setTdsByClientId(prev=>({...prev,[clientId]:Array.isArray(data?.items)?data.items:[]}));
      setTdsMetaByClientId(prev=>({...prev,[clientId]:data?.summary||null}));
    }catch(e){
      setTdsMetaByClientId(prev=>({...prev,[clientId]:{error:e?.message||'TDS load failed'}}));
    }finally{
      setTdsBusy(false);
    }
  };
  const addTdsEntry=async(client)=>{
    if(!isBackendSession||!client?.backendId) return;
    try{
      const entryScope=tdsForm.entryScope||'CLIENT';
      const isTieUpMonthly=entryScope==='TIE_UP_PARTY_MONTHLY';
      const tieUpPartnerName=(tdsForm.tieUpPartnerName||client.tieUpPartnerName||'').trim();
      const body={
        clientId:isTieUpMonthly?null:client.backendId,
        loanId:isTieUpMonthly?null:(tdsForm.loanId||null),
        collectionId:isTieUpMonthly?null:(tdsForm.collectionId||null),
        deductionDate:tdsForm.deductionDate,
        periodMonth:tdsForm.periodMonth,
        grossEmiAmount:toNum(tdsForm.grossEmiAmount),
        cashReceivedAmount:toNum(tdsForm.cashReceivedAmount),
        tdsRatePercent:tdsForm.tdsRatePercent===''?null:toNum(tdsForm.tdsRatePercent),
        tdsAmount:toNum(tdsForm.tdsAmount),
        receiptStatus:tdsForm.receiptStatus,
        receivedDate:tdsForm.receiptStatus==='RECEIVED'?(tdsForm.receivedDate||tdsForm.deductionDate):null,
        certificateRef:(tdsForm.certificateRef||'').trim()||null,
        sourceType:isTieUpMonthly?'TIE_UP_SETTLEMENT':tdsForm.sourceType,
        fundingChannel:isTieUpMonthly?'TIE_UP':(client.fundingChannel||'DIRECT'),
        tieUpPartnerName:isTieUpMonthly?tieUpPartnerName:null,
        notes:(tdsForm.notes||'').trim()||null,
      };
      await backendApiFetch('/api/v1/tds',{
        method:'POST',
        token:backendAuth.accessToken,orgId:backendAuth.organization.id,
        body,
      });
      setTdsForm(f=>({...f,grossEmiAmount:'',cashReceivedAmount:'',tdsRatePercent:'',tdsAmount:'',collectionId:'',loanId:'',certificateRef:'',notes:'',receiptStatus:'PENDING',sourceType:'CLIENT_COLLECTION'}));
      await loadClientTds(client.backendId);
    }catch(e){
      alert(e?.message||'TDS save failed');
    }
  };
  const updateTdsStatus=async(clientId,tdsId,receiptStatus)=>{
    if(!isBackendSession||!clientId||!tdsId) return;
    try{
      await backendApiFetch(`/api/v1/tds/${tdsId}`,{
        method:'PATCH',
        token:backendAuth.accessToken,orgId:backendAuth.organization.id,
        body:{
          receiptStatus,
          receivedDate:receiptStatus==='RECEIVED'?ts():null,
        },
      });
      await loadClientTds(clientId);
    }catch(e){
      alert(e?.message||'TDS status update failed');
    }
  };
  /* ── ACTIONS ── */
  const pushTx=(desc,type,amount,tag,relatedId=null,category=null,extra={})=>[...transactions,{id:Date.now()+Math.random(),date:new Date().toISOString(),desc,type,amount,tag,relatedId,category,...extra}];
  const expReminderCSV=()=>{
    const rows=[['Client','Phone','Due Date','Overdue Days','Amount','Message']];
    ovMsg.forEach(o=>rows.push([o.client,o.phone||'',fd(o.date),o.daysLate,o.due,o.msg]));
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:`yash_overdue_reminders_${ts()}.csv`}).click();
  };
  const openProfileEditor=name=>{
    const loanSeed=loans.find(l=>l.client===name);
    const base=clientProfiles[name]||blankProfile(name);
    setEditProfile({
      ...blankProfile(name),
      ...base,
      name,
      backendId:base.backendId||loanSeed?.clientId||null,
      phone:base.phone||loanSeed?.clientPhone||'',
      kycRef:base.kycRef||loanSeed?.kycRef||'',
      notes:base.notes||loanSeed?.notes||'',
      fundingChannel:base.fundingChannel||'DIRECT',
      tieUpPartnerName:base.tieUpPartnerName||'',
    });
  };
  const saveProfileEdit=async()=>{
    if(!editProfile?.name?.trim()) return;
    const name=editProfile.name.trim();
    if(isBackendSession&&editProfile?.backendId){
      try{
        await backendApiFetch(`/api/v1/clients/${editProfile.backendId}`,{
          method:'PATCH',
          token:backendAuth.accessToken,
          orgId:backendAuth.organization.id,
          body:{
            phone:(editProfile.phone||'').trim()||null,
            kycRef:(editProfile.kycRef||'').trim()||null,
            addressLine:(editProfile.address||'').trim()||null,
            riskGrade:editProfile.riskGrade||'STANDARD',
            fundingChannel:editProfile.fundingChannel||'DIRECT',
            tieUpPartnerName:(editProfile.tieUpPartnerName||'').trim()||null,
            notes:(editProfile.notes||'').trim()||null,
          },
        });
        await refreshBackendSnapshot();
        setEditProfile(null);
      }catch(e){
        alert(e?.message||'Client profile update failed');
      }
      return;
    }
    const nextProfiles={
      ...clientProfiles,
      [name]:{
        ...blankProfile(name),
        ...(clientProfiles[name]||{}),
        ...editProfile,
        name,
        phone:(editProfile.phone||'').trim(),
        kycRef:(editProfile.kycRef||'').trim(),
        address:(editProfile.address||'').trim(),
        riskGrade:editProfile.riskGrade||'STANDARD',
        fundingChannel:editProfile.fundingChannel||'DIRECT',
        tieUpPartnerName:(editProfile.tieUpPartnerName||'').trim(),
        notes:(editProfile.notes||'').trim(),
      },
    };
    save(undefined,undefined,undefined,nextProfiles);
    setEditProfile(null);
  };
  const deleteClientRecord=(client)=>{
    if(!client?.name) return;
    if(isBackendSession){
      const backendId=client.backendId||clientProfiles[client.name]?.backendId||client.loans?.find(l=>l.clientId)?.clientId||null;
      if(!backendId) return alert('Backend client ID not found for this client.');
      (async()=>{
        try{
          const msg=`Delete client "${client.name}" permanently?\n\nThis will remove client + linked loans/installments/collections (trial cleanup). This cannot be undone.`;
          if(!window.confirm(msg)) return;
          await backendApiFetch(`/api/v1/clients/${backendId}/force`,{
            method:'DELETE',
            token:backendAuth.accessToken,
            orgId:backendAuth.organization.id,
          });
          if(cDetail===client.name) setCDetail(null);
          if(editProfile?.name===client.name) setEditProfile(null);
          await refreshBackendSnapshot();
        }catch(e){
          alert(e?.message||'Client delete failed');
        }
      })();
      return;
    }
    const loanIds=new Set((client.loans||[]).map(l=>l.id));
    const linkedTxCount=loanIds.size?transactions.filter(t=>loanIds.has(t.relatedId)).length:0;
    const hasLoans=loanIds.size>0;
    const msg=hasLoans
      ? `Delete client "${client.name}" and all linked data?\n\nThis will remove ${loanIds.size} loan(s) and ${linkedTxCount} related transaction(s) from this device.`
      : `Delete client "${client.name}" profile from this device?`;
    if(!window.confirm(msg)) return;

    const nextProfiles={...clientProfiles};
    delete nextProfiles[client.name];
    const nextLoans=hasLoans?loans.filter(l=>l.client!==client.name):loans;
    const nextTx=hasLoans?transactions.filter(t=>!loanIds.has(t.relatedId)):transactions;

    save(undefined,nextTx,nextLoans,nextProfiles);
    if(cDetail===client.name) setCDetail(null);
    if(editProfile?.name===client.name) setEditProfile(null);
  };

  const handleCap=async()=>{
    const amt=parseFloat(capAmt);if(!amt||amt<=0)return alert('Enter valid amount');
    if(isBackendSession){
      try{
        await backendApiFetch('/api/v1/ledger/manual',{
          method:'POST',
          token:backendAuth.accessToken,
          orgId:backendAuth.organization.id,
          body:{
            txType:'CREDIT',
            tag:'CAPITAL',
            description:'Capital Injection',
            amount:amt,
            entryTime:new Date().toISOString(),
            manualReference:`CAPITAL-${Date.now()}`,
          },
        });
        await refreshBackendSnapshot();
        setCapAmt('');
        setShowCap(false);
      }catch(e){
        alert(e?.message||'Capital entry failed');
      }
      return;
    }
    save(undefined,pushTx('Capital Injection','CREDIT',amt,'CAPITAL'));setCapAmt('');setShowCap(false);
  };
  const handleSetup=async()=>{
    const b=parseFloat(setupBal);if(isNaN(b))return alert('Enter valid amount');
    if(isBackendSession){
      try{
        await backendApiFetch('/api/v1/ledger/manual',{
          method:'POST',
          token:backendAuth.accessToken,
          orgId:backendAuth.organization.id,
          body:{
            txType:'CREDIT',
            tag:'CAPITAL',
            description:'Opening Balance Setup',
            amount:b,
            entryTime:new Date().toISOString(),
            manualReference:`OPENING_BALANCE-${Date.now()}`,
          },
        });
        await refreshBackendSnapshot();
        setShowSetup(false);
        setSetupBal('');
      }catch(e){
        alert(e?.message||'Opening balance setup failed');
      }
      return;
    }
    save(b);setShowSetup(false);
  };

  const handleDisburse=async()=>{
    if(disburseInFlightRef.current||disburseBusy) return;
    const clientName=newLoan.clientName.trim();
    if(!clientName)return alert('Client name required');
    const principal=parseFloat(newLoan.principal),interest=parseFloat(newLoan.interest),duration=parseInt(newLoan.duration,10);
    if(!principal||principal<=0) return alert('Invalid principal');
    if(isNaN(interest)||interest<0) return alert('Invalid interest');
    if(!duration||duration<=0) return alert('Invalid instalment count');
    if(!isBackendSession&&bal<principal)return alert('Insufficient balance');
    disburseInFlightRef.current=true;
    setDisburseBusy(true);
    try{
      if(isBackendSession){
        const norm=clientName.toLowerCase();
        let existingClient=Object.values(clientProfiles||{}).find(p=>String(p?.name||'').trim().toLowerCase()===norm&&p?.backendId);
        if(!existingClient){
          const created=await backendApiFetch('/api/v1/clients',{
            method:'POST',
            token:backendAuth.accessToken,
            orgId:backendAuth.organization.id,
            body:{name:clientName},
          });
          existingClient={name:created?.item?.name||clientName,backendId:created?.item?.id};
        }
        if(!existingClient?.backendId) throw new Error('Unable to resolve client for loan');
        await backendApiFetch('/api/v1/loans',{
          method:'POST',
          token:backendAuth.accessToken,
          orgId:backendAuth.organization.id,
          body:{
            clientId:existingClient.backendId,
            principalAmount:principal,
            interestAmount:interest,
            installmentCount:duration,
            frequencyCode:newLoan.freq,
            firstDueDate:newLoan.startDate,
            disbursedAt:new Date().toISOString(),
            disbursementMode:'CASH',
          },
        });
        await refreshBackendSnapshot();
        setNL({...newLoan,clientName:'',clientPhone:'',kycRef:'',purpose:'',notes:''});
        setView('COLLECTIONS');
        return;
      }
      const total=principal+interest,emi=total/duration,freq=newLoan.freq;
      const instPlan=buildInstallmentComponents(principal,interest,duration);
      const schedule=[];
      if(freq==='MONTHLY'){
        const sd=new Date(newLoan.startDate),startDay=sd.getDate();
        for(let i=0;i<duration;i++){
          const d=new Date(newLoan.startDate);
          d.setMonth(d.getMonth()+i);
          if(d.getDate()!==startDay) d.setDate(0);
          const comp=instPlan[i]||{payment:emi,principalDue:0,interestDue:0};
          schedule.push({no:i+1,date:d.toISOString(),payment:comp.payment,principalDue:comp.principalDue,interestDue:comp.interestDue,principalPaid:0,interestPaid:0,paid:0,status:'Pending'});
        }
      }else{
        let cur=new Date(newLoan.startDate);
        for(let i=0;i<duration;i++){
          const comp=instPlan[i]||{payment:emi,principalDue:0,interestDue:0};
          schedule.push({no:i+1,date:new Date(cur).toISOString(),payment:comp.payment,principalDue:comp.principalDue,interestDue:comp.interestDue,principalPaid:0,interestPaid:0,paid:0,status:'Pending'});
          cur.setDate(cur.getDate()+FREQ[freq].days);
        }
      }
      const loan={id:'LN'+Date.now(),client:clientName,clientPhone:(newLoan.clientPhone||'').trim(),kycRef:(newLoan.kycRef||'').trim(),purpose:(newLoan.purpose||'').trim(),notes:(newLoan.notes||'').trim(),principal,interest,total,effectiveRate:calcRate(principal,interest,freq,duration),startDate:newLoan.startDate,freq,schedule,status:'Active'};
      const baseProfile=clientProfiles[clientName]||blankProfile(clientName);
      const nextProfiles={
        ...clientProfiles,
        [clientName]:{
          ...blankProfile(clientName),
          ...baseProfile,
          name:clientName,
          phone:loan.clientPhone||baseProfile.phone||'',
          kycRef:loan.kycRef||baseProfile.kycRef||'',
          address:baseProfile.address||'',
          riskGrade:baseProfile.riskGrade||'STANDARD',
          notes:loan.notes||baseProfile.notes||'',
        },
      };
      save(undefined,pushTx(`Loan Disbursed — ${loan.client}`,'DEBIT',principal,'LENDING',loan.id),[loan,...loans],nextProfiles);
      setNL({...newLoan,clientName:'',clientPhone:'',kycRef:'',purpose:'',notes:''});setView('COLLECTIONS');
    }catch(e){
      alert(e?.message||'Loan disbursement failed');
    }finally{
      disburseInFlightRef.current=false;
      setDisburseBusy(false);
    }
  };

  const openCollect=(loanId,idx,full,client)=>setCollect({
    ...blankCollect(),
    show:true,loanId,idx,partAmt:'',fullAmt:full,client,
  });

  const submitCollect=async(partial=false,badDebt=false)=>{
    const{loanId,idx,fullAmt,partAmt}=collect;
    const amount=badDebt?0:(partial?parseFloat(partAmt):fullAmt);
    if(partial&&(amount<=0||amount>fullAmt))return alert('Invalid partial amount');
    const li=loans.findIndex(l=>l.id===loanId);
    if(li<0) return alert('Loan not found');
    if(isBackendSession){
      try{
        const loan=loans[li];
        const inst=loan?.schedule?.[idx];
        if(!loan?.clientId) return alert('Client mapping missing. Refresh and try again.');
        if(!inst?.id) return alert('Installment mapping missing. Refresh and try again.');
        const cashAmount=badDebt?0:toNum(amount);
        const isTdsShortReceipt=!!(!badDebt&&partial&&String(collect.shortReceiptReason||'PARTIAL').toUpperCase()==='TDS');
        const tdsAmount=isTdsShortReceipt?Math.max(0,toNum(collect.tdsAmt)):0;
        const grossAmount=isTdsShortReceipt?toNum(cashAmount+tdsAmount):toNum(badDebt?fullAmt:amount);
        const clientPf=clientProfiles[loan.client]||blankProfile(loan.client);
        const clientFundingChannel=String(clientPf.fundingChannel||'DIRECT').toUpperCase();
        const tieUpPartnerName=(clientPf.tieUpPartnerName||'').trim();
        const tdsDeducedBy=String(collect.tdsDeducedBy||'AUTO').toUpperCase();
        const tdsSourceType=isTdsShortReceipt
          ? ((tdsDeducedBy==='TIE_UP_PARTNER'||(tdsDeducedBy==='AUTO'&&clientFundingChannel==='TIE_UP'&&tieUpPartnerName))
            ? 'TIE_UP_SETTLEMENT'
            : 'CLIENT_COLLECTION')
          : null;
        const postAmount=grossAmount;
        if(!(postAmount>0)) return alert('Invalid collection amount');
        if(isTdsShortReceipt&&!(tdsAmount>0)) return alert('TDS short receipt must have TDS amount > 0');
        if(isTdsShortReceipt&&postAmount>toNum(fullAmt)) return alert('Cash + TDS cannot exceed installment due');
        if(isTdsShortReceipt&&tdsSourceType==='TIE_UP_SETTLEMENT'&&!tieUpPartnerName) return alert('Tie-up partner name missing for TDS mapping. Update client profile first.');
        await backendApiFetch('/api/v1/collections',{
          method:'POST',
          token:backendAuth.accessToken,
          orgId:backendAuth.organization.id,
          headers:{'Idempotency-Key':`web-col-${Date.now()}-${Math.random().toString(36).slice(2,8)}`},
          body:{
            loanId:loan.id,
            installmentId:inst.id,
            clientId:loan.clientId,
            amount:postAmount,
            cashReceivedAmount:isTdsShortReceipt?cashAmount:undefined,
            tdsDeductedAmount:isTdsShortReceipt?tdsAmount:undefined,
            tdsReceiptStatus:isTdsShortReceipt?(collect.tdsReceiptStatus||'PENDING'):undefined,
            tdsCertificateRef:isTdsShortReceipt?((collect.tdsCertificateRef||'').trim()||null):undefined,
            tdsSourceType:isTdsShortReceipt?tdsSourceType:undefined,
            tdsFundingChannel:isTdsShortReceipt?clientFundingChannel:undefined,
            tdsTieUpPartnerName:isTdsShortReceipt&&tdsSourceType==='TIE_UP_SETTLEMENT'?(tieUpPartnerName||null):undefined,
            tdsNotes:isTdsShortReceipt?((collect.tdsNotes||'').trim()||null):undefined,
            isWriteoff:!!badDebt,
            paymentMode:'CASH',
            collectionDate:new Date().toISOString(),
          },
        });
        await refreshBackendSnapshot();
        setCollect(blankCollect());
      }catch(e){
        alert(e?.message||'Collection posting failed');
      }
      return;
    }
    let postedSplit={principal:0,interest:0};
    const updated=loans.map((l,i)=>{
      if(i!==li)return l;
      const sched=[...l.schedule];
      const p=sched[idx];
      if(!p) return l;
      const np=(p.paid||0)+amount;
      const {principalDue,interestDue}=getScheduleItemSplitBase(l,p);
      const prevPrincipalPaid=Math.min(principalDue,toNum(p.principalPaid));
      const prevInterestPaid=Math.min(interestDue,toNum(p.interestPaid));
      const principalRemaining=Math.max(0,principalDue-prevPrincipalPaid);
      const interestRemaining=Math.max(0,interestDue-prevInterestPaid);
      let principalAlloc=0,interestAlloc=0;
      if(!badDebt){
        // Accounting policy for posted split: interest first, then principal.
        let left=toNum(amount);
        interestAlloc=Math.min(left,interestRemaining);left-=interestAlloc;
        principalAlloc=Math.min(left,principalRemaining);left-=principalAlloc;
        if(left>1e-6){
          const pAdj=Math.min(left,Math.max(0,principalRemaining-principalAlloc));principalAlloc+=pAdj;left-=pAdj;
          const iAdj=Math.min(left,Math.max(0,interestRemaining-interestAlloc));interestAlloc+=iAdj;left-=iAdj;
        }
        postedSplit={principal:principalAlloc,interest:interestAlloc};
      }
      sched[idx]={...p,principalDue,interestDue,principalPaid:prevPrincipalPaid+principalAlloc,interestPaid:prevInterestPaid+interestAlloc,paid:np,paidDate:new Date().toISOString(),status:badDebt?'Bad Debt':np<p.payment?'Partial':'Paid'};
      const allDone=sched.every(s=>s.status==='Paid'||s.status==='Bad Debt');
      return{...l,schedule:sched,status:allDone?'Closed':l.status};
    });
    let newTx=transactions;
    if(!badDebt) newTx=pushTx(`Collection — ${loans[li].client}`,'CREDIT',amount,'COLLECTION',loanId,null,{principalComponent:postedSplit.principal,interestComponent:postedSplit.interest,splitMethod:'INTEREST_FIRST_EMI_SPLIT'});
    else newTx=pushTx(`Write-off — ${loans[li].client}`,'DEBIT',fullAmt,'BAD_DEBT',loanId);
    save(undefined,newTx,updated);setCollect(blankCollect());
  };

  const handleCloseLoan=loan=>{
    const updated=loans.map(l=>{if(l.id!==loan.id)return l;const sched=l.schedule.map(p=>p.status==='Pending'||p.status==='Partial'?{...p,status:'Closed',paidDate:new Date().toISOString()}:p);return{...l,schedule:sched,status:'Closed',closedDate:new Date().toISOString()};});
    save(undefined,transactions,updated);setCloseLoan(null);
  };

  const handleExp=async()=>{
    const amt=parseFloat(newExp.amount);
    if(!newExp.desc||!amt)return alert('Fill all fields');
    if(isBackendSession){
      try{
        await backendApiFetch('/api/v1/expenses',{
          method:'POST',
          token:backendAuth.accessToken,
          orgId:backendAuth.organization.id,
          headers:{'Idempotency-Key':`web-exp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`},
          body:{
            description:newExp.desc,
            amount:amt,
            category:newExp.category,
            expenseDate:new Date().toISOString(),
            paymentMode:'CASH',
          },
        });
        await refreshBackendSnapshot();
        setNE({desc:'',amount:'',category:'Other Indirect Expenses'});
      }catch(e){
        alert(e?.message||'Expense save failed');
      }
      return;
    }
    save(undefined,pushTx(newExp.desc,'DEBIT',amt,'EXPENSE',null,newExp.category));
    setNE({desc:'',amount:'',category:'Other Indirect Expenses'});
  };

  const detailC=cDetail?clientMap.find(c=>c.name===cDetail):null;
  useEffect(()=>{
    if(isBackendSession&&detailC?.backendId) loadClientTds(detailC.backendId);
  },[isBackendSession,detailC?.backendId]);
  useEffect(()=>{
    if(!detailC) return;
    setTdsForm(f=>({
      ...f,
      entryScope:String(detailC.fundingChannel||'DIRECT').toUpperCase()==='TIE_UP'?(f.entryScope||'CLIENT'):'CLIENT',
      tieUpPartnerName:f.tieUpPartnerName||detailC.tieUpPartnerName||'',
    }));
  },[detailC?.name,detailC?.fundingChannel,detailC?.tieUpPartnerName]);

  if(!loggedIn) return <Login onLogin={handleLogin} loginConfigured={BACKEND_API_ENABLED||DEMO_LOGIN_ENABLED} authMode={BACKEND_API_ENABLED?'backend':'demo'}/>;

  /* ── PRE-RENDER ── */
  const alertCount=stats.overdueList.length+stats.dueTodayList.length;
  const maxCF=Math.max(...cashflow.map(d=>Math.max(d.inflow,d.outflow)),1);
  const maxExp=expBrk.length?Math.max(...expBrk.map(e=>e.v)):1;
  const[rmY,rmM]=repMonth.split('-');
  const rmStart=new Date(+rmY,+rmM-1,1),rmEnd=new Date(+rmY,+rmM,0),rmNextStart=new Date(+rmY,+rmM,1);
  const mTx=transactions
    .filter(t=>{const d=new Date(t.date);return d>=rmStart&&d<rmNextStart;})
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  const mIn=mTx.filter(t=>t.type==='CREDIT'&&t.tag==='COLLECTION').reduce((a,t)=>a+t.amount,0);
  const mExp=mTx.filter(t=>t.tag==='EXPENSE').reduce((a,t)=>a+t.amount,0);
  const mBD=mTx.filter(t=>t.tag==='BAD_DEBT').reduce((a,t)=>a+t.amount,0);
  const mNet=mIn-mExp-mBD;
  const mCreditTotal=mTx.filter(t=>t.type==='CREDIT').reduce((a,t)=>a+t.amount,0);
  const mDebitTotal=mTx.filter(t=>t.type==='DEBIT').reduce((a,t)=>a+t.amount,0);
  const mDisbursed=mTx.filter(t=>t.tag==='LENDING').reduce((a,t)=>a+t.amount,0);
  const mCapitalAdded=mTx.filter(t=>t.tag==='CAPITAL').reduce((a,t)=>a+t.amount,0);
  const mCashMovement=mCreditTotal-mDebitTotal;
  const mOpeningBalance=transactions.reduce((b,t)=>{
    const d=new Date(t.date);
    if(d>=rmStart) return b;
    return t.type==='CREDIT'?b+t.amount:b-t.amount;
  },ob);
  const mClosingBalance=mOpeningBalance+mCashMovement;
  const mCollectionsCount=mTx.filter(t=>t.tag==='COLLECTION').length;
  const mExpenseCount=mTx.filter(t=>t.tag==='EXPENSE').length;
  const mWriteoffCount=mTx.filter(t=>t.tag==='BAD_DEBT').length;

  const loanById={};
  const loanClientById={};
  loans.forEach(l=>{loanById[l.id]=l;loanClientById[l.id]=l.client;});
  const mInterestEarned=mTx.filter(t=>t.tag==='COLLECTION').reduce((a,t)=>a+getTxInterestComponent(t,loanById[t.relatedId]),0);
  const mPrincipalRecovered=mTx.filter(t=>t.tag==='COLLECTION').reduce((a,t)=>a+getTxPrincipalComponent(t,loanById[t.relatedId]),0);
  const mAvgCollectionTicket=mCollectionsCount?mIn/mCollectionsCount:0;

  const mTopClients=Object.entries(mTx.reduce((acc,t)=>{
    if(t.tag!=='COLLECTION') return acc;
    const client=loanClientById[t.relatedId]||String(t.desc||'').replace(/^Collection\s+[—-]\s+/,'')||'Unknown';
    acc[client]=(acc[client]||0)+t.amount;
    return acc;
  },{})).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([client,amount])=>({client,amount}));

  const mTopExpenseCats=Object.entries(mTx.reduce((acc,t)=>{
    if(t.tag!=='EXPENSE'&&t.tag!=='BAD_DEBT') return acc;
    const key=t.tag==='BAD_DEBT'?'Bad Debt Write-off':(t.category||'Other Expenses');
    acc[key]=(acc[key]||0)+t.amount;
    return acc;
  },{})).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([label,value])=>({label,value}));
  const mExpenseSchedule=Object.entries(mTx.reduce((acc,t)=>{
    if(t.tag!=='EXPENSE') return acc;
    const key=t.category||'Other Expenses';
    acc[key]=(acc[key]||0)+t.amount;
    return acc;
  },{})).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
  const mTopExpenseMax=mTopExpenseCats.length?Math.max(...mTopExpenseCats.map(x=>x.value)):1;
  const mLedgerTagSummary=['CAPITAL','LENDING','COLLECTION','EXPENSE','BAD_DEBT'].map(tag=>{
    const rows=mTx.filter(t=>t.tag===tag);
    const debit=rows.filter(t=>t.type==='DEBIT').reduce((a,t)=>a+t.amount,0);
    const credit=rows.filter(t=>t.type==='CREDIT').reduce((a,t)=>a+t.amount,0);
    return{tag,count:rows.length,debit,credit,net:credit-debit};
  }).filter(r=>r.count>0);

  const mDailyTrend=Object.entries(mTx.reduce((acc,t)=>{
    const dk=(t.date||'').slice(0,10);
    if(!dk) return acc;
    if(!acc[dk]) acc[dk]={in:0,out:0,collections:0,entries:0};
    acc[dk].entries++;
    if(t.type==='CREDIT') acc[dk].in+=t.amount;
    else acc[dk].out+=t.amount;
    if(t.tag==='COLLECTION') acc[dk].collections+=t.amount;
    return acc;
  },{})).sort((a,b)=>a[0].localeCompare(b[0])).map(([day,v])=>({day,...v,net:v.in-v.out}));
  const mDailyTrendSlice=mDailyTrend.slice(-12);
  const mDailyCollectionsMax=mDailyTrendSlice.length?Math.max(...mDailyTrendSlice.map(d=>d.collections),1):1;

  let mDemandDue=0,mDemandCollected=0,mDueInstCount=0,mDueInstPaid=0,mMonthOverdueNow=0;
  loans.forEach(l=>{
    l.schedule.forEach(p=>{
      const d=new Date(p.date);
      if(d<rmStart||d>=rmNextStart) return;
      const outstanding=Math.max(0,p.payment-(p.paid||0));
      mDemandDue+=p.payment;
      mDemandCollected+=Math.min(p.payment,p.paid||0);
      mDueInstCount++;
      if((p.paid||0)>=p.payment||p.status==='Paid') mDueInstPaid++;
      if((p.status==='Pending'||p.status==='Partial')&&outstanding>0&&d<new Date()) mMonthOverdueNow+=outstanding;
    });
  });
  const mCollectionEfficiency=mDemandDue?mDemandCollected/mDemandDue*100:0;
  const mRecoveryRate=mCollectionsCount?mIn/Math.max(mDemandCollected,1)*100:0;

  let runningBalance=mOpeningBalance;
  const mLedgerRows=mTx.map(t=>{
    runningBalance+=(t.type==='CREDIT'?t.amount:-t.amount);
    return{...t,runningBalance};
  });
  const calY=calDate.getFullYear(),calM=calDate.getMonth();
  const daysInM=new Date(calY,calM+1,0).getDate(),firstD=new Date(calY,calM,1).getDay();
  const todayFull=ts();
  const reportMonthLabel=rmStart.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const mTopClientMax=mTopClients.length?Math.max(...mTopClients.map(x=>x.amount),1):1;
  const mTopOverdueMax=stats.topOverdueClients.length?Math.max(...stats.topOverdueClients.map(x=>x.amount),1):1;
  const mAgingMax=Math.max(...Object.values(stats.aging),1);
  const clientArrearOverdueEmiTotal=clientArrearRows.reduce((a,r)=>a+r.overdueEmiCount,0);
  const clientArrearCurrentCount=clientArrearRows.filter(r=>r.overdueEmiCount>=1&&r.overdueEmiCount<=3).length;
  const clientArrearLongCount=clientArrearRows.filter(r=>r.overdueEmiCount>=4).length;
  const reportApiMode=!!isBackendSession;
  const reportPnl=reportApiMode&&backendReports.pnl?backendReports.pnl:null;
  const reportEff=reportApiMode&&backendReports.efficiency?backendReports.efficiency:null;
  const reportClientArrearRows=(reportApiMode&&Array.isArray(backendReports.clientArrears))
    ? backendReports.clientArrears.map(r=>({
        client:r.client_name||'Unknown',
        activeLoans:toNum(r.active_loan_count),
        totalReceivable:toNum(r.total_receivable),
        overdueEmiCount:toNum(r.overdue_emi_count),
        pendingCategory:r.pendingCategory||'NOT_OVERDUE',
      }))
    : clientArrearRows;
  const reportClientArrearOverdueEmiTotal=reportClientArrearRows.reduce((a,r)=>a+toNum(r.overdueEmiCount),0);
  const reportClientArrearCurrentCount=reportClientArrearRows.filter(r=>toNum(r.overdueEmiCount)>=1&&toNum(r.overdueEmiCount)<=3).length;
  const reportClientArrearLongCount=reportClientArrearRows.filter(r=>toNum(r.overdueEmiCount)>=4).length;
  const reportReceivableLive=reportApiMode&&backendDash.summary?toNum(backendDash.summary.receivables):stats.recv;
  const reportOverdueLive=reportApiMode&&backendDash.risk?toNum(backendDash.risk.overdueAmount):stats.overdueAmt;
  const reportPar30Ratio=reportApiMode&&backendDash.risk?toNum(backendDash.risk.par30Ratio):stats.par30Ratio;
  const reportAgingLive=reportApiMode&&backendDash.risk?.aging&&typeof backendDash.risk.aging==='object'?backendDash.risk.aging:stats.aging;
  const reportCollectionsAmount=reportPnl?toNum(reportPnl.collections):mIn;
  const reportInterestEarned=reportPnl?toNum(reportPnl.interestEarned):mInterestEarned;
  const reportPrincipalRecovered=reportPnl?toNum(reportPnl.principalRecovered):mPrincipalRecovered;
  const reportExpenses=reportPnl?toNum(reportPnl.expenses):mExp;
  const reportBadDebt=reportPnl?toNum(reportPnl.badDebt):mBD;
  const reportNetOperating=reportPnl?toNum(reportPnl.netOperating):mNet;
  const reportMonthDemand=reportEff?toNum(reportEff.monthDemand):mDemandDue;
  const reportMonthScheduledCollected=reportEff?toNum(reportEff.monthScheduledCollected):mDemandCollected;
  const reportCollectionEfficiency=reportEff?toNum(reportEff.collectionEfficiency):mCollectionEfficiency;
  const reportDueInstallmentCount=reportEff?toNum(reportEff.dueInstallmentCount):mDueInstCount;
  const reportFullyPaidInstallmentCount=reportEff?toNum(reportEff.fullyPaidInstallmentCount):mDueInstPaid;
  const reportAvgCollectionTicket=mCollectionsCount?reportCollectionsAmount/mCollectionsCount:0;
  const reportMonthlyCollectionsByTieUp=Object.entries(mTx.reduce((acc,t)=>{
    if(t.tag!=='COLLECTION'||t.type!=='CREDIT') return acc;
    const clientName=loanClientById[t.relatedId]||String(t.desc||'').replace(/^Collection\s+[—-]\s+/,'')||'Unknown';
    const pf=clientProfiles[clientName]||blankProfile(clientName);
    const fundingChannel=String(pf.fundingChannel||'DIRECT').toUpperCase();
    const partnerName=(pf.tieUpPartnerName||'').trim();
    const key=fundingChannel==='TIE_UP'&&partnerName?`TIE_UP:${partnerName}`:'DIRECT';
    if(!acc[key]) acc[key]={key,label:key==='DIRECT'?'Direct Clients':partnerName||'Tie-up (Unnamed)',fundingChannel:fundingChannel==='TIE_UP'?'TIE_UP':'DIRECT',collectionsAmount:0,entries:0,clients:new Set()};
    acc[key].collectionsAmount+=toNum(t.amount);
    acc[key].entries++;
    acc[key].clients.add(clientName);
    return acc;
  },{})).map(([,r])=>({...r,clientsCount:r.clients.size}))
    .sort((a,b)=>(b.collectionsAmount-a.collectionsAmount)||a.label.localeCompare(b.label));
  const reportMonthlyCollectionsTieUpFiltered=reportTieUpFilter==='ALL'
    ? reportMonthlyCollectionsByTieUp
    : reportMonthlyCollectionsByTieUp.filter(r=>r.key===reportTieUpFilter);
  const reportMonthlyCollectionsTieUpCumulative=reportMonthlyCollectionsTieUpFiltered.reduce((a,r)=>a+r.collectionsAmount,0);
  const reportMonthlyCollectionsTieUpEntries=reportMonthlyCollectionsTieUpFiltered.reduce((a,r)=>a+r.entries,0);
  const reportTdsPendingRows=(reportApiMode&&Array.isArray(backendTdsFollowup.items))?backendTdsFollowup.items:[];
  const reportTdsSummary=reportApiMode&&backendTdsFollowup.summary?backendTdsFollowup.summary:null;
  const reportTdsPendingTotal=reportTdsSummary?toNum(reportTdsSummary.tds_pending):reportTdsPendingRows.reduce((a,r)=>a+toNum(r.tdsAmount),0);
  const reportTdsGrossCovered=reportTdsSummary?toNum(reportTdsSummary.gross_emi_total):reportTdsPendingRows.reduce((a,r)=>a+toNum(r.grossEmiAmount),0);
  const reportTdsCashReceived=reportTdsSummary?toNum(reportTdsSummary.cash_received_total):reportTdsPendingRows.reduce((a,r)=>a+toNum(r.cashReceivedAmount),0);
  const reportTdsFollowupGrouped=Object.values(reportTdsPendingRows.reduce((acc,row)=>{
    if(!row||typeof row!=='object') return acc;
    const fundingChannel=String(row?.fundingChannel||'DIRECT').toUpperCase();
    const partner=(row?.tieUpPartnerName||'').trim();
    const clientName=(row?.clientName||'Unknown Client').trim()||'Unknown Client';
    const key=fundingChannel==='TIE_UP'?(partner?`TIE_UP:${partner}`:'TIE_UP:UNNAMED'):`DIRECT:${clientName}`;
    const label=fundingChannel==='TIE_UP'?(partner||'Tie-up (Unnamed)'):clientName;
    const bucket=acc[key]||{
      key,label,fundingChannel,
      tieUpPartnerName:fundingChannel==='TIE_UP'?(partner||null):null,
      clients:new Set(),
      grossEmiAmount:0,cashReceivedAmount:0,tdsAmount:0,entries:0,maxAgeDays:0,
    };
    if(clientName) bucket.clients.add(clientName);
    bucket.grossEmiAmount+=toNum(row?.grossEmiAmount);
    bucket.cashReceivedAmount+=toNum(row?.cashReceivedAmount);
    bucket.tdsAmount+=toNum(row?.tdsAmount);
    bucket.entries+=1;
    const ageDays=Math.max(0,Math.floor((Date.now()-new Date(row?.deductionDate).getTime())/86400000));
    bucket.maxAgeDays=Math.max(bucket.maxAgeDays,Number.isFinite(ageDays)?ageDays:0);
    acc[key]=bucket;
    return acc;
  },{})).map(r=>({...r,clientsCount:r.clients.size}))
    .sort((a,b)=>(b.tdsAmount-a.tdsAmount)||a.label.localeCompare(b.label));
  const reportDbTx=(reportApiMode&&Array.isArray(backendReports.dayBook?.items))
    ? backendReports.dayBook.items.map(t=>({
        id:t.id,
        desc:t.description||'',
        tag:String(t.tag||'').toUpperCase(),
        type:String(t.tx_type||'').toUpperCase()==='CREDIT'?'CREDIT':'DEBIT',
        amount:toNum(t.amount),
      }))
    : dbTx;
  const reportDbTotals=(reportApiMode&&backendReports.dayBook?.totals)
    ? {debit:toNum(backendReports.dayBook.totals.debit),credit:toNum(backendReports.dayBook.totals.credit)}
    : {
        debit:dbTx.filter(t=>t.type==='DEBIT').reduce((a,t)=>a+t.amount,0),
        credit:dbTx.filter(t=>t.type==='CREDIT').reduce((a,t)=>a+t.amount,0),
      };
  const reportTopClients=(reportApiMode&&Array.isArray(backendReports.topCollections?.items))
    ? backendReports.topCollections.items.map(r=>({client:r.clientName||'Unknown',amount:toNum(r.amount),count:toNum(r.collectionCount)}))
    : mTopClients;
  const reportTopClientMax=reportTopClients.length?Math.max(...reportTopClients.map(x=>toNum(x.amount)),1):1;
  const reportExpenseApi=reportApiMode&&backendReports.expenseMix?backendReports.expenseMix:null;
  const reportTopExpenseCats=(reportExpenseApi&&Array.isArray(reportExpenseApi.topMix))
    ? reportExpenseApi.topMix.map(r=>({label:r.label||'Other Expenses',value:toNum(r.value)}))
    : mTopExpenseCats;
  const reportExpenseSchedule=(reportExpenseApi&&Array.isArray(reportExpenseApi.expenseSchedule))
    ? reportExpenseApi.expenseSchedule.map(r=>({label:r.label||'Other Expenses',value:toNum(r.value)}))
    : mExpenseSchedule;
  const reportTopExpenseMax=reportTopExpenseCats.length?Math.max(...reportTopExpenseCats.map(x=>toNum(x.value)),1):1;
  const reportLedgerSummaryApi=reportApiMode&&backendReports.ledgerSummary?backendReports.ledgerSummary:null;
  const reportLedgerTagSummary=(reportLedgerSummaryApi&&Array.isArray(reportLedgerSummaryApi.tagSummary))
    ? reportLedgerSummaryApi.tagSummary.map(r=>({
        tag:String(r.tag||''),
        count:toNum(r.count),
        debit:toNum(r.debit),
        credit:toNum(r.credit),
        net:toNum(r.net),
      }))
    : mLedgerTagSummary;
  const reportDailyTrend=(reportLedgerSummaryApi&&Array.isArray(reportLedgerSummaryApi.dailyTrend))
    ? reportLedgerSummaryApi.dailyTrend.map(r=>({
        day:String(r.day||''),
        entries:toNum(r.entries),
        in:toNum(r.inflow),
        out:toNum(r.outflow),
        collections:toNum(r.collections),
        net:Number.isFinite(+r.net)?+r.net:(toNum(r.inflow)-toNum(r.outflow)),
      }))
    : mDailyTrend;
  const reportDailyTrendSlice=reportDailyTrend.slice(-12);
  const reportDailyCollectionsMax=reportDailyTrendSlice.length?Math.max(...reportDailyTrendSlice.map(d=>toNum(d.collections)),1):1;
  const reportLedgerTotals=(reportLedgerSummaryApi&&reportLedgerSummaryApi.totals&&typeof reportLedgerSummaryApi.totals==='object')
    ? reportLedgerSummaryApi.totals
    : null;
  const reportLedgerEntryCount=reportLedgerTotals?toNum(reportLedgerTotals.entryCount):mTx.length;
  const reportCreditEntryCount=reportLedgerTotals?toNum(reportLedgerTotals.creditEntryCount):mTx.filter(t=>t.type==='CREDIT').length;
  const reportDebitEntryCount=reportLedgerTotals?toNum(reportLedgerTotals.debitEntryCount):mTx.filter(t=>t.type==='DEBIT').length;
  const reportCollectionEntryCount=reportLedgerTotals?toNum(reportLedgerTotals.collectionEntryCount):mCollectionsCount;
  const reportExpenseEntryCount=reportLedgerTotals?toNum(reportLedgerTotals.expenseEntryCount):mExpenseCount;
  const reportWriteoffEntryCount=reportLedgerTotals?toNum(reportLedgerTotals.writeoffEntryCount):mWriteoffCount;
  const reportCreditTotal=reportLedgerTotals?toNum(reportLedgerTotals.totalCredit):mCreditTotal;
  const reportDebitTotal=reportLedgerTotals?toNum(reportLedgerTotals.totalDebit):mDebitTotal;
  const reportDisbursed=reportLedgerTotals?toNum(reportLedgerTotals.disbursed):mDisbursed;
  const reportCapitalAdded=reportLedgerTotals?toNum(reportLedgerTotals.capitalAdded):mCapitalAdded;
  const reportCashMovement=reportLedgerTotals?toNum(reportLedgerTotals.cashMovement):mCashMovement;
  const reportOpeningBalance=reportLedgerTotals?toNum(reportLedgerTotals.openingCashBalance):mOpeningBalance;
  const reportClosingBalance=reportLedgerTotals?toNum(reportLedgerTotals.closingCashBalance):mClosingBalance;
  const reportAgingMax=Math.max(...Object.values(reportAgingLive).map(v=>toNum(v)),1);

  return(
    <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>

    {/* ─ PRINT TEMPLATE ─ */}
    <div className="pb pr-report" style={{padding:16}}>
      <div className="pr-shell">
        <div className="pr-header pr-break-avoid">
          <div className="pr-head-row">
            <div>
              <div className="pr-brand">YASH PORTFOLIO MANAGER</div>
              <div className="pr-title">Data-driven Monthly Finance & Portfolio Report — {reportMonthLabel}</div>
              <div style={{display:'flex',gap:6,marginTop:10,flexWrap:'wrap'}}>
                <span className="pr-tag">Private Finance</span>
                <span className="pr-pill blue">Generated {new Date().toLocaleDateString('en-IN')}</span>
                <span className="pr-pill gold">{reportLedgerEntryCount} ledger entries</span>
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div className="pr-meta" style={{display:'grid',gridTemplateColumns:'auto auto',gap:'5px 10px'}}>
                <span>Period</span><strong>{reportMonthLabel}</strong>
                <span>Active Loans</span><strong>{stats.activeLoans}</strong>
                <span>Closed Loans</span><strong>{stats.closedLoans}</strong>
                <span>Receivables</span><strong>{fc(reportReceivableLive)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="pr-kpi-grid pr-break-avoid">
          {[
            ['Collections',fc(reportCollectionsAmount),'Total collection credits posted in month','green'],
            ['Expenses',fc(reportExpenses),'Operational expense debits','red'],
            ['Bad Debt',fc(reportBadDebt),`${reportWriteoffEntryCount} write-off entr${reportWriteoffEntryCount===1?'y':'ies'}`,'red'],
            ['Net Operating',fc(reportNetOperating),reportNetOperating>=0?'Collections minus expense + write-offs':'Operating loss for selected month',reportNetOperating>=0?'green':'red'],
          ].map(([label,val,sub,tone])=>(
            <div key={label} className={`pr-kpi ${label==='Net Operating'?'gold':''}`}>
              <div className="k">{label}</div>
              <div className="v" style={{color:tone==='green'?'#065F46':tone==='red'?'#991B1B':'#111827'}}>{val}</div>
              <div className="s">{sub}</div>
            </div>
          ))}
        </div>

        <div className="pr-kpi-grid pr-break-avoid">
          {[
            ['Opening Cash',fc(reportOpeningBalance),`Closing: ${fc(reportClosingBalance)}`],
            ['Disbursed',fc(reportDisbursed),`Capital added: ${fc(reportCapitalAdded)}`],
            ['Demand (Month)',fc(reportMonthDemand),`${reportDueInstallmentCount} EMI due`],
            ['Collection Efficiency',`${reportCollectionEfficiency.toFixed(1)}%`,`${fc(reportMonthScheduledCollected)} scheduled collections realized`],
            ['Avg. Interest Rate',`${stats.avgInterestRate.toFixed(2)}%`,`Weighted by active principal`],
            ['PAR30 Ratio',`${reportPar30Ratio.toFixed(1)}%`,`${fc(reportApiMode&&backendDash.risk?toNum(backendDash.risk.par30Amount):stats.par30Amt)} PAR30 outstanding`],
            ['Overdue Ratio',`${(reportApiMode&&backendDash.risk?toNum(backendDash.risk.overdueRatio):stats.overdueRatio).toFixed(1)}%`,`${fc(reportOverdueLive)} overdue total`],
            ['Net Cash Movement',fc(reportCashMovement),`${reportCreditTotal>=reportDebitTotal?'Credit-led month':'Debit-led month'}`],
          ].map(([label,val,sub])=>(
            <div key={label} className="pr-kpi">
              <div className="k">{label}</div>
              <div className="v">{val}</div>
              <div className="s">{sub}</div>
            </div>
          ))}
        </div>

        <div className="pr-grid-2">
          <div className="pr-card pr-break-avoid">
            <h4>Collections & Cash Activity</h4>
            <div className="pr-sub">Daily collection bars (last 12 active days in selected month)</div>
            {reportDailyTrendSlice.length>0?(
              <>
                <div className="pr-spark">
                  {reportDailyTrendSlice.map(d=>(
                    <div key={d.day} className="pr-spark-bar" title={`${fd(d.day)} | Collections ${fc(d.collections)} | Net ${fc(d.net)}`}>
                      <span style={{height:`${(d.collections/reportDailyCollectionsMax)*100}%`,background:d.collections>0?'linear-gradient(180deg,#34D399,#047857)':'#D1D5DB'}}/>
                    </div>
                  ))}
                </div>
                <div className="pr-spark-labels" style={{gridTemplateColumns:`repeat(${reportDailyTrendSlice.length}, minmax(0,1fr))`}}>
                  {reportDailyTrendSlice.map(d=><span key={d.day}>{String(new Date(d.day).getDate()).padStart(2,'0')}</span>)}
                </div>
              </>
            ):<div className="pr-sub">No transaction activity in the selected month.</div>}
            <div style={{height:10}}/>
            <div className="pr-rows">
              <div className="pr-row"><span className="l">Credit Entries</span><span className="r pos">{reportCreditEntryCount} ({fc(reportCreditTotal)})</span></div>
              <div className="pr-row"><span className="l">Debit Entries</span><span className="r neg">{reportDebitEntryCount} ({fc(reportDebitTotal)})</span></div>
              <div className="pr-row"><span className="l">Collections Posted</span><span className="r pos">{reportCollectionEntryCount} ({fc(reportCollectionsAmount)})</span></div>
              <div className="pr-row"><span className="l">Expenses Posted</span><span className="r">{reportExpenseEntryCount} ({fc(reportExpenses)})</span></div>
              <div className="pr-row"><span className="l">Installments Due (Month)</span><span className="r">{reportDueInstallmentCount} · {reportFullyPaidInstallmentCount} fully paid</span></div>
              <div className="pr-row"><span className="l">Month Overdue (from due month)</span><span className={`r ${mMonthOverdueNow>0?'neg':''}`}>{fc(mMonthOverdueNow)}</span></div>
            </div>
          </div>

          <div className="pr-card pr-break-avoid">
            <h4>Portfolio Risk Snapshot</h4>
            <div className="pr-sub">Current portfolio risk (live snapshot at report generation time)</div>
            <div className="pr-rows">
              {Object.entries(reportAgingLive).map(([bucket,val])=>(
                <div key={bucket} className="pr-row">
                  <span className="l">{bucket} days</span>
                  <span className={`r ${val>0&&bucket!=='0-30'?'neg':''}`}>{fc(val)}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:8}}>
              {Object.entries(reportAgingLive).map(([bucket,val])=>(
                <div key={`bar-${bucket}`} style={{display:'grid',gridTemplateColumns:'68px 1fr 90px',gap:7,alignItems:'center',marginBottom:5,fontSize:10}}>
                  <span className="pr-muted">{bucket}</span>
                  <div style={{height:6,background:'#EEF2F7',borderRadius:999,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(val/reportAgingMax)*100}%`,background:bucket==='90+'?'#EF4444':bucket==='61-90'?'#FB7185':bucket==='31-60'?'#F59E0B':'#60A5FA'}}/>
                  </div>
                  <span className="mono pr-right">{fc(val)}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:10}}>
              <h5>Top Overdue Exposure</h5>
              {stats.topOverdueClients.length===0&&<div className="pr-sub">No overdue client exposure at this time.</div>}
              <div className="pr-rows">
                {stats.topOverdueClients.slice(0,5).map((row,i)=>(
                  <div key={row.client+i} className="pr-row">
                    <span className="l">#{i+1} {row.client}</span>
                    <span className="r neg">{fc(row.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pr-grid-2 equal">
          <div className="pr-card pr-break-avoid">
            <h4>Top Collection Clients (Month)</h4>
            <div className="pr-sub">Clients ranked by collection amount in selected month</div>
            {reportTopClients.length===0&&<div className="pr-sub">No collection entries in selected month.</div>}
            {reportTopClients.map((row,i)=>(
              <div key={row.client+i} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:11,marginBottom:3}}>
                  <span style={{fontWeight:600,color:'#1F2937'}}>#{i+1} {row.client}</span>
                  <span className="mono" style={{fontWeight:700}}>{fc(row.amount)}</span>
                </div>
                <div style={{height:6,background:'#EEF2F7',borderRadius:999,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(row.amount/reportTopClientMax)*100}%`,background:'linear-gradient(90deg,#34D399,#059669)'}}/>
                </div>
              </div>
            ))}
          </div>
          <div className="pr-card pr-break-avoid">
            <h4>Expense Mix (Month)</h4>
            <div className="pr-sub">Expense categories and write-off concentration for the month</div>
            {reportTopExpenseCats.length===0&&<div className="pr-sub">No expense or write-off entries in selected month.</div>}
            {reportTopExpenseCats.map((row,i)=>(
              <div key={row.label+i} style={{marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:11,marginBottom:3}}>
                  <span style={{fontWeight:600,color:'#374151',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={row.label}>{row.label}</span>
                  <span className="mono" style={{fontWeight:700,color:row.label.includes('Bad Debt')?'#991B1B':'#111827'}}>{fc(row.value)}</span>
                </div>
                <div style={{height:6,background:'#EEF2F7',borderRadius:999,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(row.value/reportTopExpenseMax)*100}%`,background:row.label.includes('Bad Debt')?'linear-gradient(90deg,#F87171,#DC2626)':'linear-gradient(90deg,#FBBF24,#D97706)'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pr-card pr-break-avoid">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <h4 style={{marginBottom:0}}>CA Accounting Annexure (Monthly)</h4>
            <span className="pr-pill gold">For CA Review</span>
          </div>
          <div className="pr-sub" style={{marginTop:6}}>
            Accounting-focused summary for {reportMonthLabel}. New collections use posted principal/interest split (interest-first EMI allocation); older collection entries may use fallback ratio-based split. Arrear/receivable schedule is a live snapshot as on report generation date.
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:12}}>
            <div>
              <h5>Monthly Books Summary</h5>
              <div className="pr-rows">
                <div className="pr-row"><span className="l">Opening Cash Balance</span><span className="r">{fc(reportOpeningBalance)}</span></div>
                <div className="pr-row"><span className="l">Capital Introduced</span><span className="r pos">{fc(reportCapitalAdded)}</span></div>
                <div className="pr-row"><span className="l">Loan Disbursements</span><span className="r neg">{fc(reportDisbursed)}</span></div>
                <div className="pr-row"><span className="l">Collections Received</span><span className="r pos">{fc(reportCollectionsAmount)}</span></div>
                <div className="pr-row"><span className="l">Interest Earned</span><span className="r pos">{fc(reportInterestEarned)}</span></div>
                <div className="pr-row"><span className="l">Principal Recovered</span><span className="r">{fc(reportPrincipalRecovered)}</span></div>
                <div className="pr-row"><span className="l">Expenses</span><span className="r neg">{fc(reportExpenses)}</span></div>
                <div className="pr-row"><span className="l">Bad Debt Write-off</span><span className="r neg">{fc(reportBadDebt)}</span></div>
                <div className="pr-row"><span className="l">Net Cash Movement</span><span className={`r ${reportCashMovement<0?'neg':'pos'}`}>{fc(reportCashMovement)}</span></div>
                <div className="pr-row"><span className="l">Closing Cash Balance</span><span className={`r ${reportClosingBalance<0?'neg':''}`}>{fc(reportClosingBalance)}</span></div>
                <div className="pr-row"><span className="l">Arrear Amount (Total Receivable, Live)</span><span className={`r ${reportReceivableLive>0?'neg':''}`}>{fc(reportReceivableLive)}</span></div>
                <div className="pr-row"><span className="l">Overdue Amount (Live)</span><span className={`r ${reportOverdueLive>0?'neg':''}`}>{fc(reportOverdueLive)}</span></div>
              </div>
            </div>
            <div>
              <h5>Month Ledger Tag Summary</h5>
              <div className="pr-table-wrap" style={{marginTop:6}}>
                <table className="pr-table">
                  <thead>
                    <tr>
                      <th>Tag</th>
                      <th className="pr-right">Entries</th>
                      <th className="pr-right">Debit</th>
                      <th className="pr-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLedgerTagSummary.length===0&&(
                      <tr><td colSpan="4" style={{textAlign:'center',color:'#6B7280'}}>No month ledger entries.</td></tr>
                    )}
                    {reportLedgerTagSummary.map(r=>(
                      <tr key={r.tag}>
                        <td>{r.tag}</td>
                        <td className="pr-right mono">{r.count}</td>
                        <td className="pr-right mono">{r.debit?fc(r.debit):'—'}</td>
                        <td className="pr-right mono">{r.credit?fc(r.credit):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="pr-grid-2">
          <div className="pr-card pr-break-avoid">
            <h4>Expense Schedule (Month)</h4>
            <div className="pr-sub">Category-wise operating expense totals for {reportMonthLabel}</div>
            <div className="pr-table-wrap" style={{marginTop:8}}>
              <table className="pr-table">
                <thead>
                  <tr>
                    <th>Expense Category</th>
                    <th className="pr-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {reportExpenseSchedule.length===0&&(
                    <tr><td colSpan="2" style={{textAlign:'center',color:'#6B7280'}}>No expense entries in selected month.</td></tr>
                  )}
                  {reportExpenseSchedule.map(row=>(
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="pr-right mono">{fc(row.value)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{fontWeight:700}}>Total Expenses</td>
                    <td className="pr-right mono" style={{fontWeight:700}}>{fc(mExp)}</td>
                  </tr>
                  <tr>
                    <td style={{fontWeight:700,color:'#991B1B'}}>Bad Debt Write-off</td>
                    <td className="pr-right mono" style={{fontWeight:700,color:'#991B1B'}}>{fc(mBD)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="pr-card pr-break-avoid">
            <h4>Client-wise Arrear Summary (Live)</h4>
            <div className="pr-sub">Arrear = total receivable outstanding by client</div>
            <div className="pr-rows" style={{marginTop:8}}>
              <div className="pr-row"><span className="l">Clients With Arrear</span><span className="r">{clientArrearRows.length}</span></div>
              <div className="pr-row"><span className="l">Current Pending (1-3 overdue EMI)</span><span className="r">{clientArrearCurrentCount}</span></div>
              <div className="pr-row"><span className="l">Long Pending (4+ overdue EMI)</span><span className="r neg">{clientArrearLongCount}</span></div>
              <div className="pr-row"><span className="l">Total Overdue EMI Count</span><span className="r neg">{clientArrearOverdueEmiTotal}</span></div>
              <div className="pr-row"><span className="l">Total Arrear (Receivable)</span><span className="r neg">{fc(stats.recv)}</span></div>
              <div className="pr-row"><span className="l">Overdue Amount</span><span className="r neg">{fc(stats.overdueAmt)}</span></div>
              <div className="pr-row"><span className="l">PAR30 Amount</span><span className="r neg">{fc(stats.par30Amt)}</span></div>
              <div className="pr-row"><span className="l">PAR30 Ratio</span><span className="r neg">{stats.par30Ratio.toFixed(2)}%</span></div>
            </div>
          </div>
        </div>

        <div className="pr-card">
          <div style={{padding:'12px 12px 0'}} className="pr-break-avoid">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div>
                <h4 style={{marginBottom:4}}>Client-wise Arrear Schedule (Live Snapshot)</h4>
                <div className="pr-sub" style={{marginBottom:10}}>Share with CA for outstanding receivable verification and recovery follow-up planning.</div>
              </div>
              <div className="pr-badges">
                <span className="pr-badge">Clients {clientArrearRows.length}</span>
                <span className="pr-badge">Arrear {fc(stats.recv)}</span>
                <span className="pr-badge">Overdue EMI {clientArrearOverdueEmiTotal}</span>
              </div>
            </div>
          </div>
          <div className="pr-table-wrap" style={{border:'none',borderTop:'1px solid #E5E7EB',borderRadius:'0 0 12px 12px'}}>
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="pr-right">Active Loans</th>
                  <th className="pr-right">Total Receivable (Arrear)</th>
                  <th className="pr-right">Overdue EMI Count</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {clientArrearRows.length===0&&(
                  <tr><td colSpan="5" style={{textAlign:'center',padding:'16px 8px',color:'#6B7280'}}>No pending receivables / arrears at this time.</td></tr>
                )}
                {clientArrearRows.map(row=>(
                  <tr key={`ca-arr-${row.client}`}>
                    <td>{row.client}</td>
                    <td className="pr-right mono">{row.activeLoans}</td>
                    <td className="pr-right mono" style={{fontWeight:700,color:'#991B1B'}}>{fc(row.totalReceivable)}</td>
                    <td className="pr-right mono" style={{color:row.overdueEmiCount>0?'#991B1B':'#111827'}}>{row.overdueEmiCount}</td>
                    <td>
                      {row.overdueEmiCount>=4&&<span className="pr-pill red">Long Pending</span>}
                      {row.overdueEmiCount>=1&&row.overdueEmiCount<=3&&<span className="pr-pill gold">Current Pending</span>}
                      {row.overdueEmiCount===0&&<span className="pr-pill blue">Not Overdue</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pr-card" style={{padding:0}}>
          <div style={{padding:'12px 12px 0'}} className="pr-break-avoid">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
              <div>
                <h4 style={{marginBottom:4}}>Detailed Ledger (Selected Month)</h4>
                <div className="pr-sub" style={{marginBottom:10}}>Running balance view for audit and reconciliation. Opening balance carried from prior transactions.</div>
              </div>
              <div className="pr-badges">
                <span className="pr-badge">Opening {fc(reportOpeningBalance)}</span>
                <span className="pr-badge">Credits {fc(reportCreditTotal)}</span>
                <span className="pr-badge">Debits {fc(reportDebitTotal)}</span>
                <span className="pr-badge">Closing {fc(reportClosingBalance)}</span>
              </div>
            </div>
          </div>
          <div className="pr-table-wrap" style={{border:'none',borderTop:'1px solid #E5E7EB',borderRadius:'0 0 12px 12px'}}>
            <table className="pr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Tag</th>
                  <th>Category</th>
                  <th className="pr-right">Debit</th>
                  <th className="pr-right">Credit</th>
                  <th className="pr-right">Running Bal.</th>
                </tr>
              </thead>
              <tbody>
                {mLedgerRows.length===0&&(
                  <tr>
                    <td colSpan="7" style={{textAlign:'center',padding:'16px 8px',color:'#6B7280'}}>No ledger entries recorded for {reportMonthLabel}.</td>
                  </tr>
                )}
                {mLedgerRows.map(t=>(
                  <tr key={t.id}>
                    <td className="pr-muted">{fd(t.date)}</td>
                    <td style={{maxWidth:260}}>{t.desc}</td>
                    <td><span className={`pr-pill ${t.tag==='COLLECTION'?'green':t.tag==='BAD_DEBT'?'red':t.tag==='LENDING'?'blue':'gold'}`}>{t.tag}</span></td>
                    <td className="pr-muted">{t.category||'—'}</td>
                    <td className="pr-right mono" style={{color:t.type==='DEBIT'?'#991B1B':'#9CA3AF'}}>{t.type==='DEBIT'?fc(t.amount):'—'}</td>
                    <td className="pr-right mono" style={{color:t.type==='CREDIT'?'#065F46':'#9CA3AF'}}>{t.type==='CREDIT'?fc(t.amount):'—'}</td>
                    <td className="pr-right mono" style={{fontWeight:700,color:t.runningBalance<0?'#991B1B':'#111827'}}>{fc(t.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pr-foot pr-break-avoid" style={{padding:'0 12px 12px'}}>
            <div className="pr-foot-note">
              Report includes operational performance (collections/expenses), risk controls (aging/PAR30/overdue ratio), and detailed ledger audit trail for the selected month.
            </div>
            <div className="pr-sign">
              Prepared by Accounts Office
              <div className="line"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* ─ MODALS ─ */}
    <Modal show={showSetup} onClose={()=>setShowSetup(false)} title="⚙ Opening Balance Setup">
      <p style={{color:'var(--st)',fontSize:13,marginBottom:14}}>Set the starting cash balance. One-time setup.</p>
      <span className="lbl">Opening Balance (₹)</span>
      <input className="inp" type="number" placeholder="e.g. 500000" value={setupBal} onChange={e=>setSetupBal(e.target.value)} autoFocus style={{marginBottom:14}}/>
      <div style={{display:'flex',gap:10}}>
        <button className="bgh" style={{flex:1,justifyContent:'center'}} onClick={()=>setShowSetup(false)}>Skip</button>
        <button className="bg" style={{flex:1,justifyContent:'center'}} onClick={handleSetup}>Set Balance</button>
      </div>
    </Modal>

    <Modal show={showCap} onClose={()=>setShowCap(false)} title="Inject Capital">
      <input className="inp" type="number" placeholder="Amount (₹)" value={capAmt} onChange={e=>setCapAmt(e.target.value)} autoFocus style={{marginBottom:14}}/>
      <div style={{display:'flex',gap:10}}>
        <button className="bgh" style={{flex:1,justifyContent:'center'}} onClick={()=>setShowCap(false)}>Cancel</button>
        <button className="bg" style={{flex:1,justifyContent:'center'}} onClick={handleCap}>Confirm</button>
      </div>
    </Modal>

    <Modal show={collect.show} onClose={()=>setCollect(blankCollect())} title="Record Collection">
      <div style={{background:'var(--ob3)',borderRadius:10,padding:'11px 14px',marginBottom:14}}>
        <p style={{fontSize:11,color:'var(--st)',marginBottom:2}}>Client</p>
        <p style={{fontSize:15,fontWeight:700}}>{collect.client}</p>
        <p style={{fontSize:12,color:'var(--st)',marginTop:4}}>Due: <span className="mono sn">{fc(collect.fullAmt)}</span></p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:9}}>
        <button className="bge" style={{justifyContent:'center'}} onClick={()=>submitCollect(false)}><I n="check" s={14}/> Receive Full — {fc(collect.fullAmt)}</button>
        <div style={{display:'flex',gap:8}}>
          <input className="inp" type="number" placeholder="Partial amount" value={collect.partAmt} onChange={e=>setCollect({...collect,partAmt:e.target.value})} style={{flex:1}}/>
          <button className="bg" onClick={()=>submitCollect(true)}>Partial</button>
        </div>
        {isBackendSession&&toNum(collect.partAmt)>0&&toNum(collect.partAmt)<toNum(collect.fullAmt)&&(
          <div className="card" style={{padding:11,borderStyle:'dashed'}}>
            {(() => {
              const cashVal=toNum(collect.partAmt);
              const tdsVal=toNum(collect.tdsAmt);
              const grossVal=cashVal+tdsVal;
              const remVal=Math.max(0,toNum(collect.fullAmt)-grossVal);
              return (
                <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
              <p style={{fontSize:12,fontWeight:700}}>Short Receipt Handling</p>
              <span className="mono sn" style={{fontSize:12}}>Cash shortfall {fc(Math.max(0,toNum(collect.fullAmt)-cashVal))}</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div>
                <span className="lbl">Reason</span>
                <select className="inp" value={collect.shortReceiptReason||'PARTIAL'} onChange={e=>{
                  const next=e.target.value;
                  setCollect(c=>({
                    ...c,
                    shortReceiptReason:next,
                    tdsAmt:next==='TDS' && !String(c.tdsAmt||'').trim()
                      ? String(Math.max(0,toNum(c.fullAmt)-toNum(c.partAmt))||'')
                      : c.tdsAmt,
                  }));
                }}>
                  <option value="PARTIAL">Partial Payment</option>
                  <option value="TDS">TDS Deducted</option>
                </select>
              </div>
              {String(collect.shortReceiptReason||'PARTIAL').toUpperCase()==='TDS'&&(
                <div>
                  <span className="lbl">TDS Status</span>
                  <select className="inp" value={collect.tdsReceiptStatus||'PENDING'} onChange={e=>setCollect({...collect,tdsReceiptStatus:e.target.value})}>
                    <option value="PENDING">Pending</option>
                    <option value="RECEIVED">Received</option>
                  </select>
                </div>
              )}
            </div>
            {String(collect.shortReceiptReason||'PARTIAL').toUpperCase()==='TDS'&&(
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <div>
                    <span className="lbl">Cash Received (editable)</span>
                    <input className="inp" type="number" value={collect.partAmt} onChange={e=>setCollect({...collect,partAmt:e.target.value})} placeholder="Cash amount"/>
                  </div>
                  <div>
                    <span className="lbl">TDS Amount (editable)</span>
                    <input className="inp" type="number" value={collect.tdsAmt||''} onChange={e=>setCollect({...collect,tdsAmt:e.target.value})} placeholder="TDS deducted"/>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:8}}>
                  <div><span className="lbl">Gross EMI Settled</span><input className="inp" value={fc(grossVal)} readOnly/></div>
                  <div><span className="lbl">Installment Due</span><input className="inp" value={fc(collect.fullAmt)} readOnly/></div>
                  <div><span className="lbl">Still Pending</span><input className="inp" value={fc(remVal)} readOnly/></div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <div>
                    <span className="lbl">Deducted By</span>
                    <select className="inp" value={collect.tdsDeducedBy||'AUTO'} onChange={e=>setCollect({...collect,tdsDeducedBy:e.target.value})}>
                      <option value="AUTO">Auto (Client/Tie-up)</option>
                      <option value="CLIENT">Client</option>
                      <option value="TIE_UP_PARTNER">Tie-up Partner</option>
                    </select>
                  </div>
                  <div>
                    <span className="lbl">Certificate Ref (optional)</span>
                    <input className="inp" value={collect.tdsCertificateRef||''} onChange={e=>setCollect({...collect,tdsCertificateRef:e.target.value})} placeholder="TDS cert / challan ref"/>
                  </div>
                </div>
                <div>
                  <span className="lbl">TDS Notes (optional)</span>
                  <input className="inp" value={collect.tdsNotes||''} onChange={e=>setCollect({...collect,tdsNotes:e.target.value})} placeholder="Who deducted / month-end note"/>
                </div>
                <p style={{fontSize:11,color:'var(--st)',marginTop:8,lineHeight:1.4}}>This will settle the installment on gross EMI and auto-create a linked TDS receivable follow-up entry.</p>
              </>
            )}
                </>
              );
            })()}
          </div>
        )}
        <button className="bd" style={{justifyContent:'center'}} onClick={()=>submitCollect(false,true)}><I n="alert" s={14}/> Mark as Bad Debt</button>
      </div>
    </Modal>

    <Modal show={!!closeLoan} onClose={()=>setCloseLoan(null)} title="Close Loan">
      {closeLoan&&<>
        <div className="card-red" style={{padding:'11px 14px',marginBottom:14}}>
          <p style={{fontSize:12,color:'var(--st)',marginBottom:4}}>⚠ Marks all pending instalments as Closed and locks the loan.</p>
          <p style={{fontSize:14,fontWeight:700}}>{closeLoan.client} — {closeLoan.id}</p>
        </div>
        <p style={{fontSize:13,color:'var(--st)',marginBottom:14}}>
          Remaining: <span className="mono sn">{fc(closeLoan.schedule.filter(p=>p.status==='Pending'||p.status==='Partial').reduce((a,p)=>a+(p.payment-(p.paid||0)),0))}</span> across {closeLoan.schedule.filter(p=>p.status==='Pending'||p.status==='Partial').length} instalments.
        </p>
        <div style={{display:'flex',gap:10}}>
          <button className="bgh" style={{flex:1,justifyContent:'center'}} onClick={()=>setCloseLoan(null)}>Cancel</button>
          <button className="bd" style={{flex:1,justifyContent:'center'}} onClick={()=>handleCloseLoan(closeLoan)}><I n="lock" s={14}/> Confirm Close</button>
        </div>
      </>}
    </Modal>

    <Modal show={showSms} onClose={()=>setShowSms(false)} title="SMS Reminder Messages" wide>
      <p style={{color:'var(--st)',fontSize:13,marginBottom:12}}>{ovMsg.length} overdue accounts. Copy messages to send.</p>
      <div style={{maxHeight:320,overflowY:'auto',display:'flex',flexDirection:'column',gap:8,marginBottom:14}}>
        {ovMsg.length===0&&<p style={{color:'var(--st)'}}>No overdue accounts 🎉</p>}
        {ovMsg.map((row,i)=>(
          <div key={i} style={{background:'var(--ob3)',borderRadius:10,padding:'11px 13px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
            <div style={{flex:1}}>
              <p style={{fontSize:11,color:'var(--st)',margin:'0 0 4px 0'}}>{row.client}{row.phone&&` • ${row.phone}`}</p>
              <p style={{fontSize:12,lineHeight:1.5,margin:0}}>{row.msg}</p>
            </div>
            <button className="bgh" style={{padding:'5px 10px',flexShrink:0,fontSize:11}} onClick={()=>navigator.clipboard.writeText(row.msg)}>Copy</button>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:10}}>
        <button className="bg" style={{flex:1,justifyContent:'center'}} onClick={()=>{navigator.clipboard.writeText(ovMsg.map(o=>o.msg).join('\n\n'));alert('All copied!');}}>Copy All</button>
        <button className="bb" style={{flex:1,justifyContent:'center'}} onClick={expReminderCSV}><I n="download" s={13}/> Export CSV</button>
        <button className="bgh" style={{justifyContent:'center'}} onClick={()=>setShowSms(false)}>Close</button>
      </div>
    </Modal>

    <Modal show={!!editProfile} onClose={()=>setEditProfile(null)} title="Client Profile" wide>
      {editProfile&&<>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div><span className="lbl">Client Name</span><input className="inp" value={editProfile.name} disabled/></div>
          <div><span className="lbl">Mobile Number</span><input className="inp" value={editProfile.phone} onChange={e=>setEditProfile({...editProfile,phone:e.target.value})} placeholder="e.g. 9876543210"/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div><span className="lbl">KYC / ID Ref</span><input className="inp" value={editProfile.kycRef} onChange={e=>setEditProfile({...editProfile,kycRef:e.target.value})} placeholder="PAN / Aadhaar / File Ref"/></div>
          <div><span className="lbl">Risk Grade</span><select className="inp" value={editProfile.riskGrade||'STANDARD'} onChange={e=>setEditProfile({...editProfile,riskGrade:e.target.value})}>{Object.entries(RISK_META).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div><span className="lbl">Funding Type</span><select className="inp" value={editProfile.fundingChannel||'DIRECT'} onChange={e=>setEditProfile({...editProfile,fundingChannel:e.target.value})}><option value="DIRECT">DIRECT</option><option value="TIE_UP">TIE_UP</option></select></div>
          <div>
            <span className="lbl">Tie-up Partner (Choose / Add)</span>
            <input className="inp" list="tieup-party-list" value={editProfile.tieUpPartnerName||''} onChange={e=>setEditProfile({...editProfile,tieUpPartnerName:e.target.value})} placeholder="Partner / intermediary name" disabled={(editProfile.fundingChannel||'DIRECT')!=='TIE_UP'}/>
            <datalist id="tieup-party-list">
              {tieUpPartyOptions.map(n=><option key={n} value={n}/>)}
            </datalist>
          </div>
        </div>
        <div style={{marginBottom:10}}><span className="lbl">Address</span><input className="inp" value={editProfile.address} onChange={e=>setEditProfile({...editProfile,address:e.target.value})} placeholder="Address / locality"/></div>
        <div style={{marginBottom:14}}><span className="lbl">Notes</span><textarea className="inp" value={editProfile.notes} onChange={e=>setEditProfile({...editProfile,notes:e.target.value})} rows="3" placeholder="Risk notes, guarantor details, follow-up remarks..." style={{resize:'vertical'}}/></div>
        <div style={{display:'flex',gap:10}}>
          <button className="bgh" style={{flex:1,justifyContent:'center'}} onClick={()=>setEditProfile(null)}>Cancel</button>
          <button className="bg" style={{flex:1,justifyContent:'center'}} onClick={saveProfileEdit}>Save Profile</button>
        </div>
      </>}
    </Modal>

    <Modal show={!!calDay} onClose={()=>setCalDay(null)} title={calDay?`Payments — ${calDay}`:''}>
      {calDay&&calData[calDay]&&<div style={{display:'flex',flexDirection:'column',gap:9}}>
        {calData[calDay].payments.map((p,i)=>(
          <div key={i} className="ai">
            <div style={{width:8,height:8,borderRadius:'50%',background:p.overdue?'var(--red)':'var(--yellow)',flexShrink:0}}/>
            <div style={{flex:1}}><p style={{margin:0,fontWeight:600,fontSize:14}}>{p.client}</p><p style={{margin:0,fontSize:11,color:'var(--st)'}}>{p.overdue?'OVERDUE':'DUE'}</p></div>
            <span className="mono sn" style={{fontWeight:700}}>{fc(p.amt)}</span>
            <button className="bg" style={{padding:'5px 10px',fontSize:11}} onClick={()=>{setCalDay(null);openCollect(p.loanId,p.idx,p.amt,p.client);}}>Collect</button>
          </div>
        ))}
        {calData[calDay].paid.map((p,i)=>(
          <div key={i} className="ai" style={{background:'rgba(52,211,153,.05)',borderColor:'rgba(52,211,153,.2)'}}>
            <I n="check" s={14} c="sp"/><p style={{flex:1,margin:0,fontWeight:600,fontSize:14}}>{p.client}</p><span className="mono sp">{fc(p.amt)}</span>
          </div>
        ))}
      </div>}
    </Modal>

    {/* Client Detail */}
    {cDetail&&detailC&&(
      <div className="mo fade-in" onClick={e=>e.target===e.currentTarget&&setCDetail(null)}>
        <div className="md" style={{maxWidth:700,maxHeight:'88vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
            <div>
              <h3 style={{fontSize:19,fontWeight:800}}>{detailC.name}</h3>
              <p style={{fontSize:12,color:'var(--st)',marginTop:3}}>{detailC.loans.length} loan(s) · Due: <span className="sn">{fc(detailC.totalDue)}</span> · Profit: <span className="sp">{fc(detailC.totalIP)}</span></p>
              <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:7}}>
                {detailC.phone&&<span className="badge bg-b">{detailC.phone}</span>}
                {detailC.kycRef&&<span className="badge bg-go">KYC: {detailC.kycRef}</span>}
                <span className={`badge ${RISK_META[detailC.riskGrade||'STANDARD']?.cls||'bg-g'}`}>{RISK_META[detailC.riskGrade||'STANDARD']?.label||'Standard'}</span>
                <span className={`badge ${detailC.fundingChannel==='TIE_UP'?'bg-go':'bg-b'}`}>{detailC.fundingChannel==='TIE_UP'?'Tie-up Client':'Direct Client'}</span>
                {detailC.fundingChannel==='TIE_UP'&&detailC.tieUpPartnerName&&<span className="badge bg-gr">Partner: {detailC.tieUpPartnerName}</span>}
              </div>
              {(detailC.address||detailC.notes)&&<p style={{fontSize:11,color:'var(--st)',marginTop:7,maxWidth:540,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={[detailC.address,detailC.notes].filter(Boolean).join(' | ')}>{detailC.address||detailC.notes}</p>}
            </div>
            <button onClick={()=>setCDetail(null)} style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:8,width:30,height:30,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--st)'}}><I n="x" s={14}/></button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:14}}>
            {[['Total Borrowed',fc(detailC.totalP),''],['Total Collected',fc(detailC.totalColl),'sp'],['Interest Profit',fc(detailC.totalIP),'sp']].map(([l,v,c])=>(
              <div key={l} className="card" style={{padding:'11px 13px'}}>
                <p style={{fontSize:10,color:'var(--st)',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{l}</p>
                <p className={`mono ${c}`} style={{fontSize:15,fontWeight:700}}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            {isBackendSession&&detailC.backendId&&(
              <div className="card" style={{marginBottom:12,padding:14}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}>
                  <div>
                    <h4 style={{fontSize:14,fontWeight:700}}>TDS Tracker (Client-wise)</h4>
                    <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>Record TDS deducted on interest. EMI reconciliation uses: cash received + TDS = gross EMI covered.</p>
                  </div>
                  <button className="bgh" style={{padding:'6px 10px',fontSize:11}} onClick={()=>loadClientTds(detailC.backendId)}>{tdsBusy?'Loading...':'Refresh TDS'}</button>
                </div>
                {tdsMetaByClientId[detailC.backendId]?.error&&<div style={{fontSize:11,color:'var(--red)',marginBottom:8}}>{tdsMetaByClientId[detailC.backendId].error}</div>}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                  {detailC.fundingChannel==='TIE_UP'&&(
                    <>
                      <div><span className="lbl">TDS Entry Basis</span><select className="inp" value={tdsForm.entryScope} onChange={e=>setTdsForm({...tdsForm,entryScope:e.target.value})}><option value="CLIENT">CLIENT_WISE</option><option value="TIE_UP_PARTY_MONTHLY">TIE_UP_PARTY_MONTHLY</option></select></div>
                      <div><span className="lbl">Tie-up Partner</span><input className="inp" list="tieup-party-list" value={tdsForm.tieUpPartnerName||detailC.tieUpPartnerName||''} onChange={e=>setTdsForm({...tdsForm,tieUpPartnerName:e.target.value})} placeholder="Tie-up partner name"/></div>
                    </>
                  )}
                  <div><span className="lbl">Deduction Date</span><input className="inp" type="date" value={tdsForm.deductionDate} onChange={e=>setTdsForm({...tdsForm,deductionDate:e.target.value,periodMonth:e.target.value?.slice(0,7)||tdsForm.periodMonth})}/></div>
                  <div><span className="lbl">Period Month</span><input className="inp" type="month" value={tdsForm.periodMonth} onChange={e=>setTdsForm({...tdsForm,periodMonth:e.target.value})}/></div>
                  <div><span className="lbl">Gross EMI (Cash+TDS)</span><input className="inp" type="number" value={tdsForm.grossEmiAmount} onChange={e=>setTdsForm({...tdsForm,grossEmiAmount:e.target.value})}/></div>
                  <div><span className="lbl">Cash Received (EMI)</span><input className="inp" type="number" value={tdsForm.cashReceivedAmount} onChange={e=>setTdsForm({...tdsForm,cashReceivedAmount:e.target.value})}/></div>
                  <div><span className="lbl">TDS Deducted</span><input className="inp" type="number" value={tdsForm.tdsAmount} onChange={e=>setTdsForm({...tdsForm,tdsAmount:e.target.value})}/></div>
                  <div><span className="lbl">TDS % (optional)</span><input className="inp" type="number" value={tdsForm.tdsRatePercent} onChange={e=>setTdsForm({...tdsForm,tdsRatePercent:e.target.value})}/></div>
                  <div><span className="lbl">TDS Receipt Status</span><select className="inp" value={tdsForm.receiptStatus} onChange={e=>setTdsForm({...tdsForm,receiptStatus:e.target.value})}><option value="PENDING">PENDING</option><option value="RECEIVED">RECEIVED</option></select></div>
                  <div><span className="lbl">Received Date (ITR)</span><input className="inp" type="date" value={tdsForm.receivedDate} onChange={e=>setTdsForm({...tdsForm,receivedDate:e.target.value})} disabled={tdsForm.receiptStatus!=='RECEIVED'}/></div>
                  <div><span className="lbl">Source Type</span><select className="inp" value={tdsForm.entryScope==='TIE_UP_PARTY_MONTHLY'?'TIE_UP_SETTLEMENT':tdsForm.sourceType} onChange={e=>setTdsForm({...tdsForm,sourceType:e.target.value})} disabled={tdsForm.entryScope==='TIE_UP_PARTY_MONTHLY'}><option value="CLIENT_COLLECTION">CLIENT_COLLECTION</option><option value="TIE_UP_SETTLEMENT">TIE_UP_SETTLEMENT</option><option value="MANUAL">MANUAL</option></select></div>
                  {tdsForm.entryScope!=='TIE_UP_PARTY_MONTHLY'&&<div><span className="lbl">Loan ID (optional)</span><input className="inp" value={tdsForm.loanId} onChange={e=>setTdsForm({...tdsForm,loanId:e.target.value})}/></div>}
                  {tdsForm.entryScope!=='TIE_UP_PARTY_MONTHLY'&&<div><span className="lbl">Collection ID (optional)</span><input className="inp" value={tdsForm.collectionId} onChange={e=>setTdsForm({...tdsForm,collectionId:e.target.value})}/></div>}
                  <div><span className="lbl">Certificate Ref</span><input className="inp" value={tdsForm.certificateRef} onChange={e=>setTdsForm({...tdsForm,certificateRef:e.target.value})}/></div>
                  <div style={{gridColumn:'span 4'}}><span className="lbl">Notes</span><input className="inp" value={tdsForm.notes} onChange={e=>setTdsForm({...tdsForm,notes:e.target.value})} placeholder="Quarter, challan/certificate note, tie-up narration..." /></div>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:10}}>
                  <div style={{fontSize:11,color:'var(--st)'}}>
                    Reconciliation check: <span className={`mono ${Math.abs((toNum(tdsForm.grossEmiAmount)-toNum(tdsForm.cashReceivedAmount)-toNum(tdsForm.tdsAmount)))<=0.01?'sp':'sn'}`}>{fc(toNum(tdsForm.grossEmiAmount)-toNum(tdsForm.cashReceivedAmount)-toNum(tdsForm.tdsAmount))}</span> variance
                  </div>
                  <button className="bg" style={{padding:'7px 12px',fontSize:12}} onClick={()=>addTdsEntry(detailC)}>Save TDS Entry</button>
                </div>
                {(()=>{const sum=tdsMetaByClientId[detailC.backendId]||{};return(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                    <div className="card" style={{padding:'9px 10px'}}><p style={{fontSize:9,color:'var(--st)',textTransform:'uppercase',fontWeight:700}}>Gross EMI Tagged</p><p className="mono">{fc(toNum(sum.gross_emi_total))}</p></div>
                    <div className="card" style={{padding:'9px 10px'}}><p style={{fontSize:9,color:'var(--st)',textTransform:'uppercase',fontWeight:700}}>TDS Total</p><p className="mono">{fc(toNum(sum.tds_total))}</p></div>
                    <div className="card" style={{padding:'9px 10px'}}><p style={{fontSize:9,color:'var(--st)',textTransform:'uppercase',fontWeight:700}}>TDS Pending (ITR)</p><p className="mono sn">{fc(toNum(sum.tds_pending))}</p></div>
                    <div className="card" style={{padding:'9px 10px'}}><p style={{fontSize:9,color:'var(--st)',textTransform:'uppercase',fontWeight:700}}>TDS Received (ITR)</p><p className="mono sp">{fc(toNum(sum.tds_received))}</p></div>
                  </div>
                );})()}
                <div style={{maxHeight:220,overflowY:'auto',border:'1px solid var(--border)',borderRadius:8}}>
                  <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr><th>Date</th><th>Period</th><th>Type</th><th style={{textAlign:'right'}}>Cash EMI</th><th style={{textAlign:'right'}}>TDS</th><th style={{textAlign:'right'}}>Gross EMI</th><th>Status</th><th>Tag</th></tr></thead>
                    <tbody>
                      {(tdsByClientId[detailC.backendId]||[]).map(r=>{
                        const variance=toNum(r.reconciliationVariance);
                        return(
                          <tr key={r.id}>
                            <td>{fd(r.deductionDate)}</td>
                            <td>{r.periodMonth||'—'}</td>
                            <td style={{fontSize:10}}>{r.sourceType}</td>
                            <td className="mono" style={{textAlign:'right'}}>{fc(r.cashReceivedAmount)}</td>
                            <td className="mono" style={{textAlign:'right'}}>{fc(r.tdsAmount)}</td>
                            <td className="mono" style={{textAlign:'right'}}>{fc(r.grossEmiAmount)}</td>
                            <td>
                              <button className={r.receiptStatus==='RECEIVED'?'bb':'bd'} style={{padding:'3px 7px',fontSize:10}} onClick={()=>updateTdsStatus(detailC.backendId,r.id,r.receiptStatus==='RECEIVED'?'PENDING':'RECEIVED')}>
                                {r.receiptStatus}
                              </button>
                            </td>
                            <td>
                              <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                                <span className={`badge ${r.fundingChannel==='TIE_UP'?'bg-go':'bg-b'}`}>{r.fundingChannel==='TIE_UP'?'Tie-up':'Direct'}</span>
                                {r.tieUpPartnerName&&<span className="badge bg-gr" title={r.tieUpPartnerName}>{r.tieUpPartnerName}</span>}
                                {Math.abs(variance)>0.01&&<span className="badge bg-r">VAR {fc(variance)}</span>}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!(tdsByClientId[detailC.backendId]||[]).length&&<tr><td colSpan="8" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No TDS entries for this client yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {detailC.loans.map(l=>{
              const coll=l.schedule.reduce((a,p)=>a+(p.paid||0),0);
              const pct=l.total?Math.round((coll/l.total)*100):0;
              return(
                <div key={l.id} className="card" style={{marginBottom:12,padding:14}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:9}}>
                    <div>
                      <span className="mono" style={{fontSize:11,color:'var(--gold)'}}>{l.id}</span>
                      <p style={{fontSize:10,color:'var(--st)',marginTop:2}}>Started {fd(l.startDate)} · {FREQ[l.freq]?.label||l.freq}</p>
                      {(l.purpose||l.kycRef)&&<p style={{fontSize:10,color:'var(--st)',marginTop:2}}>{l.purpose&&`Purpose: ${l.purpose}`}{l.purpose&&l.kycRef?' · ':''}{l.kycRef&&`KYC: ${l.kycRef}`}</p>}
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span className={`badge ${l.status==='Active'?'bg-g':'bg-b'}`}>{l.status}</span>
                      {l.status==='Active'&&<button className="bd" style={{padding:'3px 8px',fontSize:11}} onClick={()=>setCloseLoan(l)}><I n="lock" s={11}/> Close</button>}
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:9,fontSize:11}}>
                    {[['Principal',fc(l.principal),''],['Interest',fc(l.interest),'sp'],['Total',fc(l.total),''],['Progress',`${pct}%`,'sp']].map(([lb,v,c])=>(
                      <div key={lb}><p style={{color:'var(--st)',fontSize:9,marginBottom:2}}>{lb}</p><p className={`mono ${c}`} style={{fontWeight:600}}>{v}</p></div>
                    ))}
                  </div>
                  <div style={{background:'var(--ob3)',borderRadius:4,height:4,overflow:'hidden',marginBottom:9}}>
                    <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,var(--gold),var(--gold-light))',borderRadius:4}}/>
                  </div>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
                    {l.schedule.map(p=>{
                      const cs=p.status==='Paid'?'bg-g':p.status==='Partial'?'bg-y':p.status==='Bad Debt'||p.status==='Closed'?'bg-gr':'bg-r';
                      return<span key={p.no} className={`badge ${cs}`} title={`${fd(p.date)} — ${fc(p.payment)}`}>#{p.no}</span>;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* ─ SIDEBAR ─ */}
    <div className="no-print" style={{width:230,background:'var(--ob2)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',flexShrink:0}}>
      <div style={{padding:'18px 16px 12px',borderBottom:'1px solid var(--border)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,background:'linear-gradient(135deg,#C9A84C,#8B6020)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <I n="wallet" s={16}/>
          </div>
          <div><div style={{fontFamily:'Syne',fontWeight:800,fontSize:14}}>Yash Portfolio</div><div style={{fontSize:10,color:'var(--st)'}}>Finance ERP v5.0</div></div>
        </div>
      </div>
      <div style={{padding:'10px 12px',borderBottom:'1px solid var(--border)'}}>
        <div className="bc">
          <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:'var(--st)',marginBottom:3}}>Cash Balance</p>
          <p className={`mono ${bal<0?'sn':'sp'}`} style={{fontSize:19,fontWeight:700}}>{fc(bal)}</p>
        </div>
      </div>
      <nav style={{flex:1,padding:8,overflowY:'auto'}}>
        {[
          {id:'DASHBOARD',  icon:'dashboard', label:'Dashboard'},
          {id:'ALERTS',     icon:'alert',     label:'Alerts',      badge:alertCount},
          {id:'NEW_LOAN',   icon:'user',      label:'New Loan'},
          {id:'COLLECTIONS',icon:'coins',     label:'Collections'},
          {id:'CLIENT_MASTER',icon:'users',   label:'Client Master'},
          {id:'LEDGER',     icon:'list',      label:'Full Ledger'},
          {id:'CALENDAR',   icon:'calendar',  label:'Calendar'},
          {id:'EXPENSES',   icon:'card',      label:'Expenses'},
          {id:'CHITS',      icon:'percent',   label:'Chits ROI'},
          {id:'REPORTS',    icon:'report',    label:'Reports'},
          {id:'PDF',        icon:'printer',   label:'PDF Generator'},
        ].map(item=>(
          <div key={item.id} className={`ni ${view===item.id?'active':''}`} onClick={()=>setView(item.id)}>
            <I n={item.icon} s={14}/><span>{item.label}</span>
            {item.badge>0&&<span className="nb">{item.badge}</span>}
          </div>
        ))}
      </nav>
      <div style={{padding:8,borderTop:'1px solid var(--border)'}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginBottom:6}}>
          {[['db','Export',expData],['upload','Import',()=>fileRef.current.click()],['settings','Setup',()=>setShowSetup(true)]].map(([ic,lb,fn])=>(
            <button key={lb} onClick={fn} style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 3px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:3,color:'var(--st)',fontSize:9,fontWeight:600}}>
              <I n={ic} s={13}/>{lb}
            </button>
          ))}
        </div>
        <input type="file" ref={fileRef} onChange={impData} accept=".json" style={{display:'none'}}/>
        <button onClick={handleLogout} style={{width:'100%',background:'rgba(255,107,107,.08)',border:'1px solid rgba(255,107,107,.15)',borderRadius:8,padding:'7px',cursor:'pointer',color:'var(--red)',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
          <I n="logout" s={13}/> Logout
        </button>
      </div>
    </div>

    {/* ─ MAIN ─ */}
    <div style={{flex:1,overflowY:'auto',background:'var(--ob)',padding:'26px 30px'}} className="no-print">

      {/* DASHBOARD */}
      {view==='DASHBOARD'&&(
        <div className="fade-in">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:22}}>
            <div>
              <h2 style={{fontSize:24,fontWeight:800}}>Dashboard</h2>
              <p style={{color:'var(--st)',fontSize:13,marginTop:2}}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
            </div>
            <div style={{display:'flex',gap:9}}>
              {alertCount>0&&<button className="bd" onClick={()=>setView('ALERTS')}><I n="alert" s={14}/> {alertCount} Alert{alertCount>1?'s':''}</button>}
              <button className="bg" onClick={()=>setShowCap(true)}><I n="plus" s={14}/> Add Capital</button>
            </div>
          </div>
          {BACKEND_API_ENABLED&&(
            <div className="card" style={{padding:16,marginBottom:14,borderColor:'rgba(96,165,250,.2)',background:'linear-gradient(180deg, rgba(96,165,250,.04), rgba(96,165,250,.01))'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',marginBottom:10}}>
                <div>
                  <h3 style={{fontSize:13,fontWeight:700}}>Backend Live Dashboard (API)</h3>
                  <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>
                    {backendAuth?.organization?.name||'Connected organization'}
                    {backendDash.lastFetchedAt?` · Updated ${new Date(backendDash.lastFetchedAt).toLocaleTimeString('en-IN')}`:''}
                  </p>
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <span className="badge bg-b">{backendDash.loading?'Syncing...':'API Connected'}</span>
                  {backendDash.error&&<span className="badge bg-r" title={backendDash.error}>API Error</span>}
                </div>
              </div>
              {backendDash.error&&<div style={{background:'rgba(255,107,107,.08)',border:'1px solid rgba(255,107,107,.18)',borderRadius:8,padding:'8px 10px',fontSize:12,color:'var(--red)',marginBottom:10}}>{backendDash.error}</div>}
              {!!backendDash.summary&&!!backendDash.risk&&(
                <>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:10,marginBottom:10}}>
                    <SC label="API Cash" value={fc(backendDash.summary.cashBalance)} col={backendDash.summary.cashBalance<0?'sn':'sp'} sub={`Capital ${fc(backendDash.summary.totalCapital)}`}/>
                    <SC label="API Arrear" value={fc(backendDash.summary.receivables)} col="sn" sub="Total receivable (live)"/>
                    <SC label="API Overdue" value={fc(backendDash.risk.overdueAmount)} col={backendDash.risk.overdueAmount>0?'sn':'sp'} sub={`${(backendDash.risk.overdueRatio||0).toFixed(1)}% overdue ratio`}/>
                    <SC label="API PAR30" value={`${(backendDash.risk.par30Ratio||0).toFixed(1)}%`} col={(backendDash.risk.par30Ratio||0)>0?'sn':'sp'} sub={fc(backendDash.risk.par30Amount||0)}/>
                    <SC label="API Interest Income" value={fc(backendDash.summary.interestIncome)} col="sp" sub={`Net ${fc(backendDash.summary.netProfit)}`}/>
                    <SC label="API Next 7 Due" value={fc(backendDash.risk.next7Due||0)} col={(backendDash.risk.next7Due||0)>0?'sw':'sp'} sub={`${backendDash.summary.activeLoans||0} active loans`}/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                      <p style={{fontSize:11,color:'var(--st)',marginBottom:6}}>API Aging Buckets</p>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        {Object.entries(backendDash.risk.aging||{}).map(([k,v])=><span key={k} className="badge bg-gr">{k}: {fc(v)}</span>)}
                      </div>
                    </div>
                    <div style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                      <p style={{fontSize:11,color:'var(--st)',marginBottom:6}}>Top API Overdue Clients</p>
                      {(backendDash.risk.topOverdueClients||[]).length===0&&<p style={{fontSize:11,color:'var(--st)'}}>No overdue exposure from backend.</p>}
                      {(backendDash.risk.topOverdueClients||[]).slice(0,3).map((r,i)=>(
                        <div key={`${r.client_id||r.client_name}-${i}`} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'2px 0'}}>
                          <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:8}}>{r.client_name||r.client}</span>
                          <span className="mono sn">{fc(r.overdue_amount||r.amount||0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:12,marginBottom:18}}>
            <SC label="Cash In Hand" value={fc(bal)} col={bal<0?'sn':'sp'} sub={`Base: ${fc(stats.totalCap)}`}/>
            <SC label="Receivables" value={fc(stats.recv)} col="sb" sub={`${stats.activeLoans} active · ${stats.closedLoans} closed`}/>
            <SC label="Revenue Collected" value={fc(stats.revenue)} col="sp" sub={`Disbursed: ${fc(stats.totalDisbursed)}`}/>
            <SC label="Avg. Interest Rate" value={`${stats.avgInterestRate.toFixed(2)}%`} col={stats.avgInterestRate>0?'sp':'sb'} sub="Weighted by active principal"/>
            <SC label="Net Profit (Est.)" value={fc(stats.netProfit)} col={stats.netProfit>=0?'sp':'sn'} sub={`Expenses: ${fc(stats.totalExp)}`}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:12}}>
            <SC label="PAR30 (Receivable)" value={fc(stats.par30Amt)} col={stats.par30Amt>0?'sn':'sp'} sub={`${stats.par30Ratio.toFixed(1)}% of receivables`}/>
            <SC label="Overdue Ratio" value={`${stats.overdueRatio.toFixed(1)}%`} col={stats.overdueRatio>25?'sn':stats.overdueRatio>10?'sw':'sp'} sub={fc(stats.overdueAmt)}/>
            <SC label="This Month CE" value={`${stats.collectionEfficiency.toFixed(1)}%`} col={stats.collectionEfficiency<80?'sn':stats.collectionEfficiency<95?'sw':'sp'} sub={`${stats.paidThisMonthCount}/${stats.dueThisMonthCount||0} EMIs fully paid`}/>
            <SC label="Next 7 Days Due" value={fc(stats.next7Due)} col={stats.next7Due>0?'sw':'sp'} sub="Forward cash planning"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
            <div className="card" style={{padding:18}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <h3 style={{fontSize:13,fontWeight:700}}>Cash Flow (6 Mo.)</h3>
                <div style={{display:'flex',gap:10,fontSize:10,color:'var(--st)'}}>
                  {[['var(--green)','In'],['var(--red)','Out']].map(([bg,l])=><span key={l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:7,height:7,background:bg,borderRadius:2,display:'inline-block'}}></span>{l}</span>)}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'flex-end',gap:7,height:110}}>
                {cashflow.map((d,i)=>(
                  <div key={i} className="bg2" title={`${d.label} | In:${fc(d.inflow)} Out:${fc(d.outflow)}`}>
                    <div className="bw"><div className="bar" style={{height:`${(d.inflow/maxCF)*100}%`,background:'var(--green)',opacity:.85}}/><div className="bar" style={{height:`${(d.outflow/maxCF)*100}%`,background:'var(--red)',opacity:.7}}/></div>
                    <span style={{fontSize:9,color:'var(--st)'}}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{padding:18}}>
              <h3 style={{fontSize:13,fontWeight:700,marginBottom:12}}>Receivables Aging</h3>
              {Object.entries(stats.aging).map(([l,v])=>(
                <div key={l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 9px',borderRadius:7,marginBottom:4,background:v>0?'var(--ob3)':'transparent'}}>
                  <span style={{fontSize:12,color:v>0?'#E8E8F0':'var(--st)'}}>{l} days</span>
                  <span className={`mono ${v>0?(l==='90+'?'sn':'sb'):''}`} style={{fontSize:12,fontWeight:600}}>{fc(v)}</span>
                </div>
              ))}
              <div style={{marginTop:9,paddingTop:9,borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between'}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--st)'}}>TOTAL OVERDUE</span>
                <span className="mono sn" style={{fontWeight:700}}>{fc(stats.overdueAmt)}</span>
              </div>
            </div>
          </div>
          {stats.topOverdueClients.length>0&&<div className="card" style={{padding:18,marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <h3 style={{fontSize:13,fontWeight:700}}>Top Overdue Exposure</h3>
              <button className="bgh" style={{padding:'5px 10px',fontSize:11}} onClick={()=>setView('ALERTS')}><I n="alert" s={12}/> Open Alerts</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:8}}>
              {stats.topOverdueClients.map((row,i)=>{
                const c=clientMap.find(x=>x.name===row.client);
                return(
                  <div key={row.client+i} style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:6}}>
                      <span style={{fontSize:12,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.client}>{row.client}</span>
                      {c&&<span className={`badge ${RISK_META[c.riskGrade||'STANDARD']?.cls||'bg-g'}`}>{RISK_META[c.riskGrade||'STANDARD']?.label||'Standard'}</span>}
                    </div>
                    {c?.phone&&<p style={{fontSize:10,color:'var(--st)',marginTop:3}}>{c.phone}</p>}
                    <p className="mono sn" style={{fontSize:14,fontWeight:700,marginTop:6}}>{fc(row.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>}
          {expBrk.length>0&&<div className="card" style={{padding:18}}>
            <h3 style={{fontSize:13,fontWeight:700,marginBottom:12}}>Expense Breakdown</h3>
            {expBrk.map((e,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <span style={{width:150,fontSize:11,color:'var(--st)',textAlign:'right',flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.l}</span>
                <div style={{flex:1,background:'var(--ob3)',borderRadius:4,height:6,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(e.v/maxExp)*100}%`,background:'linear-gradient(90deg,var(--red),#FF9B9B)',borderRadius:4}}/>
                </div>
                <span className="mono" style={{fontSize:11,width:80,textAlign:'right',color:'#FF9B9B'}}>{fc(e.v)}</span>
              </div>
            ))}
          </div>}
        </div>
      )}

      {/* ALERTS */}
      {view==='ALERTS'&&(
        <div className="fade-in">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:22}}>
            <div><h2 style={{fontSize:24,fontWeight:800}}>Alerts</h2><p style={{color:'var(--st)',fontSize:13,marginTop:2}}>{stats.dueTodayList.length} due today · {stats.overdueList.length} overdue</p></div>
            <button className="bb" onClick={()=>setShowSms(true)}><I n="sms" s={14}/> SMS Reminder Export</button>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
            {[['Overdue Amount',fc(stats.overdueAmt),'sn'],['PAR30',`${stats.par30Ratio.toFixed(1)}%`,'sn'],['This Month Demand',fc(stats.monthDemand),'sb'],['This Month Collected',fc(stats.monthScheduledCollected),'sp']].map(([l,v,c])=>(
              <div key={l} className="card" style={{padding:'11px 12px'}}>
                <p style={{fontSize:10,color:'var(--st)',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{l}</p>
                <p className={`mono ${c}`} style={{fontSize:14,fontWeight:700}}>{v}</p>
              </div>
            ))}
          </div>
          {stats.dueTodayList.length>0&&<div style={{marginBottom:20}}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}><div style={{width:7,height:7,borderRadius:'50%',background:'var(--yellow)'}}/><h3 style={{fontSize:13,fontWeight:700,color:'var(--yellow)'}}>Due Today ({stats.dueTodayList.length})</h3></div>
            {stats.dueTodayList.map((o,i)=>(
              <div key={i} className="ai" style={{background:'rgba(251,191,36,.05)',borderColor:'rgba(251,191,36,.2)'}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:'var(--yellow)',flexShrink:0}}/>
                <div style={{flex:1}}><p style={{margin:0,fontWeight:700,fontSize:14}}>{o.client}</p><p style={{margin:0,fontSize:11,color:'var(--st)'}}>Due {fd(o.date)}{(clientProfiles[o.client]?.phone||o.clientPhone)?` · ${clientProfiles[o.client]?.phone||o.clientPhone}`:''}</p></div>
                <span className="mono sw" style={{fontWeight:700,marginRight:8}}>{fc(o.due)}</span>
                <button className="bg" style={{padding:'5px 11px',fontSize:11}} onClick={()=>openCollect(o.loanId,o.idx,o.due,o.client)}>Collect</button>
              </div>
            ))}
          </div>}
          {stats.overdueList.length>0&&<div>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}><div style={{width:7,height:7,borderRadius:'50%',background:'var(--red)'}}/><h3 style={{fontSize:13,fontWeight:700,color:'var(--red)'}}>Overdue ({stats.overdueList.length})</h3></div>
            {stats.overdueList.map((o,i)=>(
              <div key={i} className="ai">
                <div style={{width:7,height:7,borderRadius:'50%',background:'var(--red)',flexShrink:0}}/>
                <div style={{flex:1}}><p style={{margin:0,fontWeight:700,fontSize:14}}>{o.client}</p><p style={{margin:0,fontSize:11,color:'var(--st)'}}>Was due {fd(o.date)} · {o.daysLate} day{o.daysLate>1?'s':''} late{(clientProfiles[o.client]?.phone||o.clientPhone)?` · ${clientProfiles[o.client]?.phone||o.clientPhone}`:''}</p></div>
                <span className="mono sn" style={{fontWeight:700,marginRight:8}}>{fc(o.due)}</span>
                <button className="bg" style={{padding:'5px 11px',fontSize:11}} onClick={()=>openCollect(o.loanId,o.idx,o.due,o.client)}>Collect</button>
              </div>
            ))}
          </div>}
          {alertCount===0&&<div className="card" style={{padding:60,textAlign:'center'}}><p style={{fontSize:32,marginBottom:8}}>✅</p><h3 style={{fontWeight:700,marginBottom:4}}>All clear!</h3><p style={{color:'var(--st)',fontSize:13}}>No overdue or due-today payments.</p></div>}
        </div>
      )}

      {/* NEW LOAN */}
      {view==='NEW_LOAN'&&(
        <div className="fade-in" style={{maxWidth:760,margin:'0 auto'}}>
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:20}}>Disburse New Loan</h2>
          <div className="card" style={{padding:24}}>
            <div style={{marginBottom:14}}><span className="lbl">Client Name</span><input className="inp" value={newLoan.clientName} onChange={e=>setNL({...newLoan,clientName:e.target.value})} placeholder="Enter client name"/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
              <div><span className="lbl">Principal (₹)</span><input className="inp" type="number" value={newLoan.principal} onChange={e=>setNL({...newLoan,principal:e.target.value})}/></div>
              <div><span className="lbl">Interest (₹)</span><input className="inp" type="number" value={newLoan.interest} onChange={e=>setNL({...newLoan,interest:e.target.value})}/></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:18}}>
              <div><span className="lbl">Frequency</span><select className="inp" value={newLoan.freq} onChange={e=>setNL({...newLoan,freq:e.target.value})}>{Object.entries(FREQ).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><span className="lbl">Instalments</span><input className="inp" type="number" value={newLoan.duration} onChange={e=>setNL({...newLoan,duration:e.target.value})}/></div>
              <div><span className="lbl">Start Date</span><input className="inp" type="date" value={newLoan.startDate} onChange={e=>setNL({...newLoan,startDate:e.target.value})}/></div>
            </div>
            <div className="card-gold" style={{padding:13,marginBottom:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                {[['Total',fc((+newLoan.principal||0)+(+newLoan.interest||0)),'gold-text'],['Per Instalment',fc(((+newLoan.principal||0)+(+newLoan.interest||0))/(newLoan.duration||1)),''],['Eff. Rate',`${calcRate(newLoan.principal,newLoan.interest,newLoan.freq,newLoan.duration).toFixed(2)}%`,'sp']].map(([lb,v,c])=>(
                  <div key={lb} style={{textAlign:'center'}}><p style={{fontSize:10,color:'var(--st)',textTransform:'uppercase',fontWeight:700,marginBottom:3}}>{lb}</p><p className={`mono ${c}`} style={{fontSize:16,fontWeight:700}}>{v}</p></div>
                ))}
              </div>
            </div>
            <button className="bg" style={{width:'100%',justifyContent:'center',fontSize:14,padding:'12px',opacity:disburseBusy?0.85:1}} onClick={handleDisburse} disabled={disburseBusy}>{disburseBusy?'Disbursing...':`Disburse — ${fc(+newLoan.principal||0)}`}</button>
            <p style={{textAlign:'center',fontSize:11,color:'var(--st)',marginTop:7}}>Available: <span className={`mono ${bal<(+newLoan.principal||0)?'sn':'sp'}`}>{fc(bal)}</span></p>
          </div>
        </div>
      )}

      {/* COLLECTIONS */}
      {view==='COLLECTIONS'&&(
        <div className="fade-in">
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:20}}>Collections Manager</h2>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
            {[
              ['ALL',`All Active (${collectionLoansView.counts.ALL})`,'ALL'],
              ['CURRENT_PENDING',`Current Pending (${collectionLoansView.counts.CURRENT_PENDING})`,'1-3 overdue EMI'],
              ['LONG_PENDING',`Long Pending (${collectionLoansView.counts.LONG_PENDING})`,'4+ overdue EMI'],
            ].map(([key,label,sub])=>(
              <button
                key={key}
                className={colPendingFilter===key?'bg':'bgh'}
                style={{padding:'8px 12px',fontSize:12}}
                onClick={()=>setColPendingFilter(key)}
                title={sub}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="card" style={{padding:'10px 12px',marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              <p style={{fontSize:12,color:'var(--st)'}}>Arrear Amount (Total Receivable of {colPendingFilter==='ALL'?'Selected View':'Selected Clients'})</p>
              <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                <span className="badge bg-b">Selected: {fc(collectionLoansView.visibleArrear)}</span>
                <span className="badge bg-gr">Total Portfolio Arrear: {fc(stats.recv)}</span>
              </div>
            </div>
          </div>
          {collectionLoansView.visible.length===0&&(
            <div className="card" style={{padding:50,textAlign:'center',color:'var(--st)'}}>
              {collectionLoansView.counts.ALL===0
                ? 'No active loans.'
                : colPendingFilter==='CURRENT_PENDING'
                  ? 'No current pending loans (1-3 overdue EMI).'
                  : colPendingFilter==='LONG_PENDING'
                    ? 'No long pending loans (4+ overdue EMI).'
                    : 'No loans found.'}
            </div>
          )}
          {collectionLoansView.visible.map(({loan,overdueEmi,arrearAmt})=>{
            const coll=loan.schedule.reduce((a,p)=>a+(p.paid||0),0);
            const pct=Math.round((coll/loan.total)*100);
            const pending=loan.schedule.filter(p=>p.status==='Pending'||p.status==='Partial').length;
            const overdue=overdueEmi;
            return(
              <div key={loan.id} className="card" style={{marginBottom:12,overflow:'hidden'}}>
                <div style={{padding:'12px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                      <h3 style={{fontSize:15,fontWeight:700}}>{loan.client}</h3>
                      {!!clientProfiles[loan.client]?.riskGrade&&<span className={`badge ${RISK_META[clientProfiles[loan.client].riskGrade]?.cls||'bg-g'}`}>{RISK_META[clientProfiles[loan.client].riskGrade]?.label||'Standard'}</span>}
                      {overdue>=1&&overdue<=3&&<span className="badge bg-y">Current Pending</span>}
                      {overdue>=4&&<span className="badge bg-r">Long Pending</span>}
                      {arrearAmt>0&&<span className={`badge ${overdue>=4?'bg-r':overdue>=1?'bg-y':'bg-b'}`}>Arrear {fc(arrearAmt)}</span>}
                    </div>
                    <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>
                      <span className="mono" style={{color:'var(--gold)'}}>{loan.id}</span> · {FREQ[loan.freq]?.label||loan.freq} · {pending} pending
                      {overdue>0&&<span style={{color:'var(--red)'}}> · {overdue} overdue</span>}
                      {arrearAmt>0&&<span> · arrear {fc(arrearAmt)}</span>}
                    </p>
                    {((clientProfiles[loan.client]?.phone||loan.clientPhone)||loan.purpose)&&<p style={{fontSize:10,color:'var(--st)',marginTop:2}}>{(clientProfiles[loan.client]?.phone||loan.clientPhone)&& (clientProfiles[loan.client]?.phone||loan.clientPhone)}{(clientProfiles[loan.client]?.phone||loan.clientPhone)&&loan.purpose?' · ':''}{loan.purpose&&`Purpose: ${loan.purpose}`}</p>}
                  </div>
                  <div style={{display:'flex',gap:9,alignItems:'center'}}>
                    <div style={{textAlign:'right'}}><p className="mono gold-text" style={{fontSize:16,fontWeight:700}}>{fc(loan.total)}</p><p style={{fontSize:10,color:'var(--st)'}}>{pct}% collected</p></div>
                    <button className="bd" style={{padding:'5px 9px',fontSize:11}} onClick={()=>setCloseLoan(loan)}><I n="lock" s={12}/></button>
                  </div>
                </div>
                <div style={{height:3,background:'var(--ob3)'}}><div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,var(--gold),var(--gold-light))'}}/></div>
                <div style={{padding:12,overflowX:'auto'}}>
                  <div style={{display:'flex',gap:7,paddingBottom:3}}>
                    {loan.schedule.map((pay,idx)=>{
                      const isOv=new Date(pay.date)<new Date()&&pay.status!=='Paid'&&pay.status!=='Bad Debt';
                      const cc=pay.status==='Paid'?'paid':pay.status==='Partial'?'partial':pay.status==='Bad Debt'?'bad-debt':isOv?'overdue':'';
                      return(
                        <div key={idx} className={`pc ${cc}`}>
                          <p style={{fontSize:10,color:'var(--st)',marginBottom:2}}>{fd(pay.date)}</p>
                          <p className="mono" style={{fontSize:12,fontWeight:700,marginBottom:1}}>{fc(pay.payment)}</p>
                          {pay.paid>0&&<p style={{fontSize:9,color:'var(--green)',marginBottom:3}}>+{fc(pay.paid)}</p>}
                          {pay.status==='Paid'&&<span className="badge bg-g">Paid</span>}
                          {pay.status==='Bad Debt'&&<span className="badge bg-gr">W/Off</span>}
                          {(pay.status==='Pending'||pay.status==='Partial')&&<button onClick={()=>openCollect(loan.id,idx,pay.payment-(pay.paid||0),loan.client)} style={{width:'100%',background:'var(--gold)',color:'#0A0A0F',border:'none',borderRadius:5,padding:'4px',fontSize:10,fontWeight:700,cursor:'pointer',marginTop:2}}>{pay.status==='Partial'?'Resume':'Collect'}</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          {loans.filter(l=>l.status==='Closed').length>0&&<div style={{marginTop:20}}>
            <h3 style={{fontSize:13,fontWeight:700,color:'var(--st)',marginBottom:10}}>Closed Loans</h3>
            {loans.filter(l=>l.status==='Closed').map(loan=>(
              <div key={loan.id} className="card" style={{marginBottom:7,padding:'10px 15px',display:'flex',justifyContent:'space-between',alignItems:'center',opacity:.55}}>
                <div><span style={{fontWeight:600}}>{loan.client}</span><span className="mono" style={{fontSize:11,color:'var(--st)',marginLeft:10}}>{loan.id}</span></div>
                <div style={{display:'flex',gap:12,alignItems:'center'}}><span className="mono" style={{fontSize:12}}>{fc(loan.total)}</span><span className="badge bg-b">Closed</span></div>
              </div>
            ))}
          </div>}
        </div>
      )}

      {/* CLIENT MASTER */}
      {view==='CLIENT_MASTER'&&(
        <div className="fade-in">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
            <h2 style={{fontSize:24,fontWeight:800}}>Client Master</h2>
            <div style={{position:'relative',width:230}}><span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--st)'}}><I n="search" s={13}/></span><input className="inp" placeholder="Search clients..." value={cSearch} onChange={e=>setCSearch(e.target.value)} style={{paddingLeft:32}}/></div>
          </div>
          {clientMap.length===0&&<div className="card" style={{padding:50,textAlign:'center',color:'var(--st)'}}>No clients found.</div>}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:12}}>
            {clientMap.map(c=>(
              <div key={c.name} className="card" style={{padding:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:11}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                      <h3 style={{fontSize:15,fontWeight:700}}>{c.name}</h3>
                      <span className={`badge ${RISK_META[c.riskGrade||'STANDARD']?.cls||'bg-g'}`}>{RISK_META[c.riskGrade||'STANDARD']?.label||'Standard'}</span>
                      <span className={`badge ${c.fundingChannel==='TIE_UP'?'bg-go':'bg-b'}`}>{c.fundingChannel==='TIE_UP'?'Tie-up':'Direct'}</span>
                    </div>
                    <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>{c.loans.length} loan(s) · {c.loans.filter(l=>l.status==='Active').length} active</p>
                    {c.fundingChannel==='TIE_UP'&&!!c.tieUpPartnerName&&<p style={{fontSize:10,color:'var(--st)',marginTop:2}}>Partner: {c.tieUpPartnerName}</p>}
                  </div>
                  {c.totalDue>0&&<span className="badge bg-r">{fc(c.totalDue)}</span>}
                </div>
                {(c.phone||c.kycRef||c.address)&&<div style={{background:'rgba(255,255,255,.02)',border:'1px solid var(--border)',borderRadius:9,padding:'8px 10px',marginBottom:10}}>
                  {c.phone&&<p style={{fontSize:11,marginBottom:3}}><span style={{color:'var(--st)'}}>Phone:</span> <span className="mono">{c.phone}</span></p>}
                  {c.kycRef&&<p style={{fontSize:11,marginBottom:c.address?3:0}}><span style={{color:'var(--st)'}}>KYC:</span> {c.kycRef}</p>}
                  {c.address&&<p style={{fontSize:11,color:'var(--st)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={c.address}>{c.address}</p>}
                </div>}
                <div style={{background:'var(--ob3)',borderRadius:9,padding:'9px 11px',marginBottom:11}}>
                  {[['Borrowed',fc(c.totalP),''],['Collected',fc(c.totalColl),'sp'],['Interest Profit',fc(c.totalIP),'sp']].map(([l,v,cl])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:12}}><span style={{color:'var(--st)'}}>{l}</span><span className={`mono ${cl}`}>{v}</span></div>
                  ))}
                </div>
                {!!c.notes&&<p style={{fontSize:10,color:'var(--st)',marginBottom:10,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={c.notes}>Note: {c.notes}</p>}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                  <button onClick={()=>openProfileEditor(c.name)} className="bb" style={{width:'100%',justifyContent:'center',padding:'7px'}}><I n="settings" s={12}/> Edit</button>
                  <button onClick={()=>setCDetail(c.name)} className="bgh" style={{width:'100%',justifyContent:'center',padding:'7px'}}><I n="eye" s={13}/> History</button>
                  <button onClick={()=>deleteClientRecord(c)} className="bd" style={{width:'100%',justifyContent:'center',padding:'7px'}}><I n="trash" s={12}/> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FULL LEDGER */}
      {view==='LEDGER'&&(
        <div className="fade-in">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',marginBottom:20}}>
            <div><h2 style={{fontSize:24,fontWeight:800}}>Transaction Ledger</h2><p style={{color:'var(--st)',fontSize:13,marginTop:2}}>{transactions.length} total entries</p></div>
            <button className="bg" onClick={expCSV}><I n="download" s={14}/> Export CSV</button>
          </div>
          <div className="card" style={{padding:14,marginBottom:12}}>
            <div style={{display:'flex',gap:10}}>
              <div style={{position:'relative',flex:1}}><span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'var(--st)'}}><I n="search" s={13}/></span><input className="inp" placeholder="Search..." value={txSearch} onChange={e=>setTxSearch(e.target.value)} style={{paddingLeft:32}}/></div>
              <select className="inp" value={txFilter} onChange={e=>setTxFilter(e.target.value)} style={{width:'auto',minWidth:140}}>{['ALL','CAPITAL','LENDING','COLLECTION','EXPENSE','BAD_DEBT'].map(f=><option key={f} value={f}>{f}</option>)}</select>
            </div>
          </div>
          <div className="card" style={{overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}} className="tbl">
              <thead><tr><th>Date</th><th>Description</th><th>Tag</th><th>Category</th><th style={{textAlign:'right'}}>Debit</th><th style={{textAlign:'right'}}>Credit</th></tr></thead>
              <tbody>
                {filteredTx.length===0&&<tr><td colSpan="6" style={{textAlign:'center',color:'var(--st)',padding:28}}>No transactions found.</td></tr>}
                {filteredTx.map(t=>(
                  <tr key={t.id}>
                    <td style={{whiteSpace:'nowrap'}}>{fd(t.date)}</td>
                    <td>{t.desc}</td>
                    <td><span className={`badge ${t.tag==='COLLECTION'?'bg-g':t.tag==='CAPITAL'?'bg-go':t.tag==='BAD_DEBT'||t.tag==='EXPENSE'?'bg-r':'bg-gr'}`}>{t.tag}</span></td>
                    <td style={{fontSize:11,color:'var(--st)'}}>{t.category||'—'}</td>
                    <td style={{textAlign:'right'}}><span className="mono sn">{t.type==='DEBIT'?fc(t.amount):'—'}</span></td>
                    <td style={{textAlign:'right'}}><span className="mono sp">{t.type==='CREDIT'?fc(t.amount):'—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CALENDAR */}
      {view==='CALENDAR'&&(
        <div className="fade-in">
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:20}}>Instalment Calendar</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:14}}>
            <div className="card" style={{padding:20}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                <h3 style={{fontSize:15,fontWeight:700}}>{calDate.toLocaleString('default',{month:'long',year:'numeric'})}</h3>
                <div style={{display:'flex',gap:7}}>
                  {[['‹',()=>setCalDate(new Date(calY,calM-1,1))],['Today',()=>setCalDate(new Date())],['›',()=>setCalDate(new Date(calY,calM+1,1))]].map(([l,fn])=><button key={l} className="bgh" style={{padding:'5px 10px',fontSize:12}} onClick={fn}>{l}</button>)}
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:5}}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d} style={{textAlign:'center',fontSize:10,color:'var(--st)',fontWeight:700,padding:'3px 0'}}>{d}</div>)}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
                {Array.from({length:firstD}).map((_,i)=><div key={`e${i}`} className="cd em">_</div>)}
                {Array.from({length:daysInM}).map((_,i)=>{
                  const day=i+1;
                  const dk=`${calY}-${String(calM+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const info=calData[dk];
                  const isToday=dk===todayFull;
                  const hasOv=info?.payments?.some(p=>p.overdue);
                  const hasDue=info?.payments?.length>0&&!hasOv;
                  const hasPaid=info?.paid?.length>0&&!info?.payments?.length;
                  const cls=hasOv?'ov':hasDue?'due':hasPaid?'paid':'';
                  return<div key={day} className={`cd ${cls} ${isToday?'tod':''}`} onClick={()=>info&&(info.payments?.length||info.paid?.length)&&setCalDay(dk)} style={{cursor:info&&(info.payments?.length||info.paid?.length)?'pointer':'default'}}>{day}</div>;
                })}
              </div>
              <div style={{display:'flex',gap:14,marginTop:14,fontSize:10,color:'var(--st)'}}>
                {[['ov','var(--red)','Overdue'],['due','var(--yellow)','Due'],['paid','var(--green)','Paid']].map(([c,bg,l])=>(
                  <span key={c} style={{display:'flex',alignItems:'center',gap:5}}><span style={{width:12,height:12,borderRadius:3,background:bg,opacity:.3,display:'inline-block'}}/>{l}</span>
                ))}
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="card" style={{padding:15}}>
                <h4 style={{fontSize:12,fontWeight:700,marginBottom:11,color:'var(--st)',textTransform:'uppercase',letterSpacing:'.07em'}}>This Month</h4>
                {(()=>{
                  const allDays=Object.entries(calData).filter(([dk])=>dk.startsWith(`${calY}-${String(calM+1).padStart(2,'0')}`));
                  const tDue=allDays.flatMap(([,v])=>v.payments).reduce((a,p)=>a+(p?.amt||0),0);
                  const tPaid=allDays.flatMap(([,v])=>v.paid).reduce((a,p)=>a+(p?.amt||0),0);
                  const tOv=allDays.flatMap(([,v])=>v.payments.filter(p=>p.overdue)).reduce((a,p)=>a+(p?.amt||0),0);
                  return[['Pending Due',fc(tDue),'sw'],['Collected',fc(tPaid),'sp'],['Overdue',fc(tOv),'sn']].map(([l,v,c])=>(
                    <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid var(--border)'}}>
                      <span style={{fontSize:12,color:'var(--st)'}}>{l}</span><span className={`mono ${c}`} style={{fontWeight:600,fontSize:12}}>{v}</span>
                    </div>
                  ));
                })()}
              </div>
              <div className="card" style={{padding:15,flex:1,overflowY:'auto',maxHeight:320}}>
                <h4 style={{fontSize:12,fontWeight:700,marginBottom:11,color:'var(--st)',textTransform:'uppercase',letterSpacing:'.07em'}}>Next 7 Days</h4>
                {Array.from({length:7}).map((_,i)=>{
                  const d=new Date();d.setDate(d.getDate()+i);
                  const dk=d.toISOString().slice(0,10);
                  const info=calData[dk];
                  if(!info?.payments?.length) return null;
                  return<div key={dk} style={{marginBottom:7,padding:'9px 11px',background:'var(--ob3)',borderRadius:9,cursor:'pointer'}} onClick={()=>setCalDay(dk)}>
                    <p style={{fontSize:10,color:'var(--st)',marginBottom:3}}>{fd(dk)}</p>
                    {info.payments.map((p,pi)=><div key={pi} style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{fontWeight:600}}>{p.client}</span><span className="mono sw">{fc(p.amt)}</span></div>)}
                  </div>;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPENSES */}
      {view==='EXPENSES'&&(
        <div className="fade-in">
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:20}}>Record Expense</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1.2fr',gap:18}}>
            <div className="card" style={{padding:20}}>
              <div style={{marginBottom:13}}><span className="lbl">Category</span><select className="inp" value={newExp.category} onChange={e=>setNE({...newExp,category:e.target.value})}>{ECATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div style={{marginBottom:13}}><span className="lbl">Description</span><input className="inp" value={newExp.desc} onChange={e=>setNE({...newExp,desc:e.target.value})} placeholder="Details..."/></div>
              <div style={{marginBottom:16}}><span className="lbl">Amount (₹)</span><input className="inp" type="number" value={newExp.amount} onChange={e=>setNE({...newExp,amount:e.target.value})} placeholder="0"/></div>
              <button className="bd" style={{width:'100%',justifyContent:'center',fontSize:14,padding:'12px'}} onClick={handleExp}>Debit Account</button>
            </div>
            <div className="card" style={{padding:20}}>
              <h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>Recent Expenses</h3>
              <div style={{overflowY:'auto',maxHeight:400}}>
                {transactions.filter(t=>t.tag==='EXPENSE').slice().reverse().slice(0,20).map(t=>(
                  <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid var(--border)'}}>
                    <div><p style={{fontSize:13,fontWeight:500}}>{t.desc}</p><p style={{fontSize:10,color:'var(--st)',marginTop:2}}>{t.category} · {fd(t.date)}</p></div>
                    <span className="mono sn" style={{fontSize:13,fontWeight:600}}>{fc(t.amount)}</span>
                  </div>
                ))}
                {!transactions.filter(t=>t.tag==='EXPENSE').length&&<p style={{color:'var(--st)',fontSize:13}}>No expenses yet.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORTS */}
      {view==='REPORTS'&&(
        <div className="fade-in">
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:20}}>Financial Reports</h2>
          {reportApiMode&&(
            <div className="card" style={{padding:12,marginBottom:14,borderColor:'rgba(96,165,250,.2)',background:'linear-gradient(180deg, rgba(96,165,250,.04), rgba(96,165,250,.01))'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                <div>
                  <p style={{fontSize:12,fontWeight:700}}>Backend Report APIs</p>
                  <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>
                    Monthly P&L, collection efficiency, client arrears and day book are loaded from backend endpoints.
                    {backendReports.lastFetchedAt?` Updated ${new Date(backendReports.lastFetchedAt).toLocaleTimeString('en-IN')}.`:''}
                  </p>
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  <span className="badge bg-b">{backendReports.loading?'Syncing Reports...':'API Mode'}</span>
                  {backendReports.error&&<span className="badge bg-r" title={backendReports.error}>Report API Error</span>}
                </div>
              </div>
              {backendReports.error&&<div style={{marginTop:8,fontSize:11,color:'var(--red)'}}>{backendReports.error}</div>}
            </div>
          )}
          <div className="card-gold" style={{padding:18,marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:12,flexWrap:'wrap'}}>
              <div style={{flex:1,minWidth:260}}>
                <div className="gold-text" style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>Monthly Detailed Report</div>
                <h3 style={{fontSize:18,fontWeight:800,marginBottom:4}}>{reportMonthLabel}</h3>
                <p style={{fontSize:12,color:'var(--st)'}}>Month-wise payments, interest earned, principal recovery, expense load, and collection efficiency.</p>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'flex-end',flexWrap:'wrap'}}>
                <div><span className="lbl">Month</span><input type="month" className="inp" value={repMonth} onChange={e=>setRepMonth(e.target.value)} style={{width:170}}/></div>
                <div>
                  <span className="lbl">Tie-up Collection View</span>
                  <select className="inp" value={reportTieUpFilter} onChange={e=>setReportTieUpFilter(e.target.value)} style={{width:220}}>
                    <option value="ALL">All (Direct + Tie-up)</option>
                    <option value="DIRECT">Direct Clients Only</option>
                    {tieUpPartyOptions.map(name=><option key={name} value={`TIE_UP:${name}`}>Tie-up: {name}</option>)}
                  </select>
                </div>
                <button className="bgh" onClick={()=>setView('PDF')}><I n="printer" s={14}/> PDF View</button>
              </div>
            </div>
          </div>
          <div className="card" style={{padding:14,marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:10,flexWrap:'wrap',marginBottom:10}}>
              <div>
                <h3 style={{fontSize:14,fontWeight:700}}>Monthly Collection Split by Tie-up / Direct</h3>
                <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>Cumulative view for {reportMonthLabel}. Use dropdown above to filter by tie-up party.</p>
              </div>
              <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
                <div style={{textAlign:'right'}}><p style={{fontSize:10,color:'var(--st)'}}>Cumulative Collections</p><p className="mono sp" style={{fontSize:14,fontWeight:700}}>{fc(reportMonthlyCollectionsTieUpCumulative)}</p></div>
                <div style={{textAlign:'right'}}><p style={{fontSize:10,color:'var(--st)'}}>Collection Entries</p><p className="mono sb" style={{fontSize:14,fontWeight:700}}>{reportMonthlyCollectionsTieUpEntries}</p></div>
              </div>
            </div>
            <div style={{maxHeight:220,overflow:'auto',border:'1px solid var(--border)',borderRadius:8}}>
              <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                <thead><tr><th>Bucket</th><th>Type</th><th style={{textAlign:'right'}}>Clients</th><th style={{textAlign:'right'}}>Entries</th><th style={{textAlign:'right'}}>Collections</th></tr></thead>
                <tbody>
                  {reportMonthlyCollectionsTieUpFiltered.map(r=>(
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td><span className={`badge ${r.fundingChannel==='TIE_UP'?'bg-go':'bg-b'}`}>{r.fundingChannel==='TIE_UP'?'Tie-up':'Direct'}</span></td>
                      <td style={{textAlign:'right'}} className="mono">{r.clientsCount}</td>
                      <td style={{textAlign:'right'}} className="mono">{r.entries}</td>
                      <td style={{textAlign:'right'}} className="mono sp">{fc(r.collectionsAmount)}</td>
                    </tr>
                  ))}
                  {reportMonthlyCollectionsTieUpFiltered.length===0&&<tr><td colSpan="5" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No collection entries for selected filter in {reportMonthLabel}.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          {reportApiMode&&(
            <div className="card" style={{padding:14,marginBottom:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:10,flexWrap:'wrap',marginBottom:10}}>
                <div>
                  <h3 style={{fontSize:14,fontWeight:700}}>TDS Receivable Follow-up ({reportMonthLabel})</h3>
                  <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>Pending TDS to follow up for receipt / ITR reconciliation. Shows direct clients and tie-up partners.</p>
                </div>
                <div style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'flex-end'}}>
                  <div style={{textAlign:'right'}}><p style={{fontSize:10,color:'var(--st)'}}>Pending TDS</p><p className="mono sn" style={{fontSize:14,fontWeight:700}}>{fc(reportTdsPendingTotal)}</p></div>
                  <div style={{textAlign:'right'}}><p style={{fontSize:10,color:'var(--st)'}}>Gross EMI Covered</p><p className="mono sb" style={{fontSize:14,fontWeight:700}}>{fc(reportTdsGrossCovered)}</p></div>
                  <div style={{textAlign:'right'}}><p style={{fontSize:10,color:'var(--st)'}}>Cash Received</p><p className="mono sp" style={{fontSize:14,fontWeight:700}}>{fc(reportTdsCashReceived)}</p></div>
                </div>
              </div>
              {backendTdsFollowup.error&&<div style={{fontSize:11,color:'var(--red)',marginBottom:8}}>{backendTdsFollowup.error}</div>}
              {backendTdsFollowup.loading&&<div style={{fontSize:11,color:'var(--st)',marginBottom:8}}>Loading TDS follow-up...</div>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1.2fr',gap:12}}>
                <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'auto',maxHeight:250}}>
                  <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr><th>From Whom</th><th>Type</th><th style={{textAlign:'right'}}>Entries</th><th style={{textAlign:'right'}}>Pending TDS</th><th style={{textAlign:'right'}}>Max Age</th></tr></thead>
                    <tbody>
                      {reportTdsFollowupGrouped.map(g=>(
                        <tr key={g.key}>
                          <td>{g.label}</td>
                          <td><span className={`badge ${g.fundingChannel==='TIE_UP'?'bg-go':'bg-b'}`}>{g.fundingChannel==='TIE_UP'?'Tie-up':'Direct'}</span></td>
                          <td style={{textAlign:'right'}} className="mono">{g.entries}</td>
                          <td style={{textAlign:'right'}} className="mono sn">{fc(g.tdsAmount)}</td>
                          <td style={{textAlign:'right'}} className="mono">{g.maxAgeDays}d</td>
                        </tr>
                      ))}
                      {!reportTdsFollowupGrouped.length&&<tr><td colSpan="5" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No pending TDS follow-up for {reportMonthLabel}.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div style={{border:'1px solid var(--border)',borderRadius:8,overflow:'auto',maxHeight:250}}>
                  <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr><th>Date</th><th>Client / Partner</th><th>Type</th><th style={{textAlign:'right'}}>Gross</th><th style={{textAlign:'right'}}>Cash</th><th style={{textAlign:'right'}}>TDS</th></tr></thead>
                    <tbody>
                      {reportTdsPendingRows.map(r=>(
                        <tr key={r.id}>
                          <td className="mono">{fd(r.deductionDate)}</td>
                          <td>{String(r.fundingChannel||'').toUpperCase()==='TIE_UP'?(r.tieUpPartnerName||r.clientName||'Tie-up (Unnamed)'):(r.clientName||'Unknown Client')}</td>
                          <td><span className={`badge ${String(r.fundingChannel||'').toUpperCase()==='TIE_UP'?'bg-go':'bg-b'}`}>{String(r.fundingChannel||'').toUpperCase()==='TIE_UP'?'Tie-up':'Direct'}</span></td>
                          <td style={{textAlign:'right'}} className="mono">{fc(toNum(r.grossEmiAmount))}</td>
                          <td style={{textAlign:'right'}} className="mono sp">{fc(toNum(r.cashReceivedAmount))}</td>
                          <td style={{textAlign:'right'}} className="mono sn">{fc(toNum(r.tdsAmount))}</td>
                        </tr>
                      ))}
                      {!reportTdsPendingRows.length&&<tr><td colSpan="6" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No pending TDS entries in selected month.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:14}}>
            {[
              ['Payments Done',String(mCollectionsCount),'sb'],
              ['Collections Amount',fc(reportCollectionsAmount),'sp'],
              ['Interest Earned',fc(reportInterestEarned),'sp'],
              ['Principal Recovered',fc(reportPrincipalRecovered),'sw'],
              ['Arrear Amount (Total Receivable)',fc(reportReceivableLive),'sn'],
              ['EMI Fully Paid',`${reportFullyPaidInstallmentCount}/${reportDueInstallmentCount}`,'sb'],
              ['Collection Efficiency',`${reportCollectionEfficiency.toFixed(1)}%`,'sp'],
              ['Expenses + Bad Debt',fc(reportExpenses+reportBadDebt),'sn'],
              ['Net Operating',fc(reportNetOperating),reportNetOperating>=0?'sp':'sn'],
            ].map(([l,v,c])=>(
              <div key={l} className="card" style={{padding:'11px 12px'}}>
                <p style={{fontSize:10,color:'var(--st)',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{l}</p>
                <p className={`mono ${c}`} style={{fontSize:14,fontWeight:700}}>{v}</p>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1.15fr 1fr',gap:14,marginBottom:14}}>
            <div className="card" style={{padding:18}}>
              <h3 style={{fontSize:14,fontWeight:700,borderBottom:'1px solid var(--border)',paddingBottom:9,marginBottom:12}}>Monthly Payments & Earnings</h3>
              <div className="row"><span style={{color:'var(--st)'}}>Collection Entries Posted</span><span className="mono">{mCollectionsCount}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Average Collection Ticket</span><span className="mono">{fc(reportAvgCollectionTicket)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Collections Received</span><span className="mono sp">{fc(reportCollectionsAmount)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Interest Earned</span><span className="mono sp">{fc(reportInterestEarned)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Principal Recovered</span><span className="mono sw">{fc(reportPrincipalRecovered)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>EMIs Due in Month</span><span className="mono">{reportDueInstallmentCount}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>EMIs Fully Paid</span><span className="mono sp">{reportFullyPaidInstallmentCount}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Scheduled Collection Realized</span><span className="mono">{fc(reportMonthScheduledCollected)}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',fontWeight:700}}>
                <span>Collection Efficiency</span>
                <span className={`mono ${reportCollectionEfficiency>=85?'sp':reportCollectionEfficiency>=60?'sw':'sn'}`}>{reportCollectionEfficiency.toFixed(2)}%</span>
              </div>
            </div>
            <div className="card" style={{padding:18}}>
              <h3 style={{fontSize:14,fontWeight:700,borderBottom:'1px solid var(--border)',paddingBottom:9,marginBottom:12}}>Monthly Cash & Risk Control</h3>
              <div className="row"><span style={{color:'var(--st)'}}>Opening Cash</span><span className="mono">{fc(reportOpeningBalance)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Capital Added</span><span className="mono sp">{fc(reportCapitalAdded)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Loan Disbursed</span><span className="mono sn">{fc(reportDisbursed)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Expenses</span><span className="mono sn">{fc(reportExpenses)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Bad Debt Write-off</span><span className="mono sn">{fc(reportBadDebt)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Net Cash Movement</span><span className={`mono ${reportCashMovement>=0?'sp':'sn'}`}>{fc(reportCashMovement)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Closing Cash</span><span className={`mono ${reportClosingBalance>=0?'sp':'sn'}`}>{fc(reportClosingBalance)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Arrear Amount (Total Receivable, Live)</span><span className={`mono ${reportReceivableLive>0?'sn':'sp'}`}>{fc(reportReceivableLive)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Overdue Amount (Live)</span><span className={`mono ${reportOverdueLive>0?'sn':'sp'}`}>{fc(reportOverdueLive)}</span></div>
              <div className="row"><span style={{color:'var(--st)'}}>Selected Month EMI Overdue (Live)</span><span className={`mono ${mMonthOverdueNow>0?'sn':'sp'}`}>{fc(mMonthOverdueNow)}</span></div>
              <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',fontWeight:700}}>
                <span>Ledger Activity</span>
                <span className="mono">{reportLedgerEntryCount} entries</span>
              </div>
            </div>
          </div>
          <div className="card" style={{padding:18,marginBottom:14,overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:12}}>
              <div>
                <h3 style={{fontSize:14,fontWeight:700}}>Client-wise Arrear Report</h3>
                <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>Arrear = total receivable outstanding by client</p>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <span className="badge bg-gr">Clients: {reportClientArrearRows.length}</span>
                <span className="badge bg-b">Current Pending: {reportClientArrearCurrentCount}</span>
                <span className="badge bg-r">Long Pending: {reportClientArrearLongCount}</span>
                <span className="badge bg-go">Total Arrear: {fc(reportReceivableLive)}</span>
                <span className="badge bg-r">Overdue EMI: {reportClientArrearOverdueEmiTotal}</span>
              </div>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse'}} className="tbl">
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th style={{textAlign:'right'}}>Active Loans</th>
                  <th style={{textAlign:'right'}}>Total Receivable (Arrear)</th>
                  <th style={{textAlign:'right'}}>Overdue EMI Count</th>
                </tr>
              </thead>
              <tbody>
                {reportClientArrearRows.length===0&&(
                  <tr><td colSpan="4" style={{textAlign:'center',color:'var(--st)',padding:20}}>No client arrears / receivables pending.</td></tr>
                )}
                {reportClientArrearRows.map(row=>(
                  <tr key={row.client}>
                    <td style={{fontWeight:600}}>
                      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                        <span>{row.client}</span>
                        {toNum(row.overdueEmiCount)>=4&&<span className="badge bg-r">Long Pending</span>}
                        {toNum(row.overdueEmiCount)>=1&&toNum(row.overdueEmiCount)<=3&&<span className="badge bg-y">Current Pending</span>}
                      </div>
                    </td>
                    <td style={{textAlign:'right'}}><span className="mono">{toNum(row.activeLoans)}</span></td>
                    <td style={{textAlign:'right'}}><span className={`mono ${toNum(row.totalReceivable)>0?'sn':'sp'}`}>{fc(toNum(row.totalReceivable))}</span></td>
                    <td style={{textAlign:'right'}}><span className={`mono ${toNum(row.overdueEmiCount)>0?'sn':'sp'}`}>{toNum(row.overdueEmiCount)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div className="card" style={{padding:18}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <h3 style={{fontSize:14,fontWeight:700}}>Top Collections ({reportMonthLabel})</h3>
                <span className="badge bg-g">{reportTopClients.length} client(s)</span>
              </div>
              {reportTopClients.length===0&&<p style={{fontSize:12,color:'var(--st)'}}>No collections in selected month.</p>}
              {reportTopClients.map((row,i)=>(
                <div key={row.client+i} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:12,marginBottom:3}}>
                    <span style={{fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={row.client}>#{i+1} {row.client}</span>
                    <span className="mono sp" style={{fontWeight:700}}>{fc(row.amount)}</span>
                  </div>
                  <div style={{height:6,background:'var(--ob3)',borderRadius:999,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(row.amount/reportTopClientMax)*100}%`,background:'linear-gradient(90deg,var(--green),#047857)'}}/>
                  </div>
                </div>
              ))}
            </div>
            <div className="card" style={{padding:18}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <h3 style={{fontSize:14,fontWeight:700}}>Expense Mix ({reportMonthLabel})</h3>
                <span className="badge bg-r">{reportTopExpenseCats.length} line(s)</span>
              </div>
              {reportTopExpenseCats.length===0&&<p style={{fontSize:12,color:'var(--st)'}}>No expenses or write-offs in selected month.</p>}
              {reportTopExpenseCats.map((row,i)=>(
                <div key={row.label+i} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:12,marginBottom:3}}>
                    <span style={{fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}} title={row.label}>{row.label}</span>
                    <span className={`mono ${row.label.includes('Bad Debt')?'sn':''}`} style={{fontWeight:700}}>{fc(row.value)}</span>
                  </div>
                  <div style={{height:6,background:'var(--ob3)',borderRadius:999,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(row.value/reportTopExpenseMax)*100}%`,background:row.label.includes('Bad Debt')?'linear-gradient(90deg,#F87171,#DC2626)':'linear-gradient(90deg,var(--gold-light),#A87A30)'}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div className="card" style={{padding:18}}>
              <h3 style={{fontSize:14,fontWeight:700,borderBottom:'1px solid var(--border)',paddingBottom:9,marginBottom:12}}>Profit & Loss</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,fontSize:12}}>
                <div>
                  <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--st)',marginBottom:7,letterSpacing:'.07em'}}>Income</p>
                  <div className="row"><span style={{color:'var(--st)'}}>Interest Income</span><span className="mono sp">{fc(stats.interestIncome)}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',fontWeight:700}}><span>Total</span><span className="mono sp">{fc(stats.interestIncome)}</span></div>
                </div>
                <div>
                  <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--st)',marginBottom:7,letterSpacing:'.07em'}}>Expenses</p>
                  {ECATS.map(cat=>{const amt=transactions.filter(t=>t.category===cat).reduce((a,t)=>a+t.amount,0);if(!amt)return null;return<div key={cat} className="row"><span style={{color:'var(--st)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:110}}>{cat}</span><span className="mono">{fc(amt)}</span></div>;})}
                  <div className="row"><span style={{color:'var(--red)'}}>Bad Debts</span><span className="mono sn">{fc(transactions.filter(t=>t.tag==='BAD_DEBT').reduce((a,t)=>a+t.amount,0))}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',fontWeight:700}}><span>Total</span><span className="mono sn">{fc(stats.totalExp)}</span></div>
                </div>
              </div>
              <div className="card-gold" style={{padding:'11px 13px',marginTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontWeight:700}}>Net Profit / Loss</span>
                <span className={`mono ${stats.netProfit>=0?'sp':'sn'}`} style={{fontSize:18,fontWeight:700}}>{fc(stats.netProfit)}</span>
              </div>
            </div>
            <div className="card" style={{padding:18}}>
              <h3 style={{fontSize:14,fontWeight:700,borderBottom:'1px solid var(--border)',paddingBottom:9,marginBottom:12}}>Balance Sheet</h3>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,fontSize:12}}>
                <div>
                  <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--st)',marginBottom:7,letterSpacing:'.07em'}}>Liabilities</p>
                  {[['Capital Account',stats.totalCap],['Reserves & Surplus',stats.netProfit]].map(([l,v])=><div key={l} className="row"><span style={{color:'var(--st)'}}>{l}</span><span className="mono">{fc(v)}</span></div>)}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',fontWeight:700}}><span>Total</span><span className="mono">{fc(stats.totalCap+stats.netProfit)}</span></div>
                </div>
                <div>
                  <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',color:'var(--st)',marginBottom:7,letterSpacing:'.07em'}}>Assets</p>
                  {[['Cash in Hand',bal],['Loans Receivable',stats.recv]].map(([l,v])=><div key={l} className="row"><span style={{color:'var(--st)'}}>{l}</span><span className="mono">{fc(v)}</span></div>)}
                  <div style={{display:'flex',justifyContent:'space-between',padding:'7px 0',fontWeight:700}}><span>Total</span><span className="mono">{fc(bal+stats.recv)}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div className="card" style={{padding:18,marginBottom:14}}>
            <h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>Portfolio Risk & Collections Control</h3>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {[['Overdue Receivables',fc(reportOverdueLive),'sn'],['PAR30 Ratio',`${reportPar30Ratio.toFixed(2)}%`,'sn'],['Monthly Demand',fc(reportMonthDemand),'sb'],['Collection Efficiency',`${reportCollectionEfficiency.toFixed(2)}%`,'sp']].map(([l,v,c])=>(
                <div key={l} style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                  <p style={{fontSize:10,color:'var(--st)',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{l}</p>
                  <p className={`mono ${c}`} style={{fontSize:14,fontWeight:700}}>{v}</p>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:12,marginTop:12}}>
              <div style={{background:'rgba(255,255,255,.02)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                <p style={{fontSize:11,color:'var(--st)',marginBottom:6}}>Aging Summary</p>
                <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                  {Object.entries(reportAgingLive).map(([k,v])=><span key={k} className="badge bg-gr">{k}: {fc(v)}</span>)}
                </div>
              </div>
              <div style={{background:'rgba(255,255,255,.02)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                <p style={{fontSize:11,color:'var(--st)',marginBottom:6}}>Operational Notes</p>
                <p style={{fontSize:11,lineHeight:1.5,color:'var(--st)'}}>Use `PAR30` and monthly collection efficiency together. High PAR30 with low CE indicates follow-up and recovery pressure.</p>
              </div>
            </div>
          </div>
          {/* Client P&L */}
          <div className="card" style={{padding:18,marginBottom:14,overflow:'hidden'}}>
            <h3 style={{fontSize:14,fontWeight:700,marginBottom:12}}>Client-wise P&L Breakdown</h3>
            <table style={{width:'100%',borderCollapse:'collapse'}} className="tbl">
              <thead><tr><th>Client</th><th style={{textAlign:'right'}}>Principal</th><th style={{textAlign:'right'}}>Interest</th><th style={{textAlign:'right'}}>Collected</th><th style={{textAlign:'right'}}>Outstanding</th><th style={{textAlign:'right'}}>Profit</th></tr></thead>
              <tbody>
                {clientMap.length===0&&<tr><td colSpan="6" style={{textAlign:'center',color:'var(--st)',padding:20}}>No clients yet.</td></tr>}
                {clientMap.map(c=>(
                  <tr key={c.name}>
                    <td style={{fontWeight:600}}>{c.name}</td>
                    <td style={{textAlign:'right'}}><span className="mono">{fc(c.totalP)}</span></td>
                    <td style={{textAlign:'right'}}><span className="mono sp">{fc(c.totalI)}</span></td>
                    <td style={{textAlign:'right'}}><span className="mono">{fc(c.totalColl)}</span></td>
                    <td style={{textAlign:'right'}}><span className="mono sn">{fc(c.totalDue)}</span></td>
                    <td style={{textAlign:'right'}}><span className="mono sp">{fc(c.totalIP)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Day Book */}
          <div className="card" style={{padding:18}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <h3 style={{fontSize:14,fontWeight:700}}>Day Book</h3>
              <input type="date" className="inp" value={dbDate} onChange={e=>setDbDate(e.target.value)} style={{width:'auto'}}/>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse'}} className="tbl">
              <thead><tr><th>Description</th><th>Tag</th><th style={{textAlign:'right'}}>Debit</th><th style={{textAlign:'right'}}>Credit</th></tr></thead>
              <tbody>
                {reportDbTx.length===0&&<tr><td colSpan="4" style={{textAlign:'center',color:'var(--st)',padding:20}}>No entries for {fd(dbDate)}</td></tr>}
                {reportDbTx.map(t=>(
                  <tr key={t.id}>
                    <td>{t.desc}</td>
                    <td><span className={`badge ${t.type==='CREDIT'?'bg-g':'bg-r'}`}>{t.tag}</span></td>
                    <td style={{textAlign:'right'}}><span className="mono sn">{t.type==='DEBIT'?fc(t.amount):'—'}</span></td>
                    <td style={{textAlign:'right'}}><span className="mono sp">{t.type==='CREDIT'?fc(t.amount):'—'}</span></td>
                  </tr>
                ))}
                {reportDbTx.length>0&&(
                  <tr>
                    <td colSpan="2" style={{fontWeight:700}}>Totals</td>
                    <td style={{textAlign:'right'}}><span className="mono sn" style={{fontWeight:700}}>{fc(reportDbTotals.debit)}</span></td>
                    <td style={{textAlign:'right'}}><span className="mono sp" style={{fontWeight:700}}>{fc(reportDbTotals.credit)}</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PDF */}
      {view==='CHITS'&&(
        <ChitModule
          isBackendSession={isBackendSession}
          backendAuth={backendAuth}
          backendApiFetch={backendApiFetch}
        />
      )}

      {/* PDF */}
      {view==='PDF'&&(
        <div className="fade-in">
          <h2 style={{fontSize:24,fontWeight:800,marginBottom:20}}>Document Center</h2>
          <div className="card-gold" style={{padding:22,marginBottom:14}}>
            <div style={{display:'flex',gap:18,alignItems:'flex-end'}}>
              <div style={{flex:1}}>
                <div className="gold-text" style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:5}}>Monthly Report Generator</div>
                <h3 style={{fontSize:18,fontWeight:800,marginBottom:3}}>Generate CA-Ready PDF Report (Detailed)</h3>
                <p style={{fontSize:12,color:'var(--st)'}}>Management KPIs + CA accounting annexure with monthly books summary, expense schedule, client-wise arrear schedule, and detailed ledger.</p>
              </div>
              <div style={{display:'flex',gap:10,alignItems:'flex-end'}}>
                <div><span className="lbl">Month</span><input type="month" className="inp" value={repMonth} onChange={e=>setRepMonth(e.target.value)} style={{width:170}}/></div>
                <button className="bg" onClick={()=>window.print()}><I n="printer" s={14}/> Generate CA PDF</button>
              </div>
            </div>
          </div>
          <div className="card" style={{padding:18,marginBottom:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
              <h3 style={{fontSize:14,fontWeight:700}}>Preview — {reportMonthLabel}</h3>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <span className="badge bg-go">Professional Layout</span>
                <span className="badge bg-b">Risk Snapshot</span>
                <span className="badge bg-g">Running Ledger</span>
                <span className="badge bg-r">CA Annexure</span>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:12}}>
              {[
                ['Collections',fc(reportCollectionsAmount),'sp'],
                ['Operating Net',fc(reportNetOperating),reportNetOperating>=0?'sp':'sn'],
                ['Collection Efficiency',`${reportCollectionEfficiency.toFixed(1)}%`,'sb'],
                ['PAR30',`${reportPar30Ratio.toFixed(1)}%`,'sn'],
                ['Arrear (Receivable)',fc(reportReceivableLive),'sn'],
                ['Avg Rate',`${stats.avgInterestRate.toFixed(2)}%`,'sw'],
                ['Closing Cash',fc(reportClosingBalance),reportClosingBalance>=0?'sp':'sn'],
              ].map(([l,v,c])=>(
                <div key={l} className="card" style={{padding:'11px 12px'}}>
                  <p style={{fontSize:10,color:'var(--st)',textTransform:'uppercase',fontWeight:700,marginBottom:5}}>{l}</p>
                  <p className={`mono ${c}`} style={{fontSize:15,fontWeight:700}}>{v}</p>
                </div>
              ))}
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1.15fr 1fr',gap:12}}>
              <div className="card" style={{padding:14}}>
                <h4 style={{fontSize:12,fontWeight:700,marginBottom:8,color:'var(--st)',textTransform:'uppercase',letterSpacing:'.07em'}}>PDF Sections Included</h4>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,fontSize:12}}>
                  {[
                    'Executive KPI Summary',
                    'Collections & Cash Trend',
                    'Aging and Overdue Risk',
                    'Top Collection Clients',
                    'Expense Mix Analysis',
                    'CA Accounting Annexure (Books Summary)',
                    'Client-wise Arrear Schedule',
                    'Detailed Ledger with Running Balance',
                  ].map(item=>(
                    <div key={item} style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:9,padding:'8px 10px',display:'flex',alignItems:'center',gap:7}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:'var(--gold)',flexShrink:0}}/>
                      <span style={{fontSize:11}}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card" style={{padding:14}}>
                <h4 style={{fontSize:12,fontWeight:700,marginBottom:8,color:'var(--st)',textTransform:'uppercase',letterSpacing:'.07em'}}>Selected Month Diagnostics</h4>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'var(--st)'}}>Opening Cash</span><span className="mono">{fc(reportOpeningBalance)}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'var(--st)'}}>Credits / Debits</span><span className="mono">{fc(reportCreditTotal)} / {fc(reportDebitTotal)}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'var(--st)'}}>Monthly Demand</span><span className="mono">{fc(reportMonthDemand)}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'var(--st)'}}>Collected vs Scheduled</span><span className="mono">{fc(reportMonthScheduledCollected)} ({reportCollectionEfficiency.toFixed(1)}%)</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'var(--st)'}}>Overdue (Current Snapshot)</span><span className="mono sn">{fc(reportOverdueLive)}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span style={{color:'var(--st)'}}>Ledger Entries</span><span className="mono">{reportLedgerEntryCount}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="card" style={{padding:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <h4 style={{fontSize:12,fontWeight:700,color:'var(--st)',textTransform:'uppercase',letterSpacing:'.07em'}}>Top Collections (Month)</h4>
                <span style={{fontSize:10,color:'var(--st)'}}>{reportCollectionEntryCount} entries</span>
              </div>
              {reportTopClients.length===0&&<p style={{fontSize:12,color:'var(--st)'}}>No collections in selected month.</p>}
              {reportTopClients.slice(0,5).map((row,i)=>(
                <div key={row.client+i} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:12,marginBottom:4}}>
                    <span style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.client}>#{i+1} {row.client}</span>
                    <span className="mono sp">{fc(row.amount)}</span>
                  </div>
                  <div style={{height:5,background:'var(--ob3)',borderRadius:999,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(row.amount/reportTopClientMax)*100}%`,background:'linear-gradient(90deg,var(--green),#10B981)'}}/>
                  </div>
                </div>
              ))}
            </div>
            <div className="card" style={{padding:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <h4 style={{fontSize:12,fontWeight:700,color:'var(--st)',textTransform:'uppercase',letterSpacing:'.07em'}}>Expense Mix (Month)</h4>
                <span style={{fontSize:10,color:'var(--st)'}}>{reportExpenseEntryCount+reportWriteoffEntryCount} entries</span>
              </div>
              {reportTopExpenseCats.length===0&&<p style={{fontSize:12,color:'var(--st)'}}>No expenses or write-offs in selected month.</p>}
              {reportTopExpenseCats.slice(0,5).map((row,i)=>(
                <div key={row.label+i} style={{marginBottom:8}}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:12,marginBottom:4}}>
                    <span style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={row.label}>#{i+1} {row.label}</span>
                    <span className={`mono ${row.label.includes('Bad Debt')?'sn':''}`}>{fc(row.value)}</span>
                  </div>
                  <div style={{height:5,background:'var(--ob3)',borderRadius:999,overflow:'hidden'}}>
                    <div style={{height:'100%',width:`${(row.value/reportTopExpenseMax)*100}%`,background:row.label.includes('Bad Debt')?'linear-gradient(90deg,#F87171,#EF4444)':'linear-gradient(90deg,var(--yellow),#F59E0B)'}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>{/* end main */}
    </div>
  );
}

export default function AppWithBoundary(){
  return(
    <AppErrorBoundary>
      <App/>
    </AppErrorBoundary>
  );
}
