import { z } from 'zod';

export const createUserRouteSchema = {
  body: z.object({
    email: z.string().email({ message: 'Formato de correo inválido' }),
    password: z.string().min(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  }),
  params: null,
  query: null,
};