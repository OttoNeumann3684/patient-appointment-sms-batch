import { createServer } from "node:http";
import { ZodError } from "zod";
import {
  campaignRequestSchema,
  sendAppointmentCampaign,
} from "./appointment_campaign.js";
import { createInfraiSms, InfraiError } from "./infrai_sms.js";

const port = Number(process.env.PORT ?? 3000);

function json(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/campaigns/appointments") {
    json(res, 404, { error: "Route not found" });
    return;
  }

  try {
    const input = campaignRequestSchema.parse(await readBody(req));
    const messages = await sendAppointmentCampaign(input, createInfraiSms());
    json(res, 200, { campaignId: input.campaignId, messages });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(res, 400, { error: "Invalid campaign request" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      json(res, status, { error: error.code, message: error.message });
      return;
    }
    json(res, 500, { error: "Campaign could not be processed" });
  }
}).listen(port, () => {
  console.log(`Appointment notification service listening on http://localhost:${port}`);
});
