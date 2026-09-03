import { FormEvent, useState } from "react";
import { CheckCircle2, ClipboardList, LifeBuoy, LockKeyhole, RefreshCw, Send, ShieldAlert, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { notifyError, notifySuccess } from "@/lib/notifications";
import "./foundation-admin.css";

const menu = [
  { icon: ClipboardList, label: "Foundation workspace", path: "/foundation-admin" },
  { icon: Users, label: "Member accounts", path: "/foundation-admin/members" },
  { icon: CheckCircle2, label: "Programme requests", path: "/foundation-admin/service-requests" },
  { icon: LifeBuoy, label: "Support inbox", path: "/foundation-admin/support-inbox" },
];

const statuses = ["submitted", "reviewing", "accepted", "not_available", "completed", "closed"] as const;
const serviceLabels: Record<string, string> = {
  digital_skill_development: "Digital skill development",
  green_entrepreneurship: "Green entrepreneurship",
  mentorship_business_support: "Mentorship & business support",
  workshops_seminars: "Workshops & seminars",
  building_community: "Building the community",
};

const dateTime = (value: Date | string) => new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const words = (value: string) => value.replaceAll("_", " ");

export function FoundationServiceRequestsPage() {
  const { user, loading } = useAuth();
  if (loading) return <main className="min-h-screen bg-[#fffdf7]" />;
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#fffdf7] p-6 text-center text-[#291d1d]"><section className="max-w-md border border-[#291d1d]/15 bg-white p-8"><LockKeyhole className="mx-auto text-[#2f6b52]" size={28} /><p className="mt-5 text-xs font-bold uppercase tracking-[.14em] text-[#2f6b52]">Foundation management</p><h1 className="mt-2 font-serif text-4xl">Service requests, with care.</h1><p className="mt-4 text-sm leading-6 text-[#5b4c47]">Sign in with an authorised Foundation account to review member programme requests.</p><button type="button" onClick={() => startLogin()} className="mt-6 bg-[#2f6b52] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white">Sign in to continue</button></section></main>;
  if (user.role !== "admin") return <DashboardLayout menuItems={menu} title="AASW Foundation"><section className="mx-auto mt-14 max-w-2xl border border-red-200 bg-red-50 p-8 text-red-950"><ShieldAlert size={28} /><p className="mt-4 text-xs font-bold uppercase tracking-[.14em]">Restricted workspace</p><h1 className="mt-2 font-serif text-4xl">Foundation management is admin-only.</h1></section></DashboardLayout>;
  return <DashboardLayout menuItems={menu} title="AASW Foundation"><ServiceRequestWorkspace /></DashboardLayout>;
}

function ServiceRequestWorkspace() {
  const utils = trpc.useUtils();
  const requests = trpc.management.serviceRequests.list.useQuery({ limit: 100 });
  const update = trpc.management.serviceRequests.updateStatus.useMutation({
    onSuccess: (_, input) => { notifySuccess("Service request updated", `Status changed to ${words(input.status)}.`); void utils.management.serviceRequests.list.invalidate(); },
    onError: error => notifyError("Service request could not be updated", error.message),
  });

  if (requests.isLoading) return <main className="foundation-admin-workspace mx-auto max-w-5xl space-y-6 bg-[#fffdf7] text-[#291d1d]" aria-busy="true"><div className="foundation-admin-skeleton-hero animate-pulse" aria-hidden /><div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <div key={i} className="foundation-admin-skeleton-record animate-pulse" aria-hidden />)}</div><p className="sr-only">Loading member service requests.</p></main>;
  if (requests.error) return <main className="mx-auto max-w-5xl p-6 text-[#291d1d]"><p className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">{requests.error.message}</p></main>;

  return <main className="foundation-admin-workspace mx-auto max-w-6xl space-y-6 bg-[#fffdf7] text-[#291d1d]"><header className="foundation-admin-hero flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#2f6b52]">Protected member workflow</p><h1 className="mt-2 font-serif text-5xl tracking-tight">Programme requests.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5b4c47]">Review requests sent from <strong>Join a service</strong> for published AASW programme areas. Add a private Foundation update with the accepted member’s next step; it will appear only in that member’s service history. General messages submitted from the member <strong>Support chat</strong> appear in the <a className="font-bold text-[#2f6b52] underline underline-offset-4" href="/foundation-admin/support-inbox">Support inbox</a>, not on this screen.</p></div><button type="button" onClick={() => requests.refetch()} className="inline-flex items-center gap-2 self-start border border-[#2f6b52] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[#2f6b52] hover:bg-[#2f6b52] hover:text-white"><RefreshCw size={14} />Refresh</button></header><section className="grid gap-4 lg:grid-cols-2">{requests.data?.length ? requests.data.map(request => <ProgrammeRequestCard key={request.requestRef} request={request} pending={update.isPending} onSave={input => update.mutate(input)} />) : <p className="border border-dashed border-[#291d1d]/20 p-5 text-sm text-[#796966]">No programme service requests have been submitted yet. General member messages are available in the Support inbox.</p>}</section></main>;
}

function ProgrammeRequestCard({ request, pending, onSave }: { request: { requestRef: string; serviceType: string; fullName: string; membershipNo: string; email: string; message: string | null; status: (typeof statuses)[number]; adminNote: string | null; createdAt: Date | string }; pending: boolean; onSave: (input: { requestRef: string; status: (typeof statuses)[number]; adminNote?: string }) => void }) {
  const [status, setStatus] = useState<(typeof statuses)[number]>(request.status);
  const [note, setNote] = useState(request.adminNote ?? "");
  const submit = (event: FormEvent) => { event.preventDefault(); onSave({ requestRef: request.requestRef, status, adminNote: note.trim() || undefined }); };
  return <article className="border border-[#291d1d]/15 bg-[#fffaf0] p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2f6b52]">{serviceLabels[request.serviceType] ?? words(request.serviceType)}</p><h2 className="mt-2 font-serif text-3xl">{request.fullName}</h2><p className="mt-1 text-xs text-[#796966]">{request.membershipNo} · {request.email}</p></div><select value={status} disabled={pending} onChange={event => setStatus(event.target.value as (typeof statuses)[number])} className="border border-[#291d1d]/20 bg-white px-2 py-2 text-xs capitalize disabled:opacity-60">{statuses.map(item => <option key={item} value={item}>{words(item)}</option>)}</select></div>{request.message ? <p className="mt-4 whitespace-pre-wrap border-l-2 border-[#2f6b52] pl-3 text-sm leading-6 text-[#4e4540]">{request.message}</p> : <p className="mt-4 text-sm text-[#796966]">No additional support note was provided.</p>}<form onSubmit={submit} className="mt-4 grid gap-2"><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-[#625951]">Foundation update for this member<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1200} rows={4} placeholder="Example: Your workshop place is confirmed. The Foundation team will contact you with the date and location." className="border border-[#291d1d]/20 bg-white p-3 text-sm font-normal normal-case tracking-normal" /></label><button disabled={pending} className="inline-flex w-fit items-center gap-2 bg-[#2f6b52] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white disabled:opacity-60"><Send size={14} />{pending ? "Saving" : "Save status & update"}</button></form><p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#796966]">{request.requestRef} · submitted {dateTime(request.createdAt)}</p></article>;
}
