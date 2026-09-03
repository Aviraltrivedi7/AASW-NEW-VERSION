import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { assignMemberToProject, changeMemberPassword, createMemberPasswordResetToken, createMemberServiceRequest, createMemberSupportMessage, expireMemberIfDue, getActiveMemberCertificateEmailToken, getActiveMemberPasswordResetToken, getActiveMemberSetupToken, getMemberById, getMemberByIdentifier, getMemberPaymentReceipt, listMemberMembershipCycles, listMemberPaymentReceipts, listMemberProjectAssignments, listMemberServiceRequests, listMemberSupportMessages, listMembersForAdmin, listMisProjects, recordMemberLoginFailure, recordMemberLoginSuccess, resetMemberPasswordFromToken, setMemberPasswordFromSetupToken, updateMemberProfilePhoto, updateMemberProfileSettings } from "../db";
import { dispatchMemberPasswordResetEmail } from "../email/memberActivation";
import { getSessionCookieOptions } from "../_core/cookies";
import { adminProcedure, memberProcedure, publicProcedure, router } from "../_core/trpc";
import { createMemberSetupToken, hashMemberSetupToken } from "../security/memberAccount";
import { createMemberSession, MEMBER_SESSION_COOKIE } from "../security/memberSession";
import { getMembershipValidity } from "@shared/memberMembership";
import { storageGetSignedUrl, storagePut } from "../storage";
import { nanoid } from "nanoid";

const passwordInput = z.string().min(8, "Password must be at least 8 characters.").max(128).regex(/[a-z]/, "Password must include a lowercase letter.").regex(/[A-Z]/, "Password must include an uppercase letter.").regex(/\d/, "Password must include a number.").regex(/[^A-Za-z0-9]/, "Password must include a special character.");
const profilePhotoMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;
const memberServiceTypes = ["digital_skill_development", "green_entrepreneurship", "mentorship_business_support", "workshops_seminars", "building_community"] as const;

export function decodeProfilePhoto(dataBase64: string, mimeType: (typeof profilePhotoMimeTypes)[number]) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64) || dataBase64.length % 4 !== 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Profile photo data could not be read." });
  const bytes = Buffer.from(dataBase64, "base64");
  if (!bytes.length || bytes.length > MAX_PROFILE_PHOTO_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "Use a JPG, PNG or WebP photo up to 2 MB." });
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  if ((mimeType === "image/jpeg" && !jpeg) || (mimeType === "image/png" && !png) || (mimeType === "image/webp" && !webp)) throw new TRPCError({ code: "BAD_REQUEST", message: "The selected file does not match its image type." });
  return bytes;
}

