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
	 * @param {number} httpStatus
	 */
	constructor(message, httpStatus){
		super(message);
		this.httpStatus = httpStatus;
	}
}
POSTParseError.prototype.name = "POSTParseError";

/**
 * Parses the body of a POST request
 * @public
 */
class POSTParser extends PassThrough {
	/**
	 * @param {string} fullContentType the value of the received "content-type" header 
	 * @param {number} [maxTotalLen=1114111] (Only applies to multipart POSTs) the total length of the post body in
	 * bytes
	 * @param {number} [maxDataLen=65535] Total length of the post body if JSON or uri-encoded posts, or the total size
	 * of non-file data in multipart posts
	 * @param {number} [maxFileLen=1048576] Total length of every file submitted in a multipart POST request
	 */
	constructor(fullContentType, maxTotalLen, maxDataLen, maxFileLen){
		super();
		let extraStuff = "";
		let contentType = "";
		let i = fullContentType.indexOf(";");
		if(i >= 0){
			contentType = fullContentType.substring(0, i);
			i += 1;
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
				extraStuff = fullContentType.substring(i).trim();
				if(extraStuff.length <= 9 || !extraStuff.startsWith("boundary=")){
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
			/**
			 * Fires when the parsing of the POST request is completed. This event will always fire after any
			 * `postFile` events.
			 * @event POSTParser#postData
			 * @param {Object} submittedData The user-submitted data, note that any properties which exist on
			 * Object.prototype will be removed
			 */
			this.emit("postData", ...args);
		});
		this.parser.on("postFile", (...args) => {
			/**
			 * Fires when the user is attempting to upload a file
			 * @event POSTParser#postFile
			 * @param {string} name the parameter name (name property on the input element)
			 * @param {string} fileName name of the file
			 * @param {string} mimeType the file type the client claims the file to be
			 * @param {ReadableStream} fileData the file being uploaded. Note that some data may be buffered, which
			 * means the `postData` event may emit _before_ the data here is drained
			 */
			this.emit("postFile", ...args);
		});
		this.pipe(this.parser);
	}
}

module.exports = {POSTParser, POSTParseError};
