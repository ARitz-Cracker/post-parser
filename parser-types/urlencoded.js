/*
 * A lot of this code is adapted from querystring.unescapeBuffer in NodeJS
 * Copyright Joyent, Inc. and other Node contributors.
 * Copyright (c) 2019-2020 Aritz Beobide-Cardinal
 */
const {Writable} = require("stream");

// eslint-disable-next-line no-magic-numbers
// eslint-disable-next-line array-element-newline
const unhexTable = new Int8Array([
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 0 - 15
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 16 - 31
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 32 - 47
	+0, +1, +2, +3, +4, +5, +6, +7, +8, +9, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 48 - 63
	-1, 10, 11, 12, 13, 14, 15, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 64 - 79
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 80 - 95
	-1, 10, 11, 12, 13, 14, 15, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 96 - 111
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 112 - 127
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */ // 128 ...
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, /* eslint-disable-line */
	-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1  /* eslint-disable-line */ // ... 255
]);

class StreamedURIDecoder extends Writable {
	constructor(maxLen = 65535){
		super();
		this.curLen = 0;
		this.maxLen = maxLen;
		this.URIState = 0;
		this.outIndex = 0;
		this._n = 0;
		this._m = 0;
		this._hexchar = 0;
		this._key = true;
		this._curKey = Buffer.allocUnsafe(0);
		this._curVal = Buffer.from([115]);
		this.decoded = {};
	}
	checkPostdataSeperators(c){
		if(this._key){
			if(c === 61){ // "="
				this._curKey = this._curKey.slice(0, this.outIndex);
				// console.log(this._curKey+"");
				this._key = false;
				this.outIndex = 0; // First value is "s"
			}else{
				return true;
			}
		}else if(c === 38){ // "&"
			this._key = true;
			const propertyName = this._curKey.toString();
			if(isSafeProperty(propertyName)){
				this.decoded[propertyName] = this._curVal.slice(0, this.outIndex).toString();
			}
			this._curKey = Buffer.allocUnsafe(0);
			this._curVal = Buffer.allocUnsafe(0);
			this.outIndex = 0;
		}else{
			return true;
		}
	}
	_write(chunk, encoding, callback){
		if(this.curLen >= this.maxLen){
			callback();
			return;
		}
		for(let i = 0; i < chunk.length; i += 1){
			this.curLen += 1;
			if(this.curLen > this.maxLen){
				break;
			}
			let c = chunk[i];
			// based on querystring.unescapeBuffer

			let out = null;
			if(this._key){
				out = this._curKey;
			}else{
				out = this._curVal;
			}
			const bytesToGo = chunk.length - i;
			if(out.length - this.outIndex < bytesToGo){
				const newbuff = Buffer.allocUnsafe(out.length + bytesToGo);
				out.copy(newbuff);
				if(this._key){
					this._curKey = newbuff;
				}else{
					this._curVal = newbuff;
				}
				out = newbuff;
			}
			// console.log(out);
			switch(this.URIState){
				case 0: // Any character
					switch(c){
						case 37: // '%'
							this._n = 0;
							this._m = 0;
							this.URIState = 1;
							break;
						case 43: // '+'
							c = 32; // ' '
							// falls through
						default:
							if(this.checkPostdataSeperators(c)){
								out[this.outIndex++] = c;
								/*
								 * console.log(c, String.fromCharCode(c));
								 * console.log(out);
								 */
							}
							break;
					}
					break;
				case 1: // First hex digit
					this._hexchar = c;
					this._n = unhexTable[c];
					if(!(this._n >= 0)){
						out[this.outIndex++] = 37; // '%'
						if(this.checkPostdataSeperators(c)){
							out[this.outIndex++] = c;
						}
						this.URIState = 0;
						break;
					}
					this.URIState = 2;
					break;

				case 2: // Second hex digit
					this.URIState = 0;
					this._m = unhexTable[c];
					if(!(this._m >= 0)){
						out[this.outIndex++] = 37; // '%'
						out[this.outIndex++] = this._hexchar;
						if(this.checkPostdataSeperators(c)){
							out[this.outIndex++] = c;
						}
						break;
					}
					out[this.outIndex++] = 16 * this._n + this._m;
					break;
				/* istanbul ignore next */
				default:
					// Shouldn't happen
			}
		}
		callback();
	}
	_final(callback){
		if(this.URIState > 0){
			let out = null;
			if(this._key){
				out = this._curKey;
			}else{
				out = this._curVal;
			}
			if(out.length - this.outIndex < this.URIState){
				const newbuff = Buffer.allocUnsafe(out.length + this.URIState);
				out.copy(newbuff);
				if(this._key){
					this._curKey = newbuff;
				}else{
					this._curVal = newbuff;
				}
				out = newbuff;
			}

			out[this.outIndex++] = 37/* %*/;
			if(this.URIState === 2){
				out[this.outIndex++] = this._hexchar;
			}
		}
		let propertyName;
		let propertyValue;
		if(this._key){
			propertyName = this._curKey.slice(0, this.outIndex).toString();
			propertyValue = null;
		}else{
			propertyName = this._curKey.toString();
			propertyValue = this._curVal.slice(0, this.outIndex).toString();
		}
		if(isSafeProperty(propertyName)){
			this.decoded[propertyName] = propertyValue;
		}
		this.emit("postData", this.decoded);
		callback();
	}
}

module.exports = {StreamedURIDecoder};
