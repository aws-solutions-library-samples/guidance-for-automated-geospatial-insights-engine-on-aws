import { RegistrationResourceList } from './schemas.js';

export const registrationListExample: RegistrationResourceList = {
	registrations: [
		{
			engineId: 'engine1',
			regionId: 'region1',
			createdAt: '2024-10-30T03:30:58.734Z',
		},
		{
			engineId: 'engine1',
			regionId: 'region2',
			createdAt: '2024-10-30T03:30:58.734Z',
		},
	],
};
