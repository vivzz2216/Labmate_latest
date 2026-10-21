'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/contexts/BasicAuthContext';
import {billingApi,Wallet} from '@/lib/billing';
import styles from './billing.module.css';

export default function CreditStatus({refreshKey}:{refreshKey?:string}) {
  const {user}=useAuth();const [balance,setBalance]=useState<Wallet|null>(null);
  useEffect(()=>{
    setBalance(null);if(!user?.id)return;
    const controller=new AbortController();
    billingApi.wallet(controller.signal).then(setBalance).catch(()=>{/* Execution API still enforces credits if balance cannot load. */});
    return()=>controller.abort();
  },[user?.id,refreshKey]);
  if(balance?.unlimited)return <p className={styles.creditStatus} aria-live="polite">Unlimited experiment credits</p>;
  if(!balance?.billing_enabled)return null;
  return <p className={styles.creditStatus} aria-live="polite"><span>{balance.available} credits available{balance.reserved?` · ${balance.reserved} reserved`:''}{balance.mode==='test'?' · test mode':''}</span><Link href="/#pricing">Top up credits</Link></p>;
}
