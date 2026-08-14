# Proportionate DPIA screening: clinical notes and AI wording assistance

**Date:** 10 August 2026  
**Owner:** Ayesha Jane Walker  
**Status:** Draft screening and short-form risk assessment

## What is happening?

Ayesha writes client notes in an authenticated private system. Notes are stored in
Supabase. At Ayesha's request, selected rough-note text can be sent to an authenticated
Supabase Edge Function and then to the OpenAI Responses API to suggest clearer wording.
The request uses `store: false`. The suggestion is displayed separately and is never
automatically accepted, finalised, sent to a client or used to make a clinical decision.

## Why is it needed?

To keep clearer, more consistent and concise professional notes while reducing
administrative time. The purpose is editing Ayesha's own wording, not assessment,
diagnosis, profiling or treatment selection.

## Screening factors

- The notes may contain special-category health information.
- AI is used, but only as an optional writing assistant.
- Processing is limited to one small independent practice rather than large-scale data.
- There is no systematic profiling or solely automated decision with significant effects.
- Identifying details can be minimised before AI use.

Because sensitive data and AI are combined, recording the risks is prudent. This
short-form assessment is intended to be proportionate to the small scale and limited
purpose. Reassess whether a fuller DPIA is required if the system begins making clinical
recommendations, processing notes in bulk, serving other practitioners, handling much
larger numbers, or connecting to additional AI tools.

## Risks and safeguards

| Risk | Existing or required safeguard | Residual assessment |
| --- | --- | --- |
| An unauthorised person sees notes | Admin authentication, database row-level security, HTTPS, private device and MFA | Low if access controls and device security are maintained |
| AI changes meaning or invents information | Original and suggestion shown separately; mandatory human review; restrictive editing prompt; no automatic finalisation | Low to medium; accuracy remains Ayesha's responsibility |
| Too much identifying information is sent | Working rule to remove unnecessary names, contact details and third-party identifiers; only the rough text is sent | Medium until this becomes routine practice |
| Provider retains submitted content | `store: false`; no training by default; standard abuse-monitoring logs may retain content for up to 30 days; record and review provider terms | Medium and transparent disclosure required |
| Records are retained too long | Adult clinical records are reviewed seven years after the therapeutic relationship ends; archive/version controls support housekeeping; documented holds cover exceptional legal, safeguarding, complaint or insurance needs | Low to medium |
| A client does not know AI may be used | Add the drafted wording to the privacy notice before routine identifiable use | Low after notice is issued |
| Lost access or data loss | Supabase-managed storage; test backup/export and recovery arrangements | Medium until recovery is tested |
| AI is mistakenly treated as clinical advice | System and working policy limit it to wording; no diagnosis, risk scoring or treatment decisions | Low if scope is maintained |

## Outcome

The proposed use is limited and includes meaningful human control. No high-risk automated
decision-making is present. It may proceed on a small-practice basis once the following
items are completed, with annual review:

- [ ] Confirm and record the Article 6 lawful basis and Article 9 condition.
- [x] Retention decision recorded: seven years after the adult therapeutic relationship ends, subject to a documented hold where necessary.
- [ ] Add the AI and cloud-storage wording to the client privacy notice.
- [ ] Keep copies/links to the applicable Supabase and OpenAI processor terms or DPAs.
- [ ] Confirm MFA and test a practical backup/recovery method.
- [ ] Use the data-minimisation and mandatory human-review rules above.

If any material change increases the scale, automation or clinical influence of the AI,
stop and complete a fuller DPIA before that change goes live.
