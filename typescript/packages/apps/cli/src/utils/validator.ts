const validateMasterPassword = (password: string): string => {
	if (!password.match(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)) {
		throw new Error(`The master user password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.`);
	}
	return password;
};

export { validateMasterPassword };
