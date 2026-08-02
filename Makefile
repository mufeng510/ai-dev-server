.PHONY: validate test lint

validate:
	bash scripts/validate.sh

test:
	node --test

lint:
	bash scripts/validate.sh --static-only
