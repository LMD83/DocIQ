# GovIQ DocRoute — Storage, Hosting, Security & Vaults Brief

> Addresses Decision D3 from the Productisation Brief. Pilot runs against HSE infrastructure via adapter. Commercial SaaS tiers run on the recommended stack below.
> **Date of research: April 2026. Prices quoted are 2026 public list prices; re-verify before contract.**

---

## 1. The stack has five layers, not one

"Storage" is a collapsing term that hides five distinct problems. Treat them separately or pay five times.

| # | Layer | What it holds | Failure mode if wrong |
|---|---|---|---|
| 1 | Application hosting | The Next.js web app; SSR; static assets | Slow UX, downtime; nothing regulator-facing |
| 2 | Application database / state | Tenant config, project config, documents table, audit log, register entries | Compliance exposure; audit failure; losing the golden thread |
| 3 | File / object storage | The actual PDFs, DWGs, XLSXs uploaded by users | Worst regulatory exposure; GDPR + patient data + Schrems II |
| 4 | Secrets / vault | API keys, DB credentials, Stripe keys, Claude keys, SMB creds for HSE | Breach blast radius; one leak compromises every tenant |
| 5 | Backup & archival | Point-in-time snapshots; cold copies for 7-year retention | Silent data loss; audit failure; insurer declines claim |

## 2. Constraints HSE (and Irish public sector) impose

Not opinions. Real procurement blockers if unmet.

- **EU data residency.** AWS provides EU regions including Ireland where organisations "can retain complete control over the Regions in which their data is physically located, helping them meet residency requirements." Personal / patient-adjacent data must not leave the EEA without GDPR Chapter V safeguards.
- **CLOUD Act sovereignty gap.** "When a European organization uses a U.S.-based cloud provider, it may be fully GDPR-compliant on paper, but in reality, there's a major legal contradiction... The U.S. CLOUD Act...allows American law enforcement to demand access to data, no matter where it's stored, as long as it's held by a U.S.-controlled entity." HSE's IG office will raise this even if hyperscaler EU-region is used. Mitigation: customer-managed encryption keys + contractual commitments + optional sovereign-cloud tier.
- **Cloud-first is official policy.** "At a macro level, all Irish public sector organisations should take a 'Cloud first' approach for all new systems. If a system is deemed not suitable for Public Cloud, a hybrid or private government Cloud model should be considered."
- **No active central IaaS framework.** OGP cancelled its €60m public-sector IaaS framework tender in January 2024 because "there were an insufficient number of compliant tenders received...to allow for the establishment of a multi-supplier framework agreement." Each body procures independently — either via OGP framework mini-competitions (€25k–€144k), or via full OJEU tender (>€144k), or direct award (<€25k).
- **HSE is already a Microsoft 365 tenant.** "All Microsoft 365 users now have access to SharePoint. SharePoint is a shared workspace that provides a secure environment for organising and storing large amounts of information." SharePoint/OneDrive/Teams are the incumbent storage surface, whether you like it or not.
- **HSE's construction CDE is Oracle Aconex** — expensive, Oracle-locked, but the existing system of record for drawings and issued documents. Don't try to replace it. Integrate read-only and export-compatible.
- **NIS2 Directive fully enforced 2026.** Incident reporting within 24 hours of detection. Implies: real log retention, SIEM-compatible audit trail, clear incident response process.

## 3. Recommended stack per layer

### Layer 1 — Application hosting
**Pick: Vercel, Frankfurt region (fra1)**
- Next.js deploys natively; used by Convex-native stacks.
- EU region available; no US egress.
- Free tier + $20/seat/month Pro tier; Enterprise adds SOC 2, SAML SSO, HIPAA BAA.
- **Alternative if customer demands full EU sovereignty:** Scaleway (France) Serverless Containers or OVHcloud Public Cloud (France). Performance roughly equivalent; developer experience a step down. Use for Programme/Estate tier only.

