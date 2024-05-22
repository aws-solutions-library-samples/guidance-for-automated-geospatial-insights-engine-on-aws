export type AuthenticationType = 'token' | 'apiKey';

export const COMMON_HEADERS = (auth: {
	type: AuthenticationType,
	secret: string
}) => {
	const common = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'Accept-Version': '1.0.0',
	};
	if (auth.type === 'token') {
		common['Authorization'] = `Bearer ${auth.secret}`;
	}
	if (auth.type === 'apiKey') {
		common['X-API-KEY'] = Buffer.from(auth.secret, 'utf-8').toString('base64');
	}

	return common;
};
