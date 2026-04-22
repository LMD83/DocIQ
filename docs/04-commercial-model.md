# GovIQ DocRoute — HSE Commercial Model (Side Fork)

> **Scope:** costed service package for HSE; pilot → regional → national pricing; GovIQ cost-to-serve; margin glide path; value proposition to sell it.
> **Status:** working model based on Estate Spine PRD discovery data and published HSE structure. **Numbers are assumptions, not quotes. Validate each against an actual IHA before any commercial commitment.**
> **Sized around:** 20 IHAs across 6 HSE Health Regions (per HSE National Service Plan 2026); HSE 2026 budget €29bn; 136,606 WTE staff limit; stated digital transformation priority in NSP 2026.

---

## 1. What HSE is actually buying (service package)

Six components. Any "Full Service" contract bundles all six with tier-dependent SLAs and usage allowances.

| # | Component | What it covers | Pricing basis |
|---|---|---|---|
| **S1** | Initial rework / backlog ingestion | One-time walk of an IHA's existing file tree; parse all files against NEIS; credibility-score; rename the compliant; route to canonical folders; produce starting MasterRegister + per-site synopses; train local document controllers | **Fixed fee per IHA**, scaled by file count |
| **S2** | Platform subscription | Hosted GovIQ DocRoute app; upload + review + register UI; audit log; role-based access; SSO; user seats | **Monthly per IHA**, tiered by docs/month and seats |
| **S3** | Ongoing document processing | Live ingest of new documents; automated extraction; credibility scoring; filing; register updates; storage | **Included up to tier limit**, metered above |
| **S4** | Support & fixes | L1 helpdesk; L2 engineer escalation; named account contact; monthly review; bug fixes within SLA | **Included in tier** |
| **S5** | Monitoring & reliability | 24/7 platform monitoring; status page; SLA on uptime; incident response; post-mortem on P1 incidents; annual DR test | **Included in tier** |
| **S6** | Professional services | Custom integrations (Aconex read, SharePoint/Fieldwire sync); custom reports; bespoke training; data remediation beyond standard scope | **Day rate** (€1,100/day senior engineer; €800/day customer success) |

### Explicitly not in the package
- Replacement of Aconex, Fieldwire, or any CDE HSE already runs (we integrate, not replace)
- Redaction / anonymisation of clinical data inside documents (flag-only in Phase 1)
- Migration of live project documents out of Aconex during a live capital project
- Primary authorship of NEIS convention changes (HSE owns the convention; we implement)
- BIM model authoring / coordination (not our product)

## 2. Volume assumptions per IHA

Derived from Estate Spine PRD discovery data for Dublin North Eastern (the most advanced region) and pro-rated to IHA scale. Treat as ranges; every real IHA will differ.

| Variable | Small IHA | Typical IHA | Large IHA |
|---|---|---|---|
| Buildings within IHA | 40 | 80 | 150 |
| Sites (DN codes) | 30 | 70 | 120 |
| **Existing file backlog (to rework)** | **2,000** | **4,500** | **8,000** |
| Of which parseable without OCR | 85% | 90% | 92% |
| **Ongoing new-doc ingest (per month)** | **300** | **800** | **1,800** |
| Active user seats | 4 | 8 | 15 |
| Document controllers (primary users) | 1 | 2 | 4 |
| Concurrent capital projects generating docs | 2 | 5 | 12 |

**Baseline assumption for the default pricing: "Typical IHA" figures.** Build a simple survey for HSE to confirm per-IHA before contract; move any outliers to a bespoke tier.

## 3. GovIQ cost to serve (bottom-up)

### 3.1 One-time onboarding cost per IHA

| Line item | Hours | Rate | Cost |
|---|---|---|---|
| Project kickoff + data access | 8 | €110 | €880 |
| Discovery walk + inventory | 12 | €110 | €1,320 |
| Convention / originator calibration against IHA data | 16 | €110 | €1,760 |
| Backlog parse + extract + credibility run | 8 | €110 | €880 |
| Review queue burn-down support (4,500 docs × 15% review rate × 2 min each ÷ 60) | ~22 | €80 (CS rate) | €1,800 |
| Canonical folder reorganisation + move scripts | 20 | €110 | €2,200 |
| Training workshop (controllers + managers, half day + materials) | 8 | €110 | €880 |
| Sign-off + handover documentation | 8 | €110 | €880 |
| **Labour subtotal** | **102** | | **€10,600** |
| Claude API — backlog ingest (4,500 docs × €0.06 avg) | | | €270 |
| Claude API — vision on scanned PDFs (~10% × €0.15) | | | €68 |
| Compute + storage (one-time, R2) | | | €30 |
| **Variable subtotal** | | | **€370** |
| Contingency (15%) | | | €1,645 |
| **Total delivery cost per IHA onboarding** | | | **~€12,600** |

