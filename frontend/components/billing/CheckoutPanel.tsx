'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, ArrowRight, Check, LockKeyhole, Loader2} from 'lucide-react';
import LoginModal from '@/components/auth/LoginModal';
import LabMateLogo from '@/components/brand/LabMateLogo';
import {useAuth} from '@/contexts/BasicAuthContext';
import {billingApi,Catalogue,loadRazorpay,Pack,Purchase,paymentError,rupees,Wallet} from '@/lib/billing';
import styles from './billing.module.css';

export default function CheckoutPanel({packId}:{packId:string}) {
  const {user,loading}=useAuth();
  const [catalogue,setCatalogue]=useState<Catalogue|null>(null);
  const [balance,setBalance]=useState<Wallet|null>(null);
  const [order,setOrder]=useState<Purchase|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [loginOpen,setLoginOpen]=useState(false);
  const [retry,setRetry]=useState(0);
  const confirming=useRef(false);
  const active=useRef(true);
  const requestKey=useRef('');
  const storageKey=user?`labmate_checkout_${user.id}`:'';
  const requestStorageKey=storageKey+'_'+packId+'_request';
  const pack:Pack|undefined=catalogue?.packs.find(p=>p.id===packId);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();
    billingApi.catalogue(controller.signal).then(setCatalogue).catch(e=>{if(!controller.signal.aborted)setMessage(paymentError(e));});
    return()=>controller.abort();
  },[retry]);
  useEffect(()=>{
    setOrder(null);setBalance(null); requestKey.current='';
    if(!user)return;
    const controller=new AbortController();
    billingApi.wallet(controller.signal).then(setBalance).catch(e=>{if(!controller.signal.aborted)setMessage(paymentError(e));});
    const pending=sessionStorage.getItem(storageKey);
    if(pending)billingApi.status(pending).then(saved=>{
      if(!controller.signal.aborted&&saved.pack_id===packId){setOrder(saved);setBalance(saved.wallet);
        if(saved.status==='created')setMessage('An earlier checkout is saved. Continue it or check its payment status.');}
    }).catch(()=>{/* A deleted, expired-session, or another-mode order never unlocks credits. */});
    return()=>controller.abort();
  },[user,storageKey,packId]);
  const accept=(saved:Purchase)=>{
    if(!active.current)return;
    setOrder(saved);setBalance(saved.wallet);
    if(saved.status==='paid')setMessage(`Payment verified. ${saved.credits} experiment credits have been added to your account.`);
    else if(saved.status.includes('refunded'))setMessage('This payment has a refund adjustment. Your balance has been updated.');
    else setMessage('Payment is not confirmed yet. Check status before trying another payment.');
  };
  const checkStatus=async()=>{
    if(!order||busy)return;setBusy(true);setMessage('Checking with Razorpay…');
    try{accept(await billingApi.reconcile(order.id));}catch(e){setMessage(paymentError(e));}finally{if(active.current)setBusy(false);}
  };
  const testPay=async()=>{
    if(!user){setLoginOpen(true);return;}
    if(!pack||busy)return;setBusy(true);setMessage('Processing simulated test payment…');confirming.current=false;
    try{
      if(!requestKey.current){requestKey.current=sessionStorage.getItem(requestStorageKey)||crypto.randomUUID();sessionStorage.setItem(requestStorageKey,requestKey.current);}
      const saved=order?.status==='created'?order:await billingApi.order(pack.id,requestKey.current);
      setOrder(saved);sessionStorage.setItem(storageKey,saved.id);
      if(saved.status==='paid'){accept(saved);setBusy(false);return;}
      const confirmed=await billingApi.testPay(saved.id);
      accept(confirmed);
    }catch(e){if(active.current)setMessage(paymentError(e));}
    finally{if(active.current)setBusy(false);}
  };
  const pay=async()=>{
    if(!user){setLoginOpen(true);return;}
    if(!pack||busy)return;setBusy(true);setMessage('Preparing secure checkout…');confirming.current=false;
    try{
      await loadRazorpay();
      if(!requestKey.current){requestKey.current=sessionStorage.getItem(requestStorageKey)||crypto.randomUUID();sessionStorage.setItem(requestStorageKey,requestKey.current);}
      const saved=order?.status==='created'?order:await billingApi.order(pack.id,requestKey.current);
      setOrder(saved);sessionStorage.setItem(storageKey,saved.id);
      if(saved.status==='paid'){accept(saved);setBusy(false);return;}
      if(!saved.gateway_order_id||!window.Razorpay)throw new Error('Checkout is not ready. Please retry.');
      const checkout=new window.Razorpay({key:saved.key_id, amount:saved.amount,currency:saved.currency,
        name:'LabMate',description:`${saved.pack_name} · ${saved.credits} experiment credits`,order_id:saved.gateway_order_id,
        prefill:{name:user.name,email:user.email},theme:{color:'#192526'},
        handler:async(response)=>{
          confirming.current=true;if(active.current)setMessage('Confirming your payment securely…');
          try{accept(await billingApi.verify(saved.id,response));}
          catch(e){if(active.current)setMessage(paymentError(e));}
          finally{if(active.current)setBusy(false);}
        },modal:{ondismiss:()=>{
          if(!confirming.current&&active.current){setBusy(false);setMessage('Checkout closed. No credits have been added. If you completed payment, check its status.');}
        }}});
      checkout.on('payment.failed',()=>{if(active.current)setMessage('Payment did not complete. You can retry inside Razorpay or close checkout. No credits have been added.');});
      checkout.open();setMessage('Complete payment in the Razorpay window.');
    }catch(e){if(active.current){setMessage(paymentError(e));setBusy(false);}}
  };
  const paid=order?.status==='paid';
  const refunded=order?.status.includes('refunded');
  const newPurchase=()=>{setOrder(null);setMessage('');requestKey.current='';sessionStorage.removeItem(storageKey);sessionStorage.removeItem(requestStorageKey);};
  return <main className={styles.checkout}>
    <header className={styles.checkoutNav}><Link href="/" aria-label="LabMate home"><LabMateLogo theme="dark" size="md"/></Link><Link href="/#pricing"><ArrowLeft size={16}/>All packs</Link></header>
    <div className={styles.checkoutGrid}>
      <section className={styles.checkoutCopy}>
        <h1>{paid?'Your next lab starts here.':'Your lab work, taken care of.'}</h1>
        <p>One pack for code, real execution screenshots, and your Word report. Keep the credits you do not use for another day.</p>
        <ol className={styles.steps}><li><span>01</span>Upload your PDF or Word manual</li><li><span>02</span>Execute & download your Word record</li></ol>
        <p className={styles.rule}>A credit is used only when an experiment completes. Failed and unfinished experiments return their reserved credits.</p>
      </section>
      <section className={styles.summary} aria-labelledby="order-heading">
        <div className={styles.summaryTop}><h2 id="order-heading">{paid?'Payment confirmed':'Your pack'}</h2>{catalogue?.mode==='test'&&<span className={styles.testBadge}>TEST MODE</span>}</div>
        {!catalogue&&<p role="status">Loading your pack…</p>}
        {catalogue&&!pack&&<p role="alert">This pack could not be found. <Link href="/#pricing">Choose a pack</Link>.</p>}
        {pack&&catalogue&&<><h3 className={styles.selectedPack}>{pack.name}</h3><p className={styles.selectedCredits}>{pack.credits} experiment credits</p>
          <div className={styles.total}><span>One-time total</span><strong>{rupees(pack.amount)}</strong></div>
          <p className={styles.totalNote}>The price shown is the total. No recurring charge.</p>
          {user&&<p className={styles.account}>Buying for <strong>{user.email}</strong>{balance&&<span>{balance.available} available · {balance.reserved} reserved{balance.mode==='test'?' · test credits':''}</span>}</p>}
          {catalogue.mode==='test'&&<div className={styles.checkoutTest}>
            <p>This is a simulated test payment. No real money will be charged.</p>
            <div style={{marginTop:'8px',fontSize:'11.5px',lineHeight:'1.6',background:'#e4eae1',padding:'10px',borderRadius:'6px',color:'#273c31',border:'1px solid #c9d5c5'}}>
              <strong>Test Mode Credentials (India):</strong><br/>
              • <strong>1-Click:</strong> Click <em>&ldquo;Complete test payment&rdquo;</em> below (instant, no card needed)<br/>
              • <strong>UPI ID:</strong> <code>success@razorpay</code><br/>
              • <strong>Domestic Card:</strong> <code>5123 4500 0000 0008</code> (Exp: 12/30, CVV: 123)
            </div>
          </div>}
          {message&&<p role="status" aria-live="polite" className={`${styles.message} ${paid?styles.success:''}`}>{paid&&<Check size={18}/>}<span>{message}</span></p>}
          {paid?<Link href="/code-execution" className={styles.payButton}>Start your lab<ArrowRight size={18}/></Link>:refunded?<button className={styles.payButton} onClick={newPurchase}>Start a new purchase<ArrowRight size={18}/></button>:catalogue.mode==='test'?<><button className={styles.payButton} onClick={testPay} disabled={loading||busy||!catalogue.checkout_available}>{busy?<><Loader2 size={18} className={styles.spinner}/>Please wait…</>:!user?'Sign in to continue':`Complete test payment (${rupees(pack.amount)})`}</button><button className={styles.statusButton} onClick={pay} disabled={busy||!catalogue.checkout_available}>Open Razorpay window</button></>:<button className={styles.payButton} onClick={pay} disabled={loading||busy||!catalogue.checkout_available}>{busy?<><Loader2 size={18} className={styles.spinner}/>Please wait…</>:!user?'Sign in to continue':`Pay ${rupees(pack.amount)}`}</button>}
          {paid&&<button className={styles.statusButton} onClick={newPurchase}>Buy another pack</button>}
          {order&&!paid&&<button className={styles.statusButton} onClick={checkStatus} disabled={busy}>Check payment status</button>}
          {!catalogue.checkout_available&&<p className={styles.rule}>Checkout is temporarily unavailable. Your existing reports are still accessible.</p>}
          <p className={styles.secure}><LockKeyhole size={14}/>Your payment details stay with Razorpay.</p></>}
        {!catalogue&&message&&<><p role="alert">{message}</p><button onClick={()=>setRetry(v=>v+1)}>Retry loading</button></>}
      </section>
    </div>
    {loginOpen&&<LoginModal isOpen onClose={()=>setLoginOpen(false)} redirectTo={`/checkout?pack=${packId}`}/>}
  </main>;
}
