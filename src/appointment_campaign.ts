import { createHash } from "node:crypto";
import { z } from "zod";
import type { InfraiSms, SmsStatusResult } from "./infrai_sms.js";

export const campaignRequestSchema = z.object({
  campaignId: z.string().min(3).max(80),
  clinicName: z.string().min(2).max(80),
  appointments: z.array(
    z.object({
      appointmentId: z.string().min(1).max(80),
      patientFirstName: z.string().min(1).max(60),
      phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
      startsAt: z.string().datetime({ offset: true }),
    }),
  ).min(1).max(100),
});

export type CampaignRequest = z.infer<typeof campaignRequestSchema>;

export type MessageReceipt = {
  appointmentId: string;
  messageId: string;
  status: SmsStatusResult;
};

export function buildAppointmentMessage(
  clinicName: string,
  patientFirstName: string,
  startsAt: string,
): string {
  const when = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(startsAt));
  return `${clinicName}: Hi ${patientFirstName}, your appointment is ${when} UTC. Reply to the clinic if you need to reschedule. Do not send medical details by SMS.`;
}

function idempotencyKey(campaignId: string, appointmentId: string): string {
  return createHash("sha256")
    .update(`${campaignId}:${appointmentId}`)
    .digest("hex");
}

export async function sendAppointmentCampaign(
  input: CampaignRequest,
  infrai: InfraiSms,
): Promise<MessageReceipt[]> {
  const receipts: MessageReceipt[] = [];
  for (const appointment of input.appointments) {
    const sent = await infrai.sms.send(
      {
        to: appointment.phone,
        body: buildAppointmentMessage(
          input.clinicName,
          appointment.patientFirstName,
          appointment.startsAt,
        ),
      },
      idempotencyKey(input.campaignId, appointment.appointmentId),
    );
    receipts.push({
      appointmentId: appointment.appointmentId,
      messageId: sent.message_id,
      status: await infrai.sms.status(sent.message_id),
    });
  }
  return receipts;
}
