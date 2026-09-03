---
title: "Greenstone and Gallagher (2008): Does Hazardous Waste Matter?"
date: 2026-04-19
draft: false
summary: "A reading guide to the paper on Superfund cleanups and housing markets."
aliases:
  - /reading-guides/14-greenstone-gallagher-superfund/
---

### Why this paper is on the syllabus

This paper is foundational for the hedonic-pricing portion of the course. It poses a classic revealed-preference question: when a credible policy improves local environmental quality, does the local housing market respond in the way that standard hedonic theory predicts?

The paper matters for two reasons. First, it studies a major federal environmental policy, the Superfund program, whose per-site cleanup costs are large and whose benefits have been the subject of substantial policy debate. Second, it is a cautionary benchmark. Even in a setting where many observers would expect cleanup to generate large willingness-to-pay responses in nearby housing markets, the measured response is small and statistically indistinguishable from zero in the authors' preferred specifications.

### The question

How much are nearby residents willing to pay for the cleanup of a hazardous waste site, and can that willingness to pay be recovered from housing-market behavior in a quasi-experimental research design?

The standard hedonic logic is direct. If a cleanup reduces local disamenity and risk, then properties near the site should become more attractive to potential buyers and renters. In a flexible housing market, that increase in demand can show up on several margins: higher sale prices, higher rents, more construction, or compositional changes in who chooses to live there.

### Institutional background

The Superfund program identifies hazardous waste sites across the United States and places the most dangerous ones on the National Priorities List (NPL) for federally funded cleanup. Sites are scored using the **Hazard Ranking System** (HRS), which assigns a composite risk score based on indicators of exposure pathways, toxicity, and waste quantity. During the period the paper studies, cleanup resources were limited, and in practice a score above approximately **28.5** served as the effective threshold for NPL inclusion.

That administrative threshold is the key institutional feature the paper exploits. Sites scoring just above and just below the cutoff are likely to be similar on the dimensions that matter for local housing outcomes, including underlying site hazard, neighborhood characteristics, and local trends in housing demand. The main difference between them is that sites above the cutoff received federally funded cleanup and sites below it did not.

### What the authors do

Greenstone and Gallagher compare neighborhoods around the first 400 hazardous waste sites selected for Superfund cleanup to neighborhoods around 290 sites that narrowly missed selection. They study multiple outcomes at the census-tract level:

1. housing prices,
2. rental rates,
3. housing supply,
4. population, and
5. neighborhood compositional characteristics such as income and demographic composition.

The breadth of the outcome set is important. In a standard supply-and-demand picture of local housing markets, an environmental improvement does not have to be capitalized entirely into sale prices. If a neighborhood becomes more attractive, equilibrium adjustment can also occur through new housing construction, adjustments in rents, and compositional changes in the resident population driven by differences in willingness to pay for environmental quality. Looking only at a single outcome, such as sale price, would miss these alternative margins and understate the equilibrium response to cleanup.

### How the empirical strategy works

The paper uses the HRS selection rule as a quasi-experiment and embeds it in a regression-discontinuity-style comparison. The intuition is direct: sites that score just above the cutoff received NPL designation and federally funded cleanup, while sites that score just below the cutoff did not.

A simple comparison of cleaned and uncleaned sites across the full distribution would be biased because the most hazardous sites are systematically more likely to receive cleanup, and those sites differ from less hazardous ones on many other dimensions that affect housing demand. Among sites near the cutoff, however, the difference in cleanup status is driven primarily by an administrative scoring rule rather than by large differences in underlying site quality. That is the source of variation the paper uses.

The quasi-experimental design is embedded in a hedonic framework. If consumers value cleanup, then cleanup should raise housing demand in nearby neighborhoods. In equilibrium, that demand shift can be accommodated through higher sale prices, higher rents, increased housing supply through new construction, or inflows of residents with higher willingness to pay for environmental quality. The paper therefore treats the local housing market as an equilibrium system rather than as a single-price outcome, which is one of its most valuable features.

### Main findings

