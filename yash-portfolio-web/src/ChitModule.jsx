import { useEffect, useMemo, useState } from 'react';

const fc=(v)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:0,maximumFractionDigits:0}).format(Number(v||0));
const pct=(v)=>v==null||!Number.isFinite(Number(v))?'—':`${Number(v).toFixed(2)}%`;
const ymd=(d)=>d?new Date(d).toISOString().slice(0,10):'';
const fd=(d)=>d?new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'—';
const fyLabel=(startYear)=>`${startYear}-${String((startYear+1)%100).padStart(2,'0')}`;
const currentFyStart=(()=>{const n=new Date();return n.getMonth()>=3?n.getFullYear():n.getFullYear()-1;})();
const toNum=(v)=>Number.isFinite(+v)?+v:0;

const emptyCreate={
  chitName:'',groupName:'',organizer:'',faceValue:'',tenureMonths:'20',installmentAmount:'',startDate:new Date().toISOString().slice(0,10),drawType:'AUCTION',bankAccountRef:'',accountingTreatmentMode:'FINANCING',notes:'',
};

export default function ChitModule({ isBackendSession, backendAuth, backendApiFetch }){
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [items,setItems]=useState([]);
  const [selectedId,setSelectedId]=useState(null);
  const [detailTab,setDetailTab]=useState('ROI');
  const [detail,setDetail]=useState(null);
  const [installments,setInstallments]=useState([]);
  const [receipt,setReceipt]=useState(null);
  const [allocations,setAllocations]=useState([]);
  const [returnsRows,setReturnsRows]=useState([]);
  const [roi,setRoi]=useState(null);
  const [journalRows,setJournalRows]=useState([]);
  const [auditRows,setAuditRows]=useState([]);
  const [portfolio,setPortfolio]=useState(null);
  const [portfolioBusy,setPortfolioBusy]=useState(false);
  const [fyStartYear,setFyStartYear]=useState(currentFyStart);
  const [showCreate,setShowCreate]=useState(false);
  const [createForm,setCreateForm]=useState(emptyCreate);
  const [savingCreate,setSavingCreate]=useState(false);
  const [paymentForm,setPaymentForm]=useState({chitInstallmentId:'',amountPaid:'',paymentDate:new Date().toISOString().slice(0,10),mode:'BANK',reference:'',narration:''});
  const [receiptForm,setReceiptForm]=useState({drawDate:new Date().toISOString().slice(0,10),amountReceived:'',discountAmount:'',commissionAmount:'',otherCharges:'',feesPaidSeparately:true,receiptMode:'BANK',reference:'',notes:''});
  const [allocationForm,setAllocationForm]=useState({allocationDate:new Date().toISOString().slice(0,10),amountAllocated:'',purpose:'LENDING',targetEntityType:'LOAN',targetEntityId:'',linkedLoanId:'',notes:''});
  const [returnForm,setReturnForm]=useState({returnDate:new Date().toISOString().slice(0,10),amountReturned:'',sourceType:'LOAN_PRINCIPAL_REPAYMENT',linkedLoanId:'',linkedCollectionId:'',interestIncomeAmount:'',otherIncomeAmount:'',notes:''});

  const token=backendAuth?.accessToken;
  const orgId=backendAuth?.organization?.id;
  const orgCode=backendAuth?.organization?.code;
  const apiReady=!!(isBackendSession&&token&&orgId);

  const selectedInstallment=useMemo(()=>installments.find(i=>i.id===paymentForm.chitInstallmentId)||null,[installments,paymentForm.chitInstallmentId]);
  const availableBalance=toNum(detail?.stats?.availableChitBalance);

  const safeApi=async(path,opts={})=>backendApiFetch(path,{...opts,token,orgId});

  const loadList=async()=>{
    if(!apiReady) return;
    setLoading(true);setError('');
    try{
      const data=await safeApi('/api/v1/chits?page=1&pageSize=100');
      const next=Array.isArray(data?.items)?data.items:[];
      setItems(next);
      if(!selectedId&&next[0]?.id) setSelectedId(next[0].id);
      if(selectedId&&!next.some(x=>x.id===selectedId)) setSelectedId(next[0]?.id||null);
    }catch(e){setError(e?.message||'Failed to load chits');}
    finally{setLoading(false);}
  };

  const loadPortfolio=async()=>{
    if(!apiReady) return;
    const fromMonth=`${fyStartYear}-04`;
    const toMonth=`${fyStartYear+1}-03`;
    setPortfolioBusy(true);
    try{
      const data=await safeApi(`/api/v1/chits/portfolio/summary?fromMonth=${encodeURIComponent(fromMonth)}&toMonth=${encodeURIComponent(toMonth)}`);
      setPortfolio(data);
    }catch(e){setPortfolio({error:e?.message||'Failed to load portfolio'});}
    finally{setPortfolioBusy(false);}
  };

  const loadDetail=async(id)=>{
    if(!apiReady||!id) return;
    setError('');
    try{
      const [d,inst,rcpt,alloc,ret,roiRes,journal,audit]=await Promise.all([
        safeApi(`/api/v1/chits/${id}`),
        safeApi(`/api/v1/chits/${id}/installments`),
        safeApi(`/api/v1/chits/${id}/receipt`),
        safeApi(`/api/v1/chits/${id}/allocations`),
        safeApi(`/api/v1/chits/${id}/returns`),
        safeApi(`/api/v1/chits/${id}/roi`),
        safeApi(`/api/v1/chits/${id}/journal`),
        safeApi(`/api/v1/chits/${id}/audit`),
      ]);
      setDetail(d);
      setInstallments(Array.isArray(inst?.items)?inst.items:[]);
      setReceipt(rcpt?.item||null);
      setAllocations(Array.isArray(alloc?.items)?alloc.items:[]);
      setReturnsRows(Array.isArray(ret?.items)?ret.items:[]);
      setRoi(roiRes||null);
      setJournalRows(Array.isArray(journal?.items)?journal.items:[]);
      setAuditRows(Array.isArray(audit?.audit_log)?audit.audit_log:[]);
      setPaymentForm(f=>({
        ...f,
        chitInstallmentId:(Array.isArray(inst?.items)?inst.items.find(x=>x.reconciliationStatus!=='PAID')?.id:null)||f.chitInstallmentId||'',
      }));
      if(d?.receipt){
        setReceiptForm({
          drawDate:ymd(d.receipt.drawDate)||receiptForm.drawDate,
          amountReceived:String(toNum(d.receipt.amountReceived)||''),
          discountAmount:String(toNum(d.receipt.discountAmount)||''),
          commissionAmount:String(toNum(d.receipt.commissionAmount)||''),
          otherCharges:String(toNum(d.receipt.otherCharges)||''),
          feesPaidSeparately:!!d.receipt.feesPaidSeparately,
          receiptMode:d.receipt.receiptMode||'BANK',
          reference:d.receipt.reference||'',
          notes:d.receipt.notes||'',
        });
      }
    }catch(e){setError(e?.message||'Failed to load chit detail');}
  };

  useEffect(()=>{ if(apiReady) loadList(); },[apiReady]);
  useEffect(()=>{ if(apiReady) loadPortfolio(); },[apiReady,fyStartYear]);
  useEffect(()=>{ if(apiReady&&selectedId) loadDetail(selectedId); },[apiReady,selectedId]);

  const createChit=async()=>{
    if(!apiReady||savingCreate) return;
    setSavingCreate(true);setError('');
    try{
      const body={
        chitName:createForm.chitName,
        groupName:createForm.groupName||null,
        organizer:createForm.organizer||null,
        faceValue:toNum(createForm.faceValue),
        tenureMonths:parseInt(createForm.tenureMonths,10),
        installmentAmount:toNum(createForm.installmentAmount),
        startDate:createForm.startDate,
        drawType:createForm.drawType,
        bankAccountRef:createForm.bankAccountRef||null,
        accountingTreatmentMode:createForm.accountingTreatmentMode,
        notes:createForm.notes||null,
      };
      const res=await safeApi('/api/v1/chits',{method:'POST',body});
      setShowCreate(false);
      setCreateForm(emptyCreate);
      await loadList();
      if(res?.item?.id) setSelectedId(res.item.id);
    }catch(e){setError(e?.message||'Failed to create chit');}
    finally{setSavingCreate(false);}
  };

  const postPayment=async()=>{
    if(!selectedId) return;
    try{
      await safeApi(`/api/v1/chits/${selectedId}/payments`,{method:'POST',body:{
        chitInstallmentId:paymentForm.chitInstallmentId,
        amountPaid:toNum(paymentForm.amountPaid),
        paymentDate:paymentForm.paymentDate,
        mode:paymentForm.mode,
        reference:paymentForm.reference||null,
        narration:paymentForm.narration||null,
      }});
      setPaymentForm(f=>({...f,amountPaid:'',reference:'',narration:''}));
      await Promise.all([loadList(),loadDetail(selectedId),loadPortfolio()]);
    }catch(e){setError(e?.message||'Failed to save payment');}
  };

  const saveReceipt=async()=>{
    if(!selectedId) return;
    try{
      await safeApi(`/api/v1/chits/${selectedId}/receipt`,{method:'POST',body:{
        drawDate:receiptForm.drawDate,
        amountReceived:toNum(receiptForm.amountReceived),
        discountAmount:toNum(receiptForm.discountAmount),
        commissionAmount:toNum(receiptForm.commissionAmount),
        otherCharges:toNum(receiptForm.otherCharges),
        feesPaidSeparately:!!receiptForm.feesPaidSeparately,
        receiptMode:receiptForm.receiptMode,
        reference:receiptForm.reference||null,
        notes:receiptForm.notes||null,
      }});
      await Promise.all([loadList(),loadDetail(selectedId),loadPortfolio()]);
    }catch(e){setError(e?.message||'Failed to save receipt');}
  };

  const addAllocation=async()=>{
    if(!selectedId) return;
    try{
      await safeApi(`/api/v1/chits/${selectedId}/allocations`,{method:'POST',body:{
        allocationDate:allocationForm.allocationDate,
        amountAllocated:toNum(allocationForm.amountAllocated),
        purpose:allocationForm.purpose,
        targetEntityType:allocationForm.targetEntityType||null,
        targetEntityId:allocationForm.targetEntityId||null,
        linkedLoanId:allocationForm.linkedLoanId||null,
        notes:allocationForm.notes||null,
      }});
      setAllocationForm(f=>({...f,amountAllocated:'',targetEntityId:'',linkedLoanId:'',notes:''}));
      await Promise.all([loadList(),loadDetail(selectedId),loadPortfolio()]);
    }catch(e){setError(e?.message||'Failed to save allocation');}
  };

  const addReturn=async()=>{
    if(!selectedId) return;
    try{
      await safeApi(`/api/v1/chits/${selectedId}/returns`,{method:'POST',body:{
        returnDate:returnForm.returnDate,
        amountReturned:toNum(returnForm.amountReturned),
        sourceType:returnForm.sourceType,
        linkedLoanId:returnForm.linkedLoanId||null,
        linkedCollectionId:returnForm.linkedCollectionId||null,
        interestIncomeAmount:toNum(returnForm.interestIncomeAmount),
        otherIncomeAmount:toNum(returnForm.otherIncomeAmount),
        notes:returnForm.notes||null,
      }});
      setReturnForm(f=>({...f,amountReturned:'',interestIncomeAmount:'',otherIncomeAmount:'',linkedLoanId:'',linkedCollectionId:'',notes:''}));
      await Promise.all([loadList(),loadDetail(selectedId),loadPortfolio()]);
    }catch(e){setError(e?.message||'Failed to save return');}
  };

  if(!apiReady){
    return <div className="fade-in"><div className="card" style={{padding:22}}><h2 style={{fontSize:22,fontWeight:800,marginBottom:8}}>Chit Funding ROI</h2><p style={{color:'var(--st)',fontSize:13}}>Backend login required. This module works only in backend/API mode because it needs audit trail, reconciliation, and XIRR calculations on server data.</p></div></div>;
  }

  const roiSummary=roi?.chit_summary;
  const portfolioSummary=portfolio?.portfolio_summary;
  const stressRows=Array.isArray(portfolio?.stress_table_monthly)?portfolio.stress_table_monthly:[];

  return (
    <div className="fade-in">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:10,flexWrap:'wrap',marginBottom:16}}>
        <div>
          <h2 style={{fontSize:24,fontWeight:800}}>Chit Funding ROI</h2>
          <p style={{color:'var(--st)',fontSize:13,marginTop:2}}>CFO view of chit cost, deployment yield, spread, and cashflow stress · Org: {orgCode||backendAuth?.organization?.name}</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="bgh" onClick={()=>{loadList(); if(selectedId) loadDetail(selectedId); loadPortfolio();}}>{loading?'Refreshing...':'Refresh'}</button>
          <button className="bg" onClick={()=>setShowCreate(v=>!v)}>{showCreate?'Close Form':'New Chit'}</button>
        </div>
      </div>

      {error&&<div className="card" style={{padding:10,marginBottom:12,borderColor:'rgba(255,107,107,.2)',background:'rgba(255,107,107,.05)',color:'var(--red)',fontSize:12}}>{error}</div>}

      <div className="card" style={{padding:14,marginBottom:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:8}}>
          <h3 style={{fontSize:14,fontWeight:700}}>Financial Year Portfolio Impact</h3>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <span className="lbl" style={{margin:0}}>FY</span>
            <select className="inp" style={{width:140}} value={fyStartYear} onChange={e=>setFyStartYear(parseInt(e.target.value,10))}>
              {Array.from({length:8},(_,i)=>currentFyStart-3+i).map(y=><option key={y} value={y}>{fyLabel(y)}</option>)}
            </select>
            <button className="bd" onClick={loadPortfolio}>{portfolioBusy?'Loading...':'Reload FY'}</button>
          </div>
        </div>
        {portfolio?.error&&<div style={{fontSize:12,color:'var(--red)',marginBottom:8}}>{portfolio.error}</div>}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:10,marginBottom:10}}>
          {[
            ['Running Chits',portfolioSummary?.runningChitsCount??0,''],
            ['Monthly Obligation',fc(portfolioSummary?.totalMonthlyObligation||0),'sb'],
            ['Blended Cost XIRR',pct(portfolioSummary?.blendedChitXirrAnnualPct),'sn'],
            ['Blended Yield XIRR',pct(portfolioSummary?.blendedYieldXirrAnnualPct),'sp'],
            ['Portfolio Spread',pct(portfolioSummary?.portfolioSpreadPct),(toNum(portfolioSummary?.portfolioSpreadPct)>=0?'sp':'sn')],
            ['Net Profit (₹)',fc(portfolioSummary?.netProfitRs||0),(toNum(portfolioSummary?.netProfitRs)>=0?'sp':'sn')],
          ].map(([l,v,c])=>(
            <div key={l} style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
              <p style={{fontSize:10,color:'var(--st)',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{l}</p>
              <p className={`mono ${c}`} style={{fontSize:14,fontWeight:700}}>{v}</p>
            </div>
          ))}
        </div>
        <div style={{maxHeight:180,overflow:'auto',border:'1px solid var(--border)',borderRadius:8}}>
          <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr><th>Month</th><th style={{textAlign:'right'}}>Chit Due</th><th style={{textAlign:'right'}}>Business Inflow</th><th style={{textAlign:'right'}}>Stress Ratio</th><th>Flag</th><th style={{textAlign:'right'}}>Worst-Case Ratio</th><th>Worst Flag</th></tr></thead>
            <tbody>
              {stressRows.length===0&&<tr><td colSpan="7" style={{padding:16,textAlign:'center',color:'var(--st)'}}>{portfolioBusy?'Loading...':'No stress data yet (create chit and/or payments).'}</td></tr>}
              {stressRows.map(r=>(
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td style={{textAlign:'right'}} className="mono">{fc(r.totalChitInstallmentsDue)}</td>
                  <td style={{textAlign:'right'}} className="mono">{fc(r.businessCashInflows)}</td>
                  <td style={{textAlign:'right'}} className="mono">{r.stressRatio==null?'—':r.stressRatio.toFixed(2)}</td>
                  <td><span className={`badge ${r.stressFlag==='SAFE'?'bg-g':r.stressFlag==='WATCH'?'bg-y':'bg-r'}`}>{r.stressFlag}</span></td>
                  <td style={{textAlign:'right'}} className="mono">{r.scenario?.worstCase?.stressRatio==null?'—':Number(r.scenario.worstCase.stressRatio).toFixed(2)}</td>
                  <td><span className={`badge ${r.scenario?.worstCase?.stressFlag==='SAFE'?'bg-g':r.scenario?.worstCase?.stressFlag==='WATCH'?'bg-y':'bg-r'}`}>{r.scenario?.worstCase?.stressFlag||'N/A'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate&&(
        <div className="card" style={{padding:16,marginBottom:14}}>
          <h3 style={{fontSize:14,fontWeight:700,marginBottom:10}}>Create New Chit</h3>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
            <div style={{gridColumn:'span 2'}}><span className="lbl">Chit Name</span><input className="inp" value={createForm.chitName} onChange={e=>setCreateForm({...createForm,chitName:e.target.value})}/></div>
            <div><span className="lbl">Draw Type</span><select className="inp" value={createForm.drawType} onChange={e=>setCreateForm({...createForm,drawType:e.target.value})}><option>AUCTION</option><option>LOTTERY</option><option>FIXED</option></select></div>
            <div><span className="lbl">Group Name</span><input className="inp" value={createForm.groupName} onChange={e=>setCreateForm({...createForm,groupName:e.target.value})}/></div>
            <div><span className="lbl">Organizer</span><input className="inp" value={createForm.organizer} onChange={e=>setCreateForm({...createForm,organizer:e.target.value})}/></div>
            <div><span className="lbl">Bank/Cashbook Ref</span><input className="inp" value={createForm.bankAccountRef} onChange={e=>setCreateForm({...createForm,bankAccountRef:e.target.value})}/></div>
            <div><span className="lbl">Face Value (₹)</span><input className="inp" type="number" value={createForm.faceValue} onChange={e=>setCreateForm({...createForm,faceValue:e.target.value})}/></div>
            <div><span className="lbl">Tenure (Months)</span><input className="inp" type="number" value={createForm.tenureMonths} onChange={e=>setCreateForm({...createForm,tenureMonths:e.target.value})}/></div>
            <div><span className="lbl">Installment/Month (₹)</span><input className="inp" type="number" value={createForm.installmentAmount} onChange={e=>setCreateForm({...createForm,installmentAmount:e.target.value})}/></div>
            <div><span className="lbl">Start Date</span><input className="inp" type="date" value={createForm.startDate} onChange={e=>setCreateForm({...createForm,startDate:e.target.value})}/></div>
            <div><span className="lbl">Treatment Mode</span><select className="inp" value={createForm.accountingTreatmentMode} onChange={e=>setCreateForm({...createForm,accountingTreatmentMode:e.target.value})}><option value="FINANCING">FINANCING</option><option value="SAVING_ASSET">SAVING_ASSET</option></select></div>
            <div style={{gridColumn:'span 3'}}><span className="lbl">Notes</span><textarea className="inp" rows="2" value={createForm.notes} onChange={e=>setCreateForm({...createForm,notes:e.target.value})}/></div>
          </div>
          <button className="bg" onClick={createChit} disabled={savingCreate}>{savingCreate?'Creating...':'Create Chit + Schedule'}</button>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:14,alignItems:'start'}}>
        <div className="card" style={{padding:14,maxHeight:'72vh',overflow:'auto'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <h3 style={{fontSize:14,fontWeight:700}}>Chit Register</h3>
            <span className="badge bg-b">{items.length}</span>
          </div>
          {loading&&<p style={{fontSize:12,color:'var(--st)'}}>Loading chits...</p>}
          {!loading&&items.length===0&&<p style={{fontSize:12,color:'var(--st)'}}>No chits yet. Create your first chit.</p>}
          {items.map(it=>{
            const active=selectedId===it.id;
            return (
              <div key={it.id} onClick={()=>setSelectedId(it.id)} style={{cursor:'pointer',padding:'10px 12px',borderRadius:10,border:`1px solid ${active?'rgba(201,168,76,.35)':'var(--border)'}`,background:active?'rgba(201,168,76,.06)':'var(--ob3)',marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:13,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.chitName}</div>
                    <div style={{fontSize:10,color:'var(--st)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.chitCode} · {it.organizer||'—'} · {it.tenureMonths}M</div>
                  </div>
                  <span className={`badge ${it.status==='RUNNING'?'bg-g':it.status==='CLOSED'?'bg-b':'bg-r'}`}>{it.status}</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8,fontSize:11}}>
                  <div><div style={{color:'var(--st)',fontSize:9}}>Face</div><div className="mono">{fc(it.faceValue)}</div></div>
                  <div><div style={{color:'var(--st)',fontSize:9}}>Monthly</div><div className="mono">{fc(it.installmentAmount)}</div></div>
                  <div><div style={{color:'var(--st)',fontSize:9}}>Paid</div><div className="mono sp">{fc(it.totalPaid)}</div></div>
                  <div><div style={{color:'var(--st)',fontSize:9}}>Available</div><div className={`mono ${toNum(it.availableChitBalance)>=0?'sb':'sn'}`}>{fc(it.availableChitBalance)}</div></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card" style={{padding:16,minHeight:420}}>
          {!selectedId&&<p style={{fontSize:13,color:'var(--st)'}}>Select a chit from the register to view details, payments, receipt, allocations, ROI, stress, journal, and audit trail.</p>}
          {selectedId&&detail&&(
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap',marginBottom:12}}>
                <div>
                  <h3 style={{fontSize:18,fontWeight:800}}>{detail.item?.chitName||'Chit Detail'}</h3>
                  <p style={{fontSize:11,color:'var(--st)',marginTop:2}}>{detail.item?.chitCode} · {detail.item?.organizer||'—'} · Started {fd(detail.item?.startDate)}</p>
                </div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {(roiSummary?.spread?.profitabilityFlag||'UNAVAILABLE')!=='UNAVAILABLE'&&<span className={`badge ${String(roiSummary?.spread?.profitabilityFlag||'').includes('NEGATIVE')?'bg-r':'bg-g'}`}>{roiSummary?.spread?.profitabilityFlag?.replaceAll('_',' ')}</span>}
                  <span className={`badge ${detail.item?.status==='RUNNING'?'bg-g':'bg-b'}`}>{detail.item?.status}</span>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:12}}>
                {[
                  ['Face Value',fc(detail.item?.faceValue||0),''],
                  ['Amount Received',fc(detail.item?.amountReceived||detail.receipt?.amountReceived||0),'sp'],
                  ['Total Paid',fc(detail.stats?.totalPaid||0),'sb'],
                  ['Remaining Due',fc(detail.stats?.remainingDue||0),'sn'],
                  ['Available Chit Balance',fc(detail.stats?.availableChitBalance||0),toNum(detail.stats?.availableChitBalance)>=0?'sp':'sn'],
                  ['Cost XIRR',pct(roiSummary?.cost?.chitXirrAnnualPct),toNum(roiSummary?.cost?.chitXirrAnnualPct)>0?'sn':''],
                  ['Yield XIRR',pct(roiSummary?.yield?.yieldXirrAnnualPct),toNum(roiSummary?.yield?.yieldXirrAnnualPct)>=0?'sp':''],
                  ['Net Spread',pct(roiSummary?.spread?.netSpreadPct),toNum(roiSummary?.spread?.netSpreadPct)>=0?'sp':'sn'],
                ].map(([l,v,c])=>(
                  <div key={l} style={{background:'var(--ob3)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px'}}>
                    <p style={{fontSize:10,color:'var(--st)',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{l}</p>
                    <p className={`mono ${c}`} style={{fontSize:14,fontWeight:700}}>{v}</p>
                  </div>
                ))}
              </div>

              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12}}>
                {['PAYMENTS','RECEIPT','ALLOCATION','RETURNS','ROI','STRESS','JOURNAL','AUDIT'].map(t=><button key={t} className={detailTab===t?'bg':'bgh'} style={{padding:'6px 10px',fontSize:11}} onClick={()=>setDetailTab(t)}>{t}</button>)}
              </div>

              {detailTab==='PAYMENTS'&&(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1fr auto',gap:8,alignItems:'end',marginBottom:10}}>
                    <div>
                      <span className="lbl">Installment</span>
                      <select className="inp" value={paymentForm.chitInstallmentId} onChange={e=>setPaymentForm({...paymentForm,chitInstallmentId:e.target.value})}>
                        <option value="">Select installment</option>
                        {installments.map(i=><option key={i.id} value={i.id}>#{i.installmentNo} · Due {i.dueDate} · {fc(i.expectedAmount-i.paidAmount)} pending</option>)}
                      </select>
                    </div>
                    <div><span className="lbl">Payment Date</span><input className="inp" type="date" value={paymentForm.paymentDate} onChange={e=>setPaymentForm({...paymentForm,paymentDate:e.target.value})}/></div>
                    <div><span className="lbl">Amount Paid</span><input className="inp" type="number" value={paymentForm.amountPaid} onChange={e=>setPaymentForm({...paymentForm,amountPaid:e.target.value})} placeholder={selectedInstallment?String(Math.max(0,toNum(selectedInstallment.expectedAmount)-toNum(selectedInstallment.paidAmount))):'0'}/></div>
                    <div><span className="lbl">Mode</span><select className="inp" value={paymentForm.mode} onChange={e=>setPaymentForm({...paymentForm,mode:e.target.value})}><option>BANK</option><option>CASH</option><option>UPI</option></select></div>
                    <button className="bg" onClick={postPayment}>Save</button>
                  </div>
                  <div style={{maxHeight:320,overflow:'auto',border:'1px solid var(--border)',borderRadius:8}}>
                    <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr><th>#</th><th>Due Date</th><th style={{textAlign:'right'}}>Expected</th><th style={{textAlign:'right'}}>Paid</th><th>Status</th><th style={{textAlign:'right'}}>Overdue Days</th></tr></thead>
                      <tbody>
                        {installments.map(i=>(
                          <tr key={i.id}>
                            <td>{i.installmentNo}</td>
                            <td>{i.dueDate}</td>
                            <td style={{textAlign:'right'}} className="mono">{fc(i.expectedAmount)}</td>
                            <td style={{textAlign:'right'}} className="mono">{fc(i.paidAmount)}</td>
                            <td><span className={`badge ${i.reconciliationStatus==='PAID'?'bg-g':i.reconciliationStatus==='PARTIAL'?'bg-y':'bg-r'}`}>{i.reconciliationStatus}</span></td>
                            <td style={{textAlign:'right'}} className="mono">{i.overdueDays||0}</td>
                          </tr>
                        ))}
                        {installments.length===0&&<tr><td colSpan="6" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No installments found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailTab==='RECEIPT'&&(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                    <div><span className="lbl">Draw Date</span><input className="inp" type="date" value={receiptForm.drawDate} onChange={e=>setReceiptForm({...receiptForm,drawDate:e.target.value})}/></div>
                    <div><span className="lbl">Amount Received</span><input className="inp" type="number" value={receiptForm.amountReceived} onChange={e=>setReceiptForm({...receiptForm,amountReceived:e.target.value})}/></div>
                    <div><span className="lbl">Discount</span><input className="inp" type="number" value={receiptForm.discountAmount} onChange={e=>setReceiptForm({...receiptForm,discountAmount:e.target.value})}/></div>
                    <div><span className="lbl">Commission</span><input className="inp" type="number" value={receiptForm.commissionAmount} onChange={e=>setReceiptForm({...receiptForm,commissionAmount:e.target.value})}/></div>
                    <div><span className="lbl">Other Charges</span><input className="inp" type="number" value={receiptForm.otherCharges} onChange={e=>setReceiptForm({...receiptForm,otherCharges:e.target.value})}/></div>
                    <div><span className="lbl">Receipt Mode</span><select className="inp" value={receiptForm.receiptMode} onChange={e=>setReceiptForm({...receiptForm,receiptMode:e.target.value})}><option>BANK</option><option>CASH</option><option>UPI</option></select></div>
                    <div><span className="lbl">Fees separate?</span><select className="inp" value={receiptForm.feesPaidSeparately?'YES':'NO'} onChange={e=>setReceiptForm({...receiptForm,feesPaidSeparately:e.target.value==='YES'})}><option>YES</option><option>NO</option></select></div>
                    <div><span className="lbl">Reference</span><input className="inp" value={receiptForm.reference} onChange={e=>setReceiptForm({...receiptForm,reference:e.target.value})}/></div>
                    <div style={{gridColumn:'span 4'}}><span className="lbl">Notes</span><input className="inp" value={receiptForm.notes} onChange={e=>setReceiptForm({...receiptForm,notes:e.target.value})}/></div>
                  </div>
                  <button className="bg" onClick={saveReceipt}>Save / Update Credit Receipt</button>
                  {receipt&&<div className="card" style={{padding:10,marginTop:10}}><p style={{fontSize:12,color:'var(--st)'}}>Recorded receipt: {fd(receipt.drawDate)} · {fc(receipt.amountReceived)} · Ref {receipt.reference||'—'}</p></div>}
                </div>
              )}

              {detailTab==='ALLOCATION'&&(
                <div>
                  <div className="card" style={{padding:10,marginBottom:10,background:'rgba(201,168,76,.05)'}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>Available Chit Balance</span><span className={`mono ${availableBalance>=0?'sp':'sn'}`}>{fc(availableBalance)}</span></div>
                    <p style={{fontSize:11,color:'var(--st)',marginTop:4}}>Allocation reduces available balance. System blocks excess allocation unless overdraft is allowed.</p>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                    <div><span className="lbl">Date</span><input className="inp" type="date" value={allocationForm.allocationDate} onChange={e=>setAllocationForm({...allocationForm,allocationDate:e.target.value})}/></div>
                    <div><span className="lbl">Amount</span><input className="inp" type="number" value={allocationForm.amountAllocated} onChange={e=>setAllocationForm({...allocationForm,amountAllocated:e.target.value})}/></div>
                    <div><span className="lbl">Purpose</span><select className="inp" value={allocationForm.purpose} onChange={e=>setAllocationForm({...allocationForm,purpose:e.target.value})}><option>LENDING</option><option>INVENTORY</option><option>EXPENSES</option><option>ASSET</option><option>OTHER</option></select></div>
                    <div><span className="lbl">Target Type</span><input className="inp" value={allocationForm.targetEntityType} onChange={e=>setAllocationForm({...allocationForm,targetEntityType:e.target.value})} placeholder="LOAN"/></div>
                    <div><span className="lbl">Target Entity ID</span><input className="inp" value={allocationForm.targetEntityId} onChange={e=>setAllocationForm({...allocationForm,targetEntityId:e.target.value})}/></div>
                    <div><span className="lbl">Linked Loan ID</span><input className="inp" value={allocationForm.linkedLoanId} onChange={e=>setAllocationForm({...allocationForm,linkedLoanId:e.target.value})}/></div>
                    <div style={{gridColumn:'span 2'}}><span className="lbl">Notes</span><input className="inp" value={allocationForm.notes} onChange={e=>setAllocationForm({...allocationForm,notes:e.target.value})}/></div>
                  </div>
                  <button className="bg" onClick={addAllocation}>Add Allocation</button>
                  <div style={{maxHeight:260,overflow:'auto',marginTop:10,border:'1px solid var(--border)',borderRadius:8}}>
                    <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr><th>Date</th><th>Purpose</th><th>Target</th><th style={{textAlign:'right'}}>Amount</th></tr></thead>
                      <tbody>
                        {allocations.map(a=><tr key={a.id}><td>{fd(a.allocationDate)}</td><td>{a.purpose}</td><td>{a.targetEntityType||'—'} {a.targetEntityId||a.linkedLoanId||''}</td><td style={{textAlign:'right'}} className="mono sn">{fc(a.amountAllocated)}</td></tr>)}
                        {allocations.length===0&&<tr><td colSpan="4" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No allocations yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailTab==='RETURNS'&&(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                    <div><span className="lbl">Return Date</span><input className="inp" type="date" value={returnForm.returnDate} onChange={e=>setReturnForm({...returnForm,returnDate:e.target.value})}/></div>
                    <div><span className="lbl">Capital Returned</span><input className="inp" type="number" value={returnForm.amountReturned} onChange={e=>setReturnForm({...returnForm,amountReturned:e.target.value})}/></div>
                    <div><span className="lbl">Interest Income</span><input className="inp" type="number" value={returnForm.interestIncomeAmount} onChange={e=>setReturnForm({...returnForm,interestIncomeAmount:e.target.value})}/></div>
                    <div><span className="lbl">Other Income</span><input className="inp" type="number" value={returnForm.otherIncomeAmount} onChange={e=>setReturnForm({...returnForm,otherIncomeAmount:e.target.value})}/></div>
                    <div><span className="lbl">Source</span><select className="inp" value={returnForm.sourceType} onChange={e=>setReturnForm({...returnForm,sourceType:e.target.value})}><option>LOAN_PRINCIPAL_REPAYMENT</option><option>BUSINESS_SURPLUS</option><option>OTHER</option></select></div>
                    <div><span className="lbl">Linked Loan ID</span><input className="inp" value={returnForm.linkedLoanId} onChange={e=>setReturnForm({...returnForm,linkedLoanId:e.target.value})}/></div>
                    <div><span className="lbl">Linked Collection ID</span><input className="inp" value={returnForm.linkedCollectionId} onChange={e=>setReturnForm({...returnForm,linkedCollectionId:e.target.value})}/></div>
                    <div><span className="lbl">Notes</span><input className="inp" value={returnForm.notes} onChange={e=>setReturnForm({...returnForm,notes:e.target.value})}/></div>
                  </div>
                  <button className="bg" onClick={addReturn}>Add Return / Income</button>
                  <div style={{maxHeight:260,overflow:'auto',marginTop:10,border:'1px solid var(--border)',borderRadius:8}}>
                    <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr><th>Date</th><th>Source</th><th style={{textAlign:'right'}}>Capital</th><th style={{textAlign:'right'}}>Interest</th><th style={{textAlign:'right'}}>Other</th></tr></thead>
                      <tbody>
                        {returnsRows.map(r=><tr key={r.id}><td>{fd(r.returnDate)}</td><td>{r.sourceType}</td><td style={{textAlign:'right'}} className="mono">{fc(r.amountReturned)}</td><td style={{textAlign:'right'}} className="mono sp">{fc(r.interestIncomeAmount)}</td><td style={{textAlign:'right'}} className="mono sp">{fc(r.otherIncomeAmount)}</td></tr>)}
                        {returnsRows.length===0&&<tr><td colSpan="5" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No returns yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detailTab==='ROI'&&(
                <div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                    <div className="card" style={{padding:12}}><p style={{fontSize:10,color:'var(--st)',fontWeight:700,textTransform:'uppercase'}}>Chit Cost XIRR</p><p className="mono sn" style={{fontSize:16,fontWeight:700}}>{pct(roiSummary?.cost?.chitXirrAnnualPct)}</p><p style={{fontSize:11,color:'var(--st)'}}>Total Paid {fc(roiSummary?.cost?.totalPaid||0)} · Net Proceeds {fc(roiSummary?.cost?.netProceeds||0)}</p></div>
                    <div className="card" style={{padding:12}}><p style={{fontSize:10,color:'var(--st)',fontWeight:700,textTransform:'uppercase'}}>Yield XIRR</p><p className="mono sp" style={{fontSize:16,fontWeight:700}}>{pct(roiSummary?.yield?.yieldXirrAnnualPct)}</p><p style={{fontSize:11,color:'var(--st)'}}>Allocated {fc(roiSummary?.yield?.totalAllocated||0)} · Attributed Income {fc(roiSummary?.yield?.attributedIncome||0)}</p></div>
                    <div className="card" style={{padding:12}}><p style={{fontSize:10,color:'var(--st)',fontWeight:700,textTransform:'uppercase'}}>Net Spread / P&L</p><p className={`mono ${toNum(roiSummary?.spread?.netSpreadPct)>=0?'sp':'sn'}`} style={{fontSize:16,fontWeight:700}}>{pct(roiSummary?.spread?.netSpreadPct)}</p><p style={{fontSize:11,color:'var(--st)'}}>Net ₹ {fc(roiSummary?.spread?.netProfitRs||0)} · Break-even {pct(roiSummary?.spread?.breakEvenYieldPct)}</p></div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    <div className="card" style={{padding:12,maxHeight:280,overflow:'auto'}}>
                      <h4 style={{fontSize:12,fontWeight:700,marginBottom:8}}>Cost Cashflows (XIRR Inputs)</h4>
                      <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Date</th><th>Type</th><th style={{textAlign:'right'}}>Amount</th></tr></thead><tbody>
                        {(roi?.cashflow_series_per_chit?.costCashflows||[]).map((f,i)=><tr key={i}><td>{fd(f.date)}</td><td>{f.type}</td><td style={{textAlign:'right'}} className={`mono ${toNum(f.amount)>=0?'sp':'sn'}`}>{fc(f.amount)}</td></tr>)}
                        {!(roi?.cashflow_series_per_chit?.costCashflows||[]).length&&<tr><td colSpan="3" style={{padding:12,textAlign:'center',color:'var(--st)'}}>No cost cashflows yet</td></tr>}
                      </tbody></table>
                    </div>
                    <div className="card" style={{padding:12,maxHeight:280,overflow:'auto'}}>
                      <h4 style={{fontSize:12,fontWeight:700,marginBottom:8}}>Yield Cashflows (XIRR Inputs)</h4>
                      <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Date</th><th>Type</th><th style={{textAlign:'right'}}>Amount</th></tr></thead><tbody>
                        {(roi?.cashflow_series_per_chit?.yieldCashflows||[]).map((f,i)=><tr key={i}><td>{fd(f.date)}</td><td>{f.type}</td><td style={{textAlign:'right'}} className={`mono ${toNum(f.amount)>=0?'sp':'sn'}`}>{fc(f.amount)}</td></tr>)}
                        {!(roi?.cashflow_series_per_chit?.yieldCashflows||[]).length&&<tr><td colSpan="3" style={{padding:12,textAlign:'center',color:'var(--st)'}}>No yield cashflows yet. Add allocations and returns.</td></tr>}
                      </tbody></table>
                    </div>
                  </div>
                </div>
              )}

              {detailTab==='STRESS'&&(
                <div>
                  <p style={{fontSize:12,color:'var(--st)',marginBottom:8}}>Per-chit stress is derived from this chit’s installment obligations against business inflows. Portfolio stress is shown in the FY panel above.</p>
                  <button className="bd" onClick={async()=>{
                    try{ const data=await safeApi(`/api/v1/chits/${selectedId}/stress`); alert(`Loaded ${data?.stress_table_monthly?.length||0} month(s) of stress data. See FY panel for portfolio view.`);}catch(e){setError(e?.message||'Stress fetch failed');}
                  }}>Refresh Chit Stress (API)</button>
                </div>
              )}

              {detailTab==='JOURNAL'&&(
                <div style={{maxHeight:340,overflow:'auto',border:'1px solid var(--border)',borderRadius:8}}>
                  <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr><th>Date</th><th>Event</th><th>Account</th><th style={{textAlign:'right'}}>Dr</th><th style={{textAlign:'right'}}>Cr</th></tr></thead>
                    <tbody>
                      {journalRows.map(j=><tr key={j.id}><td>{fd(j.posting_date)}</td><td>{j.source_event_type}</td><td>{j.account_name}</td><td style={{textAlign:'right'}} className="mono">{toNum(j.dr_amount)?fc(j.dr_amount):'—'}</td><td style={{textAlign:'right'}} className="mono">{toNum(j.cr_amount)?fc(j.cr_amount):'—'}</td></tr>)}
                      {journalRows.length===0&&<tr><td colSpan="5" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No chit journals yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}

              {detailTab==='AUDIT'&&(
                <div style={{maxHeight:340,overflow:'auto',border:'1px solid var(--border)',borderRadius:8}}>
                  <table className="tbl" style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr><th>When</th><th>Entity</th><th>Action</th><th>User</th></tr></thead>
                    <tbody>
                      {auditRows.map(a=><tr key={a.id}><td>{fd(a.createdAt||a.created_at)}</td><td>{a.entityType||a.entity_type}</td><td>{a.action}</td><td className="mono" style={{fontSize:11}}>{a.actorUserId||a.actor_user_id||'—'}</td></tr>)}
                      {auditRows.length===0&&<tr><td colSpan="4" style={{padding:14,textAlign:'center',color:'var(--st)'}}>No audit events yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
