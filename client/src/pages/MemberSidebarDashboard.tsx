import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, ArrowUpRight, Award, CalendarPlus, Check, Download, Eye, EyeOff, FolderKanban, Grid2X2, HandHeart, History, House, ImageUp, KeyRound, Laptop2, Leaf, LogOut, Mail, MapPin, Menu, Presentation, ShieldCheck, Sprout, UsersRound, UserRound, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatIndianDate } from "@shared/mis";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { downloadMemberCertificatePdf } from "@/lib/memberCertificatePdf";
import { downloadMemberPaymentReceiptPdf } from "@/lib/memberPaymentReceiptPdf";
import { downloadNextRenewalCalendarEvent, nextRenewalEligibilityDate } from "@/lib/memberRenewalCalendar";
import { membershipExpiryTimeRemaining } from "@/lib/membershipTermTiming";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notifications";
import { AnimatedCounter } from "@/components/TrustAndImpact";
import "./member-dashboard.css";
import "./member-dashboard-urgency.css";

type Section = "home" | "profile" | "membership" | "history" | "services" | "password";
type Icon = typeof Award;
type MemberServiceType = "digital_skill_development" | "green_entrepreneurship" | "mentorship_business_support" | "workshops_seminars" | "building_community";

const memberServiceOptions: { value: MemberServiceType; label: string; summary: string }[] = [
  { value: "digital_skill_development", label: "Digital skill development", summary: "Digital tools, e-commerce, social-media marketing and online operations." },
  { value: "green_entrepreneurship", label: "Green entrepreneurship", summary: "Environmental education and sustainable practices for enterprise." },
  { value: "mentorship_business_support", label: "Mentorship & business support", summary: "Practical guidance for aspiring women entrepreneurs." },
  { value: "workshops_seminars", label: "Workshops & seminars", summary: "Leadership, financial literacy, technology and innovation learning." },
  { value: "building_community", label: "Building the community", summary: "Peer learning, collaboration and confidence-building support." },
];

const serviceRequestLabel = (value: string) => value.replaceAll("_", " ");

const renewalBenefits = [
  "Digital certificate and online community access",
  "Monthly impact updates and reports",
  "Quarterly workshops on non-profit management and advocacy",
  "Early access to annual summits and charity events",
  "Regional chapter and national forum eligibility",
];

const sections: { id: Section; label: string; icon: Icon }[] = [
  { id: "home", label: "Home", icon: House },
  { id: "profile", label: "My profile", icon: UserRound },
  { id: "membership", label: "My membership", icon: Award },
  { id: "history", label: "Membership history", icon: History },
  { id: "services", label: "My services", icon: Grid2X2 },
  { id: "password", label: "Change password", icon: KeyRound },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

function safeSection(value: string | null): Section {
  return value === "profile" || value === "membership" || value === "history" || value === "services" || value === "password" ? value : "home";
}

function daysBetween(start: Date, end: Date) {
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function MemberInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [shown, setShown] = useState(false);
  return <label className="member-sidebar-field"><span>{label}</span><div><input type={shown ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} /><button type="button" onClick={() => setShown(previous => !previous)} aria-label={shown ? "Hide password" : "Show password"}>{shown ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>;
}

function Loading() {
  return <main className="member-sidebar-loading" aria-busy="true"><span /><p>Loading your member account…</p></main>;
}

function AccessRequired() {
  return <main className="member-sidebar-loading"><div><h1>Member login required</h1><p>Sign in to view your own membership information.</p><a href="/member/login">Go to Member Login</a></div></main>;
}

function MemberLoginWelcome() {
  const updateParallax = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "touch" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - bounds.left) / bounds.width - .5) * 18);
    const y = Math.round(((event.clientY - bounds.top) / bounds.height - .5) * 14);
    event.currentTarget.style.setProperty("--member-parallax-x", `${x}px`);
    event.currentTarget.style.setProperty("--member-parallax-y", `${y}px`);
    event.currentTarget.style.setProperty("--member-parallax-x-soft", `${Math.round(x * .42)}px`);
    event.currentTarget.style.setProperty("--member-parallax-y-soft", `${Math.round(y * .42)}px`);
    event.currentTarget.style.setProperty("--member-parallax-x-deep", `${Math.round(x * 1.12)}px`);
    event.currentTarget.style.setProperty("--member-parallax-y-deep", `${Math.round(y * 1.12)}px`);
  };
  const resetParallax = (event: ReactPointerEvent<HTMLElement>) => {
    event.currentTarget.style.setProperty("--member-parallax-x", "0px");
    event.currentTarget.style.setProperty("--member-parallax-y", "0px");
    event.currentTarget.style.setProperty("--member-parallax-x-soft", "0px");
    event.currentTarget.style.setProperty("--member-parallax-y-soft", "0px");
    event.currentTarget.style.setProperty("--member-parallax-x-deep", "0px");
    event.currentTarget.style.setProperty("--member-parallax-y-deep", "0px");
  };
  return <main className="member-login-welcome" role="status" aria-live="polite" onPointerMove={updateParallax} onPointerLeave={resetParallax}>
    <div className="member-login-welcome-grain" aria-hidden="true" />
    <div className="member-login-welcome-aurora" aria-hidden="true" />
    <div className="member-login-welcome-orbit orbit-one" aria-hidden="true" />
    <div className="member-login-welcome-orbit orbit-two" aria-hidden="true" />
    <section className="member-login-welcome-card">
      <div className="member-login-welcome-logo"><img src="/manus-storage/aasw-foundation-official-logo_41a4007d.png" alt="" /></div>
      <p>AASW MEMBER PORTAL</p>
      <h1>Welcome to<br /><em>AASW Foundation.</em></h1>
      <span>Your member space is ready.</span>
    </section>
    <div className="member-login-welcome-flight" aria-hidden="true"><i /><b /><span /><em /></div>
    <div className="member-login-welcome-reveal" aria-hidden="true" />
  </main>;
}

