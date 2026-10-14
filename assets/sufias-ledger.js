document.querySelectorAll('[data-ledger]').forEach(root=>{
 const status=root.querySelector('[data-ledger-status]');if(!status)return;
 const money=v=>new Intl.NumberFormat('en-PK',{style:'currency',currency:'PKR'}).format(v/100);
 const form=root.querySelector('[data-ledger-payment]');let key=crypto.randomUUID();
 async function api(options){const response=await fetch(root.dataset.endpoint,options);if(!response.headers.get('content-type')?.includes('application/json'))throw Error('Ledger is temporarily unavailable. Please contact Sufias Fashion.');const result=await response.json();if(!response.ok)throw Error(result.error||'Unable to load ledger');return result;}
 async function load(){try{
  status.textContent='Loading your ledger…';const {entries,orderSync}=await api();let charges=0,paid=0;const rows=root.querySelector('[data-ledger-rows]');rows.replaceChildren();
  const targets=form.querySelector('[data-payment-target]'),selected=targets.value;targets.replaceChildren(new Option('Select an order or booking',''));
  for(const e of entries){const details=JSON.parse(e.details);if(e.status==='approved'){if(e.kind==='booking')charges+=e.amount;else if(!details.appliesToShopifyOrder)paid+=e.amount;}
   if(e.kind==='booking'&&e.status!=='rejected')targets.add(new Option(details.orderName||'Booking '+new Date(e.created).toLocaleDateString('en-PK')+' • '+money(e.amount),e.id));
   const isOrder=details.source==='shopify',label=isOrder?(e.kind==='booking'?'Checkout order':'Verified checkout payment'):(e.kind==='payment'?'Payment proof':'Booking request');
   const description=isOrder?`${details.orderName} • ${details.financialStatus}`:e.kind==='payment'?`${details.method||''} • ${details.reference||''}`:(details.items||[]).map(i=>`${i.name||i.variantId} × ${i.quantity}`).join(', ');
   let state=e.status;if(e.kind==='payment'&&!isOrder)state=e.status==='pending'?'Awaiting receipt review':e.status==='approved'&&details.appliesToShopifyOrder?'Receipt reviewed; checkout payment status applies':e.status;
   const tr=document.createElement('tr');for(const value of [new Date(e.created).toLocaleDateString('en-PK'),label,description,money(isOrder?details.actualAmount??e.amount:e.amount),state]){const td=document.createElement('td');td.textContent=value;tr.append(td);}rows.append(tr);
  }
  targets.value=selected;root.querySelector('[data-charges]').textContent=money(charges);root.querySelector('[data-paid]').textContent=money(paid);root.querySelector('[data-balance]').textContent=money(charges-paid);
  status.textContent=orderSync==='unavailable'?'Checkout orders are temporarily unavailable. Saved bookings and receipts are shown below. Please contact Sufias Fashion.':entries.length?'Ledger updated.':'No orders, bookings or payments yet.';
 }catch(error){status.textContent=error.message;}}
 form.addEventListener('input',()=>{key=crypto.randomUUID();});
 const readFile=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Unable to read receipt'));reader.readAsDataURL(file);});
 form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button');button.disabled=true;try{
  const data=new FormData(form),file=data.get('receipt');if(!file||!file.size)throw Error('Upload your payment receipt');if(file.size>1048576)throw Error('Receipt must be no larger than 1 MB');
  await api({method:'POST',headers:{'Content-Type':'application/json','X-Ledger-Request':'1'},body:JSON.stringify({kind:'payment',amount:Math.round(Number(data.get('amount'))*100),key,details:{reference:data.get('reference'),method:data.get('method'),targetId:data.get('targetId')},proof:{type:file.type,base64:await readFile(file)}})});
  form.reset();key=crypto.randomUUID();await load();status.textContent='Receipt submitted for review. This is not a verified payment. Checkout orders update when Shopify confirms payment.';
 }catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
 root.querySelector('[data-ledger-refresh]').onclick=load;load();
});