Price tag to HSE per onboarding: **€25,000 (pilot) → €18,000 (regional rollout) → €15,000 (national).** Margin glide from ~50% on pilot to ~60% at national scale as playbook tightens.

### 3.2 Monthly cost to serve per IHA (steady state)

| Line item | Monthly |
|---|---|
| Infrastructure (Convex allocation + R2 storage + egress + Vercel share) | €15 |
| Claude API — ongoing ingest (800 docs × €0.04 avg + 20 OCR × €0.15) | €35 |
| Support labour (avg 3 hrs/month × €80) | €240 |
| Customer success labour amortised (0.05 FTE at €80k ÷ 12 ÷ 1) | €330 |
| Monitoring, observability, backups | €20 |
| Security, compliance, DPO allocation | €60 |
| **Direct monthly cost per IHA** | **~€700** |

Price tag: **€3,500 (pilot, no volume discount) → €3,000 (regional) → €2,750 (national).** Steady-state gross margin ~75–80%.

### 3.3 Fixed costs to absorb (across all GovIQ customers, not just HSE)

| Function | Year 1 | Year 2 |
|---|---|---|
| Engineering (2 FTE loaded) | €280,000 | €320,000 |
| Customer success (0 → 1 FTE Y1; 1 FTE Y2) | €40,000 | €85,000 |
| Sales & BD (founder-led Y1; half-hire Y2) | €30,000 | €70,000 |
| Security & compliance programme (SOC 2 audit, DPO retainer, pen-test) | €65,000 | €45,000 |
| Platform infra baseline (beyond per-tenant) | €15,000 | €25,000 |
| Legal, insurance, accounting | €20,000 | €30,000 |
| **Total fixed** | **€450,000** | **€575,000** |

**Allocation rule:** HSE carries a proportional share of fixed costs based on HSE's % of GovIQ's total revenue. If HSE is 70% of revenue, HSE absorbs 70% of fixed. Don't allocate 100% of fixed to HSE even when they're the only customer — that kills the unit economics narrative. The fixed base is the cost of being in the market.

## 4. Pricing — three scenarios

All figures exclude VAT. All exclude professional services (charged separately at day rate). All in Euros.

### 4.1 Pilot — 1 IHA (Dublin North Eastern, recommended)

| | Year 1 (pilot) |
|---|---|
| Onboarding (one-time) | €25,000 |
| Platform subscription (€3,500/mo × 12) | €42,000 |
| Support uplift (included) | €0 |
| Professional services allowance (10 days bank) | €11,000 |
| **Total pilot revenue (12 months)** | **€78,000** |
| GovIQ delivery cost (onboarding + monthly direct + pro-services labour) | ~€32,000 |
| HSE-allocated fixed cost share (est. 15% of fixed in Y1) | ~€68,000 |
| **Total GovIQ cost** | **~€100,000** |
| **Pilot gross margin** | **-28%** (pilot is investment, not profit) |
| Pilot gross margin excluding fixed cost absorption | **~59%** |

> **Framing:** pilot is priced to prove the product, not to profit. The absorbed fixed cost is the cost of being a credible vendor to the public sector. Break-even happens at regional rollout.

### 4.2 Regional rollout — 5 IHAs (one complete Health Region, e.g. Dublin & North East)

Assumes onboarding spread over 4 months; steady state from month 5.

| | Year 1 (partial) | Year 2 (full year) |
|---|---|---|
| Onboardings (5 × €18,000) | €90,000 | — |
| Platform subscription (5 × €3,000/mo × avg 8 months in Y1 / 12 in Y2) | €120,000 | €180,000 |
| Regional management tier (single point of coordination) | €15,000 | €20,000 |
| Professional services (30-day bank Y1; 20-day Y2) | €33,000 | €22,000 |
| **Revenue** | **€258,000** | **€222,000** |
| Onboarding delivery cost (5 × €11,500) | €57,500 | — |
| Monthly direct cost (5 × €700 × avg 8 / 12) | €28,000 | €42,000 |
| Pro-services labour delivery | €25,000 | €16,000 |
| Fixed cost share (est. 35% of fixed) | €158,000 | €201,000 |
| **Total cost** | **€268,500** | **€259,000** |
| **Margin** | **-4%** | **-14%** |
| Margin excluding fixed cost absorption | **52%** | **65%** |

