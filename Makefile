APP_DIR  = /srv/wordle
PM2      = pm2
NGINX    = nginx

.PHONY: help install build dev deploy deploy-full logs status restart stop

help:
	@echo "Targets:"
	@echo "  install      - install all npm dependencies (server + client)"
	@echo "  build        - build the React client into client/dist/"
	@echo "  dev          - run server and client in dev mode (two terminal hint)"
	@echo "  deploy       - build client and restart the Node server (production)"
	@echo "  deploy-full  - reinstall deps, build client, restart Node server"
	@echo "  logs         - tail PM2 logs for the wordle process"
	@echo "  status       - show PM2 process list"
	@echo "  restart      - restart the wordle PM2 process"
	@echo "  stop         - stop the wordle PM2 process"

install:
	npm install --prefix server
	npm install --prefix client

build:
	npm run build --prefix client

dev:
	@echo "Run these in two separate terminals:"
	@echo "  npm run dev:server   (http://localhost:3001)"
	@echo "  npm run dev:client   (http://localhost:5173)"

deploy: build
	$(PM2) restart wordle

deploy-full: install build
	$(PM2) restart wordle

logs:
	$(PM2) logs wordle

status:
	$(PM2) list

restart:
	$(PM2) restart wordle

stop:
	$(PM2) stop wordle
