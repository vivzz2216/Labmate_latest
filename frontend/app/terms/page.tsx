import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { BUSINESS_NAME, SupportContact } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for using LabMate, buying experiment credits, and acceptable use.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={
        <p>
          These terms apply when you use {BUSINESS_NAME}. By creating an account or using the service you agree to them. If
          you do not agree, please do not use LabMate.
        </p>
      }
    >
      <section>
        <h2>1. The service</h2>
        <p>
          LabMate reads lab manuals you upload, generates and runs code for the experiments, captures the output, and builds a
          report you can download. Results are produced by automated tools, including AI models, and can contain mistakes.
          <strong> You are responsible for checking your work</strong> before you submit or rely on it.
        </p>
      </section>

      <section>
        <h2>2. Academic integrity</h2>
        <p>
          LabMate is a tool to help you run, check and document lab work. You are responsible for following your college&apos;s
          rules on the use of software and AI tools, and for understanding the work you submit.
        </p>
      </section>

      <section>
        <h2>3. Your account</h2>
        <ul>
          <li>Give accurate details and keep your password private. You are responsible for activity on your account.</li>
          <li>One account per person. Accounts are not to be shared or resold.</li>
          <li>If you are under 18, you need the consent of a parent or guardian to use LabMate.</li>
        </ul>
      </section>

      <section>
        <h2>4. Credits and payments</h2>
        <ul>
          <li>New accounts receive free experiment credits. Paid packs add more credits.</li>
          <li>One credit is used for each experiment that completes. Failed or unfinished experiments return their reserved credits.</li>
          <li>Packs are one-time payments with no subscription or auto-renewal. Prices are in Indian Rupees and include any applicable taxes unless stated otherwise.</li>
          <li>Payments are processed by Razorpay. Refunds are covered by our <Link href="/refund-policy">Refund Policy</Link>.</li>
          <li>Credits have no cash value and cannot be transferred.</li>
        </ul>
      </section>

      <section>
        <h2>5. Acceptable use</h2>
        <p>Do not use LabMate to:</p>
        <ul>
          <li>upload content you do not have the right to use, or anything illegal or harmful;</li>
          <li>run malicious code, attack, overload or try to break out of the sandboxes, or probe other users&apos; data;</li>
          <li>get around credit limits, rate limits or payment checks;</li>
          <li>copy, resell or automate access to the service without our written permission.</li>
        </ul>
        <p>We may suspend accounts that break these rules.</p>
      </section>

      <section>
        <h2>6. Your content</h2>
        <p>
          You keep ownership of the manuals and files you upload and of the reports generated for you. You give us permission
          to process them only to provide the service to you, as described in our <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </section>

      <section>
        <h2>7. Availability and changes</h2>
        <p>
          We work to keep LabMate available but do not guarantee uninterrupted service. We may change or discontinue features.
          If we change these terms, we will post the new version here and update the date above.
        </p>
      </section>

      <section>
        <h2>8. Liability</h2>
        <p>
          LabMate is provided &quot;as is&quot;. To the extent the law allows, we are not liable for indirect losses, such as
          lost marks or grades, and our total liability for any claim is limited to the amount you paid us in the 3 months before
          the claim.
        </p>
      </section>

      <section>
        <h2>9. Governing law and contact</h2>
        <p>
          These terms are governed by the laws of India. Questions or complaints: <SupportContact />.
        </p>
      </section>
    </LegalPage>
  );
}
