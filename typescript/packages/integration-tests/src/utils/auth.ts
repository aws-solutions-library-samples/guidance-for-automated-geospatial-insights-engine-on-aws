import sign from 'jwt-encode';

// use https://jwt.io/ to manually encode/decode tokens for testing
// export const CONTRIBUTOR_TOKEN =
// 	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJlbWFpbCI6InNvbWVvbmVAc29tZXdoZXJlLmNvbSIsImlkZW50aXRpZXMiOlt7InVzZXJJZCI6ImpvaG5kb2UifV0sImNvZ25pdG86Z3JvdXBzIjpbImNvbnRyaWJ1dG9yIl19.dS9JSmW9XHh19bQiUQpMCc3MlrtFavN4658MExpLjfc';

export const JWT_EMAIL = 'someone@somewhere.com';

export async function getAuthToken(): Promise<string> {
	// Create a claims JSON object.
	const claims = {
		sub: '1234567890',
		name: 'John Doe',
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + 60 * 60, // expires in 1 hour
		email: JWT_EMAIL,
		'custom:role': 'contributor',
	};

	// Sign the token with the secret key.
	const jwt = sign(claims, 'secret');

	console.log(`Auth token: ${jwt}`);
	return jwt;
}