> **Framing:** regional rollout still absorbs material fixed cost. Profitable per-deal contribution margin (52–65%) but the business as a whole doesn't break even on HSE alone until national scale or until non-HSE revenue arrives.

### 4.3 National rollout — 20 IHAs (complete HSE Estate)

Assumes staged rollout across 15 months (months 1–3 discovery, 4–18 deliveries), then steady state.

| | Year 1 (rollout) | Year 2 (steady state) | Year 3 (steady state) |
|---|---|---|---|
| Onboardings (20 × €15,000, spread across Y1) | €300,000 | — | — |
| Platform subscription (€2,750/mo × 20 × avg 7 in Y1; full in Y2+) | €385,000 | €660,000 | €679,800 (3% uplift) |
| National tier (HSE Centre oversight; programme management; bespoke reporting) | €60,000 | €80,000 | €82,400 |
| 24/7 support uplift (P1 incident cover) | €40,000 | €60,000 | €61,800 |
| Professional services (day-rate bank) | €120,000 | €100,000 | €100,000 |
| **Total revenue** | **€905,000** | **€900,000** | **€924,000** |
| Onboarding delivery cost (20 × €10,500) | €210,000 | — | — |
| Monthly direct cost | €98,000 | €168,000 | €173,000 |
| Pro-services labour delivery | €90,000 | €72,000 | €72,000 |
| National tier delivery (dedicated CSM 0.5 FTE) | €20,000 | €45,000 | €47,000 |
| HSE-allocated fixed cost share (est. 50% Y1; 45% Y2; 35% Y3 as other customers grow) | €225,000 | €259,000 | €230,000 |
| **Total cost** | **€643,000** | **€544,000** | **€522,000** |
| **Gross margin €** | **€262,000** | **€356,000** | **€402,000** |
| **Gross margin %** | **29%** | **40%** | **43%** |
| Contribution margin (excl. fixed allocation) | **54%** | **69%** | **68%** |

> **Framing:** at national scale GovIQ crosses the profitability line in Year 1 and delivers 40%+ gross margin in Year 2 while absorbing a fair share of platform fixed costs. Contribution margin of 68–69% is the number that justifies the SaaS valuation narrative.

### 4.4 Total HSE lifetime value

Years 1–3 total: **€2.73m revenue** (with 3% annual uplift thereafter). Assuming a 5-year initial contract with 3% annual uplift from Y4: **€4.65m over 5 years.**

## 5. What HSE pays per year (their view)

A cleaner version for the HSE procurement pack.

| Rollout stage | Annual fee (ongoing) | One-time onboarding | Term |
|---|---|---|---|
| Pilot (1 IHA) | €42,000 | €25,000 | 12 months |
| Regional pilot (5 IHAs) | €200,000 | €90,000 | 12 months |
| National (20 IHAs) | €680,000 | €300,000 total (staged) | 3 years with 2-year option |
| National + HSE Centre tier | €800,000 | €300,000 total | 3+2 |

**Per-IHA effective cost at national scale: ~€34,000/year.** For context: HSE 2026 budget is €29bn; a single Grade VIII document controller FTE (the role this partly automates) costs ~€95k fully loaded. One IHA saves 0.5 FTE = break-even in year one on labour alone, before counting audit risk reduction.

## 6. Scope of the pilot

Recommending Dublin North Eastern as the anchor IHA for the pilot because:
1. Discovery already complete — 6,324 files inventoried, 196 buildings mapped, calibration data exists
2. Estate Spine engine is already tuned for this data; we'd be running live, not cold-starting
3. Closest to the HSE Capital Estates team that owns the NEIS convention — fastest feedback loop on convention drift

### Pilot deliverables (12 months)

| Month | Milestone | Measurable outcome |
|---|---|---|
| 1 | Contract, DPIA, DPA signed; production tenant provisioned; SSO configured | HSE user can sign in and see their project |
| 2 | Full backlog ingested (4,500–6,000 docs); credibility scores calibrated; review queue populated | ≥ 70% auto-publish rate on first pass |
| 3 | Review queue burn-down session; canonical folder tree applied; MasterRegister v1 published | Match ≥ 95% of existing register entries with zero data loss |
| 4 | Per-site synopsis generation live; first monthly service review | 196 synopses generated within 15 minutes |
| 5–10 | Steady-state operation; monthly register refresh; support tickets <4/month | P95 processing time <30 seconds; support SLA met |
| 11 | Internal audit trial — simulate HIQA / BCAR review | Find any filed document in ≤ 10 seconds |
| 12 | Pilot close-out report; national rollout business case; go/no-go decision | Pilot report with cost-benefit evidence ready for REO sign-off |

