import { HttpError, jsonResponse, queryEnv } from "./common.ts";

const DEFAULT_TTL = parseInt(await queryEnv("DEFAULT_NETLIFY_DDNS_TTL", "120"));
const NETLIFY_API_ENDPOINT = "https://api.netlify.com/api/v1";
const DEFAULT_NETLIFY_API_TOKEN = await queryEnv(
  "DEFAULT_NETLIFY_API_TOKEN",
  "",
);

if (DEFAULT_NETLIFY_API_TOKEN === "") {
  console.warn(
    "DEFAULT_NETLIFY_API_TOKEN is not set. All requests will need to specify their own token.",
  );
}

type DNSRecordType =
  | "A"
  | "AAAA"
  | "ALIAS"
  | "CAA"
  | "CNAME"
  | "MX"
  | "NS"
  | "SPF"
  | "SRV"
  | "TXT";

interface AdditionalDNSRecord {
  type: DNSRecordType;
  name: string;
  value: string;
  ttlSeconds?: number;
}

interface Subdomain {
  name: string;
  ttlSeconds?: number;
  additionalRecords?: AdditionalDNSRecord[];
}

interface NetlifyDDNSDomainMapping {
  subdomains: Subdomain[];
}

interface NetlifyDDNSMapping {
  domains: {
    [domain: string]: NetlifyDDNSDomainMapping;
  };
}

interface NetlifyRequestOptions {
  netlifyApiToken?: string | null;
  fetchOptions?: RequestInit;
}

const netlifyFetch = async (
  path: string,
  options?: NetlifyRequestOptions,
): Promise<Response> => {
  const url = new URL(`${NETLIFY_API_ENDPOINT}/${path}`);
  url.searchParams.append(
    "access_token",
    options?.netlifyApiToken || DEFAULT_NETLIFY_API_TOKEN,
  );
  const opts = Object.assign({}, options?.fetchOptions || {});
  // console.log(`Netlify Request: ${url}\n${JSON.stringify(opts)}`);
  return await fetch(url, opts);
};

const getDnsRecords = async (
  domain: string,
  options?: NetlifyRequestOptions,
): Promise<Response> => {
  console.log(`Getting DNS Records for ${domain}...`);
  return await netlifyFetch(
    `dns_zones/${domain.replaceAll(".", "_")}/dns_records`,
    options,
  );
};

const deleteDnsRecord = async (
  domain: string,
  id: string,
  options?: NetlifyRequestOptions,
  subdomain?: string,
): Promise<Response> => {
  console.log(
    `Deleting DNS Record ${id} on domain ${
      subdomain ? subdomain + "." : ""
    }${domain}...`,
  );
  return await netlifyFetch(
    `dns_zones/${domain.replaceAll(".", "_")}/dns_records/${id}`,
    Object.assign({}, options, { fetchOptions: { method: "DELETE" } }),
  );
};

const createDnsRecord = async (
  domain: string,
  record: {
    type: DNSRecordType;
    hostname: string;
    value: string;
    ttlSeconds: number;
  },
  options?: NetlifyRequestOptions,
): Promise<Response> => {
  console.log(`Creating DNS record...`, domain, record);
  return await netlifyFetch(
    `dns_zones/${domain.replaceAll(".", "_")}/dns_records`,
    Object.assign({}, options, {
      fetchOptions: {
        method: "POST",
        body: JSON.stringify({
          type: record.type,
          hostname: record.hostname.substr(
            0,
            record.hostname.length - (domain.length + 1),
          ),
          value: record.value,
          ttl: record.ttlSeconds,
        }),
        headers: { "content-type": "application/json; charset=utf8" },
      },
    }),
  );
};

interface NetlifyDNSRecord {
  hostname: string;
  type: DNSRecordType;
  ttlSeconds: number;
  id: string;
  value: string;
}

const netlifyDdnsUsers: { [username: string]: string[] | string } = JSON.parse(
  await queryEnv(
    "NETLIFY_DDNS_USERS_JSON",
    JSON.stringify({
      "tester-guy": "password",
    }),
  ),
);

const netlifyDdnsMapping: { [username: string]: NetlifyDDNSMapping } = JSON
  .parse(
    await queryEnv(
      "NETLIFY_DDNS_MAPPINGS_JSON",
      JSON.stringify({
        "tester-guy": {
          domains: {
            "lyte.dev": {
              subdomains: [
                {
                  name: "testing-netlify-ddns.testing-area.h",
                },
              ],
            },
          },
        },
      }),
    ),
  );

const checkBasicAuth = (request: Request) => {
  const auth = request.headers.get("authorization");
  if (auth === null || !auth.toLowerCase().startsWith("basic ")) {
    throw new HttpError(
      "No HTTP Basic authentication credentials provided.",
      "no_auth",
      401,
    );
  }

  let authHeader = auth.substr(6);
  try {
    authHeader = atob(authHeader);
  } catch (e) {
    if (e instanceof DOMException && e.name == "InvalidCharacterError") {
      throw new HttpError(
        "Failed to base64-decode username and password from HTTP Basic auth",
        "invalid_http_basic_auth_base64",
        400,
      );
    }
    console.error(e);
  }

  const [username, password] = authHeader.split(":");

  if (username === "") {
    throw new HttpError(
      "Username must not be blank",
      "http_basic_auth_empty_username",
      400,
    );
  }
  if (password === "") {
    throw new HttpError(
      "Password must not be blank",
      "http_basic_auth_empty_password",
      400,
    );
  }

  const doesUserExist = username in netlifyDdnsUsers;
  const passwordOptions = netlifyDdnsUsers[username];
  const isPasswordValid = Array.isArray(passwordOptions)
    ? passwordOptions.includes(password)
    : passwordOptions === password;
  if (!doesUserExist || !isPasswordValid) {
    console.error(`Invalid auth credentials for user: ${username}`)
    throw new HttpError(
      "User does not exist or password incorrect",
      "failed_to_authenticate",
      401,
    );
  }

  return username;
};

