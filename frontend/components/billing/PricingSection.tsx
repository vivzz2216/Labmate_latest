'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Flame, LockKeyhole, Plus, RefreshCw } from 'lucide-react';
import { billingApi, Catalogue, Pack, rupees } from '@/lib/billing';
import styles from './PricingSection.module.css';

const perManual = (pack: Pack) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(pack.amount / 100 / pack.credits);

export default function PricingSection() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [count, setCount] = useState('10');

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    billingApi
      .catalogue(controller.signal)
      .then((data) => {
        if (!Array.isArray(data.packs)) throw new Error('Invalid pack catalogue');
        if (!controller.signal.aborted) setCatalogue(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [retry]);

  const packs =
    catalogue?.packs.filter(
      (pack) => !pack.admin_only && !['payment-check', 'owner-payment-check'].includes(pack.id)
    ) || [];
  const offer = packs.find((pack) => pack.offer_active);
  const manuals = /^[1-9]\d{0,3}$/.test(count) ? Number(count) : 0;
  const suggested = manuals
    ? [...packs].filter((pack) => pack.credits >= manuals).sort((a, b) => a.amount - b.amount)[0]
    : undefined;
  const available = Boolean(catalogue?.checkout_available);

  const checkoutLink = (pack: Pack, label: string, className: string) =>
    available ? (
      <Link href={`/checkout?pack=${pack.id}`} className={className}>
        {label}
        <ArrowRight size={15} aria-hidden="true" />
      </Link>
    ) : (
      <button className={className} disabled>
        Checkout unavailable
      </button>
    );

  return (
    <section id="pricing" className={styles.pricing} aria-labelledby="pricing-heading">
      <div className={styles.header}>
        <h2 id="pricing-heading">
          A little spend.<span>A lot less lab work.</span>
        </h2>
        <div className={styles.intro}>
          <p>
            Try <strong>{catalogue?.trial_credits ?? 100} manuals free.</strong>
            <br />
            Pick a pack when you need more.
          </p>
          <span>One-time payments. No auto-renewal.</span>
          <Link href="/code-execution">
            Start free <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {catalogue && !available && (
        <p className={styles.notice} role="status">
          Live checkout is temporarily unavailable. Your existing reports are still accessible.
        </p>
      )}
      {offer && (
        <div className={styles.offer}>
          <p>
            <Flame size={17} aria-hidden="true" />
            <strong>Diwali offer</strong>
            <span>
              Save {rupees((offer.regular_amount ?? offer.amount) - offer.amount)} on {offer.name}.
            </span>
          </p>
          {offer.offer_ends_label && <span className={styles.offerDate}>Through {offer.offer_ends_label}</span>}
        </div>
      )}

      {!catalogue && !error && (
        <div className={styles.loading} role="status">
          Loading student packs…
        </div>
      )}
      {error && (
        <div className={styles.error} role="alert">
          <p>We couldn’t load the latest prices.</p>
          <button onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw size={15} aria-hidden="true" />
            Try again
          </button>
        </div>
      )}

      {catalogue && packs.length > 0 && (
        <div className={styles.comparison}>
          <div className={styles.plans}>
            {packs.map((pack) => (
              <article
                key={pack.id}
                className={`${styles.plan} ${pack.featured ? styles.featured : ''}`}
                aria-labelledby={`plan-${pack.id}`}
              >
                <div className={styles.planTop}>
                  <h3 id={`plan-${pack.id}`}>{pack.name}</h3>
                  {pack.featured && <span className={styles.planMarker}>Popular</span>}
                </div>

                <div className={styles.amount}>
                  <strong>{rupees(pack.amount)}</strong>
                  <span>one-time</span>
                </div>

                <p className={styles.description}>{pack.description}</p>

                <div className={styles.discount}>
                  {pack.offer_active && pack.regular_amount && pack.regular_amount > pack.amount ? (
                    <>
                      <s>{rupees(pack.regular_amount)}</s>
                      <span>You save {rupees(pack.regular_amount - pack.amount)}</span>
                    </>
                  ) : (
                    <span>No recurring charge</span>
                  )}
                </div>

                <ul className={styles.featureList}>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>{pack.credits} {pack.credits === 1 ? 'manual credit' : 'manual credits'}</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>Up to 15 questions per manual</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>Word (.docx) report</span>
                  </li>
                </ul>

                <p className={styles.unitPrice}>{perManual(pack)} per manual</p>
                {checkoutLink(pack, `Choose ${pack.name}`, styles.choose)}
              </article>
            ))}
          </div>

          <div className={styles.included}>
            <span>Every pack includes</span>
            <ul>
              <li>
                <Check size={15} aria-hidden="true" />
                Source &amp; output screenshots
              </li>
              <li>
                <Check size={15} aria-hidden="true" />
                Word (.docx) report
              </li>
              <li>
                <Check size={15} aria-hidden="true" />
                Credits that never expire
              </li>
            </ul>
          </div>
        </div>
      )}
      {catalogue && packs.length === 0 && !error && (
        <p className={styles.notice}>No student packs are available right now. Please check back soon.</p>
      )}

      {packs.length > 0 && (
        <div className={styles.creditGuide}>
          <div className={styles.creditCopy}>
            <h3>
              One credit.
              <br />
              One completed manual.
            </h3>
            <p>
              One credit covers one manual with up to {catalogue?.max_questions_per_manual ?? 15} questions or exercises.
              Larger manuals must be split before uploading. Failed or unfinished manuals return
              their reserved credit. Retrying the same completed manual and downloading its report are free.
            </p>
          </div>
          <div className={styles.calculator}>
            <label htmlFor="pricing-manuals">How many manuals do you need?</label>
            <div className={styles.countRow}>
              <input
                id="pricing-manuals"
                type="number"
                min="1"
                max="9999"
                step="1"
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
              <span>manuals</span>
            </div>
            <div className={styles.suggestion} aria-live="polite" aria-atomic="true">
              {!manuals ? (
                <p>Enter a whole number from 1 to 9,999.</p>
              ) : suggested ? (
                <>
                  <p>
                    <strong>{suggested.name}</strong> covers {manuals}{' '}
                    {manuals === 1 ? 'manual' : 'manuals'} for{' '}
                    <strong>{rupees(suggested.amount)}.</strong>
                  </p>
                  {checkoutLink(suggested, 'View this pack', styles.textAction)}
                </>
              ) : (
                <p>You’ll need more than one pack. Start with the Semester Pack and top up as needed.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles.bottom}>
        <div className={styles.questions}>
          <details>
            <summary>
              Do I need a subscription?
              <Plus size={16} aria-hidden="true" />
            </summary>
            <p>
              No. Buy credits once and use them when you need them. There is no monthly bill or
              auto-renewal.
            </p>
          </details>
          <details>
            <summary>
              What happens if a manual fails?
              <Plus size={16} aria-hidden="true" />
            </summary>
            <p>
              A credit is used only when the entire manual completes successfully. Failed or unfinished manuals
              return their reserved credit.
            </p>
          </details>
        </div>
        <p className={styles.secure}>
          <LockKeyhole size={15} aria-hidden="true" />
          <span>
            Secure checkout
            <br />
            <strong>Powered by Razorpay</strong>
          </span>
        </p>
      </div>
    </section>
  );
}
