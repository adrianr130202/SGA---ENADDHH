import { Router } from 'express';
import { createUserRouteSchema } from './user.routes.schemas.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../../database/db.js'; // <-- Importamos nuestro puente a Supabase
// import nodemailerService from '../../services/nodemailer.js'; // Descomentar en fase final

const userRouter = Router();

userRouter.post('/', async (req, res, next) => {
  const client = await pool.connect(); // <-- Usamos un cliente exclusivo para la transacción
  
  try {
    //  Validar el requerimiento usando Zod
    const body = createUserRouteSchema.body.parse(req.body);

    //  Encriptar la contraseña (10 rondas de salt)
    const passwordHash = await bcrypt.hash(body.password, 10);

    await client.query('BEGIN'); // <-- Iniciamos la transacción de seguridad

    //  Guardar en Supabase PostgreSQL y retornar el usuario creado
    const result = await client.query(
      'INSERT INTO users (email, "passwordHash") VALUES ($1, $2) RETURNING id, email, "emailVerified"',
      [body.email, passwordHash]
    );
    
    const createdUser = result.rows[0];

    // Lógica de envío de correo de validación (Comentada temporalmente)
    /*
    const emailToken = jwt.sign(
      { id: createdUser.id, email: createdUser.email },
      process.env.EMAIL_TOKEN_SECRET,
      { expiresIn: '1h' } // Buena práctica: darle caducidad al token de email
    );

    await nodemailerService.sendMail({
      to: createdUser.email,
      html: `
        <div>
          <h1>Verifica tu correo para el SGA-ENADDHH</h1>
          <a href="http://localhost:4321/verify/${emailToken}">Verificar Cuenta</a>
        </div>
        `,
    });
    */

    await client.query('COMMIT'); // <-- Confirmamos que todo salió bien y guardamos permanentemente
    
    //  Responder con el usuario creado (Status 201: Created)
    res.status(201).json(createdUser);

  } catch (error) {
    await client.query('ROLLBACK'); // <-- Deshace automáticamente la creación del usuario si algo falla arriba
    
    // Si el error es 23505 (Violación de restricción UNIQUE en Postgres) significa que el email ya existe
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un usuario administrador con este correo electrónico.' });
    }

    // Le pasamos el error a nuestro manejador global en index.js
    next(error);
  } finally {
    client.release(); // <-- Liberamos la conexión para que otros usuarios puedan usar el sistema
  }
});

export default userRouter;