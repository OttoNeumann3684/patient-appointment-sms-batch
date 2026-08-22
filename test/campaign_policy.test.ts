import assert from "node:assert/strict";
import test from "node:test";
import { buildAppointmentMessage } from "../src/appointment_campaign.js";

test("appointment reminder identifies the clinic and keeps medical details out", () => {
  const message = buildAppointmentMessage(
    "Harbor Family Clinic",
    "Sam",
    "2026-09-01T14:30:00Z",
  );

  assert.match(message, /^Harbor Family Clinic: Hi Sam,/);
  assert.match(message, /Sep 1, 2026, 2:30 PM UTC/);
  assert.match(message, /Do not send medical details by SMS\.$/);
  assert.doesNotMatch(message, /diagnosis|medication|procedure/i);
});
