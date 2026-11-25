# The Rowan House — enquiry email setup (Supabase + Resend test sender)

This package is connected to the dedicated Supabase project created for this website:

- Project: `rowan-house-enquiries`
- Project ref: `ivlgnrhkubxjlbwvhzpm`
- Edge Function: `send-enquiry` — deployed and active (version 7)
- Function URL: `https://ivlgnrhkubxjlbwvhzpm.supabase.co/functions/v1/send-enquiry`
- Inbox: `baraknachi987@gmail.com`

**Do not use the old FormSubmit ZIP.** This package does not use FormSubmit, so there is no activation email or FormSubmit activation screen.

## What was fixed

- The homepage and Contact page now submit to the Supabase Edge Function.
- The function uses Resend's test sender by default: `The Rowan House <onboarding@resend.dev>`.
- No custom domain or `ENQUIRY_FROM_EMAIL` secret is needed for a self-test.
- The recipient is fixed to `baraknachi987@gmail.com`.
- The API key stays in Supabase Function Secrets, not in browser code or GitHub.
- The function accepts the local Live Server origins on port 5500 and the configured GitHub Pages origin.
- Emails have a formatted HTML layout and use the guest email as Reply-To.

## Important Resend test-mode limitation

Resend's shared sender `onboarding@resend.dev` is for testing. It can only deliver to the email address associated with your Resend account. Therefore, the Resend account must be registered with `baraknachi987@gmail.com` for this exact setup to deliver to that inbox. If your Resend account uses a different email, Resend will reject the send. Sending to other recipient addresses in production requires a domain you own and have verified with Resend.

## 1. Confirm the API key secret

The function reads `RESEND_API_KEY` from Supabase Function Secrets. You said you already added this key, so **do not create or paste a new key unless the test reports that the key is missing or invalid**.

Open the dedicated project's Secrets page:

https://supabase.com/dashboard/project/ivlgnrhkubxjlbwvhzpm/functions/secrets

The required secret is:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | Your actual Resend API key beginning `re_` |

The sender and recipient are now set inside the deployed function. `ALLOWED_ORIGINS` is optional because the function includes the required default origins.

## 2. Run a real delivery test from PowerShell

1. Extract this ZIP.
2. Open PowerShell in the `rowan-house-premium-deploy` folder.
3. Run:

```powershell
.\Test-Enquiry.ps1
```

The script sends one clearly labelled test enquiry to `baraknachi987@gmail.com`, using a future check-in/check-out date. It prints the result returned by the live Supabase function.

Then check:

- Gmail Inbox
- Gmail Spam
- Resend Dashboard → Emails / Logs: https://resend.com/emails

A success response with an email ID means Resend accepted the message. Check the Resend event status and Gmail folder to confirm actual delivery.

### How to interpret failures

- **`RESEND_API_KEY is missing`**: the API key was not saved in the `rowan-house-enquiries` project's Function Secrets. Add it there.
- **`Resend rejected the API key`**: create a new sending API key in Resend and replace the `RESEND_API_KEY` Supabase secret.
- **`Resend's test sender only delivers...`**: the Resend account email is not `baraknachi987@gmail.com`. The test sender cannot send to another recipient without a verified domain.
- **`This website origin is not allowed`**: run the included test script as-is, or use VS Code Live Server on port 5500. The deployed GitHub Pages origin is already included.

## 3. Test through the website

1. Open the project in VS Code.
2. Use the free **Live Server** extension.
3. Right-click `site/index.html` and choose **Open with Live Server**.
4. Submit the homepage enquiry.
5. Repeat on `site/contact.html`.

Both forms use the same function. The email contains the guest name, email, dates, guest count, room preference, message and source page. The guest email is the Reply-To address.

## 4. Push and deploy with GitHub

Install Git and GitHub CLI if they are not installed:

```powershell
winget install --id Git.Git -e
winget install --id GitHub.cli -e
```

Reopen PowerShell, sign in with `gh auth login` if needed, then run:

```powershell
.\Push-To-GitHub.ps1
```

The script creates `baraknachi987-hash/rowan-house-premium-site`, pushes the project and the included GitHub Actions workflow publishes the `site` directory.

Expected address after GitHub Pages succeeds:

`https://baraknachi987-hash.github.io/rowan-house-premium-site/`

## Project structure

```text
rowan-house-premium-deploy/
├── site/                         # Six-page website, styles, JavaScript and favicon
├── supabase/functions/send-enquiry/index.ts
├── supabase/config.toml
├── Deploy-Supabase.ps1
├── Test-Enquiry.ps1
├── Push-To-GitHub.ps1
└── .github/workflows/deploy-pages.yml
```

## Important limitations

- Resend's test sender is for self-testing only. It is not an unrestricted production sender.
- This website sends enquiries; it does not check room availability, collect payment or confirm reservations.
- Enquiries are emailed and are not currently stored in a database table.
- The hotel brand and all contact details other than your notification inbox are fictional demo content. Replace them with business-approved information before real client use.
- The public Edge Function has input validation, a honeypot, origin checks and a basic per-instance rate limit. Add CAPTCHA and durable rate limiting before using this on a real public hotel website.
