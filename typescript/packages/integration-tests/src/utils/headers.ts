export const COMMON_HEADERS = (idToken) => {
	return {
		'Content-Type': 'application/json',
		Accept: 'application/json',
		'Accept-Version': '1.0.0',
		Authorization: `Bearer ${idToken}`,
	};
};
