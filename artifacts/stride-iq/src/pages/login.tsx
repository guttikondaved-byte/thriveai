import { useLocation } from "wouter";
import { Brain, ShieldCheck, LineChart, Activity, Bot } from "lucide-react";

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
  { quote: "Thrive turned our club into a data-driven coaching machine.", author: "Mia, Head Coach" },
  { quote: "My injury alerts saved me from a stress fracture before it started.", author: "Aaron, marathoner" },
];

const FAQ = [
  { question: "Is Thrive for runners and coaches?", answer: "Yes — runners get personalized plans and recovery insights, while coaches manage teams, athletes, and pricing in one place." },
  { question: "Do I need Strava to use Thrive?", answer: "Strava sync is optional but recommended. You can still manually track training and use the AI coach without it." },
  { question: "How does the coach pricing work?", answer: "Coaches pay a base subscription for 25 athletes, then $4 per athlete above 25 through Stripe's monthly billing." },
];

function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-10">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_-10%,rgba(42,80,76,0.20)_0%,transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_35%_at_90%_70%,rgba(242,210,207,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#A2AE98] bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full mb-6">
            AI-driven training for runners and coaches
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white mb-5 leading-tight">
            Train smarter, stay stronger, and scale coaching with confidence.
          </h1>
          <p className="text-slate-400 text-lg leading-8 max-w-xl mb-8">
            Thrive blends Strava sync, AI coaching, and injury detection into one platform — so athletes hit new PRs and coaches manage teams without guesswork.
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

          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Trusted by</p>
              <p className="text-2xl font-semibold text-white">120+ running teams</p>
            </div>
            <div className="rounded-2xl border border-slate-700/60 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-2">Monthly insights</p>
              <p className="text-2xl font-semibold text-white">98% athlete engagement</p>
            </div>
          </div>
        </div>

        <div className="relative w-full max-w-xl">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-[0.25em] mb-1">Thrive preview</p>
                <p className="text-sm font-semibold text-white">Dashboard snapshot</p>
              </div>
              <div className="rounded-2xl bg-slate-900/80 px-3 py-1 text-[11px] font-semibold text-[#A2AE98] border border-[#A2AE98]/15">
                Live
              </div>
            </div>
            <div className="h-[320px] rounded-[1.75rem] bg-gradient-to-br from-[#06110F] to-[#111827] border border-white/10 p-5 overflow-hidden">
              <div className="h-full grid grid-rows-[1fr_auto] gap-4">
                <div className="space-y-4">
                  <div className="h-10 w-32 rounded-full bg-slate-800/90" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-24 rounded-3xl bg-slate-900/90 p-4 border border-slate-700/70">
                      <p className="text-xs text-slate-500">Weekly load</p>
                      <p className="mt-3 text-2xl font-semibold text-white">42<span className="text-sm">mi</span></p>
                    </div>
                    <div className="h-24 rounded-3xl bg-slate-900/90 p-4 border border-slate-700/70">
                      <p className="text-xs text-slate-500">HRV</p>
                      <p className="mt-3 text-2xl font-semibold text-white">78</p>
                    </div>
                    <div className="h-24 rounded-3xl bg-slate-900/90 p-4 border border-slate-700/70">
                      <p className="text-xs text-slate-500">Risk</p>
                      <p className="mt-3 text-2xl font-semibold text-white">Low</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] border border-slate-800/80 bg-slate-900/90 p-4 text-[11px] text-slate-400">
                  <p className="font-semibold text-white mb-3">Recommended this week</p>
                  <ul className="space-y-2">
                    <li>• Recovery day with focused mobility</li>
                    <li>• 6 mi easy run + cadence drill</li>
                    <li>• Strength session for knee stability</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-8 left-4 hidden sm:block w-16 h-16 rounded-full bg-primary/15 blur-2xl" />
          <div className="absolute bottom-8 right-8 hidden sm:block w-24 h-24 rounded-full bg-[#F2D2CF]/15 blur-2xl" />
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
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">More proof</p>
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
          Start your free trial
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
