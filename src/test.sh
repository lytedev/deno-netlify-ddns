#!/usr/bin/env sh

dir="$(dirname "$0")"
main="${dir}/main.ts"

# start server
export NETLIFY_DDNS_USERS_JSON='{
  "lytedev": "secure-password"
}
'
export NETLIFY_DDNS_MAPPINGS_JSON='{
  "lytedev": {
    "domains": {
      "fake-test-domain.tk": {
        "subdomains": [
          {
            "name": "@"
          }
        ]
      },
      "lyte.dev": {
        "subdomains": [
          {
            "name": "test.dragon.h"
          },
          {
            "only": ["A"],
            "name": "test4.dragon.h"
          },
          {
            "only": ["AAAA"],
            "name": "test6.dragon.h"
          }
        ]
      }
    }
  }
}
'

# do IPv6
echo "Testing IPv6..."
BIND_HOST='::1' BIND_PORT=8591 deno run --allow-all "$main" &
sleep 1

curl -6 -X POST -u 'lytedev:secure-password' '[::1]:8591/v1/netlify-ddns/replace-all-relevant-user-dns-records' >/dev/null 2>&1

kill %1
echo "IPv6 Done!"
sleep 1

# do IPv4
BIND_HOST='127.0.0.1' BIND_PORT=8591 deno run --allow-all "$main" &
sleep 1

curl -4 -X POST -u 'lytedev:secure-password' '127.0.0.1:8591/v1/netlify-ddns/replace-all-relevant-user-dns-records' >/dev/null 2>&1

kill %1
echo "IPv4 Done!"
sleep 1

DEFAULT_NETLIFY_API_TOKEN="$(pass netlify | grep token: | awk -F': ' '{print $2}')"

# get records for assertions
lyte_dev_dns_json="$(curl -s -X GET "https://api.netlify.com/api/v1/dns_zones/lyte_dev/dns_records?access_token=${DEFAULT_NETLIFY_API_TOKEN}")"
test_domain_dns_json="$(curl -s -X GET "https://api.netlify.com/api/v1/dns_zones/fake-test-domain_tk/dns_records?access_token=${DEFAULT_NETLIFY_API_TOKEN}")"
# echo "lyte.dev records: $lyte_dev_dns_json"
# echo "fake-test-domain.tk records: $test_domain_dns_json"
dns_json="$(jq --argjson l1 "${lyte_dev_dns_json}" --argjson l2 "${test_domain_dns_json}" -n '$l1 + $l2')"
export dns_json

# assertion helper functions
assert_has_record() {
  record_type="$1"
  shift
  subdomain="$1"
  shift
  domain="$1"
  shift
  value="$1"
  shift
  hostname="$subdomain$domain"
  dns_zone="$(echo "$domain" | sed 's/\./_/g')"
  record="$(echo "${dns_json}" | jq '.[] | select(.hostname == "'"${hostname}"'" and .type == "'"${record_type}"'")')"
  if [ "$(echo "${record}" | jq '.value == "'"${value}"'"')" = "true" ]; then
    curl -X DELETE "https://api.netlify.com/api/v1/dns_zones/${dns_zone}/dns_records/$(echo "$record" | jq -r '.id')?access_token=${DEFAULT_NETLIFY_API_TOKEN}" > /dev/null 2>&1
  else
    echo "Did not find '${record_type}' record for '${hostname}' with 'value' '${value}'"
    exit_code=1
  fi
}

assert_not_has_record() {
  record_type="$1"
  shift
  subdomain="$1"
  shift
  domain="$1"
  shift
  hostname="$subdomain$domain"
  dns_zone="$(echo "$domain" | sed 's/\./_/g')"
  record="$(echo "${dns_json}" | jq '.[] | select(.hostname == "'"${hostname}"'" and .type == "'"${record_type}"'")')"
  echo "assert_not_has_record: '$record'"
  if [ -n "$record" ]; then
    echo "Found '${record_type}' record for '${hostname}' with"
    exit_code=1
  fi
}

# make assertions against fetched record data
exit_code=0
export exit_code
assert_has_record     A    test.dragon.h.  lyte.dev            127.0.0.1
assert_has_record     A    test4.dragon.h. lyte.dev            127.0.0.1
assert_has_record     AAAA test6.dragon.h. lyte.dev            ::1
assert_has_record     AAAA test.dragon.h.  lyte.dev            ::1
assert_has_record     A    ""              fake-test-domain.tk 127.0.0.1
assert_has_record     AAAA ""              fake-test-domain.tk ::1

assert_not_has_record A    test6.dragon.h. lyte.dev
assert_not_has_record AAAA test4.dragon.h. lyte.dev

# cleanup

if [ "$exit_code" = 0 ]; then
  echo "Passed"
else
  echo "Failed"
fi

exit $exit_code
