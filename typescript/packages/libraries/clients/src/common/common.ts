export interface RequestHeaders {
	[key: string]: string;
}

const { CLIENT_HEADERS } = process.env;

export abstract class ClientServiceBase {
	protected MIME_TYPE = 'application/json';
	protected VERSION = '1.0.0';

	private readonly _headers: RequestHeaders = {
		Accept: this.MIME_TYPE,
		'Accept-Version': this.VERSION,
		'Content-Type': this.MIME_TYPE,
	};

	protected buildHeaders(additionalHeaders?: RequestHeaders): RequestHeaders {
		let headers: RequestHeaders = Object.assign({}, this._headers);

		const customHeaders = CLIENT_HEADERS as string;
		if (customHeaders !== undefined) {
			try {
				const headersFromConfig: RequestHeaders = JSON.parse(customHeaders) as unknown as RequestHeaders;
				headers = { ...headers, ...headersFromConfig };
			} catch (err) {
				const wrappedErr = `Failed to parse configuration parameter CLIENT_HEADERS as JSON with error: ${err}`;
				throw new Error(wrappedErr);
			}
		}

		if (additionalHeaders !== null && additionalHeaders !== undefined) {
			headers = { ...headers, ...additionalHeaders };
		}

		const keys = Object.keys(headers);
		keys.forEach((k) => {
			if (headers[k] === undefined || headers[k] === null) {
				delete headers[k];
			}
		});

		return headers;
	}
}
