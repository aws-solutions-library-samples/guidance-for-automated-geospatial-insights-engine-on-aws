export interface LambdaRequestContext {
	authorizer: {
		claims: {
			identities: string;
			email: string;
			'cognito:groups': string;
		};
	};
}
