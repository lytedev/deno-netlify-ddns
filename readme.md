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

Primary usage is documented via `deno task` and depends on certain `pass`
entries and access to certain `age` keys. For your usage, you will want to clone
this repo and modify appropriately.

## Running

```bash
deno task dev
```

**NOTE**: Running this locally while configured for production will delete and
create DNS entries pointed to `127.0.0.1` or `::1`. You almost certainly do not
want to do that.

## Testing

```bash
deno task -A test
```

**NOTE**: Running this locally while configured for production will delete and
create DNS entries pointed to `127.0.0.1` or `::1`. You almost certainly do not
want to do that.

## Deploying

```bash
deno task deploy
```

## Configuration

Your `src/dist/users.json` should contain a JSON string with the following
structure:

```json
{
	"username": "password",
	"daniel_flanagan_home": ["password_1", "password_2"]
}
```

**NOTE**: These passwords are not stored securely at all. Use globally unique
passwords. You can generate some with `openssl rand -hex 32`.

And your `src/dist/dns-entries.json` should contain a JSON string with the
following structure:

```json
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
					{ "name": "another-subdomain" }
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
```

This would configure the server such that a request with HTTP Basic auth
credentials like `daniel_flanagan_home:password_1` would setup `A` or `AAAA` DNS
entries for the mapped subdomains using the address of the client.

These files are best generated from `sops`-encrypted source files as
demonstrated in this repository so that you can easily track your configuration.

# Client Usage

Clients can now `POST` to
`/v1/netlify-ddns/replace-all-relevant-user-dns-records` with the previously
setup credentials and this service will setup all mapped `A` (or `AAAA` if
requested over IPv6) DNS records in Netlify and remove any conflicting `A` (or
`AAAA`) records.

```bash
curl -X POST -u daniel_flanagan_home:password_1 https://your-ddns.deno.dev/v1/netlify-ddns/replace-all-relevant-user-dns-records
```

This means that if you want IPv4 (`A`) _and_ IPv6 (`AAAA`) records, you will
need to hit the service over both IPv4 and IPv6:

```bash
curl -4 -X POST -u daniel_flanagan_home:password_1 https://your-ddns.deno.dev/v1/netlify-ddns/replace-all-relevant-user-dns-records
curl -6 -X POST -u daniel_flanagan_home:password_1 https://your-ddns.deno.dev/v1/netlify-ddns/replace-all-relevant-user-dns-records
```

And if you want this in a systemd timer that's pretty simple to use, I've got a
pre-configured client for you here:

- https://github.com/lytedev/deno-netlify-ddns-client

# Personal Notes

- I prefer to give each machine its own unique user
- Each machine has a known set of DNS entries to it on my primary domain

# To Do

- Hashed passwords could be handy?
  - This way if your envs (or logs?) leak your passwords aren't hosed
    - But seriously, just use globally unique passwords for each user here
      - But also these should definitely be hashed
