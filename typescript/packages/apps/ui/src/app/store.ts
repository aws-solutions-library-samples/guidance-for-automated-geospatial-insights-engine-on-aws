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
