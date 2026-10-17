export class AppError extends Error {
  /**
   * @param {string} code Stable API error code.
   * @param {string} message Safe message for clients.
   * @param {number} [status=400]
   * @param {unknown} [details]
   */
  constructor(code, message, status = 400, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