### Layer 2 — Application database & state
**Pick: Convex, EU deployment**
- Already the stated GovIQ stack. Single system for DB + file storage + queues + actions cuts surface area.
- **Caveat to verify before HSE contract:** Convex is a US-incorporated company, which brings the CLOUD Act question into scope. For the MVP launch that's acceptable (standard BYOK + DPA + SCCs). For a hard "EU-sovereign" Estate tier, fall back to a Postgres-on-OVHcloud or Postgres-on-Hetzner architecture with a thin Node layer. Do not build the sovereign tier until a deal requires it.
- Realistic TCO for MVP: Convex Starter $25/mo, Pro $100/mo. Usage-based beyond base tier.

### Layer 3 — File / object storage

This is the decision that matters most. Four concrete options, ranked for our use case:

| Provider | Storage /GB /mo | Egress | EU jurisdiction lock | CLOUD Act exposure | Best for |
|---|---|---|---|---|---|
| **Cloudflare R2 (EU jurisdiction)** | $0.015 | **$0 free** | Yes — "Jurisdictional restrictions (EU, FedRAMP) are permanent after bucket creation. Choose carefully as these cannot be changed later." | Yes (US-owned) — mitigate with CMEK + DPA | **Commercial SaaS default.** Lowest margin risk on egress; S3-compatible; EU-jurisdiction-locked. |
| **Azure Blob Storage (North Europe, Dublin)** | ~$0.018 | $0.087/GB | Yes (EU Data Boundary) | Yes (US-owned) | **HSE pilot.** Matches HSE's existing M365 tenant; procurement through Microsoft EA is easier than a new cloud vendor. |
| **AWS S3 (Europe — Ireland)** | $0.023 | $0.09/GB | Yes (region lock) | Yes (US-owned) | Enterprise tier only, when a customer already runs on AWS. Avoid as default — egress will eat margin. |
| **OVHcloud Object Storage (Gravelines, FR)** | ~$0.01 | included per plan | Yes — EU-owned, **no CLOUD Act exposure** | **No** | **Sovereign tier.** Offer to any customer whose procurement demands EU-owned. Lower maturity than hyperscalers. |

**Recommendation:**
- Default on **Cloudflare R2** for commercial SaaS tenants. Jurisdiction-locked to EU. Zero egress means our margin isn't exposed to customer download volume.
- **HSE pilot uses a storage adapter:** three modes — `R2` (default), `AzureBlob` (if HSE wants to keep data inside their M365 tenant), `SmbAdapter` (if they insist on the existing shared drive in Phase 1).
- Offer **OVHcloud** as the paid-upgrade "Sovereign" tier for any customer whose legal team demands no-CLOUD-Act providers.

### Layer 4 — Secrets / vault
**Pick: Convex environment variables for MVP. Infisical (EU-hosted) or 1Password Secrets Automation for Phase 2. Azure Key Vault only if required by enterprise procurement.**

- MVP: Convex has built-in env var support — adequate for ~6 months with <20 production secrets.
- Phase 2 (when we have multiple environments, rotation, third-party integrations): **Infisical** is open-source, EU-hostable, and free for <50 seats. Alternative: HashiCorp Vault self-hosted on Hetzner for full sovereignty.
- For keys used by the ingest worker that processes customer documents (Claude API key, Stripe secret): **encrypt with a Convex-owned KMS key**, rotate quarterly, never log in plaintext.
- HSE-specific: if HSE insists on their own key custody (BYOK), the adapter interface must accept a pre-configured Azure Key Vault reference. Programme/Estate tier feature only.

### Layer 5 — Backup & archival
**Pick: Backblaze B2 (EU-Central, Amsterdam) as cold-archive target. Replicate R2 buckets nightly.**

- "B2 Overdrive also provides unlimited free egress to any destination in the world. All B2 Cloud Storage users get free egress up to 3x their average monthly storage." Cheapest viable cold storage; no egress hit when you need to restore.
- Retention: 7 years minimum for HSE records (align with HSE Records Retention Policy — confirm during DPIA).
- Convex itself provides point-in-time recovery for the application database — no action needed beyond enabling it on the Pro tier.
- Document-level immutability (tamper-proof audit): use B2 Object Lock for the compliance tier — write-once-read-many for regulator-facing records.

