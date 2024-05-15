const validateMasterPassword = (password: string): string => {
	if (!password.match(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)) {
		throw new Error(`The master user password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.`);
	}
	return password;
};

const validateUserPassword = (password: string): string => {
	if (!password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{10,}$/)) {
		throw new Error(`Password must be at least 10  characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.`);
	}
	return password;
};

export { validateMasterPassword, validateUserPassword };
