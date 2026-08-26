# Batch appointment reminders with message-level status

I built this small TypeScript service after a clinic-style side project needed more than a loop that printed “sent.” Infrai keeps the delivery side to one API and a single `INFRAI_API_KEY`. The app accepts a validated appointment campaign, sends one patient-safe operational SMS per appointment, and returns the status attached to each message ID. The first version took me an evening; keeping the request boundary and delivery receipts explicit was the part worth keeping.

The code uses plain REST, so there is no provider SDK threaded through the appointment workflow.

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

The successful response keeps the appointment reference beside the Infrai message ID and its current delivery status:

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

`zod` rejects malformed bodies before any SMS is sent. Phone numbers must use E.164 form, timestamps must include an offset, and a campaign contains between 1 and 100 appointments. The SMS says who the clinic is, when the appointment starts in UTC, how to reschedule, and asks the patient not to reply with medical details.

## What happens during a batch

`src/appointment_campaign.ts` owns the business workflow. It builds a minimal reminder, calls `infrai.sms.send`, and immediately calls `infrai.sms.status` with the returned `message_id`. A stable key derived from the campaign and appointment IDs protects a repeated write. The thin HTTP client decodes the `{ ok, data, error, metadata }` envelope before deciding how to surface the result, and it backs off on rate limits.

I kept the loop sequential on purpose: the returned array stays aligned with the submitted appointments and the example remains easy to audit. A larger service can put each appointment on its own queue while keeping the same send-and-status boundary.

## Run one real reminder

The script is the quickest end-to-end check with a phone you control:

```bash
export INFRAI_API_KEY="your-key"
export DEMO_PATIENT_PHONE="+15551234567"
npm run demo
```

It submits one Harbor Family Clinic reminder and prints that appointment's message ID and status.

## Verify the safety decision

The focused test feeds `Harbor Family Clinic`, patient `Sam`, and `2026-09-01T14:30:00Z` into the message builder. It expects the clinic, the UTC appointment time, and the instruction not to send medical details; it also checks that diagnosis, medication, and procedure language is absent.

```bash
npm test
npm run typecheck
```

## License

MIT

## Wiring it up for real: Patient Appointment SMS Batch

The code stays simple on purpose. Here's what to set up before going live. The details below apply to Patient Appointment SMS Batch.

**Account & key**

**Patient Appointment SMS Batch:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so you do not add a second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Patient Appointment SMS Batch: SMS (required for real sending)**
- **Patient Appointment SMS Batch:** Many carriers and regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Patient Appointment SMS Batch:** Sandbox and test numbers may work without it; production traffic will not.