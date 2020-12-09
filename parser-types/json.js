const{Writable} = require("stream");

class StreamedJSONDecoder extends Writable {
	constructor(maxLen = 65535){
		super();
		this.curLen = 0;
		this.maxLen = maxLen;
		this._buffer = Buffer.alloc(0);
	}
	_write(chunk, encoding, callback){
		if(this.curLen < this.maxLen){
			if((this.curLen + chunk.length) > this.maxLen){
				this._buffer = Buffer.concat([
					this._buffer,
					chunk.slice(0, chunk.length - ((this.curLen + chunk.length) - this.maxLen))
				], this.maxLen);
				this.curLen = this.maxLen;
			}else{
				this._buffer = Buffer.concat([ this._buffer, chunk ], this._buffer.length + chunk.length);
				this.curLen += chunk.length;
			}
		}
		callback();
	}
	_final(callback){
		try{
			this.emit("postData", JSON.parse(this._buffer.toString()));
		}catch(ex){
			this.emit("postData", {});
		}
		callback();
	}
}

module.exports = {StreamedJSONDecoder};