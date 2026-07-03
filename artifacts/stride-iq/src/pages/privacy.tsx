import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  const [, navigate] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

        <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: July 2, 2026</p>

        <div className="prose prose-sm max-w-none text-foreground [&_h2]:text-foreground [&_h2]:font-semibold [&_h2]:text-lg [&_h2]:mt-8 [&_h2]:mb-3 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground">
          <p>
            Thrive ("we," "our," "us") provides an AI-powered training platform for runners and coaches.
            This policy explains what information we collect, how we use it, and the choices you have.
          </p>

          <h2>Information We Collect</h2>
          <ul>
            <li><strong>Account information:</strong> name, email address, and profile photo, provided through our authentication provider (Clerk) when you sign up.</li>
            <li><strong>Training data:</strong> activities you log manually, or sync automatically if you connect a Strava account — including distance, pace, heart rate, elevation, and route data.</li>
            <li><strong>Health &amp; injury data:</strong> self-reported soreness, injury alerts, and recovery metrics (HRV, resting heart rate) you choose to provide, used to power injury-risk features.</li>
            <li><strong>Coach/team data:</strong> if you join a team, your coach can see your training data, injury risk, and training plans. If you're a coach, your athletes' data described above is visible to you.</li>
            <li><strong>Payment information:</strong> subscription and billing details are processed by Stripe. We do not store your full card number on our servers.</li>
            <li><strong>Usage data:</strong> basic technical information (device, browser, IP address) collected automatically for security and reliability.</li>
          </ul>

          <h2>How We Use Your Information</h2>
          <ul>
            <li>To provide the core product: dashboards, training plans, injury risk scoring, and the AveraAI coaching assistant.</li>
            <li>To process payments and manage your subscription.</li>
            <li>To send you account-related notifications (e.g. plan suggestions, injury alerts, coach approvals).</li>
            <li>To maintain and improve the reliability and security of the platform.</li>
          </ul>

          <h2>AI Features</h2>
          <p>
            AveraAI and our automated training-plan and injury-risk features use a third-party AI provider to
            analyze your training data and generate coaching guidance. Messages you send to AveraAI and the
            training context used to generate responses may be processed by that provider. AveraAI's guidance
            is for informational purposes only and is <strong>not medical advice</strong> — always consult a
            healthcare professional about injuries or health concerns.
          </p>

          <h2>Sharing Your Information</h2>
          <p>
            We do not sell your personal data. We share information only: with your coach or team (if you join
            one), with service providers who help us operate the platform (e.g. Stripe for payments, Strava for
            activity sync, our AI provider), or when required by law.
          </p>

          <h2>Data Retention &amp; Deletion</h2>
          <p>
            You can delete your account at any time from your Profile page. Deleting your account permanently
            removes your training data, injury records, conversations, and billing association from our systems.
          </p>

          <h2>Your Choices</h2>
          <ul>
            <li>Disconnect Strava at any time from your Profile without deleting your account.</li>
            <li>Leave a team to stop sharing your data with a coach.</li>
            <li>Request a copy of your data or ask questions by contacting us below.</li>
          </ul>

          <h2>Contact</h2>
          <p>
            Questions about this policy or your data? Email us at{" "}
            <a href="mailto:thriveai78@gmail.com" className="text-primary hover:underline">thriveai78@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
