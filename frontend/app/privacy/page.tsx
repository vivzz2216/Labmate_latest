import type { Metadata } from "next";
import LegalPage, { BUSINESS_NAME, SupportContact } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What LabMate collects, why, who it is shared with, and how to access or delete your data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={
        <p>
          This policy explains what {BUSINESS_NAME} collects when you use the website and service, why we collect it, who it
          is shared with, and the choices you have. We collect only what we need to run your lab work and your account.
        </p>
      }
    >
      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> your name and email address. Your password is stored only as a one-way hash; we cannot read it.</li>
          <li><strong>Profile details you choose to add:</strong> such as age, course, institution, city and a short bio.</li>
          <li><strong>Your lab files:</strong> the manuals you upload (PDF or Word), any datasets or capture files you add, and what LabMate produces for you: code, program output, screenshots and reports.</li>
          <li><strong>Payments:</strong> the pack you bought, the amount and the payment reference. Card, UPI and bank details are entered on Razorpay&apos;s checkout and are never stored by us.</li>
          <li><strong>Technical data:</strong> IP address, browser type, and request logs, used for security, rate limiting and fixing errors.</li>
          <li><strong>Feedback:</strong> ratings and messages you send us.</li>
        </ul>
        <p>Your browser stores sign-in tokens locally so you stay signed in. We do not use advertising or cross-site tracking cookies.</p>
      </section>

      <section>
        <h2>2. How we use it</h2>
        <ul>
          <li>To read your manual, generate and run code, capture output, and build your report.</li>
          <li>To run your account, keep it secure, and prevent abuse.</li>
          <li>To process payments and keep your experiment credits accurate.</li>
          <li>To answer support requests and improve LabMate.</li>
        </ul>
        <p>We do not sell your personal data.</p>
      </section>

      <section>
        <h2>3. Who we share it with</h2>
        <p>We share data only with service providers that help us run LabMate, and only what they need:</p>
        <ul>
          <li><strong>AI model providers</strong> (such as Google Gemini, Groq and OpenAI): the text of your lab questions and related code are sent to generate and check programs. We do not send your password or payment details.</li>
          <li><strong>Hosting and storage</strong> (Railway and S3-compatible cloud storage): to run the service and keep your files.</li>
          <li><strong>Razorpay:</strong> to process payments.</li>
          <li><strong>Authorities:</strong> when the law requires it.</li>
        </ul>
        <p>These providers may process data outside India. We choose providers that protect data with industry-standard security.</p>
      </section>

      <section>
        <h2>4. How long we keep it</h2>
        <p>
          We keep your account data and lab files while your account is active, so you can download your reports again.
          When you ask us to delete your account, we delete your account, files and reports, except records we must keep by
          law (such as payment records for tax purposes).
        </p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>
          You can ask to see, correct, or delete your personal data, or withdraw consent, by contacting us at <SupportContact />.
          We will respond within 30 days. If you are unhappy with our response, you may complain to the Data Protection Board
          of India.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          Passwords are hashed, connections use HTTPS, code runs in isolated sandboxes, and each student can open only their
          own files. No system is perfectly secure; if we learn of a breach that affects you, we will tell you.
        </p>
      </section>

      <section>
        <h2>7. Children</h2>
        <p>
          LabMate is meant for college students. If you are under 18, use LabMate only with the consent of a parent or guardian.
        </p>
      </section>

      <section>
        <h2>8. Changes and contact</h2>
        <p>
          We will post any changes on this page and update the date above. For privacy questions or grievances, contact us at <SupportContact />.
        </p>
      </section>
    </LegalPage>
  );
}
