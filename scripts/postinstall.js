#!/usr/bin/env node
/* eslint-disable no-sync */
if(process.env.NODE_ENV !== "production"){
	return;
}
console.log("This is a production enviroment! Removing excess crap...");
const fs = require("fs");
const foldersToRemove = [
	"test",
	"test_files"
];
const filesToRemove = [
	".eslintignore",
	".eslintrc.json",
	".travis.yml",
	"LICENSE",
	"README.md"
];
foldersToRemove.forEach(folder => {
	fs.rmdirSync(folder, {recursive: true});
});
filesToRemove.forEach(file => {
	fs.unlinkSync(file);
});
