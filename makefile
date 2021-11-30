.PHONY: default
default: install

.env: example.env
	test -f .env || cp example.env .env
	${EDITOR} .env

.PHONY: install
install: .env
	@mkdir -p /etc/netlify-ddns-client
	@mkdir -p /etc/systemd/system
	@install -m 700 .env /etc/netlify-ddns-client/rc
	@install -m 700 netlify-ddns-client.sh /usr/bin/netlify-ddns-client.sh
	@install -m 744 netlify-ddns-client.service /etc/systemd/system/netlify-ddns-client.service
	@install -m 744 netlify-ddns-client.timer /etc/systemd/system/netlify-ddns-client.timer
	@systemctl daemon-reload
	@systemctl start netlify-ddns-client.service
	@systemctl start netlify-ddns-client.timer
	@systemctl enable netlify-ddns-client.service
	@systemctl enable netlify-ddns-client.timer
	@echo "Your netlify-ddns-client configuration is now available at:"
	@echo "  /etc/netlify-ddns-client/rc"

.PHONY: uninstall
uninstall:
	@systemctl stop netlify-ddns-client.timer || true
	@systemctl stop netlify-ddns-client.service || true
	@systemctl disable netlify-ddns-client.timer || true
	@systemctl disable netlify-ddns-client.service || true
	@rm -rf \
		/etc/netlify-ddns-client \
		/etc/systemd/system/netlify-ddns-client.service \
		/etc/systemd/system/netlify-ddns-client.timer || true
	@systemctl daemon-reload || true