## 4. Cost model per tier

Excludes Claude API costs (those are COGS on extraction quality, priced separately in the Productisation Brief). All numbers are infra-only, USD, monthly, average not peak.

| Tier | Convex | Vercel | R2 storage | R2 ops | B2 backup | Secrets | Total infra / tenant |
|---|---|---|---|---|---|---|---|
| Trial (200 docs, 1GB) | free | free | free tier | free tier | free tier | free | **$0** |
| Starter (5k docs, 5GB) | amortised $0.25 | amortised $0.50 | $0.08 | ~$0.05 | $0.03 | amortised | **~$1** |
| Project (25k docs, 50GB) | $1 | $1 | $0.75 | $0.50 | $0.30 | amortised | **~$3.50** |
| Programme (100k docs, 500GB) | $5 | $5 | $7.50 | $5 | $3 | $1 | **~$27** |
| Estate (HSE-scale, ~10GB baseline + growth) | negotiated | negotiated | ~$1/month base + growth | minimal | ~$0.50/month | BYOK | **bespoke; <$100/mo infra** |

**Sanity check vs. pricing tiers in the Productisation Brief:**
- Starter €400/mo, ~$1 infra → **99%+ gross margin before Claude API cost**
- Project €1,200/mo, ~$3.50 infra → **99%+ gross margin before Claude**
- Programme €3,500/mo, ~$27 infra → **99%+ gross margin before Claude**

The infra cost is a rounding error. **Claude API cost is the real COGS lever** — not storage. This is why the text-first extraction path and sha256 cache in the Productisation Brief matter so much.

## 5. Compliance & security checklist (pre-HSE-signature)

These must be true on the day HSE's IG office reviews us. None is optional for a public-sector sale.

### Data governance
- [ ] EU-only processing committed in DPA (SCCs where applicable)
- [ ] DPIA template completed for HSE pilot before files uploaded
- [ ] Sub-processor list published and kept current (Convex, Vercel, Cloudflare, Backblaze, Anthropic, Stripe)
- [ ] Customer-managed encryption keys (BYOK) supported on Programme+ tiers
- [ ] Data deletion on termination: automated, contractually bounded to 30 days, certified via export

### Security
- [ ] ISO 27001 certification from every sub-processor (Convex ✔, Cloudflare ✔, Vercel ✔, Backblaze ✔)
- [ ] SOC 2 Type II roadmap published (we commit to it; customers understand pilot may predate cert)
- [ ] MFA enforced for every admin account
- [ ] SSO (Microsoft/Google) on Project+ tiers
- [ ] Role-based access control (Owner / Admin / Controller / Reviewer / Viewer)
- [ ] Audit log append-only, 7-year retention, exportable CSV
- [ ] All traffic TLS 1.3 minimum
- [ ] Encryption at rest with KMS-managed keys
- [ ] Secrets never logged, never in git history — pre-commit secret scanner enabled

### Incident & reporting
- [ ] NIS2-compliant 24-hour incident notification process documented
- [ ] Breach notification template pre-drafted
- [ ] Observability pipeline logs to a single EU-hosted SIEM (Axiom EU or Elastic EU)
- [ ] Tabletop exercise run once before HSE go-live

### Contracts
- [ ] Anthropic zero-retention configured on our API key (no training on customer data) — verify contractually
- [ ] Stripe PCI-DSS scope limited to redirect / Stripe Elements — no card data touches our servers
- [ ] Cyber insurance — minimum €2m per-claim, public-sector clients often require €5m

## 6. What NOT to do

