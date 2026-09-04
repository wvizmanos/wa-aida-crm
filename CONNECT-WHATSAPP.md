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
