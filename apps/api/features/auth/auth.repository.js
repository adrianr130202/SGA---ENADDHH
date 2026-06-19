import db from '../../database/db.js';

const authRepository = {
  // Guarda un nuevo Refresh Token en la base de datos al hacer Login
  createSession({ jwtid, userId }) {
    const stmt = db.prepare('INSERT INTO sessions (jwtid, userId) VALUES (?, ?)');
    return stmt.run(jwtid, userId);
  },

  // Busca si la sesión existe cuando el frontend pide un /refresh
  findSessionByJwtId({ jwtid }) {
    return db.prepare('SELECT * FROM sessions WHERE jwtid = ?').get(jwtid);
  },

  // Reemplaza el token viejo por uno nuevo (Rotación de tokens de seguridad)
  updateSessionJwtId({ jwtid, id }) {
    const stmt = db.prepare('UPDATE sessions SET jwtid = ? WHERE id = ?');
    return stmt.run(jwtid, id);
  },

  // Elimina la sesión de SQLite cuando el usuario hace Signout (Cerrar sesión)
  deleteSession(id) {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
    return stmt.run(id);
  }
};

export default authRepository;