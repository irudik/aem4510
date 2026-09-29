# Parallel MAC shocks and auction defaults

Status: COMPLETED

Both repositories now default to 60 teams, uniform-price Round 1, pay-as-bid Round 2, parallel shocks in both rounds, and no banking or borrowing. New firms have MAC = 4 + c*a with even slopes 2 or 4. Each round pairs random +c/-c vertical shifts, with one unchanged firm for odd class sizes. The sum of shift/slope is zero, preserving aggregate demand at the default common prices. Caps are chosen jointly with integer emissions before and after each shock. Existing multiplier games remain supported.

Costs, benchmark scores, auction previews, graphs, saved round scores, and cost-gap reports include the realized intercept. The class percentage measures only open-market gains using post-shock costs at both initial auction holdings and final holdings. Individual leaderboard scores remain available by round and cumulatively.

Verification: 125 course tests and 126 standalone tests pass, including migration installation/rerun, start-game assignment, hidden/revealed shifts, two auction/market cycles, and post-shock cost reductions. Independent review checked 39,600 pre/post-shock benchmarks over class sizes 2–100. Two earlier-game display issues were fixed and regression-tested. Standalone build and phone/desktop MAC rendering pass.

Deployment pending: apply 005_parallel_mac_shifts.sql before deploying; create a new session for new firms and shocks. No live database changes, commits, or pushes were performed.
