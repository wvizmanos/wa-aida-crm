# CONNECT-WHATSAPP.md - wiring the WhatsApp Cloud API to the CRM

The CRM sends WhatsApp messages through Meta's Cloud API via the
`wa_send` backend action (drawer > Quick message > template chip).
The backend reads two Script Properties - never hardcode tokens in code.

## Script Properties (Project Settings > Script Properties)

| Property        | Value                                                        |
|-----------------|--------------------------------------------------------------|
| WA_WABA_TOKEN   | Permanent access token (see below)                            |
| WA_WABA_PHONE   | Phone Number ID from Meta > WhatsApp > API Setup              |

## Getting a permanent token (System User)

1. business.facebook.com > Business Settings > your business
2. Users > System users > Add > name it (e.g. waaida-crm), role: Admin
3. Select the system user > Add Assets > give it access to the Meta app
   that owns your WhatsApp number AND the WhatsApp Account (WABA)
4. Generate new token > select that app > tick permissions:
   whatsapp_business_messaging + whatsapp_business_management
   > set expiry to "Never" > Generate > copy the token
5. Paste it into the WA_WABA_TOKEN Script Property > Save

A token copied from a DIFFERENT Meta app (another project's system user)
will fail with "Authentication Error" - the token must have rights on the
WABA that owns WA_WABA_PHONE.

## Test mode vs live

- While the number is in test mode, only up to 5 whitelisted recipient
  numbers receive messages (WhatsApp > API Setup > "To" list).
- Move the number to live mode (or upgrade) before messaging real clients.

## Verifying the pipe

- In the CRM: open a lead > Quick message > tap a template chip while the
  app is in live mode. Success = WhatsApp message arrives + activity entry
  "WhatsApp sent: <template>" on the lead.
- Remote check: call action=wa_send with a dummy number - Meta should
  answer with a recipient error (proves auth + routing work) instead of
  "Authentication Error" (which means the token is wrong for this WABA).

## The 24-hour window - the #1 gotcha (VERIFIED 9/10)

Meta only allows a business to send FREE-FORM TEXT to a user who messaged
the business number within the last 24 hours. Outside that window, sends
may be accepted by the API but are not delivered (or are rejected).

- Inbound-first flows: a lead messages your business number -> you can
  reply freely via the drawer's Quick message chips for the next 24 hours.
  This is VERIFIED WORKING end-to-end (9/10): send arrived + activity
  logged "WhatsApp sent: <template>" + usage counter bumped.
- Cold outreach (a lead who never messaged you first): REQUIRES a
  Meta-approved message template. Build item: wa_send template mode.

### The test that proves the pipe (30 seconds)

1. From your personal WhatsApp, message your business number ("hi").
2. Immediately send from the CRM: open the lead > Quick message > chip.
3. The message arrives; the lead's timeline shows the send.

### If a send says success but nothing arrives

1. Did the recipient message your business within 24h? (the window above)
2. Is the recipient in Meta > WhatsApp > API Setup > "To" list? (test mode)
3. Phone format: the app normalizes 09xx/9xx/+63 to international digits
   automatically (shipped 9/10) - but check the number is real.
4. WhatsApp Manager > Insights shows per-message delivery status.

## Marketing template frequency cap (VERIFIED 9/12)

Meta rations MARKETING-category template messages PER USER PER 24 HOURS.
By default a user receives only ~1-2 marketing messages in 24h; further
sends are ACCEPTED by the API (success + message id) but NOT delivered.
A new marketing communication can start only after the 24h window rolls.

Evidence 9/12: first marketing template to a cold number (10:59) delivered;
two more sends to the same number (16:33, 16:36) accepted but dropped.

Practical rules:
- One marketing template per lead per day is a sane outreach cadence anyway.
- For tests: use a FRESH number, or wait out 24h since the last marketing
  message to that number.
- For transactional messages (quote ready, reminder tied to a request),
  prefer a UTILITY-category template - utility messages are not governed by
  the marketing frequency cap and deliver outside the 24h window.

Source: industry documentation on WhatsApp frequency capping (Infobip,
"WhatsApp frequency capping"; Meta for Developers "Messaging Limits").