function ProjectsDetail({ projects }: { projects: { assignmentId: number; projectRole: string; assignedAt: string | Date; projectId: number; projectCode: string; projectName: string; projectTheme: string; projectLocation: string; projectStatus: string; startDate: string | Date; endDate: string | Date }[] }) {
  const statusTone = (status: string) => ({ active: "run", completed: "done", planned: "plan", on_hold: "hold", closed: "done", cancelled: "hold" } as Record<string, string>)[status] ?? "hold";
  return <div className="member-detail-page member-projects-page">
    <MemberDetailIntro eyebrow="MY PROJECTS" title="The work you are part of." lead="Only projects explicitly assigned to your member account by the Foundation are shown here, with your role and the current project status." tone="programmes" />
    {projects.length ? <section className="member-projects-grid" aria-label="Your assigned projects">{projects.map(project => <article key={project.assignmentId} className={`member-project-card-xl status-${statusTone(project.projectStatus)}`}><div className="member-project-card-xl-top"><span className="member-project-xl-role">{project.projectRole}</span><em className={`member-project-xl-status status-${statusTone(project.projectStatus)}`}>{project.projectStatus.replaceAll("_", " ")}</em></div><h2>{project.projectCode}</h2><h3>{project.projectName}</h3><p className="member-project-xl-theme">{project.projectTheme}</p><div className="member-project-xl-meta"><span><MapPin size={13} aria-hidden />{project.projectLocation}</span><span>{formatIndianDate(project.startDate)} — {formatIndianDate(project.endDate)}</span></div><small>Assigned {formatIndianDate(project.assignedAt)}</small></article>)}</section> : <section className="member-projects-empty"><h2>No projects assigned yet.</h2><p>When the Foundation assigns you to a project, it will appear here with your role and its current status. For access questions, contact the Foundation administrator.</p></section>}
    <section className="member-projects-foot"><div><span>YOUR FIELD ROLE</span><h2>Every assignment is real and current.</h2><p>AASW lists only Foundation-verified projects. If an assignment ends, it moves out of this view automatically.</p></div><a href="mailto:aaswfoundation06@gmail.com?subject=Member%20project%20support">Project support <ArrowUpRight size={16} /></a></section>
  </div>;
}

function FoundationPillar({ icon: IconComponent, title, text, tone }: { icon: Icon; title: string; text: string; tone: string }) {
  return <article className={`member-home-pillar ${tone}`}><div><IconComponent size={20} /></div><h3>{title}</h3><p>{text}</p></article>;
}

function FoundationHome() {
  return <div className="member-foundation-home">
    <section className="member-home-mast">
      <div className="member-home-mast-copy">
        <span className="member-home-eyebrow">AASW MEMBER PORTAL</span>
        <p className="member-home-kicker">Aapka Apna Social Welfare Foundation</p>
        <h1>Fueling women’s success through <em>tech &amp; enterprise.</em></h1>
        <p className="member-home-lead">AASW is a human-centred organisation in Uttar Pradesh, working to help women move with confidence through digital learning, enterprise support, mentorship and community care.</p>
        <div className="member-home-actions"><a href="/member/discover">Discover AASW <ArrowUpRight size={16} /></a><a href="/member/programmes">Explore our programmes <ArrowUpRight size={16} /></a></div>
      </div>
      <aside className="member-home-mast-note">
        <span>OUR CORE BELIEF</span>
        <p>Stronger women create a better world—socially, environmentally and financially.</p>
        <i />
        <small>Capability, care and accountability in practice.</small>
      </aside>
    </section>

    <section className="member-home-statement" aria-label="Foundation purpose">
      <div><span>OUR PURPOSE</span><h2>Practical support for women building their own next step.</h2></div>
      <p>AASW encourages women in digital entrepreneurship by connecting educational avenues with digital tools, environmental awareness and business mentoring for inclusive economic growth.</p>
    </section>

    <section className="member-home-pillar-grid" aria-label="What AASW does">
      <FoundationPillar icon={Laptop2} tone="gold" title="Digital skill development" text="Digital skills, e-commerce, social-media marketing and online operations for enterprise." />
      <FoundationPillar icon={Leaf} tone="sage" title="Green entrepreneurship" text="Environmental education and sustainable practices built into business possibilities." />
      <FoundationPillar icon={HandHeart} tone="terracotta" title="Mentorship & support" text="Practical guidance from mentors for aspiring women entrepreneurs." />
      <FoundationPillar icon={Presentation} tone="blue" title="Learning together" text="Workshops, webinars and seminars for leadership, literacy and innovation." />
      <FoundationPillar icon={UsersRound} tone="plum" title="Building community" text="Peer learning, collaboration and confidence for first-time entrepreneurs." />
    </section>

    <section className="member-home-impact">
      <div className="member-home-impact-heading"><span>OUR IMPACT</span><h2>Work that reaches beyond a single training room.</h2><p>Our programmes grow through local understanding, sustained mentorship and community participation.</p></div>
      <div className="member-home-impact-numbers"><article><strong><AnimatedCounter target={800} suffix="+" durationMs={1400} /></strong><span>women trained</span></article><article><strong><AnimatedCounter target={300} suffix="+" durationMs={1400} /></strong><span>small businesses launched or scaled</span></article><article><strong><AnimatedCounter target={30} suffix="+" durationMs={1400} /></strong><span>eco-friendly projects led by women</span></article></div>
    </section>

    <section className="member-home-connect">
      <div><span>WAYS TO PARTICIPATE</span><h2>Support, volunteer or spread the word.</h2><p>Offer support for the mission, share practical expertise, or help more women discover AASW’s work.</p></div>
      <a href="mailto:aaswfoundation06@gmail.com?subject=Member%20portal%20support">Contact AASW <ArrowUpRight size={16} /></a>
    </section>
  </div>;
}

function MemberDetailIntro({ eyebrow, title, lead, tone = "discover" }: { eyebrow: string; title: string; lead: string; tone?: "discover" | "programmes" }) {
  return <header className={`member-detail-intro ${tone}`}><a href="/member/dashboard" className="member-detail-back"><ArrowLeft size={16} />Back to Member Home</a><span>{eyebrow}</span><h1>{title}</h1><p>{lead}</p></header>;
}

