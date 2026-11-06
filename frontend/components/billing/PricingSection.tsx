'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowRight, Check, LockKeyhole} from 'lucide-react';
import {billingApi, Catalogue, rupees} from '@/lib/billing';
import FestiveOffer from './FestiveOffer';
import {useAuth} from '@/contexts/BasicAuthContext';
import styles from './billing.module.css';

export default function PricingSection() {
  const {user} = useAuth();
  const [catalogue, setCatalogue] = useState<Catalogue|null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    billingApi.catalogue(controller.signal)
      .then(data => {
        setCatalogue(data);
        if (user?.is_admin) {
          billingApi.ownerCheck(controller.signal).then(pack => {
            if (!controller.signal.aborted) setCatalogue(current => current
              ? {...current, packs: [...current.packs.filter(item => item.id !== pack.id), pack]}
              : current);
          }).catch(() => {});
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [retry, user?.is_admin]);

  const offer = catalogue?.packs.find(p => p.offer_active);

  return (
    <section id="pricing" className={styles.pricing} aria-labelledby="pricing-heading">
      <div className={styles.headingRow}>
        <div>
          <h2 id="pricing-heading">A little spend.<br />A lot less lab work.</h2>
        </div>
        <p className={styles.intro}>
          Try {catalogue?.trial_credits ?? 3} experiments free. Top up when you need more. No monthly bill, no auto-renewal.
        </p>
      </div>

      {catalogue && !catalogue.checkout_available && (
        <p className={styles.testNote}>Live payments are not configured yet. Existing reports remain available.</p>
      )}

      {offer && (
        <FestiveOffer
          packName={offer.name}
          credits={offer.credits}
          amount={offer.amount}
          regularAmount={offer.regular_amount ?? offer.amount}
          endsLabel={offer.offer_ends_label}
          href={`/checkout?pack=${offer.id}`}
        />
      )}

      {!catalogue && !error && (
        <p className={styles.loading} role="status">Loading student packs…</p>
      )}

      {error && (
        <div className={styles.loadError} role="alert">
          Packs could not load. <button onClick={() => setRetry(v => v + 1)}>Try again</button>
        </div>
      )}

      {catalogue && (
        <div className={styles.packGrid}>
          {catalogue.packs.filter(pack => !pack.admin_only || user?.is_admin).map(pack => (
            <article
              key={pack.id}
              className={`${styles.pack} ${pack.featured ? styles.featured : ''} ${pack.offer_active ? styles.collegePack : ''} ${pack.admin_only ? styles.ownerCheckPack : ''}`}
            >
              <div className={styles.packTop}>
                <h3>{pack.name}</h3>
                {pack.admin_only ? (
                  <span className={styles.ownerOnlyBadge}>OWNER ONLY</span>
                ) : pack.offer_active ? (
                  <span className={styles.diwaliBadge}>Diwali offer</span>
                ) : pack.featured ? (
                  <span className={styles.recommendation}>Recommended</span>
                ) : null}
              </div>

              <p className={styles.packDescription}>{pack.description}</p>

              <div className={styles.priceBlock}>
                <div className={styles.priceRow}>
                  <p className={styles.price}>
                    {rupees(pack.amount)}
                  </p>
                  <span className={styles.perOnce}>one-time</span>
                </div>
                {pack.offer_active && pack.regular_amount && pack.regular_amount > pack.amount && (
                  <p className={styles.wasPrice}>
                    Regular {rupees(pack.regular_amount)} · Save {rupees(pack.regular_amount - pack.amount)}
                  </p>
                )}
              </div>

              <div className={styles.metaRow}>
                <p className={styles.quantity}>{pack.credits} experiment credits</p>
                <p className={styles.unitPrice}>
                  {new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 2}).format(pack.amount / 100 / pack.credits)} per experiment
                </p>
              </div>

              {pack.admin_only && !catalogue.checkout_available ? (
                <span className={`${styles.buyButton} ${styles.disabledButton}`}>Configure live keys first</span>
              ) : (
                <Link className={styles.buyButton} href={`/checkout?pack=${pack.id}`}>
                  {pack.admin_only ? 'Run ₹1 live check' : `Choose ${pack.name}`} <ArrowRight size={16} aria-hidden="true" />
                </Link>
              )}
            </article>
          ))}
        </div>
      )}

      <div className={styles.guaranteeBar}>
        <div className={styles.guaranteeItem}>
          <Check size={18} aria-hidden="true" className={styles.checkIcon} />
          <span>Real Python, C/C++, Java &amp; Shell execution</span>
        </div>
        <div className={styles.guaranteeItem}>
          <Check size={18} aria-hidden="true" className={styles.checkIcon} />
          <span>High-resolution terminal screenshots</span>
        </div>
        <div className={styles.guaranteeItem}>
          <Check size={18} aria-hidden="true" className={styles.checkIcon} />
          <span>Complete formatted Word (.docx) record</span>
        </div>
        <div className={styles.guaranteeItem}>
          <Check size={18} aria-hidden="true" className={styles.checkIcon} />
          <span>Unused credits never expire</span>
        </div>
      </div>

      <div className={styles.pricingFoot}>
        <p>
          <strong>1 credit = 1 completed experiment.</strong> A 10-experiment manual uses 10 credits. Failed or unfinished experiments return their reserved credits. Downloading an existing report is free.
        </p>
        <span className={styles.razorpayBadge}>
          <LockKeyhole size={14} aria-hidden="true" /> Checkout by Razorpay
        </span>
      </div>

      <div className={styles.freeLinkWrap}>
        <Link href="/code-execution" className={styles.freeLink}>
          Start with the free experiments <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
