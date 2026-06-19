import * as z from 'zod';

export const loginRouteSchema = {
  body: z.object({ 
    email: z.string().email({ message: 'Formato de correo inválido' }), 
    password: z.string() 
  }),
  params: null,
  query: null,
};

export const verifyRouteSchema = {
  body: z.object({ 
    token: z.string() // Cambiado a string para que Zod no rompa tu servidor
  }),
  params: null,
  query: null,
};