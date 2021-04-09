const {Writable} = require("stream");
const {stripUnsafeProperties} = require("safeify-object");
const {HTTP_STATUS_PAYLOAD_TOO_LARGE, POSTParseError} = require("../error");
class StreamedJSONDecoder extends Writable {
	constructor(maxLen = 65535){
		super();
		this.curLen = 0;
		this.maxLen = maxLen;
		this._buffer = Buffer.alloc(0);
	}
	_write(chunk, encoding, callback){
		if((this.curLen + chunk.length) > this.maxLen){
			callback(new POSTParseError("JSON body too large", HTTP_STATUS_PAYLOAD_TOO_LARGE));
		}else{
			this._buffer = Buffer.concat([this._buffer, chunk], this._buffer.length + chunk.length);
			this.curLen += chunk.length;
			callback();
		}
	}
	_final(callback){
		try{
			// TODO: Maybe fork the jsonparse module and change all the deprecated features it uses
			this.emit("postData", stripUnsafeProperties(JSON.parse(this._buffer.toString())));
		}catch(ex){
			// Truncated, invalid, etc. etc.
			callback(ex);
		}
	}
}

module.exports = {StreamedJSONDecoder};
