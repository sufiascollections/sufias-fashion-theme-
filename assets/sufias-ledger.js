document.querySelectorAll('[data-ledger]').forEach(root=>{
 const status=root.querySelector('[data-ledger-status]');if(!status)return;
 const money=v=>new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR'}).format(v/100);
 const form=root.querySelector('[data-ledger-payment]');let key=crypto.randomUUID();
 async function api(options){const response=await fetch(root.dataset.endpoint,options);if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Khata service is not connected yet. Please contact Sufias Fashion.');const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load khata');return result;}
 async function load(){try{
  status.textContent='Loading your khata…';const {entries}=await api();let charges=0,paid=0;const rows=root.querySelector('[data-ledger-rows]');rows.replaceChildren();
  for(const e of entries){if(e.status==='approved'){if(e.kind==='booking')charges+=e.amount;else paid+=e.amount;}const details=JSON.parse(e.details);const tr=document.createElement('tr');for(const value of [new Date(e.created).toLocaleDateString('en-PK'),e.kind, e.kind==='payment'?`${details.method||''} • ${details.reference||''}`:(details.items||[]).map(i=>`${i.name||i.variantId} × ${i.quantity}`).join(', '),money(e.amount),e.status]){const td=document.createElement('td');td.textContent=value;tr.append(td);}rows.append(tr);}
  root.querySelector('[data-charges]').textContent=money(charges);root.querySelector('[data-paid]').textContent=money(paid);root.querySelector('[data-balance]').textContent=money(charges-paid);status.textContent=entries.length?'Khata updated.':'No bookings or payments yet.';
 }catch(error){status.textContent=error.message;}}
 form.addEventListener('input',()=>{key=crypto.randomUUID();});
 form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{const data=new FormData(form);await api({method:'POST',headers:{'Content-Type':'application/json','X-Ledger-Request':'1'},body:JSON.stringify({kind:'payment',amount:Math.round(Number(data.get('amount'))*100),key,details:{reference:data.get('reference'),method:data.get('method')}})});form.reset();key=crypto.randomUUID();await load();status.textContent='Payment submitted. Your balance will update after admin approval.';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
 root.querySelector('[data-ledger-refresh]').onclick=load;load();
});
