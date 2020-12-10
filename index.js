const {PassThrough} = require("stream");
const {StreamedJSONDecoder} = require("./parser-types/json.js");
const {StreamedMultipartDecoder} = require("./parser-types/multipart.js");
const {StreamedURIDecoder} = require("./parser-types/urlencoded.js");
const HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE = 415;
const HTTP_STATUS_ERROR = 500;


/**
 * Thrown by the POSTParser constructor when the content-type header given is invaild
 */
class POSTParseError extends Error {
	/**
	 * @param {string} message
	 * @param {number} [httpStatus=500]
	 */
	constructor(message, httpStatus){
		super(message);
		this.httpStatus = (httpStatus | 0) || HTTP_STATUS_ERROR;
	}
}
POSTParseError.prototype.name = "POSTParseError";

class POSTParser extends PassThrough {
	constructor(fullContentType, maxTotalLen, maxDataLen, maxFileLen){
		super();
		let extraStuff = "";
		let contentType = "";
		let i = fullContentType.indexOf(";");
		if(i >= 0){
			contentType = fullContentType.substring(0, i);
			while(fullContentType[i] === " "){
				i += 1;
			}
			extraStuff = fullContentType.substring(i);
		}else{
			contentType = fullContentType;
		}
		switch(contentType){
			case "application/json":
				this.parser = new StreamedJSONDecoder(maxDataLen);
				break;
			case "application/x-www-form-urlencoded":
				this.parser = new StreamedURIDecoder(maxDataLen);
				break;
			case "multipart/form-data":{
				extraStuff = fullContentType.substring(i + 1).trim();
				if(extraStuff.length <= 9 || !extraStuff.startsWith("boundary=")){
					console.log(extraStuff);
					throw new POSTParseError("content-type is malformed: " + contentType, HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE);
				}
				let boundary = extraStuff.substring(9).trim();
				if(boundary[0] === "\"" && boundary[0] === boundary[boundary.length - 1]){
					boundary = boundary.substr(1, boundary.length - 2);
				}
				this.parser = new StreamedMultipartDecoder(boundary, maxDataLen, maxFileLen, maxTotalLen);
				break;
			}
			case "null":
				this.on("data", Function.prototype);
				process.nextTick(() => {
					this.emit("postData", {});
				});
				return;
			default:
				// No default
		}
		if(this.parser == null){
			throw new POSTParseError("Unsupported content-type: " + contentType, HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE);
		}
		this.parser.on("postData", (...args) => {
			this.emit("postData", ...args);
		});
		this.parser.on("postFile", (...args) => {
			this.emit("postFile", ...args);
		});
		this.pipe(this.parser);
	}
}

module.exports = {POSTParser};
