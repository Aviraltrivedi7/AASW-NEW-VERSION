// Design reminder: Human-first Civic Editorial — warm Indian civic palette, editorial rail, people-first storytelling, clear trust and action paths.
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Facebook,
  HandCoins,
  HeartHandshake,
  Instagram,
  Laptop2,
  Linkedin,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Sprout,
  Users,
  X,
} from "lucide-react";
import { PaymentDemoButton } from "@/components/PaymentDemoCheckout";
import { AboutMegaMenu, AboutMobileNav, ContactUsMegaMenu, ContactUsMobileNav, MediaCentreMegaMenu, MediaCentreMobileNav, WhatWeDoMegaMenu, WhatWeDoMobileNav } from "@/components/AboutMegaMenu";
import { LiveHomeGoalsAndMethodology } from "@/components/LiveContentPanels";
import { AASW_CONTACT } from "@shared/organisationContact";
import { DIRECT_HOME_PRIMARY_NAV_ITEMS } from "@shared/primaryNavigation";
import { MemberHeaderAccount } from "@/components/MemberHeaderAccount";
import { type ApprovedTestimonial, TestimonialsCarousel } from "@/components/TestimonialsCarousel";
import { AnimatedCounter, TrustStrip } from "@/components/TrustAndImpact";
import { FooterNewsletterForm } from "@/components/FooterNewsletterForm";

const programs = [
  {
    number: "01",
    icon: Laptop2,
    title: "Digital capability",
    text: "Training that makes digital tools feel usable — from e-commerce and social media to everyday online operations.",
    image: "/manus-storage/aasw-digital-skills_2dde7820.jpeg",
    imageAlt: "AASW digital skills session in Uttar Pradesh",
    tone: "green",
  },
  {
    number: "02",
    icon: Sprout,
    title: "Green enterprise",
    text: "Eco-conscious ideas and sustainable business practices that connect livelihood with care for the places we call home.",
    image: "/manus-storage/aasw-green-workshop_8f06b6fa.jpeg",
    imageAlt: "AASW women entrepreneurs at a green business workshop",
    tone: "ochre",
  },
  {
    number: "03",
    icon: Users,
    title: "Mentorship & community",
    text: "Peer learning, workshops and practical guidance for women building confidence, decisions and a support network.",
    image: "/manus-storage/aasw-community-mentorship_ffb5bf0b.jpeg",
    imageAlt: "AASW community gathering and mentorship session",
    tone: "ink",
  },
];

const supportOptions = [
  { amount: "₹1,100", amountInRupees: 1100, kind: "membership" as const, title: "Join for a year", copy: "A simple way to stand with the work." },
  { amount: "₹10,000", amountInRupees: 10000, kind: "membership" as const, title: "Become a lifetime member", copy: "Stay close to the mission for the long run." },
  { amount: "Custom", amountInRupees: 500, kind: "donation" as const, title: "Give what feels right", copy: "Tell us how you would like to contribute." },
];

// Add only verified, consented testimonials here after the Foundation supplies exact approved wording and attribution.
const approvedTestimonials: readonly ApprovedTestimonial[] = [];

