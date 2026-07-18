import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ANNOUNCEMENT_DISMISSED_KEY = "thriveai_announcement_agentic_coach_dismissed";

const AGENT_PROMPT_EXAMPLES = [
  "Message Marcus about his shin splints",
  "Cut Priya's mileage 20% this week",
  "Assign Jordan a recovery plan",
  "Suggest a change to Sam's plan",
];

// Types out each prompt, pauses, deletes it, then moves to the next —
// classic ChatGPT-style rotating placeholder. Only runs while `active`, so
// it stops burning timers once the popup is dismissed.
function useTypewriter(prompts: string[], active: boolean): string {
  const [text, setText] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    const current = prompts[promptIndex % prompts.length];
    let timeout: ReturnType<typeof setTimeout>;
    if (!deleting && text.length < current.length) {
      timeout = setTimeout(() => setText(current.slice(0, text.length + 1)), 45);
    } else if (!deleting && text.length === current.length) {
      timeout = setTimeout(() => setDeleting(true), 1400);
    } else if (deleting && text.length > 0) {
      timeout = setTimeout(() => setText(current.slice(0, text.length - 1)), 25);
    } else {
      timeout = setTimeout(() => {
        setDeleting(false);
        setPromptIndex((i) => (i + 1) % prompts.length);
      }, 300);
    }
    return () => clearTimeout(timeout);
  }, [text, deleting, promptIndex, active, prompts]);

  return text;
}

const REVIEWS = [
  {
    quote:
      "I can't believe this app does not exist already! It's such a brilliant idea. Every high school runner needs this.",
    author: "Teen athlete, track team",
  },
  {
    quote:
      "This will be so helpful for monitoring all of my team members. I can finally see injury risk across my whole roster at a glance. Thank you for creating this.",
    author: "Cross country coach",
  },
  {
    quote:
      "Wow, amazing! I am going to share this with all of the track athletes on my team. The AI coach answered questions I didn't even know I had.",
    author: "Track athlete",
  },
  {
    quote:
      "The injury risk alerts are a game changer. I've been able to train smarter and actually avoid the overtraining spiral I fall into every season.",
    author: "High school runner",
  },
  {
    quote:
      "AveraAI answered questions my coach didn't have time to address. It's like having a personal coach available 24/7. The Strava sync alone makes it worth it.",
    author: "College runner",
  },
];

const FAQ_ITEMS = [
  {
    q: "What makes Thrive different from Strava?",
    a: "Strava records your workouts. Thrive goes further by analyzing your training, estimating injury risk, generating training plans, and giving both athletes and coaches actionable insights.",
  },
  {
    q: "Do I need Strava to use Thrive?",
    a: "No. Connecting Strava automatically imports your runs, but you can also log workouts manually if you don't use Strava.",
  },
  {
    q: "How do injury alerts work for coaches?",
    a: "If an athlete's training load or mileage increases too quickly, Thrive automatically flags them so coaches can adjust training before injuries occur.",
  },
  {
    q: "How are training plans personalized?",
    a: "Your training plan adapts based on your recent workouts, fitness level, progress, and goals instead of following a one-size-fits-all schedule.",
  },
  {
    q: "How many athletes can a coach manage?",
    a: "There isn't a fixed limit. Coaches pay a base subscription that includes 25 athletes, then $4 per additional athlete each month.",
  },
  {
    q: "How do I connect my data?",
    a: "Connect your Strava account in just a few clicks to automatically sync your runs, workouts, and mileage. If you don't use Strava, you can also log your training manually within Thrive.",
  },
];

const ATHLETE_FEATURES = [
  {
    title: "Strava auto-sync",
    desc: "Every run imported automatically. No manual logging.",
  },
  {
    title: "AI coach (AveraAI)",
    desc: "Ask anything about pace, recovery, or race prep. Get answers in seconds.",
  },
  {
    title: "Injury risk scoring",
    desc: "Your risk score updates after every session so you know when to back off.",
  },
  {
    title: "Adaptive training plans",
    desc: "Plans that adjust to your actual fitness, not a fixed template.",
  },
];

const COACH_FEATURES = [
  {
    title: "Team roster at a glance",
    desc: "Per-athlete mileage, risk, and training load all on one screen.",
  },
  {
    title: "Automated injury alerts",
    desc: "Thrive flags any athlete whose weekly mileage increases more than 20%.",
  },
  {
    title: "Plan assignment",
    desc: "Build and assign training plans to individual athletes without back-and-forth.",
  },
  {
    title: "Pay-per-athlete billing",
    desc: "Base plan includes 25 athletes. Add more for $4/month each.",
  },
];

const WHY_ITEMS = [
  {
    title: "Injury risk detection before you feel it",
    desc: "Thrive monitors your mileage, load, and training patterns to estimate injury risk after every session, so you can back off before a real injury hits.",
  },
  {
    title: "Automatic sync with Strava",
    desc: "Connect once and every run, ride, or workout imports automatically. Zero manual logging, zero missed sessions.",
  },
  {
    title: "Training plans built around your real fitness",
    desc: "Your plan adapts each week based on how your body is actually responding, not a fixed PDF template that ignores your progress.",
  },
  {
    title: "A direct line between athlete and coach",
    desc: "Coaches see every athlete's load, risk, and progress in real time. No more back-and-forth texts. No more guesswork.",
  },
];

const BECOME_ITEMS = [
  {
    title: "Connect in minutes",
    desc: "Link your Strava account and Thrive imports your full training history instantly.",
  },
  {
    title: "Know your risk",
    desc: "Your injury risk score is calculated from your first session and updated after every run.",
  },
  {
    title: "Follow your plan",
    desc: "Get a personalised training plan that adapts each week to your fitness and goals.",
  },
  {
    title: "Chat with AveraAI",
    desc: "Ask anything about your training, recovery, or race strategy, any time of day.",
  },
];