### Pilot success criteria (written in the contract)

- ≥ 90% of uploaded files processed within 30 seconds (p95)
- ≥ 70% auto-publish rate on first pass against NEIS
- Zero silent failures — every document resolves to filed / review / quarantine
- Zero data loss — every file traceable by sha256 from upload to filed state
- Full audit trail exportable in CSV at any time
- At least 80% NEIS filename adoption by consultants submitting to this IHA within 9 months
- One incident-response tabletop exercise completed without escalation to HSE leadership

## 7. Value propositions — the sales case for HSE

Ordered to match HSE's stated 2026 priorities. Every bullet is defensible with either a number or a direct quote from HSE's own National Service Plan 2026.

### For the REO (Regional Executive Officer) and HSE leadership
1. **Directly supports NSP 2026 digital transformation priority.** Gloster's NSP 2026: "we will advance digital health solutions...to improve patient and service user experience while ensuring value for the funds invested in us." This is a named priority, with budget attached.
2. **Delivers value-for-money evidence on day one.** HSE manages €29bn in 2026. One Grade VIII document controller costs ~€95k loaded. DocRoute saves ~0.5 FTE per IHA × 20 IHAs = ~€950k/year in labour time reclaimed, against a €680k/year platform fee. Net **~€270k/year saved**, plus audit risk reduction.
3. **Aligns with the IHA structure, doesn't fight it.** 20-IHA rollout built into the product from MVP. No retrofit, no bespoke work.
4. **Sláintecare integration ready.** A unified filing convention across acute and community sites is a pre-condition for integrated record-keeping across the IHAs. DocRoute delivers that.

### For the Estate team (your direct buyer)
5. **The engine already works on your data.** 6,324 HSE files walked; 196 buildings mapped; parser and credibility model calibrated against real Dublin North Eastern output — not vapourware, not a hypothesis.
6. **Enforces the HSE NEIS convention you already approved.** Rev 11, March 2022, HSE C&E SMT-approved. Not a new standard — your standard, finally enforced at every upload.
7. **Integrates Aconex, SharePoint, Fieldwire read-only.** Your existing CDE stays; we stop consultants fragmenting the filing. No rip-and-replace.

### For the IG Office / HIQA / regulator-facing case
8. **Audit trail that survives regulator scrutiny.** Every state change logged, append-only, 7-year retention, exportable CSV. HIQA inspection, BCAR certification, FSC / DAC reviews all rely on being able to produce the evidence — DocRoute makes that a five-minute task.
9. **Statutory compliance visibility at portfolio level.** BER, Fire Cert, DAC, Condition Rating, HIQA, Legionella fields exposed per-building; gap reports show which buildings have ≥3 critical compliance gaps. Today: ~95% of the register is blank on these fields. DocRoute makes the gap visible, then closes it.
10. **GDPR / NIS2 / EU Data Boundary compliant by design.** EU-only processing, DPA + DPIA templates, incident response inside NIS2's 24-hour window, sovereign-tier option available for sites with elevated sensitivity.

### For the CFO / procurement / value-for-money case
11. **Per-IHA cost equivalent to 0.35 of a Grade VIII controller FTE.** At €34k/year/IHA against €95k/FTE saved, payback is under 5 months per IHA.
12. **Prevents stage-gate delays on capital works.** CWMF projects stall at stage gates when registers don't match folder state. Every stalled week costs more than the annual licence fee on a €20m project.
13. **Reduces dependency on expensive CDE seats.** Aconex is typically ~€100–200/user/month; DocRoute consolidates filing before anything hits Aconex, meaning fewer users need full Aconex seats.
14. **Fixed, predictable annual cost.** Not consumption-based. Budget cycle friendly.

### For the Digital / ICT function
15. **No procurement of net-new infrastructure.** We run on Convex EU + Cloudflare R2 EU-jurisdiction + Vercel EU — no new HSE hosting.
16. **SSO with HSE M365.** Microsoft identity + audit flow-through; no new identity store.
17. **Zero training on customer data.** Claude API configured for zero-retention; no HSE data enters any model's training set.

### Procurement framing
18. **Pilot sits below OGP direct-award threshold.** Pilot priced €67,000 excluding professional services — below the €25k + €42k subscription contract structure → can be split into a €25k onboarding PO + year-one subscription PO, both direct-awardable.
19. **National rollout fits the OGP framework route.** ICT Consultancy / Cloud Services framework mini-competition path; no full OJEU tender required if we secure framework listing before Year 2.

