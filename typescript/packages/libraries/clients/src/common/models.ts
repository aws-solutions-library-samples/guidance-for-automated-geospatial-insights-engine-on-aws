export interface LambdaRequestContext {
	authorizer: {
		claims: {
			email: string;
			'custom:role': string;
		};
	};
}
