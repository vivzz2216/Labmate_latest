import Link from 'next/link';
import {ArrowRight} from 'lucide-react';
import {rupees} from '@/lib/billing';
import styles from './billing.module.css';

interface Props {
  packName: string;
  credits: number;
  amount: number;
  regularAmount: number;
  endsLabel?: string | null;
  variant?: 'strip' | 'card';
  href?: string;
}

export default function FestiveOffer({packName, credits, amount, regularAmount, endsLabel, variant = 'strip', href}: Props) {
  const saving = Math.max(regularAmount - amount, 0);
  return (
    <aside className={`${styles.offer} ${variant === 'card' ? styles.offerCard : styles.offerStrip}`} aria-label="Diwali offer">
      <div className={styles.offerBody}>
        <p className={styles.offerTitle}>{saving > 0 ? `Diwali Offer · Save ${rupees(saving)} on ${packName}` : packName}</p>
        <p className={styles.offerMeta}>
          {rupees(amount)}{saving > 0 && <> <s>{rupees(regularAmount)}</s></>} for {credits} experiment credits{endsLabel ? ` · Ends ${endsLabel}` : ''}
        </p>
        <p className={styles.offerNote}>
          Full-term practical coverage at {new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 2}).format(amount / 100 / credits)} per experiment.
        </p>
        {href && (
          <Link href={href} className={styles.offerLink}>
            Get the {packName} <ArrowRight size={15} aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className={styles.offerArt} aria-hidden="true">
        <img
          src="/images/diwali/diwali_scene.webp"
          alt=""
          className={styles.offerSceneImg}
          width={897}
          height={940}
        />
      </div>
    </aside>
  );
}
