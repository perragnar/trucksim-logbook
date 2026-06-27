import { CookieJar } from 'tough-cookie';

export const BASE = 'https://www.worldoftrucks.com';
const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/**
 * A tiny fetch wrapper around a tough-cookie jar that follows redirects
 * manually so Set-Cookie headers are captured at every hop (Rails sets the
 * session cookie on the 302 after a successful login).
 */
export class Session {
	jar = new CookieJar();

	async request(url: string, init: RequestInit = {}, maxRedirects = 6): Promise<Response> {
		let current = new URL(url, BASE).toString();
		let method = init.method ?? 'GET';
		let body = init.body;

		for (let i = 0; i <= maxRedirects; i++) {
			const cookie = await this.jar.getCookieString(current);
			const res = await fetch(current, {
				...init,
				method,
				body,
				redirect: 'manual',
				headers: {
					'User-Agent': UA,
					Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
					...(cookie ? { Cookie: cookie } : {}),
					...(init.headers ?? {})
				}
			});

			for (const sc of res.headers.getSetCookie()) {
				await this.jar.setCookie(sc, current).catch(() => {});
			}

			if (res.status >= 300 && res.status < 400 && res.headers.has('location')) {
				current = new URL(res.headers.get('location')!, current).toString();
				// A redirect after POST becomes a GET with no body (303/302 semantics).
				method = 'GET';
				body = undefined;
				continue;
			}
			// Attach the final resolved URL so callers can detect redirects to /sign_in.
			Object.defineProperty(res, 'finalUrl', { value: current });
			return res;
		}
		throw new Error(`Too many redirects starting from ${url}`);
	}

	async getText(url: string): Promise<{ html: string; finalUrl: string }> {
		const res = await this.request(url);
		const html = await res.text();
		return { html, finalUrl: (res as Response & { finalUrl?: string }).finalUrl ?? url };
	}
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