export const handleDdnsRequest = async (
  request: Request,
  conn: Deno.Conn,
): Promise<Response> => {
  const remote = conn.remoteAddr as Deno.NetAddr;
  const remoteHost = remote.hostname;

  // TODO: I'm aware that this certainly does not properly parse/identify all
  // the different ways that an IP address can be specified. However, this
  // worked in my basic tests since it seems that Deno's API only provides the
  // IP addresses in their well-known, canonical forms.
  const isIPv6 = remoteHost.includes(":");

  console.log(remote, remoteHost, isIPv6);

  if (request.method !== "POST") {
    throw new HttpError(
      "This endpoint only accepts POST requests",
      "bad_method",
      405,
    );
  }

  const username = checkBasicAuth(request);
  if (!(username in netlifyDdnsMapping)) {
    throw new HttpError(
      "This user is not configured to replace DNS records for any domains.",
      "unconfigured_user_for_dns_replace",
      401,
    );
  }

  const netlifyApiToken = request.headers.get("netlify-token");

  const userDomains = netlifyDdnsMapping[username].domains;
  const results = await Promise.all(
    Object.keys(userDomains).map(async (domain) => {
      // handle domain
      console.log(`User ${username} updating Netlify DDNS...`);
      const domainMappings: NetlifyDDNSDomainMapping = userDomains[domain];
      const response = await getDnsRecords(domain, { netlifyApiToken });
      if (response.status !== 200) {
        console.error(
          `Failed to retrieve DNS zone from Netlify's API for domain ${domain}:`,
          await response.text(),
        );
        return {
          domain,
          error:
            `Failed to retrieve DNS zone from Netlify's API for domain ${domain}`,
        };
      } else {
        const aType = isIPv6 ? "AAAA" : "A";
        const existed: NetlifyDNSRecord[] = [];
        const recordIdsToDelete: string[] = [];
        const recordsToAdd: (Omit<NetlifyDNSRecord, "id">)[] = [];

        // initialize to-add array
        // TODO: add additionalRecords!
        domainMappings.subdomains.forEach((subdomain) => {
          recordsToAdd.push({
            type: aType,
            hostname: subdomain.name == "@"
              ? domain
              : `${subdomain.name}.${domain}`,
            ttlSeconds: subdomain.ttlSeconds || DEFAULT_TTL,
            value: remoteHost,
          });
        });

        console.log(
          `Prepared to ensure the following DNS records exist for domain ${domain}:`,
          recordsToAdd,
        );

        const data: (Omit<NetlifyDNSRecord, "ttlSeconds"> & { ttl: number })[] =
          await response.json();
        data.forEach((entry) => {
          const { hostname, id, type, value } = entry;
          const ttlSeconds = entry.ttl;
          const subdomain = hostname.substr(
            0,
            hostname.length - domain.length - 1,
          ) || "@";
          // console.debug("SUBDOMAIN:", subdomain);
          // handle subdomain
          // check if subdomain is even relevant, otherwise do nothing
          const relatedMapping = recordsToAdd.find((
            add,
          ) => (type === add.type && (
            subdomain === "@"
              ? (add.hostname === domain)
              : (add.hostname === `${subdomain}.${domain}`)
          )));
          if (relatedMapping) {
            console.log("Related mapping found for", relatedMapping.hostname);
            if (
              type === relatedMapping.type &&
              ttlSeconds === relatedMapping.ttlSeconds &&
              value === relatedMapping.value
            ) {
              console.log("Exact match found, excluding...");
              const o = Object.assign(
                {},
                recordsToAdd.splice(recordsToAdd.indexOf(relatedMapping), 1)[0],
                { id: entry.id },
              );
              existed.push(o);
            } else {
              console.log("Marking existing conflicting entry for deletion...");
              recordIdsToDelete.push(id);
            }
          }
        });
        const added = await Promise.all(recordsToAdd.map(async (record) => {
          console.log("Requesting creation of record", record, domain);
          const response = await createDnsRecord(domain, record, {
            netlifyApiToken,
          });
          if (
            response.headers.get("content-type")?.includes("application/json")
          ) {
            const json = await response.json();
            console.log(json);
            return json;
          } else {
            return "{Empty Response}";
          }
        }));
        const deleted = await Promise.all(recordIdsToDelete.map(async (id) => {
          console.log("Requesting deletion of record", id);
          const response = await deleteDnsRecord(domain, id, {
            netlifyApiToken,
          });
          console.log(response);
          if (
            response.headers.get("content-type")?.includes("application/json")
          ) {
            const json = await response.json();
            console.log(json);
            return json;
          } else {
            return "{Empty Response}";
          }
        }));

        console.log("Done!");
        return {
          domain,
          existed,
          deleted,
          added,
        };
        // add any mapped entries that are missing
        // delete the "old" relevant ones
        // console.log(data);
      }
    }),
  );

  return jsonResponse(results);
};
