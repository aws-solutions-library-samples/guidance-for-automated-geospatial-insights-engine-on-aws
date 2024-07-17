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

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AnalysisState {
	selectedMapId: string;
	selectedBandsId: string;
	showBoundaries: boolean;
}

const initialState: AnalysisState = {
	selectedMapId: 'base-map',
	selectedBandsId: 'rgb',
	showBoundaries: false,
};

const analysisSlice = createSlice({
	name: 'analysis',
	initialState,
	reducers: {
		setSelectedMapId: (state, action: PayloadAction<string>) => {
			state.selectedMapId = action.payload;
		},
		setSelectedBandsId: (state, action: PayloadAction<string>) => {
			state.selectedBandsId = action.payload;
		},
		setShowBoundaries: (state, action: PayloadAction<boolean>) => {
			state.showBoundaries = action.payload;
		},
	},
});

export const { setSelectedMapId, setSelectedBandsId, setShowBoundaries } = analysisSlice.actions;
export default analysisSlice.reducer;
