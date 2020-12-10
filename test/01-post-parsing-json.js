/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable require-await */
const chai = require("chai");
chai.use(require("chai-as-promised"));
const expect = chai.expect;
const {StreamedJSONDecoder} = require("../parser-types/json.js");

const doTest = function(data, chunkLength, delay = 10, maxLen){
	if(typeof data === "string"){
		data = Buffer.from(data);
	}
	if(chunkLength == null){
		chunkLength = data.length;
	}
	const decoder = new StreamedJSONDecoder(maxLen);
	(async() => {
		for(let i = 0; i < data.length; i += chunkLength){
			await new Promise(resolve => {
				setTimeout(resolve, delay);
			});
			decoder.write(data.slice(i, i + chunkLength));
		}
		decoder.end();
	})();
	return decoder;
};

describe("POST Parsing: JSON", function(){
	if(process.env.NYC_CONFIG == null && process.env.TEST_EVERYTHING == null && process.env.VSCODE_IPC_HOOK == null){
		before(function(){
			this.skip();
		});
	}
	it("works", function(){
		return expect((async() => {
			const decoder = doTest(
				JSON.stringify({hello: "world"})
			);
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{hello: "world"}
		);
	});
	it("works slowly", function(){
		return expect((async() => {
			const decoder = doTest(
				JSON.stringify({hello: "world"}),
				2,
				1
			);
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{hello: "world"}
		);
	});
	it("doesn't work if there's too much data", function(){
		return expect((async() => {
			const decoder = doTest(
				JSON.stringify({hello: "world"}), undefined, undefined, 8
			);
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{}
		);
	});
	it("doesn't work if there's too much data (slow)", function(){
		return expect((async() => {
			const decoder = doTest(
				JSON.stringify({hello: "world"}), 2, 2, 8
			);
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{}
		);
	});
});
