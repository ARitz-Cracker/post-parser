/*
	1:
	POST / HTTP/1.1
	Content-Type: application/x-www-form-urlencoded
	Content-Length: 28

	2:
	Host: elur1.bste.ca
	User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:69.0) Gecko/20100101 Firefox/69.0
	Content-Type: multipart/form-data; boundary=---------------------------6221225311476398382234923175
	Content-Length: 1329
*/

const chai = require('chai');
chai.use(require("chai-as-promised"));
const expect = chai.expect;
const{StreamedMultipartDecoder} = require("../parser-types/multipart.js");
const{BufferStream} = require("../lib/buffer-stream.js");
const fs = require("fs");

const post_file = fs.readFileSync(__dirname + "/../test_files/multipart/post_file.png");

const doTest = async function(testFile, chunkLength, boundary, delay = 10, maxDataLen, maxFileLen, MaxTotalLen) {
	const decoder = new StreamedMultipartDecoder(boundary, maxDataLen, maxFileLen, MaxTotalLen)
	const data = await fs.promises.readFile(__dirname + "/../test_files/multipart/" + testFile);
	if (chunkLength == null){
		chunkLength = data.length;
	}
	let result = {
		files: {},
	};
	decoder.on("postFile", async (name, fileName, mimeType, fileStream) => {
		const fileContent = new BufferStream();
		fileStream.pipe(fileContent);
		result.files[name] = {
			fileName,
			mimeType,
			content: await fileContent.result()
		}
	});
	const postData = new Promise((resolve) => {
		decoder.on("postData", resolve);
	})
	for (let i = 0; i < data.length; i += chunkLength){
		await new Promise((resolve) => {
			setTimeout(resolve, delay);
		});
		decoder.write(data.slice(i, i + chunkLength));
	}
	decoder.end();
	result.data = await postData;
	return result;
}

describe("POST Parsing: Multipart", function() {
	if (process.env.NYC_CONFIG == null && process.env.TEST_EVERYTHING == null && process.env.VSCODE_IPC_HOOK == null){
		before(function() {
			this.skip();
		});
	}
	it("decodes a single key with a single value", function() {
		return expect((async() => {
			return doTest("post1", null, "---------------------------14137654051526174327127624341");
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world"
				}
			}
		)
	});
	it("decodes a single key with a single value (unqoted name)", function() {
		return expect((async() => {
			return doTest("post1_no_quote", null, "---------------------------14137654051526174327127624341");
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world"
				}
			}
		)
	});

	it("decodes a single key with a single value and a slow connection", function() {
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
					data: {
						hello: "world"
					}
				},
				{
					files: {},
					data: {
						hello: "world"
					}
				},
				{
					files: {},
					data: {
						hello: "world"
					}
				},
				{
					files: {},
					data: {
						hello: "world"
					}
				},
				{
					files: {},
					data: {
						hello: "world"
					}
				}
			]
		)
	});
	

	it("decodes a multiple values", function() {
		return expect((async() => {
			return doTest("post2", null, "---------------------------14137654051526174327127624341");
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		)
	});
	
	it("decodes multiple values and a slow connection", function() {
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
		)
	});
	it("ignores messages that do not start with the boundary", function() {
		return expect((async() => {
			return doTest("post3", null, "---------------------------14137654051526174327127624341");
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {}
			}
		)
	});
	it("ignores a message with no Content-Disposition header", function() {
		return expect((async() => {
			return doTest("post4", null, "---------------------------14137654051526174327127624341");
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		)
	});

	it("ignores invalid headers", function() {
		return expect((async() => {
			return doTest("post_4_1", null, "---------------------------14137654051526174327127624341");
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		)
	});
	
	it("ignores a message with Content-Disposition not set to form-data", function() {
		return expect((async() => {
			return doTest("post5", null, "---------------------------14137654051526174327127624341");
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		)
	});

	it("ignores data further than the maxTotal limit", function() {
		return expect((async() => {
			return doTest("post2", null, "---------------------------14137654051526174327127624341", 1, undefined, undefined, 188);
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world"
				}
			}
		)
	});

	it("ignores data further than the maxTotal limit (slow)", function() {
		return expect((async() => {
			return doTest("post2", 2, "---------------------------14137654051526174327127624341", 1, undefined, undefined, 188);
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world"
				}
			}
		)
	});
	it("ignores data further than the maxData limit", function() {
		return expect((async() => {
			return doTest("post2", 2, "---------------------------14137654051526174327127624341", 1, 8);
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "wor"
				}
			}
		)
	});
	it("upload files", function() {
		return expect((async() => {
			return doTest("post6", null, "---------------------------14137654051526174327127624341");
		})()).to.eventually.deep.equal(
			{
				files: {
					uploaded_file: {
						fileName: "post_file.png",
						mimeType: "image/png",
						content: post_file
					}
				},
				data: {}
			}
		)
	});

	it("truncates files if they're above the file size limit", function() {
		return expect((async() => {
			return doTest("post6", null, "---------------------------14137654051526174327127624341", 1, undefined, 6969);
		})()).to.eventually.deep.equal(
			{
				files: {
					uploaded_file: {
						fileName: "post_file.png",
						mimeType: "image/png",
						content: post_file.slice(0, 6969)
					}
				},
				data: {}
			}
		)
	});

	it("upload files (slow)", function() {
		return expect((async() => {
			return doTest("post6", 100, "---------------------------14137654051526174327127624341", 1);
		})()).to.eventually.deep.equal(
			{
				files: {
					uploaded_file: {
						fileName: "post_file.png",
						mimeType: "image/png",
						content: post_file
					}
				},
				data: {}
			}
		)
	});
	
	it("truncates files if they're above the file size limit (slow)", function() {
		return expect((async() => {
			return doTest("post6", 69, "---------------------------14137654051526174327127624341", 1, undefined, 6969);
		})()).to.eventually.deep.equal(
			{
				files: {
					uploaded_file: {
						fileName: "post_file.png",
						mimeType: "image/png",
						content: post_file.slice(0, 6969)
					}
				},
				data: {}
			}
		)
	});

	it("handles a boundery without a CRLF as part of the data", function() {
		return expect((async() => {
			return doTest("post7", null, "4yylm40");
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you\r\n--4yylm40sike"
				}
			}
		)
	});
	
	it("handles a boundery without a CRLF as part of the data (slow)", function() {
		return expect((async() => {
			return doTest("post7", 2, "4yylm40", 2);
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you\r\n--4yylm40sike"
				}
			}
		)
	});

	it("Passes one final sanity check for dat sweet sweet 100%", function() {
		return expect((async() => {
			return doTest("post8", 2, "4yylm40", 2);
		})()).to.eventually.deep.equal(
			{
				files: {},
				data: {
					hello: "world",
					thank: "you"
				}
			}
		)
	});
});