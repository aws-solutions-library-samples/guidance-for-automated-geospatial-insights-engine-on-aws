import { createdAt } from '@agie/resource-api-base';
import { Static, Type } from '@sinclair/typebox';
import { NextToken, regionId } from '../../common/schemas.js';

export const registrationResource = Type.Object(
	{
		engineId: Type.String({ description: 'Engine Identifier associated with the registration resource.' }),
		regionId: Type.String({ description: 'Region Identifier associated with the registration resource.' }),
		createdAt,
	},
	{
		$id: 'registration_resource',
	}
);

export const registrationResourceList = Type.Object(
	{
		registrations: Type.Array(Type.Ref(registrationResource)),
		pagination: Type.Optional(
			Type.Object({
				lastEvaluated: Type.Optional(regionId),
			})
		),
	},
	{
		$id: 'registration_list',
	}
);

export type RegistrationResource = Static<typeof registrationResource>;
export type RegistrationResourceList = Static<typeof registrationResourceList>;

export interface RegistrationListOptions {
	count?: number;
	token?: NextToken;
}
