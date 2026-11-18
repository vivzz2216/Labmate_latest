import type { Metadata } from "next";
import LegalPage, { SupportContact } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy",
  description: "How credits, failed experiments, cancellations and refunds work for LabMate packs.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund and Cancellation Policy"
      intro={
        <p>
          LabMate packs are one-time purchases of experiment credits. There is no subscription, so there is nothing to cancel
          and nothing is charged again.
        </p>
      }
    >
      <section>
        <h2>1. Failed experiments</h2>
        <p>
          A credit is used only when an experiment completes. If an experiment fails or does not finish, its reserved credit is
          returned to your account automatically. You do not need to ask for this.
        </p>
      </section>

      <section>
        <h2>2. Unused packs</h2>
        <p>
          If you have not used any credits from a pack, you can ask for a full refund within 7 days of purchase. Credits you have
          already used are not refundable.
        </p>
      </section>

      <section>
        <h2>3. Payment problems</h2>
        <ul>
          <li>If you were charged but the credits did not reach your account, contact us with your payment reference. We will add the credits or refund the payment.</li>
          <li>If you were charged twice for the same order, we refund the duplicate payment.</li>
        </ul>
      </section>

      <section>
        <h2>4. How refunds are paid</h2>
        <p>
          Approved refunds go back to the original payment method through Razorpay. They are started within 5 working days of
          approval; your bank may take a further 5 to 7 working days to show the amount. The credits from a refunded pack are
          removed from your account.
        </p>
      </section>

      <section>
        <h2>5. Delivery</h2>
        <p>
          LabMate is a digital service. Credits are added to your account as soon as the payment is confirmed; nothing is
          shipped.
        </p>
      </section>

      <section>
        <h2>6. How to ask</h2>
        <p>
          Contact us at <SupportContact /> with the email address of your account and the payment reference (it starts with
          &quot;pay_&quot;).
        </p>
      </section>
    </LegalPage>
  );
}
