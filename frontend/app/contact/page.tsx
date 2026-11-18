import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { BUSINESS_NAME, SUPPORT_EMAIL } from "@/components/legal/LegalPage";
import ContactForm from "@/components/legal/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the LabMate team for support, payments and privacy requests.",
};

export default function ContactPage() {
  return (
    <LegalPage
      title="Contact us"
      intro={<p>Questions about your lab work, a payment, or your data? The {BUSINESS_NAME} team usually replies within 2 working days.</p>}
    >
      {SUPPORT_EMAIL && (
        <section>
          <h2>Email</h2>
          <p>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
          <p>For payment issues, include the payment reference (it starts with &quot;pay_&quot;).</p>
        </section>
      )}

      <section>
        <h2>{SUPPORT_EMAIL ? "Or send a message" : "Send us a message"}</h2>
        <ContactForm />
      </section>

      <section>
        <h2>Common requests</h2>
        <ul>
          <li>Refunds and failed payments: see the <Link href="/refund-policy">Refund Policy</Link>.</li>
          <li>Seeing or deleting your data: see the <Link href="/privacy">Privacy Policy</Link>, then contact us.</li>
          <li>Grievances about the service or your data can be sent the same way; we respond within 30 days.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