- **Don't build on HSE's infrastructure.** You can't demo it, can't scale it, can't sell it to the next customer. HSE is your anchor reference; the product has to be independent.
- **Don't try to replace Aconex.** Integrate read-only (export drawings register, match filenames) and export a CSV register that mirrors Aconex's document register format. Oracle lock-in is HSE's problem, not yours.
- **Don't self-host on a VPS.** Enterprise procurement rejects this. Managed is the safer story even when it costs more.
- **Don't default to AWS S3.** It's the "nobody got fired for buying IBM" choice, but "AWS S3 costs nearly 7x what Wasabi costs for the same workload. Cloudflare R2 is 2.6x more than Wasabi on storage, but the zero egress makes it excellent for workloads where egress is the dominant cost driver."
- **Don't assume an EU region of a US provider = sovereign.** "You can use EU regions of major cloud providers, but you must verify that data processing, backups, support access, and subprocessor activities all remain in the EU." Be explicit about what EU actually means in your DPA.
- **Don't mix payment data into our DB.** Stripe Elements client-side only; server never sees a PAN.

## 7. Procurement path for HSE

Three realistic scenarios; size of the deal dictates the route.

### Scenario A — Pilot under €25k
- Direct award; standard quote and PO
- HSE's own procurement rules apply at division level
- Probably a proof-of-value exercise funded from HSE Estates discretionary budget
- **Fastest path to first revenue.** Aim for this.

### Scenario B — €25k–€144k (Programme tier or 2-year commit)
- OGP framework mini-competition
- Most relevant frameworks: **PAS097F** (Business Management & ICT Consultancy) Lot 5 / Lot 11; or an eTenders direct listing
- Need to be listed on a framework to bid
- Timeline: 6–12 weeks
- **Your action:** get GovIQ onto OGP framework PAS097F or equivalent during Q3 2026

### Scenario C — Above €144k (multi-year national rollout, Estate tier)
- Full OJEU tender on eTenders.gov.ie
- 3–9 months
- Requires: ISO 27001 on us or primary sub-processors, SOC 2 Type II preferred, financial standing (audited accounts), reference customers (HSE pilot + at least one other)
- **Not an MVP concern. This is Year 2.**

## 8. Decisions we need on storage

| # | Decision | Options | Recommendation | Status |
|---|---|---|---|---|
| S1 | Default object storage for SaaS tenants | R2 / Azure / AWS / OVH | **R2 EU-jurisdiction** | Decide this week |
| S2 | HSE pilot storage adapter | R2 / Azure (HSE M365) / SMB (existing drive) | **Start with SMB adapter; migrate to Azure Blob within pilot if HSE agrees** | Raise with HSE pilot sponsor |
| S3 | Backup target | B2 / R2 second bucket / Wasabi | **B2 Amsterdam** | Decide in week 5 |
| S4 | Sovereign tier provider | OVHcloud / Scaleway / Exoscale | **OVHcloud** (most mature, most enterprise-ready) | Defer until a deal requires it |
| S5 | Secrets vault for Phase 2 | Infisical / HashiCorp / Azure Key Vault | **Infisical EU self-host** | Decide in week 6 |
| S6 | EU sovereignty claim level on marketing page | "EU regions" / "EU jurisdiction" / "EU-sovereign" | **"EU-hosted, EU-jurisdiction-locked" — reserve "EU-sovereign" for the OVH tier** | Legal review before landing page |

## 9. Action items — next 14 days

1. **Set up a Cloudflare account** with R2 EU-jurisdiction bucket for dev; provision production bucket in week 2
2. **Set up Convex EU deployment** and verify data residency for our Anthropic deal (speak to Convex if EU-native deployment isn't offered as a self-serve option — it isn't universal across all paid tiers)
3. **Draft the DPA template** — use OGP Cloud Services Procurement Guidance Note Appendix 1 as the checklist
4. **Draft the sub-processor list** — publishing this becomes a sales asset on the landing page
5. **Set up Backblaze B2 EU** account for backups; nightly sync job in week 5
6. **Start conversation with HSE pilot sponsor** about S2 — SMB adapter vs. Azure Blob vs. R2 — clarify what their IG office will accept
7. **Review Anthropic's API terms** — confirm zero-retention and enterprise DPA options for the Claude API key used in extraction
