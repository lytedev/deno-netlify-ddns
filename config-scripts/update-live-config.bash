#!/usr/bin/env bash

echo "THIS SCRIPT IS OUT OF DATE!"
exit 1

[ -z "$DENO_DEPLOY_PROJECT_ID" ] && { echo "DENO_DEPLOY_PROJECT_ID not set"; exit 1; }
DENO_DEPLOY_API_TOKEN="$(pass 'deno-deploy-token' | head -n 1)"

mappings_json="$(cue export 'mappings.cue' | jq -c | sed 's/"/\\\"/g')"
users_json="$(cue export 'users.cue' | jq -c | sed 's/"/\\\"/g')"
combined_json='{"NETLIFY_DDNS_MAPPINGS_JSON":"'"$mappings_json"'","NETLIFY_DDNS_USERS_JSON":"'"$users_json"'"}'

echo "Posting new configuration to the Deno Deploy project..."
echo
curl -vvv -X POST "https://dash.deno.com/api/projects/$DENO_DEPLOY_PROJECT_ID/env" \
	-H "accept: */*" \
	-H "content-type: application/json" \
	-H "authorization: Bearer $DENO_DEPLOY_API_TOKEN" \
	-d "$combined_json"
echo
echo "Done!"