function ScrollLink({ href, children, className = "", onClick }: { href: string; children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <a className={className} href={href} onClick={onClick}>
      {children}
    </a>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedSupport, setSelectedSupport] = useState("₹1,100");
  const [showTop, setShowTop] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > 520);
      setHeaderScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const selectedOption = supportOptions.find((option) => option.amount === selectedSupport) ?? supportOptions[0];

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="site-shell min-h-screen overflow-x-hidden">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className={`site-header ${headerScrolled ? "site-header-scrolled" : ""}`}>
        <div className="container flex items-center justify-between gap-6 py-4">
          <ScrollLink href="#top" className="brand-lockup" onClick={closeMenu}>
            <span className="brand-mark-wrap">
              <img src="/manus-storage/aasw-foundation-official-logo_41a4007d.png" alt="AASW Foundation official logo" className="brand-mark" decoding="async" />
            </span>
            <span className="brand-copy">
              <strong>AASW</strong>
              <span>Foundation</span>
            </span>
          </ScrollLink>

          <nav className="desktop-nav" aria-label="Primary navigation">
            <AboutMegaMenu onNavigate={closeMenu} />
            <WhatWeDoMegaMenu onNavigate={closeMenu} />
            <MediaCentreMegaMenu onNavigate={closeMenu} />
            <ContactUsMegaMenu onNavigate={closeMenu} />
            {DIRECT_HOME_PRIMARY_NAV_ITEMS.map((item) => (
              <ScrollLink key={item.href} href={item.href} className="nav-link">
                {item.label}
              </ScrollLink>
            ))}
          </nav>

          <div className="header-actions">
            <a className="header-contact" href={AASW_CONTACT.primaryPhoneHref} aria-label="Call AASW Foundation">
              <Phone size={15} />
              <span>{AASW_CONTACT.primaryPhoneDisplay}</span>
            </a>
            <MemberHeaderAccount />
            <ScrollLink href="#donate" className="button button-small button-ochre">
              Support the work <ArrowUpRight size={15} />
            </ScrollLink>
            <button className="menu-toggle" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen}>
              {menuOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>

        <div className={`mobile-nav ${menuOpen ? "mobile-nav-open" : ""}`}>
          <nav aria-label="Mobile navigation" className="container mobile-nav-inner">
            <AboutMobileNav onNavigate={closeMenu} />
            <WhatWeDoMobileNav onNavigate={closeMenu} />
            <MediaCentreMobileNav onNavigate={closeMenu} />
            <ContactUsMobileNav onNavigate={closeMenu} />
            {DIRECT_HOME_PRIMARY_NAV_ITEMS.map((item) => (
              <ScrollLink key={item.href} href={item.href} className="mobile-nav-link" onClick={closeMenu}>
                <span>{item.label}</span>
                <ArrowUpRight size={17} />
              </ScrollLink>
            ))}
            <MemberHeaderAccount mobile onNavigate={closeMenu} />
            <ScrollLink href="#donate" className="button button-ochre mobile-donate" onClick={closeMenu}>
              Support the work <ArrowUpRight size={16} />
            </ScrollLink>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section id="top" className="hero-section">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow" data-reveal><span className="eyebrow-dot" />A movement for capability</p>
              <h1 data-reveal data-reveal-delay="1">When women gain the tools, <em>a whole community moves.</em></h1>
              <p className="hero-intro" data-reveal data-reveal-delay="2">AASW Foundation works with women in Uttar Pradesh through digital education, eco-friendly enterprise and the kind of support that turns possibility into a practical next step.</p>
              <div className="hero-actions" data-reveal data-reveal-delay="3">
                <ScrollLink href="#programs" className="button button-primary">
                  See how we work <ArrowDownRight size={17} />
                </ScrollLink>
                <ScrollLink href="#about" className="text-link">
                  Why this matters <ArrowUpRight size={16} />
                </ScrollLink>
              </div>
              <div className="hero-proof" data-reveal data-reveal-delay="3">
                <div className="avatar-stack" aria-hidden="true">
                  <span className="avatar avatar-one" />
                  <span className="avatar avatar-two" />
                  <span className="avatar avatar-three" />
                </div>
                <p><strong>Built for the next step.</strong><br />A local foundation with a wider ambition.</p>
              </div>
            </div>

            <div className="hero-visual-wrap" data-reveal="right" data-reveal-delay="2">
              <div className="hero-chapter">01 / AASW FOUNDATION</div>
              <div className="hero-visual">
                <img src="/manus-storage/aasw-field-session_43c9b878.jpeg" alt="AASW women taking part in a capability-building field session" fetchPriority="high" decoding="async" />
                <div className="hero-image-overlay" />
                <div className="hero-caption">
                  <span>Field note</span>
                  <strong>Tools become choices when they are shared.</strong>
                </div>
                <span className="illustrative-tag">AASW field photo</span>
              </div>
              <div className="hero-note">
                <span className="sun-disc" />
                <p>Digital confidence.<br /><strong>Economic agency.</strong></p>
              </div>
            </div>
          </div>
          <div className="hero-bottom-rail container">
            <span>Scroll to follow the work</span>
            <span className="rail-line" />
            <span>01 — 06</span>
          </div>
        </section>

        <section className="impact-strip" aria-label="Impact snapshot">
          <div className="container impact-grid">
            <div className="impact-intro" data-reveal><span className="section-kicker">A snapshot</span><strong>The work in numbers</strong></div>
            <div className="impact-stat" data-reveal data-reveal-delay="1"><strong><AnimatedCounter target={800} suffix="+" /></strong><span>Women trained</span></div>
            <div className="impact-stat" data-reveal data-reveal-delay="2"><strong><AnimatedCounter target={300} suffix="+" /></strong><span>Businesses supported</span></div>
            <div className="impact-stat" data-reveal data-reveal-delay="3"><strong><AnimatedCounter target={2000} suffix="+" /></strong><span>Eco bags produced</span></div>
            <div className="impact-stat" data-reveal data-reveal-delay="3"><strong><AnimatedCounter target={5} suffix="+" /></strong><span>Districts reached</span></div>
          </div>
        </section>

        <TrustStrip />

        <section id="about" className="section section-paper about-section">
          <div className="container editorial-layout">
            <div className="section-rail"><span>02</span><span className="vertical-label">WHY AASW</span></div>
            <div className="about-heading" data-reveal>
              <p className="eyebrow"><span className="eyebrow-dot" />The reason we exist</p>
              <h2>Stronger women create a better world — socially, environmentally and financially.</h2>
              <ScrollLink href="#donate" className="text-link text-link-green">Stand with this work <ArrowUpRight size={16} /></ScrollLink>
            </div>
            <div className="about-copy" data-reveal data-reveal-delay="1">
              <p className="lead-copy">AASW was founded in 2021 to help close the gap between women and opportunity. The approach is simple: make knowledge practical, make support accessible, and make progress sustainable.</p>
              <p>From digital tools and business mentoring to environmental awareness and peer learning, the foundation creates pathways for women to become confident makers, earners and decision-makers.</p>
              <div className="about-note"><ShieldCheck size={19} /><span>Grounded in Uttar Pradesh. Open to a wider circle of supporters.</span></div>
            </div>
          </div>
          <div className="container field-note-grid">
            <div className="field-note-image" data-reveal="left">
              <img src="/manus-storage/aasw-women-learning_f22d8267.jpeg" alt="Women at an AASW empowerment and learning event in Uttar Pradesh" loading="lazy" decoding="async" />
              <span className="image-source-label">AASW field photo</span>
            </div>
            <div className="field-note-copy" data-reveal data-reveal-delay="1">
              <span className="section-kicker">A field note</span>
              <h3>Capability is not a single skill. It is the confidence to keep going.</h3>
              <p>That is why AASW's work connects learning with enterprise, environment with livelihood, and individual progress with the strength of a community.</p>
              <div className="mini-list">
                <div><span>01</span><strong>Learn</strong><p>Make new tools feel possible.</p></div>
                <div><span>02</span><strong>Build</strong><p>Turn skills into a next step.</p></div>
                <div><span>03</span><strong>Lead</strong><p>Take decisions with support.</p></div>
              </div>
            </div>
          </div>
        </section>

        <section id="programs" className="section section-sand programs-section">
          <div className="container section-heading-row">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" />Where the work happens</p>
              <h2>Practical support.<br /><em>Lasting agency.</em></h2>
            </div>
            <p className="section-heading-aside">AASW brings together digital education, enterprise, environmental care and a community of people who believe support should lead to more choices.</p>
          </div>
          <div className="container program-list">
            {programs.map((program) => {
              const Icon = program.icon;
              return (
                <article className={`program-row program-row-${program.tone}`} key={program.number} data-reveal>
                  <div className="program-meta"><span>{program.number}</span><Icon size={20} strokeWidth={1.7} /></div>
                  <div className="program-image-wrap">
                    <img src={program.image} alt={program.imageAlt} className="program-image" loading="lazy" decoding="async" />
                    <span className="illustrative-tag">AASW field photo</span>
                  </div>
                  <div className="program-content">
                    <h3>{program.title}</h3>
                    <p>{program.text}</p>
                    <ScrollLink href="#donate" className="text-link text-link-green">Support this pathway <ArrowUpRight size={15} /></ScrollLink>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section section-ink pathway-section">
          <div className="container pathway-layout">
            <div className="pathway-heading" data-reveal>
              <p className="eyebrow eyebrow-light"><span className="eyebrow-dot eyebrow-dot-light" />How support travels</p>
              <h2>From one practical step to a <em>wider circle.</em></h2>
              <p>Real change is rarely a straight line. A small opening — a skill, a mentor, a community — can become a new direction.</p>
            </div>
            <div className="pathway-steps" data-reveal data-reveal-delay="1">
              <div className="pathway-step"><span>01</span><div><strong>Access</strong><p>Meet the right tool, lesson or conversation.</p></div></div>
              <div className="pathway-step"><span>02</span><div><strong>Practice</strong><p>Try it in a safe, supportive environment.</p></div></div>
              <div className="pathway-step"><span>03</span><div><strong>Act</strong><p>Use the learning to make a decision of your own.</p></div></div>
              <div className="pathway-step"><span>04</span><div><strong>Pass it on</strong><p>Let progress travel further than one person.</p></div></div>
            </div>
          </div>
        </section>

        <LiveHomeGoalsAndMethodology />

        <section id="stories" className="section section-paper stories-section">
          <div className="container section-heading-row stories-heading">
            <div>
              <p className="eyebrow"><span className="eyebrow-dot" />Impact, in context</p>
              <h2>Every number points<br /><em>to a person.</em></h2>
            </div>
            <div className="stories-heading-actions"><p className="section-heading-aside">Explore the themes behind the work — digital inclusion, livelihoods, community and the care it takes to build something that lasts.</p><a href="/field-gallery" className="text-link">See the field gallery <ArrowUpRight size={15} /></a></div>
          </div>
          <div className="container story-grid">
            <article className="story-card story-card-large" data-reveal>
              <div className="story-image"><img src="/manus-storage/aasw-field-session_43c9b878.jpeg" alt="AASW field session focused on women’s capability and participation" /><span className="image-source-label">AASW field photo</span></div>
              <div className="story-card-copy"><span className="section-kicker">01 / Digital inclusion</span><h3>When the screen becomes a doorway, not a barrier.</h3><p>Digital education is not only about a device. It is about the confidence to navigate, connect and create.</p><ScrollLink href="#programs" className="text-link">Explore the work <ArrowUpRight size={15} /></ScrollLink></div>
            </article>
            <article className="story-card story-card-small" data-reveal data-reveal-delay="1">
              <div className="story-card-index">02</div><HeartHandshake size={30} strokeWidth={1.4} className="story-icon" /><span className="section-kicker">Community</span><h3>Support gets stronger when it is shared.</h3><p>Mentorship and peer learning create room for questions, experiments and new beginnings.</p><ScrollLink href="#donate" className="text-link text-link-green">Join the circle <ArrowUpRight size={15} /></ScrollLink>
            </article>
            <article className="story-card story-card-small story-card-ochre" data-reveal data-reveal-delay="2">
              <div className="story-card-index">03</div><Sprout size={30} strokeWidth={1.4} className="story-icon" /><span className="section-kicker">Sustainability</span><h3>Livelihood and environment can grow together.</h3><p>Green enterprise asks a useful question: can progress care for the future it depends on?</p><ScrollLink href="#programs" className="text-link">See the approach <ArrowUpRight size={15} /></ScrollLink>
            </article>
          </div>
        </section>

        <section id="donate" className="section donate-section">
          <div className="container donate-layout">
            <div className="donate-copy" data-reveal><p className="eyebrow"><span className="eyebrow-dot" />Make room for the next step</p><h2>Support the work.<br /><em>Keep possibility moving.</em></h2><p>Choose the kind of support that feels right. We will help you take the next step directly.</p><div className="donate-contact"><a href={AASW_CONTACT.emailHref}><Mail size={17} />{AASW_CONTACT.email}</a><a href={AASW_CONTACT.primaryPhoneHref}><Phone size={17} />{AASW_CONTACT.primaryPhoneDisplay}</a><a href={AASW_CONTACT.secondaryPhoneHref}><Phone size={17} />{AASW_CONTACT.secondaryPhoneDisplay}</a></div></div>
            <div className="support-card" data-reveal data-reveal-delay="1"><div className="support-card-header"><div><span className="section-kicker">AASW membership</span><h3>Choose your way in.</h3></div><HandCoins size={28} strokeWidth={1.4} /></div><div className="support-options">{supportOptions.map((option) => <button key={option.amount} className={`support-option ${selectedSupport === option.amount ? "support-option-active" : ""}`} onClick={() => setSelectedSupport(option.amount)}><span className="support-check">{selectedSupport === option.amount ? <Check size={14} /> : null}</span><span><strong>{option.amount}</strong><small>{option.title}</small></span><ArrowUpRight size={16} /></button>)}</div><div className="support-summary"><div><span>Your selected path</span><strong>{selectedOption.amount} <small>· {selectedOption.title}</small></strong></div><ScrollLink href={selectedOption.kind === "membership" ? "/membership#membership-application" : "/donate#donation-details"} className="button button-ochre">{selectedOption.kind === "membership" ? "Complete application" : "Complete donor details"} <ArrowUpRight size={16} /></ScrollLink></div><p className="support-note"><strong>Required details first.</strong> Membership and Donation now use separate forms; no amount is charged in demo mode.</p></div>
          </div>
        </section>

        <TestimonialsCarousel testimonials={approvedTestimonials} />

        <section className="contact-ribbon">
          <div className="container contact-ribbon-inner"><span className="sun-disc" /><p>Have a question, idea or partnership in mind?</p><a href={AASW_CONTACT.emailHref}>Start a conversation <ArrowUpRight size={16} /></a></div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand"><ScrollLink href="#top" className="brand-lockup"><span className="brand-mark-wrap"><img src="/manus-storage/aasw-foundation-official-logo_41a4007d.png" alt="AASW Foundation official logo" className="brand-mark" /></span><span className="brand-copy"><strong>AASW</strong><span>Foundation</span></span></ScrollLink><p>Empowering women through digital education, eco-friendly entrepreneurship and sustainable growth opportunities.</p><div className="social-links"><a href="https://www.facebook.com/share/19TMKDwzfi/" aria-label="AASW Foundation on Facebook"><Facebook size={17} /></a><a href="https://www.instagram.com/aaswfoundation" aria-label="AASW Foundation on Instagram"><Instagram size={17} /></a><a href="https://www.linkedin.com/company/108100135/" aria-label="AASW Foundation on LinkedIn"><Linkedin size={17} /></a></div></div>
          <div className="footer-column footer-column-newsletter"><FooterNewsletterForm /></div><div className="footer-column"><span className="footer-label">Explore</span><ScrollLink href="/about">About AASW</ScrollLink><ScrollLink href="#programs">Programmes</ScrollLink><ScrollLink href="#stories">Impact</ScrollLink><ScrollLink href="/reports">Reports</ScrollLink></div>
          <div className="footer-column"><span className="footer-label">Reach us</span><a href={AASW_CONTACT.emailHref}><Mail size={15} />Email AASW</a><a href={AASW_CONTACT.primaryPhoneHref}><Phone size={15} />{AASW_CONTACT.primaryPhoneDisplay}</a><a href={AASW_CONTACT.secondaryPhoneHref}><Phone size={15} />{AASW_CONTACT.secondaryPhoneDisplay}</a><a href={AASW_CONTACT.mapsUrl} target="_blank" rel="noreferrer"><MapPin size={15} />{AASW_CONTACT.locationShort}<br /><small>Uttar Pradesh 209303</small></a></div>
        </div>
        <div className="container footer-bottom"><span>© 2025 AASW Foundation. All rights reserved.</span><span>Aapka Apna Social Welfare Foundation</span></div>
      </footer>

      {showTop && <button className="back-to-top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="Back to top"><ArrowUpRight size={18} /></button>}
    </div>
  );
}
