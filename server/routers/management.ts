import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { createGalleryMedia, getFoundationManagementSummary, getGalleryDriveSyncConfig, getMembershipApplicationProofKey, getVolunteerApplicationByRef, listContactInquiries, listDonationIntents, listFoundationAdminAlerts, listFoundationMemberServiceRequests, listFoundationMemberSupportMessages, listGalleryMedia, listMembershipApplications, listPaymentTransactions, listVolunteerApplications, markFoundationAdminAlertRead, markVolunteerDecisionNotification, respondToMemberSupportMessage, saveGalleryDriveSyncConfig, updateContactInquiryStatus, updateDonationIntentStatus, updateGalleryMedia, updateMemberServiceRequestStatus, updateMembershipApplicationStatus, updateVolunteerApplicationStatus } from "../db";
import { dispatchVolunteerDecisionEmail } from "../email/volunteerNotification";
import { storageGetSignedUrl, storagePut } from "../storage";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";

const limitInput = z.object({ limit: z.number().int().min(1).max(100).default(50) });
const membershipStatus = z.enum(["submitted", "reviewing", "approved", "declined"]);
const inquiryStatus = z.enum(["submitted", "reviewing", "responded", "closed"]);
const donationStatus = z.enum(["details_submitted", "checkout_created", "verified", "captured", "failed", "closed"]);
const mediaStatus = z.enum(["draft", "published", "archived"]);
const serviceRequestStatus = z.enum(["submitted", "reviewing", "accepted", "not_available", "completed", "closed"]);
const supportMessageStatus = z.enum(["submitted", "reviewing", "responded", "closed"]);
const volunteerStatus = z.enum(["submitted", "reviewing", "approved", "rejected", "inactive"]);
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function imageBuffer(dataBase64: string, mimeType: (typeof allowedImageTypes)[number]) {
  if (!/^[A-Za-z0-9+/=]+$/.test(dataBase64)) throw new TRPCError({ code: "BAD_REQUEST", message: "Image data could not be read." });
  const bytes = Buffer.from(dataBase64, "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "Use a JPG, PNG or WebP image up to 8 MB." });
  if (mimeType === "image/jpeg" && !(bytes[0] === 0xff && bytes[1] === 0xd8)) throw new TRPCError({ code: "BAD_REQUEST", message: "The selected file does not match its declared image type." });
  if (mimeType === "image/png" && !bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) throw new TRPCError({ code: "BAD_REQUEST", message: "The selected file does not match its declared image type." });
  if (mimeType === "image/webp" && bytes.subarray(0, 4).toString("ascii") !== "RIFF") throw new TRPCError({ code: "BAD_REQUEST", message: "The selected file does not match its declared image type." });
  return bytes;
}

function safeFileName(name: string) { return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "field-photo"; }
function driveFolderId(value: string) { const match = value.match(/(?:folders\/|id=)([a-zA-Z0-9_-]{10,})/) ?? value.match(/^([a-zA-Z0-9_-]{20,})$/); if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Provide a valid Google Drive folder link or folder ID." }); return match[1]; }

export const managementRouter = router({
  summary: adminProcedure.query(() => getFoundationManagementSummary()),
  alerts: router({
    list: adminProcedure.input(limitInput).query(({ input }) => listFoundationAdminAlerts(input.limit)),
    markRead: adminProcedure.input(z.object({ alertId: z.number().int().positive() })).mutation(async ({ input }) => { await markFoundationAdminAlertRead(input.alertId); return { success: true } as const; }),
  }),
  memberships: router({
    list: adminProcedure.input(limitInput).query(({ input }) => listMembershipApplications(input.limit)),
    updateStatus: adminProcedure.input(z.object({ applicationRef: z.string().min(1), status: membershipStatus })).mutation(async ({ input }) => { await updateMembershipApplicationStatus(input.applicationRef, input.status); return { status: input.status }; }),
    proofUrl: adminProcedure.input(z.object({ applicationRef: z.string().min(1) })).query(async ({ input }) => { const key = await getMembershipApplicationProofKey(input.applicationRef); if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "Membership proof was not found." }); return { url: await storageGetSignedUrl(key) }; }),
  }),
  inquiries: router({ list: adminProcedure.input(limitInput).query(({ input }) => listContactInquiries(input.limit)), updateStatus: adminProcedure.input(z.object({ inquiryRef: z.string().min(1), status: inquiryStatus })).mutation(async ({ input }) => { await updateContactInquiryStatus(input.inquiryRef, input.status); return { status: input.status }; }) }),
  volunteers: router({
    list: adminProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(50), status: volunteerStatus.optional() })).query(({ input }) => listVolunteerApplications(input.limit, input.status)),
    review: adminProcedure.input(z.object({ applicationRef: z.string().trim().min(6).max(40), status: volunteerStatus, reviewNotes: z.string().trim().max(1500).optional() })).mutation(async ({ input, ctx }) => {
      const application = await getVolunteerApplicationByRef(input.applicationRef);
      if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Volunteer application was not found." });
      if (application.status === input.status) return { applicationRef: input.applicationRef, status: input.status, unchanged: true as const };

      await updateVolunteerApplicationStatus({ applicationRef: input.applicationRef, status: input.status, reviewNotes: input.reviewNotes, reviewerOpenId: ctx.user.openId });

      // Approved/rejected decisions notify the applicant; reviewer-only states stay internal.
      if (input.status === "approved" || input.status === "rejected") {
        const decision = await dispatchVolunteerDecisionEmail({ applicationRef: input.applicationRef, fullName: application.fullName, email: application.email, status: input.status, reviewNotes: input.reviewNotes });
        await markVolunteerDecisionNotification(input.applicationRef, decision === "sent" ? "sent" : "failed", decision === "sent" ? undefined : decision.error);
      }
      return { applicationRef: input.applicationRef, status: input.status };
    }),
  }),
  donations: router({ list: adminProcedure.input(limitInput).query(({ input }) => listDonationIntents(input.limit)), updateStatus: adminProcedure.input(z.object({ donationRef: z.string().min(1), status: donationStatus })).mutation(async ({ input }) => { await updateDonationIntentStatus(input.donationRef, input.status); return { status: input.status }; }) }),
  payments: router({ list: adminProcedure.input(limitInput).query(({ input }) => listPaymentTransactions(input.limit)) }),
  serviceRequests: router({
    list: adminProcedure.input(limitInput).query(({ input }) => listFoundationMemberServiceRequests(input.limit)),
    updateStatus: adminProcedure.input(z.object({ requestRef: z.string().min(1).max(40), status: serviceRequestStatus, adminNote: z.string().trim().max(1200).optional() })).mutation(async ({ input, ctx }) => { await updateMemberServiceRequestStatus({ ...input, reviewedByOpenId: ctx.user.openId }); return { requestRef: input.requestRef, status: input.status }; }),
  }),
  supportMessages: router({
    list: adminProcedure.input(limitInput).query(({ input }) => listFoundationMemberSupportMessages(input.limit)),
    respond: adminProcedure.input(z.object({ messageRef: z.string().min(1).max(40), status: supportMessageStatus, adminReply: z.string().trim().max(3000).optional() })).mutation(async ({ input, ctx }) => { await respondToMemberSupportMessage({ ...input, repliedByOpenId: ctx.user.openId }); return { messageRef: input.messageRef, status: input.status }; }),
  }),
  media: router({
    list: adminProcedure.input(limitInput).query(({ input }) => listGalleryMedia(input.limit)),
    upload: adminProcedure.input(z.object({ title: z.string().trim().min(3).max(180), description: z.string().trim().min(10).max(2000), altText: z.string().trim().min(10).max(500), quarter: z.string().trim().min(2).max(80), displayOrder: z.number().int().min(0).max(9999).default(0), status: mediaStatus.default("draft"), image: z.object({ originalName: z.string().min(1).max(255), mimeType: z.enum(allowedImageTypes), dataBase64: z.string().min(20) }) })).mutation(async ({ input, ctx }) => { const bytes = imageBuffer(input.image.dataBase64, input.image.mimeType); const mediaRef = `AASW-MEDIA-${nanoid(12).toUpperCase()}`; const upload = await storagePut(`gallery-media/${mediaRef}/${safeFileName(input.image.originalName)}`, bytes, input.image.mimeType); await createGalleryMedia({ mediaRef, title: input.title, description: input.description, altText: input.altText, quarter: input.quarter, displayOrder: input.displayOrder, storageKey: upload.key, imageUrl: upload.url, originalName: input.image.originalName, mimeType: input.image.mimeType, fileSize: bytes.length, source: "manual_upload", status: input.status, uploadedByOpenId: ctx.user.openId, publishedAt: input.status === "published" ? new Date() : null }); return { mediaRef, imageUrl: upload.url, status: input.status }; }),
    update: adminProcedure.input(z.object({ mediaRef: z.string().min(1), title: z.string().trim().min(3).max(180).optional(), description: z.string().trim().min(10).max(2000).optional(), altText: z.string().trim().min(10).max(500).optional(), quarter: z.string().trim().min(2).max(80).optional(), displayOrder: z.number().int().min(0).max(9999).optional(), status: mediaStatus.optional() })).mutation(async ({ input }) => { const { mediaRef, ...changes } = input; await updateGalleryMedia(mediaRef, changes); return { mediaRef, ...changes }; }),
  }),
  galleryDrive: router({
    configuration: adminProcedure.query(async () => (await getGalleryDriveSyncConfig()) ?? null),
    saveConfiguration: adminProcedure.input(z.object({ folderUrl: z.string().trim().min(10).max(1024), syncIntervalHours: z.number().int().min(12).max(168).default(24) })).mutation(async ({ input, ctx }) => {
      const folderId = driveFolderId(input.folderUrl);
      const id = await saveGalleryDriveSyncConfig({ ...input, folderId, updatedByOpenId: ctx.user.openId });
      return { id, folderId, syncStatus: "needs_access" as const };
    }),
  }),
});

export const publicMediaRouter = router({ list: publicProcedure.input(limitInput).query(({ input }) => listGalleryMedia(input.limit, true)) });
