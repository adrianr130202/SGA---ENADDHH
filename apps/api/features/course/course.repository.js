import db from '../../database/db.js';

const courseRepository = {
  //  Obtener todos los diplomados
  getAllCourses() {
    return db.prepare("SELECT * FROM courses WHERE status = 'active' ORDER BY name ASC").all();
  },

  // Crear un nuevo diplomado
  createCourse({ name, description }) {
    const stmt = db.prepare('INSERT INTO courses (name, description) VALUES (?, ?)');
    const info = stmt.run(name, description);
    return { id: info.lastInsertRowid, name, description, status: 'active' };
  },

  //  Actualizar un diplomado existente
  updateCourse(id, { name, description }) {
    const stmt = db.prepare('UPDATE courses SET name = ?, description = ? WHERE id = ?');
    return stmt.run(name, description, id);
  },

  //  Obtener estudiantes inscritos en un diplomado específico (Cruce de tablas)
  getStudentsByCourse(courseId) {
    return db.prepare(`
      SELECT s.cedula, s.fullName, s.email, e.createdAt as fechaInscripcion
      FROM enrollments e
      JOIN students s ON e.studentCedula = s.cedula
      WHERE e.courseId = ?
      ORDER BY s.fullName ASC
    `).all(courseId);
  }
};

export default courseRepository;