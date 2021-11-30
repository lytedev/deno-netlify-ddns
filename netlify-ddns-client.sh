#!/usr/bin/env sh
source "/etc/netlify-ddns-client/rc"
curl -4 -s -X POST -u "${NETLIFY_DDNS_USERNAME}:${NETLIFY_DDNS_PASSWORD}" \
	-L "${NETLIFY_DDNS_ENDPOINT}/v1/netlify-ddns/replace-all-relevant-user-dns-records"
curl -6 -s -X POST -u "${NETLIFY_DDNS_USERNAME}:${NETLIFY_DDNS_PASSWORD}" \
	-L "${NETLIFY_DDNS_ENDPOINT}/v1/netlify-ddns/replace-all-relevant-user-dns-records"
