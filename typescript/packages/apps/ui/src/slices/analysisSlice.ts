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
