import { server } from './server.ts'
import { HttpError } from './common.ts'

import { handleDdnsRequest } from './netlify.ts'

// TODO: check out URLPattern
interface ExactPathRoute {
	exactPath: string
}
type Route = ExactPathRoute
type RouterEntry = Route & {
	handler: (req: Request, conn: Deno.Conn) => Promise<Response>
}

const routes: RouterEntry[] = [
	{
		exactPath: '/v1/netlify-ddns/replace-all-relevant-user-dns-records',
		handler: handleDdnsRequest,
	},
]

const matchRoute = (request: Request, route: Route): boolean => {
	if (route.exactPath) {
		const { pathname } = new URL(request.url)
		return pathname == route.exactPath
	}
	return false
}

await server(async (request: Request, conn: Deno.Conn) => {
	try {
		for (const route of routes) {
			if (matchRoute(request, route)) {
				return await route.handler(request, conn)
			}
		}
		return new HttpError('Not Found', 'not_found', 404).toResponse()
	} catch (e) {
		if (e instanceof HttpError) {
			return e.toResponse()
		} else {
			console.error('Unknown exception occurred in server handler:', e)
			return new HttpError('Unknown Server Error', 'unknown_server_error', 500)
				.toResponse()
		}
	}
})
