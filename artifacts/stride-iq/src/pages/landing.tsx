import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronDown } from "lucide-react";

const REVIEWS = [
  { quote: "I can't believe this app does not exist already! It's such a brilliant idea. Every high school runner needs this.", author: "Teen athlete, track team" },
  { quote: "This will be so helpful for monitoring all of my team members. I can finally see injury risk across my whole roster at a glance. Thank you for creating this.", author: "Cross country coach" },
  { quote: "Wow, amazing! I am going to share this with all of the track athletes on my team. The AI coach answered questions I didn't even know I had.", author: "Track athlete" },
  { quote: "The injury risk alerts are a game changer. I've been able to train smarter and actually avoid the overtraining spiral I fall into every season.", author: "High school runner" },
  { quote: "AveraAI answered questions my coach didn't have time to address. It's like having a personal coach available 24/7. The Strava sync alone makes it worth it.", author: "College runner" },
];

const FAQ_ITEMS = [
  { q: "What makes Thrive different from Strava?", a: "Strava records your workouts. Thrive goes further by analyzing your training, estimating injury risk, generating training plans, and giving both athletes and coaches actionable insights." },
  { q: "Do I need Strava to use Thrive?", a: "No. Connecting Strava automatically imports your runs, but you can also log workouts manually if you don't use Strava." },
  { q: "How do injury alerts work for coaches?", a: "If an athlete's training load or mileage increases too quickly, Thrive automatically flags them so coaches can adjust training before injuries occur." },
  { q: "How are training plans personalized?", a: "Your training plan adapts based on your recent workouts, fitness level, progress, and goals instead of following a one-size-fits-all schedule." },
  { q: "How many athletes can a coach manage?", a: "There isn't a fixed limit. Coaches pay a base subscription that includes 25 athletes, then $4 per additional athlete each month." },
  { q: "How do I connect my data?", a: "Connect your Strava account in just a few clicks to automatically sync your runs, workouts, and mileage. If you don't use Strava, you can also log your training manually within Thrive." },
];

const ATHLETE_FEATURES = [
  { title: "Strava auto-sync", desc: "Every run imported automatically. No manual logging." },
  { title: "AI coach (AveraAI)", desc: "Ask anything about pace, recovery, or race prep. Get answers in seconds." },
  { title: "Injury risk scoring", desc: "Your risk score updates after every session so you know when to back off." },
  { title: "Adaptive training plans", desc: "Plans that adjust to your actual fitness, not a fixed template." },
];

const COACH_FEATURES = [
  { title: "Team roster at a glance", desc: "Per-athlete mileage, risk, and training load all on one screen." },
  { title: "Automated injury alerts", desc: "Thrive flags any athlete spiking mileage faster than 10%/week." },
  { title: "Plan assignment", desc: "Build and assign training plans to individual athletes without back-and-forth." },
  { title: "Pay-per-athlete billing", desc: "Base plan includes 25 athletes. Add more for $4/month each." },
];

const WHY_ITEMS = [
  { title: "Injury risk detection before you feel it", desc: "Thrive monitors your mileage, load, and training patterns to estimate injury risk after every session — so you can back off before a real injury hits." },
  { title: "Automatic sync with Strava", desc: "Connect once and every run, ride, or workout imports automatically. Zero manual logging, zero missed sessions." },
  { title: "Training plans built around your real fitness", desc: "Your plan adapts each week based on how your body is actually responding — not a fixed PDF template that ignores your progress." },
  { title: "A direct line between athlete and coach", desc: "Coaches see every athlete's load, risk, and progress in real time. No more back-and-forth texts. No more guesswork." },
];

const BECOME_ITEMS = [
  { title: "Connect in minutes", desc: "Link your Strava account and Thrive imports your full training history instantly." },
  { title: "Know your risk", desc: "Your injury risk score is calculated from your first session and updated after every run." },
  { title: "Follow your plan", desc: "Get a personalised training plan that adapts each week to your fitness and goals." },
  { title: "Chat with AveraAI", desc: "Ask anything about your training, recovery, or race strategy — any time of day." },
];

const STRIPE_IMAGES = [
  { src: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&q=80&auto=format&fit=crop", alt: "Runners training" },
  { src: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=80&auto=format&fit=crop", alt: "Runner at sunrise" },
  { src: "https://images.unsplash.com/photo-1486218119243-13883505764c?w=600&q=80&auto=format&fit=crop", alt: "Athletes on track" },
  { src: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&q=80&auto=format&fit=crop", alt: "Runner outdoors" },
];

const WRAP = "max-w-[1180px] mx-auto px-[clamp(20px,4vw,32px)]";
const SEC = "py-[clamp(56px,8vw,112px)]";

const eyebrowStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  margin: "0 0 16px",
};

const h2Style: React.CSSProperties = {
  fontFamily: "'Syne', sans-serif",
  fontWeight: 700,
  fontSize: "clamp(28px,4.4vw,52px)",
  lineHeight: 1.08,
  letterSpacing: "-0.02em",
  color: "#F5F5F5",
  margin: "0 0 20px",
};

const subStyle: React.CSSProperties = {
  color: "#8A9287",
  fontSize: "clamp(15px,1.6vw,18px)",
  lineHeight: 1.65,
  margin: 0,
};

function BtnTeal({ onClick, children, style }: { onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif", fontWeight: 600, border: "none",
        cursor: "pointer", borderRadius: "10px", fontSize: "16px",
        padding: "15px 30px", background: "#3D7A74", color: "#fff",
        boxShadow: "0 14px 30px -12px rgba(61,122,116,0.6)",
        transition: "background .2s",
        ...style,
      }}
      onMouseOver={e => (e.currentTarget.style.background = "#2A504C")}
      onMouseOut={e => (e.currentTarget.style.background = "#3D7A74")}
    >
      {children}
    </button>
  );
}

