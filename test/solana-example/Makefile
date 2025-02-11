process:
	@npx node lib/main.js

typegen:
	@npx squid-solana-typegen ./src/abi whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc#whirlpool TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA#tokenProgram

up:
	@docker compose up -d


down:
	@docker compose down -v


.PHONY: process start codegen migration migrate up down