function DiscoverAaswDetail() {
  return <div className="member-detail-page member-discover-page">
    <MemberDetailIntro eyebrow="DISCOVER AASW" title="A Foundation built for practical agency." lead="Aapka Apna Social Welfare Foundation is a community-driven effort that helps women thrive in the digital economy through skills, support and local connection." />
    <section className="member-detail-split member-detail-purpose"><div><span>WHO WE ARE</span><h2>Making room for women to step forward as leaders.</h2></div><div><p>AASW was founded to help change the barriers women face when seeking education, career opportunities and leadership roles—especially in business and technology.</p><p>Working in Uttar Pradesh, the Foundation brings together focused training, support systems and local programmes so women can build lasting careers and make a difference in their own neighbourhoods.</p></div></section>
    <section className="member-detail-objective"><span>OUR OBJECTIVE</span><p>To encourage women in digital entrepreneurship through educational avenues, digital tools, environmental awareness and business mentoring for inclusive economic growth.</p></section>
    <section className="member-detail-method"><div><span>HOW WE WORK</span><h2>Local understanding, carried forward with care.</h2></div><div className="member-detail-method-list"><article><b>01</b><p>Identify local challenges and potential changemakers.</p></article><article><b>02</b><p>Offer tailored digital training and mentorship.</p></article><article><b>03</b><p>Build collaboration through community and advisory leadership.</p></article><article><b>04</b><p>Use data and feedback to grow successful initiatives responsibly.</p></article></div></section>
    <section className="member-detail-governance"><span>GOVERNANCE &amp; TRUST</span><h2>Guided by strategy, integrity and impact.</h2><p>The Central Advisory Council supports the Foundation’s strategy, outreach and local project direction, while helping promote initiatives and member achievements across different states.</p><a href="/member/programmes">See the programmes <ArrowUpRight size={16} /></a></section>
  </div>;
}

function ProgrammeDetail({ icon: IconComponent, title, intro, detail, tone }: { icon: Icon; title: string; intro: string; detail: string; tone: string }) {
  return <article className={`member-programme-detail ${tone}`}><div><IconComponent size={22} /></div><span>{title}</span><h2>{intro}</h2><p>{detail}</p></article>;
}

function ProgrammesDetail() {
  return <div className="member-detail-page member-programmes-page">
    <MemberDetailIntro eyebrow="EXPLORE OUR PROGRAMMES" title="Tools, confidence and a community to grow with." lead="Each AASW programme translates a practical need into an opportunity for learning, enterprise and sustained participation." tone="programmes" />
    <section className="member-programmes-intro"><div><span>WHAT WE DO</span><h2>Five connected ways to support women entrepreneurs.</h2></div><p>From learning digital tools to building peer confidence, the programme areas are designed to help women take practical next steps in their own work and communities.</p></section>
    <section className="member-programme-detail-grid" aria-label="AASW programme areas">
      <ProgrammeDetail icon={Laptop2} tone="gold" title="DIGITAL SKILL DEVELOPMENT" intro="Skills for the digital economy." detail="Training in digital skills, e-commerce, social-media marketing and online operations helps women start and sustain businesses." />
      <ProgrammeDetail icon={Leaf} tone="sage" title="GREEN ENTREPRENEURSHIP" intro="Enterprise with environmental care." detail="Environmental education supports ecologically conscious solutions and sustainable practices in business." />
      <ProgrammeDetail icon={HandHeart} tone="terracotta" title="MENTORSHIP & BUSINESS SUPPORT" intro="Guidance at the point of growth." detail="Mentors connect aspiring women entrepreneurs with professionals who can guide them step by step in building and scaling their business." />
      <ProgrammeDetail icon={Presentation} tone="blue" title="WORKSHOPS & SEMINARS" intro="Learning in conversation." detail="Regular online and offline gatherings cover leadership development, financial literacy, technology applications, branding and digital innovation." />
      <ProgrammeDetail icon={UsersRound} tone="plum" title="BUILDING THE COMMUNITY" intro="Confidence grows alongside peers." detail="A growing network enables peer learning, collaboration and confidence, especially for first-time entrepreneurs in remote locations." />
    </section>
    <section className="member-programmes-closing"><div><span>YOUR PLACE IN THE WORK</span><h2>Keep learning. Share knowledge. Strengthen the community.</h2></div><a href="mailto:aaswfoundation06@gmail.com?subject=Member%20portal%20support">Connect with AASW <ArrowUpRight size={16} /></a></section>
  </div>;
}

