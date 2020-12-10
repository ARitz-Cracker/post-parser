/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable require-await */
const chai = require("chai");
chai.use(require("chai-as-promised"));
const expect = chai.expect;
const {StreamedURIDecoder} = require("../parser-types/urlencoded.js");

const doTest = function(data, chunkLength, delay = 10, maxLen){
	if(typeof data === "string"){
		data = Buffer.from(data);
	}
	if(chunkLength == null){
		chunkLength = data.length;
	}
	const decoder = new StreamedURIDecoder(maxLen);
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

describe("POST Parsing: URL Encoded", function(){
	if(process.env.NYC_CONFIG == null && process.env.TEST_EVERYTHING == null && process.env.VSCODE_IPC_HOOK == null){
		before(function(){
			this.skip();
		});
	}

	it("decodes a single key with a single value", function(){
		return expect((async() => {
			const decoder = doTest("hello=world");
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{hello: "world"}
		);
	});
	it("treates + like a space", function(){
		return expect((async() => {
			const decoder = doTest("greeting=hello+world");
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{greeting: "hello world"}
		);
	});
	it("decodes a single key with a single value and a slow connection", function(){
		return expect((async() => {
			const decoder = doTest("hello=world", 2, 100);
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{hello: "world"}
		);
	});
	it("decodes a single key with multiple values", function(){
		return expect((async() => {
			const decoder = doTest("hello=world&thank=you");
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{
				hello: "world",
				thank: "you"
			}
		);
	});
	it("decodes a single key with multiple values and a super slow connection", function(){
		return expect((async() => {
			const decoder = doTest("hello=world&thank=you", 2, 100);
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{
				hello: "world",
				thank: "you"
			}
		);
	});
	it("handles unicode data", function(){
		return expect((async() => {
			const decoder = doTest("flicker=%E7%A7%81%E3%81%AF%E3%81%A1%E3%82%87%E3%81%86%E3%81%A9%E4%BD%95%E3%81%8C%E9%87%8D%E8%A6%81%E3%81%8B%E8%A6%8B%E3%81%A4%E3%81%91%E3%82%88%E3%81%86%E3%81%A8%E3%81%97%E3%81%A6%E3%81%84%E3%82%8B");
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{flicker: "私はちょうど何が重要か見つけようとしている"}
		);
	});
	it("deals with invalid escape sequences as values", function(){
		return expect((async() => {
			const decoder = doTest("a=%g&b=%3p&c=69");
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{
				a: "%g",
				b: "%3p",
				c: "69"
			}
		);
	});
	it("deals with invalid escape sequences as keys", function(){
		return expect((async() => {
			const decoder = doTest("abcd%g=5&abcd%5=5");
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{
				"abcd%g": "5",
				"abcd%5": "5"
			}
		);
	});
	it("deals with incomplete escape sequences and slow data", function(){
		return Promise.all([

			expect((async() => {
				const decoder = doTest("%=%&b=%3", 1, 50);
				return new Promise(resolve => {
					decoder.on("postData", resolve);
				});
			})()).to.eventually.deep.equal(
				{
					"%": "%",
					b: "%3"
				}
			),

			expect((async() => {
				const decoder = doTest("a%", 1, 50);
				return new Promise(resolve => {
					decoder.on("postData", resolve);
				});
			})()).to.eventually.deep.equal(
				{"a%": null}
			),
			expect((async() => {
				const decoder = doTest("a%3", 1, 50);
				return new Promise(resolve => {
					decoder.on("postData", resolve);
				});
			})()).to.eventually.deep.equal(
				{"a%3": null}
			)
		]);
	});
	it("deals with incomplete escape sequences", function(){
		return expect((async() => {
			const decoder = doTest("a=%&b=%3");
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{
				a: "%",
				b: "%3"
			}
		);
	});
	it("creates a null property when a key with no value doesn't have a = at the end", function(){
		return expect((async() => {
			const decoder = doTest("a");
			return new Promise(resolve => {
				decoder.on("postData", resolve);
			});
		})()).to.eventually.deep.equal(
			{a: null}
		);
	});
	it("ignores data past the specified size limit", function(){
		return Promise.all([
			expect((async() => {
				const decoder = doTest("abc=d", 2, 10, 1);
				return new Promise(resolve => {
					decoder.on("postData", resolve);
				});
			})()).to.eventually.deep.equal(
				{a: null}
			)
		]);
	});
	it("ignores data with potentially unsafe properties", async function(){
		const decoder = doTest("hello=world&__proto__=evil&valueOf=evil");
		const decodedData = await new Promise(resolve => {
			decoder.on("postData", resolve);
		});
		expect(decodedData).to.deep.equal({hello: "world"});
		expect(decodedData.__proto__).to.equal(Object.prototype);
	})
});
