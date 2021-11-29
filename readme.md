# Netlify DDNS

This is a Deno app intended to run on Deno deploy that will enable you to
easily setup DDNS via Netlify's API for your machines.

# Problem

I have a number of machines that I don't want having full access to my whole
Netlify account via the raw token itself. I only want them to be able to update
their own DNS entries.

# Solution

Setup a service that has a mapping of credentials to which DNS entries are
related to those credentials. When a client hits this application, this
application will note their remote address and update the DNS entries that are
mapped to the provided credentials.
