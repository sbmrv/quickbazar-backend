/**
 * Validate body, query, and params with a Zod schema.
 * Parsed values are stored on req.validated. Raw req.body is not forwarded to Mongo.
 * @param {import('zod').ZodType} schema
 */
export function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body ?? {},
      query: req.query ?? {},
      params: req.params ?? {},
    });
    if (!result.success) {
      next(result.error);
      return;
    }
    req.validated = result.data;
    next();
  };
}