function profilePhotoExtension(mimeType: (typeof profilePhotoMimeTypes)[number]) { return mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg"; }

function clearMemberSession(ctx: { req: Parameters<typeof getSessionCookieOptions>[0]; res: { clearCookie: (name: string, options: Record<string, unknown>) => void } }) {
  ctx.res.clearCookie(MEMBER_SESSION_COOKIE, getSessionCookieOptions(ctx.req));
}

function setMemberSession(ctx: { req: Parameters<typeof getSessionCookieOptions>[0]; res: { cookie: (name: string, value: string, options: Record<string, unknown>) => void } }, token: string) {
  ctx.res.cookie(MEMBER_SESSION_COOKIE, token, { ...getSessionCookieOptions(ctx.req), maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function memberAppBaseUrl(req: { protocol?: string; get?: (header: string) => string | undefined }) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = req.get?.("host");
  if (host) return `${req.protocol === "http" ? "http" : "https"}://${host}`;
  return "http://localhost:3000";
}

export const memberRouter = router({
  setupStatus: publicProcedure.input(z.object({ token: z.string().min(20).max(512) })).query(async ({ input }) => {
    const token = await getActiveMemberSetupToken(hashMemberSetupToken(input.token));
    return { valid: Boolean(token), membershipNo: token?.membershipNo ?? null, fullName: token?.fullName ?? null };
  }),

  emailCertificateStatus: publicProcedure.input(z.object({ token: z.string().min(20).max(512) })).query(async ({ input }) => {
    const member = await getActiveMemberCertificateEmailToken(hashMemberSetupToken(input.token));
    if (!member || member.status !== "active" || member.accountStatus !== "active") return { valid: false as const, certificate: null };
    const validity = getMembershipValidity(member.memberType, member.joiningDate);
    if (validity.portalAccessStatus === "expired") return { valid: false as const, certificate: null };
    return { valid: true as const, certificate: { fullName: member.fullName, membershipNo: member.membershipNo, membershipTypeLabel: validity.membershipTypeLabel, joiningDate: member.joiningDate, expiresOn: validity.expiresOn } };
  }),

  setupPassword: publicProcedure.input(z.object({ token: z.string().min(20).max(512), password: passwordInput })).mutation(async ({ input }) => {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const completed = await setMemberPasswordFromSetupToken({ tokenHash: hashMemberSetupToken(input.token), passwordHash });
    if (!completed) throw new TRPCError({ code: "BAD_REQUEST", message: "This setup link has expired or is invalid. Please contact AASW Foundation." });
    return { success: true } as const;
  }),

  requestPasswordReset: publicProcedure.input(z.object({ email: z.string().trim().email().max(320) })).mutation(async ({ input, ctx }) => {
    const member = await getMemberByIdentifier(input.email);
    // Preserve a generic response so callers cannot discover registered emails.
    if (!member || member.email.toLowerCase() !== input.email.toLowerCase() || member.status !== "active" || member.accountStatus === "inactive") return { success: true } as const;
    const reset = createMemberSetupToken();
    await createMemberPasswordResetToken(member.id, reset.tokenHash, reset.expiresAt);
    const resetUrl = `${memberAppBaseUrl(ctx.req)}/member/reset-password?token=${encodeURIComponent(reset.token)}`;
    await dispatchMemberPasswordResetEmail({ fullName: member.fullName, email: member.email, membershipNo: member.membershipNo, setupUrl: resetUrl });
    return { success: true } as const;
  }),

  resetStatus: publicProcedure.input(z.object({ token: z.string().min(20).max(512) })).query(async ({ input }) => {
    const token = await getActiveMemberPasswordResetToken(hashMemberSetupToken(input.token));
    return { valid: Boolean(token), membershipNo: token?.membershipNo ?? null, fullName: token?.fullName ?? null };
  }),

  resetPassword: publicProcedure.input(z.object({ token: z.string().min(20).max(512), password: passwordInput })).mutation(async ({ input }) => {
    const completed = await resetMemberPasswordFromToken({ tokenHash: hashMemberSetupToken(input.token), passwordHash: await bcrypt.hash(input.password, 12) });
    if (!completed) throw new TRPCError({ code: "BAD_REQUEST", message: "This reset link has expired or is invalid. Please request a new password reset." });
    return { success: true } as const;
  }),

  login: publicProcedure.input(z.object({ identifier: z.string().trim().min(3).max(320), password: z.string().min(1).max(128) })).mutation(async ({ input, ctx }) => {
    const member = await getMemberByIdentifier(input.identifier);
    const genericError = () => new TRPCError({ code: "UNAUTHORIZED", message: "Invalid membership number/email or password." });
    if (!member || !member.passwordHash) throw genericError();
    const now = new Date();
    if (await expireMemberIfDue(member, now) || member.status === "expired" || member.accountStatus === "inactive") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Your annual membership has ended. Submit a new membership application with the same email and PAN to reactivate this Member Portal account." });
    }
    if (member.status !== "active") throw genericError();
    if (member.lockedUntil && member.lockedUntil > now) throw new TRPCError({ code: "FORBIDDEN", message: `Your account is temporarily locked. Try again after ${member.lockedUntil.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} or contact AASW Foundation.` });
    const correctPassword = await bcrypt.compare(input.password, member.passwordHash);
    if (!correctPassword) {
      const lockedUntil = await recordMemberLoginFailure(member.id, member.loginAttempts, now);
      if (lockedUntil) throw new TRPCError({ code: "FORBIDDEN", message: `Your account is temporarily locked. Try again after ${lockedUntil.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} or contact AASW Foundation.` });
      throw genericError();
    }
    await recordMemberLoginSuccess(member.id, now);
    const token = await createMemberSession({ id: member.id, membershipNo: member.membershipNo, fullName: member.fullName, role: member.role, email: member.email });
    setMemberSession(ctx, token);
    return { success: true, mustChangePassword: member.mustChangePassword, member: { membershipNo: member.membershipNo, fullName: member.fullName, role: member.role } };
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearMemberSession(ctx);
    return { success: true } as const;
  }),

  // Session-state lookup is public so a signed-out member UI can render its
  // own Member Login route without triggering the Manus OAuth redirect hook.
  me: publicProcedure.query(({ ctx }) => ctx.member),

  dashboard: memberProcedure.query(async ({ ctx }) => {
    const member = await getMemberById(ctx.member.id);
    if (!member || member.status !== "active" || member.accountStatus !== "active") {
      throw new TRPCError({ code: "FORBIDDEN", message: "This member account is not active. Please contact AASW Foundation." });
    }
    const validity = getMembershipValidity(member.memberType, member.joiningDate);
    let profilePhotoUrl: string | null = null;
    if (member.profilePhotoKey) {
      try {
        profilePhotoUrl = await storageGetSignedUrl(member.profilePhotoKey);
      } catch (error) {
        console.warn("[Member] Profile photo signed URL unavailable", { memberId: member.id, error: error instanceof Error ? error.message : "unknown" });
      }
    }
    return {
      fullName: member.fullName,
      membershipNo: member.membershipNo,
      email: member.email,
      memberType: member.memberType,
      membershipTypeLabel: validity.membershipTypeLabel,
      membershipStatus: validity.membershipStatus,
      portalAccessStatus: validity.portalAccessStatus,
      expiresOn: validity.expiresOn,
      graceEndsOn: validity.graceEndsOn,
      joiningDate: member.joiningDate,
      city: member.city,
      district: member.district,
      state: member.state,
      phone: member.phone,
      address: member.address,
      foundationUpdatesOptIn: member.foundationUpdatesOptIn,
      profilePhotoUrl,
      certificateEligible: validity.portalAccessStatus !== "expired",
    };
  }),

  myProjects: memberProcedure.query(({ ctx }) => listMemberProjectAssignments(ctx.member.id)),

  membershipHistory: memberProcedure.query(({ ctx }) => listMemberMembershipCycles(ctx.member.id)),

  /**
   * Receipt access is ownership-scoped server-side: the query is keyed to the
   * authenticated member's own email, so no receipt id or member id is ever
   * accepted from the client. A member can therefore never read another
   * supporter's receipts even by forging request ids.
   */
  myReceipts: memberProcedure.query(async ({ ctx }) => {
    const member = await getMemberById(ctx.member.id);
    if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "This member account is not active." });
    return listMemberPaymentReceipts(member.email);
  }),

  /** Single-receipt lookup for PDF download; ownership is re-checked inside the query. */
  receiptStatus: memberProcedure.input(z.object({ receipt: z.string().trim().min(6).max(40) })).query(async ({ input, ctx }) => {
    const receipt = await getMemberPaymentReceipt(input.receipt, ctx.member.email);
    if (!receipt) throw new TRPCError({ code: "NOT_FOUND", message: "No receipt was found for your member account." });
    return receipt;
  }),

  myServiceRequests: memberProcedure.query(({ ctx }) => listMemberServiceRequests(ctx.member.id)),

  joinService: memberProcedure.input(z.object({ serviceType: z.enum(memberServiceTypes), message: z.string().trim().max(1200).optional() })).mutation(async ({ input, ctx }) => {
    const member = await getMemberById(ctx.member.id);
    if (!member || member.status !== "active" || member.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "This member account is not active." });
    const result = await createMemberServiceRequest({ requestRef: `AASW-SRV-${nanoid(12).toUpperCase()}`, memberId: member.id, serviceType: input.serviceType, message: input.message });
    return { request: result.request, created: result.created };
  }),

  mySupportMessages: memberProcedure.query(({ ctx }) => listMemberSupportMessages(ctx.member.id)),

  sendSupportMessage: memberProcedure.input(z.object({ message: z.string().trim().min(3, "Please enter at least 3 characters.").max(3000, "Keep your support message within 3,000 characters.") })).mutation(async ({ input, ctx }) => {
    const member = await getMemberById(ctx.member.id);
    if (!member || member.status !== "active" || member.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "This member account is not active." });
    const message = await createMemberSupportMessage({ messageRef: `AASW-SUP-${nanoid(12).toUpperCase()}`, memberId: member.id, message: input.message });
    return { message };
  }),

  changePassword: memberProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), password: passwordInput })).mutation(async ({ input, ctx }) => {
    const member = await getMemberById(ctx.member.id);
    if (!member?.passwordHash || !(await bcrypt.compare(input.currentPassword, member.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Your current password is incorrect." });
    await changeMemberPassword(member.id, await bcrypt.hash(input.password, 12));
    return { success: true } as const;
  }),

  updateProfileSettings: memberProcedure.input(z.object({
    phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{7,19}$/, "Enter a valid contact number."),
    city: z.string().trim().min(2, "Enter your city.").max(100),
    district: z.string().trim().min(2, "Enter your district.").max(128),
    state: z.string().trim().min(2, "Enter your state.").max(100),
    address: z.string().trim().max(1000),
    foundationUpdatesOptIn: z.boolean(),
  })).mutation(async ({ input, ctx }) => {
    const member = await getMemberById(ctx.member.id);
    if (!member || member.status !== "active" || member.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "This member account is not active." });
    await updateMemberProfileSettings(member.id, input);
    return { success: true } as const;
  }),

  uploadProfilePhoto: memberProcedure.input(z.object({ originalName: z.string().trim().min(1).max(255), mimeType: z.enum(profilePhotoMimeTypes), dataBase64: z.string().min(20) })).mutation(async ({ input, ctx }) => {
    const member = await getMemberById(ctx.member.id);
    if (!member || member.status !== "active" || member.accountStatus !== "active") throw new TRPCError({ code: "FORBIDDEN", message: "This member account is not active." });
    const bytes = decodeProfilePhoto(input.dataBase64, input.mimeType);
    let stored: { key: string; url: string };
    try {
      stored = await storagePut(`member-profile-photos/${member.membershipNo}/avatar.${profilePhotoExtension(input.mimeType)}`, bytes, input.mimeType);
    } catch (error) {
      console.error("[Member] Profile photo upload failed", { memberId: member.id, error });
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Your profile photo could not be securely uploaded. Please try again." });
    }
    await updateMemberProfilePhoto(member.id, stored);
    return { profilePhotoUrl: await storageGetSignedUrl(stored.key) };
  }),

  admin: router({
    listMembers: adminProcedure.query(() => listMembersForAdmin()),
    listProjects: adminProcedure.query(() => listMisProjects(200)),
    assignProject: adminProcedure.input(z.object({ memberId: z.number().int().positive(), projectId: z.number().int().positive(), projectRole: z.string().trim().min(2).max(120) })).mutation(async ({ input, ctx }) => ({ id: await assignMemberToProject({ ...input, assignedByOpenId: ctx.user.openId }) })),
  }),
});