function BtnGhost({ onClick, children, style }: { onClick?: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', sans-serif", fontWeight: 600,
        border: "1px solid rgba(242,210,207,0.45)", cursor: "pointer",
        borderRadius: "10px", fontSize: "15px", padding: "14px 28px",
        background: "transparent", color: "#F2D2CF",
        transition: "background .2s",
        ...style,
      }}
      onMouseOver={e => (e.currentTarget.style.background = "rgba(242,210,207,0.10)")}
      onMouseOut={e => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

function NumList({ items, accent }: { items: { title: string; desc: string }[]; accent: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "clamp(20px,3vw,28px)", marginTop: "8px" }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <div key={item.title} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
            <div style={{
              flexShrink: 0, width: "34px", height: "34px", borderRadius: "9999px",
              border: `2px solid ${isLast ? accent : "#28322f"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'JetBrains Mono', monospace", fontSize: "14px",
              color: isLast ? accent : "#8A9287", marginTop: "2px",
            }}>
              {i + 1}
            </div>
            <div>
              <p style={{
                fontWeight: 600, color: "#F5F5F5", fontSize: "clamp(16px,2vw,18px)",
                margin: "0 0 6px",
                textDecoration: isLast ? "underline" : "none",
                textDecorationColor: isLast ? accent : "transparent",
                textUnderlineOffset: "4px",
              }}>
                {item.title}
              </p>
              <p style={{ color: "#8A9287", fontSize: "15px", lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DeviceFrame({ src, alt, maxWidth = 480, style }: { src: string; alt: string; maxWidth?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: "18px", border: "1px solid #182220", background: "#0C0F1A",
      padding: "8px", boxShadow: "0 30px 60px -28px rgba(0,0,0,0.75)",
      maxWidth: `${maxWidth}px`, width: "100%",
      ...style,
    }}>
      <img src={src} alt={alt} style={{ width: "100%", height: "auto", borderRadius: "12px", display: "block" }} />
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setCurrentIndex(i => (i + 1) % REVIEWS.length), 9000);
    return () => clearInterval(iv);
  }, []);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: "smooth" });
    setMenuOpen(false);
  }

  const navLinks: [string, string][] = [
    ["For Athletes", "athletes"],
    ["For Coaches", "coaches"],
    ["Features", "features"],
    ["FAQ", "faq"],
  ];

  return (
    <div style={{ background: "#06070E", overflowX: "hidden" }}>

      {/* NAVBAR */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: scrolled ? "rgba(6,7,14,0.95)" : "rgba(6,7,14,0.85)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid #182220",
        boxShadow: scrolled ? "0 4px 24px -8px rgba(0,0,0,0.5)" : "none",
        transition: "background .2s, box-shadow .2s",
      }}>
        <div className={WRAP} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "68px" }}>
          <button onClick={() => scrollTo("top")} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <img src="/logo.svg" alt="Thrive" style={{ width: "30px", height: "30px", borderRadius: "8px" }} />
            <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "21px", letterSpacing: "-0.02em", color: "#F5F5F5" }}>Thrive</span>
          </button>
          <nav className="hidden lg:flex" style={{ alignItems: "center", gap: "34px" }}>
            {navLinks.map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "#8A9287", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color .2s" }}
                onMouseOver={e => (e.currentTarget.style.color = "#F5F5F5")}
                onMouseOut={e => (e.currentTarget.style.color = "#8A9287")}
              >{label}</button>
            ))}
          </nav>
          <div className="hidden lg:flex" style={{ alignItems: "center", gap: "18px" }}>
            <button onClick={() => navigate("/sign-in")} style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "#8A9287", fontWeight: 500, background: "none", border: "none", cursor: "pointer", transition: "color .2s" }}
              onMouseOver={e => (e.currentTarget.style.color = "#F5F5F5")}
              onMouseOut={e => (e.currentTarget.style.color = "#8A9287")}
            >Log in</button>
            <BtnTeal onClick={() => navigate("/sign-up")} style={{ padding: "9px 18px", fontSize: "14px", boxShadow: "none" }}>Get Started</BtnTeal>
          </div>
          <div className="flex lg:hidden" style={{ alignItems: "center", gap: "12px" }}>
            <BtnTeal onClick={() => navigate("/sign-up")} style={{ padding: "9px 16px", fontSize: "14px", boxShadow: "none" }}>Get Started</BtnTeal>
            <button onClick={() => setMenuOpen(o => !o)} style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: "5px", width: "42px", height: "42px", alignItems: "center", background: "none", border: "none", cursor: "pointer" }}>
              <span style={{ width: "22px", height: "2px", background: "#F5F5F5", borderRadius: "2px" }} />
              <span style={{ width: "22px", height: "2px", background: "#F5F5F5", borderRadius: "2px" }} />
              <span style={{ width: "22px", height: "2px", background: "#F5F5F5", borderRadius: "2px" }} />
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="lg:hidden" style={{ display: "flex", flexDirection: "column", gap: "6px", background: "#06070E", borderTop: "1px solid #182220", padding: "18px clamp(20px,4vw,32px) 26px" }}>
            {navLinks.map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ textAlign: "left", color: "#F5F5F5", fontSize: "16px", fontWeight: 500, padding: "12px 0", background: "none", border: "none", borderBottom: "1px solid #182220", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>{label}</button>
            ))}
            <button onClick={() => { navigate("/sign-in"); setMenuOpen(false); }} style={{ width: "100%", color: "#fff", fontWeight: 600, padding: "12px", border: "1px solid #182220", borderRadius: "10px", marginTop: "14px", background: "none", cursor: "pointer", fontSize: "15px", fontFamily: "'Inter', sans-serif" }}>Log in</button>
            <BtnTeal onClick={() => { navigate("/sign-up"); setMenuOpen(false); }} style={{ width: "100%", boxShadow: "none", paddingTop: "12px", paddingBottom: "12px" }}>Get Started Free</BtnTeal>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" style={{ position: "relative", overflow: "hidden", background: "#06070E" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 55% 60% at 78% 50%,rgba(42,80,76,0.20) 0%,transparent 64%)" }} />
        <div className={`${WRAP} ${SEC}`} style={{ position: "relative" }}>
          <div className="flex flex-col lg:flex-row lg:items-center" style={{ gap: "clamp(40px,5vw,64px)" }}>
            <div style={{ width: "100%", flex: "0 0 auto" }} className="lg:w-[52%]">
              <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", background: "#0C0F1A", border: "1px solid #182220", borderRadius: "9999px", padding: "8px 16px", marginBottom: "28px" }}>
                <span style={{ color: "#3D7A74", letterSpacing: "2px", fontSize: "13px" }}>★★★★★</span>
                <span style={{ color: "#8A9287", fontSize: "13px" }}>Validated by 70+ athletes & coaches before launch</span>
              </div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(40px,7vw,72px)", lineHeight: 1.04, letterSpacing: "-0.03em", color: "#F5F5F5", margin: "0 0 22px" }}>
                Take your training<br />to the <span style={{ color: "#3D7A74" }}>next level</span>
              </h1>
              <p style={{ ...subStyle, maxWidth: "30rem", marginBottom: "32px" }}>
                Get the coaching support you need as a runner. AI-powered training plans, automatic injury risk detection, and a direct line to your coach — all in one place.
              </p>
              <BtnTeal onClick={() => navigate("/sign-up")}>Get Started Free</BtnTeal>
              <p style={{ color: "#8A9287", fontSize: "14px", margin: "16px 0 0" }}>First month free. Cancel anytime.</p>
            </div>
            <div style={{ width: "100%", position: "relative", flex: "0 0 auto" }} className="lg:w-[44%]">
              <div style={{ position: "absolute", inset: "-10% -8%", zIndex: 0, background: "rgba(42,80,76,0.20)", filter: "blur(64px)", borderRadius: "9999px" }} />
              <div style={{ position: "relative", zIndex: 1, borderRadius: "18px", border: "1px solid rgba(255,255,255,0.10)", background: "#0C0F1A", padding: "10px", boxShadow: "0 36px 70px -28px rgba(0,0,0,0.75)" }}>
                <div style={{ display: "flex", gap: "7px", padding: "6px 8px 12px" }}>
                  <span style={{ width: "11px", height: "11px", borderRadius: "9999px", background: "#E5564D" }} />
                  <span style={{ width: "11px", height: "11px", borderRadius: "9999px", background: "#E6B450" }} />
                  <span style={{ width: "11px", height: "11px", borderRadius: "9999px", background: "#3D7A74" }} />
                </div>
                <img src="/homepage-screen.png" alt="Thrive training dashboard" style={{ width: "100%", height: "auto", borderRadius: "11px", border: "1px solid rgba(255,255,255,0.06)", display: "block" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOR ATHLETES */}
      <section id="athletes" style={{ position: "relative", overflow: "hidden", background: "#0C0F1A", borderTop: "1px solid #182220" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 65% 50% at 50% 0%,rgba(42,80,76,0.20) 0%,transparent 70%)" }} />
        <div className={`${WRAP} ${SEC}`} style={{ position: "relative" }}>
          <div className="flex flex-col lg:flex-row lg:items-center" style={{ gap: "clamp(40px,5vw,64px)" }}>
            <div style={{ flex: 1 }}>
              <p style={{ ...eyebrowStyle, color: "#3D7A74" }}>For Athletes</p>
              <h2 style={h2Style}>Your personal training intelligence layer.</h2>
              <p style={{ ...subStyle, maxWidth: "34rem", marginBottom: "14px" }}>
                Whether you're a high school sprinter or a first-time 5K runner, Thrive gives you the tools that used to be reserved for elite athletes. Log your runs, understand your data, and train with a plan that evolves as you do.
              </p>
              <NumList items={ATHLETE_FEATURES} accent="#3D7A74" />
              <BtnTeal onClick={() => navigate("/sign-up?role=athlete")} style={{ marginTop: "34px" }}>Start for free</BtnTeal>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ borderRadius: "18px", border: "1px solid #182220", background: "#06070E", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 30px 60px -28px rgba(0,0,0,0.7)" }}>
                <div style={{ borderRadius: "14px", border: "1px solid #182220", background: "#0C0F1A", padding: "16px" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#8A9287", margin: "0 0 10px" }}>This week</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                    <div>
                      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "26px", color: "#F5F5F5", margin: 0 }}>42.3 km</p>
                      <p style={{ color: "#3D7A74", fontSize: "13px", margin: "4px 0 0" }}>↑ 12% vs last week</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "26px", color: "#F5F5F5", margin: 0 }}>5</p>
                      <p style={{ color: "#8A9287", fontSize: "13px", margin: "4px 0 0" }}>runs</p>
                    </div>
                  </div>
                </div>
                <div style={{ borderRadius: "14px", border: "1px solid #182220", background: "#0C0F1A", padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <p style={{ fontSize: "14px", fontWeight: 500, color: "#F5F5F5", margin: 0 }}>Injury Risk</p>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#5fbf8a", background: "rgba(95,191,138,0.10)", border: "1px solid rgba(95,191,138,0.22)", padding: "2px 9px", borderRadius: "9999px" }}>LOW</span>
                  </div>
                  <div style={{ marginTop: "12px", height: "8px", borderRadius: "9999px", background: "#182220" }}>
                    <div style={{ height: "8px", borderRadius: "9999px", background: "#3D7A74", width: "25%" }} />
                  </div>
                </div>
                <div style={{ borderRadius: "14px", border: "1px solid rgba(242,210,207,0.22)", background: "rgba(242,210,207,0.05)", padding: "16px" }}>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.18em", textTransform: "uppercase", color: "#F2D2CF", margin: "0 0 8px" }}>AveraAI</p>
                  <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#F5F5F5", margin: 0 }}>"Your long run pace yesterday was 8% above your aerobic threshold. I'd recommend an easy 5k tomorrow."</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOR COACHES */}
      <section id="coaches" style={{ position: "relative", overflow: "hidden", background: "#06070E" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 55% 45% at 95% 100%,rgba(242,210,207,0.10) 0%,transparent 65%)" }} />
        <div className={`${WRAP} ${SEC}`} style={{ position: "relative" }}>
          <div className="flex flex-col lg:flex-row-reverse lg:items-center" style={{ gap: "clamp(40px,5vw,64px)" }}>
            <div style={{ flex: 1 }}>
              <p style={{ ...eyebrowStyle, color: "#F2D2CF" }}>For Coaches</p>
              <h2 style={h2Style}>Manage your whole team. No spreadsheets.</h2>
              <p style={{ ...subStyle, maxWidth: "34rem", marginBottom: "14px" }}>
                Thrive gives coaches the bird's-eye view they've never had: every athlete's weekly mileage, injury risk score, and training load in a single dashboard. Catch overtraining before it becomes a DNS. Scale from 5 athletes to 50 without losing the personal touch.
              </p>
              <NumList items={COACH_FEATURES} accent="#F2D2CF" />
              <BtnGhost onClick={() => navigate("/sign-up?role=coach")} style={{ marginTop: "34px" }}>Add your team</BtnGhost>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ borderRadius: "18px", border: "1px solid #182220", background: "#0C0F1A", overflow: "hidden", boxShadow: "0 30px 60px -28px rgba(0,0,0,0.7)" }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #182220", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: "14px", fontWeight: 600, color: "#F5F5F5", margin: 0 }}>Team Overview</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#8A9287", margin: 0 }}>Week of Jun 23</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr 1fr", padding: "10px 18px", borderBottom: "1px solid #182220" }}>
                  {["Athlete", "Mileage", "Risk", "Load"].map(h => (
                    <span key={h} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "#8A9287" }}>{h}</span>
                  ))}
                </div>
                {[
                  { name: "Maria G.", km: "38 km", risk: "LOW", riskColor: "#5fbf8a", riskBg: "rgba(95,191,138,0.10)", load: "60%", loadColor: "#3D7A74", highlight: false },
                  { name: "Jake T. ⚠", km: "67 km", risk: "HIGH", riskColor: "#E5564D", riskBg: "rgba(229,62,62,0.10)", load: "100%", loadColor: "#E53E3E", highlight: true },
                  { name: "Sofia R.", km: "29 km", risk: "LOW", riskColor: "#5fbf8a", riskBg: "rgba(95,191,138,0.10)", load: "35%", loadColor: "#3D7A74", highlight: false },
                ].map((row, i, arr) => (
                  <div key={row.name} style={{
                    display: "grid", gridTemplateColumns: "1.4fr 1fr 0.9fr 1fr", alignItems: "center",
                    padding: "14px 18px",
                    borderBottom: i < arr.length - 1 ? "1px solid #182220" : "none",
                    background: row.highlight ? "rgba(229,62,62,0.06)" : "transparent",
                    borderLeft: row.highlight ? "2px solid #E53E3E" : "none",
                  }}>
                    <span style={{ fontSize: "14px", color: "#F5F5F5" }}>{row.name}</span>
                    <span style={{ fontSize: "14px", color: "#F5F5F5" }}>{row.km}</span>
                    <span><span style={{ fontSize: "11px", color: row.riskColor, background: row.riskBg, padding: "2px 8px", borderRadius: "9999px" }}>{row.risk}</span></span>
                    <span>
                      <div style={{ height: "6px", width: "80px", borderRadius: "9999px", background: "#182220" }}>
                        <div style={{ height: "6px", borderRadius: "9999px", background: row.loadColor, width: row.load }} />
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
      <section id="features" style={{ background: "#0C0F1A", borderTop: "1px solid #182220" }}>
        <div className={`${WRAP} ${SEC}`}>
          <h2 style={{ ...h2Style, textAlign: "center", maxWidth: "18ch", marginLeft: "auto", marginRight: "auto" }}>Train with data that actually matters</h2>
          <p style={{ ...subStyle, textAlign: "center", maxWidth: "38rem", margin: "0 auto 56px" }}>
            See exactly what your training is doing to your body — before it becomes an injury, a plateau, or a missed race.
          </p>
          {/* Mobile horizontal scroll */}
          <div className="lg:hidden" style={{ marginLeft: "calc(-1 * clamp(20px,4vw,32px))", marginRight: "calc(-1 * clamp(20px,4vw,32px))", paddingLeft: "clamp(20px,4vw,32px)", paddingRight: "clamp(20px,4vw,32px)", overflowX: "auto", display: "flex", gap: "18px", paddingBottom: "10px", scrollSnapType: "x mandatory", scrollbarWidth: "none" }}>
            {[
              { content: <FeatureDashboardCard />, caption: "Connect Strava and see your weekly distance, injury risk, and training load the moment you log in." },
              { content: <FeatureActivityCard />, caption: "Dive into any run — pace, heart rate, elevation, and cadence — pulled automatically from Strava." },
              { content: <FeaturePlanCard />, caption: "Your personalised training plan updates every week based on your logged workouts, fitness, and goals." },
            ].map((card, i) => (
              <div key={i} style={{ flexShrink: 0, width: "80vw", scrollSnapAlign: "start", display: "flex", flexDirection: "column", gap: "14px" }}>
                {card.content}
                <p style={{ fontSize: "14px", color: "#8A9287", textAlign: "center", margin: 0, padding: "0 6px", lineHeight: 1.55 }}>{card.caption}</p>
              </div>
            ))}
          </div>
          {/* Desktop 3-col grid */}
          <div className="hidden lg:grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "32px" }}>
            {[
              { content: <FeatureDashboardCard />, caption: "Connect Strava and see your weekly distance, injury risk, and training load the moment you log in." },
              { content: <FeatureActivityCard />, caption: "Dive into any run — pace, heart rate, elevation, and cadence — pulled automatically from Strava." },
              { content: <FeaturePlanCard />, caption: "Your personalised training plan updates every week based on your logged workouts, fitness, and goals." },
            ].map((card, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {card.content}
                <p style={{ fontSize: "14px", color: "#8A9287", textAlign: "center", margin: 0, padding: "0 6px", lineHeight: 1.55 }}>{card.caption}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "48px" }}>
            <BtnTeal onClick={() => navigate("/sign-up")}>Get Started Free</BtnTeal>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section style={{ background: "#06070E" }}>
        <div className={`${WRAP} ${SEC}`}>
          <div className="flex flex-col lg:flex-row" style={{ borderRadius: "18px", overflow: "hidden" }}>
            <div className="lg:w-[45%]" style={{ background: "#2A504C", padding: "clamp(32px,4vw,56px)" }}>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(28px,4.4vw,52px)", lineHeight: 1.08, color: "#fff", margin: "0 0 34px" }}>Reviews from users</h2>
              <div style={{ marginBottom: "32px" }}>
                <div style={{ display: "flex", gap: "3px", marginBottom: "8px", color: "#fff", fontSize: "22px" }}>★★★★★</div>
                <p style={{ color: "rgba(255,255,255,0.92)", fontWeight: 600, fontSize: "18px", margin: 0 }}>70+ beta users</p>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", margin: "4px 0 0" }}>Athletes and coaches validated Thrive before launch</p>
              </div>
              <div>
                <div style={{ display: "flex", gap: "3px", marginBottom: "8px", color: "#fff", fontSize: "18px" }}>★★★★★</div>
                <p style={{ color: "rgba(255,255,255,0.92)", fontWeight: 600, fontSize: "16px", margin: 0 }}>100% would recommend</p>
                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", margin: "4px 0 0" }}>to a teammate or fellow runner</p>
              </div>
            </div>
            <div className="lg:w-[55%]" style={{ background: "#0C0F1A", padding: "clamp(32px,4vw,56px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div key={currentIndex} style={{ borderLeft: "4px solid #3D7A74", paddingLeft: "24px" }}>
                <p style={{ color: "#F5F5F5", fontSize: "clamp(17px,2vw,21px)", fontStyle: "italic", lineHeight: 1.6, margin: "0 0 26px" }}>"{REVIEWS[currentIndex].quote}"</p>
                <p style={{ color: "#fff", fontWeight: 600, margin: 0 }}>{REVIEWS[currentIndex].author}</p>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "40px" }}>
                {REVIEWS.map((_, i) => (
                  <button key={i} onClick={() => setCurrentIndex(i)} style={{ height: "4px", borderRadius: "9999px", border: "none", cursor: "pointer", padding: 0, transition: "all .3s", width: i === currentIndex ? "32px" : "8px", background: i === currentIndex ? "#3D7A74" : "#182220" }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY USE THRIVE */}
      <section style={{ position: "relative", overflow: "hidden", background: "#06070E", borderTop: "1px solid #182220" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 45% at 12% 50%,rgba(42,80,76,0.16) 0%,transparent 64%)" }} />
        <div className={`${WRAP} ${SEC}`} style={{ position: "relative" }}>
          <div className="flex flex-col lg:flex-row lg:items-center" style={{ gap: "clamp(40px,5vw,64px)" }}>
            <div className="lg:w-[45%]" style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <div style={{ position: "absolute", width: "72%", height: "72%", top: "14%", borderRadius: "9999px", background: "rgba(42,80,76,0.16)", filter: "blur(60px)" }} />
              <DeviceFrame src="/homepage-screen.png" alt="Thrive dashboard" maxWidth={480} style={{ position: "relative" }} />
            </div>
            <div className="lg:w-[55%]">
              <h2 style={{ ...h2Style, fontSize: "clamp(30px,5vw,60px)", marginBottom: "32px" }}>Why use Thrive?</h2>
              <NumList items={WHY_ITEMS} accent="#3D7A74" />
            </div>
          </div>
        </div>
      </section>

      {/* IMAGE STRIPE */}
      <div className="lg:hidden" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {STRIPE_IMAGES.map(img => (
          <img key={img.src} src={img.src} alt={img.alt} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} />
        ))}
      </div>
      <div className="hidden lg:flex" style={{ width: "100%", height: "224px", overflow: "hidden" }}>
        {STRIPE_IMAGES.map(img => (
          <img key={img.src} src={img.src} alt={img.alt} style={{ height: "100%", width: "auto", objectFit: "cover", flexShrink: 0, display: "block" }} />
        ))}
      </div>

      {/* BECOME A THRIVE ATHLETE */}
      <section style={{ background: "#0C0F1A" }}>
        <div className={`${WRAP} ${SEC}`}>
          <div className="flex flex-col lg:flex-row lg:items-center" style={{ gap: "clamp(40px,5vw,64px)" }}>
            <div className="lg:w-[60%]">
              <h2 style={{ ...h2Style, marginBottom: "30px" }}>Become a Thrive athlete</h2>
              <NumList items={BECOME_ITEMS} accent="#3D7A74" />
            </div>
            <div className="lg:w-[40%]" style={{ display: "flex", justifyContent: "center" }}>
              <DeviceFrame src="/homepage-screen.png" alt="Thrive app" maxWidth={520} />
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background: "#06070E", borderTop: "1px solid #182220" }}>
        <div className={`${WRAP} ${SEC}`}>
          <h2 style={{ ...h2Style, textAlign: "center" }}>Simple, fair pricing</h2>
          <p style={{ ...subStyle, textAlign: "center" }}>Pay for what you use. No annual lock-in.</p>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: "22px", maxWidth: "900px", margin: "clamp(40px,5vw,56px) auto 0" }}>
            <div style={{ display: "flex", flexDirection: "column", background: "#0C0F1A", borderRadius: "24px", padding: "clamp(28px,3.2vw,42px)", border: "1px solid rgba(61,122,116,0.30)", boxShadow: "0 0 60px -28px rgba(61,122,116,0.45),0 30px 60px -34px rgba(0,0,0,0.75)" }}>
              <p style={{ ...eyebrowStyle, color: "#3D7A74", marginBottom: "18px" }}>For Athletes</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "26px" }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(46px,6vw,64px)", lineHeight: 1, color: "#F5F5F5" }}>$10</span>
                <span style={{ color: "#8A9287", fontSize: "18px", marginBottom: "9px" }}>/ month</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {["Strava sync", "AveraAI (unlimited)", "Injury risk scoring", "Personalised plans"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ color: "#3D7A74", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span style={{ color: "#F5F5F5", fontSize: "clamp(15px,1.6vw,16px)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{ height: "36px", flexShrink: 0 }} />
              <BtnTeal onClick={() => navigate("/sign-up?role=athlete")} style={{ width: "100%", marginTop: "auto", paddingTop: "15px", paddingBottom: "15px", boxShadow: "none" }}>Get started</BtnTeal>
            </div>
            <div style={{ display: "flex", flexDirection: "column", background: "#0C0F1A", borderRadius: "24px", padding: "clamp(28px,3.2vw,42px)", border: "1px solid rgba(242,210,207,0.24)", boxShadow: "0 0 60px -30px rgba(242,210,207,0.30),0 30px 60px -34px rgba(0,0,0,0.75)" }}>
              <p style={{ ...eyebrowStyle, color: "#F2D2CF", marginBottom: "18px" }}>For Coaches</p>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(46px,6vw,64px)", lineHeight: 1, color: "#F5F5F5" }}>$100</span>
                <span style={{ color: "#8A9287", fontSize: "18px", marginBottom: "9px" }}>/ month</span>
              </div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: "#8A9287", margin: "0 0 24px" }}>+ $4 per athlete above 25</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {["Up to 25 athletes", "Team roster + workload dashboard", "Automated injury alerts", "Per-athlete plan assignment", "Stripe billing"].map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ color: "#F2D2CF", fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span style={{ color: "#F5F5F5", fontSize: "clamp(15px,1.6vw,16px)" }}>{f}</span>
                  </div>
                ))}
              </div>
              <BtnGhost onClick={() => navigate("/sign-up?role=coach")} style={{ width: "100%", marginTop: "36px", paddingTop: "15px", paddingBottom: "15px" }}>Add your team</BtnGhost>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: "#06070E", borderTop: "1px solid #182220" }}>
        <div className={`${WRAP} ${SEC}`}>
          <div className="flex flex-col lg:flex-row lg:items-start" style={{ gap: "clamp(32px,4vw,48px)" }}>
            <div className="lg:w-[34%]">
              <h2 style={{ ...h2Style, margin: 0 }}>FAQ: Everything you need to know about training with Thrive</h2>
            </div>
            <div className="lg:w-[60%]" style={{ flexGrow: 1 }}>
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} style={{ borderTop: "1px solid #182220" }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "20px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "'Inter', sans-serif" }}>
                    <span style={{ fontWeight: 500, fontSize: "clamp(15px,1.7vw,17px)", color: "#F5F5F5" }}>{item.q}</span>
                    <ChevronDown style={{ width: "20px", height: "20px", color: "#8A9287", flexShrink: 0, transition: "transform .2s", transform: openFaq === i ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </button>
                  {openFaq === i && (
                    <p style={{ color: "#8A9287", fontSize: "15px", lineHeight: 1.65, margin: 0, padding: "0 0 22px", maxWidth: "46rem" }}>{item.a}</p>
                  )}
                </div>
              ))}
              <div style={{ borderTop: "1px solid #182220" }} />
            </div>
          </div>
        </div>
      </section>

      {/* EMAIL CAPTURE + FINAL CTA */}
      <section id="cta" style={{ position: "relative", overflow: "hidden", background: "#0C0F1A" }}>
        <div className={WRAP} style={{ paddingTop: "clamp(48px,7vw,88px)" }}>
          <div style={{ background: "#2A504C", borderRadius: "20px", padding: "clamp(28px,4vw,56px)" }}>
            <div className="flex flex-col lg:flex-row lg:items-center" style={{ gap: "clamp(28px,5vw,72px)" }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(24px,3.4vw,40px)", lineHeight: 1.1, color: "#fff", margin: "0 0 12px" }}>
                  Get training tips & injury prevention insights in your inbox.
                </h2>
                <p style={{ color: "rgba(255,255,255,0.72)", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>
                  Join athletes and coaches getting smarter every week. Unsubscribe anytime. We respect your privacy.
                </p>
              </div>
              <div style={{ flex: 1 }}>
                {submitted ? (
                  <p style={{ color: "#fff", fontSize: "18px", fontWeight: 600, margin: 0 }}>You're in! We'll be in touch soon.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email address" style={{ width: "100%", padding: "14px 16px", borderRadius: "10px", border: "none", background: "#fff", color: "#06070E", fontSize: "15px", fontFamily: "'Inter', sans-serif", outline: "none", boxSizing: "border-box" }} />
                    <button onClick={() => setSubmitted(true)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", fontWeight: 600, border: "none", cursor: "pointer", borderRadius: "10px", fontSize: "15px", padding: "14px 20px", background: "#06070E", color: "#fff", transition: "background .2s" }}
                      onMouseOver={e => (e.currentTarget.style.background = "#0C0F1A")}
                      onMouseOut={e => (e.currentTarget.style.background = "#06070E")}
                    >Sign up</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%", pointerEvents: "none", background: "radial-gradient(ellipse 50% 80% at 50% 120%,rgba(42,80,76,0.20) 0%,transparent 65%)" }} />
        <div className={`${WRAP} ${SEC}`} style={{ position: "relative" }}>
          <div className="flex flex-col lg:flex-row lg:items-center" style={{ gap: "clamp(40px,5vw,64px)" }}>
            <div className="lg:w-[45%]" style={{ position: "relative", display: "flex", justifyContent: "center" }}>
              <div style={{ position: "absolute", width: "78%", height: "70%", top: "15%", borderRadius: "9999px", background: "rgba(42,80,76,0.18)", filter: "blur(60px)" }} />
              <DeviceFrame src="/homepage-screen.png" alt="Thrive app" maxWidth={500} style={{ position: "relative", border: "1px solid rgba(255,255,255,0.10)", background: "#06070E", boxShadow: "0 36px 70px -28px rgba(0,0,0,0.8)" }} />
            </div>
            <div className="lg:w-[55%]">
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(34px,5.5vw,60px)", lineHeight: 1.04, letterSpacing: "-0.03em", color: "#F5F5F5", margin: "0 0 24px" }}>
                Take your training to the <span style={{ color: "#3D7A74" }}>next level</span>
              </h2>
              <p style={{ ...subStyle, maxWidth: "30rem", marginBottom: "30px" }}>
                Your personalised training platform with AI-powered coaching, automatic injury risk detection, and direct coach-athlete connection — all in one place.
              </p>
              <BtnTeal onClick={() => navigate("/sign-up")}>Get Started Free</BtnTeal>
              <p style={{ color: "#8A9287", fontSize: "14px", margin: "16px 0 0" }}>First month free. Cancel anytime.</p>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#0C0F1A", borderTop: "1px solid #182220" }}>
        <div className={WRAP} style={{ paddingTop: "56px", paddingBottom: "40px" }}>
          <div className="flex flex-col lg:flex-row lg:justify-between" style={{ gap: "36px" }}>
            <div style={{ maxWidth: "280px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <img src="/logo.svg" alt="Thrive" style={{ width: "28px", height: "28px", borderRadius: "8px" }} />
                <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "19px", color: "#F5F5F5" }}>Thrive</span>
              </div>
              <p style={{ color: "#8A9287", fontSize: "14px", lineHeight: 1.6, margin: 0 }}>AI-powered training for runners and coaches.</p>
            </div>
            <div style={{ display: "flex", gap: "64px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8A9287", margin: "0 0 4px" }}>Product</p>
                {navLinks.map(([label, id]) => (
                  <button key={id} onClick={() => scrollTo(id)} style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "#8A9287", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", transition: "color .2s" }}
                    onMouseOver={e => (e.currentTarget.style.color = "#F5F5F5")}
                    onMouseOut={e => (e.currentTarget.style.color = "#8A9287")}
                  >{label}</button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8A9287", margin: "0 0 4px" }}>Company</p>
                {["Privacy Policy", "Terms of Service", "Contact"].map(label => (
                  <a key={label} href="#" style={{ fontSize: "14px", color: "#8A9287", textDecoration: "none", fontWeight: 500 }}
                    onMouseOver={e => (e.currentTarget.style.color = "#F5F5F5")}
                    onMouseOut={e => (e.currentTarget.style.color = "#8A9287")}
                  >{label}</a>
                ))}
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid #182220", marginTop: "40px", paddingTop: "24px", textAlign: "center" }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#8A9287", margin: 0 }}>© 2026 Thrive · Made for runners.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}

// Feature card sub-components

function FeatureCardShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: "22px", border: "1px solid #182220", background: "#06070E", padding: "18px", aspectRatio: "9/16", display: "flex", flexDirection: "column", gap: "12px" }}>
      {children}
    </div>
  );
}

function FeatureDashboardCard() {
  return (
    <FeatureCardShell>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#8A9287", margin: 0 }}>Dashboard · Jun 25</p>
      <div style={{ borderRadius: "14px", background: "#0C0F1A", border: "1px solid #182220", padding: "14px" }}>
        <p style={{ fontSize: "12px", color: "#8A9287", margin: "0 0 4px" }}>Weekly Distance</p>
        <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "26px", color: "#F5F5F5", margin: 0 }}>42.3 km</p>
        <p style={{ fontSize: "12px", color: "#3D7A74", margin: "6px 0 0" }}>↑ 12% vs last week</p>
      </div>
      <div style={{ borderRadius: "14px", background: "#0C0F1A", border: "1px solid #182220", padding: "14px" }}>
        <p style={{ fontSize: "12px", color: "#8A9287", margin: "0 0 4px" }}>Training Load</p>
        <p style={{ fontSize: "17px", fontWeight: 600, color: "#F5F5F5", margin: 0 }}>Moderate</p>
        <div style={{ marginTop: "10px", height: "6px", borderRadius: "9999px", background: "#182220" }}>
          <div style={{ height: "6px", borderRadius: "9999px", background: "#3D7A74", width: "55%" }} />
        </div>
      </div>
      <div style={{ borderRadius: "14px", background: "#0C0F1A", border: "1px solid #182220", padding: "14px" }}>
        <p style={{ fontSize: "12px", color: "#8A9287", margin: "0 0 8px" }}>Injury Risk</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, color: "#F5F5F5" }}>LOW</span>
          <span style={{ width: "9px", height: "9px", borderRadius: "9999px", background: "#5fbf8a" }} />
        </div>
      </div>
    </FeatureCardShell>
  );
}

function FeatureActivityCard() {
  const metrics = [["Distance", "11.02 mi"], ["Time", "1:40:38"], ["Avg Pace", "9:08/mi"], ["Avg HR", "151 bpm"], ["Cadence", "177 spm"], ["Elevation", "259 ft"]];
  return (
    <FeatureCardShell>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "9999px", background: "#3D7A74" }} />
        <span style={{ fontSize: "12px", color: "#3D7A74", fontWeight: 500 }}>Long Run · 11 mi</span>
      </div>
      <p style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "20px", color: "#F5F5F5", margin: 0 }}>Tuesday Morning Run</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
        {metrics.map(([label, val]) => (
          <div key={label} style={{ borderRadius: "10px", background: "#0C0F1A", border: "1px solid #182220", padding: "9px" }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", textTransform: "uppercase", color: "#8A9287", margin: 0 }}>{label}</p>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "#F5F5F5", margin: "2px 0 0" }}>{val}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: "auto", borderRadius: "12px", background: "#0C0F1A", border: "1px solid rgba(242,210,207,0.22)", padding: "12px" }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.16em", textTransform: "uppercase", color: "#F2D2CF", margin: "0 0 6px" }}>AveraAI insight</p>
        <p style={{ fontSize: "12px", lineHeight: 1.55, color: "#F5F5F5", margin: 0 }}>"Solid effort. Your pace was 6% faster than aerobic threshold — ease back tomorrow."</p>
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontWeight: 600, color: "#F5F5F5", margin: 0 }}>Marathon Plan</p>
        <p style={{ fontSize: "12px", color: "#8A9287", margin: 0 }}>Week 6 / 16</p>
      </div>
      <div style={{ height: "6px", borderRadius: "9999px", background: "#182220" }}>
        <div style={{ height: "6px", borderRadius: "9999px", background: "#3D7A74", width: "37.5%" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "2px" }}>
        {days.map(({ day, run, done }) => (
          <div key={day} style={{ display: "flex", alignItems: "center", gap: "12px", borderRadius: "10px", padding: "10px 12px", background: done ? "rgba(61,122,116,0.10)" : "#0C0F1A", border: `1px solid ${done ? "rgba(61,122,116,0.22)" : "#182220"}` }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#8A9287", width: "26px" }}>{day}</span>
            <span style={{ fontSize: "13px", color: "#F5F5F5", flex: 1 }}>{run}</span>
            {done && <span style={{ color: "#3D7A74", fontSize: "12px" }}>✓</span>}
          </div>
        ))}
      </div>
    </FeatureCardShell>
  );
}
