import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Thrive
        </button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: July 2, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground [&_h2]:text-foreground [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground">
          <p>
            These Terms of Service ("Terms") govern your use of Thrive, an AI-powered training platform for
            runners and coaches. By creating an account or using Thrive, you agree to these Terms.
          </p>

          <h2>Your Account</h2>
          <p>
            You must provide accurate information when creating an account. You're responsible for keeping
            your login credentials secure and for all activity that happens under your account.
          </p>

          <h2>Subscriptions &amp; Billing</h2>
          <ul>
            <li>Thrive offers a free trial period, after which continued access requires an active subscription.</li>
            <li>Subscriptions are billed through Stripe on a recurring basis until canceled.</li>
            <li>Coach subscriptions include a base number of athletes, with per-athlete pricing beyond that.</li>
            <li>You can cancel anytime; access continues until the end of your current billing period.</li>
          </ul>

          <h2>Not Medical Advice</h2>
          <p>
            Thrive's injury-risk scoring, training-load analysis, and AveraAI coaching guidance are provided
            for informational and training purposes only. They are <strong>not a substitute for professional
            medical advice, diagnosis, or treatment</strong>. Always consult a qualified healthcare provider
            about pain, injury, or any health concern before making decisions about your training.
          </p>

          <h2>Coach &amp; Team Relationships</h2>
          <p>
            If you join a team, your coach can view your training data, injury alerts, and assign or approve
            training plans on your behalf. If you're a coach, you're responsible for using your athletes'
            data appropriately and only within the platform's intended coaching purpose.
          </p>

          <h2>Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use Thrive for any unlawful purpose or to violate another person's rights.</li>
            <li>Attempt to access another user's account or data without authorization.</li>
            <li>Interfere with or disrupt the platform's infrastructure or security.</li>
            <li>Reverse-engineer, scrape, or misuse the AveraAI or injury-risk models.</li>
          </ul>

          <h2>Connected Services</h2>
          <p>
            Thrive integrates with third-party services (e.g. Strava, Stripe, Clerk) to provide activity sync,
            payments, and authentication. Your use of those services is also governed by their own terms.
          </p>

          <h2>Termination</h2>
          <p>
            You may delete your account at any time from your Profile page. We may suspend or terminate
            accounts that violate these Terms or misuse the platform.
          </p>

          <h2>Disclaimer &amp; Limitation of Liability</h2>
          <p>
            Thrive is provided "as is" without warranties of any kind. To the fullest extent permitted by law,
            Thrive is not liable for any injury, loss, or damage arising from your use of the platform,
            including reliance on training plans or injury-risk guidance.
          </p>

          <h2>Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use of Thrive after changes take effect
            constitutes acceptance of the updated Terms.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these Terms? Email us at{" "}
            <a href="mailto:thriveai78@gmail.com" className="text-primary hover:underline">thriveai78@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
