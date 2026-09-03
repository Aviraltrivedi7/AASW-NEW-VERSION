import { jsPDF } from "jspdf";

export type MemberPaymentReceiptData = {
  receipt: string;
  kind: "donation" | "membership";
  amount: number;
  currency: string;
  status: string;
  supporterName: string;
  createdAt: Date | string;
};

export function memberPaymentReceiptFileName(receipt: string) {
  return `AASW-Receipt-${receipt.replace(/[^A-Za-z0-9-]/g, "")}.pdf`;
}

export function memberPaymentReceiptTitle(kind: MemberPaymentReceiptData["kind"]) {
  return kind === "membership" ? "Membership contribution receipt" : "Donation receipt";
}

export function formatReceiptAmount(amountInPaise: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amountInPaise / 100);
}

export function downloadMemberPaymentReceiptPdf(data: MemberPaymentReceiptData) {
  const paidOn = new Date(data.createdAt);
  const dateLabel = Number.isNaN(paidOn.getTime()) ? "Recorded by AASW" : paidOn.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  pdf.setFillColor(47, 107, 82);
  pdf.rect(0, 0, 210, 44, "F");
  pdf.setTextColor(255, 253, 247);
  pdf.setFont("times", "bold");
  pdf.setFontSize(24);
  pdf.text("AASW Foundation", 20, 23);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text(memberPaymentReceiptTitle(data.kind).toUpperCase(), 20, 32);

  pdf.setTextColor(41, 29, 29);
  pdf.setFont("times", "bold");
  pdf.setFontSize(23);
  pdf.text("Thank you for your", 20, 68);
  pdf.text("verified contribution.", 20, 78);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10.5);
  pdf.setTextColor(91, 76, 71);
  pdf.text("This receipt records a server-verified payment. Only payments your member account owns are available here.", 20, 91, { maxWidth: 165 });

  pdf.setDrawColor(47, 107, 82);
  pdf.setFillColor(247, 243, 234);
  pdf.roundedRect(20, 106, 170, 70, 2, 2, "FD");
  pdf.setTextColor(47, 107, 82);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("RECEIPT REFERENCE", 30, 122);
  pdf.text("AMOUNT RECEIVED", 30, 143);
  pdf.text("PAYMENT STATUS", 30, 164);
  pdf.setTextColor(41, 29, 29);
  pdf.setFontSize(14);
  pdf.text(data.receipt, 30, 132);
  pdf.text(formatReceiptAmount(data.amount, data.currency), 30, 153);
  pdf.setFontSize(12);
  pdf.text(data.status, 30, 174);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(91, 76, 71);
  pdf.text(`Paid on: ${dateLabel}`, 30, 190);

  pdf.setTextColor(47, 107, 82);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("Questions about this receipt", 20, 208);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(91, 76, 71);
  pdf.setFontSize(9.5);
  pdf.text("Write to aaswfoundation06@gmail.com quoting the receipt reference above.", 20, 218, { maxWidth: 165 });

  pdf.setDrawColor(212, 130, 10);
  pdf.line(20, 232, 190, 232);
  pdf.setTextColor(91, 76, 71);
  pdf.setFontSize(7.5);
  pdf.text("This receipt is issued to the paying member account. No PAN or identity-document information is included.", 20, 241, { maxWidth: 170 });
  pdf.save(memberPaymentReceiptFileName(data.receipt));
}
