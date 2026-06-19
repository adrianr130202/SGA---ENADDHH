import { Router } from 'express';
import { loginRouteSchema, verifyRouteSchema } from './auth.routes.schemas.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../../database/db.js'; // <-- Nuestro puente a PostgreSQL
import { authenticate } from './auth.middlewares.js'; 
// import nodemailerService from '../../services/nodemailer.js';

const authRouter = Router();

//  Ruta para iniciar sesión
authRouter.post('/login', async (req, res) => {
  try {
    //  Validamos la data recibida con Zod
    const body = loginRouteSchema.body.parse(req.body);

    //  Buscar el posible usuario en la base de datos de Supabase
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [body.email]);
    const user = userResult.rows[0];

    // NOTA DE TUTOR: Temporalmente quitamos la exigencia de emailVerified para no bloquear el desarrollo del MVP
    if (!user) {
      return res.status(403).json({ error: 'Usuario o contraseña inválida' });
    }

    //  Comprobar la contraseña
    const isPasswordCorrect = await bcrypt.compare(body.password, user.passwordHash);

    if (!isPasswordCorrect) {
      return res.status(403).json({ error: 'Usuario o contraseña inválida' });
    }

    //  Crear token de acceso rápido (para operaciones diarias, expira rápido)
    const accessToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '24h' }
    );

    //  Crear token de refresco (para no tener que iniciar sesión a cada rato)
    const refreshTokenId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: '7d',
        jwtid: refreshTokenId,
      }
    );

    // Guardamos la sesión en la base de datos (PostgreSQL)
    await pool.query(
      'INSERT INTO sessions (jwtid, "userId") VALUES ($1, $2)',
      [refreshTokenId, user.id]
    );

    // Enviamos el refresh token de forma segura en una Cookie
    const expireDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    res.cookie('refresh_token', refreshToken, {
      expires: expireDate,
      httpOnly: true, // Evita que JS del frontend lea la cookie (Seguridad extra)
      secure: process.env.ENV_MODE === 'prod',
      sameSite: 'strict',
    });

    // El Access Token viaja en el JSON
    return res.status(201).json({ accessToken, userId: user.id, email: user.email });
  } catch (error) {
    return res.status(500).json({ error: 'Error interno del servidor durante el inicio de sesión.' });
  }
});

//  Ruta para verificar el correo del usuario 

authRouter.patch('/verify', async (req, res, next) => {
  try {
    const { token } = verifyRouteSchema.body.parse(req.body);
    const decodedToken = jwt.verify(token, process.env.EMAIL_TOKEN_SECRET);
    
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [decodedToken.email]);
    const user = userResult.rows[0];

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    if (user.emailVerified) {
      return res.status(200).json({ message: 'El usuario ya está verificado.' });
    }

    await pool.query('UPDATE users SET "emailVerified" = true WHERE id = $1', [decodedToken.id]);
    return res.status(200).json({ message: 'Usuario verificado en el SGA.' });
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      // Aquí iría la lógica de Nodemailer para reenviar el correo cuando lo activemos
      console.log("Token expirado, se requiere reenviar correo a:", req.body.token);
      // next(new Error("Lógica de reenvío pendiente de activar"));
    }
    next(error);
  }
});


// Ruta para refrescar el token de acceso
authRouter.get('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) return res.sendStatus(401);

  try {
    const decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE jwtid = $1', [decodedToken.jti]);
    const session = sessionResult.rows[0];
    
    if (!session) return res.sendStatus(401);

    const accessToken = jwt.sign(
      { id: decodedToken.id, email: decodedToken.email },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '30m' }
    );

    const refreshTokenId = crypto.randomUUID();
    const newRefreshToken = jwt.sign(
      { id: decodedToken.id, email: decodedToken.email },
      process.env.REFRESH_TOKEN_SECRET,
      {
        expiresIn: '7d',
        jwtid: refreshTokenId,
      }
    );

    const expireDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
    res.cookie('refresh_token', newRefreshToken, {
      expires: expireDate,
      httpOnly: true,
      secure: process.env.ENV_MODE === 'prod',
      sameSite: 'strict',
    });

    await pool.query('UPDATE sessions SET jwtid = $1 WHERE id = $2', [refreshTokenId, session.id]);

    return res.status(200).json({ accessToken, userId: decodedToken.id, email: decodedToken.email });
  } catch (error) {
    return res.sendStatus(401);
  }
});



// Ruta para obtener la información del usuario autenticado
authRouter.get('/user', authenticate, async (req, res) => {
  return res.status(200).json(req.user);
});



//  Ruta para cerrar sesión
authRouter.get('/signout', authenticate, async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;

  if (!refreshToken) return res.sendStatus(204);

  try {
    const decodedToken = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    const sessionResult = await pool.query('SELECT * FROM sessions WHERE jwtid = $1', [decodedToken.jti]);
    const session = sessionResult.rows[0];
    
    if (!session) return res.sendStatus(401);

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: process.env.ENV_MODE === 'prod',
      sameSite: 'strict',
    });

    await pool.query('DELETE FROM sessions WHERE id = $1', [session.id]);
    return res.sendStatus(204);
  } catch (error) {
    return res.sendStatus(204); // Si falla, de todas formas lo consideramos "desconectado"
  }
});

export default authRouter;