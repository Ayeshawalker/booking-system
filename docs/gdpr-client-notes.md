# GDPR notes for client notes and AI drafting

> **August 2026 update:** The earlier implementation notes below described the prototype.
> Secure Supabase storage, administrator access, version history and the authenticated
> OpenAI wording-assistance function are now implemented. Use the current working drafts:
>
> - `privacy-notice-clinical-notes-ai-draft.md`
> - `clinical-notes-processing-record-draft.md`
> - `clinical-notes-ai-dpia-screening-draft.md`

This project can support GDPR-aware workflows, but code changes alone do not make the service GDPR compliant. Before using real client notes, Ayesha should document the decisions below and have the setup reviewed by an appropriate professional.

## Why this needs extra care

Therapy notes are likely to include UK GDPR special category data because they can reveal information about a person's physical or mental health. AI-assisted rewriting also means personal data may be processed by an AI system, so the provider, data flow, storage, retention and human review process need to be understood before real use.

## Minimum decisions to document before real use

- Controller details and who can access client notes.
- Privacy information given to clients, including AI-assisted drafting if used.
- Article 6 lawful basis for processing the notes.
- Article 9 condition for special category health data.
- Whether an appropriate policy document is required.
- Whether a DPIA is required, and the result if one is completed.
- Data minimisation rules for what should and should not be written in notes.
- Retention period and review/deletion schedule.
- Security controls: authentication, device security, encrypted transport, database access controls and backups.
- Client rights process: access, rectification, erasure/restriction where applicable, and audit trail.
- AI provider review: where data is sent, whether it is retained or used for training, subprocessors, region, contract/DPA and deletion terms.
- Human review rule: AI output must be checked by Ayesha before filing or use.

## Current app controls

- The notes page is separate from booking settings.
- The notes page requires a simple private-use acknowledgement before improving or saving notes.
- The acknowledgement states that the page is for Ayesha only and that AI-improved text will be reviewed before saving.
- Notes can include an optional review date for retention housekeeping.
- Notes can be exported as JSON for portability/access handling.
- All locally saved notes can be deleted from the browser.

## Current limitations

- Notes are still saved in browser local storage, which is not suitable as a long-term clinical record system.
- There is no administrator login or per-user access control yet.
- There is no encrypted server-side notes database yet.
- There is no audit trail for note reads, edits, exports or deletion.
- There is no automated retention deletion.
- The AI improvement currently runs locally unless a secure Supabase Edge Function is configured.

## Safer production direction

Move client notes into a secure server-side table with row level security, authenticated admin access, audit logs, retention metadata, encrypted backups and a server-side AI improvement function. Keep all AI provider keys server-side and only use a provider/configuration that has been reviewed for special category health data.

Useful source guidance:

- ICO special category data guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/
- ICO AI and data protection guidance: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/artificial-intelligence/guidance-on-ai-and-data-protection/