## 8. Risks to the commercial model

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| IHAs vary more than our "Typical IHA" model assumes; onboarding costs blow out on Large IHAs | **H** | M | Per-IHA sizing survey in the contract; Large IHAs carry a €25k onboarding (vs €15k baseline) |
| HSE procurement rejects per-IHA pricing; demands flat national fee | M | H | Offer both structures in the proposal; per-IHA preferred, flat national as fallback with consumption caps |
| Pilot drags past 12 months; no go/no-go decision | **H** | **H** | Contract includes a 60-day written notice on pilot extension; GovIQ not liable to keep scale team allocated without decision |
| Claude API cost inflates faster than assumed | M | M | Text-first path; sha256 cache; bundle pricing based on doc volume not API cost — risk is on GovIQ but hedged by volume ceilings per tier |
| HSE NEIS Rev 12 drops mid-contract; requires re-seeding | L | L | Convention versioning built in from day one; minor version bumps free, major versions = €8k engineering change |
| Mid West IHA implementation delayed indefinitely; national rollout stuck at 18 IHAs | M | L | Price on active IHAs only; Mid West added when HSE activates them |
| Another vendor undercuts at procurement (Version 1, Deloitte, Ocuco, etc.) | **H** | **H** | Reference deployment on real HSE data + HSE-specific engine = defensible moat; sell the work done, not just the product |
| HSE Estate team reorganised during rollout; sponsor lost | M | **H** | Contract signed by HSE Capital & Estates at national level, not regional; sponsor succession named explicitly |
| GDPR / data sovereignty escalation forces move to OVHcloud | L | M | Storage adapter interface ready; OVHcloud migration costed at ~€35k one-time; passed through to HSE if demanded post-contract |

## 9. Negotiation levers you can afford to give

In order of "cheap to give" → "expensive to give":

1. **Extended payment terms** (45 → 60 days) — low cost, high perceived value
2. **Free NEIS Rev 12 upgrade** — low cost (engineering anyway), high perceived value
3. **Additional training sessions** — ~€800 each; bundle up to 3
4. **Free professional services days** — ~€1,100/day each; bundle up to 10 across Year 1
5. **First 3 months of subscription at 50%** — ~€5k cost; useful if HSE wants a soft-start
6. **Onboarding fee waiver on IHAs 18–20** — ~€45k cost; keeps national rollout momentum
7. **Annual price lock for 3 years (no uplift)** — ~€40k cost across 3 years; signals partnership

**What you refuse:**
- Source-code escrow without a 5× price premium (€250k+)
- Unlimited-seat contracts (invites consultant sprawl; cap at defined ratio)
- Liability cap above 1× annual contract value (industry standard, hold the line)
- Exclusive rights in Irish public sector (kills the non-HSE market)

## 10. Decisions & actions — next 30 days

| # | Decision / action | Owner | Deadline |
|---|---|---|---|
| C1 | Validate "Typical IHA" volume assumptions with a real IHA (not Dublin NE, where we already know — pick Midlands or South West) | Liam | 14 days |
| C2 | Confirm HSE Capital & Estates sponsor has budget authority for pilot-scale spend (≤ €80k) or needs REO sign-off | Liam | 7 days |
| C3 | Get listed on OGP framework PAS097F / ICT Consultancy panel | Liam + procurement advisor | 90 days (process) |
| C4 | Publish sub-processor list + DPA template on GovIQ website | GovIQ | 21 days |
| C5 | Draft the pilot contract using OGP Sample Contract from Cloud Services Procurement Guidance Note 2025 as the template | Legal | 14 days |
| C6 | Prepare the "how to read this" one-pager for the HSE CFO / value-for-money audience (based on §7) | GovIQ | 10 days |
| C7 | Identify the second reference customer after HSE pilot (Local Authority estates team) to de-risk single-customer concentration | Liam | 60 days |

## 11. What this model is NOT

- **Not a quote.** Figures are working assumptions. Every number needs validating against real IHA data before any commercial commitment.
- **Not exhaustive.** Doesn't cost bespoke integrations (Aconex write-back, Fieldwire sync) — those are professional services on day rate.
- **Not defensive.** Assumes HSE runs a competitive procurement. Win rate falls sharply if we let a consultancy (Deloitte, Version 1, PwC) package DocRoute as the tech layer under their services wrapper — address this in the sales plan, not here.
- **Not investor-ready.** An investor pitch translates these numbers into ARR, net retention, CAC/LTV, rule-of-40. That's a separate document — happy to produce it next if useful.
