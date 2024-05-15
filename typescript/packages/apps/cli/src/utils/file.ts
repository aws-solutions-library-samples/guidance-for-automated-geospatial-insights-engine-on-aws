import * as fs from 'fs';

const replaceLine = async (filePath: string, lineNumber: number, newContent: string): Promise<void> => {
	// Read the file content
	const lines = fs.readFileSync(filePath, 'utf-8').split('\n');

	lineNumber = lineNumber - 1;

	// Replace the line if lineNumber is within the range of lines
	if (lineNumber >= 0 && lineNumber < lines.length) {
		lines[lineNumber] = newContent; // Replace the line content
	} else {
		throw new Error('Line number out of range');
	}

	// Join the lines back into a single string
	const modifiedContent = lines.join('\n');

	// Write the modified content back to the file
	fs.writeFileSync(filePath, modifiedContent, 'utf-8');
};

export { replaceLine };
