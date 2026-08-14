# Clinical notes and AI: go-live checklist

This is an implementation checklist, not legal advice. Complete it before putting real
client notes into the system or enabling AI improvement.

## Governance

- Document the Article 6 lawful basis and Article 9 special-category condition.
- Complete and retain a Data Protection Impact Assessment covering clinical notes and AI.
- Update the client privacy notice to explain note storage, processors, AI-assisted editing,
  retention, client rights and international/regional processing.
- Record Supabase and the AI provider in the processor register and retain their DPAs.
- Confirm professional-body, insurer and record-retention requirements.
- Decide and document retention periods, review dates, archive and secure-deletion rules.

## Technical controls

- Require the existing authenticated administrator account and MFA.
- Keep notes inaccessible to anonymous and client-facing application roles.
- Keep OpenAI credentials only in Supabase Edge Function secrets.
- Use `store: false`; do not enable web search, file search, memory or third-party tools.
- Confirm the selected OpenAI project retention and data-residency controls.
- Test database backups and restoration before relying on the system as the sole record.
- Review audit history, access logs and Supabase security advisories regularly.

## Working practice

- Minimise unnecessary names, addresses, contact details and third-party information.
- Review every AI suggestion against the original before saving or finalising it.
- Do not use AI output as a diagnosis, risk assessment or treatment decision.
- Correct records through a traceable amendment; do not silently overwrite history.
- Use a private, encrypted device with a locked user account and current security updates.
- Maintain a documented breach-response and subject-access process.