The headline result is a near-zero one. Superfund cleanup is associated with economically small and statistically indistinguishable from zero changes in residential property values, rental rates, housing supply, population, and neighborhood composition, as measured at the census-tract level.

In the course notes, the price estimates are summarized as approximately **0.7 to 2.7 percent** across specifications, generally not statistically distinguishable from zero. The paper's preferred interpretation is that the local benefits of these cleanups, measured through nearby housing markets, are small on the margins the research design can detect.

The cost comparison is what makes the result especially striking. The authors estimate average cleanup costs of approximately **$43 million** per site, and their preferred housing-market estimates imply local housing-market benefits well below that number. Taken at face value and under the research design's assumptions, the local revealed-preference benefits do not come close to covering average cleanup costs.

### What this does and does not mean

It is tempting to read the paper as a verdict that Superfund cleanup was not worth its cost. That reading is too strong, and the paper itself is careful not to make it.

The result is that **local** benefits, as measured through the nearby housing market, appear small. That statement leaves open several alternative possibilities consistent with the data:

1. true local benefits may in fact be small at the census-tract scale studied,
2. benefits may have been capitalized earlier, including at the time of NPL listing rather than at cleanup completion, which would attenuate the estimated effect, and
3. a large share of the relevant benefits may occur outside the local housing market, including improvements in health, ecological outcomes, and broader social welfare that are not captured in local property values.

The paper is therefore best understood as a disciplined revealed-preference estimate on one particular margin, not as a complete social cost-benefit analysis of the Superfund program.

### Why the paper matters

The paper matters because it illustrates both the promise and the limits of hedonic valuation in environmental economics.

The promise is that when a credible source of quasi-experimental variation is available, housing markets can recover economically meaningful estimates of willingness to pay for environmental quality. The HRS cutoff provides exactly that kind of variation, and the paper shows how to embed it inside a hedonic framework that takes equilibrium adjustment on multiple margins seriously.

The limit is that even with a well-designed research strategy, interpretation is not mechanical. A small house-price response does not imply a small total social welfare gain. It may reflect timing, supply responses, information frictions, or the fact that the largest benefits are not local and therefore cannot be recovered from local housing-market outcomes.

The paper is also consequential for subsequent empirical work. Later studies have argued that the geographic aggregation used here, at the census-tract level, may be too coarse to capture the full effect of cleanups that are localized to a small area around the site itself. Spatially more granular follow-up work has found larger effects very close to the site. Those extensions do not make Greenstone and Gallagher less important; they make the paper more important, because it established the key empirical question and motivated the spatial precision that later work has pursued.

### What to focus on when you read

On a first read, focus on four ideas.

First, understand the Superfund institutional rule. The 28.5 HRS cutoff is what makes the empirical design credible, and without it the comparison of cleaned to uncleaned sites would be confounded by underlying hazard differences.

Second, understand why the authors examine more than house prices. In a hedonic setting, equilibrium adjustment can occur on several margins simultaneously, and a single-outcome analysis would miss rents, construction, and compositional change.

Third, understand the headline result. The paper finds little evidence of large local housing-market gains from NPL cleanup at the census-tract level, and the estimates are generally not statistically distinguishable from zero.

Fourth, keep the interpretation disciplined. The paper documents local revealed-preference effects through housing markets. It is not a moral or comprehensive verdict on every cleanup, and it is not a full social cost-benefit analysis of the Superfund program.

### Terms to know

- **Superfund:** the federal program, formally the Comprehensive Environmental Response, Compensation, and Liability Act, that funds the cleanup of hazardous waste sites.
- **Hazard Ranking System (HRS):** the scoring system used to prioritize hazardous sites for inclusion on the National Priorities List for federal cleanup.
- **Hedonic pricing:** an empirical framework that uses housing-market outcomes to infer the implicit price of amenities, disamenities, and other location-specific attributes.
- **Regression discontinuity intuition:** the idea of identifying a policy effect by comparing observations just above and just below a policy cutoff, where the cutoff determines treatment but is only weakly related to outcomes through any other channel.
- **Local welfare effect:** the benefit to nearby residents, as distinct from broader social benefits that may accrue outside the local housing market.
