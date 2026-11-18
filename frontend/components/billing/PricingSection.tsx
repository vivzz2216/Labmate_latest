'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Flame, FlaskConical, GraduationCap, Layers, LockKeyhole, Plus, RefreshCw, Zap, type LucideIcon } from 'lucide-react';
import { billingApi, Catalogue, Pack, rupees } from '@/lib/billing';
import styles from './PricingSection.module.css';

// Standard prices, shown only when the price API cannot be reached (for example while the backend restarts),
// so the section never shows an error box instead of prices. Keep in step with PACKS in
// backend/app/services/billing_service.py. Checkout stays disabled until the live catalogue loads.
const STANDARD_CATALOGUE: Catalogue = {
  packs: [
    { id: 'quick-lab', name: 'Quick Lab', amount: 2900, credits: 10, currency: 'INR', featured: false,
      description: 'For your next set of practicals.' },
    { id: 'lab-pack', name: 'Lab Pack', amount: 7900, credits: 35, currency: 'INR', featured: true,
      description: 'Room for a few lab manuals.' },
    { id: 'semester-pack', name: 'Semester Pack', amount: 14900, credits: 80, currency: 'INR', featured: false,
      description: 'Keep several subjects moving.' },
    { id: 'college-pack', name: 'College Pack', amount: 59900, credits: 300, currency: 'INR', featured: false,
      description: '300 credits for one student’s full term of practicals.' },
  ],
  trial_credits: 100,
  mode: 'live',
  checkout_available: false,
  billing_enabled: true,
};
const RETRY_DELAYS_MS = [1500, 4000];
const PACK_ICONS: Record<string, LucideIcon> = {
  'quick-lab': Zap,
  'lab-pack': FlaskConical,
  'semester-pack': Layers,
  'college-pack': GraduationCap,
};

const perExperiment = (pack: Pack) =>
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    setError(false);
    const attempt = (index: number) => {
      billingApi
        .catalogue(controller.signal)
        .then((data) => {
          if (!Array.isArray(data.packs)) throw new Error('Invalid pack catalogue');
          if (!controller.signal.aborted) setCatalogue(data);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          // Retry quietly first; a brief backend restart should not show visitors an error.
          if (index < RETRY_DELAYS_MS.length) timer = setTimeout(() => attempt(index + 1), RETRY_DELAYS_MS[index]);
          else setError(true);
        });
    };
    attempt(0);
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [retry]);

  const shown = catalogue ?? (error ? STANDARD_CATALOGUE : null);
  const packs =
    shown?.packs.filter(
      (pack) => !pack.admin_only && !['payment-check', 'owner-payment-check'].includes(pack.id)
    ) || [];
  const offer = packs.find((pack) => pack.offer_active);
  const experiments = /^[1-9]\d{0,3}$/.test(count) ? Number(count) : 0;
  const suggested = experiments
    ? [...packs].filter((pack) => pack.credits >= experiments).sort((a, b) => a.amount - b.amount)[0]
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
          A little spend.<span>A lot less busywork.</span>
        </h2>
        <div className={styles.intro}>
          <p>
            Try <strong>{shown?.trial_credits ?? 100} experiments free.</strong>
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
        <div className={styles.error} role="status">
          <p>Showing standard prices. Checkout opens once the latest prices load.</p>
          <button onClick={() => setRetry((value) => value + 1)}>
            <RefreshCw size={15} aria-hidden="true" />
            Refresh prices
          </button>
        </div>
      )}

      {shown && packs.length > 0 && (
        <div className={styles.comparison}>
          <div className={styles.plans}>
            {packs.map((pack) => (
              <article
                key={pack.id}
                className={`${styles.plan} ${pack.featured ? styles.featured : ''}`}
                aria-labelledby={`plan-${pack.id}`}
              >
                <div className={styles.planTop}>
                  <span className={styles.planIcon} aria-hidden="true">
                    {(() => { const Icon = PACK_ICONS[pack.id] || FlaskConical; return <Icon size={18} />; })()}
                  </span>
                  {pack.featured && <span className={styles.planMarker}>Most popular</span>}
                </div>
                <h3 id={`plan-${pack.id}`} className={styles.planName}>{pack.name}</h3>

                <div className={styles.amount}>
                  <strong>{rupees(pack.amount)}</strong>
                  <span>one-time</span>
                </div>
                <p className={styles.credits}>
                  <strong>{pack.credits}</strong> experiments <span>· {perExperiment(pack)} each</span>
                </p>

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
                    <span>Real code execution</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>Source &amp; output screenshots</span>
                  </li>
                  <li>
                    <Check size={15} aria-hidden="true" />
                    <span>Word (.docx) report</span>
                  </li>
                </ul>

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
      {shown && packs.length === 0 && !error && (
        <p className={styles.notice}>No student packs are available right now. Please check back soon.</p>
      )}

      {packs.length > 0 && (
        <div className={styles.creditGuide}>
          <div className={styles.creditCopy}>
            <h3>
              One credit.
              <br />
              One completed experiment.
            </h3>
            <p>
              A manual with 10 experiments uses 10 credits. Failed or unfinished experiments return
              their reserved credits. Downloading an existing report is free.
            </p>
          </div>
          <div className={styles.calculator}>
            <label htmlFor="pricing-experiments">How many experiments do you need?</label>
            <div className={styles.countRow}>
              <input
                id="pricing-experiments"
                type="number"
                min="1"
                max="9999"
                step="1"
                value={count}
                onChange={(event) => setCount(event.target.value)}
              />
              <span>experiments</span>
            </div>
            <div className={styles.suggestion} aria-live="polite" aria-atomic="true">
              {!experiments ? (
                <p>Enter a whole number from 1 to 9,999.</p>
              ) : suggested ? (
                <>
                  <p>
                    <strong>{suggested.name}</strong> covers {experiments}{' '}
                    {experiments === 1 ? 'experiment' : 'experiments'} for{' '}
                    <strong>{rupees(suggested.amount)}.</strong>
                  </p>
                  {checkoutLink(suggested, 'View this pack', styles.textAction)}
                </>
              ) : (
                <p>You’ll need more than one pack. Start with the College Pack and top up as needed.</p>
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
              What happens if an experiment fails?
              <Plus size={16} aria-hidden="true" />
            </summary>
            <p>
              A credit is used only when an experiment completes. Failed or unfinished experiments
              return their reserved credits.
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
