/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable require-await */
const chai = require("chai");
chai.use(require("chai-as-promised"));
const expect = chai.expect;
const {POSTParser} = require("../index");
const fs = require("fs");
const {StreamToBuffer} = require("stream-to-buffer-to-stream");
const postFile = fs.readFileSync(__dirname + "/../test_files/multipart/post_file.png");
describe("POST Parsing: auto selection", function(){
	it("parses json input", async function() {
		const parser = new POSTParser("application/json");
		parser.end(JSON.stringify({hello: "world"}));
		await expect(new Promise(resolve => {
			parser.on("postData", resolve);
		})).to.eventually.deep.equal({hello: "world"});
	});
	it("parses querystring input", async function(){
		const parser = new POSTParser("application/x-www-form-urlencoded");
		parser.end("hello=world");
		await expect(new Promise(resolve => {
			parser.on("postData", resolve);
		})).to.eventually.deep.equal({hello: "world"});
	});
	it("parses multipart input", async function(){
		const parser = new POSTParser("multipart/form-data; boundary=---------------------------14137654051526174327127624341");
		fs.createReadStream(__dirname + "/../test_files/multipart/post1").pipe(parser);
		await expect(new Promise(resolve => {
			parser.on("postData", resolve);
		})).to.eventually.deep.equal({hello: "world"});
	});
	it("parses multipart input (Quoted boundary)", async function(){
		const parser = new POSTParser("multipart/form-data;    boundary=\"---------------------------14137654051526174327127624341\"");
		fs.createReadStream(__dirname + "/../test_files/multipart/post1").pipe(parser);
		await expect(new Promise(resolve => {
			parser.on("postData", resolve);
		})).to.eventually.deep.equal({hello: "world"});
	});
	it("doesn't parse null inputs", async function(){
		const parser = new POSTParser("null");
		parser.end("I have no idea what the usecase for this is");
		await expect(new Promise(resolve => {
			parser.on("postData", resolve);
		})).to.eventually.deep.equal({});
	});
	it("throws when a multipart has no boundary", function(){
		expect(() => {
			new POSTParser("multipart/form-data");
		}).to.throw("content-type is malformed");
	});
	it("throws when a content type is unknown", function(){
		expect(() => {
			new POSTParser("aaaaaaaaaaa");
		}).to.throw("Unsupported content-type");
	});
	it("passes file uploads", async function() {
		const parser = new POSTParser("multipart/form-data; boundary=\"---------------------------14137654051526174327127624341\"");
		const postDataPromise = new Promise(resolve => {
			parser.once("postData", resolve);
		});
		const fileDataPromise = new Promise(resolve => {
			parser.once("postFile", async (name, fileName, mimeType, contentStream) => {
				const s2b = new StreamToBuffer();
				contentStream.pipe(s2b);
				resolve({
					name,
					fileName,
					mimeType,
					content: await s2b.result()
				});
			});
		});
		fs.createReadStream(__dirname + "/../test_files/multipart/post6").pipe(parser);
		await expect(postDataPromise).to.eventually.deep.equal({});
		await expect(fileDataPromise).to.eventually.deep.equal({
			name: "uploaded_file",
			fileName: "post_file.png",
			mimeType: "image/png",
			content: postFile
		});
	});
});