# Internal processing record: clinical notes and AI assistance

**Short working record for a sole-practitioner service — review annually and whenever the
system changes.**

| Item | Recorded position |
| --- | --- |
| Controller | Ayesha Jane Walker / Ayesha Jane |
| People covered | Current and former therapy, counselling and coaching clients; information about third parties may occasionally appear where relevant |
| Purpose | Providing and administering therapy; continuity and quality of care; professional record keeping; safeguarding and handling concerns or legal obligations |
| Information | Identity and contact details; appointments; agreements; payments; brief clinical/session notes; health and relationship information; communications relevant to the service |
| Article 6 basis | **To confirm:** contract where processing is necessary to provide the agreed service; legitimate interests and/or legal obligation where applicable for professional administration, safeguarding and legal record keeping |
| Article 9 condition | **To confirm before publication:** Article 9(2)(h) health or social care where the professional-secrecy requirements apply; obtain specialist advice or use another valid condition if they do not |
| Storage processor | Supabase — authenticated database, row-level access controls and note-version history; current database region: Stockholm, EU |
| Optional AI processor | OpenAI API — text improvement only, `store: false`, no automated clinical decision, mandatory human review; standard abuse-monitoring retention may be up to 30 days |
| Access | Ayesha's approved administrator account only; no client-facing or anonymous note access |
| Disclosure | Only where necessary for the service, with the client's authority, to processors providing the system, or where required/permitted for safety or law |
| Retention | Adult clinical records are normally retained for seven years after the therapeutic relationship ends, then reviewed and securely deleted unless a specific legal, safeguarding, complaint or insurance hold applies |
| Security | HTTPS; Supabase authentication and row-level security; server-side API key; private device login; audit versions; MFA should remain enabled |
| Individual rights | Privacy information, access procedure, correction/amendment process, restriction/objection/erasure considered according to the applicable legal basis and professional record duties |
| Automated decisions | None. AI only suggests revised wording and Ayesha checks it before saving or use |
| Review | Annually, after a security incident, or when Supabase/OpenAI/data location/AI behaviour materially changes |

## Simple working rules

1. Write only what is relevant and professionally useful.
2. Avoid unnecessary names, addresses and identifying details about third parties.
3. Check an AI revision against the rough note; never assume it is accurate.
4. Do not use AI to diagnose, score risk or decide treatment.
5. Correct notes through an amendment so the earlier version remains auditable.
6. Lock the device when unattended and never share administrator credentials or API keys.
