const HTTP_STATUS_PAYLOAD_TOO_LARGE = 413;
const HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE = 415;

/**
 * Thrown by the POSTParser constructor when the content-type header given is invaild, or when content-type is too
 * large. Also emitted in an "error" event if an indivial data value or file is too large
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
module.exports = {
	HTTP_STATUS_PAYLOAD_TOO_LARGE,
	HTTP_STATUS_UNSUPPORTED_MEDIA_TYPE,
	POSTParseError
};
