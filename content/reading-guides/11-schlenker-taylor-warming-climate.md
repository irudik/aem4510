---
title: "Schlenker and Taylor (2021): Market Expectations of a Warming Climate"
date: 2026-04-19
draft: false
summary: "A reading guide to the paper on what weather derivatives reveal about expected climate change."
---

### Why this paper is on the syllabus

This paper anchors the weather-markets portion of the lecture because it asks a sharper question than the standard "what do people believe?" survey: it asks whether a liquid financial market internalizes climate information when dollars are at stake. Prices in such a market aggregate the beliefs of participants who pay a cost when they are wrong, which makes them a particularly demanding test of revealed climate expectations.

The result matters for how we think about climate-information disclosure and market-based policy. If weather-derivative prices respond both to short-run forecast information and to long-run warming trends, then these prices are not only trading instruments. They also serve as a public signal that utilities, farmers, city governments, and researchers can read off a screen without needing to operate a forecasting system of their own.

### The question

The central question is whether weather-derivative prices reflect only short-run weather noise and the seasonal climatology embedded in their pricing models, or whether they also reflect scientifically grounded expectations about long-run warming.

This is an expectations paper. The object of interest is not realized temperature, but the probability distribution over future temperature that traders appear to hold when they transact. That is why the market setting is essential: the traded price is a market-implied moment of that distribution, revealed under the discipline of real money.

### The market

The authors study weather derivatives traded in the United States, primarily on the Chicago Mercantile Exchange. These are contracts whose payoffs depend on temperature-based indices such as **heating degree days** (HDDs) and **cooling degree days** (CDDs) measured at specific reference weather stations in major U.S. cities. A hot summer raises CDD totals and the payoffs of CDD-long positions; a cold winter raises HDDs and the payoffs of HDD-long positions. Firms with temperature-sensitive revenues, particularly in the energy, agricultural, and retail sectors, use these contracts to hedge weather exposure, while speculators and financial traders take the other side when they believe the market has mispriced the expected outcome.

The market is useful precisely because the contract price is a summary statistic for expected future weather. If a trader has a forecast that is more informative than the market's, that trader can profit by trading on the difference, and in the process push the price toward the underlying expectation. Over many such transactions, the price incorporates the information held by the set of traders active in the market.

### Data and setup

The paper combines several data sources across eight U.S. cities. First, it uses daily settlement prices on weather derivatives covering roughly two decades. Second, it uses observed temperatures from the reference weather stations that underlie each contract. Third, it compares market-implied trends to the output of climate models that project future warming.

This setup supports two related but distinct tests. The first is a short-run market-efficiency test: do daily changes in contract prices respond to information that is predictive of near-term weather? The second is a long-run expectations test: do the trends embedded in derivative-implied expectations line up with the trends in realized warming and in climate-model projections?

### What the authors do in the short run

The short-run analysis asks a direct question: when contract prices move today, are they responding to information about future weather?

To answer it, the authors relate daily changes in contract prices to **weather anomalies** at different leads and lags. A weather anomaly is the deviation of realized temperature from its local climatological average, after accounting for a slowly evolving warming trend.

The identification logic is straightforward. Past weather should not move prices today, because past realizations are already public information and should already be embedded in the previous day's settlement. Future weather can affect prices today only if traders have forecasts that are informative about that future weather. A statistical relationship between today's price change and realized weather several days ahead is therefore evidence that traders are using forecasts, and the lead-lag structure of that relationship reveals which horizons carry the most new information.

This is an event-study-style design over forecast horizons. It lets the authors identify which lead times are most informative for traders. The economic intuition is that very short-horizon forecasts are already priced in because they were anticipated in earlier days, while very long-horizon forecasts have little skill and therefore little market impact. The middle horizons, on the order of several days to about two weeks, tend to carry the largest marginal information.

### What the authors do in the long run

The long-run analysis asks whether contract prices trend over time in a way that is consistent with a warming climate.

The authors extract a time series of market-implied temperature expectations from the derivative prices and compare its trend to two benchmarks:

