'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, ArrowRight, Check, CheckCircle2, LockKeyhole, Loader2} from 'lucide-react';
import LoginModal from '@/components/auth/LoginModal';
import LabMateLogo from '@/components/brand/LabMateLogo';
import {useAuth} from '@/contexts/BasicAuthContext';
import {billingApi, Catalogue, loadRazorpay, Pack, Purchase, paymentError, rupees, Wallet} from '@/lib/billing';
import {checkoutFailure, checkoutMethods} from '@/lib/razorpay-checkout';
import FestiveOffer from './FestiveOffer';
import styles from './billing.module.css';

export default function CheckoutPanel({packId}: {packId: string}) {
  const {user, loading} = useAuth();
  const [catalogue, setCatalogue] = useState<Catalogue|null>(null);
  const [balance, setBalance] = useState<Wallet|null>(null);
  const [order, setOrder] = useState<Purchase|null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [packError, setPackError] = useState('');
  const ownerCheck = packId === 'owner-payment-check';
  const confirming = useRef(false);
  const lastFailure = useRef('');
  const active = useRef(true);
  const requestKey = useRef('');
  const storageKey = user ? `labmate_checkout_${user.id}` : '';
  const requestStorageKey = storageKey + '_' + packId + '_request';
  const pack: Pack|undefined = catalogue?.packs.find(p => p.id === packId);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogue(null);
    setPackError('');
    if (ownerCheck && loading) return () => controller.abort();
    billingApi.catalogue(controller.signal)
      .then(async data => {
        if (ownerCheck && user) {
          try {
            const ownerPack = await billingApi.ownerCheck(controller.signal);
            if (!controller.signal.aborted) setCatalogue({...data, packs: [...data.packs, ownerPack]});
            return;
          } catch (error: any) {
            if (controller.signal.aborted) return;
            if (error?.response?.status !== 404) setPackError(paymentError(error));
          }
        }
        if (!controller.signal.aborted) setCatalogue(data);
      })
      .catch(e => { if (!controller.signal.aborted) setMessage(paymentError(e)); });
    return () => controller.abort();
  }, [retry, packId, ownerCheck, user?.id, loading]);

  useEffect(() => {
    setOrder(null);
    setBalance(null);
    requestKey.current = '';
    if (!user) return;
    const controller = new AbortController();
    billingApi.wallet(controller.signal)
      .then(setBalance)
      .catch(e => { if (!controller.signal.aborted) setMessage(paymentError(e)); });

    const pending = sessionStorage.getItem(storageKey);
    if (pending) {
      billingApi.status(pending).then(saved => {
        if (!controller.signal.aborted && saved.pack_id === packId) {
          setOrder(saved);
          setBalance(saved.wallet);
          if (saved.status === 'created') {
            setMessage('An earlier checkout was saved. Continue below or check status.');
          }
        }
      }).catch(() => {
        /* expired or nonexistent */
      });
    }
    return () => controller.abort();
  }, [user, storageKey, packId]);

  const accept = (saved: Purchase) => {
    if (!active.current) return;
    setOrder(saved);
    setBalance(saved.wallet);
    if (saved.status === 'paid') {
      setMessage(`Payment verified. ${saved.credits} experiment credits added to your account.`);
    } else if (saved.status.includes('refunded')) {
      setMessage('This payment has a refund adjustment. Your balance has been updated.');
    } else {
      setMessage('Payment is not confirmed yet. Check status before trying another payment.');
    }
  };

  const checkStatus = async () => {
    if (!order || busy) return;
    setBusy(true);
    setMessage('Checking with Razorpay…');
    try {
      accept(await billingApi.reconcile(order.id));
    } catch (e) {
      setMessage(paymentError(e));
    } finally {
      if (active.current) setBusy(false);
    }
  };

  const pay = async () => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (!pack || busy) return;
    setBusy(true);
    setMessage('Preparing secure checkout…');
    confirming.current = false;
    lastFailure.current = '';

    try {
      await loadRazorpay();
      if (!requestKey.current) {
        requestKey.current = sessionStorage.getItem(requestStorageKey) || crypto.randomUUID();
        sessionStorage.setItem(requestStorageKey, requestKey.current);
      }
      const saved = order?.status === 'created' ? order : await billingApi.order(pack.id, requestKey.current);
      setOrder(saved);
      sessionStorage.setItem(storageKey, saved.id);

      if (saved.status === 'paid') {
        accept(saved);
        setBusy(false);
        return;
      }

      if (!saved.gateway_order_id || !window.Razorpay) {
        throw new Error('Checkout is not ready. Please retry.');
      }

      const checkout = new window.Razorpay({
        key: saved.key_id,
        amount: saved.amount,
        currency: saved.currency,
        name: 'LabMate',
        description: `${saved.pack_name} · ${saved.credits} experiment credits`,
        order_id: saved.gateway_order_id,
        prefill: {name: user.name, email: user.email},
        image: new URL('/images/labmate-logo-transparent.png', window.location.origin).toString(),
        theme: (pack.id === 'college-pack' || pack.offer_active) ? {color: '#d9a441', backdrop_color: '#1a1610'} : {color: '#13151b'},
        ...checkoutMethods(),
        handler: async (response) => {
          confirming.current = true;
          if (active.current) setMessage('Confirming your payment securely…');
          try {
            accept(await billingApi.verify(saved.id, response));
          } catch (e) {
            if (active.current) setMessage(paymentError(e));
          } finally {
            if (active.current) setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            if (!confirming.current && active.current) {
              setBusy(false);
              setMessage(lastFailure.current || 'Checkout closed. If you completed payment, check its status before paying again.');
            }
          }
        }
      });

      checkout.on('payment.failed', (response) => {
        lastFailure.current = checkoutFailure(response);
        if (active.current) setMessage(lastFailure.current);
      });

      checkout.open();
      setMessage('Complete payment in the Razorpay window.');
    } catch (e) {
      if (active.current) {
        setMessage(paymentError(e));
        setBusy(false);
      }
    }
  };

  const paid = order?.status === 'paid';
  const refunded = order?.status.includes('refunded');
  const isFestive = pack?.offer_active || packId === 'college-pack';
  const regularAmount = pack ? (pack.regular_amount ?? pack.amount) : 0;
  const savings = pack && regularAmount > pack.amount ? regularAmount - pack.amount : 0;

  const newPurchase = () => {
    setOrder(null);
    setMessage('');
    requestKey.current = '';
    sessionStorage.removeItem(storageKey);
    sessionStorage.removeItem(requestStorageKey);
  };

  return (
    <main className={styles.checkout}>
      <header className={styles.checkoutNav}>
        <Link href="/" aria-label="LabMate home">
          <LabMateLogo theme="dark" size="md" />
        </Link>
        <Link href="/#pricing" className={styles.backLink}>
          <ArrowLeft size={15} aria-hidden="true" /> All packs
        </Link>
      </header>

      <div className={styles.checkoutGrid}>
        <section className={styles.checkoutCopy}>
          <h1>{paid ? 'Payment confirmed' : `${pack?.name ?? 'Pack'} checkout`}</h1>
          <p className={styles.checkoutLead}>
            {paid
              ? `Your ${order?.credits ?? pack?.credits ?? 0} experiment credits are active. Upload your lab manual to generate code and Word reports.`
              : `Add ${pack?.credits ?? 'your'} experiment credits to your LabMate account. Credits activate after payment verification and never expire.`}
          </p>

          {isFestive && pack && !paid && (
            <FestiveOffer
              variant="card"
              packName={pack.name}
              credits={pack.credits}
              amount={pack.amount}
              regularAmount={regularAmount}
              endsLabel={pack.offer_ends_label}
            />
          )}

          <h2 className={styles.includedTitle}>What is included</h2>
          <ul className={styles.included}>
            <li><Check size={16} aria-hidden="true" />{pack?.credits ?? 'Experiment'} experiment credits</li>
            <li><Check size={16} aria-hidden="true" />Code generated and executed in sandbox</li>
            <li><Check size={16} aria-hidden="true" />Terminal execution output screenshots</li>
            <li><Check size={16} aria-hidden="true" />Formatted Word (.docx) lab record</li>
            <li><Check size={16} aria-hidden="true" />Unused credits never expire</li>
          </ul>
          <p className={styles.fine}>
            A credit is used only when an experiment completes. Failed and unfinished experiments return their reserved credits.
          </p>
        </section>

        <section className={styles.summary} aria-labelledby="order-heading">
          <div className={styles.summaryTop}>
            <h2 id="order-heading">
              {paid ? 'Payment confirmed' : 'Order summary'}
            </h2>
          </div>

          {!catalogue && !message && <p role="status" className={styles.loadingPack}>Loading your pack…</p>}
          {catalogue && !pack && ownerCheck && (
            <div className={styles.notFoundPack} role="alert">
              <p>{packError || (user
                ? 'The ₹1 live payment check is available only to the owner account. Sign in with your owner account to continue.'
                : 'Sign in with your owner account to access the ₹1 live payment check.')}</p>
              {packError ? (
                <button className={styles.statusButton} onClick={() => setRetry(v => v + 1)}>Retry loading</button>
              ) : (
                <button className={styles.payButton} onClick={() => setLoginOpen(true)}>Sign in as owner</button>
              )}
            </div>
          )}
          {catalogue && !pack && !ownerCheck && (
            <div className={styles.notFoundPack} role="alert">
              <p>This pack could not be found.</p>
              <Link href="/#pricing" className={styles.returnLink}>Choose a pack</Link>
            </div>
          )}

          {pack && catalogue && (
            <>
              <div className={styles.lineItem}>
                <div>
                  <p className={styles.lineName}>{pack.name}</p>
                  <p className={styles.lineSub}>{pack.credits} experiment credits</p>
                </div>
                <span className={styles.lineAmount}>{rupees(regularAmount)}</span>
              </div>

              {savings > 0 && (
                <div className={styles.lineItem}>
                  <p className={styles.lineSub}>Diwali offer discount</p>
                  <span className={`${styles.lineAmount} ${styles.lineDiscount}`}>−{rupees(savings)}</span>
                </div>
              )}

              <div className={styles.totalRow}>
                <span>Total due</span>
                <strong>{rupees(pack.amount)}</strong>
              </div>
              <p className={styles.totalNote}>One-time payment. No recurring charge.</p>

              <div className={styles.account}>
                {user ? (
                  <>
                    <span>Signed in as</span>
                    <strong>{user.email}</strong>
                    {balance && <em>{balance.unlimited ? 'Unlimited credits' : `${balance.available} credits available`}</em>}
                  </>
                ) : (
                  <>
                    <span>Account</span>
                    <strong>Sign in to pay</strong>
                  </>
                )}
              </div>

              {message && (
                <p role="status" aria-live="polite" className={`${styles.message} ${paid ? styles.success : ''}`}>
                  {paid && <CheckCircle2 size={17} aria-hidden="true" />}
                  <span>{message}</span>
                </p>
              )}

              {paid ? (
                <Link href="/code-execution" className={styles.payButton}>
                  Start your lab <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ) : refunded ? (
                <button className={styles.payButton} onClick={newPurchase}>
                  Start a new purchase <ArrowRight size={17} aria-hidden="true" />
                </button>
              ) : (
                <button
                  className={styles.payButton}
                  onClick={pay}
                  disabled={loading || busy || !catalogue.checkout_available}
                >
                  {busy ? (
                    <><Loader2 size={17} className={styles.spinner} aria-hidden="true" /> Please wait…</>
                  ) : !user ? (
                    'Sign in to continue'
                  ) : (
                    `Pay ${rupees(pack.amount)}`
                  )}
                </button>
              )}

              {paid && <button className={styles.statusButton} onClick={newPurchase}>Buy another pack</button>}
              {order && !paid && (
                <button className={styles.statusButton} onClick={checkStatus} disabled={busy}>
                  Check payment status
                </button>
              )}

              {!catalogue.checkout_available && (
                <p className={styles.fine}>{user?.is_admin
                  ? 'Live checkout is not enabled. Set RAZORPAY_MODE=live and matching rzp_live credentials on the backend service.'
                  : 'Live checkout is temporarily unavailable. Your existing reports are still accessible.'}</p>
              )}

              <p className={styles.secure}>
                <LockKeyhole size={13} aria-hidden="true" /> Payments are processed securely by Razorpay.
              </p>
            </>
          )}

          {!catalogue && message && (
            <div className={styles.errorBox} role="alert">
              <p>{message}</p>
              <button onClick={() => setRetry(v => v + 1)}>Retry loading</button>
            </div>
          )}
        </section>
      </div>

      {loginOpen && (
        <LoginModal isOpen onClose={() => setLoginOpen(false)} redirectTo={`/checkout?pack=${packId}`} />
      )}
    </main>
  );
}
