.PHONY: test-08
test-08:
	Rscript -e 'source("08-perfect-competition-figures.R"); test_sb_competition_figures()'
	Rscript -e 'source("08-second-best-intensity-figures.R"); source("08-second-best-diagram.R"); test_sb_intensity_market_figures(); test_sb_intensity_diagram()'
	Rscript 08-test-intensity-slides.R
