import * as z from 'zod';

export const authSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  accessToken: z.jwt(),
});

/** @typedef {z.infer<typeof authSchema>} Auth */