1. observed warming in historical weather-station data, and
2. warming projected by general-circulation climate models.

If weather-market prices were driven only by recent local weather realizations, the market-implied trend would be noisy and only loosely related to climate-model projections. If instead traders internalize climate information from the scientific literature, the market-implied trend should look similar to the trends observed in the data and predicted by climate models.

### Main results on short-run forecasting

The short-run evidence is strongly supportive of market informativeness. Daily changes in contract prices respond to future weather anomalies but not to past anomalies. That asymmetry is precisely the pattern an efficient forecast-using market should display.

The horizon profile is also economically sensible. The market capitalizes information about weather roughly up to two weeks ahead. Past realizations have essentially no effect on current price changes, consistent with prior pricing of that information, and very distant future realizations have little effect, consistent with low forecast skill at long horizons.

One of the most important results is the cumulative one. When the authors aggregate the price response across forecast horizons, the total capitalization is close to one-for-one. In plain language, the market appears to incorporate forecastable short-run weather information in an approximately complete way, rather than partially.

### Main results on long-run climate expectations

The long-run results are the core contribution for this class. The trends in derivative-implied expectations are statistically significant and broadly comparable in magnitude to trends in observed temperatures and to trends in climate-model projections. In other words, traders appear to anticipate warming at a pace that lines up with the scientific consensus.

This is an important result because most discussions of climate beliefs rely on surveys, which are cheap to answer dishonestly, or on indirect revealed-preference measures such as migration or insurance demand. Here, the beliefs are extracted from market prices that are tied directly to future weather outcomes, and that adjust under the trading incentives of participants with exposure to those outcomes. The evidence suggests that when money is at stake, the traders active in these contracts do not ignore climate change.

The paper also documents nuance rather than mechanical extrapolation. In some northeastern winter contracts, prices reflect a localized cooling effect associated with polar-vortex dynamics. That matters for interpretation because it shows the market is not simply drawing a linear extension of older warming averages. It is responding to updated scientific and meteorological information, including information about regional climate dynamics that would not appear in a simple global trend line.

### Why the paper matters

The paper matters for two reasons. First, it provides unusually direct evidence on market expectations about climate, grounded in an information-aggregating market with real money at stake. Second, it illustrates how private information becomes public information through the price system.

The second point is the broader economics lesson. If informed traders use forecasts and climate-model output when they take positions, then the market price itself becomes informative. A utility, a farmer, a city government, or a researcher can read the current price and learn something about expected future weather without personally maintaining the best forecasting model. The market is functioning as an information-aggregation mechanism.

More generally, the paper is a clean example of how prices in a liquid, forecast-sensitive market reflect not just existing public information, but that public information filtered through the incentives of traders who gain when they are right and lose when they are wrong. That is a useful reference point for thinking about the informational content of other environmental asset prices, including housing, municipal debt, and insurance contracts.

### What to focus on when you read

On a first pass, keep the structure of the paper in mind.

First, understand the product. A weather derivative is a contract whose payoff depends on future temperature-based indices such as HDDs or CDDs measured at a specific reference station.

Second, understand the short-run test. Price changes today should be related to forecastable future weather but not to past weather, and the horizon profile should peak at the leads where forecasts carry the most skill.

Third, understand the long-run test. If the market internalizes climate information, the trend in derivative-implied expectations should look like a warming trend, in line with both realized temperatures and climate-model projections, rather than like short-run local noise.

If those three ideas are clear, the econometric detail in the paper is much easier to follow.

### Terms to know

- **Weather derivative:** a financial contract whose payoff depends on temperature-based indices or other weather outcomes.
- **Heating degree days / cooling degree days:** measures of how cold or hot a day is relative to a benchmark temperature, aggregated across a contract period.
- **Weather anomaly:** the difference between realized weather and the location-specific climatological average, after accounting for a slowly evolving trend.
- **Capitalization:** the extent to which information is incorporated into market prices.
- **Climate-model output:** scientific projections of future climate conditions produced by general-circulation or Earth-system models.
