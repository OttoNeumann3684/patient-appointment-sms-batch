import { campaignRequestSchema, sendAppointmentCampaign } from "../src/appointment_campaign.js";
import { createInfraiSms } from "../src/infrai_sms.js";

const phone = process.env.DEMO_PATIENT_PHONE;
if (!phone) throw new Error("DEMO_PATIENT_PHONE is required in E.164 format");

const campaign = campaignRequestSchema.parse({
  campaignId: `demo-${new Date().toISOString().slice(0, 10)}`,
  clinicName: "Harbor Family Clinic",
  appointments: [
    {
      appointmentId: "appt-demo-1",
      patientFirstName: "Sam",
      phone,
      startsAt: "2026-09-01T14:30:00Z",
    },
  ],
});

const receipts = await sendAppointmentCampaign(campaign, createInfraiSms());
console.log(JSON.stringify({ campaignId: campaign.campaignId, messages: receipts }, null, 2));
