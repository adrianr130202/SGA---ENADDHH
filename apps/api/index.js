import 'dotenv/config';
import express from 'express';
import { ZodError } from 'zod';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import userRouter from './features/user/user.routes.js';
import authRouter from './features/auth/auth.routes.js';
import studentRouter from './features/student/student.routes.js';
import { authenticate } from './features/auth/auth.middlewares.js';
import courseRouter from './features/course/course.routes.js';
import enrollmentRouter from './features/enrollments/enrollment.routes.js';

//  Configuración  rutas  del servidor
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
//  El puerto ahora se adapta a Render automáticamente
const port = process.env.PORT || 3000; 

// Configuración global (Middlewares)
app.use(cors({ 
  origin: ['http://localhost:4321', 'http://127.0.0.1:4321'],
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

// Rutas de la API (Backend)
app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/students', authenticate, studentRouter);
app.use('/api/courses', authenticate, courseRouter); 
app.use('/api/enrollments', enrollmentRouter);

const clientAssetsPath = path.join(__dirname, '../client/dist/client');
app.use(express.static(clientAssetsPath));

try {
  const { handler: ssrHandler } = await import('../client/dist/server/entry.mjs');
  app.use(ssrHandler);
} catch (error) {
  console.log('⚠️ Aviso local: Build de Astro no encontrado. Se necesita ejecutar "npm run build -w client".');
}
// =====================================================================

// Manejador de Errores Global
app.use((err, req, res, _next) => {
  let errorString = 'Desconocido';
  let errorCode = 500;

  // Error de Validación (Zod)
  if (err instanceof ZodError) {
    const errorsFormatted = err.issues.map((issue) => {
      return `${issue.path[0].toUpperCase()}: ${issue.message}.\n`;
    });
    errorString = errorsFormatted.join('');
    errorCode = 400;
  }

  // Error de Base de Datos PostgreSQL (Supabase)
  if (err.code === '23505') { 
    errorCode = 400;
    errorString = `Este registro ya existe y se encuentra en uso.`;
  }

  // Errores de Seguridad (Tokens)
  if (err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ error: 'Token expirado' });
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return res.status(403).json({ error: 'Token inválido' });
  }

  console.error(err);
  return res.status(errorCode).json({ error: errorString });
});

app.listen(port, () => {
  console.log(`Sistema  SGA-ENADDHH corriendo en el puerto ${port}`);
});

export default app;