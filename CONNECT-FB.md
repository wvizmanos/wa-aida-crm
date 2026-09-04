# CONNECT-FB.md - Facebook lead ads into the CRM (no third-party tool)

The backend natively receives Facebook lead-ads events: Meta POSTs the
leadgen event to the /exec URL, the script fetches the lead details from
the Graph API and appends the lead with source = fb-ads. No wap4crm or
other connector needed.

## 1. Script Property

| Property      | Value                                                       |
|---------------|-------------------------------------------------------------|
| FB_PAGE_TOKEN | Long-lived token for the Facebook PAGE that runs the ads     |

(The code reads this property - the old hardcoded var was removed on
purpose. Keep the token in the property, never in the code.)

## 2. Webhook configuration (Meta App dashboard)

- Callback URL: your /exec URL (the same one both apps connect with)
- Verify token: waaida-ph-2026  (pre-set in the code - do not change)
- Object: Page > subscribe to the field: leadgen

Steps: developers.facebook.com > your app > Webhooks > Page > Edit /
Subscribe to this object > enter callback URL + verify token > Verify
and save > Webhook fields > subscribe "leadgen".

## 3. Test without a live ad

developers.facebook.com > Tools > Lead Ads Testing Tool > create a test
lead. The tool fires a real leadgen webhook event: within seconds the
Google Sheet Leads tab gains a row with source fb-ads.

If the tool complains about an earlier test lead, delete that test lead
inside the tool first, then create a fresh one.

## 4. Notes

- The webhook verify token is separate from WA_AIDA_TOKEN (the CRM auth
  gate) and from FB_PAGE_TOKEN. Three different secrets, three purposes.
- FB leads created this way appear in the app like any other lead -
  pipeline, follow-ups and tracked links all work on them.
