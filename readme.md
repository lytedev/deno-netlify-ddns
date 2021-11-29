# Netlify DDNS

This is a Deno app intended to run for free on Deno deploy that will enable you
to easily setup DDNS via Netlify's API for your machines.

## Problem

I have a number of machines that I don't want having full access to my whole
Netlify account via the raw token itself. I only want them to be able to update
their own DNS entries.

## Solution

Setup a service that has a mapping of credentials to which DNS entries are
related to those credentials. When a client hits this application, this
application will note their remote address and update the DNS entries that are
mapped to the provided credentials.

# Usage

**NOTE**: Running this locally while configured for production will delete and
create production DNS entries pointed to `127.0.0.1` or `::1`. You almost
certainly do not want to do that.

Start the server like so:

    DEFAULT_NETLIFY_API_TOKEN='your_token_here' \
    		NETLIFY_DDNS_USERS_JSON='your_users_json' \
    		NETLIFY_DDNS_MAPPINGS='your_mappings_json' \
    		deno run --allow-env --allow-net ./main.ts

Or in Deno Deploy:

- Fork this repo on GitHub
- Create a new project at https://dash.deno.com/new
- Set the Deploy URL to the `main.ts` file in your fork
- Go to Settings > Environment Variables and configure your environment variables

If you're wanting to avoid GitHub, you're probably savvy enough to work that
one out on your own!

## Configuration

Your `NETLIFY_DDNS_USERS_JSON` should contain a JSON string with the following structure:

    {
    	"username": "password",
    	"daniel_flanagan_home": ["password_1", "password_2"]
    }

And your `NETLIFY_DDNS_MAPPINGS` should contain a JSON string with the following structure:

    {
    	"username": {
    		"domains": {
    			"example.com": {
    				"subdomains": [
    					{ "name": "@" },
    					{ "name": "subdomain" }
    				]
    			},
    			"example.org": {
    				"subdomains": [
    					{ "name": "another-subdomain"
    				]
    			}
    		}
    	},
    		"daniel_flanagan_home": {
    		"domains": {
    			"example.com": {
    				"subdomains": [
    					{ "name": "cat-pictures" },
    					{ "name": "enterprise" }
    				]
    			},
    			"lyte.dev": {
    				"subdomains": [
    					{ "name": "home" }
    				]
    			}
    		}
    		}
    }

This would configure the server such that a request with HTTP Basic auth credentials like `daniel_flanagan_home:password_1`

# Client Usage

Clients can now `POST` to
`/v1/netlify-ddns/replace-all-relevant-user-dns-records` with the previously
setup credentials and this service will setup all mapped A (or AAAA if
requested over IPv6) DNS records in Netlify and remove any conflicting A (or
AAAA) records.

    curl -X POST -u daniel_flanagan_home:password_1 -L your-ddns.deno.dev/v1/netlify-ddns/replace-all-relevant-user-dns-records

This means that if you want IPv4 _and_ IPv6 records, you will need to hit the
service over both IPv4 and IPv6:

    curl -4 -X POST -u daniel_flanagan_home:password_1 -L your-ddns.deno.dev/v1/netlify-ddns/replace-all-relevant-user-dns-records
    curl -6 -X POST -u daniel_flanagan_home:password_1 -L your-ddns.deno.dev/v1/netlify-ddns/replace-all-relevant-user-dns-records
