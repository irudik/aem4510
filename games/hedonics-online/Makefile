.PHONY: test check

test:
	node --test tests/*.test.mts

check:
	node --test tests/*.test.mts
	@for f in ../../netlify/functions/_lib/hedonics.mts ../../netlify/functions/_lib/hedonics_game_service.mts ../../netlify/functions/hedonics-*.mts ../../static/games/hedonics-online/*.mjs; do \
		node --check $$f; \
	done
	cd ../.. && hugo -b http://localhost
