import { z } from 'zod';

/**
 * Generic validation middleware using Zod.
 * Validates req.body against the provided schema.
 */
export const validateRequest = (schema) => (req, res, next) => {
  try {
    // We use parse instead of safeParse to throw the error to the catch block
    // We also re-assign req.body to the parsed value in case Zod applied any transforms/defaults
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues || error.errors || [];
      const errors = issues.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      const combinedMessage = errors.map(e => e.message).join(', ');
      return res.status(400).json({ success: false, errors, message: combinedMessage });
    }
    return res.status(400).json({ success: false, message: 'Invalid request data' });
  }
};

// Validation Schemas

export const registerSchema = z.object({
  display_name: z.string().min(2, 'Display name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});
