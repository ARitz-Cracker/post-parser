// This code is bad and I should feel bad
const {Writable, PassThrough} = require("stream");

const charsetAliases = {
	"iso-8859-1": "latin1",
	"us-ascii": "ascii",
	"utf-8": "utf8",
	"utf-16le": "utf16le",
	"win-1252": "latin1" // win-1252 to latin1 is technically incorrect, but nobody uses it nowadays anyway.
};

const allowedMultiHeaders = {
	"content-disposition": true,
	"content-transfer-encoding": true,
	"content-type": true
};
const MAX_MULTIPART_HEADER_LENGTH = 1024;

const MULTISTATE_HEADERS = 0;
const MULTISTATE_DATA = 1;
const MULTISTATE_FILE = 2;
const MULTISTATE_IGNORE = 3;

class StreamedMultipartDecoder extends Writable {
	constructor(boundary, maxDataLen = 65535, maxFileLen = 1048576, maxTotalLen = 1114111){
		super();
		this._curDataLen = 0;
		this._maxDataLen = maxDataLen;
		this._curFileLen = 0;
		this._maxFileLen = maxFileLen;
		this._curTotalLen = 0;
		this._maxTotalLen = maxTotalLen;

		this._boundaryStart = Buffer.from("--" + boundary + "\r\n");
		this._boundary = Buffer.from("\r\n--" + boundary);
		this._minBufferLength = (this._boundary.length + 2) * 2;
		this._bufferSearchLength = (this._boundary.length + 2) * 1;
		this._buffer = Buffer.alloc(0);
		this._multistate = MULTISTATE_HEADERS;
		this._curHeaderIndex = 0;
		this._curHeader = Buffer.allocUnsafe(MAX_MULTIPART_HEADER_LENGTH);
		this._curVal = Buffer.alloc(0);
		this._curHeaders = {};
		this.decoded = {};
	}
	processHeader(chunk){
		let headerIndex = chunk.indexOf(58); // ":"
		if(headerIndex === -1){
			// Header is too large or doesn't have a ":"; ignore it.
			return;
		}
		/*
		 * https://tools.ietf.org/html/rfc7578
		 * The multipart/form-data media type does not support any MIME header
		 * fields in parts other than Content-Type, Content-Disposition, and (in
		 * limited circumstances) Content-Transfer-Encoding.  Other header
		 * fields MUST NOT be included and MUST be ignored.
		 */
		const headerKey = chunk.slice(0, headerIndex).toString("ascii")
			.toLowerCase();
		if(!allowedMultiHeaders[headerKey]){
			return;
		}
		headerIndex += 2; // ": "
		let curSubKey = "_";
		let quoted = false;
		this._curHeaders[headerKey] = {};
		while(headerIndex < chunk.length){
			if(curSubKey == null){
				const headerIndex2 = chunk.indexOf(61, headerIndex); // "="
				if(headerIndex2 === -1){
					break; // We don't have to deal with a subheading with no =
				}
				curSubKey = chunk.slice(headerIndex, headerIndex2).toString("ascii")
					.toLowerCase();
				headerIndex = headerIndex2 + 1;
				quoted = chunk[headerIndex] === 34; // "\""
				if(quoted){
					headerIndex += 1;
				}
			}else{
				let headerIndex2 = chunk.indexOf(quoted ? 34 : 59, headerIndex); // quoted ? "\"" : ";"
				if(headerIndex2 === -1){
					headerIndex2 = chunk.length;
				}
				const val = chunk.slice(headerIndex, headerIndex2).toString("ascii");
				this._curHeaders[headerKey][curSubKey] = val;
				curSubKey = null;
				headerIndex = headerIndex2;
				if(quoted){
					headerIndex += 2;
				}else{
					headerIndex += 1;
				}
				while(chunk[headerIndex] === 32){ // " "
					headerIndex += 1;
				}
			}
		}
	}
	handleData(chunk, end){
		let i = 0;
		let nextIndex;
		while(i < chunk.length){
			switch(this._multistate){
				case MULTISTATE_HEADERS:
					nextIndex = chunk.indexOf(this._crlf, i);
					/* istanbul ignore else */
					if(nextIndex === -1){
						/* istanbul ignore else */
						if(this._curHeaderIndex < this._curHeader.length){
							// I'm counting on the Buffer library to protect me against buffer overflow here
							chunk.copy(this._curHeader, this._curHeaderIndex, i);
							this._curHeaderIndex += chunk.length - i;
							i = chunk.length;
						}
						this._headerCRLF = false;
					}else if(i === nextIndex){
						i += 2;
						if(!this._headerCRLF){ // If this._headerCRLF is true, there are 2 CRLFs which means the headers are finished
							// I'm counting on the Node Buffer library to protect me against buffer overflow/underflow here
							this.processHeader(this._curHeader.slice(0, this._curHeaderIndex));
							this._curHeaderIndex = 0;
							this._headerCRLF = true;
							break;
						}

						/*
						 * https://tools.ietf.org/html/rfc7578
						 * Each part MUST contain a Content-Disposition header field [RFC2183]
						 * where the disposition type is "form-data".  The Content-Disposition
						 * header field MUST also contain an additional parameter of "name"; the
						 * value of the "name" parameter is the original field name from the
						 * form
						 */
						if(
							this._curHeaders["content-disposition"] == null ||
							this._curHeaders["content-disposition"]._ !== "form-data" ||
							this._curHeaders["content-disposition"].name == null ||
							this._curDataLen >= this._maxDataLen
						){
							this._multistate = MULTISTATE_IGNORE;
							break;
						}
						this._curDataLen += Buffer.byteLength(this._curHeaders["content-disposition"].name);
						if(this._curHeaders["content-disposition"].filename == null){
							this._multistate = MULTISTATE_DATA;
						}else{
							this._curDataLen += Buffer.byteLength(this._curHeaders["content-disposition"].filename);
							let mimeType = "text/plain";
							/* istanbul ignore else */
							if(this._curHeaders["content-type"] != null && this._curHeaders["content-type"]._){
								mimeType = this._curHeaders["content-type"]._;
							}
							this._fileStream = new PassThrough();
							this.emit("postFile", this._curHeaders["content-disposition"].name, this._curHeaders["content-disposition"].filename, mimeType, this._fileStream);
							// TODO: content-transfer-encoding isn't implemented here
							/* istanbul ignore next */
							if(this._curHeaders["content-transfer-encoding"] != null){
								this.emit("warning", new Error("TODO: Handle content-transfer-encoding"));
							}
							this._multistate = MULTISTATE_FILE;
						}
					}else if(this._curHeaderIndex < this._curHeader.length){
						// I'm counting on the Node Buffer library to protect me against buffer overflow here
						chunk.copy(this._curHeader, this._curHeaderIndex, i, nextIndex);
						this._curHeaderIndex += nextIndex - i;
						this.processHeader(this._curHeader.slice(0, this._curHeaderIndex));
						i = nextIndex + 2;
						this._curHeaderIndex = 0;
						this._headerCRLF = true;
					}
					break;
				case MULTISTATE_DATA:
					/* istanbul ignore else */
					if(this._curDataLen < this._maxDataLen){
						chunk = chunk.slice(i);
						if((this._curDataLen + chunk.length) > this._maxDataLen){
							chunk = chunk.slice(0, this._maxDataLen - this._curDataLen);
						}
						this._curDataLen += chunk.length;
						this._curVal = Buffer.concat([ this._curVal, chunk ], this._curVal.length + chunk.length);
					}
					i = chunk.length;
					break;
				case MULTISTATE_FILE:
					if(this._curFileLen < this._maxFileLen){
						chunk = chunk.slice(i);
						if((this._curFileLen + chunk.length) > this._maxFileLen){
							chunk = chunk.slice(0, this._maxFileLen - this._curFileLen);
						}
						this._curFileLen += chunk.length;
						/*
						 * TODO: There's a BIG assumption that the network is slower than the stream destination (usually a file write stream)
						 * Though the assumption is likely correct, ideally we'd wait until the chunk is written before using the _write callback
						 */
						this._fileStream.write(chunk);
					}
					i = chunk.length;
					break;
				case MULTISTATE_IGNORE:
					i = chunk.length;
					break;
				/* istanbul ignore next */
				default:
					// Shouldn't happen
			}
		}
		if(end){
			switch(this._multistate){
				case MULTISTATE_DATA:{
					let encoding;
					// Charsets are experimental and aren't in included in the unit tests
					/* istanbul ignore next */
					if(this._curHeaders["content-type"] != null && this._curHeaders["content-type"].charset){
						encoding = charsetAliases[this._curHeaders["content-type"].charset];
						if(encoding == null){
							this.emit("warning", new Error("Unsupported charset: " + this._curHeaders["content-type"].charset));
							encoding = "utf8";
						}
					}
					/* istanbul ignore next */
					if(encoding == null && this.decoded._charset_){
						encoding = charsetAliases[this.decoded._charset_];
						if(encoding == null){
							this.emit("warning", new Error("Unsupported charset: " + this.decoded._charset_));
							encoding = "utf8";
						}
					}
					encoding = encoding || "utf8";
					this.decoded[
						this._curHeaders["content-disposition"].name
					] = this._curVal.toString(encoding);
					this._curHeaders = {};
					this._multistate = MULTISTATE_HEADERS;
					this._curVal = Buffer.alloc(0);
					break;
				}
				case MULTISTATE_FILE:
					this._fileStream.end();
					// Falls througs
				case MULTISTATE_IGNORE:
					this._curHeaders = {};
					this._multistate = MULTISTATE_HEADERS;
				default:
					// MULTISTATE_HEADERS goes here, nothing happens.
			}
		}
	}
	lookForBoundry(chunk){
		const index = chunk.indexOf(this._boundary);
		if(index >= 0){
			const termIndex = index + this._boundary.length;
			const termSlice = chunk.slice(termIndex, termIndex + 2);
			if(termSlice.equals(this._boundarySeperate)){
				return [ index, termIndex + 2 ];
			}else if(termSlice.equals(this._boundaryEnd)){
				return [ index, null ];
			}
			// Not a proper boundry, handle it as normal data
		}
		return [ null, null ];
	}
	processBounderies(maxLen){
		while(this._buffer.length >= maxLen){
			const searchEnd = this._buffer.length - this._bufferSearchLength;
			if(searchEnd < 0){
				this.handleData(this._buffer, true);
				break;
			}
			const[ dataEnd, newDataStart ] = this.lookForBoundry(this._buffer);
			if(dataEnd == null){
				this.handleData(this._buffer.slice(0, searchEnd), false);
				this._buffer = this._buffer.slice(searchEnd);
			}else{
				this.handleData(this._buffer.slice(0, dataEnd), true);
				if(newDataStart){
					this._buffer = this._buffer.slice(newDataStart);
				}else{
					this.ended = true;
					break;
				}
			}
		}
	}
	_write(chunk, encoding, callback){
		if(this.ended || this._curTotalLen >= this._maxTotalLen){
			callback();
			return;
		}
		this._curTotalLen += chunk.length;
		if(this._curTotalLen > this._maxTotalLen){
			chunk = chunk.slice(0, chunk.length - (this._curTotalLen - this._maxTotalLen));
		}

		this._buffer = Buffer.concat([ this._buffer, chunk ], this._buffer.length + chunk.length);
		if(this._buffer.length < this._minBufferLength){
			callback();
			return;
		}
		if(this._boundaryStart != null){
			if(this._buffer.slice(0, this._boundaryStart.length).equals(this._boundaryStart)){
				this._buffer = this._buffer.slice(this._boundaryStart.length);
				delete this._boundaryStart;
			}else{
				this.ended = true;
				callback();
				return;
			}
		}
		this.processBounderies(this._minBufferLength);
		callback();
	}
	_final(callback){
		if(!this.ended && this._buffer.length > 0){
			this.processBounderies(0);
		}
		this.emit("postData", this.decoded);
		callback();
	}
}
StreamedMultipartDecoder.prototype._crlf = Buffer.from("\r\n");
StreamedMultipartDecoder.prototype._boundarySeperate = StreamedMultipartDecoder.prototype._crlf;
StreamedMultipartDecoder.prototype._boundaryEnd = Buffer.from("--");

module.exports = {StreamedMultipartDecoder};
