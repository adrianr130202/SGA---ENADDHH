import 'dotenv/config';
import express from 'express';
import { ZodError } from 'zod';
import { SqliteError } from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import userRouter from './features/user/user.routes.js';
import authRouter from './features/auth/auth.routes.js';
import studentRouter from './features/student/student.routes.js';
import { authenticate } from './features/auth/auth.middlewares.js';
import courseRouter from './features/course/course.routes.js';
import enrollmentRouter from './features/enrollments/enrollment.routes.js';



const app = express();
const port = 3000;

// Configuración global (Middlewares)
app.use(cors({ 
  origin: ['http://localhost:4321', 'http://127.0.0.1:4321'],
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api/students', authenticate, studentRouter);
app.use('/api/courses', authenticate, courseRouter); 
app.use('/api/enrollments', enrollmentRouter);


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

  // Error de Base de Datos (SQLite)
  if (err instanceof SqliteError) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      const property = err.message.split('.')[1];
      errorCode = 400;
      errorString = `${property.toUpperCase()} ya se encuentra en uso.`;
    }
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
  console.log(`SGA-ENADDHH corriendo en http://localhost:${port}`);
});

export default app;