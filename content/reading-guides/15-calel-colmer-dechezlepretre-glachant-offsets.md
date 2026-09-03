---
title: "Calel, Colmer, Dechezleprêtre, and Glachant (2021): Do Carbon Offsets Offset Carbon?"
date: 2026-04-19
draft: false
summary: "A reading guide to the paper on whether carbon offsets under the CDM generated real extra emissions reductions."
---

### Why this paper is on the syllabus

This paper is the central empirical reading for the offsets lecture because it goes directly at the hardest issue in carbon offset markets: **additionality**. An offset credit is only economically meaningful if the project that generated it would not have occurred without the revenue provided by the credit. If the project would have happened anyway, then the credit is not buying any new emissions reductions.

The difficulty is that additionality is inherently counterfactual. The researcher, and the regulator, cannot simultaneously observe the same project both with and without offset revenue. Calel, Colmer, Dechezleprêtre, and Glachant design the paper around that identification problem and use the structure of the Indian wind sector to build a conservative, observable-based lower bound on the scale of non-additional credits.

### The question

Did the Clean Development Mechanism (CDM) award offsets to wind projects in India that would have been built even without offset payments?

If the answer is yes, then the program is not delivering additional emissions reductions for the credits it issues. Worse, if regulated firms in capped jurisdictions use those credits to justify incremental emissions, then global emissions rise by the amount of those incremental emissions, even though no corresponding reductions have occurred elsewhere.

### Why the setting matters

The CDM was established under the Kyoto Protocol and became one of the largest international offset programs ever implemented. It awarded tradable carbon credits, known as **Certified Emissions Reductions** (CERs), to projects in lower-income countries whose sponsors claimed they would reduce emissions relative to a counterfactual baseline scenario. CERs could then be used by regulated entities in capped jurisdictions, including installations covered by the EU Emissions Trading System, to meet part of their compliance obligations.

India's wind sector is a strong test case for the integrity of the CDM. It is often viewed as the kind of sector in which the program should work relatively well. Wind projects generate a clean, measurable low-carbon output, and unlike some notorious industrial-gas cases, there is limited scope for developers to create additional emissions simply in order to be paid for reducing them. If additionality problems are large in Indian wind, that is bad news for the broader credibility of offset markets, because the setting is close to a best-case scenario.

### Data and measurement

The data work is a substantial contribution of the paper. The authors construct a project-level dataset covering **1,350 wind farms built in India** between 1992 and 2013. For each project they determine whether it was registered under the CDM, and they collect detailed information on project location, installed capacity, wind resource quality, and distance to the electricity grid.

Two pieces of this data are especially important for the identification strategy.

First, the authors use local wind-speed and meteorological data to estimate how productive each site should be in terms of expected electricity generation. A project sited in a windier location should earn more revenue per unit of installed capacity, all else equal, and is therefore more profitable on a purely electrical-market basis.

Second, they use detailed grid-infrastructure data to estimate how costly it is for each project to connect to the electricity network. A project that is farther from existing transmission capacity is more expensive to build and to operate, so it is less profitable than an otherwise identical project closer to the grid.

Combining expected revenue on the wind-resource side with expected costs on the grid-connection side lets the authors rank projects by observable profitability in a way that does not rely on self-reported financial models.

### The core empirical problem

Additionality is, by definition, a statement about an unobserved counterfactual. A developer applying for CERs is asked to argue that the project would not have been viable without offset revenue, but the researcher cannot directly observe the unassisted world, and the developer has a clear incentive to claim that the project is additional.

Rather than attempting to identify every non-additional project, which would require a full structural model of investment decisions, the authors take a more conservative route. They identify a subset of projects that are obviously non-additional on the basis of observable project characteristics. They label this subset **BLIMPs**, for **blatantly infra-marginal projects**.

### How the BLIMP strategy works

The logic is direct. Consider two wind projects built in the same Indian state and in the same year, so that they face similar market conditions, regulatory environment, and technology cost. One project received CER credits and the other did not. If the subsidized project is larger, located in a windier site, and closer to the grid than the unsubsidized project, then the subsidized project appears strictly more profitable than the unsubsidized project on every observable margin that would matter to a private investor.

If the weaker unsubsidized project was built without CER revenue, then it is very difficult to argue that the stronger subsidized project required CER revenue to be built. That stronger subsidized project is a BLIMP.