const STRIPE_IMAGES = [
  {
    src: "https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=600&q=80&auto=format&fit=crop",
    alt: "Runners training",
  },
  {
    src: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80&auto=format&fit=crop",
    alt: "Runner at sunrise",
  },
  {
    src: "https://images.unsplash.com/photo-1486218119243-13883505764c?w=600&q=80&auto=format&fit=crop",
    alt: "Athletes on track",
  },
  {
    src: "https://images.unsplash.com/photo-1594882645126-14020914d58d?w=600&q=80&auto=format&fit=crop",
    alt: "Runner outdoors",
  },
];

const WRAP = "max-w-[1180px] mx-auto px-[clamp(20px,4vw,32px)]";
const SEC = "py-[clamp(72px,9vw,136px)]";

// Shared className strings replacing inline style objects
const eyebrow = "font-mono text-[12px] tracking-[0.2em] uppercase mb-4";
const h2 =
  "font-display font-bold leading-[1.16] tracking-[-0.01em] text-foreground mb-7";

function BtnTeal({
  onClick,
  children,
  className,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center font-sans font-semibold border-0",
        "cursor-pointer rounded-[10px] text-base px-[30px] py-[15px]",
        "bg-primary text-white shadow-[0_14px_30px_-12px_rgba(46,144,217,0.6)]",
        "transition-colors hover:bg-primary",
        className,
      )}
    >
      {children}
    </button>
  );
}

function BtnGhost({
  onClick,
  children,
  className,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center font-sans font-semibold cursor-pointer",
        "rounded-[10px] text-[15px] px-7 py-[14px] bg-transparent text-primary",
        "border border-primary/[45%] transition-colors hover:bg-primary/10",
        className,
      )}
    >
      {children}
    </button>
  );
}

