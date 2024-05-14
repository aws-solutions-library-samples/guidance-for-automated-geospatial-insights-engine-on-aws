import { Action, ThunkAction, configureStore } from '@reduxjs/toolkit';
import { regionsApiSlice } from '../slices/regionsApiSlice';

export const store = configureStore({
	reducer: {
		[regionsApiSlice.reducerPath]: regionsApiSlice.reducer,
	},
	devTools: true,
	middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(regionsApiSlice.middleware),
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, Action<string>>;
