import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import I18nProvider from '@cloudscape-design/components/i18n';
import enMessages from '@cloudscape-design/components/i18n/messages/all.en';
import { Amplify } from 'aws-amplify';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Analysis from './pages/Analysis/Analysis';
import CreateFarm from './pages/Farms/CreateFarm';
import ListFarms from './pages/Farms/ListFarms';
import ViewFarm from './pages/Farms/ViewFarm';
import ListFields from './pages/Fields/ListFields';
import CreateGrower from './pages/Growers/CreateGrower';
import ListGrowers from './pages/Growers/ListGrowers';
import ViewGrower from './pages/Growers/ViewGrower';

Amplify.configure({
	Auth: {
		Cognito: {
			//  Amazon Cognito User Pool ID
			userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
			// OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
			userPoolClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
		},
	},
});

export default function App() {
	return (
		<I18nProvider locale="en" messages={[enMessages]}>
			<Authenticator.Provider>
				<Authenticator>
					<BrowserRouter>
						<Routes>
							<Route path="/" element={<Analysis />} />
							<Route path="/analysis" element={<Analysis />} />
							<Route path="/growers" element={<ListGrowers />} />
							<Route path="/growers/create" element={<CreateGrower />} />
							<Route path="/growers/:id" element={<ViewGrower />} />
							<Route path="/growers/:id/edit" element={<ViewGrower />} />
							<Route path="/farms" element={<ListFarms />} />
							<Route path="/farms/create" element={<CreateFarm />} />
							<Route path="/farms/:id" element={<ViewFarm />} />
							<Route path="/farms/:id/edit" element={<ViewFarm />} />
							<Route path="/fields" element={<ListFields />} />
						</Routes>
					</BrowserRouter>
				</Authenticator>
			</Authenticator.Provider>
		</I18nProvider>
	);
}