function NumList({
  items,
  accent,
}: {
  items: { title: string; desc: string }[];
  accent: string;
}) {
  return (
    <div className="flex flex-col mt-2" style={{ gap: "clamp(26px,3.5vw,36px)" }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={item.title} className="flex gap-4 items-start">
            <div
              className="shrink-0 w-[34px] h-[34px] rounded-full flex items-center justify-center font-mono text-sm mt-0.5"
              style={{
                border: `2px solid ${isLast ? accent : "#E3E8E4"}`,
                color: isLast ? accent : "#5E6B62",
              }}
            >
              {i + 1}
            </div>
            <div>
              <p
                className="font-semibold text-foreground mb-[6px] underline-offset-4"
                style={{
                  fontSize: "clamp(16px,2vw,18px)",
                  textDecoration: isLast ? "underline" : "none",
                  textDecorationColor: isLast ? accent : "transparent",
                }}
              >
                {item.title}
              </p>
              <p className="text-muted-foreground text-[15px] leading-[1.7] m-0">
                {item.desc}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeviceFrame({
  src,
  alt,
  maxWidth = 480,
  style,
  className,
}: {
  src: string;
  alt: string;
  maxWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-[18px] p-2 w-full", className)}
      style={{
        border: "1px solid #E3E8E4",
        background: "#FFFFFF",
        boxShadow: "0 30px 60px -28px rgba(0,0,0,0.75)",
        maxWidth: `${maxWidth}px`,
        ...style,
      }}
    >
      <img src={src} alt={alt} className="w-full h-auto rounded-[12px] block" />
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementClosing, setAnnouncementClosing] = useState(false);
  const typedPrompt = useTypewriter(AGENT_PROMPT_EXAMPLES, showAnnouncement && !announcementClosing);

  useEffect(() => {
    if (!window.localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY)) {
      // Slight delay so it animates in after the page settles, rather than
      // popping in before the layout has even painted.
      const t = setTimeout(() => setShowAnnouncement(true), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  function dismissAnnouncement() {
    window.localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, "1");
    setAnnouncementClosing(true);
    setTimeout(() => {
      setShowAnnouncement(false);
      setAnnouncementClosing(false);
    }, 200);
  }

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const iv = setInterval(
      () => setCurrentIndex((i) => (i + 1) % REVIEWS.length),
      9000,
    );
    return () => clearInterval(iv);
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 72,
        behavior: "smooth",
      });
    setMenuOpen(false);
  }

  const navLinks: [string, string][] = [
    ["For Athletes", "athletes"],
    ["For Coaches", "coaches"],
    ["Features", "features"],
    ["FAQ", "faq"],
  ];

  return (
    <div className="bg-background overflow-x-clip">
      {showAnnouncement && (
        <div
          className={cn(
            "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4",
            announcementClosing ? "animate-out fade-out duration-200" : "animate-in fade-in duration-300",
          )}
          onClick={dismissAnnouncement}
        >
          <style>{`
            @keyframes blink-caret {
              0%, 100% { opacity: 1; }
              50% { opacity: 0; }
            }
          `}</style>
          <div
            className={cn(
              "relative bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-6 pt-8 text-center",
              announcementClosing
                ? "animate-out fade-out-0 zoom-out-95 duration-200"
                : "animate-in fade-in-0 zoom-in-95 duration-300 ease-out",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={dismissAnnouncement}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <h2
              className="font-display font-extrabold text-xl tracking-[-0.01em] text-foreground"
              style={{ animation: "popup-fade-up 0.5s ease-out both", animationDelay: "0.5s" }}
            >
              Agentic AI for coaches and athletes is here!
            </h2>
            <p
              className="text-sm text-muted-foreground mt-2 leading-relaxed"
              style={{ animation: "popup-fade-up 0.5s ease-out both", animationDelay: "0.7s" }}
            >
              AveraAI can now message athletes, adjust training plans, and act on your roster in real time — right from chat.
            </p>
            <div className="mt-5">
              {/* Nothing shows at first — the bolt drops in, bounces, then flattens into the logo + prompt box */}
              <div className="relative h-7 flex justify-start pl-3 overflow-visible">
                <img
                  src="/logo.svg"
                  alt=""
                  className="w-7 h-7 rounded-[7px]"
                  style={{ animation: "popup-bolt-bounce 0.9s linear both", animationDelay: "0.25s" }}
                />
              </div>
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.svg"
                  alt=""
                  className="w-9 h-9 rounded-[9px] shrink-0"
                  style={{ animation: "popup-fade-up 0.4s ease-out both", animationDelay: "1.05s" }}
                />
                <div
                  className="flex-1 rounded-xl border border-border bg-background px-3.5 py-2.5 text-left text-sm text-foreground flex items-center min-h-[42px] overflow-hidden"
                  style={{
                    animation: "popup-box-form 0.9s cubic-bezier(0.34,1.56,0.64,1) both",
                    animationDelay: "0.25s",
                    transformOrigin: "left center",
                  }}
                >
                  <span>{typedPrompt}</span>
                  <span
                    className="inline-block w-[2px] h-4 bg-primary ml-0.5"
                    style={{ animation: "blink-caret 1s step-end infinite" }}
                  />
                </div>
              </div>
            </div>
            <button
              onClick={() => { dismissAnnouncement(); scrollTo("coaches"); }}
              className="mt-5 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors hover:scale-[1.02] active:scale-[0.98]"
              style={{ animation: "popup-fade-up 0.5s ease-out both", animationDelay: "0.9s" }}
            >
              See what's new
            </button>
          </div>
        </div>
      )}

      {/* NAVBAR */}
      <header
        className="sticky top-0 z-50 backdrop-blur-[12px] border-b border-border transition-[background-color,box-shadow] duration-200"
        style={{
          background: scrolled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
          boxShadow: scrolled ? "0 4px 24px -8px rgba(31,41,37,0.12)" : "none",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className={cn(WRAP, "flex items-center justify-between h-[68px]")}>
          <button
            onClick={() => scrollTo("top")}
            className="flex items-center gap-[10px] bg-transparent border-0 cursor-pointer p-0"
          >
            <img
              src="/logo.svg"
              alt="Thrive"
              className="w-[30px] h-[30px] rounded-[8px]"
            />
            <span className="font-display font-extrabold text-[21px] tracking-[-0.01em] text-foreground">
              Thrive
            </span>
          </button>
          <nav className="hidden lg:flex items-center gap-[34px]">
            {navLinks.map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="font-sans text-sm text-muted-foreground font-medium bg-transparent border-0 cursor-pointer p-0 transition-colors hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-[18px]">
            <button
              onClick={() => navigate("/sign-in")}
              className="font-sans text-sm text-muted-foreground font-medium bg-transparent border-0 cursor-pointer transition-colors hover:text-foreground"
            >
              Log in
            </button>
            <BtnTeal
              onClick={() => navigate("/sign-up")}
              className="py-[9px] px-[18px] text-sm shadow-none"
            >
              Get Started
            </BtnTeal>
          </div>
          <div className="flex lg:hidden items-center gap-3">
            <BtnTeal
              onClick={() => navigate("/sign-up")}
              className="py-[9px] px-4 text-sm shadow-none"
            >
              Get Started
            </BtnTeal>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex flex-col justify-center gap-[5px] w-[42px] h-[42px] items-center bg-transparent border-0 cursor-pointer"
            >
              <span className="w-[22px] h-0.5 bg-foreground rounded-[2px]" />
              <span className="w-[22px] h-0.5 bg-foreground rounded-[2px]" />
              <span className="w-[22px] h-0.5 bg-foreground rounded-[2px]" />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div
            className="lg:hidden flex flex-col gap-[6px] bg-background border-t border-border"
            style={{ padding: "18px clamp(20px,4vw,32px) 26px" }}
          >
            {navLinks.map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className="text-left text-foreground text-base font-medium py-3 bg-transparent border-0 border-b border-border cursor-pointer font-sans"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => {
                navigate("/sign-in");
                setMenuOpen(false);
              }}
              className="w-full text-foreground font-semibold py-3 border border-border rounded-[10px] mt-[14px] bg-transparent cursor-pointer text-[15px] font-sans"
            >
              Log in
            </button>
            <BtnTeal
              onClick={() => {
                navigate("/sign-up");
                setMenuOpen(false);
              }}
              className="w-full shadow-none py-3"
            >
              Get Started
            </BtnTeal>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" className="relative overflow-hidden bg-background">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 55% 60% at 78% 50%,rgba(46,144,217,0.20) 0%,transparent 64%)",
          }}
        />
        <div className={cn(WRAP, "pt-[clamp(24px,4vw,48px)] pb-[clamp(48px,6vw,96px)]", "relative")}>
          <div
            className="flex flex-col lg:flex-row lg:items-center"
            style={{ gap: "clamp(40px,5vw,64px)" }}
          >
            <div className="w-full shrink-0 lg:w-[52%]">
              <div className="inline-flex items-center gap-[10px] bg-background border border-border rounded-full px-4 py-2 mb-7">
                <span className="text-primary tracking-[2px] text-[13px]">
                  ★★★★★
                </span>
                <span className="text-muted-foreground text-[13px]">
                  Validated by 70+ athletes & coaches before launch
                </span>
              </div>
              <h1
                className="font-display font-extrabold leading-[1.14] tracking-[-0.01em] text-foreground mb-[30px]"
                style={{ fontSize: "clamp(40px,7vw,72px)" }}
              >
                Take your training
                <br />
                to the <span className="text-primary">next level</span>
              </h1>
              <p
                className="text-muted-foreground leading-[1.75] max-w-[30rem] mb-8"
                style={{ fontSize: "clamp(15px,1.6vw,18px)" }}
              >
                Get the coaching support you need as a runner. AI-powered
                training plans, automatic injury risk detection, and a direct
                line to your coach, all in one place.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <BtnTeal onClick={() => navigate("/sign-up")}>
                  Get Started
                </BtnTeal>
                <BtnGhost onClick={() => navigate("/demo/choose")}>
                  Try the demo
                </BtnGhost>
              </div>
              <p className="text-muted-foreground text-sm mt-4">Cancel anytime.</p>
            </div>
            <div className="w-full relative shrink-0 lg:w-[44%]">
              <div
                className="absolute rounded-full blur-[64px] z-0"
                style={{ inset: "-10% -8%", background: "rgba(46,144,217,0.20)" }}
              />
              <div
                className="relative z-[1] rounded-[18px] border border-border bg-background p-[10px]"
                style={{ boxShadow: "0 36px 70px -28px rgba(0,0,0,0.75)" }}
              >
                <div className="flex gap-[10px] px-2 pt-[6px] pb-3">
                  <span className="w-[11px] h-[11px] rounded-full bg-[#E5564D]" />
                  <span className="w-[11px] h-[11px] rounded-full bg-[#E6B450]" />
                  <span className="w-[11px] h-[11px] rounded-full bg-primary" />
                </div>
                <img
                  src="/homepage-dashboard.svg"
                  alt="Thrive training dashboard"
                  className="w-full h-auto rounded-[11px] border border-white/[6%] block"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOR ATHLETES */}
      <section
        id="athletes"
        className="relative overflow-hidden bg-background border-t border-border"
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 65% 50% at 50% 0%,rgba(46,144,217,0.20) 0%,transparent 70%)",
          }}
        />
        <div className={cn(WRAP, SEC, "relative")}>
          <div
            className="flex flex-col lg:flex-row lg:items-center"
            style={{ gap: "clamp(40px,5vw,64px)" }}
          >
            <div className="flex-1">
              <p className={cn(eyebrow, "text-primary")}>For Athletes</p>
              <h2 className={h2} style={{ fontSize: "clamp(28px,4.4vw,52px)" }}>
                Your personal training intelligence layer.
              </h2>
              <p
                className="text-muted-foreground leading-[1.75] max-w-[34rem] mb-[20px]"
                style={{ fontSize: "clamp(15px,1.6vw,18px)" }}
              >
                Whether you're a high school sprinter or a first-time 5K runner,
                Thrive gives you the tools that used to be reserved for elite
                athletes. Log your runs, understand your data, and train with a
                plan that evolves as you do.
              </p>
              <NumList items={ATHLETE_FEATURES} accent="#2E90D9" />
              <BtnTeal
                onClick={() => navigate("/sign-up?role=athlete")}
                className="mt-[34px]"
              >
                Get Started
              </BtnTeal>
            </div>
            <div className="flex-1">
              <div
                className="rounded-[18px] border border-border bg-background p-4 flex flex-col gap-3"
                style={{ boxShadow: "0 30px 60px -28px rgba(0,0,0,0.7)" }}
              >
                <div className="rounded-[14px] border border-border bg-background p-4">
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground mb-[10px]">
                    This week
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="font-display font-bold text-[26px] text-foreground m-0">
                        42.3 km
                      </p>
                      <p className="text-primary text-[13px] mt-1">
                        ↑ 12% vs last week
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-[26px] text-foreground m-0">
                        5
                      </p>
                      <p className="text-muted-foreground text-[13px] mt-1">runs</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-[14px] border border-border bg-background p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground m-0">
                      Injury Risk
                    </p>
                    <span className="font-mono text-[11px] text-[#5fbf8a] bg-[#5fbf8a]/10 border border-[#5fbf8a]/[22%] px-[9px] py-0.5 rounded-full">
                      LOW
                    </span>
                  </div>
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary w-1/4" />
                  </div>
                </div>
                <div className="rounded-[14px] border border-primary/[22%] bg-primary/[5%] p-4">
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-primary mb-2">
                    AveraAI
                  </p>
                  <p className="text-sm leading-[1.7] text-foreground m-0">
                    "Your long run pace yesterday was 8% above your aerobic
                    threshold. I'd recommend an easy 5k tomorrow."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOR COACHES */}
      <section id="coaches" className="relative overflow-hidden bg-background">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 95% 100%,rgba(46,144,217,0.10) 0%,transparent 65%)",
          }}
        />
        <div className={cn(WRAP, SEC, "relative")}>
          <div
            className="flex flex-col lg:flex-row-reverse lg:items-center"
            style={{ gap: "clamp(40px,5vw,64px)" }}
          >
            <div className="flex-1">
              <p className={cn(eyebrow, "text-primary")}>For Coaches</p>
              <h2 className={h2} style={{ fontSize: "clamp(28px,4.4vw,52px)" }}>
                Manage your whole team. No spreadsheets.
              </h2>
              <p
                className="text-muted-foreground leading-[1.75] max-w-[34rem] mb-[20px]"
                style={{ fontSize: "clamp(15px,1.6vw,18px)" }}
              >
                Thrive shows every athlete's weekly mileage, injury risk score,
                and training load in a single dashboard. When an athlete's
                mileage increases too fast, Thrive flags it automatically so
                you can adjust their training before an injury happens.
              </p>
              <NumList items={COACH_FEATURES} accent="#2E90D9" />
              <BtnGhost
                onClick={() => navigate("/sign-up?role=coach")}
                className="mt-[34px]"
              >
                Add your team
              </BtnGhost>
            </div>
            <div className="flex-1">
              <div
                className="rounded-[18px] border border-border bg-background overflow-hidden"
                style={{ boxShadow: "0 30px 60px -28px rgba(0,0,0,0.7)" }}
              >
                <div className="px-[18px] py-[14px] border-b border-border flex justify-between items-center">
                  <p className="text-sm font-semibold text-foreground m-0">
                    Team Overview
                  </p>
                  <p className="font-mono text-xs text-muted-foreground m-0">
                    Week of Jun 23
                  </p>
                </div>
                <div
                  className="grid px-[18px] py-[10px] border-b border-border"
                  style={{ gridTemplateColumns: "1.4fr 1fr 0.9fr 1fr" }}
                >
                  {["Athlete", "Mileage", "Risk", "Load"].map((h) => (
                    <span
                      key={h}
                      className="font-mono text-[10px] tracking-[0.12em] uppercase text-muted-foreground"
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {[
                  {
                    name: "Maria G.",
                    km: "38 km",
                    risk: "LOW",
                    riskColor: "#5fbf8a",
                    riskBg: "rgba(95,191,138,0.10)",
                    load: "60%",
                    loadColor: "#2E90D9",
                    highlight: false,
                  },
                  {
                    name: "Jake T. ⚠",
                    km: "67 km",
                    risk: "HIGH",
                    riskColor: "#E5564D",
                    riskBg: "rgba(229,62,62,0.10)",
                    load: "100%",
                    loadColor: "#E53E3E",
                    highlight: true,
                  },
                  {
                    name: "Sofia R.",
                    km: "29 km",
                    risk: "LOW",
                    riskColor: "#5fbf8a",
                    riskBg: "rgba(95,191,138,0.10)",
                    load: "35%",
                    loadColor: "#2E90D9",
                    highlight: false,
                  },
                ].map((row, i, arr) => (
                  <div
                    key={row.name}
                    className="grid items-center px-[18px] py-[14px]"
                    style={{
                      gridTemplateColumns: "1.4fr 1fr 0.9fr 1fr",
                      borderBottom:
                        i < arr.length - 1 ? "1px solid #E3E8E4" : "none",
                      background: row.highlight
                        ? "rgba(229,62,62,0.06)"
                        : "transparent",
                      borderLeft: row.highlight ? "2px solid #E53E3E" : "none",
                    }}
                  >
                    <span className="text-sm text-foreground">{row.name}</span>
                    <span className="text-sm text-foreground">{row.km}</span>
                    <span>
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ color: row.riskColor, background: row.riskBg }}
                      >
                        {row.risk}
                      </span>
                    </span>
                    <span>
                      <div className="h-[6px] w-20 rounded-full bg-muted">
                        <div
                          className="h-[6px] rounded-full"
                          style={{ background: row.loadColor, width: row.load }}
                        />
                      </div>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-background border-t border-border">
        <div className={cn(WRAP, SEC)}>
          <h2
            className={cn(h2, "text-center max-w-[18ch] mx-auto")}
            style={{ fontSize: "clamp(28px,4.4vw,52px)" }}
          >
            Train with data that actually matters
          </h2>
          <p
            className="text-muted-foreground leading-[1.75] text-center max-w-[38rem] mx-auto mb-14"
            style={{ fontSize: "clamp(15px,1.6vw,18px)" }}
          >
            See exactly what your training is doing to your body, before it
            becomes an injury, a plateau, or a missed race.
          </p>
          {/* Mobile horizontal scroll */}
          <div
            className="lg:hidden flex gap-[18px] pb-[10px] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
            style={{
              marginLeft: "calc(-1 * clamp(20px,4vw,32px))",
              marginRight: "calc(-1 * clamp(20px,4vw,32px))",
              paddingLeft: "clamp(20px,4vw,32px)",
              paddingRight: "clamp(20px,4vw,32px)",
            }}
          >
            {[
              {
                content: <FeatureDashboardCard />,
                caption:
                  "Connect Strava and see your weekly distance, injury risk, and training load the moment you log in.",
              },
              {
                content: <FeatureActivityCard />,
                caption:
                  "Dive into any run: pace, heart rate, elevation, and cadence, pulled automatically from Strava.",
              },
              {
                content: <FeaturePlanCard />,
                caption:
                  "Your personalised training plan updates every week based on your logged workouts, fitness, and goals.",
              },
            ].map((card, i) => (
              <div
                key={i}
                className="shrink-0 w-[80vw] snap-start flex flex-col gap-[14px]"
              >
                {card.content}
                <p className="text-sm text-muted-foreground text-center m-0 px-[12px] leading-[1.65]">
                  {card.caption}
                </p>
              </div>
            ))}
          </div>
          {/* Desktop 3-col grid */}
          <div className="hidden lg:grid grid-cols-3 gap-8">
            {[
              {
                content: <FeatureDashboardCard />,
                caption:
                  "Connect Strava and see your weekly distance, injury risk, and training load the moment you log in.",
              },
              {
                content: <FeatureActivityCard />,
                caption:
                  "Dive into any run: pace, heart rate, elevation, and cadence, pulled automatically from Strava.",
              },
              {
                content: <FeaturePlanCard />,
                caption:
                  "Your personalised training plan updates every week based on your logged workouts, fitness, and goals.",
              },
            ].map((card, i) => (
              <div key={i} className="flex flex-col gap-[14px]">
                {card.content}
                <p className="text-sm text-muted-foreground text-center m-0 px-[12px] leading-[1.65]">
                  {card.caption}
                </p>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-12">
            <BtnTeal onClick={() => navigate("/sign-up")}>Get Started</BtnTeal>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section className="bg-background">
        <div className={cn(WRAP, SEC)}>
          <div className="flex flex-col lg:flex-row rounded-[18px] overflow-hidden">
            <div
              className="lg:w-[45%] bg-primary/10"
              style={{ padding: "clamp(32px,4vw,56px)" }}
            >
              <h2
                className="font-display font-bold leading-[1.16] text-foreground mb-[42px]"
                style={{ fontSize: "clamp(28px,4.4vw,52px)" }}
              >
                Reviews from users
              </h2>
              <div className="mb-8">
                <div className="flex gap-[3px] mb-2 text-[#F5B400] text-[22px]">
                  ★★★★★
                </div>
                <p className="text-foreground font-semibold text-lg m-0">
                  70+ beta users
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  Athletes and coaches validated Thrive before launch
                </p>
              </div>
              <div>
                <div className="flex gap-[3px] mb-2 text-[#F5B400] text-[18px]">
                  ★★★★★
                </div>
                <p className="text-foreground font-semibold text-base m-0">
                  100% would recommend
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  to a teammate or fellow runner
                </p>
              </div>
            </div>
            <div
              className="lg:w-[55%] bg-background flex flex-col justify-center"
              style={{ padding: "clamp(32px,4vw,56px)" }}
            >
              <div
                key={currentIndex}
                className="border-l-4 border-l-primary pl-6"
              >
                <p
                  className="text-foreground italic leading-[1.7] mb-[26px]"
                  style={{ fontSize: "clamp(17px,2vw,21px)" }}
                >
                  "{REVIEWS[currentIndex].quote}"
                </p>
                <p className="text-foreground font-semibold m-0">
                  {REVIEWS[currentIndex].author}
                </p>
              </div>
              <div className="flex gap-2 mt-10">
                {REVIEWS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className="h-1 rounded-full border-0 cursor-pointer p-0 transition-all duration-300"
                    style={{
                      width: i === currentIndex ? "32px" : "8px",
                      background: i === currentIndex ? "#2E90D9" : "#E3E8E4",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY USE THRIVE */}
      <section className="relative overflow-hidden bg-background border-t border-border">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 45% at 12% 50%,rgba(46,144,217,0.16) 0%,transparent 64%)",
          }}
        />
        <div className={cn(WRAP, SEC, "relative")}>
          <div
            className="flex flex-col lg:flex-row lg:items-center"
            style={{ gap: "clamp(40px,5vw,64px)" }}
          >
            <div className="lg:w-[45%] relative flex justify-center">
              <div
                className="absolute w-[72%] h-[72%] top-[14%] rounded-full blur-[60px]"
                style={{ background: "rgba(46,144,217,0.16)" }}
              />
              <DeviceFrame
                src="/homepage-dashboard.svg"
                alt="Thrive dashboard"
                maxWidth={480}
                className="relative"
              />
            </div>
            <div className="lg:w-[55%]">
              <h2
                className={cn(h2, "mb-8")}
                style={{ fontSize: "clamp(30px,5vw,60px)" }}
              >
                Why use Thrive?
              </h2>
              <NumList items={WHY_ITEMS} accent="#2E90D9" />
            </div>
          </div>
        </div>
      </section>

      {/* IMAGE STRIPE — full-bleed, edge to edge */}
      <div className="grid w-full grid-cols-2 lg:grid-cols-4">
        {STRIPE_IMAGES.map((img) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            loading="lazy"
            className="block h-[clamp(150px,28vw,240px)] w-full object-cover"
          />
        ))}
      </div>

      {/* BECOME A THRIVE ATHLETE */}
      <section className="bg-background">
        <div className={cn(WRAP, SEC)}>
          <div
            className="flex flex-col lg:flex-row lg:items-center"
            style={{ gap: "clamp(40px,5vw,64px)" }}
          >
            <div className="lg:w-[60%]">
              <h2
                className={cn(h2, "mb-[30px]")}
                style={{ fontSize: "clamp(28px,4.4vw,52px)" }}
              >
                Become a Thrive athlete
              </h2>
              <NumList items={BECOME_ITEMS} accent="#2E90D9" />
            </div>
            <div className="lg:w-[40%] flex justify-center">
              <DeviceFrame
                src="/homepage-dashboard.svg"
                alt="Thrive app"
                maxWidth={520}
              />
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="bg-background border-t border-border">
        <div className={cn(WRAP, SEC)}>
          <h2
            className={cn(h2, "text-center")}
            style={{ fontSize: "clamp(28px,4.4vw,52px)" }}
          >
            Simple, fair pricing
          </h2>
          <p
            className="text-muted-foreground leading-[1.75] text-center"
            style={{ fontSize: "clamp(15px,1.6vw,18px)" }}
          >
            Pay for what you use. No annual lock-in.
          </p>
          <div
            className="grid grid-cols-1 lg:grid-cols-2 gap-[22px] max-w-[900px] mx-auto"
            style={{ marginTop: "clamp(40px,5vw,56px)" }}
          >
            <div
              className="flex flex-col bg-background rounded-[24px] border border-primary/30"
              style={{
                padding: "clamp(28px,3.2vw,42px)",
                boxShadow:
                  "0 0 60px -28px rgba(46,144,217,0.45),0 30px 60px -34px rgba(0,0,0,0.75)",
              }}
            >
              <p className={cn(eyebrow, "text-primary mb-[18px]")}>
                For Athletes
              </p>
              <div className="flex items-end gap-2 mb-[26px]">
                <span
                  className="font-display font-extrabold leading-[1.05] text-foreground"
                  style={{ fontSize: "clamp(46px,6vw,64px)" }}
                >
                  $7.99
                </span>
                <span className="text-muted-foreground text-lg mb-[9px]">/ month</span>
              </div>
              <div className="flex flex-col gap-[15px]">
                {[
                  "Strava sync",
                  "AveraAI (unlimited)",
                  "Injury risk scoring",
                  "Personalised plans",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <span className="text-primary font-bold shrink-0">✓</span>
                    <span
                      className="text-foreground"
                      style={{ fontSize: "clamp(15px,1.6vw,16px)" }}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>
              <div className="h-9 shrink-0" />
              <BtnTeal
                onClick={() => navigate("/sign-up?role=athlete")}
                className="w-full mt-auto shadow-none"
              >
                Get Started
              </BtnTeal>
            </div>
            <div
              className="flex flex-col bg-background rounded-[24px] border border-primary/[24%]"
              style={{
                padding: "clamp(28px,3.2vw,42px)",
                boxShadow:
                  "0 0 60px -30px rgba(46,144,217,0.30),0 30px 60px -34px rgba(0,0,0,0.75)",
              }}
            >
              <p className={cn(eyebrow, "text-primary mb-[18px]")}>
                For Coaches
              </p>
              <div className="flex items-end gap-2 mb-[6px]">
                <span
                  className="font-display font-extrabold leading-[1.05] text-foreground"
                  style={{ fontSize: "clamp(46px,6vw,64px)" }}
                >
                  $99
                </span>
                <span className="text-muted-foreground text-lg mb-[9px]">/ month</span>
              </div>
              <p className="font-mono text-[13px] text-muted-foreground mb-6">
                + $4 per athlete above 25
              </p>
              <div className="flex flex-col gap-[15px]">
                {[
                  "Up to 25 athletes",
                  "Team roster + workload dashboard",
                  "Automated injury alerts",
                  "Per-athlete plan assignment",
                  "Stripe billing",
                ].map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <span className="text-primary font-bold shrink-0">✓</span>
                    <span
                      className="text-foreground"
                      style={{ fontSize: "clamp(15px,1.6vw,16px)" }}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>
              <BtnGhost
                onClick={() => navigate("/sign-up?role=coach")}
                className="w-full mt-9 py-[15px]"
              >
                Add your team
              </BtnGhost>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-background border-t border-border">
        <div className={cn(WRAP, SEC)}>
          <div
            className="flex flex-col lg:flex-row lg:items-start"
            style={{ gap: "clamp(32px,4vw,48px)" }}
          >
            <div className="lg:w-[34%]">
              <h2
                className={cn(h2, "mb-0")}
                style={{ fontSize: "clamp(28px,4.4vw,52px)" }}
              >
                FAQ: Everything you need to know about training with Thrive
              </h2>
            </div>
            <div className="lg:w-[60%] flex-grow">
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="border-t border-border">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex justify-between items-center gap-4 py-5 bg-transparent border-0 cursor-pointer text-left font-sans"
                  >
                    <span
                      className="font-medium text-foreground"
                      style={{ fontSize: "clamp(15px,1.7vw,17px)" }}
                    >
                      {item.q}
                    </span>
                    <ChevronDown
                      className="w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200"
                      style={{
                        transform:
                          openFaq === i ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    />
                  </button>
                  {openFaq === i && (
                    <p className="text-muted-foreground text-[15px] leading-[1.75] m-0 pb-[22px] max-w-[46rem]">
                      {item.a}
                    </p>
                  )}
                </div>
              ))}
              <div className="border-t border-border" />
            </div>
          </div>
        </div>
      </section>

      {/* EMAIL CAPTURE + FINAL CTA */}
      <section id="cta" className="relative overflow-hidden bg-background">
        <div
          className="absolute left-0 right-0 bottom-0 h-[60%] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 80% at 50% 120%,rgba(46,144,217,0.20) 0%,transparent 65%)",
          }}
        />
        <div className={cn(WRAP, SEC, "relative")}>
          <div
            className="flex flex-col lg:flex-row lg:items-center"
            style={{ gap: "clamp(40px,5vw,64px)" }}
          >
            <div className="lg:w-[45%] relative flex justify-center">
              <div
                className="absolute w-[78%] h-[70%] top-[15%] rounded-full blur-[60px]"
                style={{ background: "rgba(46,144,217,0.18)" }}
              />
              <DeviceFrame
                src="/homepage-dashboard.svg"
                alt="Thrive app"
                maxWidth={500}
                className="relative"
                style={{
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "#FAFAF7",
                  boxShadow: "0 36px 70px -28px rgba(0,0,0,0.8)",
                }}
              />
            </div>
            <div className="lg:w-[55%]">
              <h2
                className="font-display font-extrabold leading-[1.14] tracking-[-0.01em] text-foreground mb-6"
                style={{ fontSize: "clamp(34px,5.5vw,60px)" }}
              >
                Take your training to the{" "}
                <span className="text-primary">next level</span>
              </h2>
              <p
                className="text-muted-foreground leading-[1.75] max-w-[30rem] mb-[30px]"
                style={{ fontSize: "clamp(15px,1.6vw,18px)" }}
              >
                Your personalised training platform with AI-powered coaching,
                automatic injury risk detection, and direct coach-athlete
                connection, all in one place.
              </p>
              <BtnTeal onClick={() => navigate("/sign-up")}>
                Get Started
              </BtnTeal>
              <p className="text-muted-foreground text-sm mt-4">Cancel anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-background border-t border-border">
        <div className={cn(WRAP, "pt-14 pb-10")}>
          <div className="flex flex-col lg:flex-row lg:justify-between gap-9">
            <div className="max-w-[280px]">
              <div className="flex items-center gap-[10px] mb-[20px]">
                <img
                  src="/logo.svg"
                  alt="Thrive"
                  className="w-7 h-7 rounded-[8px]"
                />
                <span className="font-display font-extrabold text-[19px] text-foreground">
                  Thrive
                </span>
              </div>
              <p className="text-muted-foreground text-sm leading-[1.7] m-0">
                AI-powered training for runners and coaches.
              </p>
            </div>
            <div className="flex gap-16 flex-wrap">
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted-foreground mb-1">
                  Product
                </p>
                {navLinks.map(([label, id]) => (
                  <button
                    key={id}
                    onClick={() => scrollTo(id)}
                    className="font-sans text-sm text-muted-foreground font-medium bg-transparent border-0 cursor-pointer p-0 text-left transition-colors hover:text-foreground"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[11px] tracking-[0.16em] uppercase text-muted-foreground mb-1">
                  Company
                </p>
                <button
                  onClick={() => navigate("/privacy")}
                  className="text-sm text-muted-foreground font-medium bg-transparent border-0 cursor-pointer p-0 text-left transition-colors hover:text-foreground"
                >
                  Privacy Policy
                </button>
                <button
                  onClick={() => navigate("/terms")}
                  className="text-sm text-muted-foreground font-medium bg-transparent border-0 cursor-pointer p-0 text-left transition-colors hover:text-foreground"
                >
                  Terms of Service
                </button>
                <a
                  href="mailto:thriveai78@gmail.com"
                  className="text-sm text-muted-foreground no-underline font-medium transition-colors hover:text-foreground"
                >
                  Contact
                </a>
              </div>
            </div>
          </div>
          <div className="border-t border-border mt-10 pt-6 text-center">
            <p className="font-mono text-xs text-muted-foreground m-0">
              © 2026 Thrive · Made for runners.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature card sub-components

function FeatureCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border border-border bg-background p-[18px] aspect-[9/16] flex flex-col gap-3">
      {children}
    </div>
  );
}

function FeatureDashboardCard() {
  return (
    <FeatureCardShell>
      <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground m-0">
        Dashboard · Jun 25
      </p>
      <div className="rounded-[14px] bg-background border border-border p-[14px]">
        <p className="text-xs text-muted-foreground mb-1">Weekly Distance</p>
        <p className="font-display font-bold text-[26px] text-foreground m-0">
          42.3 km
        </p>
        <p className="text-xs text-primary mt-[6px]">↑ 12% vs last week</p>
      </div>
      <div className="rounded-[14px] bg-background border border-border p-[14px]">
        <p className="text-xs text-muted-foreground mb-1">Training Load</p>
        <p className="text-[17px] font-semibold text-foreground m-0">Moderate</p>
        <div className="mt-[10px] h-[6px] rounded-full bg-muted">
          <div className="h-[6px] rounded-full bg-primary w-[55%]" />
        </div>
      </div>
      <div className="rounded-[14px] bg-background border border-border p-[14px]">
        <p className="text-xs text-muted-foreground mb-2">Injury Risk</p>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground">LOW</span>
          <span className="w-[9px] h-[9px] rounded-full bg-[#5fbf8a]" />
        </div>
      </div>
    </FeatureCardShell>
  );
}

function FeatureActivityCard() {
  const metrics = [
    ["Distance", "11.02 mi"],
    ["Time", "1:40:38"],
    ["Avg Pace", "9:08/mi"],
    ["Avg HR", "151 bpm"],
    ["Cadence", "177 spm"],
    ["Elevation", "259 ft"],
  ];
  return (
    <FeatureCardShell>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-primary" />
        <span className="text-xs text-primary font-medium">
          Long Run · 11 mi
        </span>
      </div>
      <p className="font-display font-bold text-[20px] text-foreground m-0">
        Tuesday Morning Run
      </p>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {metrics.map(([label, val]) => (
          <div
            key={label}
            className="rounded-[10px] bg-background border border-border p-[9px]"
          >
            <p className="font-mono text-[9px] uppercase text-muted-foreground m-0">
              {label}
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5">{val}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto rounded-[12px] bg-background border border-primary/[22%] p-3">
        <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-primary mb-[6px]">
          AveraAI insight
        </p>
        <p className="text-xs leading-[1.65] text-foreground m-0">
          "Solid effort. Your pace was 6% faster than aerobic threshold, so ease
          back tomorrow."
        </p>
      </div>
    </FeatureCardShell>
  );
}

function FeaturePlanCard() {
  const days = [
    { day: "Mon", run: "Rest", done: true },
    { day: "Tue", run: "Easy 6 mi", done: true },
    { day: "Wed", run: "Tempo 5 mi", done: false },
    { day: "Thu", run: "Rest", done: false },
    { day: "Fri", run: "Easy 4 mi", done: false },
    { day: "Sat", run: "Long 14 mi", done: false },
  ];
  return (
    <FeatureCardShell>
      <div className="flex items-center justify-between">
        <p className="font-semibold text-foreground m-0">Marathon Plan</p>
        <p className="text-xs text-muted-foreground m-0">Week 6 / 16</p>
      </div>
      <div className="h-[6px] rounded-full bg-muted">
        <div className="h-[6px] rounded-full bg-primary w-[37.5%]" />
      </div>
      <div className="flex flex-col gap-2 mt-0.5">
        {days.map(({ day, run, done }) => (
          <div
            key={day}
            className="flex items-center gap-3 rounded-[10px] px-3 py-[10px]"
            style={{
              background: done ? "rgba(46,144,217,0.10)" : "#FFFFFF",
              border: `1px solid ${done ? "rgba(46,144,217,0.22)" : "#E3E8E4"}`,
            }}
          >
            <span className="font-mono text-xs text-muted-foreground w-[26px]">
              {day}
            </span>
            <span className="text-[13px] text-foreground flex-1">{run}</span>
            {done && <span className="text-primary text-xs">✓</span>}
          </div>
        ))}
      </div>
    </FeatureCardShell>
  );
}
