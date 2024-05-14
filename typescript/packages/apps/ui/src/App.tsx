import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Analysis from './pages/Analysis';
import ListGrowers from './pages/Growers/ListGrowers';
import ViewGrower from './pages/Growers/ViewGrower';

Amplify.configure(
	{
		Auth: {
			Cognito: {
				//  Amazon Cognito User Pool ID
				userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
				// OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
				userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
			},
		},
		API: {
			REST: {
				UIApi: {
					endpoint: import.meta.env.VITE_UI_REST_API_URL,
				},
			},
		},
	},
	{
		API: {
			REST: {
				headers: async () => {
					const authToken = (await fetchAuthSession()).tokens?.idToken?.toString();
					return { Authorization: authToken ?? '' };
				},
			},
		},
	}
);

export default function App() {
	return (
		<Authenticator.Provider>
			<Authenticator>
				<BrowserRouter>
					<Routes>
						<Route path="/" element={<Analysis />} />
						<Route path="/analysis" element={<Analysis />} />
						<Route path="/growers" element={<ListGrowers />} />
						<Route path="/growers/create" element={<ViewGrower />} />
						<Route path="/growers/:id" element={<ViewGrower />} />
						<Route path="/growers/:id/edit" element={<ViewGrower />} />
					</Routes>
				</BrowserRouter>
			</Authenticator>
		</Authenticator.Provider>
	);
}
