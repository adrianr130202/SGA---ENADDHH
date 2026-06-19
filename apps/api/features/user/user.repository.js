import db from '../../database/db.js';

const userRepository = {
  // 1. Crear un nuevo administrador en la base de datos
  createUser({ email, passwordHash }) {
    const stmt = db.prepare('INSERT INTO users (email, passwordHash) VALUES (?, ?)');
    const info = stmt.run(email, passwordHash);
    
    // Retornamos el objeto del usuario recién creado
    return { id: info.lastInsertRowid, email: email, emailVerified: 0 };
  },

  // 2. Buscar un usuario por su correo electrónico (Usado en el Login)
  findUserByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  // 3. Eliminar un usuario por su ID (Usado en el "Rollback" si falla el registro)
  deleteUserById(id) {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(id);
  },

  // 4. Cambiar el estado de verificación del correo (Usado en la fase final)
  updateEmailVerify(id) {
    const stmt = db.prepare('UPDATE users SET emailVerified = 1 WHERE id = ?');
    return stmt.run(id);
  }
};

export default userRepository;