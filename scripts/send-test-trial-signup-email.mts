// Sends a sample "new trial signup" email so you can preview it.
// Usage: npx tsx scripts/send-test-trial-signup-email.mts [recipient]
// Reads RESEND_API_KEY (and optional RESEND_FROM_EMAIL) from .env.local.
import { config } from "dotenv";
config({ path: ".env.local" });

const { sendTrialSignupNotification } = await import("../src/lib/trial-signup-notification");

const to = process.argv[2] || "ronpassaro@gmail.com";
const trialEnds = new Date();
trialEnds.setDate(trialEnds.getDate() + 14);

const result = await sendTrialSignupNotification(
  {
    first_name: "Test",
    last_name: "Teacher",
    email: "test.teacher@example.com",
    primary_discipline: "DANCE",
    california: true,
    district_name: "Sample Unified School District",
    trial_ends_at: trialEnds.toISOString(),
  },
  [to]
);
console.log(result);
process.exit(result.ok ? 0 : 1);
