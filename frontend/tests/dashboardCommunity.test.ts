import test from "node:test";
import assert from "node:assert/strict";

test("Dashboard Community: anonymous review message protects student personal data", () => {
  function anonymousReviewMessage(message: string, name?: string | null): string {
    let text = message || "";
    if (name && name.trim().split(/\s+/).length > 1) {
      const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      text = text.replace(new RegExp("(?<!\\w)" + escaped + "(?!\\w)", "gi"), "[student]");
    }
    text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]");
    text = text.replace(/(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)/g, (match) => {
      const digitsOnly = match.replace(/\D/g, "");
      return digitsOnly.length >= 10 ? "[phone removed]" : match;
    });
    return text.slice(0, 1200);
  }

  function formatPublicName(name?: string | null): string {
    if (!name || !name.trim()) return "Student";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]}.`;
  }

  // Check name privacy formatting
  assert.equal(formatPublicName("Aarav Patel"), "Aarav P.");
  assert.equal(formatPublicName("Riya"), "Riya");
  assert.equal(formatPublicName(""), "Student");
  assert.equal(formatPublicName(null), "Student");

  // Check email and phone redaction in reviews
  const raw = "Hi I am Aarav Patel, my email is student@test.edu and phone is +91 98765 43210. Great lab app!";
  const cleaned = anonymousReviewMessage(raw, "Aarav Patel");
  assert.ok(!cleaned.includes("Aarav Patel"), "Should not contain full name");
  assert.ok(!cleaned.includes("student@test.edu"), "Should not contain email");
  assert.ok(!cleaned.includes("98765"), "Should not contain phone number");
  assert.ok(cleaned.includes("[student]"));
  assert.ok(cleaned.includes("[email removed]"));
  assert.ok(cleaned.includes("[phone removed]"));
});

test("Dashboard Community: validates lab request payload parameters", () => {
  function validateLabRequest(labName: string) {
    const trimmed = (labName || "").trim();
    if (!trimmed) {
      throw new Error("lab_name is required");
    }
    if (trimmed.length > 200) {
      throw new Error("lab_name exceeds 200 characters");
    }
    return { ok: true, lab_name: trimmed };
  }

  assert.throws(() => validateLabRequest(""), /lab_name is required/);
  assert.throws(() => validateLabRequest("   "), /lab_name is required/);
  assert.equal(validateLabRequest("  Android Studio Lab  ").lab_name, "Android Studio Lab");
});

test("Dashboard Community: validates star ratings are bounded between 1 and 5", () => {
  function validateRating(rating: number | null | undefined) {
    if (rating === null || rating === undefined) return null;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("Rating must be an integer between 1 and 5");
    }
    return rating;
  }

  assert.equal(validateRating(5), 5);
  assert.equal(validateRating(1), 1);
  assert.equal(validateRating(null), null);
  assert.throws(() => validateRating(0), /Rating must be an integer between 1 and 5/);
  assert.throws(() => validateRating(6), /Rating must be an integer between 1 and 5/);
  assert.throws(() => validateRating(3.5 as any), /Rating must be an integer between 1 and 5/);
});
