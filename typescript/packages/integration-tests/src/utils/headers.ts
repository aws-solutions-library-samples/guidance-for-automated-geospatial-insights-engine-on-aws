export type AuthenticationType = 'token' | 'apiKey';

export const COMMON_HEADERS = (idToken: string | undefined) => {
	const common = {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'Accept-Version': '1.0.0',
	};
	if (!idToken) return common;
	common['Authorization'] = `Bearer ${idToken}`;
	return common;
};