This logic yields a **lower bound** on the prevalence of non-additionality. The authors are not claiming to detect every non-additional project. They are claiming only that the projects labeled BLIMPs are so clearly more profitable than contemporaneous unsubsidized alternatives that calling them additional is not credible. That conservative design is a strength, because if even the observable-based lower bound is large, then the program has a serious integrity problem and the true figure is necessarily at least as bad.

### Main findings

The quantitative results are severe. Among the **472 CDM-registered wind farms** in the sample, the authors classify **265 as BLIMPs**. Those BLIMPs account for approximately **52 percent of the offsets approved** for Indian wind projects over the sample period.

The number is striking precisely because it comes from a deliberately conservative classification procedure. These are not all of the potentially suspicious projects; they are the subset that the authors can confidently label as clearly non-additional using observable project characteristics alone. The true share of non-additional offsets is at least this large.

The scale is also large in absolute environmental terms. The relevant BLIMP projects were expected to generate approximately **50 million CERs** over their project lifetimes. If those credits are then used by regulated firms in capped jurisdictions to emit more than they otherwise would, the paper estimates that global emissions rise by approximately **28 million tonnes of carbon dioxide**, which is roughly equivalent to operating a one-gigawatt coal-fired power plant for close to five years.

One of the most damaging observations in the paper is that a random lottery assigning subsidies to Indian wind projects would have directed fewer credits to BLIMPs than the CDM approval process actually did. That observation indicates that the problem is not merely one of imperfect screening; it reflects a systematic misallocation in which the CDM disproportionately credited the projects least in need of the subsidy.

### Why the results are convincing

The authors run a range of sensitivity checks that push the analysis toward giving the CDM the benefit of the doubt. For example, they examine what happens if measured output from CDM projects is systematically overstated, or if grid-connection costs of CDM projects are systematically understated. Under a range of such adjustments, the main conclusion that a majority of approved offsets went to BLIMPs continues to hold.

This matters because a natural criticism of the approach is that CDM projects may face unobserved barriers that are not captured by publicly available data on wind resources, scale, and grid connection. The authors do not argue that such barriers never exist. They argue that, to overturn the main conclusion, these unobserved barriers would have to be implausibly large and systematically related to the observable profitability margins used to construct the BLIMP classification. That is a much stronger defense of the results than a simple correlation could provide.

### Why the paper matters

The paper matters because it makes clear why offsets are difficult to regulate well. Additionality sounds like an accounting rule, but it is a counterfactual judgment about project profitability. That is a demanding task for researchers with rich data and years to study the problem. It is substantially harder for regulators who must approve or reject project applications in real time and at scale, typically on the basis of information supplied by the project sponsors themselves.

The broader lesson is that offset markets can fail in a specific and damaging way. They can appear on paper to deliver emissions reductions while in practice raising global emissions, if credits issued to non-additional projects are used to authorize incremental emissions elsewhere. That is a much stronger critique than saying the program is somewhat noisy or modestly inefficient.

The paper is also useful because it demonstrates the value of conservative empirical design in a policy-relevant setting. By building a lower bound rather than overclaiming a point estimate, the authors produce a headline statistic that is difficult to dismiss on methodological grounds, and that places an informative floor under any subsequent evaluation of the CDM's environmental integrity.

### What to focus on when you read

On a first read, keep four things in mind.

First, understand the economic meaning of additionality. It asks whether the project exists because of the offset subsidy, and it is inherently a counterfactual statement about project profitability.

Second, understand the BLIMP construction. The authors compare subsidized projects to weaker unsubsidized projects built in the same state and year, using observable measures of wind resource, scale, and grid connection to rank profitability.

Third, remember that the resulting estimate is a lower bound. The paper is identifying only the clear cases, so the true share of non-additional offsets is at least as large as the 52 percent figure reported.

Fourth, keep the policy implication clear. Non-additional offsets do not merely waste money on infra-marginal projects. When those offsets are used for compliance in capped jurisdictions, they can raise global emissions relative to what would have occurred without the offset program.

### Terms to know

- **Carbon offset:** a tradable credit that authorizes emissions in one place on the basis of a claimed reduction elsewhere.
- **Additionality:** the requirement that the credited reduction would not have occurred without the offset incentive.
- **CER:** a Certified Emissions Reduction, the tradable credit issued under the Clean Development Mechanism.
- **Infra-marginal project:** a project that would have been built even without the offset subsidy, so that any credits it receives are not associated with additional reductions.
- **BLIMP:** a blatantly infra-marginal project, as defined by the authors using observable measures of profitability relative to contemporaneous unsubsidized projects.
- **Lower bound:** a conservative estimate that is constructed to understate rather than overstate the underlying problem.
