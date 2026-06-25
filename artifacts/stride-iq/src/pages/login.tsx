import { useLocation } from "wouter";
import { Brain, ShieldCheck, LineChart, Activity, Bot } from "lucide-react";

const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const STATS = [
  { value: "Track",   label: "Every session",      color: "text-primary",      bg: "bg-primary/10 border-primary/25" },
  { value: "Monitor", label: "Injury risk",         color: "text-red-300",      bg: "bg-red-500/10 border-red-500/25" },
  { value: "Connect", label: "Athletes & coaches",  color: "text-[#F2D2CF]",    bg: "bg-[#F2D2CF]/10 border-[#F2D2CF]/25" },
];

const FEATURES = [
  { icon: <Brain className="w-5 h-5 text-[#F2D2CF]" />,    iconBg: "bg-[#F2D2CF]/15 border-[#F2D2CF]/20", title: "AveraAI Coach",      desc: "Ask anything — pace strategy, recovery, race prep. Your AI coach answers in seconds." },
  { icon: <ShieldCheck className="w-5 h-5 text-red-400" />, iconBg: "bg-red-500/15 border-red-500/20",      title: "Injury Risk Alerts", desc: "Thrive flags dangerous mileage spikes, low HRV, and early overtraining before it becomes an injury." },
  { icon: <Activity className="w-5 h-5 text-orange-400" />, iconBg: "bg-orange-500/15 border-orange-500/20", title: "Strava Auto-Sync",   desc: "Connect Strava once and every run appears in Thrive automatically — zero manual imports." },
  { icon: <LineChart className="w-5 h-5 text-primary" />,   iconBg: "bg-primary/15 border-primary/20",      title: "Training Plans",     desc: "Personalised plans built around your goal, fitness level, and schedule — updated as you progress." },
];

const TESTIMONIALS = [
  { quote: "I can't believe this app does not exist already! It's such a brilliant idea.", author: "Teen athlete" },
  { quote: "This will be so helpful to me for monitoring all of my team members. Thank you for creating this app!", author: "Coach" },
  { quote: "Wow, amazing! I am going to share this with all of the track athletes in my team.", author: "Track athlete" },
];

const FAQ = [
  { question: "How does the coach pricing work?", answer: "Coaches pay a base subscription for 25 athletes, then $4 per athlete above 25 through Stripe's monthly billing." },
  { question: "What exactly does Thrive track?", answer: "Mileage, pace, and injury risk — all in one place." },
  { question: "How do I connect my data?", answer: "Connect directly using Strava API, and if you don't have Strava, you can also choose to log data yourself." },
  { question: "I am just a high school track runner, is this for me?", answer: "Yes of course! It's built for high school athletes, beginners, and casual runners who want to train smarter." },
  { question: "What does it cost for athletes?", answer: "It's $10/month for athletes." },
];

function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(42,80,76,0.20)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_35%_at_90%_70%,rgba(242,210,207,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between mb-12">
        <div className="flex-1 lg:max-w-xl">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#A2AE98] bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full mb-6">
            AI-driven training for runners and coaches
          </div>
          <img
            src="/thrive-logo-white.svg"
            alt="Thrive"
            className="h-24 sm:h-32 w-auto mb-5"
          />
          <h1 className="sr-only">Thrive — AI training for runners and coaches</h1>
          <p className="text-slate-400 text-lg leading-8 max-w-xl mb-8">
            Know your risks, track your progress, and stay injury-free.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-8">
            <button
              type="button"
              onClick={() => navigate("/sign-up")}
              className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition"
            >
              Get started
            </button>
            <button
              type="button"
              onClick={() => navigate("/sign-in")}
              className="rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white/90 hover:border-white/50 transition"
            >
              Log in
            </button>
          </div>

          <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4 max-w-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Validated by</p>
            <p className="text-2xl font-semibold text-white">70+ users before launch</p>
          </div>
        </div>

        <div className="relative flex-1 w-full">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-3 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
            <img
              src="/homepage-screen.png"
              alt="Thrive product screenshot showing the dashboard with weekly distance, runs, training load, and recent activity"
              className="w-full h-auto rounded-[1.5rem] border border-white/10"
              loading="eager"
            />
          </div>
          <div className="absolute -top-6 -left-4 hidden sm:block w-24 h-24 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-6 -right-4 hidden sm:block w-32 h-32 rounded-full bg-[#F2D2CF]/15 blur-3xl" />
        </div>
      </div>

      <div className="py-8">
        <div className="mx-auto h-px w-48 bg-gradient-to-r from-transparent via-slate-600 to-transparent opacity-50" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-10">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="rounded-3xl border border-slate-700/50 bg-slate-950/70 p-6 shadow-sm shadow-slate-950/10">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${feature.iconBg}`}>{feature.icon}</div>
            <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-sm text-slate-400 leading-6">{feature.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-10">
        <div className="rounded-3xl border border-slate-700/50 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">Objectives</p>
          <ul className="space-y-3">
            <li className="text-sm text-slate-200"><span className="font-semibold text-white">Optimize training</span> with evidence-based plans that adapt to your progress.</li>
            <li className="text-sm text-slate-200"><span className="font-semibold text-white">Prevent injury</span> with early warning alerts and recovery recommendations.</li>
            <li className="text-sm text-slate-200"><span className="font-semibold text-white">Scale coaching</span> using team management and pay-per-athlete billing.</li>
          </ul>
        </div>
        <div className="rounded-3xl border border-slate-700/50 bg-slate-950/70 p-6">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">What our users say about Thrive</p>
          {TESTIMONIALS.map((testimonial) => (
            <div key={testimonial.author} className="rounded-3xl border border-slate-800/70 bg-slate-900/80 p-5 mb-4 last:mb-0">
              <p className="text-sm text-slate-200 leading-7">“{testimonial.quote}”</p>
              <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">{testimonial.author}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-700/50 bg-slate-950/70 p-8 mb-10">
        <h2 className="text-2xl font-semibold text-white mb-6">Frequently asked questions</h2>
        <div className="grid gap-4">
          {FAQ.map((item) => (
            <div key={item.question} className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-5">
              <p className="text-sm font-semibold text-white mb-2">{item.question}</p>
              <p className="text-sm text-slate-400 leading-6">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm text-slate-400 max-w-2xl">Ready to see how Thrive helps you train with fewer injuries, smarter plans, and better coach collaboration?</p>
        <button
          type="button"
          onClick={() => navigate("/sign-up")}
          className="rounded-full bg-primary px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

export default function Login() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#06070E] flex items-center justify-center px-4 py-12">
      <div className="fixed top-4 right-5 z-50 flex items-center gap-2">
        <button onClick={() => navigate("/sign-up")}
          className="text-xs font-semibold text-muted-foreground hover:text-white px-3 py-1.5 rounded-lg border border-border hover:border-primary/50 bg-[#06070E]/70 backdrop-blur-sm transition-all">
          Sign up
        </button>
        <button onClick={() => navigate("/sign-in")}
          className="text-xs font-semibold text-white px-3 py-1.5 rounded-lg bg-primary/20 border border-primary/40 hover:bg-primary/30 hover:border-primary/60 backdrop-blur-sm transition-all">
          Log in
        </button>
      </div>
      <Landing />
    </div>
  );
}
