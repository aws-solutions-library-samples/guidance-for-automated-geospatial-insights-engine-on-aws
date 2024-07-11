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

import { Action, ThunkAction, configureStore } from '@reduxjs/toolkit';
import { regionsApiSlice } from '../slices/regionsApiSlice';
import { tilerApiSlice } from '../slices/tilerApiSlice';

export const store = configureStore({
	reducer: {
		[regionsApiSlice.reducerPath]: regionsApiSlice.reducer,
		[tilerApiSlice.reducerPath]: tilerApiSlice.reducer,
	},
	devTools: true,
	middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(regionsApiSlice.middleware).concat(tilerApiSlice.middleware),
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action<string>>;
