/*
 *  Copyright Amazon.com Inc. or its affiliates. All Rights Reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance
 *  with the License. A copy of the License is located at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions
 *  and limitations under the License.
 */

import {
	CognitoIdentityProviderClient,
	CreateIdentityProviderCommand,
	CreateUserPoolClientCommand,
	DescribeIdentityProviderCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DescribeActivationsCommandOutput, GetParameterCommand, GetParametersCommandOutput, PutParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const cognitoClient = new CognitoIdentityProviderClient({});
const ssmClient = new SSMClient({});

const addFederatedIdentityProvider = async (
	userPoolIdParameter: string | undefined,
	idpNameParameter: string | undefined,
	metadataUrlParameter: string | undefined,
	cognitoClientIdParameter: string | undefined,
	callbackUrls: string | undefined
): Promise<string | undefined> => {
	console.log(`cognito.customResource > addFederatedIdentityProvider > in`);
	// Limited to 32 characters
	const providerName = `df-sso`;

	// GET User Pool ID that has already been created
	const userPoolParam = await ssmClient.send(
		new GetParameterCommand({
			Name: userPoolIdParameter,
		})
	);

	let provider: DescribeActivationsCommandOutput | undefined = undefined;
	// GET Federated Identity Provider ID if one has already been created
	try {
		const providerNameParam = await ssmClient.send(
			new GetParameterCommand({
				Name: idpNameParameter,
			})
		);

		provider = await cognitoClient.send(
			new DescribeIdentityProviderCommand({
				UserPoolId: userPoolParam.Parameter?.Value,
				ProviderName: providerNameParam.Parameter?.Value,
			})
		);
	} catch (e) {
		console.log(`Error:${JSON.stringify(e)}`);
		// create the idp if either the parameter or idp are missing
		if (e.name === 'ParameterNotFound' || e.name === 'ResourceNotFoundException') {
			// ignore
		} else {
			console.log(`throwing error`);
			throw e;
		}
	}

	// Create a new provider if none exists
	if (!provider) {
		console.log(`cognito.customResource > handler > provider not found creating !!!}`);

		const metaDataUrl = await ssmClient.send(
			new GetParameterCommand({
				Name: metadataUrlParameter,
			})
		);

		if (metaDataUrl.Parameter?.Value) {
			try {
				await cognitoClient.send(
					new CreateIdentityProviderCommand({
						UserPoolId: userPoolParam.Parameter?.Value,
						ProviderName: providerName,
						ProviderType: 'SAML',
						ProviderDetails: {
							MetadataURL: metaDataUrl.Parameter?.Value,
						},
						AttributeMapping: {
							email: 'email',
						},
					})
				);
			} catch (e) {
				if (e.name === 'DuplicateProviderException') {
					// ignore
				} else {
					throw e;
				}
			}

			await ssmClient.send(
				new PutParameterCommand({
					Name: idpNameParameter,
					Value: providerName,
					Type: 'String',
					Overwrite: true,
				})
			);
		}
	}

	// Create the APP Client
	console.log(`cognito.customResource > addFederatedIdentityProvider > Create the APP Client !!!}`);
	let clientIdParameter: GetParametersCommandOutput | undefined = undefined;
	try {
		clientIdParameter = await ssmClient.send(
			new GetParameterCommand({
				Name: cognitoClientIdParameter,
			})
		);
	} catch (e) {
		if (e.name === 'ParameterNotFound') {
			// ignore
		} else {
			throw e;
		}
	}

	if (!clientIdParameter) {
		const client = await cognitoClient.send(
			new CreateUserPoolClientCommand({
				UserPoolId: userPoolParam.Parameter?.Value,
				ClientName: `df-sso-client`,
				SupportedIdentityProviders: [providerName],
				CallbackURLs: callbackUrls?.split(','),
				AllowedOAuthFlows: ['implicit'],
				AllowedOAuthScopes: ['openid', 'email'],
				AllowedOAuthFlowsUserPoolClient: true,
			})
		);

		await ssmClient.send(
			new PutParameterCommand({
				Name: cognitoClientIdParameter,
				Value: client.UserPoolClient?.ClientId,
				Type: 'String',
				Overwrite: true,
			})
		);
	}

	return;
};

export const handler = async (event: any): Promise<any> => {
	console.log(`cognito.customResource > handler > in : ${JSON.stringify(event)}`);

	const { USER_POOL_ID_PARAMETER, IDENTITY_PROVIDER_NAME_PARAMETER, METADATA_URL_PARAMETER, COGNITO_CLIENT_ID_PARAMETER, CALLBACK_URLS } = process.env;

	try {
		switch (event.RequestType) {
			case 'Create': {
				return await addFederatedIdentityProvider(
					USER_POOL_ID_PARAMETER,
					IDENTITY_PROVIDER_NAME_PARAMETER,
					METADATA_URL_PARAMETER,
					COGNITO_CLIENT_ID_PARAMETER,
					CALLBACK_URLS
				);
			}
			case 'Update': {
				return await addFederatedIdentityProvider(
					USER_POOL_ID_PARAMETER,
					IDENTITY_PROVIDER_NAME_PARAMETER,
					METADATA_URL_PARAMETER,
					COGNITO_CLIENT_ID_PARAMETER,
					CALLBACK_URLS
				);
			}
			case 'Delete': {
				console.log(`nothing to do on delete`);
				return;
			}
			default: {
				console.log(`cognito.customResource > unknown request type`);
			}
		}
	} catch (Exception) {
		console.log(`cognito.customResource > error : ${Exception}`);
	}
	console.log(`cognito.customResource > exit`);
};
