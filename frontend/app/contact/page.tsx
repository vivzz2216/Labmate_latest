import type { Metadata } from "next";
import ContactExperience from "@/components/legal/ContactExperience";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get help with LabMate experiments, reports, payments and your account.",
};

export default function ContactPage() {
  return <ContactExperience />;
}