export function MemberSidebarDashboard() {
  const [section, setSection] = useState<Section>(() => safeSection(localStorage.getItem("member_dashboard_active_section")));
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("member_dashboard_sidebar_collapsed") === "true");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showLoginWelcome, setShowLoginWelcome] = useState(() => sessionStorage.getItem("aasw_member_welcome_intro") === "true");
  const [revealDashboard, setRevealDashboard] = useState(() => sessionStorage.getItem("aasw_member_welcome_intro") === "true");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<MemberServiceType>("digital_skill_development");
  const [serviceMessage, setServiceMessage] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportDraft, setSupportDraft] = useState("");
  const [settingsPhone, setSettingsPhone] = useState("");
  const [settingsCity, setSettingsCity] = useState("");
  const [settingsDistrict, setSettingsDistrict] = useState("");
  const [settingsState, setSettingsState] = useState("");
  const [settingsAddress, setSettingsAddress] = useState("");
  const [foundationUpdatesOptIn, setFoundationUpdatesOptIn] = useState(true);
  const [renewalBenefitsOpen, setRenewalBenefitsOpen] = useState(false);
  const [countdownNow, setCountdownNow] = useState(() => new Date());
  const photoInput = useRef<HTMLInputElement>(null);
  const serviceSelect = useRef<HTMLSelectElement>(null);
  const portalPath = window.location.pathname;
  const isDiscoverDetail = portalPath === "/member/discover";
  const isProgrammesDetail = portalPath === "/member/programmes";
  const isProjectsDetail = portalPath === "/member/projects";
  const isMemberDetail = isDiscoverDetail || isProgrammesDetail || isProjectsDetail;
  const utils = trpc.useUtils();
  const member = trpc.member.me.useQuery();
  const profile = trpc.member.dashboard.useQuery(undefined, { enabled: Boolean(member.data) });
  const projects = trpc.member.myProjects.useQuery(undefined, { enabled: Boolean(member.data) });
  const membershipHistory = trpc.member.membershipHistory.useQuery(undefined, { enabled: Boolean(member.data) });
  const serviceRequests = trpc.member.myServiceRequests.useQuery(undefined, { enabled: Boolean(member.data) });
  const supportMessages = trpc.member.mySupportMessages.useQuery(undefined, { enabled: Boolean(member.data) });
  const paymentReceipts = trpc.member.myReceipts.useQuery(undefined, { enabled: Boolean(member.data) });
  const logout = trpc.member.logout.useMutation({ onSuccess: () => window.location.assign("/member/login") });
  const changePassword = trpc.member.changePassword.useMutation({ onSuccess: () => { setCurrentPassword(""); setNewPassword(""); setConfirmation(""); setPasswordError(null); notifySuccess("Password updated successfully."); }, onError: issue => { setPasswordError(issue.message); notifyError(issue.message); } });
  const uploadPhoto = trpc.member.uploadProfilePhoto.useMutation({ onSuccess: () => { void utils.member.dashboard.invalidate(); notifySuccess("Profile photo updated."); }, onError: issue => notifyError(issue.message) });
  const joinService = trpc.member.joinService.useMutation({ onSuccess: (result) => { void utils.member.myServiceRequests.invalidate(); if (result.created) { setServiceMessage(""); notifySuccess("Service request sent", "AASW Foundation will review your request in the Member Portal."); } else notifyInfo("Already requested", "You already have a request for this programme area."); }, onError: issue => notifyError(issue.message) });
  const sendSupportMessage = trpc.member.sendSupportMessage.useMutation({ onSuccess: () => { setSupportDraft(""); void utils.member.mySupportMessages.invalidate(); notifySuccess("Support message sent", "AASW Foundation can now review your message."); }, onError: issue => notifyError(issue.message) });
  const updateProfileSettings = trpc.member.updateProfileSettings.useMutation({ onSuccess: () => { void utils.member.dashboard.invalidate(); notifySuccess("Profile settings saved", "Your contact details and communication preference have been updated."); }, onError: issue => notifyError(issue.message) });

  useEffect(() => { localStorage.setItem("member_dashboard_active_section", section); }, [section]);
  useEffect(() => { localStorage.setItem("member_dashboard_sidebar_collapsed", String(collapsed)); }, [collapsed]);
  useEffect(() => { if (window.location.pathname === "/member/projects") setSection("services"); }, []);
  useEffect(() => {
    if (!profile.data) return;
    setSettingsPhone(profile.data.phone ?? "");
    setSettingsCity(profile.data.city ?? "");
    setSettingsDistrict(profile.data.district ?? "");
    setSettingsState(profile.data.state ?? "");
    setSettingsAddress(profile.data.address ?? "");
    setFoundationUpdatesOptIn(profile.data.foundationUpdatesOptIn ?? true);
  }, [profile.data]);
  useEffect(() => {
    if (!showLoginWelcome) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => { sessionStorage.removeItem("aasw_member_welcome_intro"); setShowLoginWelcome(false); setRevealDashboard(!reducedMotion); }, reducedMotion ? 0 : 1950);
    return () => window.clearTimeout(timer);
  }, [showLoginWelcome]);
  useEffect(() => {
    if (!revealDashboard || showLoginWelcome) return;
    const timer = window.setTimeout(() => setRevealDashboard(false), 900);
    return () => window.clearTimeout(timer);
  }, [revealDashboard, showLoginWelcome]);
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileSidebarOpen]);
  useEffect(() => {
    const interval = window.setInterval(() => setCountdownNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const strength = useMemo(() => [newPassword.length >= 8, /[A-Z]/.test(newPassword), /\d/.test(newPassword), /[^A-Za-z0-9]/.test(newPassword)].filter(Boolean).length, [newPassword]);
  if (showLoginWelcome) return <MemberLoginWelcome />;
  if (member.isLoading || profile.isLoading || projects.isLoading || membershipHistory.isLoading || serviceRequests.isLoading || supportMessages.isLoading || paymentReceipts.isLoading) return <Loading />;
  if (!member.data) return <AccessRequired />;
  if (!profile.data || profile.isError) return <main className="member-sidebar-loading"><div><h1>Member account unavailable</h1><p>Please contact AASW Foundation for help with your membership record.</p></div></main>;

  const active = profile.data.portalAccessStatus === "active";
  const inGracePeriod = profile.data.portalAccessStatus === "grace";
  const portalEnabled = profile.data.portalAccessStatus !== "expired";
  const location = [profile.data.city, profile.data.district].filter(Boolean).join(", ") || "Not recorded";
  const joined = new Date(profile.data.joiningDate);
  const expires = profile.data.expiresOn ? new Date(profile.data.expiresOn) : null;
  const graceEnds = profile.data.graceEndsOn ? new Date(profile.data.graceEndsOn) : null;
  const totalDays = expires ? Math.max(1, daysBetween(joined, expires)) : 1;
  const elapsed = expires ? Math.min(100, Math.max(0, Math.round((1 - daysBetween(new Date(), expires) / totalDays) * 100))) : 0;
  const remaining = expires ? daysBetween(new Date(), expires) : 0;
  const graceRemaining = graceEnds ? Math.max(0, daysBetween(new Date(), graceEnds)) : 0;
  const expiryTone = !expires ? "lifetime" : inGracePeriod ? "grace" : remaining <= 7 ? "urgent" : remaining < 30 ? "soon" : "active";
  const exactExpiryTimeRemaining = expires ? membershipExpiryTimeRemaining(expires, countdownNow) : null;
  const isTermRenewalUrgent = Boolean(expires && active && remaining < 30);
  const download = () => downloadMemberCertificatePdf(profile.data);
  const renewalEligibleOn = expires ? nextRenewalEligibilityDate(expires) : null;
  const daysUntilRenewalEligible = renewalEligibleOn ? daysBetween(new Date(), renewalEligibleOn) : 0;
  const addRenewalReminder = () => {
    if (!expires || !renewalEligibleOn) return;
    downloadNextRenewalCalendarEvent(expires, `${window.location.origin}/member/dashboard`);
    notifySuccess("Calendar reminder downloaded", `Add the reminder to your calendar for ${formatIndianDate(renewalEligibleOn)}.`);
  };
  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    if (!currentPassword || !newPassword || !confirmation) return setPasswordError("Please complete all password fields.");
    if (newPassword !== confirmation) return setPasswordError("Passwords do not match.");
    if (strength < 4) return setPasswordError("Use 8+ characters with uppercase, number and special character.");
    changePassword.mutate({ currentPassword, password: newPassword });
  };
  const submitServiceRequest = (event: FormEvent) => { event.preventDefault(); joinService.mutate({ serviceType: selectedService, message: serviceMessage.trim() || undefined }); };
  const submitSupportMessage = (event: FormEvent) => { event.preventDefault(); if (!supportDraft.trim()) return notifyError("Please write your support message."); sendSupportMessage.mutate({ message: supportDraft.trim() }); };
  const submitProfileSettings = (event: FormEvent) => {
    event.preventDefault();
    updateProfileSettings.mutate({ phone: settingsPhone.trim(), city: settingsCity.trim(), district: settingsDistrict.trim(), state: settingsState.trim(), address: settingsAddress.trim(), foundationUpdatesOptIn });
  };
  const startPhotoUpload = (file?: File) => {
    if (!file) return;
    const supported = ["image/jpeg", "image/png", "image/webp"];
    if (!supported.includes(file.type)) return notifyError("Use a JPG, PNG or WebP profile photo.");
    if (file.size > 2 * 1024 * 1024) return notifyError("Use a profile photo up to 2 MB.");
    const reader = new FileReader();
    reader.onerror = () => notifyError("The selected photo could not be read.");
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      const dataBase64 = dataUrl.split(",")[1];
      if (!dataBase64) return notifyError("The selected photo could not be read.");
      uploadPhoto.mutate({ originalName: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", dataBase64 });
    };
    reader.readAsDataURL(file);
  };
  const avatar = profile.data.profilePhotoUrl ? <img src={profile.data.profilePhotoUrl} alt={`${profile.data.fullName} profile`} /> : initials(profile.data.fullName);
  const toggleSidebar = () => {
    if (window.matchMedia?.("(max-width: 768px)").matches) {
      setMobileSidebarOpen(previous => !previous);
      return;
    }
    setCollapsed(previous => !previous);
  };
  const toggleFromKeyboard = (event: KeyboardEvent<HTMLElement>) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSidebar(); } };

  return <main className={`member-sidebar-page ${revealDashboard ? "member-login-dashboard-reveal" : ""}`}>
    <header className="member-sidebar-topbar"><div className="member-sidebar-topbar-left"><button type="button" className="member-mobile-menu-trigger" onClick={() => setMobileSidebarOpen(previous => !previous)} aria-label={mobileSidebarOpen ? "Close member navigation" : "Open member navigation"} aria-expanded={mobileSidebarOpen} aria-controls="member-sidebar-navigation">{mobileSidebarOpen ? <X size={21} /> : <Menu size={21} />}</button><a href="/" className="member-sidebar-brand"><img src="/manus-storage/aasw-foundation-official-logo_41a4007d.png" alt="AASW Foundation" /><span>AASW FOUNDATION</span></a></div><div><a href="/member/certificate"><Award size={16} /><span>My certificate</span></a><button onClick={() => logout.mutate()}><LogOut size={16} /><span>Sign out</span></button></div></header>
    <div className="member-sidebar-shell">
      {mobileSidebarOpen && <button type="button" className="member-sidebar-overlay" onClick={() => setMobileSidebarOpen(false)} aria-label="Close member navigation" />}
      <aside id="member-sidebar-navigation" className={`member-sidebar ${collapsed ? "collapsed" : ""} ${mobileSidebarOpen ? "mobile-open" : ""}`}>
        <section className="member-sidebar-identity member-sidebar-identity-toggle" role="button" tabIndex={0} onClick={toggleSidebar} onKeyDown={toggleFromKeyboard} aria-expanded={!collapsed} aria-label={collapsed ? "Expand member navigation" : "Collapse member navigation"} title={collapsed ? "Expand member navigation" : "Collapse member navigation"}><div className="member-sidebar-avatar">{avatar}</div><strong>{profile.data.fullName}</strong><code>{profile.data.membershipNo}</code><span className={active ? "active" : inGracePeriod ? "grace" : "expired"}>● {active ? "Active" : inGracePeriod ? "Grace period" : "Expired"}</span></section>
        <nav>{sections.map(item => { const IconComponent = item.icon; return <button key={item.id} className={!isMemberDetail && section === item.id ? "is-active" : ""} onClick={() => { setMobileSidebarOpen(false); localStorage.setItem("member_dashboard_active_section", item.id); if (isMemberDetail) window.location.assign("/member/dashboard"); else setSection(item.id); }} title={item.label}><IconComponent size={18} /><span>{item.label}</span></button>; })}</nav>
        <footer><button onClick={() => logout.mutate()}><LogOut size={18} /><span>Sign out</span></button></footer>
      </aside>
      <section className="member-sidebar-content"><div key={portalPath} className="member-sidebar-section">
        {isDiscoverDetail && <DiscoverAaswDetail />}
        {isProgrammesDetail && <ProgrammesDetail />}
        {isProjectsDetail && <ProjectsDetail projects={projects.data ?? []} />}
        {!isMemberDetail && section === "home" && <FoundationHome />}
        {section === "profile" && <><SectionHeader title="My profile" subtitle="Your personal details, contact information and communication preferences" /><dl className="member-info-grid"><Info label="Full name" value={profile.data.fullName} /><Info label="Role" value={member.data.role.replaceAll("_", " ")} /><Info label="Email" value={profile.data.email} /><Info label="Membership ID" value={profile.data.membershipNo} mono /><Info label="Phone" value={profile.data.phone || "Not recorded"} /><Info label="City" value={location} /><Info label="State" value={profile.data.state || "Not recorded"} /><Info label="Member since" value={formatIndianDate(profile.data.joiningDate)} wide /><Info label="Projects assigned" value={`${projects.data?.length ?? 0} assigned`} wide /></dl><section className="member-profile-settings" aria-labelledby="member-profile-settings-title"><div><p>PROFILE SETTINGS</p><h2 id="member-profile-settings-title">Keep your contact details up to date.</h2><span>Your login email stays protected because it is linked to your Member ID and secure renewal matching.</span></div><form onSubmit={submitProfileSettings}><div className="member-profile-settings-grid"><label><span>Mobile number</span><input value={settingsPhone} onChange={event => setSettingsPhone(event.target.value)} inputMode="tel" autoComplete="tel" /></label><label><span>City</span><input value={settingsCity} onChange={event => setSettingsCity(event.target.value)} autoComplete="address-level2" /></label><label><span>District</span><input value={settingsDistrict} onChange={event => setSettingsDistrict(event.target.value)} /></label><label><span>State</span><input value={settingsState} onChange={event => setSettingsState(event.target.value)} autoComplete="address-level1" /></label><label className="wide"><span>Address <em>Optional</em></span><textarea value={settingsAddress} onChange={event => setSettingsAddress(event.target.value)} maxLength={1000} rows={3} autoComplete="street-address" /></label></div><label className="member-preference-toggle"><input type="checkbox" checked={foundationUpdatesOptIn} onChange={event => setFoundationUpdatesOptIn(event.target.checked)} /><span><strong>Foundation updates</strong><small>Send me non-essential AASW programme and community updates. Important membership notices remain protected.</small></span></label><button disabled={updateProfileSettings.isPending}>{updateProfileSettings.isPending ? "Saving settings…" : "Save profile settings"}</button></form></section><input ref={photoInput} className="member-photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { startPhotoUpload(event.target.files?.[0]); event.currentTarget.value = ""; }} /><div className="member-profile-actions"><button onClick={() => photoInput.current?.click()} disabled={uploadPhoto.isPending}><ImageUp size={16} />{uploadPhoto.isPending ? "Uploading…" : "Upload photo"}</button></div></>}
        {section === "membership" && <><SectionHeader title="My membership" subtitle="Membership status, validity, renewal timing and certificate" /><section className="member-membership-summary" aria-label="Membership overview"><article><span>CURRENT STATUS</span><strong>{active ? "Active member" : inGracePeriod ? "Renewal grace period" : "Renewal available"}</strong><small>{active ? "Your member services and certificate remain available." : inGracePeriod ? `${graceRemaining} day${graceRemaining === 1 ? "" : "s"} of protected renewal access remain.` : "Your annual term has ended; you can now renew."}</small></article><article><span>VALID THROUGH</span><strong>{expires ? formatIndianDate(profile.data.expiresOn!) : "Lifetime"}</strong><small>{expires ? `${remaining} day${remaining === 1 ? "" : "s"} remaining in the current term.` : "No renewal date applies to lifetime membership."}</small></article><article><span>RENEWAL HISTORY</span><strong>{membershipHistory.data?.length ?? 0} cycle{membershipHistory.data?.length === 1 ? "" : "s"}</strong><button type="button" onClick={() => setSection("history")}>View history <ArrowUpRight size={14} /></button></article></section>{expires && <section className={`member-term-progress ${expiryTone}`} aria-label={`${elapsed}% of your current membership term has elapsed`}><div className="member-term-progress-heading"><div><span>MEMBERSHIP TERM PROGRESS</span><strong>{elapsed}% elapsed</strong><small>{remaining} day{remaining === 1 ? "" : "s"} remaining in the current term</small></div>{isTermRenewalUrgent && <div className="member-term-urgency-actions"><Tooltip><TooltipTrigger asChild><button type="button" className="member-term-renew-now" onClick={() => notifyInfo("Renewal opens after your current term", `Your membership remains protected through ${formatIndianDate(profile.data.expiresOn!)}. Secure online renewal opens on ${formatIndianDate(renewalEligibleOn!)}.`)}>Renew Now <ArrowUpRight size={15} /></button></TooltipTrigger><TooltipContent side="top">Early renewal is protected. Your secure renewal opens on {formatIndianDate(renewalEligibleOn!)}.</TooltipContent></Tooltip><button type="button" className="member-term-benefits-link" onClick={() => setRenewalBenefitsOpen(true)}>Benefits of renewing</button></div>}</div><div className="member-term-progress-track-wrap"><div className="member-term-progress-track" role="progressbar" tabIndex={0} aria-describedby="member-term-progress-exact-time" aria-valuemin={0} aria-valuemax={100} aria-valuenow={elapsed} aria-valuetext={`${elapsed}% elapsed; ${exactExpiryTimeRemaining?.label ?? `${remaining} days remaining`}`}><i style={{ width: `${elapsed}%` }} /></div><span id="member-term-progress-exact-time" className="member-term-progress-tooltip" role="tooltip" aria-live="polite">Live countdown: {exactExpiryTimeRemaining?.label}</span></div><div className="member-term-progress-dates"><span>Started {formatIndianDate(profile.data.joiningDate)}</span><span>Ends {formatIndianDate(profile.data.expiresOn!)}</span></div></section>}<section className={`member-expiry-countdown ${expiryTone}`} aria-label={!expires ? "Lifetime membership has no expiry date" : active ? `Renewal opens on ${formatIndianDate(renewalEligibleOn!)} in ${daysUntilRenewalEligible} days` : inGracePeriod ? `${graceRemaining} days remaining in membership renewal grace period` : "Membership renewal is available"}><span>{active && expires ? "EARLY RENEWAL" : inGracePeriod ? "RENEWAL GRACE PERIOD" : "MEMBERSHIP COUNTDOWN"}</span><strong>{!expires ? "Lifetime member" : active ? `Renewal opens ${formatIndianDate(renewalEligibleOn!)}` : inGracePeriod ? `${graceRemaining} day${graceRemaining === 1 ? "" : "s"} to renew` : "Renewal is available"}</strong><p>{!expires ? "Your membership does not have an expiry date." : active ? `Your annual membership remains active through ${formatIndianDate(profile.data.expiresOn!)}. To protect your current term, online renewal opens on ${formatIndianDate(renewalEligibleOn!)} — ${daysUntilRenewalEligible} day${daysUntilRenewalEligible === 1 ? "" : "s"} from now.` : inGracePeriod ? `Your annual term ended on ${formatIndianDate(profile.data.expiresOn!)}. Portal access remains available through ${formatIndianDate(profile.data.graceEndsOn!)} so you can renew.` : "Your annual term has ended. Renew with the same email and exact PAN to keep your Member ID, profile and history."}</p>{active && expires && <button type="button" className="member-renew-link member-calendar-reminder" onClick={addRenewalReminder}><CalendarPlus size={15} />Add to calendar</button>}{portalEnabled && profile.data.memberType === "annual" && !active && <a className="member-renew-link" href="/membership?renewal=annual">Renew Membership <ArrowUpRight size={15} /></a>}</section><dl className="member-info-grid"><Info label="Membership ID" value={profile.data.membershipNo} mono wide green /><Info label="Plan" value={profile.data.membershipTypeLabel} /><Info label="Status" value={active ? "● Active" : inGracePeriod ? "● Grace period" : "Expired"} pill={portalEnabled} /><Info label="Valid from" value={formatIndianDate(profile.data.joiningDate)} /><Info label="Valid through" value={expires ? formatIndianDate(profile.data.expiresOn!) : "Lifetime"} />{renewalEligibleOn && <Info label="Renewal eligible from" value={formatIndianDate(renewalEligibleOn)} />}{inGracePeriod && <Info label="Grace ends" value={formatIndianDate(profile.data.graceEndsOn!)} />}<Info label={inGracePeriod ? "Days to renew" : "Days remaining"} value={expires ? `${inGracePeriod ? graceRemaining : remaining} days` : "Not applicable"} /><div className="member-validity-card"><dt>Membership validity</dt>{expires ? <><div><i style={{ width: `${elapsed}%` }} /></div><dd>{inGracePeriod ? `Membership term ended · ${graceRemaining} days of renewal access remain` : `${elapsed}% elapsed · ${remaining} days remaining`}</dd></> : <dd>Lifetime membership</dd>}</div></dl><div className="member-profile-actions"><button onClick={download} className="primary"><Download size={16} />Download certificate</button><a href="/member/certificate"><Award size={16} />View certificate</a></div><Dialog open={renewalBenefitsOpen} onOpenChange={setRenewalBenefitsOpen}><DialogContent className="member-renewal-benefits-dialog"><DialogHeader><p>MEMBERSHIP RENEWAL</p><DialogTitle>Continue your membership benefits.</DialogTitle><DialogDescription>Renewal keeps your annual member access and the existing benefits listed for AASW membership.</DialogDescription></DialogHeader><ul>{renewalBenefits.map(benefit => <li key={benefit}><Check size={16} />{benefit}</li>)}</ul><p className="member-renewal-benefits-policy">Your current membership remains active through {formatIndianDate(profile.data.expiresOn!)}. Online renewal becomes available on {formatIndianDate(renewalEligibleOn!)}.</p><button type="button" onClick={() => setRenewalBenefitsOpen(false)}>Close</button></DialogContent></Dialog></>}
        {section === "history" && <><SectionHeader title="Membership & activity history" subtitle="Your own past membership terms, programme requests and support conversations" /><section className="member-history-overview"><div><p>PRIVATE MEMBER RECORD</p><h2>Your AASW journey, in one place.</h2><span>Only you and authorised Foundation administrators can view this history.</span></div><article><span>Membership cycles</span><strong><AnimatedCounter target={membershipHistory.data?.length ?? 0} durationMs={1100} /></strong></article><article><span>Programme requests</span><strong><AnimatedCounter target={serviceRequests.data?.length ?? 0} durationMs={1100} /></strong></article><article><span>Support messages</span><strong><AnimatedCounter target={supportMessages.data?.length ?? 0} durationMs={1100} /></strong></article><article><span>Payment receipts</span><strong><AnimatedCounter target={paymentReceipts.data?.length ?? 0} durationMs={1100} /></strong></article></section><section className="member-history-stream" aria-labelledby="history-cycles"><h2 id="history-cycles">Membership cycles</h2>{membershipHistory.data?.length ? membershipHistory.data.map(cycle => <article key={`${cycle.cycleNumber}-${cycle.createdAt}`}><strong>Cycle {cycle.cycleNumber} · {cycle.membershipType === "lifetime" ? "Lifetime Membership" : "Annual Membership"}</strong><span className={`membership-cycle-${cycle.status}`}>{cycle.status}</span><p>{formatIndianDate(cycle.startsOn)}{cycle.expiresOn ? ` — ${formatIndianDate(cycle.expiresOn)}` : " — lifetime"}</p></article>) : <p className="member-service-empty">Your membership cycle will appear here.</p>}</section><section className="member-history-stream" aria-labelledby="history-activity"><h2 id="history-activity">Programme & support activity</h2>{serviceRequests.data?.map(request => <article key={request.requestRef}><strong>{memberServiceOptions.find(option => option.value === request.serviceType)?.label ?? serviceRequestLabel(request.serviceType)}</strong><span className={`status-${request.status}`}>{serviceRequestLabel(request.status)}</span><p>{formatIndianDate(request.createdAt)}{request.adminNote ? ` · Foundation update: ${request.adminNote}` : ""}</p></article>)}{supportMessages.data?.map(message => <article key={message.messageRef}><strong>Support conversation</strong><span className={`status-${message.status}`}>{serviceRequestLabel(message.status)}</span><p>{formatIndianDate(message.createdAt)} · {message.adminReply ? "Foundation replied" : "Awaiting Foundation response"}</p></article>)}{!serviceRequests.data?.length && !supportMessages.data?.length && <p className="member-service-empty">Your programme requests and support conversations will appear here.</p>}</section><section className="member-history-stream" aria-labelledby="history-receipts"><h2 id="history-receipts">Payment receipts</h2>{paymentReceipts.data?.length ? paymentReceipts.data.map(receipt => <article key={receipt.receipt}><strong>{receipt.receipt} · {formatIndianDate(receipt.createdAt)}</strong><span className={`status-${receipt.status === "refunded" ? "closed" : receipt.status}`}>{receipt.status}</span><p>{receipt.kind === "membership" ? "Membership contribution" : "Donation"} · ₹{receipt.amount / 100}</p>{receipt.status !== "refunded" && <button type="button" className="member-receipt-download" onClick={() => downloadMemberPaymentReceiptPdf({ receipt: receipt.receipt, kind: receipt.kind, amount: receipt.amount, currency: receipt.currency, status: receipt.status, supporterName: profile.data?.fullName ?? "", createdAt: receipt.createdAt })}><Download size={14} />Download receipt PDF</button>}</article>) : <p className="member-service-empty">Your verified payment receipts will appear here. Receipts are issued only for server-verified payments.</p>}</section></>}
        {section === "services" && <><SectionHeader title="My services" subtitle="Use your active member services or request support through an AASW programme" /><div className="member-service-grid"><Service icon={FolderKanban} title="My projects" text="View assigned projects" tag={`${projects.data?.length ?? 0} assigned`} tone="green" onClick={() => window.location.assign("/member/projects")} /><Service icon={Award} title="Certificate" text="Download membership PDF" tag="Ready" tone="green" onClick={download} /><Service icon={Sprout} title="Join a service" text="Request programme support" tag="Apply" tone="orange" onClick={() => serviceSelect.current?.focus()} /><Service icon={Mail} title="Support" text="Chat with admin" tag="Help" tone="gray" onClick={() => setSupportOpen(true)} /></div><section className="member-service-request-panel" aria-labelledby="join-service-heading"><div><p>MEMBER PROGRAMME REQUEST</p><h2 id="join-service-heading">Join a service that fits your next step.</h2><span>Choose from AASW’s published programme areas. Your request is private to your member account and the authorised Foundation team.</span></div><form onSubmit={submitServiceRequest}><label><span>Programme area</span><select ref={serviceSelect} value={selectedService} onChange={event => setSelectedService(event.target.value as MemberServiceType)}>{memberServiceOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><p className="member-service-option-summary">{memberServiceOptions.find(option => option.value === selectedService)?.summary}</p><label><span>How can AASW support you? <em>Optional</em></span><textarea value={serviceMessage} onChange={event => setServiceMessage(event.target.value)} maxLength={1200} rows={4} placeholder="Share a short note about the support you are looking for." /></label><button disabled={joinService.isPending}>{joinService.isPending ? "Sending request…" : "Send service request"}</button></form></section><section className="member-service-request-history" aria-labelledby="my-service-requests-heading"><div><h2 id="my-service-requests-heading">My service requests</h2><p>Track only requests submitted from your own member account.</p></div>{serviceRequests.data?.length ? <div>{serviceRequests.data.map(request => <article key={request.requestRef}><div><strong>{memberServiceOptions.find(option => option.value === request.serviceType)?.label ?? serviceRequestLabel(request.serviceType)}</strong><span>{formatIndianDate(request.createdAt)}</span></div><em className={`status-${request.status}`}>{serviceRequestLabel(request.status)}</em>{request.message && <p>{request.message}</p>}{request.adminNote && <small>Foundation update: {request.adminNote}</small>}</article>)}</div> : <p className="member-service-empty">You have not sent a service request yet.</p>}</section>{supportOpen && <div className="member-support-dialog-backdrop" role="presentation" onMouseDown={() => setSupportOpen(false)}><section className="member-support-dialog" role="dialog" aria-modal="true" aria-labelledby="member-support-dialog-title" onMouseDown={event => event.stopPropagation()}><header><div><p>PRIVATE MEMBER SUPPORT</p><h2 id="member-support-dialog-title">How can AASW help?</h2></div><button type="button" onClick={() => setSupportOpen(false)} aria-label="Close support chat"><X size={18} /></button></header><div className="member-support-thread" aria-live="polite">{supportMessages.data?.length ? supportMessages.data.map(message => <article key={message.messageRef}><div className="member-support-bubble member"><strong>You</strong><p>{message.message}</p><span>{formatIndianDate(message.createdAt)} · {serviceRequestLabel(message.status)}</span></div>{message.adminReply && <div className="member-support-bubble admin"><strong>AASW Foundation</strong><p>{message.adminReply}</p><span>{message.repliedAt ? formatIndianDate(message.repliedAt) : "Foundation reply"}</span></div>}</article>) : <p className="member-support-empty">Start a private conversation with the Foundation support team. Your message will appear only in your member portal and the authorised admin inbox.</p>}</div><form onSubmit={submitSupportMessage}><label><span>Write your message</span><textarea value={supportDraft} onChange={event => setSupportDraft(event.target.value)} maxLength={3000} rows={4} placeholder="Describe your question or concern here." autoFocus /></label><button disabled={sendSupportMessage.isPending}>{sendSupportMessage.isPending ? "Sending…" : "Send message"}</button></form></section></div>}</>}
        {section === "password" && <><SectionHeader title="Change password" subtitle="Update your account password securely" /><form className="member-password-form" onSubmit={submitPassword}><MemberInput label="Current password" value={currentPassword} onChange={setCurrentPassword} /><MemberInput label="New password" value={newPassword} onChange={setNewPassword} /><div className="member-password-strength" aria-label={`Password strength ${strength} of 4`}><div>{[1, 2, 3, 4].map(level => <i key={level} className={level <= strength ? `filled strength-${strength}` : ""} />)}</div><span>{["Weak", "Medium", "Strong", "Very strong"][Math.max(0, strength - 1)] || "Password strength"}</span></div><p>Min 8 characters, 1 uppercase, 1 number, 1 special character.</p><MemberInput label="Confirm new password" value={confirmation} onChange={setConfirmation} />{passwordError && <p className="member-password-error">{passwordError}</p>}<button disabled={changePassword.isPending}>{changePassword.isPending ? "Updating…" : "Update password"}</button><small><ShieldCheck size={14} />Passwords are stored securely and are never emailed by AASW Foundation.</small></form></>}
      </div></section>
    </div>
  </main>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) { return <header className="member-section-heading"><h1>{title}</h1><p>{subtitle}</p></header>; }
function Info({ label, value, wide = false, mono = false, green = false, pill = false }: { label: string; value: string; wide?: boolean; mono?: boolean; green?: boolean; pill?: boolean }) { return <div className={`${wide ? "wide" : ""} ${mono ? "mono" : ""} ${green ? "green" : ""}`}><dt>{label}</dt><dd className={pill ? "member-status-pill" : ""}>{value}</dd></div>; }
function Service({ icon: IconComponent, title, text, tag, tone, onClick }: { icon: Icon; title: string; text: string; tag: string; tone: string; onClick: () => void }) { return <button className="member-service" onClick={onClick}><IconComponent size={22} /><strong>{title}</strong><span>{text}</span><em className={tone}>{tag}</em></button>; }
