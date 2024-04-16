import { getAuthToken } from './auth.js';

export const COMMON_HEADERS = {
	'Content-Type': 'application/json',
	Accept: 'application/json',
	'Accept-Version': '1.0.0',
	Authorization: `Bearer: ${await getAuthToken()}`,
};
