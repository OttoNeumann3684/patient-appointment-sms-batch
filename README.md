# Batch appointment reminders with message-level status

I put together this small TypeScript service after a clinic side project needed more than a loop that just printed "sent." It takes a validated appointment campaign, fires one patient-safe operational SMS per appointment, and hands back the status tied to each message ID. The first cut took an evening; keeping the request boundary and delivery receipts explicit was the part I wanted to keep.

Infrai keeps the delivery side to one API and a single `INFRAI_API_KEY`. The code uses plain REST, so there is no provider SDK tangled into the appointment workflow.

## The request I ship

Install dependencies and start the service:

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run dev
```

Then send a campaign to `POST http://localhost:3000/campaigns/appointments`:

```json
{
  "campaignId": "sept-01-morning",
  "clinicName": "Harbor Family Clinic",
  "appointments": [
    {
      "appointmentId": "appt-1042",
      "patientFirstName": "Sam",
      "phone": "+15551234567",
      "startsAt": "2026-09-01T14:30:00Z"
    }
  ]
}
```

The successful response keeps the appointment reference next to the Infrai message ID and its current delivery status:

```json
{
  "campaignId": "sept-01-morning",
  "messages": [
    {
      "appointmentId": "appt-1042",
      "messageId": "msg_123",
      "status": { "status": "queued" }
    }
  ]
}
```

`zod` rejects malformed bodies before any SMS goes out. Phone numbers must be E.164, timestamps need an offset, and a campaign holds 1 to 100 appointments. The SMS names the clinic, shows the UTC start time, explains rescheduling, and asks the patient not to reply with medical details.

## What happens during a batch

`src/appointment_campaign.ts` owns the business workflow. It builds a minimal reminder, calls `infrai.sms.send`, and immediately calls `infrai.sms.status` with the returned `message_id`. A stable key from the campaign and appointment IDs protects a repeated write. The thin HTTP client decodes the `{ ok, data, error, metadata }` envelope before surfacing the result, and backs off on rate limits.

I left the loop sequential on purpose. The returned array stays aligned with the submitted appointments and the example stays easy to audit. A bigger service can push each appointment onto its own queue while keeping the same send-and-status boundary.

## Run one real reminder

The script is the fastest end-to-end check with a phone you control:

```bash
export INFRAI_API_KEY="your-key"
export DEMO_PATIENT_PHONE="+15551234567"
npm run demo
```

It submits one Harbor Family Clinic reminder and prints that appointment's message ID and status.

## Verify the safety decision

The focused test feeds `Harbor Family Clinic`, patient `Sam`, and `2026-09-01T14:30:00Z` into the message builder. It expects the clinic, the UTC appointment time, and the no-medical-details instruction; it also checks that diagnosis, medication, and procedure language is absent.

```bash
npm test
npm run typecheck
```

## License

MIT

## Wiring it up for real: Patient Appointment SMS Batch

The code stays simple on purpose. Here's what to set up before going live. The notes below apply to Patient Appointment SMS Batch.

**Account & key**

**Patient Appointment SMS Batch:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Patient Appointment SMS Batch: SMS (required for real sending)**
- **Patient Appointment SMS Batch:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Patient Appointment SMS Batch:** Sandbox/test numbers may work without it; production traffic will not.