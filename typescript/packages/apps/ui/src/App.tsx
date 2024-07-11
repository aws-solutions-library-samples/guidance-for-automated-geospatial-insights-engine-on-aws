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
import ViewField from './pages/Fields/ViewField';
import CreateGrower from './pages/Growers/CreateGrower';
import EditGrower from './pages/Growers/EditGrower';
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
							<Route path="/growers/:id/edit" element={<EditGrower />} />
							<Route path="/growers/:growerId/farms" element={<ListFarms />} />
							<Route path="/farms" element={<ListFarms />} />
							<Route path="/growers/:growerId/farms/create" element={<CreateFarm />} />
							<Route path="/farms/:id" element={<ViewFarm />} />
							<Route path="/farms/:id/edit" element={<ViewFarm />} />
							<Route path="/fields" element={<ListFields />} />
							<Route path="/growers/:growerId/farms/:farmId/fields" element={<ListFields />} />
							<Route path="/fields/:id" element={<ViewField />} />
							{/* <Route path="/growers/:growerId/farms/:farmId/fields/create" element={<CreateField />} /> */}
						</Routes>
					</BrowserRouter>
				</Authenticator>
			</Authenticator.Provider>
		</I18nProvider>
	);
}
