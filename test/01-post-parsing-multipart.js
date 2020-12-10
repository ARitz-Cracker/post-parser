/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-magic-numbers */
/* eslint-disable require-await */
const chai = require("chai");
chai.use(require("chai-as-promised"));
const expect = chai.expect;
const {StreamedMultipartDecoder} = require("../parser-types/multipart.js");
const {StreamToBuffer} = require("stream-to-buffer-to-stream");
const fs = require("fs");
const {Transform} = require("stream");

const postFile = fs.readFileSync(__dirname + "/../test_files/multipart/post_file.png");

const doTest = async function(testFile, chunkLength, boundary, delay = 10, maxDataLen, maxFileLen, MaxTotalLen){
	const decoder = new StreamedMultipartDecoder(boundary, maxDataLen, maxFileLen, MaxTotalLen);
	const data = await fs.promises.readFile(__dirname + "/../test_files/multipart/" + testFile);
	if(chunkLength == null){
		chunkLength = data.length;
	}
	const result = {files: {}};
	decoder.on("postFile", async(name, fileName, mimeType, fileStream) => {
		const fileContent = new StreamToBuffer();
		fileStream.pipe(fileContent);
		result.files[name] = {
			fileName,
			mimeType,
			content: await fileContent.result()
		};
	});
	const postData = new Promise(resolve => {
		decoder.on("postData", resolve);
	});
	for(let i = 0; i < data.length; i += chunkLength){
		await new Promise(resolve => {
			setTimeout(resolve, delay);
		});
		decoder.write(data.slice(i, i + chunkLength));
	}
	decoder.end();
	result.data = await postData;
	return result;
};
describe("POST Parsing: Multipart", function(){
	if(process.env.NYC_CONFIG == null && process.env.TEST_EVERYTHING == null && process.env.VSCODE_IPC_HOOK == null){
		before(function(){
			this.skip();
		});
	}
	it("decodes a single key with a single value", function(){
		return expect((async() => doTest("post1", null, "---------------------------14137654051526174327127624341"))()).to.eventually.deep.equal(
			{
				files: {},
				data: {hello: "world"}
			}
		);
	});
	it("decodes a single key with a single value (unqoted name)", function(){
		return expect((async() => doTest("post1_no_quote", null, "---------------------------14137654051526174327127624341"))()).to.eventually.deep.equal(
			{
				files: {},
				data: {hello: "world"}
			}
		);
	});

	it("decodes a single key with a single value and a slow connection", function(){
		return expect(Promise.all([
			doTest("post1", 1, "---------------------------14137654051526174327127624341", 1),
			doTest("post1", 2, "---------------------------14137654051526174327127624341", 1),
			doTest("post1", 16, "---------------------------14137654051526174327127624341", 1),
			doTest("post1", 50, "---------------------------14137654051526174327127624341", 1),
			doTest("post1", 100, "---------------------------14137654051526174327127624341", 1)
		])).to.eventually.deep.equal(
			[
				{
					files: {},
					data: {hello: "world"}
				},
				{
					files: {},
					data: {hello: "world"}
				},
				{
					files: {},
					data: {hello: "world"}
				},
				{
					files: {},
					data: {hello: "world"}
				},
				{
					files: {},
					data: {hello: "world"}
				}
			]
		);
	});


	it("decodes a multiple values", function(){
		return expect((async() => doTest("post2", null, "---------------------------14137654051526174327127624341"))()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		);
	});

	it("decodes multiple values and a slow connection", function(){
		return expect(Promise.all([
			doTest("post2", 1, "---------------------------14137654051526174327127624341", 1),
			doTest("post2", 2, "---------------------------14137654051526174327127624341", 1),
			doTest("post2", 16, "---------------------------14137654051526174327127624341", 1),
			doTest("post2", 50, "---------------------------14137654051526174327127624341", 1),
			doTest("post2", 100, "---------------------------14137654051526174327127624341", 1)
		])).to.eventually.deep.equal(
			[
				{
					files: {},
					data: {
						hello: "world",
						thank: "you"
					}
				},
				{
					files: {},
					data: {
						hello: "world",
						thank: "you"
					}
				},
				{
					files: {},
					data: {
						hello: "world",
						thank: "you"
					}
				},
				{
					files: {},
					data: {
						hello: "world",
						thank: "you"
					}
				},
				{
					files: {},
					data: {
						hello: "world",
						thank: "you"
					}
				}
			]
		);
	});
	it("ignores messages that do not start with the boundary", function(){
		return expect((async() => doTest("post3", null, "---------------------------14137654051526174327127624341"))()).to.eventually.deep.equal(
			{
				files: {},
				data: {}
			}
		);
	});
	it("ignores a message with no Content-Disposition header", function(){
		return expect((async() => doTest("post4", null, "---------------------------14137654051526174327127624341"))()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		);
	});

	it("ignores invalid headers", function(){
		return expect((async() => doTest("post_4_1", null, "---------------------------14137654051526174327127624341"))()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		);
	});

	it("ignores a message with Content-Disposition not set to form-data", function(){
		return expect((async() => doTest("post5", null, "---------------------------14137654051526174327127624341"))()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		);
	});

	it("ignores data further than the maxTotal limit", function(){
		return expect((async() => doTest("post2", null, "---------------------------14137654051526174327127624341", 1, undefined, undefined, 188))()).to.eventually.deep.equal(
			{
				files: {},
				data: {hello: "world"}
			}
		);
	});

	it("ignores data further than the maxTotal limit (slow)", function(){
		return expect((async() => doTest("post2", 2, "---------------------------14137654051526174327127624341", 1, undefined, undefined, 188))()).to.eventually.deep.equal(
			{
				files: {},
				data: {hello: "world"}
			}
		);
	});
	it("ignores data further than the maxData limit", function(){
		return expect((async() => doTest("post2", 2, "---------------------------14137654051526174327127624341", 1, 8))()).to.eventually.deep.equal(
			{
				files: {},
				data: {hello: "wor"}
			}
		);
	});
	it("upload files", function(){
		return expect((async() => doTest("post6", null, "---------------------------14137654051526174327127624341"))()).to.eventually.deep.equal(
			{
				files: {
					uploaded_file: {
						fileName: "post_file.png",
						mimeType: "image/png",
						content: postFile
					}
				},
				data: {}
			}
		);
	});

	it("truncates files if they're above the file size limit", function(){
		return expect((async() => doTest("post6", null, "---------------------------14137654051526174327127624341", 1, undefined, 6969))()).to.eventually.deep.equal(
			{
				files: {
					uploaded_file: {
						fileName: "post_file.png",
						mimeType: "image/png",
						content: postFile.slice(0, 6969)
					}
				},
				data: {}
			}
		);
	});

	it("upload files (slow)", function(){
		return expect((async() => doTest("post6", 100, "---------------------------14137654051526174327127624341", 1))()).to.eventually.deep.equal(
			{
				files: {
					uploaded_file: {
						fileName: "post_file.png",
						mimeType: "image/png",
						content: postFile
					}
				},
				data: {}
			}
		);
	});

	it("truncates files if they're above the file size limit (slow)", function(){
		return expect((async() => doTest("post6", 69, "---------------------------14137654051526174327127624341", 1, undefined, 6969))()).to.eventually.deep.equal(
			{
				files: {
					uploaded_file: {
						fileName: "post_file.png",
						mimeType: "image/png",
						content: postFile.slice(0, 6969)
					}
				},
				data: {}
			}
		);
	});

	it("handles a boundery without a CRLF as part of the data", function(){
		return expect((async() => doTest("post7", null, "4yylm40"))()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you\r\n--4yylm40sike"
				}
			}
		);
	});

	it("handles a boundery without a CRLF as part of the data (slow)", function(){
		return expect((async() => doTest("post7", 2, "4yylm40", 2))()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you\r\n--4yylm40sike"
				}
			}
		);
	});

	it("Passes one final sanity check for dat sweet sweet 100%", function(){
		return expect((async() => doTest("post8", 2, "4yylm40", 2))()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		);
	});
	it("Ignores potentially unsafe properties", function(){
		return expect((async() => doTest("post9", 2, "4yylm40", 2))()).to.eventually.deep.equal(
			{
				files: {},
				data: {}
			}
		);
	});
	it("Can handle large file uploads with slow stream destinations", async function(){
		this.timeout(100000);
		const multipartDecoder = new StreamedMultipartDecoder("4yylm40");
		const postFilePromise = new Promise(resolve => {
			multipartDecoder.once("postFile", async(name, fileName, mimeType, fileStream) => {
				const fileContent = new StreamToBuffer();
				const slowStream = new Transform({
					highWaterMark: 1024,
					transform(chunk, encoding, callback){
						setTimeout(() => {
							callback(null, chunk);
						}, 10);
					}
				});
				fileStream.pipe(slowStream);
				slowStream.pipe(fileContent);
				resolve({
					name,
					fileName,
					mimeType,
					content: await fileContent.result()
				});
			});
		});
		const postDataPromise = new Promise(resolve => {
			multipartDecoder.on("postData", resolve);
		});
		multipartDecoder.write("--4yylm40\r\n" +
			"Content-Disposition: form-data; name=\"file_upload\"; filename=\"big_data.txt\"\r\n" +
			"Content-Type: text/plain\r\n\r\n");
		for(let i = 0; i < 1000; i += 1){
			if(!multipartDecoder.write("A".repeat(1000))){
				await new Promise(resolve => {
					multipartDecoder.once("drain", resolve);
				});
			}
		}
		multipartDecoder.end("\r\n--4yylm40--");
		await expect(postDataPromise).to.eventually.deep.equal({});
		await expect(postFilePromise).to.eventually.deep.equal({
			name: "file_upload",
			fileName: "big_data.txt",
			mimeType: "text/plain",
			content: Buffer.alloc(1000000, "A")
		});
	});
	it("Can handle multiple large file uploads with slow stream destinations", async function(){
		this.timeout(100000);
		const multipartDecoder = new StreamedMultipartDecoder("4yylm40");
		const postFilePromises = [];
		const postFilePromiseResolvers = [];
		for(let i = 0; i < 10; i += 1){
			postFilePromises.push(new Promise(resolve => {
				postFilePromiseResolvers.push(resolve);
			}));
		}
		multipartDecoder.on("postFile", async(name, fileName, mimeType, fileStream) => {
			const fileUploadId = Number(name.substring("file_upload_".length));
			const fileContent = new StreamToBuffer();
			const slowStream = new Transform({
				highWaterMark: 1024,
				transform(chunk, encoding, callback){
					setTimeout(() => {
						callback(null, chunk);
					}, 10);
				}
			});
			fileStream.pipe(slowStream);
			slowStream.pipe(fileContent);
			postFilePromiseResolvers[fileUploadId]({
				name,
				fileName,
				mimeType,
				content: await fileContent.result()
			});
		});
		const postDataPromise = new Promise(resolve => {
			multipartDecoder.on("postData", resolve);
		});
		for(let i = 0; i < 10; i += 1){
			multipartDecoder.write("--4yylm40\r\n" +
				"Content-Disposition: form-data; name=\"file_upload_" + i + "\"; filename=\"big_data_" + i + ".txt\"\r\n" +
				"Content-Type: text/plain\r\n\r\n");
			for(let ii = 0; ii < 100; ii += 1){
				// AAAA..., BBBB..., CCCC..., etc.
				if(!multipartDecoder.write(String.fromCharCode(65 + i).repeat(1000))){
					await new Promise(resolve => {
						multipartDecoder.once("drain", resolve);
					});
				}
			}
			multipartDecoder.write("\r\n");
		}
		multipartDecoder.end("--4yylm40--");
		await expect(postDataPromise).to.eventually.deep.equal({});
		const fileUploadExpectedValues = [];
		for(let i = 0; i < 10; i += 1){
			fileUploadExpectedValues[i] = {
				name: "file_upload_" + i,
				fileName: "big_data_" + i + ".txt",
				mimeType: "text/plain",
				content: Buffer.alloc(100000, 65 + i)
			};
		}
		await expect(Promise.all(postFilePromises)).to.eventually.deep.equal(fileUploadExpectedValues);
	});
});
