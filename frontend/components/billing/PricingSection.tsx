'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowRight, Check, LockKeyhole} from 'lucide-react';
import {billingApi, Catalogue, rupees} from '@/lib/billing';
import styles from './billing.module.css';

export default function PricingSection() {
  const [catalogue,setCatalogue]=useState<Catalogue|null>(null);
  const [error,setError]=useState(false);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    const controller=new AbortController(); setError(false);
    billingApi.catalogue(controller.signal).then(setCatalogue).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[retry]);
  return <section id="pricing" className={styles.pricing} aria-labelledby="pricing-heading">
    <div className={styles.headingRow}>
      <div><h2 id="pricing-heading">A little spend.<br/><span>A lot less lab work.</span></h2></div>
      <p className={styles.intro}>Try {catalogue?.trial_credits ?? 2} lab manuals free. Buy a pack when you need more.<br/>One-time payment. No auto-renewal.</p>
    </div>
    {catalogue?.mode==='test' && <p className={styles.testNote}>Test checkout is active. Payments are simulated and no real money is charged.</p>}
    {!catalogue && !error && <p className={styles.loading} role="status">Loading student packs…</p>}
    {error && <div className={styles.loadError} role="alert">Packs could not load. <button onClick={()=>setRetry(v=>v+1)}>Try again</button></div>}
    {catalogue && <div className={styles.packGrid}>{catalogue.packs.map(pack=><article key={pack.id} className={`${styles.pack} ${pack.featured?styles.featured:''}`}>
      <div className={styles.packTop}><h3>{pack.name}</h3>{pack.featured&&<span className={styles.recommendation}>A good place to start</span>}</div>
      <p className={styles.packDescription}>{pack.description}</p>
      <p className={styles.price}>{rupees(pack.amount)}<span> / once</span></p>
      <p className={styles.quantity}>{pack.credits} manual {pack.credits === 1 ? 'credit' : 'credits'}</p>
      <p className={styles.unitPrice}>{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(pack.amount/100/pack.credits)} per manual</p>
      <Link className={styles.buyButton} href={`/checkout?pack=${pack.id}`}>Choose {pack.name}<ArrowRight size={17} aria-hidden="true"/></Link>
      <ul className={styles.features}>
        <li><Check size={16} aria-hidden="true"/>Code generated and executed</li>
        <li><Check size={16} aria-hidden="true"/>Source and output screenshots</li>
        <li><Check size={16} aria-hidden="true"/>Word report with your results</li>
        <li><Check size={16} aria-hidden="true"/>Unused credits do not expire</li>
      </ul>
    </article>)}</div>}
    <div className={styles.pricingFoot}><p><strong>1 credit = 1 completed manual.</strong> Each manual can contain up to 100 detected questions. Review them before processing. Failed or unfinished manuals return their reserved credit. Downloading an existing report is free; processing changed questions after completion requires another credit.</p>
      <span><LockKeyhole size={15} aria-hidden="true"/>Checkout by Razorpay</span></div>
    <Link href="/code-execution" className={styles.freeLink}>Start with two free manuals <ArrowRight size={16} aria-hidden="true"/></Link>
  </section>;
}
