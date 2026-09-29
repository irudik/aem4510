# Clean permit-game defaults

Status: COMPLETED

Use slopes 2 and 4 and even baselines. For the default 60/40 shares without shocks or banking/borrowing, choose the nearest cap that gives every firm positive integer emissions and abatement at a common integer MAC. Preserve custom shares and other options. Use the common MAC as the benchmark price when the whole-permit optimum equalizes interior MACs; retain the existing supporting price otherwise. Leave auction execution and live sessions unchanged.

Update both repositories and teaching documentation. Test class sizes 2–100, firm-ID joins, costs, initial gains from trading, phase cap integration, and benchmark scoring. Run full tests and the standalone build, followed by an independent economic review. No commit or push requested.

Verified: 116 course tests and 117 standalone tests pass; standalone build passes. Independent review found no blocking issues. Both phase cycles persist the adjusted caps and common-MAC benchmark prices, with matching student/admin histograms. No live database changes, commits, or pushes.
