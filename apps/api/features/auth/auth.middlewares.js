import jwt from 'jsonwebtoken';

/**
 * Middleware para autenticar a los usuarios utilizando JWT.
 * Este middleware verifica que el token de acceso esté presente en el header de autorización y que sea válido. 
 * Si el token es válido, se agrega la información del usuario al objeto de la solicitud para que pueda ser utilizada en las rutas protegidas.
 * @param {import("express").Request} req - La solicitud HTTP entrante
 * @param {import("express").Response} res - La respuesta HTTP
 * @param {import("express").NextFunction} next - La función para pasar al siguiente middleware o ruta
 * @returns {void}
 */
export const authenticate = (req, res, next) => {
  // 1. Verificar que el header de autorización exista
  if (!req.headers.authorization) {
    return res.status(403).json({ error: 'No estas autenticado para esta operación' });
  }

  // 2. Verificar que el token sea válido
  const token = req.headers.authorization.split(' ')[1];
  const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

  // 3. Agregar la información del usuario al objeto de la solicitud
  req.user = { id: payload.id, email: payload.email };

  // 4. Continuar con la siguiente función de middleware o ruta
  next();
};
